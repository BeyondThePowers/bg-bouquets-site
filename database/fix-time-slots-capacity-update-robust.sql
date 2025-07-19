-- Enhanced fix for time_slots capacity values not updating when saving schedule settings
-- This version adds more robust parsing and debugging to identify the root cause

-- 1. Add diagnostic function to see what values are being used in the refresh process
CREATE OR REPLACE FUNCTION debug_settings_values()
RETURNS TABLE (
  setting_key TEXT,
  setting_value TEXT,
  parsed_value TEXT,
  value_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.setting_key,
    s.setting_value::TEXT,
    CASE 
      WHEN s.setting_value::TEXT ~ '^[\d\.]+$' THEN s.setting_value::TEXT
      WHEN s.setting_value::TEXT ~ '^"[\d\.]+"$' THEN trim(both '"' from s.setting_value::TEXT)
      ELSE s.setting_value::TEXT
    END as parsed_value,
    pg_typeof(s.setting_value)::TEXT as value_type
  FROM 
    schedule_settings s
  WHERE 
    s.setting_key IN ('max_bouquets_per_slot', 'max_bookings_per_slot');
END;
$$ LANGUAGE plpgsql;

-- 2. Update the generate_open_days_and_slots function with improved parsing and debugging
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
  capacity_setting TEXT;
  bookings_setting TEXT;
BEGIN
  -- Get current settings with improved parsing
  SELECT setting_value INTO operating_days FROM schedule_settings WHERE setting_key = 'operating_days';
  SELECT setting_value INTO time_slots FROM schedule_settings WHERE setting_key = 'time_slots';
  
  -- Get max_bouquets with robust parsing
  SELECT setting_value::TEXT INTO capacity_setting FROM schedule_settings WHERE setting_key = 'max_bouquets_per_slot';
  -- Remove quotes if present
  IF capacity_setting LIKE '"%"' THEN
    capacity_setting := trim(both '"' from capacity_setting);
  END IF;
  -- Convert to integer with error handling
  BEGIN
    max_capacity := capacity_setting::INTEGER;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error parsing max_bouquets_per_slot: %', capacity_setting;
    max_capacity := 10; -- Default if parsing fails
  END;
  
  -- Get max_bookings with robust parsing
  SELECT setting_value::TEXT INTO bookings_setting FROM schedule_settings WHERE setting_key = 'max_bookings_per_slot';
  -- Remove quotes if present
  IF bookings_setting LIKE '"%"' THEN
    bookings_setting := trim(both '"' from bookings_setting);
  END IF;
  -- Convert to integer with error handling
  BEGIN
    max_bookings := bookings_setting::INTEGER;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error parsing max_bookings_per_slot: %', bookings_setting;
    max_bookings := 3; -- Default if parsing fails
  END;
  
  -- Log what values we're using for debugging
  RAISE NOTICE 'Using max_capacity: %, max_bookings: %', max_capacity, max_bookings;
  
  -- Get season settings
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
        
        -- Insert with explicit values for clarity and debugging
        INSERT INTO time_slots (date, time, max_bouquets, max_bookings, is_legacy)
        VALUES (
          current_date_iter, 
          time_slot, 
          max_capacity, 
          max_bookings, 
          false
        )
        ON CONFLICT (date, time) DO UPDATE SET
          -- Only update non-legacy slots
          max_bouquets = CASE 
            WHEN time_slots.is_legacy THEN time_slots.max_bouquets 
            ELSE max_capacity
          END,
          max_bookings = CASE 
            WHEN time_slots.is_legacy THEN time_slots.max_bookings 
            ELSE max_bookings
          END;
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

-- 3. Update the refresh_future_schedule function with improved parsing
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
  capacity_setting TEXT;
  bookings_setting TEXT;
BEGIN
  -- Get current schedule settings with improved parsing
  SELECT setting_value INTO operating_days FROM schedule_settings WHERE setting_key = 'operating_days';
  SELECT setting_value INTO time_slots_config FROM schedule_settings WHERE setting_key = 'time_slots';
  
  -- Get max_bouquets with robust parsing
  SELECT setting_value::TEXT INTO capacity_setting FROM schedule_settings WHERE setting_key = 'max_bouquets_per_slot';
  -- Remove quotes if present
  IF capacity_setting LIKE '"%"' THEN
    capacity_setting := trim(both '"' from capacity_setting);
  END IF;
  -- Convert to integer with error handling
  BEGIN
    new_max_capacity := capacity_setting::INTEGER;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error parsing max_bouquets_per_slot: %', capacity_setting;
    new_max_capacity := 10; -- Default if parsing fails
  END;
  
  -- Get max_bookings with robust parsing
  SELECT setting_value::TEXT INTO bookings_setting FROM schedule_settings WHERE setting_key = 'max_bookings_per_slot';
  -- Remove quotes if present
  IF bookings_setting LIKE '"%"' THEN
    bookings_setting := trim(both '"' from bookings_setting);
  END IF;
  -- Convert to integer with error handling
  BEGIN
    new_max_bookings := bookings_setting::INTEGER;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error parsing max_bookings_per_slot: %', bookings_setting;
    new_max_bookings := 3; -- Default if parsing fails
  END;
  
  -- Log what values we're using for debugging
  RAISE NOTICE 'Using new_max_capacity: %, new_max_bookings: %', new_max_capacity, new_max_bookings;

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
        -- But only if it's not a legacy slot
        IF NOT slot_record.is_legacy THEN
          UPDATE time_slots 
          SET max_bouquets = new_max_capacity,
              max_bookings = new_max_bookings,
              is_legacy = FALSE
          WHERE id = slot_record.id;
        END IF;
      ELSE
        -- Slot no longer in schedule but has bookings - mark as legacy
        -- Legacy slots keep their original capacities
        UPDATE time_slots 
        SET is_legacy = TRUE
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
  
  -- Just to be extra safe, make one more update to ensure non-legacy slots have correct values
  UPDATE time_slots
  SET max_bouquets = new_max_capacity,
      max_bookings = new_max_bookings
  WHERE 
    date > CURRENT_DATE
    AND is_legacy = FALSE;
END;
$function$;

-- 4. Run diagnostics to see what's in the settings table
SELECT * FROM debug_settings_values();

-- 5. Execute a direct update on non-legacy slots to force the correct values
UPDATE time_slots
SET 
  max_bouquets = (
    SELECT 
      CASE 
        WHEN setting_value::TEXT ~ '^[\d\.]+$' THEN setting_value::INTEGER
        WHEN setting_value::TEXT ~ '^"[\d\.]+"$' THEN trim(both '"' from setting_value::TEXT)::INTEGER
        ELSE 10 -- Default if parsing fails
      END
    FROM schedule_settings 
    WHERE setting_key = 'max_bouquets_per_slot'
  ),
  max_bookings = (
    SELECT 
      CASE 
        WHEN setting_value::TEXT ~ '^[\d\.]+$' THEN setting_value::INTEGER
        WHEN setting_value::TEXT ~ '^"[\d\.]+"$' THEN trim(both '"' from setting_value::TEXT)::INTEGER
        ELSE 3 -- Default if parsing fails
      END
    FROM schedule_settings 
    WHERE setting_key = 'max_bookings_per_slot'
  )
WHERE 
  date > CURRENT_DATE
  AND is_legacy = FALSE;

-- 6. Run a schedule refresh to apply all changes
SELECT refresh_future_schedule();

-- 7. View some time slots to verify the update
SELECT 
  id, 
  date, 
  time, 
  max_bouquets, 
  max_bookings, 
  is_legacy
FROM 
  time_slots
WHERE 
  date > CURRENT_DATE
ORDER BY 
  date, time
LIMIT 10;