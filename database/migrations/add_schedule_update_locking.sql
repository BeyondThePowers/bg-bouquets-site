-- Migration to add schedule update locking mechanism
-- This prevents race conditions between admin schedule updates and customer bookings

-- 1. Add columns to schedule_settings table for locking mechanism
ALTER TABLE schedule_settings 
ADD COLUMN IF NOT EXISTS schedule_update_in_progress BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS schedule_update_scheduled_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS schedule_update_scheduled_by TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS schedule_update_json JSONB DEFAULT NULL;

-- 2. Add index for efficient queries on scheduled updates
CREATE INDEX IF NOT EXISTS idx_schedule_update_scheduled_at 
ON schedule_settings(schedule_update_scheduled_at) 
WHERE schedule_update_scheduled_at IS NOT NULL;

-- 3. Add function to check if booking is allowed (no update in progress)
CREATE OR REPLACE FUNCTION is_booking_allowed()
RETURNS BOOLEAN AS $$
DECLARE
  update_in_progress BOOLEAN;
  scheduled_update TIMESTAMPTZ;
BEGIN
  -- Get current update status
  SELECT 
    schedule_update_in_progress,
    schedule_update_scheduled_at
  INTO 
    update_in_progress,
    scheduled_update
  FROM schedule_settings
  WHERE setting_key = 'max_bouquets_per_slot' 
  LIMIT 1;
  
  -- If no records found, allow booking (system not configured yet)
  IF update_in_progress IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Check if immediate update is in progress
  IF update_in_progress = TRUE THEN
    RETURN FALSE;
  END IF;
  
  -- Check if scheduled update is happening very soon (within 5 minutes)
  IF scheduled_update IS NOT NULL AND 
     scheduled_update < (NOW() + INTERVAL '5 minutes') THEN
    RETURN FALSE;
  END IF;
  
  -- Otherwise booking is allowed
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 4. Create function to process scheduled updates
CREATE OR REPLACE FUNCTION process_scheduled_updates()
RETURNS VOID AS $$
DECLARE
  settings_record RECORD;
  update_data JSONB;
BEGIN
  -- Find settings record with pending scheduled update
  SELECT * INTO settings_record
  FROM schedule_settings
  WHERE 
    setting_key = 'max_bouquets_per_slot' AND
    schedule_update_scheduled_at IS NOT NULL AND
    schedule_update_scheduled_at <= NOW();
  
  -- Exit if no scheduled update is pending
  IF settings_record IS NULL THEN
    RETURN;
  END IF;
  
  -- Get the scheduled update data
  update_data := settings_record.schedule_update_json;
  
  -- Mark update as in progress
  UPDATE schedule_settings
  SET schedule_update_in_progress = TRUE
  WHERE setting_key = 'max_bouquets_per_slot';
  
  -- Apply each setting from the update data
  FOR i IN 0..jsonb_array_length(update_data -> 'settings') - 1 LOOP
    UPDATE schedule_settings
    SET setting_value = (update_data -> 'settings' -> i -> 'value')::TEXT
    WHERE setting_key = (update_data -> 'settings' -> i -> 'key')::TEXT;
  END LOOP;
  
  -- Refresh the schedule with new settings
  PERFORM refresh_future_schedule();
  
  -- Clear update flags after successful update
  UPDATE schedule_settings
  SET 
    schedule_update_in_progress = FALSE,
    schedule_update_scheduled_at = NULL,
    schedule_update_scheduled_by = NULL,
    schedule_update_json = NULL
  WHERE setting_key = 'max_bouquets_per_slot';
  
  -- Insert a log entry in schedule_update_logs table
  INSERT INTO schedule_update_logs (
    updated_at,
    updated_by,
    update_type,
    update_data
  ) VALUES (
    NOW(),
    settings_record.schedule_update_scheduled_by,
    'scheduled',
    update_data
  );
END;
$$ LANGUAGE plpgsql;

-- 5. Create schedule_update_logs table for audit trail
CREATE TABLE IF NOT EXISTS schedule_update_logs (
  id SERIAL PRIMARY KEY,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,
  update_type TEXT NOT NULL,  -- 'immediate' or 'scheduled'
  update_data JSONB,
  status TEXT NOT NULL DEFAULT 'completed'
);

-- 6. Create safety auto-timeout function
CREATE OR REPLACE FUNCTION auto_timeout_schedule_updates()
RETURNS VOID AS $$
BEGIN
  -- Auto-timeout any in-progress update older than 30 minutes
  UPDATE schedule_settings
  SET 
    schedule_update_in_progress = FALSE,
    schedule_update_scheduled_at = NULL,
    schedule_update_json = NULL
  WHERE 
    setting_key = 'max_bouquets_per_slot' AND
    schedule_update_in_progress = TRUE AND
    (schedule_update_json ->> 'lock_timestamp')::TIMESTAMPTZ < (NOW() - INTERVAL '30 minutes');
    
  -- Log the auto-timeout
  IF FOUND THEN
    INSERT INTO schedule_update_logs (
      updated_at,
      updated_by,
      update_type,
      update_data,
      status
    ) VALUES (
      NOW(),
      'system',
      'auto-timeout',
      (SELECT schedule_update_json FROM schedule_settings WHERE setting_key = 'max_bouquets_per_slot'),
      'timed_out'
    );
  END IF;
END;
$$ LANGUAGE plpgsql;