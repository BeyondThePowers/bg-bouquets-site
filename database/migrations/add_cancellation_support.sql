-- Enhanced booking system with cancellation and reschedule support
-- Run this in your Supabase SQL editor
-- NOTE: This replaces the previous cancellation-only system

-- 1. Enhanced bookings table with reschedule and admin features
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS cancellation_token UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS reschedule_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_rescheduled_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS admin_refund_amount DECIMAL(10,2) NULL,
ADD COLUMN IF NOT EXISTS admin_refund_method VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS admin_refund_notes TEXT NULL,
ADD COLUMN IF NOT EXISTS admin_refund_date TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS admin_refund_by VARCHAR(100) NULL;

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_cancellation_token ON bookings(cancellation_token);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_reschedule_count ON bookings(reschedule_count);

-- 3. Drop old cancellations table if it exists and create new booking_actions table
DROP TABLE IF EXISTS cancellations CASCADE;

CREATE TABLE booking_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('cancellation', 'reschedule_from', 'reschedule_to', 'admin_cancellation')),

    -- Original booking details (for audit trail)
    original_booking_data JSONB NOT NULL,

    -- Action-specific details
    reason VARCHAR(500) NULL,

    -- Reschedule-specific fields
    original_date DATE NULL,
    original_time VARCHAR(20) NULL,
    new_date DATE NULL,
    new_time VARCHAR(20) NULL,

    -- Admin and tracking fields
    performed_by_customer BOOLEAN DEFAULT true,
    performed_by_admin VARCHAR(100) NULL,
    customer_ip VARCHAR(45) NULL,
    action_timestamp TIMESTAMPTZ DEFAULT NOW(),

    -- Additional metadata
    notes TEXT NULL
);

-- 4. Create indexes for booking_actions table
CREATE INDEX idx_booking_actions_booking_id ON booking_actions(booking_id);
CREATE INDEX idx_booking_actions_action_type ON booking_actions(action_type);
CREATE INDEX idx_booking_actions_timestamp ON booking_actions(action_timestamp);
CREATE INDEX idx_booking_actions_performed_by ON booking_actions(performed_by_customer);

-- 5. Update existing bookings to have cancellation tokens
UPDATE bookings
SET cancellation_token = gen_random_uuid()
WHERE cancellation_token IS NULL;

-- 6. Make cancellation_token NOT NULL after updating existing records
ALTER TABLE bookings
ALTER COLUMN cancellation_token SET NOT NULL;

