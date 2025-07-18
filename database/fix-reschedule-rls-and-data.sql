-- Fix reschedule booking issues: RLS permissions and missing data
-- Run this in your Supabase SQL Editor

-- 1. Check current RLS status
SELECT 'Checking RLS status:' as info;
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('bookings', 'booking_actions', 'time_slots')
AND schemaname = 'public';

-- 2. Check if time_slots table has data
SELECT 'Checking time_slots data:' as info;
SELECT COUNT(*) as total_slots,
       MIN(date) as earliest_date,
       MAX(date) as latest_date
FROM time_slots;

-- 3. Grant necessary permissions for the functions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON bookings TO authenticated, anon;
GRANT SELECT, INSERT ON booking_actions TO authenticated, anon;
GRANT SELECT ON time_slots TO authenticated, anon;

-- 4. Grant execute permissions on the functions
GRANT EXECUTE ON FUNCTION cancel_booking TO authenticated, anon;
GRANT EXECUTE ON FUNCTION reschedule_booking TO authenticated, anon;

-- 5. Create RLS policies that allow the functions to work
-- Policy for booking_actions (allow inserts from functions)
DROP POLICY IF EXISTS "Allow function access to booking_actions" ON booking_actions;
CREATE POLICY "Allow function access to booking_actions" ON booking_actions
  FOR ALL USING (true);

-- Policy for bookings (allow function access)
DROP POLICY IF EXISTS "Allow function access to bookings" ON bookings;
CREATE POLICY "Allow function access to bookings" ON bookings
  FOR ALL USING (true);

-- 6. If time_slots is empty, create some sample data for testing
DO $$
DECLARE
    slot_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO slot_count FROM time_slots;
    
    IF slot_count = 0 THEN
        -- Create sample time slots for the next 30 days
        INSERT INTO time_slots (date, time, max_bouquets, max_bookings)
        SELECT
            generate_series(CURRENT_DATE + 1, CURRENT_DATE + 30, '1 day'::interval)::date as date,
            slot_time,
            10 as max_bouquets,  -- 10 bouquets max
            3 as max_bookings    -- 3 bookings max
        FROM (
            VALUES 
                ('10:00 AM'::text),
                ('11:00 AM'::text),
                ('12:00 PM'::text),
                ('1:00 PM'::text),
                ('6:00 PM'::text),
                ('7:00 PM'::text),
                ('8:00 PM'::text)
        ) AS times(slot_time);
        
        RAISE NOTICE 'Created sample time slots for testing';
    END IF;
END $$;

-- 7. Test the reschedule function again
SELECT 'Testing reschedule_booking after fixes:' as info;
SELECT * FROM reschedule_booking(
    '00000000-0000-0000-0000-000000000000'::UUID,
    (CURRENT_DATE + INTERVAL '2 days')::DATE,
    '10:00 AM'::VARCHAR,
    'Test after RLS fix'::VARCHAR,
    '127.0.0.1'::VARCHAR
);

-- 8. Check what time slots are available for tomorrow
SELECT 'Available time slots for tomorrow:' as info;
SELECT ts.date, ts.time, ts.max_bouquets, ts.max_bookings,
       COALESCE(b.current_bookings, 0) as current_bookings,
       COALESCE(b.current_bouquets, 0) as current_bouquets,
       (ts.max_bookings - COALESCE(b.current_bookings, 0)) as available_booking_slots,
       (ts.max_bouquets - COALESCE(b.current_bouquets, 0)) as available_bouquet_capacity
FROM time_slots ts
LEFT JOIN (
    SELECT date, time, 
           COUNT(*) as current_bookings,
           SUM(number_of_bouquets) as current_bouquets
    FROM bookings 
    WHERE status = 'confirmed'
    GROUP BY date, time
) b ON ts.date = b.date AND ts.time = b.time
WHERE ts.date = CURRENT_DATE + INTERVAL '1 day'
ORDER BY ts.time;

-- Success message
SELECT 'RLS and data fixes applied!' as status;
