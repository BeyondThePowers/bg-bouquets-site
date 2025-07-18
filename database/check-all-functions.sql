-- Check if both cancel_booking and reschedule_booking functions exist
-- Run this in your Supabase SQL Editor

-- 1. Check all booking-related functions
SELECT 
    'All booking-related functions:' as info,
    proname as function_name,
    pg_get_function_identity_arguments(oid) as arguments,
    prorettype::regtype as return_type
FROM pg_proc 
WHERE proname IN ('cancel_booking', 'reschedule_booking')
ORDER BY proname;

-- 2. Test cancel_booking function
SELECT 'Testing cancel_booking function:' as info;
SELECT * FROM cancel_booking(
    '00000000-0000-0000-0000-000000000000'::UUID,
    'Test cancellation'::VARCHAR,
    '127.0.0.1'::VARCHAR,
    NULL::VARCHAR
);

-- 3. Test reschedule_booking function  
SELECT 'Testing reschedule_booking function:' as info;
SELECT * FROM reschedule_booking(
    '00000000-0000-0000-0000-000000000000'::UUID,
    (CURRENT_DATE + INTERVAL '1 day')::DATE,
    '10:00 AM'::VARCHAR,
    'Test reschedule'::VARCHAR,
    '127.0.0.1'::VARCHAR
);
