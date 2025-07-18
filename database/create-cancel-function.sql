-- Create the cancel_booking function if it doesn't exist
-- This is based on the latest version from the migration files
-- Run this in your Supabase SQL Editor

-- Create the cancel_booking function
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

    -- Store original booking data for audit trail
    v_booking_data := to_jsonb(v_booking_record);

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

    EXCEPTION
        WHEN OTHERS THEN
            -- Rollback will happen automatically
            RETURN QUERY SELECT false, 'Failed to cancel booking: ' || SQLERRM, NULL::JSONB;
    END;
END;
$$;

-- Test the function
SELECT 'Testing cancel_booking function:' as info;
SELECT * FROM cancel_booking(
    '00000000-0000-0000-0000-000000000000'::UUID,
    'Test cancellation'::VARCHAR,
    '127.0.0.1'::VARCHAR,
    NULL::VARCHAR
);

-- Success message
SELECT 'cancel_booking function created successfully!' as status;
