-- Update Database Views and Functions for Bouquet Terminology
-- Run this after the main column migration to update views and functions
-- Run this in your Supabase SQL Editor

BEGIN;

-- 1. Update the admin_booking_view to use new column names
CREATE OR REPLACE VIEW admin_booking_view AS
SELECT
    b.*,
    -- Status should only be 'active' or 'cancelled', refunds are separate
    CASE
        WHEN b.status = 'cancelled' THEN 'cancelled'
        ELSE 'active'
    END as booking_status,
    -- Payment information for admin display
    CASE
        WHEN b.payment_method = 'pay_on_arrival' AND b.payment_status = 'pending' THEN 'Pay on Arrival'
        WHEN b.payment_method = 'pay_online' AND b.payment_status = 'completed' THEN 'Paid Online'
        WHEN b.payment_method = 'pay_online' AND b.payment_status = 'pending' THEN 'Payment Pending'
        ELSE b.payment_status
    END as payment_display,
    -- Refund information (separate from status)
    CASE
        WHEN b.admin_refund_amount IS NOT NULL THEN true
        ELSE false
    END as has_refund,
    -- Count of actions for this booking
    (SELECT COUNT(*) FROM booking_actions ba WHERE ba.booking_id = b.id) as action_count
FROM bookings b;

-- 2. Update the time_slot_status view to use new column names
CREATE OR REPLACE VIEW time_slot_status AS
SELECT 
  ts.id,
  ts.date,
  ts.time,
  ts.max_bouquets,
  ts.max_bookings,
  COUNT(b.id) as current_bookings,
  COALESCE(SUM(b.number_of_bouquets), 0) as current_bouquets,
  (ts.max_bookings - COUNT(b.id)) as bookings_remaining,
  (ts.max_bouquets - COALESCE(SUM(b.number_of_bouquets), 0)) as bouquet_spots_remaining,
  CASE 
    WHEN COUNT(b.id) >= ts.max_bookings THEN 'BOOKING_LIMIT_REACHED'
    WHEN COALESCE(SUM(b.number_of_bouquets), 0) >= ts.max_bouquets THEN 'BOUQUET_LIMIT_REACHED'
    ELSE 'AVAILABLE'
  END as availability_status
FROM time_slots ts
LEFT JOIN bookings b ON ts.date = b.date AND ts.time = b.time AND b.status = 'confirmed'
GROUP BY ts.id, ts.date, ts.time, ts.max_bouquets, ts.max_bookings
ORDER BY ts.date, ts.time;

-- 3. Update the booking_summary view to use new column names
CREATE OR REPLACE VIEW booking_summary AS
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
  (
    SELECT COALESCE(SUM(number_of_bouquets), 0) 
    FROM bookings b2 
    WHERE b2.date = b.date AND b2.time = b.time AND b2.status = 'confirmed'
  ) as total_bouquets_for_slot
FROM bookings b
JOIN time_slots ts ON b.date = ts.date AND b.time = ts.time
ORDER BY b.date, b.time, b.created_at;

-- 4. Update the generate_open_days_and_slots function to use new terminology
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
  -- Get current settings (using new terminology)
  SELECT setting_value INTO operating_days FROM schedule_settings WHERE setting_key = 'operating_days';
  SELECT setting_value INTO time_slots FROM schedule_settings WHERE setting_key = 'time_slots';
  SELECT (setting_value #>> '{}')::INTEGER INTO max_capacity FROM schedule_settings WHERE setting_key = 'max_bouquets_per_slot';
  SELECT (setting_value #>> '{}')::INTEGER INTO max_bookings FROM schedule_settings WHERE setting_key = 'max_bookings_per_slot';
  SELECT (setting_value #>> '{}')::INTEGER INTO season_start_month FROM schedule_settings WHERE setting_key = 'season_start_month';
  SELECT (setting_value #>> '{}')::INTEGER INTO season_start_day FROM schedule_settings WHERE setting_key = 'season_start_day';
  SELECT (setting_value #>> '{}')::INTEGER INTO season_end_month FROM schedule_settings WHERE setting_key = 'season_end_month';
  SELECT (setting_value #>> '{}')::INTEGER INTO season_end_day FROM schedule_settings WHERE setting_key = 'season_end_day';

  -- Generate days
  FOR i IN 0..days_ahead LOOP
    current_date_iter := CURRENT_DATE + i;
    day_name := LOWER(TO_CHAR(current_date_iter, 'Day'));
    day_name := TRIM(day_name);

    -- Check if this date is a holiday
    SELECT EXISTS(
      SELECT 1 FROM holidays 
      WHERE date = current_date_iter 
      AND enabled = true
    ) INTO is_holiday;
    
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
      
      -- Insert time slots for this open day (using new column name)
      FOR j IN 0..jsonb_array_length(time_slots) - 1 LOOP
        time_slot := time_slots ->> j;
        INSERT INTO time_slots (date, time, max_bouquets, max_bookings)
        VALUES (current_date_iter, time_slot, max_capacity, max_bookings)
        ON CONFLICT (date, time) DO UPDATE SET 
          max_bouquets = EXCLUDED.max_bouquets,
          max_bookings = EXCLUDED.max_bookings;
      END LOOP;
    ELSE
      -- Mark as closed if it's a holiday, not an operating day, or out of season
      INSERT INTO open_days (date, is_open)
      VALUES (current_date_iter, false)
      ON CONFLICT (date) DO UPDATE SET is_open = false;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. Update the extend_booking_range_if_needed function to use new terminology
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
  -- Get current settings (using new terminology)
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
  
  -- Only extend if we're below the threshold
  IF days_remaining < min_days_threshold THEN
    RAISE NOTICE 'Extending booking range by % days', target_days;
    
    -- Generate new days starting from the day after max_future_date
    FOR i IN 1..target_days LOOP
      current_date_iter := max_future_date + i;
      day_name := LOWER(TO_CHAR(current_date_iter, 'Day'));
      day_name := TRIM(day_name);

      -- Check if this date is a holiday
      SELECT EXISTS(
        SELECT 1 FROM holidays 
        WHERE date = current_date_iter 
        AND enabled = true
      ) INTO is_holiday;
      
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
        
        -- Insert time slots for this open day (using new column name)
        FOR j IN 0..jsonb_array_length(time_slots) - 1 LOOP
          time_slot := time_slots ->> j;
          INSERT INTO time_slots (date, time, max_bouquets, max_bookings)
          VALUES (current_date_iter, time_slot, max_capacity, max_bookings)
          ON CONFLICT (date, time) DO UPDATE SET 
            max_bouquets = EXCLUDED.max_bouquets,
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
    
    result := json_build_object(
      'extended', true,
      'days_generated', generated_days,
      'slots_generated', generated_slots,
      'new_max_date', max_future_date + target_days,
      'days_remaining_after', (max_future_date + target_days) - CURRENT_DATE
    );
  ELSE
    result := json_build_object(
      'extended', false,
      'days_remaining', days_remaining,
      'threshold', min_days_threshold,
      'message', 'No extension needed'
    );
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 6. Verify the updates
SELECT 'Views and functions updated successfully for bouquet terminology' as status;

-- Show updated views exist
SELECT schemaname, viewname 
FROM pg_views 
WHERE viewname IN ('admin_booking_view', 'time_slot_status', 'booking_summary')
ORDER BY viewname;

-- Show updated functions exist
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname IN ('generate_open_days_and_slots', 'extend_booking_range_if_needed')
ORDER BY proname;

COMMIT;
