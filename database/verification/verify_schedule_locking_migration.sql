-- Verification SQL for Schedule Locking Migration
-- Run this BEFORE applying the migration to verify current state
-- and AFTER to confirm changes were applied correctly

\echo '=== SCHEDULE LOCKING MIGRATION VERIFICATION ==='
\echo ''

-- 1. Check current schedule_settings table structure
\echo '1. CURRENT SCHEDULE_SETTINGS TABLE STRUCTURE:'
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'schedule_settings' 
ORDER BY ordinal_position;

\echo ''

-- 2. Check if the new columns already exist
\echo '2. CHECKING FOR NEW COLUMNS (should be empty BEFORE migration):'
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'schedule_settings' 
AND column_name IN (
    'schedule_update_in_progress',
    'schedule_update_scheduled_at', 
    'schedule_update_scheduled_by',
    'schedule_update_json'
)
ORDER BY column_name;

\echo ''

-- 3. Check current schedule_settings data
\echo '3. CURRENT SCHEDULE_SETTINGS DATA:'
SELECT 
    setting_key,
    setting_value,
    created_at,
    updated_at
FROM schedule_settings 
ORDER BY setting_key;

\echo ''

-- 4. Check if schedule_update_logs table exists
\echo '4. CHECKING FOR SCHEDULE_UPDATE_LOGS TABLE (should not exist BEFORE migration):'
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'schedule_update_logs'
) as table_exists;

\echo ''

-- 5. Check if the functions exist
\echo '5. CHECKING FOR REQUIRED FUNCTIONS (should not exist BEFORE migration):'
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_name IN (
    'is_booking_allowed',
    'process_scheduled_updates',
    'auto_timeout_schedule_updates'
)
ORDER BY routine_name;

\echo ''

-- 6. Check for existing indexes
\echo '6. CHECKING FOR SCHEDULE UPDATE INDEXES (should not exist BEFORE migration):'
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE indexname LIKE '%schedule_update%'
ORDER BY indexname;

\echo ''

-- 7. Verify current booking system dependencies
\echo '7. VERIFYING CURRENT BOOKING SYSTEM DEPENDENCIES:'
\echo 'Checking if availability API and booking API reference lock columns...'

-- Check if any views reference the new columns (should be none before migration)
SELECT 
    table_name,
    view_definition
FROM information_schema.views 
WHERE view_definition ILIKE '%schedule_update_in_progress%'
   OR view_definition ILIKE '%schedule_update_scheduled%';

\echo ''

-- 8. Test current booking flow (should work without lock columns)
\echo '8. TESTING CURRENT BOOKING FLOW COMPATIBILITY:'
\echo 'Attempting to query schedule_settings without new columns...'

-- This should work before migration
SELECT 
    COUNT(*) as settings_count,
    MAX(updated_at) as last_updated
FROM schedule_settings;

\echo ''

-- 9. Check for any existing schedule update mechanisms
\echo '9. CHECKING FOR EXISTING SCHEDULE UPDATE MECHANISMS:'
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE (column_name ILIKE '%lock%' OR column_name ILIKE '%update%')
AND table_name IN ('schedule_settings', 'bookings', 'schedule_slots')
ORDER BY table_name, column_name;

\echo ''

-- 10. Verify referential integrity won't be broken
\echo '10. VERIFYING REFERENTIAL INTEGRITY:'
\echo 'Checking foreign key constraints on schedule_settings...'

SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND (tc.table_name = 'schedule_settings' OR ccu.table_name = 'schedule_settings');

\echo ''
\echo '=== VERIFICATION COMPLETE ==='
\echo ''
\echo 'BEFORE MIGRATION EXPECTATIONS:'
\echo '- New columns should NOT exist in schedule_settings'
\echo '- schedule_update_logs table should NOT exist'  
\echo '- Lock-related functions should NOT exist'
\echo '- No schedule_update indexes should exist'
\echo '- Current booking flow should work normally'
\echo ''
\echo 'AFTER MIGRATION EXPECTATIONS:'
\echo '- 4 new columns should exist in schedule_settings'
\echo '- schedule_update_logs table should exist with proper structure'
\echo '- 3 new functions should exist and be callable'
\echo '- Index on schedule_update_scheduled_at should exist'
\echo '- All existing data should be preserved'
