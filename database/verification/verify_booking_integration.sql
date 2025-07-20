-- Integration Testing SQL for Schedule Locking with Booking System
-- Run this AFTER applying the migration to verify integration

\echo '=== BOOKING SYSTEM INTEGRATION VERIFICATION ==='
\echo ''

-- 1. Verify the migration didn't break existing booking queries
\echo '1. TESTING EXISTING BOOKING SYSTEM COMPATIBILITY:'

-- Test that existing availability queries still work
\echo 'Testing availability query compatibility...'
SELECT 
    setting_key,
    setting_value::INTEGER as value,
    -- These new columns should exist and have defaults
    schedule_update_in_progress,
    schedule_update_scheduled_at
FROM schedule_settings 
WHERE setting_key IN ('max_bouquets_per_slot', 'max_bookings_per_slot')
ORDER BY setting_key;

\echo ''

-- 2. Test the booking API integration points
\echo '2. TESTING BOOKING API INTEGRATION POINTS:'

-- Simulate the query pattern used in the booking API
\echo 'Testing booking API lock status check pattern...'
SELECT 
    schedule_update_in_progress,
    schedule_update_scheduled_at,
    CASE 
        WHEN schedule_update_in_progress = TRUE THEN 'BLOCKED: Update in progress'
        WHEN schedule_update_scheduled_at IS NOT NULL AND 
             schedule_update_scheduled_at < (NOW() + INTERVAL '5 minutes') THEN 'BLOCKED: Update imminent'
        ELSE 'ALLOWED'
    END as booking_status
FROM schedule_settings
WHERE setting_key = 'max_bouquets_per_slot'
LIMIT 1;

\echo ''

-- 3. Test availability API integration
\echo '3. TESTING AVAILABILITY API INTEGRATION:'

-- Simulate the availability API lock check
\echo 'Testing availability API lock status check...'
WITH lock_status AS (
    SELECT 
        schedule_update_in_progress,
        schedule_update_scheduled_at
    FROM schedule_settings
    WHERE setting_key = 'max_bouquets_per_slot'
    LIMIT 1
)
SELECT 
    CASE 
        WHEN schedule_update_in_progress = TRUE THEN 'schedule_update_in_progress'
        WHEN schedule_update_scheduled_at IS NOT NULL AND 
             schedule_update_scheduled_at < (NOW() + INTERVAL '5 minutes') THEN 'schedule_update_imminent'
        ELSE 'available'
    END as api_response_type,
    schedule_update_in_progress,
    schedule_update_scheduled_at
FROM lock_status;

\echo ''

-- 4. Test that existing views and functions still work
\echo '4. TESTING EXISTING DATABASE FUNCTIONS:'

-- Check if any existing functions are affected
\echo 'Checking existing database functions...'
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_name NOT IN ('is_booking_allowed', 'process_scheduled_updates', 'auto_timeout_schedule_updates')
ORDER BY routine_name;

\echo ''

-- 5. Test booking table compatibility
\echo '5. TESTING BOOKING TABLE COMPATIBILITY:'

-- Verify bookings table structure is unchanged
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'bookings'
ORDER BY ordinal_position;

\echo ''

-- 6. Test schedule_slots table compatibility  
\echo '6. TESTING SCHEDULE_SLOTS TABLE COMPATIBILITY:'

-- Verify schedule_slots table structure is unchanged
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'schedule_slots'
ORDER BY ordinal_position;

\echo ''

-- 7. Test realistic booking scenario with lock
\echo '7. TESTING REALISTIC BOOKING SCENARIO:'

-- Simulate a booking attempt during lock state
\echo 'Step 1: Normal state - booking should be allowed'
SELECT is_booking_allowed() as step1_booking_allowed;

\echo 'Step 2: Lock bookings - should block'
UPDATE schedule_settings 
SET schedule_update_in_progress = TRUE 
WHERE setting_key = 'max_bouquets_per_slot';

SELECT is_booking_allowed() as step2_booking_blocked;

