-- Functional Testing SQL for Schedule Locking System
-- Run this AFTER applying the migration to test functionality

\echo '=== SCHEDULE LOCKING FUNCTIONALITY TESTS ==='
\echo ''

-- 1. Test is_booking_allowed() function in default state
\echo '1. TESTING is_booking_allowed() FUNCTION - DEFAULT STATE:'
SELECT is_booking_allowed() as booking_allowed_default;

\echo ''

-- 2. Test setting lock state
\echo '2. TESTING LOCK STATE ACTIVATION:'
UPDATE schedule_settings 
SET schedule_update_in_progress = TRUE 
WHERE setting_key = 'max_bouquets_per_slot';

SELECT is_booking_allowed() as booking_allowed_when_locked;

\echo ''

-- 3. Test clearing lock state
\echo '3. TESTING LOCK STATE DEACTIVATION:'
UPDATE schedule_settings 
SET schedule_update_in_progress = FALSE 
WHERE setting_key = 'max_bouquets_per_slot';

SELECT is_booking_allowed() as booking_allowed_after_unlock;

\echo ''

-- 4. Test scheduled update logic
\echo '4. TESTING SCHEDULED UPDATE LOGIC:'
-- Set a scheduled update for 2 minutes from now
UPDATE schedule_settings 
SET 
    schedule_update_scheduled_at = NOW() + INTERVAL '2 minutes',
    schedule_update_scheduled_by = 'test_user'
WHERE setting_key = 'max_bouquets_per_slot';

SELECT 
    is_booking_allowed() as booking_allowed_with_future_update,
    schedule_update_scheduled_at,
    schedule_update_scheduled_at - NOW() as time_until_update
FROM schedule_settings 
WHERE setting_key = 'max_bouquets_per_slot';

\echo ''

-- 5. Test imminent scheduled update (within 5 minutes)
\echo '5. TESTING IMMINENT SCHEDULED UPDATE (should block booking):'
UPDATE schedule_settings 
SET schedule_update_scheduled_at = NOW() + INTERVAL '3 minutes'
WHERE setting_key = 'max_bouquets_per_slot';

SELECT 
    is_booking_allowed() as booking_allowed_imminent_update,
    schedule_update_scheduled_at,
    schedule_update_scheduled_at - NOW() as time_until_update
FROM schedule_settings 
WHERE setting_key = 'max_bouquets_per_slot';

\echo ''

-- 6. Test distant scheduled update (should allow booking)
\echo '6. TESTING DISTANT SCHEDULED UPDATE (should allow booking):'
UPDATE schedule_settings 
SET schedule_update_scheduled_at = NOW() + INTERVAL '10 minutes'
WHERE setting_key = 'max_bouquets_per_slot';

SELECT 
    is_booking_allowed() as booking_allowed_distant_update,
    schedule_update_scheduled_at,
    schedule_update_scheduled_at - NOW() as time_until_update
FROM schedule_settings 
WHERE setting_key = 'max_bouquets_per_slot';

\echo ''

-- 7. Test schedule_update_logs table functionality
\echo '7. TESTING SCHEDULE_UPDATE_LOGS TABLE:'
INSERT INTO schedule_update_logs (
    updated_by,
    update_type,
    update_data,
    status
) VALUES (
    'test_user',
    'test',
    '{"test": "data"}',
    'completed'
);

SELECT 
    id,
    updated_at,
    updated_by,
    update_type,
    update_data,
    status
FROM schedule_update_logs 
WHERE update_type = 'test'
ORDER BY updated_at DESC 
LIMIT 1;

\echo ''

-- 8. Test auto_timeout_schedule_updates function
\echo '8. TESTING AUTO-TIMEOUT FUNCTIONALITY:'
-- First, simulate an old locked state
UPDATE schedule_settings 
SET 
    schedule_update_in_progress = TRUE,
    schedule_update_json = jsonb_build_object(
        'lock_timestamp', (NOW() - INTERVAL '35 minutes')::text,
        'test', 'old_lock'
    )
WHERE setting_key = 'max_bouquets_per_slot';

-- Check state before timeout
SELECT 
    schedule_update_in_progress as locked_before_timeout,
    schedule_update_json ->> 'lock_timestamp' as lock_timestamp
FROM schedule_settings 
WHERE setting_key = 'max_bouquets_per_slot';

-- Run auto-timeout function
SELECT auto_timeout_schedule_updates();

-- Check state after timeout
SELECT 
    schedule_update_in_progress as locked_after_timeout,
    schedule_update_json
FROM schedule_settings 
WHERE setting_key = 'max_bouquets_per_slot';

\echo ''

-- 9. Verify index was created
\echo '9. VERIFYING INDEX CREATION:'
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE indexname = 'idx_schedule_update_scheduled_at';

\echo ''

-- 10. Test data integrity - ensure existing data wasn't affected
\echo '10. TESTING DATA INTEGRITY:'
SELECT 
    setting_key,
    setting_value,
    created_at IS NOT NULL as has_created_at,
    updated_at IS NOT NULL as has_updated_at,
    -- New columns should have default values
    schedule_update_in_progress,
    schedule_update_scheduled_at IS NULL as scheduled_at_is_null,
    schedule_update_scheduled_by IS NULL as scheduled_by_is_null,
    schedule_update_json IS NULL as json_is_null
FROM schedule_settings 
ORDER BY setting_key;

\echo ''

-- 11. Clean up test data
\echo '11. CLEANING UP TEST DATA:'
UPDATE schedule_settings 
SET 
    schedule_update_in_progress = FALSE,
    schedule_update_scheduled_at = NULL,
    schedule_update_scheduled_by = NULL,
    schedule_update_json = NULL
WHERE setting_key = 'max_bouquets_per_slot';

DELETE FROM schedule_update_logs WHERE update_type = 'test';

-- Final verification
SELECT 
    is_booking_allowed() as final_booking_allowed,
    COUNT(*) as total_settings
FROM schedule_settings;

\echo ''
\echo '=== FUNCTIONALITY TESTS COMPLETE ==='
\echo ''
\echo 'EXPECTED RESULTS:'
\echo '- is_booking_allowed() should return TRUE in default state'
\echo '- Should return FALSE when schedule_update_in_progress = TRUE'
\echo '- Should return FALSE when scheduled update is within 5 minutes'
\echo '- Should return TRUE when scheduled update is > 5 minutes away'
\echo '- Auto-timeout should clear locks older than 30 minutes'
\echo '- All existing schedule_settings data should be preserved'
\echo '- New columns should have appropriate default values'
