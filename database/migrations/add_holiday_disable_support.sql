-- Add support for disabling automatic holidays instead of deleting them
-- This migration adds the is_disabled column and updates the schedule generation logic

-- 1. Add is_disabled column to holidays table
ALTER TABLE holidays 
ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT FALSE;

-- 2. Add comment explaining the new column
COMMENT ON COLUMN holidays.is_disabled IS 'When true, automatic holidays are disabled but can be re-enabled. Manual holidays should be deleted instead.';

-- 3. Update the generate_open_days_and_slots function to respect disabled holidays
CREATE OR REPLACE FUNCTION generate_open_days_and_slots(days_ahead INTEGER DEFAULT 60)
RETURNS VOID AS $$
DECLARE
  operating_days JSONB;
  time_slots JSONB;
  max_capacity INTEGER;
  current_date_iter DATE;
  day_name TEXT;
  time_slot TEXT;
  is_holiday BOOLEAN;
BEGIN
  -- Get current settings
  SELECT setting_value INTO operating_days FROM schedule_settings WHERE setting_key = 'operating_days';
  SELECT setting_value INTO time_slots FROM schedule_settings WHERE setting_key = 'time_slots';
  SELECT (setting_value #>> '{}')::INTEGER INTO max_capacity FROM schedule_settings WHERE setting_key = 'max_bouquets_per_slot';

  -- Generate dates for the specified number of days ahead
  FOR i IN 0..days_ahead LOOP
    current_date_iter := CURRENT_DATE + INTERVAL '1 day' * i;

    -- Get day name (lowercase)
    day_name := LOWER(TO_CHAR(current_date_iter, 'Day'));
    day_name := TRIM(day_name);

    -- Check if this date is a holiday (excluding disabled holidays)
    SELECT EXISTS(
      SELECT 1 FROM holidays 
      WHERE date = current_date_iter 
      AND NOT is_override_allowed 
      AND (is_disabled IS FALSE OR is_disabled IS NULL)
    ) INTO is_holiday;

    -- Insert open day if it matches operating days and is not a holiday
    IF operating_days ? day_name AND NOT is_holiday THEN
      INSERT INTO open_days (date, is_open)
      VALUES (current_date_iter, true)
      ON CONFLICT (date) DO UPDATE SET is_open = true;

      -- Insert time slots for this open day
      FOR j IN 0..jsonb_array_length(time_slots) - 1 LOOP
        time_slot := time_slots ->> j;
        INSERT INTO time_slots (date, time, max_capacity)
        VALUES (current_date_iter, time_slot, max_capacity)
        ON CONFLICT (date, time) DO UPDATE SET max_capacity = EXCLUDED.max_capacity;
      END LOOP;
    ELSE
      -- Mark as closed if it's a holiday or not an operating day
      INSERT INTO open_days (date, is_open)
      VALUES (current_date_iter, false)
      ON CONFLICT (date) DO UPDATE SET is_open = false;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4. Update the generate_north_american_holidays function to handle disabled holidays
CREATE OR REPLACE FUNCTION generate_north_american_holidays(start_year INTEGER, end_year INTEGER)
RETURNS VOID AS $$
DECLARE
  year_iter INTEGER;
  holiday_date DATE;
BEGIN
  FOR year_iter IN start_year..end_year LOOP
    -- New Year's Day
    holiday_date := (year_iter || '-01-01')::DATE;
    INSERT INTO holidays (date, name, is_recurring, is_auto_generated, is_disabled)
    VALUES (holiday_date, 'New Year''s Day', true, true, false)
    ON CONFLICT (date) DO UPDATE SET 
      name = EXCLUDED.name,
      is_recurring = EXCLUDED.is_recurring,
      is_auto_generated = EXCLUDED.is_auto_generated
      -- Don't update is_disabled - preserve user's choice
    ;

    -- Family Day (3rd Monday in February) - Alberta specific
    holiday_date := (year_iter || '-02-01')::DATE + INTERVAL '2 weeks' +
                   (1 - EXTRACT(DOW FROM (year_iter || '-02-01')::DATE))::INTEGER * INTERVAL '1 day';
    INSERT INTO holidays (date, name, is_recurring, is_auto_generated, is_disabled)
    VALUES (holiday_date, 'Family Day', true, true, false)
    ON CONFLICT (date) DO UPDATE SET 
      name = EXCLUDED.name,
      is_recurring = EXCLUDED.is_recurring,
      is_auto_generated = EXCLUDED.is_auto_generated;

    -- Good Friday (Friday before Easter)
    -- Simplified calculation - you may want to use a more accurate Easter calculation
    holiday_date := (year_iter || '-04-10')::DATE; -- Approximate
    INSERT INTO holidays (date, name, is_recurring, is_auto_generated, is_disabled)
    VALUES (holiday_date, 'Good Friday', true, true, false)
    ON CONFLICT (date) DO UPDATE SET 
      name = EXCLUDED.name,
      is_recurring = EXCLUDED.is_recurring,
      is_auto_generated = EXCLUDED.is_auto_generated;

    -- Victoria Day (Monday before May 25)
    holiday_date := (year_iter || '-05-25')::DATE - 
                   (EXTRACT(DOW FROM (year_iter || '-05-25')::DATE) - 1)::INTEGER * INTERVAL '1 day';
    INSERT INTO holidays (date, name, is_recurring, is_auto_generated, is_disabled)
    VALUES (holiday_date, 'Victoria Day', true, true, false)
    ON CONFLICT (date) DO UPDATE SET 
      name = EXCLUDED.name,
      is_recurring = EXCLUDED.is_recurring,
      is_auto_generated = EXCLUDED.is_auto_generated;

    -- Canada Day
    holiday_date := (year_iter || '-07-01')::DATE;
    INSERT INTO holidays (date, name, is_recurring, is_auto_generated, is_disabled)
    VALUES (holiday_date, 'Canada Day', true, true, false)
    ON CONFLICT (date) DO UPDATE SET 
      name = EXCLUDED.name,
      is_recurring = EXCLUDED.is_recurring,
      is_auto_generated = EXCLUDED.is_auto_generated;

    -- Heritage Day (1st Monday in August) - Alberta specific
    holiday_date := (year_iter || '-08-01')::DATE +
                   (1 - EXTRACT(DOW FROM (year_iter || '-08-01')::DATE))::INTEGER * INTERVAL '1 day';
    INSERT INTO holidays (date, name, is_recurring, is_auto_generated, is_disabled)
    VALUES (holiday_date, 'Heritage Day', true, true, false)
    ON CONFLICT (date) DO UPDATE SET 
      name = EXCLUDED.name,
      is_recurring = EXCLUDED.is_recurring,
      is_auto_generated = EXCLUDED.is_auto_generated;

    -- Labour Day (1st Monday in September)
    holiday_date := (year_iter || '-09-01')::DATE +
                   (1 - EXTRACT(DOW FROM (year_iter || '-09-01')::DATE))::INTEGER * INTERVAL '1 day';
    INSERT INTO holidays (date, name, is_recurring, is_auto_generated, is_disabled)
    VALUES (holiday_date, 'Labour Day', true, true, false)
    ON CONFLICT (date) DO UPDATE SET 
      name = EXCLUDED.name,
      is_recurring = EXCLUDED.is_recurring,
      is_auto_generated = EXCLUDED.is_auto_generated;

    -- Thanksgiving (2nd Monday in October) - Canadian
    holiday_date := (year_iter || '-10-01')::DATE + INTERVAL '1 week' +
                   (1 - EXTRACT(DOW FROM (year_iter || '-10-01')::DATE))::INTEGER * INTERVAL '1 day';
    INSERT INTO holidays (date, name, is_recurring, is_auto_generated, is_disabled)
    VALUES (holiday_date, 'Thanksgiving', true, true, false)
    ON CONFLICT (date) DO UPDATE SET 
      name = EXCLUDED.name,
      is_recurring = EXCLUDED.is_recurring,
      is_auto_generated = EXCLUDED.is_auto_generated;

    -- Remembrance Day
    holiday_date := (year_iter || '-11-11')::DATE;
    INSERT INTO holidays (date, name, is_recurring, is_auto_generated, is_disabled)
    VALUES (holiday_date, 'Remembrance Day', true, true, false)
    ON CONFLICT (date) DO UPDATE SET 
      name = EXCLUDED.name,
      is_recurring = EXCLUDED.is_recurring,
      is_auto_generated = EXCLUDED.is_auto_generated;

    -- Christmas Day
    holiday_date := (year_iter || '-12-25')::DATE;
    INSERT INTO holidays (date, name, is_recurring, is_auto_generated, is_disabled)
    VALUES (holiday_date, 'Christmas Day', true, true, false)
    ON CONFLICT (date) DO UPDATE SET 
      name = EXCLUDED.name,
      is_recurring = EXCLUDED.is_recurring,
      is_auto_generated = EXCLUDED.is_auto_generated;

    -- Boxing Day
    holiday_date := (year_iter || '-12-26')::DATE;
    INSERT INTO holidays (date, name, is_recurring, is_auto_generated, is_disabled)
    VALUES (holiday_date, 'Boxing Day', true, true, false)
    ON CONFLICT (date) DO UPDATE SET 
      name = EXCLUDED.name,
      is_recurring = EXCLUDED.is_recurring,
      is_auto_generated = EXCLUDED.is_auto_generated;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. Refresh the schedule to apply the new logic
SELECT refresh_future_schedule();

-- 6. Add index for better performance on disabled holidays
CREATE INDEX IF NOT EXISTS idx_holidays_disabled ON holidays(is_disabled) WHERE is_disabled = true;

-- 7. Update any existing holidays to have is_disabled = false by default
UPDATE holidays SET is_disabled = false WHERE is_disabled IS NULL;
