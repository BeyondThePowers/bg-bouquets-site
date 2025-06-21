-- Supabase Database Setup for Bouquet Garden Booking System
-- Run these commands in your Supabase SQL Editor

-- Create open_days table
CREATE TABLE IF NOT EXISTS open_days (
  date DATE PRIMARY KEY,
  is_open BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create time_slots table
CREATE TABLE IF NOT EXISTS time_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  max_capacity INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(date, time)
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  number_of_visitors INTEGER NOT NULL DEFAULT 1,
  total_amount DECIMAL(10,2),
  payment_method TEXT DEFAULT 'pay_on_arrival' CHECK (payment_method IN ('pay_now', 'pay_on_arrival')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_open_days_date ON open_days(date);
CREATE INDEX IF NOT EXISTS idx_time_slots_date ON time_slots(date);
CREATE INDEX IF NOT EXISTS idx_bookings_date_time ON bookings(date, time);
CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(email);

-- Add Row Level Security (RLS) policies
ALTER TABLE open_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Allow public read access to open_days and time_slots
CREATE POLICY "Allow public read access to open_days" ON open_days
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to time_slots" ON time_slots
  FOR SELECT USING (true);

-- Allow public read access to bookings for availability checking (limited fields)
CREATE POLICY "Allow public read access to bookings for availability" ON bookings
  FOR SELECT USING (true);

-- Allow public insert access to bookings
CREATE POLICY "Allow public insert access to bookings" ON bookings
  FOR INSERT WITH CHECK (true);

-- Function to generate open days based on current schedule settings
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
  SELECT (setting_value #>> '{}')::INTEGER INTO max_capacity FROM schedule_settings WHERE setting_key = 'max_visitors_per_slot';

  -- Generate dates for the specified number of days ahead
  FOR i IN 0..days_ahead LOOP
    current_date_iter := CURRENT_DATE + INTERVAL '1 day' * i;

    -- Get day name (lowercase)
    day_name := LOWER(TO_CHAR(current_date_iter, 'Day'));
    day_name := TRIM(day_name);

    -- Check if this date is a holiday
    SELECT EXISTS(SELECT 1 FROM holidays WHERE date = current_date_iter AND NOT is_override_allowed) INTO is_holiday;

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

-- Sample data for testing - generate open days and slots using new schedule
SELECT generate_open_days_and_slots(60);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for bookings table
CREATE TRIGGER update_bookings_updated_at 
  BEFORE UPDATE ON bookings 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Optional: Create a view for easier booking management
CREATE OR REPLACE VIEW booking_summary AS
SELECT 
  b.id,
  b.full_name,
  b.email,
  b.phone,
  b.date,
  b.time,
  b.number_of_visitors,
  b.total_amount,
  b.created_at,
  ts.max_capacity,
  (
    SELECT COALESCE(SUM(number_of_visitors), 0) 
    FROM bookings b2 
    WHERE b2.date = b.date AND b2.time = b.time
  ) as total_visitors_for_slot
FROM bookings b
JOIN time_slots ts ON b.date = ts.date AND b.time = ts.time
ORDER BY b.date, b.time, b.created_at;

-- Function to refresh schedule when settings change (only affects future dates)
CREATE OR REPLACE FUNCTION refresh_future_schedule()
RETURNS VOID AS $$
BEGIN
  -- Remove future time slots that are no longer valid
  DELETE FROM time_slots WHERE date > CURRENT_DATE;

  -- Remove future open days that are no longer valid
  DELETE FROM open_days WHERE date > CURRENT_DATE;

  -- Regenerate future schedule
  PERFORM generate_open_days_and_slots(60);
END;
$$ LANGUAGE plpgsql;

-- Trigger to refresh schedule when settings change
CREATE OR REPLACE FUNCTION trigger_refresh_schedule()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.setting_key IN ('operating_days', 'time_slots', 'max_visitors_per_slot') THEN
    PERFORM refresh_future_schedule();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_schedule_on_settings_change
  AFTER UPDATE ON schedule_settings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_schedule();

-- Grant necessary permissions
GRANT SELECT ON booking_summary TO anon, authenticated;
GRANT SELECT ON holidays TO anon, authenticated;
GRANT SELECT ON schedule_settings TO anon, authenticated;

-- Create holidays table for managing closure dates
CREATE TABLE IF NOT EXISTS holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_recurring BOOLEAN DEFAULT FALSE,
  is_auto_generated BOOLEAN DEFAULT FALSE,
  is_override_allowed BOOLEAN DEFAULT FALSE, -- Allow business on this holiday if manually set
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create settings table for configurable schedule
CREATE TABLE IF NOT EXISTS schedule_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for holidays and settings
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_holidays_recurring ON holidays(is_recurring);
CREATE INDEX IF NOT EXISTS idx_schedule_settings_key ON schedule_settings(setting_key);

-- Add RLS policies for new tables
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access to holidays and settings
CREATE POLICY "Allow public read access to holidays" ON holidays
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to schedule_settings" ON schedule_settings
  FOR SELECT USING (true);

-- Insert default schedule settings
INSERT INTO schedule_settings (setting_key, setting_value, description) VALUES
('operating_days', '["thursday", "friday", "saturday"]', 'Days of the week when business is open'),
('time_slots', '["10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "6:00 PM", "7:00 PM", "8:00 PM"]', 'Available booking time slots'),
('max_bookings_per_slot', '3', 'Maximum number of bookings allowed per time slot'),
('max_visitors_per_slot', '10', 'Maximum number of visitors allowed per time slot'),
('admin_password', '"admin123"', 'Simple password for admin access (change this!)')
ON CONFLICT (setting_key) DO NOTHING;

-- Function to generate North American holidays automatically
CREATE OR REPLACE FUNCTION generate_north_american_holidays(start_year INTEGER, end_year INTEGER)
RETURNS VOID AS $$
DECLARE
  year_iter INTEGER;
  holiday_date DATE;
BEGIN
  FOR year_iter IN start_year..end_year LOOP
    -- New Year's Day
    holiday_date := (year_iter || '-01-01')::DATE;
    INSERT INTO holidays (date, name, is_recurring, is_auto_generated)
    VALUES (holiday_date, 'New Year''s Day', true, true)
    ON CONFLICT (date) DO NOTHING;

    -- Martin Luther King Jr. Day (3rd Monday in January)
    holiday_date := (year_iter || '-01-01')::DATE + INTERVAL '2 weeks' +
                   (1 - EXTRACT(DOW FROM (year_iter || '-01-01')::DATE))::INTEGER * INTERVAL '1 day';
    INSERT INTO holidays (date, name, is_recurring, is_auto_generated)
    VALUES (holiday_date, 'Martin Luther King Jr. Day', true, true)
    ON CONFLICT (date) DO NOTHING;

    -- Presidents' Day (3rd Monday in February)
    holiday_date := (year_iter || '-02-01')::DATE + INTERVAL '2 weeks' +
                   (1 - EXTRACT(DOW FROM (year_iter || '-02-01')::DATE))::INTEGER * INTERVAL '1 day';
    INSERT INTO holidays (date, name, is_recurring, is_auto_generated)
    VALUES (holiday_date, 'Presidents'' Day', true, true)
    ON CONFLICT (date) DO NOTHING;

    -- Memorial Day (last Monday in May)
    holiday_date := (year_iter || '-06-01')::DATE - INTERVAL '1 day' -
                   (EXTRACT(DOW FROM (year_iter || '-06-01')::DATE - INTERVAL '1 day') - 1)::INTEGER * INTERVAL '1 day';
    INSERT INTO holidays (date, name, is_recurring, is_auto_generated)
    VALUES (holiday_date, 'Memorial Day', true, true)
    ON CONFLICT (date) DO NOTHING;

    -- Independence Day
    holiday_date := (year_iter || '-07-04')::DATE;
    INSERT INTO holidays (date, name, is_recurring, is_auto_generated)
    VALUES (holiday_date, 'Independence Day', true, true)
    ON CONFLICT (date) DO NOTHING;

    -- Labor Day (1st Monday in September)
    holiday_date := (year_iter || '-09-01')::DATE +
                   (1 - EXTRACT(DOW FROM (year_iter || '-09-01')::DATE))::INTEGER * INTERVAL '1 day';
    INSERT INTO holidays (date, name, is_recurring, is_auto_generated)
    VALUES (holiday_date, 'Labor Day', true, true)
    ON CONFLICT (date) DO NOTHING;

    -- Thanksgiving (4th Thursday in November)
    holiday_date := (year_iter || '-11-01')::DATE +
                   (4 - EXTRACT(DOW FROM (year_iter || '-11-01')::DATE))::INTEGER * INTERVAL '1 day' +
                   INTERVAL '3 weeks';
    INSERT INTO holidays (date, name, is_recurring, is_auto_generated)
    VALUES (holiday_date, 'Thanksgiving Day', true, true)
    ON CONFLICT (date) DO NOTHING;

    -- Christmas Day
    holiday_date := (year_iter || '-12-25')::DATE;
    INSERT INTO holidays (date, name, is_recurring, is_auto_generated)
    VALUES (holiday_date, 'Christmas Day', true, true)
    ON CONFLICT (date) DO NOTHING;

    -- Canadian Holidays
    -- Canada Day
    holiday_date := (year_iter || '-07-01')::DATE;
    INSERT INTO holidays (date, name, is_recurring, is_auto_generated)
    VALUES (holiday_date, 'Canada Day', true, true)
    ON CONFLICT (date) DO NOTHING;

    -- Canadian Thanksgiving (2nd Monday in October)
    holiday_date := (year_iter || '-10-01')::DATE + INTERVAL '1 week' +
                   (1 - EXTRACT(DOW FROM (year_iter || '-10-01')::DATE))::INTEGER * INTERVAL '1 day';
    INSERT INTO holidays (date, name, is_recurring, is_auto_generated)
    VALUES (holiday_date, 'Canadian Thanksgiving', true, true)
    ON CONFLICT (date) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Generate holidays for the next 3 years
SELECT generate_north_american_holidays(EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER + 3);

-- Migration: Add payment fields to existing bookings table (safe to run multiple times)
DO $$
BEGIN
  -- Add payment_method column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'payment_method') THEN
    ALTER TABLE bookings ADD COLUMN payment_method TEXT DEFAULT 'pay_on_arrival' CHECK (payment_method IN ('pay_now', 'pay_on_arrival'));
  END IF;

  -- Add payment_status column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'payment_status') THEN
    ALTER TABLE bookings ADD COLUMN payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed'));
  END IF;
END $$;
