-- Fix operating days format inconsistency by updating SQL functions to use array format
-- This approach aligns with existing database storage and API endpoint patterns

-- 1. Check current settings and open days (BEFORE)
SELECT 'BEFORE: Operating days setting' AS check_type;
SELECT setting_key, setting_value, jsonb_typeof(setting_value) AS value_type
FROM schedule_settings
WHERE setting_key = 'operating_days';

SELECT 'BEFORE: Sample of open days (next 7 days)' AS check_type;
SELECT date, is_open, to_char(date, 'Day') AS day_name
FROM open_days
WHERE date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')
ORDER BY date;

-- 2. Update SQL functions to use array format instead of object format
-- Fix is_slot_valid_in_schedule function
CREATE OR REPLACE FUNCTION public.is_slot_valid_in_schedule(check_date date, check_time text, operating_days jsonb, time_slots_config jsonb)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
DECLARE
  day_name TEXT;
  is_operating_day BOOLEAN;
  is_valid_time BOOLEAN;
  is_holiday BOOLEAN;
BEGIN
  -- Get day name
  day_name := LOWER(TO_CHAR(check_date, 'Day'));
  day_name := TRIM(day_name);

  -- Check if it's an operating day (using array format)
  SELECT (operating_days @> to_jsonb(day_name)) INTO is_operating_day;

  -- Check if it's a valid time slot (using array format)
  SELECT (time_slots_config @> to_jsonb(check_time)) INTO is_valid_time;

  -- Check if it's a holiday
  SELECT EXISTS(
    SELECT 1 FROM holidays
    WHERE date = check_date
    AND (is_disabled IS FALSE OR is_disabled IS NULL)
  ) INTO is_holiday;

  -- Slot is valid if it's an operating day, valid time, and not a holiday
  RETURN is_operating_day AND is_valid_time AND NOT is_holiday;
END;
$function$;

