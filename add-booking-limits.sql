-- Add booking limits to time_slots table
-- Run this in your Supabase SQL Editor

-- 1. Add max_bookings column to time_slots table
ALTER TABLE time_slots 
ADD COLUMN IF NOT EXISTS max_bookings INTEGER NOT NULL DEFAULT 3;

-- 2. Update existing time slots with the new limit
UPDATE time_slots 
SET max_bookings = 3 
WHERE max_bookings IS NULL OR max_bookings = 0;

-- 3. Verify the changes
SELECT 
  date, 
  time, 
  max_capacity, 
  max_bookings,
  'Updated' as status
FROM time_slots 
ORDER BY date, time 
LIMIT 10;

-- 4. Optional: Set different limits for different time slots if needed
-- Example: Lunch slots (1:00 PM) might have fewer bookings allowed
-- UPDATE time_slots 
-- SET max_bookings = 2 
-- WHERE time = '1:00 PM';

-- 5. Create a view to easily see booking status
CREATE OR REPLACE VIEW time_slot_status AS
SELECT 
  ts.id,
  ts.date,
  ts.time,
  ts.max_capacity,
  ts.max_bookings,
  COUNT(b.id) as current_bookings,
  COALESCE(SUM(b.number_of_visitors), 0) as current_visitors,
  (ts.max_bookings - COUNT(b.id)) as bookings_remaining,
  (ts.max_capacity - COALESCE(SUM(b.number_of_visitors), 0)) as visitor_spots_remaining,
  CASE 
    WHEN COUNT(b.id) >= ts.max_bookings THEN 'BOOKING_LIMIT_REACHED'
    WHEN COALESCE(SUM(b.number_of_visitors), 0) >= ts.max_capacity THEN 'VISITOR_LIMIT_REACHED'
    ELSE 'AVAILABLE'
  END as availability_status
FROM time_slots ts
LEFT JOIN bookings b ON ts.date = b.date AND ts.time = b.time
GROUP BY ts.id, ts.date, ts.time, ts.max_capacity, ts.max_bookings
ORDER BY ts.date, ts.time;

-- Grant access to the view
GRANT SELECT ON time_slot_status TO anon, authenticated;

-- 6. Test the view
SELECT * FROM time_slot_status 
WHERE date >= CURRENT_DATE 
LIMIT 10;
