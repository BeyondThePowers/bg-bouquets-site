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

-- Sample data for testing
-- Insert some open days (next 30 days)
INSERT INTO open_days (date, is_open)
SELECT 
  (CURRENT_DATE + INTERVAL '1 day' * generate_series(0, 29))::DATE as date,
  CASE 
    WHEN EXTRACT(DOW FROM (CURRENT_DATE + INTERVAL '1 day' * generate_series(0, 29))) IN (0, 6) THEN false -- Closed on weekends
    ELSE true
  END as is_open
ON CONFLICT (date) DO NOTHING;

-- Insert time slots for open days
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
ON CONFLICT (date, time) DO NOTHING;

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

-- Grant necessary permissions
GRANT SELECT ON booking_summary TO anon, authenticated;
