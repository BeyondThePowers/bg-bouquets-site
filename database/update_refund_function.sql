-- Update document_refund function to include payment status validation
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