\echo 'Step 3: Unlock bookings - should allow again'
UPDATE schedule_settings 
SET schedule_update_in_progress = FALSE 
WHERE setting_key = 'max_bouquets_per_slot';

SELECT is_booking_allowed() as step3_booking_allowed;

\echo ''

-- 8. Test edge cases
\echo '8. TESTING EDGE CASES:'

-- Test with missing setting_key (should default to allow)
\echo 'Testing with non-existent setting key...'
WITH temp_check AS (
    SELECT 
        schedule_update_in_progress,
        schedule_update_scheduled_at
    FROM schedule_settings
    WHERE setting_key = 'non_existent_key'
    LIMIT 1
)
SELECT 
    CASE 
        WHEN schedule_update_in_progress IS NULL THEN 'Should allow booking (no config found)'
        ELSE 'Config found'
    END as edge_case_result
FROM temp_check
UNION ALL
SELECT 'No rows found - should allow booking' WHERE NOT EXISTS (SELECT 1 FROM temp_check);

\echo ''

-- 9. Test concurrent access patterns
\echo '9. TESTING CONCURRENT ACCESS PATTERNS:'

-- Test multiple rapid queries (simulating concurrent API calls)
\echo 'Testing rapid consecutive lock status checks...'
SELECT is_booking_allowed() as check1;
SELECT is_booking_allowed() as check2;
SELECT is_booking_allowed() as check3;

\echo ''

-- 10. Verify no data corruption occurred
\echo '10. VERIFYING DATA INTEGRITY:'

-- Check that all existing settings are still intact
SELECT 
    COUNT(*) as total_settings,
    COUNT(CASE WHEN setting_value IS NOT NULL THEN 1 END) as settings_with_values,
    COUNT(CASE WHEN created_at IS NOT NULL THEN 1 END) as settings_with_created_at,
    COUNT(CASE WHEN updated_at IS NOT NULL THEN 1 END) as settings_with_updated_at
FROM schedule_settings;

-- Check specific critical settings
SELECT 
    setting_key,
    setting_value,
    CASE 
        WHEN setting_key = 'max_bouquets_per_slot' AND setting_value::INTEGER > 0 THEN 'OK'
        WHEN setting_key = 'max_bookings_per_slot' AND setting_value::INTEGER > 0 THEN 'OK'
        ELSE 'CHECK REQUIRED'
    END as status
FROM schedule_settings 
WHERE setting_key IN ('max_bouquets_per_slot', 'max_bookings_per_slot')
ORDER BY setting_key;

\echo ''

-- 11. Final cleanup and summary
\echo '11. FINAL CLEANUP AND SUMMARY:'

-- Reset to clean state
UPDATE schedule_settings 
SET 
    schedule_update_in_progress = FALSE,
    schedule_update_scheduled_at = NULL,
    schedule_update_scheduled_by = NULL,
    schedule_update_json = NULL
WHERE setting_key = 'max_bouquets_per_slot';

-- Final status check
SELECT 
    'Migration Integration Test' as test_type,
    is_booking_allowed() as booking_system_functional,
    (SELECT COUNT(*) FROM schedule_settings) as total_settings_preserved,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'schedule_update_logs') as audit_table_created,
    (SELECT COUNT(*) FROM information_schema.routines WHERE routine_name IN ('is_booking_allowed', 'process_scheduled_updates', 'auto_timeout_schedule_updates')) as functions_created;

\echo ''
\echo '=== INTEGRATION VERIFICATION COMPLETE ==='
\echo ''
\echo 'INTEGRATION SUCCESS CRITERIA:'
\echo '- All existing booking queries should work unchanged'
\echo '- is_booking_allowed() function should be callable'
\echo '- Lock status checks should return expected values'
\echo '- No existing data should be corrupted'
\echo '- Booking and schedule_slots tables should be unchanged'
\echo '- All critical settings should retain their values'
\echo '- System should handle edge cases gracefully'
