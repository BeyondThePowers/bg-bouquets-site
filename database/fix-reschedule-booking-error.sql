-- Fix reschedule booking error by ensuring consistent booking_actions table constraints
-- Based on current database state from dbmakeup.json
-- Run this in your Supabase SQL Editor

-- 1. First, check current constraints on booking_actions table
SELECT 'Current constraints on booking_actions table:' as info;
SELECT conname, pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'booking_actions'::regclass
AND contype = 'c';

-- 2. Check if booking_actions table exists and its structure (we know it exists from dbmakeup.json)
SELECT 'Checking booking_actions table structure:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'booking_actions'
ORDER BY ordinal_position;

-- 3. Drop any existing constraint on action_type and recreate with all required action types
ALTER TABLE booking_actions
DROP CONSTRAINT IF EXISTS booking_actions_action_type_check;

-- 4. Add comprehensive constraint that includes all action types used across the system
-- This includes the reschedule_from and reschedule_to values that the reschedule_booking function needs
ALTER TABLE booking_actions
ADD CONSTRAINT booking_actions_action_type_check
CHECK (action_type IN (
    'cancellation',
    'reschedule_from',
    'reschedule_to',
    'admin_cancellation',
    'payment_marked_paid',
    'payment_marked_unpaid',
    'refund_processed',
    'admin_refund'
));

-- 5. Verify the constraint was applied correctly
SELECT 'New constraint applied:' as info;
SELECT conname, pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'booking_actions'::regclass
AND contype = 'c'
AND conname = 'booking_actions_action_type_check';

-- 6. Check if reschedule_booking function exists
SELECT 'Checking if reschedule_booking function exists:' as info;
SELECT proname, prosrc IS NOT NULL as has_source
FROM pg_proc
WHERE proname = 'reschedule_booking';

-- 7. Test the reschedule_booking function with a dummy call to ensure it works
-- This should return an error about booking not found, but not a constraint error
SELECT 'Testing reschedule_booking function (should return "Booking not found"):' as info;
SELECT * FROM reschedule_booking(
    '00000000-0000-0000-0000-000000000000'::UUID,
    CURRENT_DATE + INTERVAL '1 day',
    '10:00 AM',
    'Test reschedule',
    '127.0.0.1'
);

-- 8. Check if there are any existing booking_actions records that might violate the constraint
SELECT 'Current action types in booking_actions table:' as info;
SELECT action_type, COUNT(*)
FROM booking_actions
GROUP BY action_type
ORDER BY action_type;

-- 9. Success message
SELECT 'Reschedule booking error fix applied successfully!' as status;
