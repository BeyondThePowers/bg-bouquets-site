-- Debug the reschedule booking issue
-- Run this in your Supabase SQL Editor to understand what's happening

-- 1. Check if time_slots table exists and has data
SELECT 'Checking time_slots table:' as info;
SELECT COUNT(*) as total_slots, 
       MIN(date) as earliest_date, 
       MAX(date) as latest_date
FROM time_slots;

-- 2. Check sample time_slots data for tomorrow
SELECT 'Sample time_slots for tomorrow:' as info;
SELECT date, time, max_capacity, max_bookings
FROM time_slots 
WHERE date = CURRENT_DATE + INTERVAL '1 day'
ORDER BY time
LIMIT 10;

-- 3. Check current bookings for tomorrow
SELECT 'Current bookings for tomorrow:' as info;
SELECT date, time, COUNT(*) as booking_count, SUM(number_of_bouquets) as total_bouquets
FROM bookings 
WHERE date = CURRENT_DATE + INTERVAL '1 day'
AND status = 'confirmed'
GROUP BY date, time
ORDER BY time;

-- 4. Check if there are any confirmed bookings at all
SELECT 'Total confirmed bookings:' as info;
SELECT COUNT(*) as total_bookings,
       MIN(date) as earliest_booking,
       MAX(date) as latest_booking
FROM bookings 
WHERE status = 'confirmed';

-- 5. Check the structure of both tables
SELECT 'Bookings table columns:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bookings' 
AND column_name IN ('number_of_bouquets', 'number_of_visitors', 'status')
ORDER BY column_name;

SELECT 'Time_slots table columns:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'time_slots' 
AND column_name IN ('max_capacity', 'max_bookings', 'max_visitors_per_slot')
ORDER BY column_name;

-- 6. Test the reschedule function with detailed output
SELECT 'Testing reschedule with a real future date:' as info;
SELECT * FROM reschedule_booking(
    '00000000-0000-0000-0000-000000000000'::UUID,
    (CURRENT_DATE + INTERVAL '2 days')::DATE,
    '10:00 AM'::VARCHAR,
    'Debug test'::VARCHAR,
    '127.0.0.1'::VARCHAR
);
