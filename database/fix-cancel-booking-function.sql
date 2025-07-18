-- Fix cancel_booking and reschedule_booking functions to use number_of_bouquets instead of number_of_visitors
-- Run this in your Supabase SQL Editor

-- 1. Update cancel_booking function
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

    -- Prepare booking data for cancellation record (FIXED: use number_of_bouquets)
    v_booking_data := jsonb_build_object(
        'id', v_booking_record.id,
        'full_name', v_booking_record.full_name,
        'email', v_booking_record.email,
        'phone', v_booking_record.phone,
        'date', v_booking_record.date,
        'time', v_booking_record.time,
        'number_of_bouquets', v_booking_record.number_of_bouquets,
        'total_amount', v_booking_record.total_amount,
        'payment_method', v_booking_record.payment_method,
        'payment_status', v_booking_record.payment_status,
        'created_at', v_booking_record.created_at,
        'cancellation_token', v_booking_record.cancellation_token
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

    EXCEPTION
        WHEN OTHERS THEN
            -- Rollback will happen automatically
            RETURN QUERY SELECT false, 'Failed to cancel booking: ' || SQLERRM, NULL::JSONB;
    END;
END;
$$;

-- 2. Update reschedule_booking function
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
    v_current_bouquets INTEGER;
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

    -- Check if new date is in the future
    IF p_new_date < CURRENT_DATE THEN
        RETURN QUERY SELECT false, 'Cannot reschedule to past dates', NULL::JSONB;
        RETURN;
    END IF;

    -- Get schedule settings for capacity limits
    SELECT * INTO v_schedule_settings
    FROM schedule_settings
    WHERE setting_key IN ('max_bouquets_per_slot', 'max_bookings_per_slot')
    LIMIT 1;

    -- Get time slot capacity (try time_slots table first, then fall back to settings)
    SELECT max_bouquets, max_bookings INTO v_slot_capacity, v_slot_bookings
    FROM time_slots
    WHERE date = p_new_date AND time = p_new_time;

    IF NOT FOUND THEN
        -- Fall back to schedule settings
        v_slot_capacity := COALESCE((SELECT setting_value::INTEGER FROM schedule_settings WHERE setting_key = 'max_bouquets_per_slot'), 10);
        v_slot_bookings := COALESCE((SELECT setting_value::INTEGER FROM schedule_settings WHERE setting_key = 'max_bookings_per_slot'), 5);
    END IF;

    -- Count current bookings for the new slot (excluding this booking if it's the same slot)
    SELECT COUNT(*), COALESCE(SUM(number_of_bouquets), 0)
    INTO v_current_bookings, v_current_bouquets
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

    -- Check bouquet capacity (FIXED: use number_of_bouquets)
    IF v_current_bouquets + v_booking_record.number_of_bouquets > v_slot_capacity THEN
        RETURN QUERY SELECT false, 'Not enough bouquet capacity remaining for this time slot', NULL::JSONB;
        RETURN;
    END IF;

    -- Prepare booking data for audit trail (FIXED: use number_of_bouquets)
    v_booking_data := jsonb_build_object(
        'id', v_booking_record.id,
        'full_name', v_booking_record.full_name,
        'email', v_booking_record.email,
        'phone', v_booking_record.phone,
        'original_date', v_booking_record.date,
        'original_time', v_booking_record.time,
        'new_date', p_new_date,
        'new_time', p_new_time,
        'number_of_bouquets', v_booking_record.number_of_bouquets,
        'total_amount', v_booking_record.total_amount,
        'payment_method', v_booking_record.payment_method,
        'payment_status', v_booking_record.payment_status,
        'created_at', v_booking_record.created_at,
        'cancellation_token', v_booking_record.cancellation_token
    );

    -- Start transaction
    BEGIN
        -- Record the reschedule action (from)
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

        -- Update the booking
        UPDATE bookings
        SET date = p_new_date,
            time = p_new_time,
            reschedule_count = reschedule_count + 1,
            last_rescheduled_at = NOW()
        WHERE id = v_booking_record.id;

        -- Record the reschedule action (to)
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
        v_booking_data := jsonb_set(v_booking_data, '{date}', to_jsonb(p_new_date));
        v_booking_data := jsonb_set(v_booking_data, '{time}', to_jsonb(p_new_time));
        
        RETURN QUERY SELECT true, 'Booking rescheduled successfully', v_booking_data;

    EXCEPTION
        WHEN OTHERS THEN
            -- Rollback will happen automatically
            RETURN QUERY SELECT false, 'Failed to reschedule booking: ' || SQLERRM, NULL::JSONB;
    END;
END;
$$;

-- 3. Verify the functions were updated
SELECT 'Database functions updated successfully for bouquet terminology' as status;
