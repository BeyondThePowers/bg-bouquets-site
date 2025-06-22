-- Add support for payment status change history
-- This migration adds new action types for tracking payment status changes

-- Update the action_type constraint to include payment actions
ALTER TABLE booking_actions 
DROP CONSTRAINT IF EXISTS booking_actions_action_type_check;

ALTER TABLE booking_actions 
ADD CONSTRAINT booking_actions_action_type_check 
CHECK (action_type IN (
    'cancellation', 
    'reschedule_from', 
    'reschedule_to', 
    'admin_cancellation',
    'payment_marked_paid',
    'payment_marked_unpaid'
));

-- Add comment explaining the new action types
COMMENT ON COLUMN booking_actions.action_type IS 'Type of action performed: cancellation, reschedule_from, reschedule_to, admin_cancellation, payment_marked_paid, payment_marked_unpaid';
