-- Fix for functions still referencing the old 'enabled' column instead of 'is_disabled'
-- This migration updates functions to use the correct column name after the add_holiday_disable_support migration

-- Update is_slot_valid_in_schedule function to use is_disabled instead of enabled
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
  -- Note the logic change: NOT is_disabled instead of enabled = true
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

-- Also update any other functions that might reference 'enabled'
-- For example, check if there are any other functions in migrations that need updating

-- Refresh the schedule to apply the fixed functions
SELECT refresh_future_schedule();

-- Add a comment to document the fix
COMMENT ON FUNCTION public.is_slot_valid_in_schedule IS 'Checks if a given date and time is valid in the schedule configuration. Updated to use is_disabled instead of enabled.';