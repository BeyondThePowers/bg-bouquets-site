-- Fix existing Supabase database to work with booking system
-- Run these commands in your Supabase SQL Editor

-- 1. Add missing columns to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS number_of_bouquets INTEGER NOT NULL DEFAULT 1;

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2);

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Change time columns from TIME to TEXT to handle "9:00 AM" format
-- First, let's see what data exists and back it up
CREATE TABLE IF NOT EXISTS time_slots_backup AS SELECT * FROM time_slots;
CREATE TABLE IF NOT EXISTS bookings_backup AS SELECT * FROM bookings;

-- Drop existing time slots and recreate with TEXT time column
DROP TABLE IF EXISTS time_slots CASCADE;
CREATE TABLE time_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE,
  time TEXT NOT NULL,
  max_capacity INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recreate bookings table with TEXT time column (preserve existing data structure)
-- First backup any existing bookings
-- Then alter the time column
ALTER TABLE bookings ALTER COLUMN time TYPE TEXT;

-- 3. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_open_days_date ON open_days(date);
CREATE INDEX IF NOT EXISTS idx_time_slots_date ON time_slots(date);
CREATE INDEX IF NOT EXISTS idx_bookings_date_time ON bookings(date, time);
CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(email);

-- 4. Add Row Level Security (RLS) policies if not already set
ALTER TABLE open_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to open_days" ON open_days;
DROP POLICY IF EXISTS "Allow public read access to time_slots" ON time_slots;
DROP POLICY IF EXISTS "Allow public read access to bookings for availability" ON bookings;
DROP POLICY IF EXISTS "Allow public insert access to bookings" ON bookings;

-- Create new policies
CREATE POLICY "Allow public read access to open_days" ON open_days
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to time_slots" ON time_slots
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to bookings for availability" ON bookings
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to bookings" ON bookings
  FOR INSERT WITH CHECK (true);

-- 5. Insert sample data for testing

-- Clear existing data first
DELETE FROM time_slots;
DELETE FROM open_days;

-- Insert open days (next 30 days, weekdays only)
INSERT INTO open_days (date, is_open)
SELECT 
  (CURRENT_DATE + INTERVAL '1 day' * generate_series(1, 30))::DATE as date,
  CASE 
    WHEN EXTRACT(DOW FROM (CURRENT_DATE + INTERVAL '1 day' * generate_series(1, 30))) IN (0, 6) THEN false -- Closed on weekends
    ELSE true
  END as is_open
ON CONFLICT (date) DO UPDATE SET is_open = EXCLUDED.is_open;

-- Insert time slots for open days with TEXT format times
INSERT INTO time_slots (date, time, max_capacity)
SELECT 
  od.date,
  time_slot,
  10 as max_capacity
FROM open_days od
CROSS JOIN (
  VALUES 
    ('9:00 AM'),
    ('10:00 AM'),
    ('11:00 AM'),
    ('1:00 PM'),
    ('2:00 PM'),
    ('3:00 PM'),
    ('4:00 PM')
) AS times(time_slot)
WHERE od.is_open = true
ON CONFLICT DO NOTHING;

-- 6. Create trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;

-- Create new trigger
CREATE TRIGGER update_bookings_updated_at 
  BEFORE UPDATE ON bookings 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 7. Verify the setup
-- Check that we have the right columns
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns 
WHERE table_name IN ('open_days', 'time_slots', 'bookings')
ORDER BY table_name, ordinal_position;

-- Check sample data
SELECT 'open_days' as table_name, COUNT(*) as row_count FROM open_days
UNION ALL
SELECT 'time_slots' as table_name, COUNT(*) as row_count FROM time_slots
UNION ALL
SELECT 'bookings' as table_name, COUNT(*) as row_count FROM bookings;
