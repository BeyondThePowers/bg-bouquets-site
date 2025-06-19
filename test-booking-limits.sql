-- Test script to verify dual booking limits work correctly
-- Run this after implementing the booking limits

-- 1. Check current time slot configuration
SELECT 
  date, 
  time, 
  max_capacity, 
  max_bookings,
  'Current Config' as status
FROM time_slots 
WHERE date >= CURRENT_DATE
ORDER BY date, time 
LIMIT 10;

-- 2. Check current booking status using the new view
SELECT * FROM time_slot_status 
WHERE date >= CURRENT_DATE 
ORDER BY date, time 
LIMIT 10;

-- 3. Test scenario: Add bookings to test limits
-- First, let's find a future time slot to test with
SELECT date, time, max_capacity, max_bookings
FROM time_slots 
WHERE date > CURRENT_DATE 
ORDER BY date, time 
LIMIT 1;

-- 4. Insert test bookings to verify limits
-- (Replace the date/time with actual values from step 3)
-- Test booking 1: 2 visitors
INSERT INTO bookings (full_name, email, phone, date, time, number_of_visitors, total_amount)
VALUES ('Test User 1', 'test1@example.com', '555-0001', 
        (SELECT date FROM time_slots WHERE date > CURRENT_DATE ORDER BY date, time LIMIT 1),
        (SELECT time FROM time_slots WHERE date > CURRENT_DATE ORDER BY date, time LIMIT 1),
        2, 70.00);

-- Test booking 2: 3 visitors  
INSERT INTO bookings (full_name, email, phone, date, time, number_of_visitors, total_amount)
VALUES ('Test User 2', 'test2@example.com', '555-0002',
        (SELECT date FROM time_slots WHERE date > CURRENT_DATE ORDER BY date, time LIMIT 1),
        (SELECT time FROM time_slots WHERE date > CURRENT_DATE ORDER BY date, time LIMIT 1),
        3, 105.00);

-- Test booking 3: 1 visitor (this should reach the booking limit of 3)
INSERT INTO bookings (full_name, email, phone, date, time, number_of_visitors, total_amount)
VALUES ('Test User 3', 'test3@example.com', '555-0003',
        (SELECT date FROM time_slots WHERE date > CURRENT_DATE ORDER BY date, time LIMIT 1),
        (SELECT time FROM time_slots WHERE date > CURRENT_DATE ORDER BY date, time LIMIT 1),
        1, 35.00);

-- 5. Check the status after adding test bookings
SELECT 
  ts.date,
  ts.time,
  ts.max_capacity,
  ts.max_bookings,
  COUNT(b.id) as current_bookings,
  COALESCE(SUM(b.number_of_visitors), 0) as current_visitors,
  CASE 
    WHEN COUNT(b.id) >= ts.max_bookings THEN 'BOOKING_LIMIT_REACHED'
    WHEN COALESCE(SUM(b.number_of_visitors), 0) >= ts.max_capacity THEN 'VISITOR_LIMIT_REACHED'
    ELSE 'AVAILABLE'
  END as status
FROM time_slots ts
LEFT JOIN bookings b ON ts.date = b.date AND ts.time = b.time
WHERE ts.date > CURRENT_DATE
  AND b.email LIKE 'test%@example.com'
GROUP BY ts.date, ts.time, ts.max_capacity, ts.max_bookings
ORDER BY ts.date, ts.time;

-- 6. Test what happens when we try to add a 4th booking (should fail)
-- This would be blocked by the API, but let's see the current state

-- 7. Clean up test data
DELETE FROM bookings WHERE email LIKE 'test%@example.com';

-- 8. Verify cleanup
SELECT COUNT(*) as remaining_test_bookings 
FROM bookings 
WHERE email LIKE 'test%@example.com';

-- 9. Final verification - check that the slot is available again
SELECT * FROM time_slot_status 
WHERE date > CURRENT_DATE 
ORDER BY date, time 
LIMIT 5;
