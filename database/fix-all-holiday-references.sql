-- Comprehensive fix for all functions referencing the old 'enabled' column
-- This migration updates all remaining functions to use is_disabled instead of enabled

-- 1. Fix is_slot_valid_in_schedule function
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
  
  -- Check if it's an operating day
  SELECT (operating_days ? day_name) INTO is_operating_day;
  
  -- Check if it's a valid time slot
  SELECT (time_slots_config ? check_time) INTO is_valid_time;
  
  -- Check if it's a holiday (using is_disabled instead of enabled)
  -- FIXED: Changed "enabled = true" to check is_disabled correctly
  SELECT EXISTS(
    SELECT 1 FROM holidays 
    WHERE date = check_date 
    AND NOT is_override_allowed
    AND (is_disabled IS FALSE OR is_disabled IS NULL)
  ) INTO is_holiday;
  
  -- Slot is valid if it's an operating day, valid time, and not a holiday
  RETURN is_operating_day AND is_valid_time AND NOT is_holiday;
END;
$function$;

-- 2. Fix generate_open_days_and_slots function
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
    -- FIXED: Changed "enabled = true" to check is_disabled correctly
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

-- 3. No need to update refresh_future_schedule directly since it just calls is_slot_valid_in_schedule
-- The function will work correctly once is_slot_valid_in_schedule is fixed

-- Add comments to document the fixes
COMMENT ON FUNCTION public.is_slot_valid_in_schedule IS 'Checks if a given date and time is valid in the schedule configuration. Updated to use is_disabled instead of enabled.';
COMMENT ON FUNCTION public.generate_open_days_and_slots IS 'Generates open days and time slots based on schedule settings. Updated to use is_disabled instead of enabled.';

-- Refresh the schedule to apply the fixed functions
SELECT refresh_future_schedule();