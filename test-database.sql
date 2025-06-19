-- Test queries to verify database setup
-- Run these after the database-fix.sql to verify everything works

-- 1. Check table structure
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns 
WHERE table_name IN ('open_days', 'time_slots', 'bookings')
ORDER BY table_name, ordinal_position;

-- 2. Check sample data counts
SELECT 'open_days' as table_name, COUNT(*) as row_count FROM open_days
UNION ALL
SELECT 'time_slots' as table_name, COUNT(*) as row_count FROM time_slots
UNION ALL
SELECT 'bookings' as table_name, COUNT(*) as row_count FROM bookings;

-- 3. Check open days data
SELECT date, is_open 
FROM open_days 
ORDER BY date 
LIMIT 10;

-- 4. Check time slots data
SELECT date, time, max_capacity 
FROM time_slots 
ORDER BY date, time 
LIMIT 10;

-- 5. Test availability query (similar to what the API does)
SELECT 
  od.date,
  ts.time,
  ts.max_capacity,
  COALESCE(SUM(b.number_of_visitors), 0) as booked_visitors,
  (ts.max_capacity - COALESCE(SUM(b.number_of_visitors), 0)) as available_spots
FROM open_days od
JOIN time_slots ts ON od.date = ts.date
LEFT JOIN bookings b ON ts.date = b.date AND ts.time = b.time
WHERE od.is_open = true
  AND od.date >= CURRENT_DATE
GROUP BY od.date, ts.time, ts.max_capacity
ORDER BY od.date, ts.time
LIMIT 20;

-- 6. Test booking insertion (simulate what the API does)
-- This should work without errors
INSERT INTO bookings (full_name, email, phone, date, time, number_of_visitors, total_amount)
VALUES ('Test User', 'test@example.com', '555-1234', CURRENT_DATE + 1, '10:00 AM', 2, 70.00)
ON CONFLICT DO NOTHING;

-- 7. Verify the test booking was inserted
SELECT * FROM bookings WHERE email = 'test@example.com';

-- 8. Clean up test data
DELETE FROM bookings WHERE email = 'test@example.com';