-- 3. Update generate_open_days_and_slots function to use array format
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

  -- Get season settings
  SELECT (setting_value #>> '{}')::INTEGER INTO season_start_month FROM schedule_settings WHERE setting_key = 'season_start_month';
  SELECT (setting_value #>> '{}')::INTEGER INTO season_start_day FROM schedule_settings WHERE setting_key = 'season_start_day';
  SELECT (setting_value #>> '{}')::INTEGER INTO season_end_month FROM schedule_settings WHERE setting_key = 'season_end_month';
  SELECT (setting_value #>> '{}')::INTEGER INTO season_end_day FROM schedule_settings WHERE setting_key = 'season_end_day';

  -- Generate dates for the specified number of days ahead
  FOR i IN 0..days_ahead LOOP
    current_date_iter := CURRENT_DATE + INTERVAL '1 day' * i;

    -- Get day name (lowercase)
    day_name := LOWER(TO_CHAR(current_date_iter, 'Day'));
    day_name := TRIM(day_name);

    -- Check if this date is a holiday
    SELECT EXISTS(
      SELECT 1 FROM holidays
      WHERE date = current_date_iter
      AND (is_disabled IS FALSE OR is_disabled IS NULL)
    ) INTO is_holiday;

    -- Check if within season
    within_season := (
      (EXTRACT(MONTH FROM current_date_iter) > season_start_month OR
       (EXTRACT(MONTH FROM current_date_iter) = season_start_month AND EXTRACT(DAY FROM current_date_iter) >= season_start_day))
      AND
      (EXTRACT(MONTH FROM current_date_iter) < season_end_month OR
       (EXTRACT(MONTH FROM current_date_iter) = season_end_month AND EXTRACT(DAY FROM current_date_iter) <= season_end_day))
    );

    -- Check if this is an operating day and within season and not a holiday (using array format)
    IF (operating_days @> to_jsonb(day_name)) AND within_season AND NOT is_holiday THEN
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
$function$;

-- 4. Update refresh_future_schedule function to use array format
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

  -- Check all future time slots to see if they're still valid
  FOR slot_record IN
    SELECT date, time, max_bouquets, max_bookings, is_legacy
    FROM time_slots
    WHERE date >= CURRENT_DATE
  LOOP
    -- Check if this slot is still valid in the current schedule (using array format)
    slot_still_valid := is_slot_valid_in_schedule(
      slot_record.date,
      slot_record.time,
      operating_days,
      time_slots_config
    );

    -- Count existing bookings for this slot
    SELECT COUNT(*) INTO booking_count
    FROM bookings
    WHERE date = slot_record.date
      AND time = slot_record.time
      AND status IN ('confirmed', 'pending');

    IF slot_still_valid THEN
      -- Update capacity for valid slots (but don't reduce below existing bookings)
      UPDATE time_slots
      SET
        max_bouquets = GREATEST(new_max_capacity, booking_count),
        max_bookings = GREATEST(new_max_bookings, booking_count)
      WHERE date = slot_record.date AND time = slot_record.time;
    ELSE
      -- Mark invalid slots as legacy if they have bookings, otherwise remove them
      IF booking_count > 0 THEN
        UPDATE time_slots
        SET is_legacy = true
        WHERE date = slot_record.date AND time = slot_record.time;

        -- Also mark the day as closed if no other valid slots exist
        UPDATE open_days
        SET is_open = false
        WHERE date = slot_record.date
          AND NOT EXISTS (
            SELECT 1 FROM time_slots ts2
            WHERE ts2.date = slot_record.date
              AND ts2.is_legacy = false
          );
      ELSE
        -- Remove slots with no bookings
        DELETE FROM time_slots
        WHERE date = slot_record.date AND time = slot_record.time;
      END IF;
    END IF;
  END LOOP;

  -- Generate new schedule for future dates
  PERFORM generate_open_days_and_slots(60);
END;
$function$;

-- 5. Force refresh the schedule to apply the fix
SELECT 'Refreshing schedule with fixed operating days format...' AS status;
SELECT refresh_future_schedule();

-- 6. Check updated settings and open days (AFTER)
SELECT 'AFTER: Operating days setting' AS check_type;
SELECT setting_key, setting_value, jsonb_typeof(setting_value) AS value_type
FROM schedule_settings
WHERE setting_key = 'operating_days';

SELECT 'AFTER: Sample of open days (next 14 days)' AS check_type;
SELECT date, is_open, to_char(date, 'Day') AS day_name
FROM open_days
WHERE date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '14 days')
ORDER BY date;

-- 7. Verify that time slots were generated for open days
SELECT 'AFTER: Time slots for open days (next 7 days)' AS check_type;
SELECT ts.date, ts.time, od.is_open, to_char(ts.date, 'Day') AS day_name
FROM time_slots ts
JOIN open_days od ON ts.date = od.date
WHERE ts.date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')
  AND od.is_open = true
ORDER BY ts.date, ts.time;

-- 8. Final validation - check that operating days are correctly applied
SELECT 'VALIDATION: Days that should be open based on operating_days setting' AS check_type;
WITH operating_days_expanded AS (
  SELECT jsonb_array_elements_text(setting_value) AS day_name
  FROM schedule_settings
  WHERE setting_key = 'operating_days'
)
SELECT
  d.date,
  LOWER(TRIM(TO_CHAR(d.date, 'Day'))) AS day_name,
  od.is_open,
  CASE
    WHEN ode.day_name IS NOT NULL THEN 'Should be open'
    ELSE 'Should be closed'
  END AS expected_status,
  CASE
    WHEN (ode.day_name IS NOT NULL AND od.is_open) OR (ode.day_name IS NULL AND NOT od.is_open) THEN 'CORRECT'
    ELSE 'INCORRECT'
  END AS validation_result
FROM (
  SELECT CURRENT_DATE + generate_series(0, 13) AS date
) d
LEFT JOIN open_days od ON d.date = od.date
LEFT JOIN operating_days_expanded ode ON LOWER(TRIM(TO_CHAR(d.date, 'Day'))) = ode.day_name
ORDER BY d.date;

-- 8. Check if there are any existing bookings for Monday or Tuesday
SELECT 'VERIFICATION: Existing bookings for Monday and Tuesday' AS check_type;
SELECT date, time, status, bouquets_count, to_char(date, 'Day') AS day_name
FROM bookings
WHERE 
  date > CURRENT_DATE
  AND (
    TRIM(LOWER(to_char(date, 'Day'))) = 'monday' OR
    TRIM(LOWER(to_char(date, 'Day'))) = 'tuesday'
  )
ORDER BY date, time;