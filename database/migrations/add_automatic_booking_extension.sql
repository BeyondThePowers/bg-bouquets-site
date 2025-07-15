-- Add automatic booking range extension functionality
-- Run this in your Supabase SQL Editor

-- 1. Create function to check and extend booking range automatically
CREATE OR REPLACE FUNCTION extend_booking_range_if_needed()
RETURNS JSON AS $$
DECLARE
  max_future_date DATE;
  days_remaining INTEGER;
  target_days INTEGER := 400;
  min_days_threshold INTEGER := 365;
  
  -- Settings variables
  operating_days JSONB;
  time_slots JSONB;
  max_capacity INTEGER;
  max_bookings INTEGER;
  season_start_month INTEGER;
  season_start_day INTEGER;
  season_end_month INTEGER;
  season_end_day INTEGER;
  
  -- Generation variables
  current_date_iter DATE;
  day_name TEXT;
  time_slot TEXT;
  is_holiday BOOLEAN;
  within_season BOOLEAN;
  generated_days INTEGER := 0;
  generated_slots INTEGER := 0;
  
  result JSON;
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

  -- Find the furthest future date we have
  SELECT MAX(date) INTO max_future_date FROM open_days;
  
  -- Calculate days remaining from today
  days_remaining := max_future_date - CURRENT_DATE;
  
  -- Log the check
  RAISE NOTICE 'Booking range check: max_future_date=%, days_remaining=%, threshold=%', 
    max_future_date, days_remaining, min_days_threshold;
  
  -- If we have enough days remaining, no extension needed
  IF days_remaining >= min_days_threshold THEN
    result := json_build_object(
      'extended', false,
      'reason', 'sufficient_range',
      'days_remaining', days_remaining,
      'max_future_date', max_future_date,
      'threshold', min_days_threshold
    );
    RETURN result;
  END IF;
  
  -- Extension needed - generate additional days
  RAISE NOTICE 'Extending booking range from % days to % days', days_remaining, target_days;
  
  -- Generate dates from current max date + 1 to target_days from today
  FOR i IN 1..(target_days - days_remaining) LOOP
    current_date_iter := max_future_date + i;
    
    -- Get day name (lowercase)
    day_name := LOWER(TO_CHAR(current_date_iter, 'Day'));
    day_name := TRIM(day_name);
    
    -- Check if this date is a holiday
    SELECT EXISTS(SELECT 1 FROM holidays WHERE date = current_date_iter AND NOT is_override_allowed) INTO is_holiday;
    
    -- Check if within season
    within_season := (
      (EXTRACT(MONTH FROM current_date_iter) > season_start_month OR 
       (EXTRACT(MONTH FROM current_date_iter) = season_start_month AND EXTRACT(DAY FROM current_date_iter) >= season_start_day))
      AND
      (EXTRACT(MONTH FROM current_date_iter) < season_end_month OR 
       (EXTRACT(MONTH FROM current_date_iter) = season_end_month AND EXTRACT(DAY FROM current_date_iter) <= season_end_day))
    );
    
    -- Check if this day is an operating day, within season, and not a holiday
    IF operating_days ? day_name AND within_season AND NOT is_holiday THEN
      -- Insert open day
      INSERT INTO open_days (date, is_open)
      VALUES (current_date_iter, true)
      ON CONFLICT (date) DO UPDATE SET is_open = true;
      
      generated_days := generated_days + 1;
      
      -- Insert time slots for this open day
      FOR j IN 0..jsonb_array_length(time_slots) - 1 LOOP
        time_slot := time_slots ->> j;
        INSERT INTO time_slots (date, time, max_capacity, max_bookings)
        VALUES (current_date_iter, time_slot, max_capacity, max_bookings)
        ON CONFLICT (date, time) DO UPDATE SET 
          max_capacity = EXCLUDED.max_capacity,
          max_bookings = EXCLUDED.max_bookings;
        
        generated_slots := generated_slots + 1;
      END LOOP;
    ELSE
      -- Mark as closed if it's a holiday, not an operating day, or out of season
      INSERT INTO open_days (date, is_open)
      VALUES (current_date_iter, false)
      ON CONFLICT (date) DO UPDATE SET is_open = false;
    END IF;
  END LOOP;
  
  -- Return result
  result := json_build_object(
    'extended', true,
    'reason', 'range_extended',
    'previous_days_remaining', days_remaining,
    'new_max_date', max_future_date + (target_days - days_remaining),
    'generated_days', generated_days,
    'generated_slots', generated_slots,
    'target_days', target_days
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 2. Create a function to get booking range status (for monitoring)
CREATE OR REPLACE FUNCTION get_booking_range_status()
RETURNS JSON AS $$
DECLARE
  max_future_date DATE;
  min_future_date DATE;
  days_remaining INTEGER;
  total_open_days INTEGER;
  total_time_slots INTEGER;
  result JSON;
BEGIN
  -- Get date range
  SELECT MIN(date), MAX(date) INTO min_future_date, max_future_date FROM open_days WHERE date >= CURRENT_DATE;
  
  -- Calculate days remaining
  days_remaining := max_future_date - CURRENT_DATE;
  
  -- Count open days and time slots
  SELECT COUNT(*) INTO total_open_days FROM open_days WHERE date >= CURRENT_DATE AND is_open = true;
  SELECT COUNT(*) INTO total_time_slots FROM time_slots WHERE date >= CURRENT_DATE;
  
  result := json_build_object(
    'current_date', CURRENT_DATE,
    'min_future_date', min_future_date,
    'max_future_date', max_future_date,
    'days_remaining', days_remaining,
    'total_open_days', total_open_days,
    'total_time_slots', total_time_slots,
    'needs_extension', days_remaining < 365
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 3. Test the functions
SELECT extend_booking_range_if_needed();
SELECT get_booking_range_status();
