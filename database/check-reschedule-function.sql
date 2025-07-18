-- Check if reschedule_booking function exists and get its exact signature
-- Run this in your Supabase SQL Editor

-- 1. Check if any reschedule_booking function exists
SELECT 
    'Functions with reschedule in name:' as info,
    proname as function_name,
    pg_get_function_identity_arguments(oid) as arguments,
    prosrc IS NOT NULL as has_source
FROM pg_proc 
WHERE proname LIKE '%reschedule%'
ORDER BY proname;

-- 2. Check all functions in the database
SELECT 
    'All custom functions in database:' as info,
    proname as function_name,
    pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND proname NOT LIKE 'pg_%'
ORDER BY proname;

-- 3. Check if the function exists with correct signature
SELECT 
    'Checking exact reschedule_booking signature:' as info,
    proname,
    pg_get_function_identity_arguments(oid) as signature,
    prorettype::regtype as return_type
FROM pg_proc 
WHERE proname = 'reschedule_booking';

-- 4. Test with correct data types (if function exists)
SELECT 'Testing with correct data types:' as info;
SELECT * FROM reschedule_booking(
    '00000000-0000-0000-0000-000000000000'::UUID,
    '2025-07-20'::DATE,
    '10:00 AM'::VARCHAR,
    'Test'::VARCHAR,
    '127.0.0.1'::VARCHAR
);