-- 7. Create function to handle cancellation
CREATE OR REPLACE FUNCTION cancel_booking(
    p_cancellation_token UUID,
    p_cancellation_reason VARCHAR(500) DEFAULT NULL,
    p_customer_ip VARCHAR(45) DEFAULT NULL,
    p_admin_user VARCHAR(100) DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    booking_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking_record bookings%ROWTYPE;
    v_booking_data JSONB;
    v_is_admin_action BOOLEAN := (p_admin_user IS NOT NULL);
BEGIN
    -- Find the booking by cancellation token
    SELECT * INTO v_booking_record
    FROM bookings
    WHERE cancellation_token = p_cancellation_token
    AND status = 'confirmed';

    -- Check if booking exists and is not already cancelled
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Booking not found or already cancelled', NULL::JSONB;
        RETURN;
    END IF;

    -- Check if booking is in the future (can't cancel past bookings unless admin)
    IF v_booking_record.date < CURRENT_DATE AND NOT v_is_admin_action THEN
        RETURN QUERY SELECT false, 'Cannot cancel bookings for past dates', NULL::JSONB;
        RETURN;
    END IF;

    -- Prepare booking data for cancellation record
    v_booking_data := jsonb_build_object(
        'id', v_booking_record.id,
        'full_name', v_booking_record.full_name,
        'email', v_booking_record.email,
        'phone', v_booking_record.phone,
        'date', v_booking_record.date,
        'time', v_booking_record.time,
        'number_of_visitors', v_booking_record.number_of_visitors,
        'total_amount', v_booking_record.total_amount,
        'payment_method', v_booking_record.payment_method,
        'payment_status', v_booking_record.payment_status,
        'created_at', v_booking_record.created_at
    );

    -- Start transaction
    BEGIN
        -- Update booking status
        UPDATE bookings
        SET status = 'cancelled',
            cancelled_at = NOW()
        WHERE id = v_booking_record.id;

        -- Insert cancellation record
        INSERT INTO booking_actions (
            booking_id,
            action_type,
            original_booking_data,
            reason,
            performed_by_customer,
            performed_by_admin,
            customer_ip
        ) VALUES (
            v_booking_record.id,
            CASE WHEN v_is_admin_action THEN 'admin_cancellation' ELSE 'cancellation' END,
            v_booking_data,
            p_cancellation_reason,
            NOT v_is_admin_action,
            p_admin_user,
            p_customer_ip
        );

        -- Return success
        RETURN QUERY SELECT true, 'Booking cancelled successfully', v_booking_data;

    EXCEPTION WHEN OTHERS THEN
        -- Rollback handled automatically
        RETURN QUERY SELECT false, 'Failed to cancel booking: ' || SQLERRM, NULL::JSONB;
    END;
END;
$$;

-- 8. Create function to handle reschedule
CREATE OR REPLACE FUNCTION reschedule_booking(
    p_cancellation_token UUID,
    p_new_date DATE,
    p_new_time VARCHAR(20),
    p_reschedule_reason VARCHAR(500) DEFAULT NULL,
    p_customer_ip VARCHAR(45) DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    booking_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking_record bookings%ROWTYPE;
    v_booking_data JSONB;
    v_slot_capacity INTEGER;
    v_slot_bookings INTEGER;
    v_current_bookings INTEGER;
    v_current_visitors INTEGER;
    v_schedule_settings RECORD;
BEGIN
    -- Find the booking by cancellation token
    SELECT * INTO v_booking_record
    FROM bookings
    WHERE cancellation_token = p_cancellation_token
    AND status = 'confirmed';

    -- Check if booking exists and is not already cancelled
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Booking not found or already cancelled', NULL::JSONB;
        RETURN;
    END IF;

    -- Check if booking is in the future (can't reschedule past bookings)
    IF v_booking_record.date < CURRENT_DATE THEN
        RETURN QUERY SELECT false, 'Cannot reschedule bookings for past dates', NULL::JSONB;
        RETURN;
    END IF;

    -- Check if new date is in the future
    IF p_new_date < CURRENT_DATE THEN
        RETURN QUERY SELECT false, 'Cannot reschedule to past dates', NULL::JSONB;
        RETURN;
    END IF;

    -- Check if rescheduling to the same date/time (pointless)
    IF v_booking_record.date = p_new_date AND v_booking_record.time = p_new_time THEN
        RETURN QUERY SELECT false, 'Cannot reschedule to the same date and time', NULL::JSONB;
        RETURN;
    END IF;

    -- Get schedule settings for capacity checking
    SELECT max_bookings_per_slot, max_visitors_per_slot
    INTO v_schedule_settings
    FROM schedule_settings
    LIMIT 1;

    -- Check if new time slot exists and get capacity
    SELECT max_capacity, max_bookings INTO v_slot_capacity, v_slot_bookings
    FROM time_slots
    WHERE date = p_new_date AND time = p_new_time;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Selected time slot is not available', NULL::JSONB;
        RETURN;
    END IF;

    -- Count current bookings for the new slot (excluding this booking if it's the same slot)
    SELECT COUNT(*), COALESCE(SUM(number_of_visitors), 0)
    INTO v_current_bookings, v_current_visitors
    FROM bookings
    WHERE date = p_new_date
    AND time = p_new_time
    AND status = 'confirmed'
    AND id != v_booking_record.id;

    -- Check booking limit
    IF v_current_bookings >= v_slot_bookings THEN
        RETURN QUERY SELECT false, 'Maximum bookings reached for this time slot', NULL::JSONB;
        RETURN;
    END IF;

    -- Check visitor capacity
    IF v_current_visitors + v_booking_record.number_of_visitors > v_slot_capacity THEN
        RETURN QUERY SELECT false, 'Not enough visitor capacity remaining for this time slot', NULL::JSONB;
        RETURN;
    END IF;

    -- Prepare booking data for audit trail
    v_booking_data := jsonb_build_object(
        'id', v_booking_record.id,
        'full_name', v_booking_record.full_name,
        'email', v_booking_record.email,
        'phone', v_booking_record.phone,
        'original_date', v_booking_record.date,
        'original_time', v_booking_record.time,
        'new_date', p_new_date,
        'new_time', p_new_time,
        'number_of_visitors', v_booking_record.number_of_visitors,
        'total_amount', v_booking_record.total_amount,
        'payment_method', v_booking_record.payment_method,
        'payment_status', v_booking_record.payment_status,
        'created_at', v_booking_record.created_at
    );

    -- Start transaction for atomic reschedule
    BEGIN
        -- Update booking with new date/time
        UPDATE bookings
        SET date = p_new_date,
            time = p_new_time,
            reschedule_count = reschedule_count + 1,
            last_rescheduled_at = NOW()
        WHERE id = v_booking_record.id;

        -- Insert "reschedule from" record
        INSERT INTO booking_actions (
            booking_id,
            action_type,
            original_booking_data,
            reason,
            original_date,
            original_time,
            new_date,
            new_time,
            performed_by_customer,
            customer_ip
        ) VALUES (
            v_booking_record.id,
            'reschedule_from',
            v_booking_data,
            p_reschedule_reason,
            v_booking_record.date,
            v_booking_record.time,
            p_new_date,
            p_new_time,
            true,
            p_customer_ip
        );

        -- Insert "reschedule to" record
        INSERT INTO booking_actions (
            booking_id,
            action_type,
            original_booking_data,
            reason,
            original_date,
            original_time,
            new_date,
            new_time,
            performed_by_customer,
            customer_ip
        ) VALUES (
            v_booking_record.id,
            'reschedule_to',
            v_booking_data,
            p_reschedule_reason,
            v_booking_record.date,
            v_booking_record.time,
            p_new_date,
            p_new_time,
            true,
            p_customer_ip
        );

        -- Return success with updated booking data
        v_booking_data := jsonb_set(v_booking_data, '{reschedule_count}', to_jsonb(v_booking_record.reschedule_count + 1));
        RETURN QUERY SELECT true, 'Booking rescheduled successfully', v_booking_data;

    EXCEPTION WHEN OTHERS THEN
        -- Rollback handled automatically
        RETURN QUERY SELECT false, 'Failed to reschedule booking: ' || SQLERRM, NULL::JSONB;
    END;
END;
$$;

-- 9. Create function to document admin refunds
CREATE OR REPLACE FUNCTION document_refund(
    p_booking_id UUID,
    p_refund_amount DECIMAL(10,2),
    p_refund_method VARCHAR(50),
    p_refund_notes TEXT,
    p_admin_user VARCHAR(100)
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking_exists BOOLEAN;
    v_payment_status VARCHAR(20);
    v_total_amount DECIMAL(10,2);
BEGIN
    -- Check if booking exists and get payment status
    SELECT EXISTS(SELECT 1 FROM bookings WHERE id = p_booking_id),
           payment_status,
           total_amount
    INTO v_booking_exists, v_payment_status, v_total_amount
    FROM bookings
    WHERE id = p_booking_id;

    IF NOT v_booking_exists THEN
        RETURN QUERY SELECT false, 'Booking not found';
        RETURN;
    END IF;

    -- Check if booking is paid
    IF v_payment_status != 'completed' THEN
        RETURN QUERY SELECT false, 'Refunds can only be processed for bookings that have been paid';
        RETURN;
    END IF;

    -- Validate refund amount doesn't exceed booking total
    IF p_refund_amount > v_total_amount THEN
        RETURN QUERY SELECT false, 'Refund amount cannot exceed booking total';
        RETURN;
    END IF;

    -- Update booking with refund information
    UPDATE bookings
    SET admin_refund_amount = p_refund_amount,
        admin_refund_method = p_refund_method,
        admin_refund_notes = p_refund_notes,
        admin_refund_date = NOW(),
        admin_refund_by = p_admin_user
    WHERE id = p_booking_id;

    RETURN QUERY SELECT true, 'Refund documented successfully';
END;
$$;

-- 10. Create view for active bookings (excludes cancelled)
CREATE OR REPLACE VIEW active_bookings AS
SELECT * FROM bookings WHERE status = 'confirmed';

-- 11. Create view for admin booking management
CREATE OR REPLACE VIEW admin_booking_view AS
SELECT
    b.*,
    -- Status should only be 'active' or 'cancelled', refunds are separate
    CASE
        WHEN b.status = 'cancelled' THEN 'cancelled'
        ELSE 'active'
    END as booking_status,
    -- Payment information for admin display
    CASE
        WHEN b.payment_method = 'pay_on_arrival' AND b.payment_status = 'pending' THEN 'Pay on Arrival'
        WHEN b.payment_method = 'pay_online' AND b.payment_status = 'completed' THEN 'Paid Online'
        WHEN b.payment_method = 'pay_online' AND b.payment_status = 'pending' THEN 'Payment Pending'
        ELSE b.payment_status
    END as payment_display,
    -- Refund information (separate from status)
    CASE
        WHEN b.admin_refund_amount IS NOT NULL THEN true
        ELSE false
    END as has_refund,
    -- Action counts for history
    (SELECT COUNT(*) FROM booking_actions ba WHERE ba.booking_id = b.id AND ba.action_type LIKE 'reschedule%') as total_reschedules,
    (SELECT COUNT(*) FROM booking_actions ba WHERE ba.booking_id = b.id) as total_actions
FROM bookings b;

-- 12. Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT ON booking_actions TO authenticated;
-- GRANT EXECUTE ON FUNCTION cancel_booking TO authenticated;
-- GRANT EXECUTE ON FUNCTION reschedule_booking TO authenticated;
-- GRANT EXECUTE ON FUNCTION document_refund TO authenticated;

-- 13. Add helpful comments
COMMENT ON TABLE booking_actions IS 'Tracks all booking actions (cancellations, reschedules) for admin review and analytics';
COMMENT ON FUNCTION cancel_booking IS 'Safely cancels a booking using cancellation token and creates audit trail';
COMMENT ON FUNCTION reschedule_booking IS 'Safely reschedules a booking with availability checking and audit trail';
COMMENT ON FUNCTION document_refund IS 'Allows admin to document manual refunds issued outside the system';
COMMENT ON VIEW admin_booking_view IS 'Enhanced booking view for admin interface with action counts and status';
