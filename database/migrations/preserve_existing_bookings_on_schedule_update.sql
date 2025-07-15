-- Preserve existing bookings when schedule is updated
-- Run this in your Supabase SQL Editor

-- 1. Add is_legacy field to time_slots table
ALTER TABLE time_slots 
ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN DEFAULT FALSE;

-- 2. Add index for performance on legacy slots
CREATE INDEX IF NOT EXISTS idx_time_slots_legacy ON time_slots(is_legacy) WHERE is_legacy = true;

-- 3. Create helper function to check if a slot is valid in current schedule
CREATE OR REPLACE FUNCTION is_slot_valid_in_schedule(
  check_date DATE,
  check_time TEXT,
  operating_days JSONB,
  time_slots_config JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  day_name TEXT;
  is_operating_day BOOLEAN;
  is_valid_time BOOLEAN;
  is_holiday BOOLEAN;
BEGIN
  -- Get day name
  day_name := LOWER(TO_CHAR(check_date, 'Day'));
  day_name := TRIM(day_name);
  
  -- Check if it's an operating day
  SELECT (operating_days ? day_name) INTO is_operating_day;
  
  -- Check if it's a valid time slot
  SELECT (time_slots_config ? check_time) INTO is_valid_time;
  
  -- Check if it's a holiday
  SELECT EXISTS(
    SELECT 1 FROM holidays 
    WHERE date = check_date 
    AND enabled = true
  ) INTO is_holiday;
  
  -- Slot is valid if it's an operating day, valid time, and not a holiday
  RETURN is_operating_day AND is_valid_time AND NOT is_holiday;
END;
$$ LANGUAGE plpgsql;

-- 4. Update the refresh_future_schedule function to preserve existing bookings
CREATE OR REPLACE FUNCTION refresh_future_schedule()
RETURNS VOID AS $$
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
        -- Slot no longer in schedule but has bookings - mark as legacy
        UPDATE time_slots 
        SET is_legacy = TRUE
        WHERE id = slot_record.id;
        -- Keep original capacities for legacy slots
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
END;
$$ LANGUAGE plpgsql;

-- 5. Update generate_open_days_and_slots to respect existing slots
CREATE OR REPLACE FUNCTION generate_open_days_and_slots(days_ahead INTEGER DEFAULT 60)
RETURNS VOID AS $$
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
      AND enabled = true
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
          max_bouquets = CASE WHEN time_slots.is_legacy THEN time_slots.max_bouquets ELSE EXCLUDED.max_bouquets END,
          max_bookings = CASE WHEN time_slots.is_legacy THEN time_slots.max_bookings ELSE EXCLUDED.max_bookings END;
      END LOOP;
    ELSE
      -- Mark as closed if it's a holiday or not an operating day or out of season
      INSERT INTO open_days (date, is_open)
      VALUES (current_date_iter, false)
      ON CONFLICT (date) DO UPDATE SET is_open = false;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 6. Update reschedule_booking function to handle legacy slots properly
-- (Allow rescheduling existing bookings to legacy slots, but prevent new bookings to legacy slots)
CREATE OR REPLACE FUNCTION reschedule_booking(
    p_cancellation_token UUID,
    p_new_date DATE,
    p_new_time VARCHAR(20),
    p_reschedule_reason VARCHAR(500) DEFAULT NULL,
    p_customer_ip VARCHAR(45) DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    booking_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking_record RECORD;
    v_booking_data JSONB;
    v_slot_capacity INTEGER;
    v_slot_bookings INTEGER;
    v_slot_is_legacy BOOLEAN;
    v_current_bookings INTEGER;
    v_current_bouquets INTEGER;
BEGIN
    -- Find booking by cancellation token
    SELECT * INTO v_booking_record
    FROM bookings
    WHERE cancellation_token = p_cancellation_token
    AND status = 'confirmed';

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Booking not found or already cancelled', NULL::JSONB;
        RETURN;
    END IF;

    -- Validate new date is not in the past (using business timezone)
    IF p_new_date < CURRENT_DATE THEN
        RETURN QUERY SELECT false, 'Cannot reschedule to past dates', NULL::JSONB;
        RETURN;
    END IF;

    -- Check if new time slot exists (including legacy slots for rescheduling)
    SELECT max_bouquets, max_bookings, COALESCE(is_legacy, false)
    INTO v_slot_capacity, v_slot_bookings, v_slot_is_legacy
    FROM time_slots
    WHERE date = p_new_date AND time = p_new_time;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Selected time slot is not available', NULL::JSONB;
        RETURN;
    END IF;

    -- Count current bookings for the new slot (excluding this booking if it's the same slot)
    SELECT COUNT(*), COALESCE(SUM(number_of_bouquets), 0)
    INTO v_current_bookings, v_current_bouquets
    FROM bookings
    WHERE date = p_new_date
    AND time = p_new_time
    AND status = 'confirmed'
    AND id != v_booking_record.id;

    -- Check booking limit
    IF v_current_bookings >= v_slot_bookings THEN
        RETURN QUERY SELECT false, 'Maximum bookings reached for this time slot', NULL::JSONB;
        RETURN;
    END IF;

    -- Check bouquet capacity
    IF v_current_bouquets + v_booking_record.number_of_bouquets > v_slot_capacity THEN
        RETURN QUERY SELECT false, 'Not enough bouquet capacity remaining for this time slot', NULL::JSONB;
        RETURN;
    END IF;

    -- Prepare booking data for audit trail
    v_booking_data := jsonb_build_object(
        'id', v_booking_record.id,
        'full_name', v_booking_record.full_name,
        'email', v_booking_record.email,
        'phone', v_booking_record.phone,
        'original_date', v_booking_record.date,
        'original_time', v_booking_record.time,
        'number_of_bouquets', v_booking_record.number_of_bouquets,
        'total_amount', v_booking_record.total_amount,
        'payment_method', v_booking_record.payment_method,
        'payment_status', v_booking_record.payment_status
    );

    -- Start transaction for atomic reschedule
    BEGIN
        -- Update booking with new date/time
        UPDATE bookings
        SET date = p_new_date,
            time = p_new_time,
            reschedule_count = reschedule_count + 1,
            last_rescheduled_at = NOW()
        WHERE id = v_booking_record.id;

        -- Insert "reschedule from" record
        INSERT INTO booking_actions (
            booking_id,
            action_type,
            original_booking_data,
            reason,
            original_date,
            original_time,
            new_date,
            new_time,
            performed_by_customer,
            customer_ip
        ) VALUES (
            v_booking_record.id,
            'reschedule_from',
            v_booking_data,
            p_reschedule_reason,
            v_booking_record.date,
            v_booking_record.time,
            p_new_date,
            p_new_time,
            true,
            p_customer_ip
        );

        -- Insert "reschedule to" record
        INSERT INTO booking_actions (
            booking_id,
            action_type,
            original_booking_data,
            reason,
            original_date,
            original_time,
            new_date,
            new_time,
            performed_by_customer,
            customer_ip
        ) VALUES (
            v_booking_record.id,
            'reschedule_to',
            v_booking_data,
            p_reschedule_reason,
            v_booking_record.date,
            v_booking_record.time,
            p_new_date,
            p_new_time,
            true,
            p_customer_ip
        );

        -- Return success with updated booking data
        RETURN QUERY SELECT true, 'Booking rescheduled successfully', jsonb_build_object(
            'booking_id', v_booking_record.id,
            'new_date', p_new_date,
            'new_time', p_new_time,
            'reschedule_count', v_booking_record.reschedule_count + 1
        );

    EXCEPTION WHEN OTHERS THEN
        -- Rollback handled automatically
        RETURN QUERY SELECT false, 'Failed to reschedule booking: ' || SQLERRM, NULL::JSONB;
    END;
END;
$$;

-- 7. Update views to include legacy slot information for admin interfaces
-- Drop existing views first to avoid column conflicts
DROP VIEW IF EXISTS time_slot_status CASCADE;
DROP VIEW IF EXISTS booking_summary CASCADE;

-- Recreate time_slot_status view with legacy information
CREATE VIEW time_slot_status AS
SELECT
  ts.id,
  ts.date,
  ts.time,
  ts.max_bouquets,
  ts.max_bookings,
  ts.is_legacy,
  COUNT(b.id) as current_bookings,
  COALESCE(SUM(b.number_of_bouquets), 0) as current_bouquets,
  (ts.max_bookings - COUNT(b.id)) as bookings_remaining,
  (ts.max_bouquets - COALESCE(SUM(b.number_of_bouquets), 0)) as bouquet_spots_remaining,
  CASE
    WHEN COUNT(b.id) >= ts.max_bookings THEN 'BOOKING_LIMIT_REACHED'
    WHEN COALESCE(SUM(b.number_of_bouquets), 0) >= ts.max_bouquets THEN 'BOUQUET_LIMIT_REACHED'
    WHEN ts.is_legacy THEN 'LEGACY_SLOT'
    ELSE 'AVAILABLE'
  END as availability_status
FROM time_slots ts
LEFT JOIN bookings b ON ts.date = b.date AND ts.time = b.time AND b.status = 'confirmed'
GROUP BY ts.id, ts.date, ts.time, ts.max_bouquets, ts.max_bookings, ts.is_legacy
ORDER BY ts.date, ts.time;

-- Recreate booking_summary view with legacy information
CREATE VIEW booking_summary AS
SELECT
  b.id,
  b.full_name,
  b.email,
  b.phone,
  b.date,
  b.time,
  b.number_of_bouquets,
  b.total_amount,
  b.created_at,
  ts.max_bouquets,
  ts.is_legacy,
  (
    SELECT COALESCE(SUM(number_of_bouquets), 0)
    FROM bookings b2
    WHERE b2.date = b.date AND b2.time = b.time AND b2.status = 'confirmed'
  ) as total_bouquets_for_slot
FROM bookings b
JOIN time_slots ts ON b.date = ts.date AND b.time = ts.time
ORDER BY b.date, b.time, b.created_at;

-- 8. Add helpful comments
COMMENT ON COLUMN time_slots.is_legacy IS 'Marks time slots that exist only to preserve existing bookings after schedule changes';
COMMENT ON FUNCTION refresh_future_schedule() IS 'Updates schedule while preserving existing bookings - never deletes slots with confirmed bookings';
COMMENT ON FUNCTION is_slot_valid_in_schedule(DATE, TEXT, JSONB, JSONB) IS 'Helper function to check if a date/time combination is valid in current schedule settings';

-- 9. Verification queries (run these to check the migration worked)
-- Check if is_legacy column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'time_slots' AND column_name = 'is_legacy';

-- Check current time slots and their legacy status
SELECT date, time, max_bouquets, max_bookings, is_legacy,
       (SELECT COUNT(*) FROM bookings b WHERE b.date = ts.date AND b.time = ts.time AND b.status = 'confirmed') as confirmed_bookings
FROM time_slots ts
WHERE date >= CURRENT_DATE
ORDER BY date, time
LIMIT 10;

-- Verify functions exist
SELECT proname, prosrc IS NOT NULL as has_source
FROM pg_proc
WHERE proname IN ('refresh_future_schedule', 'is_slot_valid_in_schedule', 'reschedule_booking')
ORDER BY proname;

-- Success message
SELECT 'Migration completed successfully! Existing bookings will be preserved during schedule updates.' as status;
