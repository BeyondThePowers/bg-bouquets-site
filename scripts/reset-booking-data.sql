-- =====================================================
-- BLUEBELL GARDENS - BOOKING DATA RESET SCRIPT
-- =====================================================
-- 
-- This script safely removes all booking-related data while preserving:
-- - Database schema and structure
-- - Security policies (RLS rules)
-- - Configuration tables (schedule_settings, open_days, etc.)
-- - User accounts and authentication data
--
-- IMPORTANT: This is IRREVERSIBLE. Make sure you want to delete all booking data.
-- 
-- Usage:
-- 1. Run this in Supabase SQL Editor
-- 2. Or execute via Supabase CLI: supabase db reset --db-url "your-connection-string"
-- 3. Or use the provided JavaScript function for API-based deletion
--
-- =====================================================

-- Start transaction for safety
BEGIN;

-- Display current record counts before deletion
DO $$
DECLARE
    booking_count INTEGER;
    history_count INTEGER;
    refund_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO booking_count FROM bookings;
    SELECT COUNT(*) INTO history_count FROM booking_history WHERE booking_history.id IS NOT NULL;
    SELECT COUNT(*) INTO refund_count FROM refunds WHERE refunds.id IS NOT NULL;
    
    RAISE NOTICE 'BEFORE DELETION:';
    RAISE NOTICE 'Bookings: %', booking_count;
    RAISE NOTICE 'Booking History Records: %', history_count;
    RAISE NOTICE 'Refund Records: %', refund_count;
END $$;

-- =====================================================
-- DELETE BOOKING-RELATED DATA
-- =====================================================

-- Delete refunds first (references bookings)
DELETE FROM refunds;
RAISE NOTICE 'Deleted all refund records';

-- Delete booking history (references bookings)
DELETE FROM booking_history;
RAISE NOTICE 'Deleted all booking history records';

-- Delete main bookings table
DELETE FROM bookings;
RAISE NOTICE 'Deleted all booking records';

-- Reset any auto-increment sequences if they exist
-- (Supabase uses UUIDs by default, but just in case)
-- ALTER SEQUENCE IF EXISTS bookings_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS booking_history_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS refunds_id_seq RESTART WITH 1;

-- =====================================================
-- VERIFY DELETION
-- =====================================================

DO $$
DECLARE
    booking_count INTEGER;
    history_count INTEGER;
    refund_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO booking_count FROM bookings;
    SELECT COUNT(*) INTO history_count FROM booking_history WHERE booking_history.id IS NOT NULL;
    SELECT COUNT(*) INTO refund_count FROM refunds WHERE refunds.id IS NOT NULL;
    
    RAISE NOTICE 'AFTER DELETION:';
    RAISE NOTICE 'Bookings: %', booking_count;
    RAISE NOTICE 'Booking History Records: %', history_count;
    RAISE NOTICE 'Refund Records: %', refund_count;
    
    IF booking_count = 0 AND history_count = 0 AND refund_count = 0 THEN
        RAISE NOTICE 'SUCCESS: All booking data has been safely removed!';
    ELSE
        RAISE EXCEPTION 'ERROR: Some records were not deleted. Rolling back transaction.';
    END IF;
END $$;

-- =====================================================
-- PRESERVE CONFIGURATION DATA
-- =====================================================

-- Verify that configuration tables are still intact
DO $$
DECLARE
    schedule_count INTEGER;
    open_days_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO schedule_count FROM schedule_settings;
    SELECT COUNT(*) INTO open_days_count FROM open_days;
    
    RAISE NOTICE 'CONFIGURATION DATA PRESERVED:';
    RAISE NOTICE 'Schedule Settings: %', schedule_count;
    RAISE NOTICE 'Open Days: %', open_days_count;
END $$;

-- Commit the transaction
COMMIT;

RAISE NOTICE 'Database reset completed successfully!';
RAISE NOTICE 'You can now proceed with fresh testing.';

-- =====================================================
-- OPTIONAL: INSERT SAMPLE TEST DATA
-- =====================================================
-- Uncomment the following section if you want to add some test data

/*
-- Insert a few test bookings for development
INSERT INTO bookings (
    full_name,
    email,
    phone,
    date,
    time,
    number_of_visitors,
    total_amount,
    payment_method,
    payment_status,
    square_order_id,
    square_payment_id
) VALUES
    ('Test User 1', 'test1@example.com', '(555) 123-4567', '2025-07-01', '10:00 AM', 2, 70, 'pay_on_arrival', 'pending', NULL, NULL),
    ('Test User 2', 'test2@example.com', '(555) 234-5678', '2025-07-01', '2:00 PM', 1, 35, 'pay_now', 'paid', 'test-order-123', 'test-payment-456'),
    ('Test User 3', 'test3@example.com', '(555) 345-6789', '2025-07-02', '11:00 AM', 4, 140, 'pay_on_arrival', 'pending', NULL, NULL);

RAISE NOTICE 'Sample test data inserted.';
*/
