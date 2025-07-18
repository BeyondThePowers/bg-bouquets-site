-- Targeted fix for reschedule booking error
-- Based on analysis of dbmakeup.json - the issue is likely a missing or incomplete CHECK constraint
-- Run this in your Supabase SQL Editor

-- 1. Check what constraints currently exist on booking_actions table
SELECT
    'Current constraints on booking_actions.action_type:' as info,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'booking_actions'::regclass
AND contype = 'c'
AND pg_get_constraintdef(oid) LIKE '%action_type%';

-- 2. Drop any existing action_type constraint
ALTER TABLE booking_actions 
DROP CONSTRAINT IF EXISTS booking_actions_action_type_check;

-- 3. Add the correct constraint that includes reschedule action types
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

-- 4. Verify the constraint was applied
SELECT
    'New constraint applied:' as info,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'booking_actions'::regclass
AND contype = 'c'
AND conname = 'booking_actions_action_type_check';

-- 5. Test the reschedule_booking function (should return "Booking not found" not constraint error)
SELECT 'Testing reschedule_booking function:' as info;
SELECT * FROM reschedule_booking(
    '00000000-0000-0000-0000-000000000000'::UUID,
    CURRENT_DATE + INTERVAL '1 day',
    '10:00 AM',
    'Test reschedule after constraint fix',
    '127.0.0.1'
);

-- 6. Success message
SELECT 'Reschedule booking constraint fix completed!' as status;
