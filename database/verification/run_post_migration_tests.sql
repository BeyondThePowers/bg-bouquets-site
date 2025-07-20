-- Post-Migration Verification Script
-- Run this AFTER applying the schedule locking migration

\echo '======================================================='
\echo 'POST-MIGRATION VERIFICATION TESTS'
\echo '======================================================='
\echo ''

\echo 'STEP 2: FUNCTIONALITY TESTING'
\echo 'Testing all new functions and features...'
\echo ''

\i database/verification/test_schedule_locking_functionality.sql

\echo ''
\echo '======================================================='
\echo ''

\echo 'STEP 3: INTEGRATION TESTING'
\echo 'Verifying integration with existing booking system...'
\echo ''

\i database/verification/verify_booking_integration.sql

\echo ''
\echo '======================================================='
\echo 'VERIFICATION SUMMARY'
\echo '======================================================='
\echo ''

-- Final comprehensive check
SELECT 
    'MIGRATION STATUS' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'schedule_settings' 
            AND column_name = 'schedule_update_in_progress'
        ) THEN 'COLUMNS ADDED ✓'
        ELSE 'COLUMNS MISSING ✗'
    END as columns_status,
    
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'schedule_update_logs'
        ) THEN 'AUDIT TABLE CREATED ✓'
        ELSE 'AUDIT TABLE MISSING ✗'
    END as audit_table_status,
    
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'is_booking_allowed'
        ) THEN 'FUNCTIONS CREATED ✓'
        ELSE 'FUNCTIONS MISSING ✗'
    END as functions_status,
    
    CASE 
        WHEN is_booking_allowed() = TRUE THEN 'BOOKING SYSTEM FUNCTIONAL ✓'
        ELSE 'BOOKING SYSTEM ISSUES ✗'
    END as booking_system_status;

\echo ''
\echo 'If all statuses show ✓, the migration was successful!'
\echo 'If any show ✗, review the detailed output above for issues.'
\echo ''
\echo '======================================================='
