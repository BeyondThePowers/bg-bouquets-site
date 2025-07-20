-- Master Verification Script for Schedule Locking Migration
-- This script runs all verification steps in the correct order

\echo '======================================================='
\echo 'SCHEDULE LOCKING MIGRATION - COMPLETE VERIFICATION'
\echo '======================================================='
\echo ''

\echo 'STEP 1: PRE-MIGRATION VERIFICATION'
\echo 'This checks the current state before applying changes...'
\echo ''

\i database/verification/verify_schedule_locking_migration.sql

\echo ''
\echo '======================================================='
\echo 'MIGRATION CHECKPOINT'
\echo '======================================================='
\echo ''
\echo 'At this point, you should:'
\echo '1. Review the above output to confirm current state'
\echo '2. Apply the migration: \\i database/migrations/add_schedule_update_locking.sql'
\echo '3. Then continue with post-migration verification'
\echo ''
\echo 'To continue after migration, run:'
\echo '\\i database/verification/run_post_migration_tests.sql'
\echo ''
\echo 'Or run the individual test files:'
\echo '\\i database/verification/test_schedule_locking_functionality.sql'
\echo '\\i database/verification/verify_booking_integration.sql'
