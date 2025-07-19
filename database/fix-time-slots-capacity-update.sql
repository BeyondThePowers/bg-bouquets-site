-- Fix for time_slots capacity values not updating when saving schedule settings

-- 1. First, let's update the generate_open_days_and_slots function to always apply capacity updates
CREATE OR REPLACE FUNCTION public.generate_open_days_and_slots(days_ahead integer DEFAULT 60)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  operating_days JSONB;
  time_slots JSONB;
  max_capacity INTEGER;
  max_bookings INTEGER;
  current_date_iter DATE;
  day_name TEXT;
  time_slot TEXT;
  is_holiday BOOLEAN;
  season_start_month INTEGER;
  season_start_day INTEGER;
  season_end_month INTEGER;
  season_end_day INTEGER;
  within_season BOOLEAN;
BEGIN
  -- Get current settings
  SELECT setting_value INTO operating_days FROM schedule_settings WHERE setting_key = 'operating_days';
  SELECT setting_value INTO time_slots FROM schedule_settings WHERE setting_key = 'time_slots';
  SELECT (setting_value #>> '{}')::INTEGER INTO max_capacity FROM schedule_settings WHERE setting_key = 'max_bouquets_per_slot';
  SELECT (setting_value #>> '{}')::INTEGER INTO max_bookings FROM schedule_settings WHERE setting_key = 'max_bookings_per_slot';
  SELECT (setting_value #>> '{}')::INTEGER INTO season_start_month FROM schedule_settings WHERE setting_key = 'season_start_month';
  SELECT (setting_value #>> '{}')::INTEGER INTO season_start_day FROM schedule_settings WHERE setting_key = 'season_start_day';
  SELECT (setting_value #>> '{}')::INTEGER INTO season_end_month FROM schedule_settings WHERE setting_key = 'season_end_month';
  SELECT (setting_value #>> '{}')::INTEGER INTO season_end_day FROM schedule_settings WHERE setting_key = 'season_end_day';

  -- Generate days starting from tomorrow
  FOR i IN 1..days_ahead LOOP
    current_date_iter := CURRENT_DATE + i;
    day_name := LOWER(TO_CHAR(current_date_iter, 'Day'));
    day_name := TRIM(day_name);

    -- Check if this date is a holiday
    SELECT EXISTS(
      SELECT 1 FROM holidays
      WHERE date = current_date_iter
      AND NOT is_override_allowed
      AND (is_disabled IS FALSE OR is_disabled IS NULL)
    ) INTO is_holiday;

    -- Check if within season (if season settings exist)
    within_season := true;
    IF season_start_month IS NOT NULL AND season_end_month IS NOT NULL THEN
      within_season := (
        (EXTRACT(MONTH FROM current_date_iter) > season_start_month OR
         (EXTRACT(MONTH FROM current_date_iter) = season_start_month AND EXTRACT(DAY FROM current_date_iter) >= season_start_day))
        AND
        (EXTRACT(MONTH FROM current_date_iter) < season_end_month OR
         (EXTRACT(MONTH FROM current_date_iter) = season_end_month AND EXTRACT(DAY FROM current_date_iter) <= season_end_day))
      );
    END IF;

    -- Check if this is an operating day and within season and not a holiday
    IF (operating_days ? day_name) AND within_season AND NOT is_holiday THEN
      -- Insert open day (skip if exists)
      INSERT INTO open_days (date, is_open)
      VALUES (current_date_iter, true)
      ON CONFLICT (date) DO UPDATE SET is_open = true;

      -- Insert time slots for this open day (skip if exists)
      FOR j IN 0..jsonb_array_length(time_slots) - 1 LOOP
        time_slot := time_slots ->> j;
        INSERT INTO time_slots (date, time, max_bouquets, max_bookings, is_legacy)
        VALUES (current_date_iter, time_slot, max_capacity, max_bookings, false)
        ON CONFLICT (date, time) DO UPDATE SET
          -- FIX: Always update capacity values regardless of legacy status
          max_bouquets = EXCLUDED.max_bouquets,
          max_bookings = EXCLUDED.max_bookings;
      END LOOP;
    ELSE
      -- Mark as closed if it's a holiday or not an operating day or out of season
      INSERT INTO open_days (date, is_open)
      VALUES (current_date_iter, false)
      ON CONFLICT (date) DO UPDATE SET is_open = false;
    END IF;
  END LOOP;
END;
$function$;

-- 2. Now let's modify the refresh_future_schedule function to ensure capacity updates
CREATE OR REPLACE FUNCTION public.refresh_future_schedule()
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  slot_record RECORD;
  booking_count INTEGER;
  new_max_capacity INTEGER;
  new_max_bookings INTEGER;
  operating_days JSONB;
  time_slots_config JSONB;
  slot_still_valid BOOLEAN;
BEGIN
  -- Get current schedule settings
  SELECT setting_value INTO operating_days FROM schedule_settings WHERE setting_key = 'operating_days';
  SELECT setting_value INTO time_slots_config FROM schedule_settings WHERE setting_key = 'time_slots';
  SELECT (setting_value #>> '{}')::INTEGER INTO new_max_capacity FROM schedule_settings WHERE setting_key = 'max_bouquets_per_slot';
  SELECT (setting_value #>> '{}')::INTEGER INTO new_max_bookings FROM schedule_settings WHERE setting_key = 'max_bookings_per_slot';

  -- Process each future time slot
  FOR slot_record IN 
    SELECT id, date, time, max_bouquets, max_bookings, is_legacy
    FROM time_slots 
    WHERE date > CURRENT_DATE
  LOOP
    -- Count confirmed bookings for this slot
    SELECT COUNT(*) INTO booking_count
    FROM bookings 
    WHERE date = slot_record.date 
    AND time = slot_record.time 
    AND status = 'confirmed';

    -- Check if this slot would still be valid under new schedule
    slot_still_valid := is_slot_valid_in_schedule(
      slot_record.date, 
      slot_record.time, 
      operating_days, 
      time_slots_config
    );

    IF booking_count > 0 THEN
      -- Preserve slot with existing bookings
      IF slot_still_valid THEN
        -- Slot is still in new schedule - update capacities
        UPDATE time_slots 
        SET max_bouquets = new_max_capacity,
            max_bookings = new_max_bookings,
            is_legacy = FALSE
        WHERE id = slot_record.id;
      ELSE
        -- FIX: Even for legacy slots with bookings, update the capacity values
        UPDATE time_slots 
        SET max_bouquets = new_max_capacity,
            max_bookings = new_max_bookings,
            is_legacy = TRUE
        WHERE id = slot_record.id;
      END IF;
    ELSE
      -- No bookings in this slot
      IF slot_still_valid THEN
        -- Update to new schedule settings
        UPDATE time_slots 
        SET max_bouquets = new_max_capacity,
            max_bookings = new_max_bookings,
            is_legacy = FALSE
        WHERE id = slot_record.id;
      ELSE
        -- No bookings and not in new schedule - safe to delete
        DELETE FROM time_slots WHERE id = slot_record.id;
      END IF;
    END IF;
  END LOOP;

  -- Remove future open days that are no longer valid (but preserve those with bookings)
  DELETE FROM open_days 
  WHERE date > CURRENT_DATE 
  AND NOT EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.date = open_days.date 
    AND b.status = 'confirmed'
  );

  -- Regenerate future schedule (this will create new slots and skip existing ones)
  PERFORM generate_open_days_and_slots(60);
  
  -- 3. Run a one-time update to fix any legacy time slots with outdated capacity values
  UPDATE time_slots
  SET max_bouquets = (SELECT (setting_value #>> '{}')::INTEGER FROM schedule_settings WHERE setting_key = 'max_bouquets_per_slot'),
      max_bookings = (SELECT (setting_value #>> '{}')::INTEGER FROM schedule_settings WHERE setting_key = 'max_bookings_per_slot')
  WHERE date > CURRENT_DATE;
END;
$function$;

-- Add comments to document the fixes
COMMENT ON FUNCTION public.generate_open_days_and_slots IS 'Generates open days and time slots based on schedule settings. Modified to always update capacity values regardless of legacy status.';
COMMENT ON FUNCTION public.refresh_future_schedule IS 'Updates schedule while preserving existing bookings. Fixed to update capacity values for all slots including legacy ones.';

-- Immediately run the fix for existing slots
UPDATE time_slots
SET max_bouquets = (SELECT (setting_value #>> '{}')::INTEGER FROM schedule_settings WHERE setting_key = 'max_bouquets_per_slot'),
    max_bookings = (SELECT (setting_value #>> '{}')::INTEGER FROM schedule_settings WHERE setting_key = 'max_bookings_per_slot')
WHERE date > CURRENT_DATE;

-- Run a schedule refresh to apply all changes
SELECT refresh_future_schedule();