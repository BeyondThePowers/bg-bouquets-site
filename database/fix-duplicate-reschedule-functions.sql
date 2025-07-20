-- Fix duplicate reschedule_booking functions
-- This removes the customer-only version and keeps the admin-capable version
-- Run this in your Supabase SQL Editor

-- 1. Check current reschedule_booking functions
SELECT 'Current reschedule_booking functions:' as info;
SELECT 
    proname,
    pg_get_function_identity_arguments(oid) as signature,
    prosrc IS NOT NULL as has_source
FROM pg_proc 
WHERE proname = 'reschedule_booking'
ORDER BY pg_get_function_identity_arguments(oid);

-- 2. Drop the customer-only version (5 parameters)
-- This is the version without p_admin_user parameter
DROP FUNCTION IF EXISTS reschedule_booking(
    p_cancellation_token UUID,
    p_new_date DATE,
    p_new_time VARCHAR(20),
    p_reschedule_reason VARCHAR(500),
    p_customer_ip VARCHAR(45)
);

-- 3. Ensure the admin-capable version exists (6 parameters)
-- This version can handle both customer and admin reschedules
CREATE OR REPLACE FUNCTION reschedule_booking(
    p_cancellation_token UUID,
    p_new_date DATE,
    p_new_time VARCHAR(20),
    p_reschedule_reason VARCHAR(500) DEFAULT NULL,
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
    v_slot_capacity INTEGER;
    v_slot_bookings INTEGER;
    v_current_bookings INTEGER;
    v_current_bouquets INTEGER;
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

    -- Check if new date is in the future (unless admin action)
    IF p_new_date < CURRENT_DATE AND NOT v_is_admin_action THEN
        RETURN QUERY SELECT false, 'Cannot reschedule to past dates', NULL::JSONB;
        RETURN;
    END IF;

    -- Store original booking data for audit trail
    v_booking_data := to_jsonb(v_booking_record);

    -- Get slot capacity and current bookings for the new slot
    -- Use max_bouquets instead of max_capacity
    SELECT max_bouquets, max_bookings INTO v_slot_capacity, v_slot_bookings
    FROM time_slots
    WHERE date = p_new_date AND time = p_new_time;

    -- Check if the new time slot exists
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Selected time slot is not available', NULL::JSONB;
        RETURN;
    END IF;

    -- Count current bookings for the new slot (excluding this booking if it's already on this slot)
    SELECT 
        COUNT(*),
        COALESCE(SUM(number_of_bouquets), 0)
    INTO v_current_bookings, v_current_bouquets
    FROM bookings
    WHERE date = p_new_date 
    AND time = p_new_time 
    AND status = 'confirmed'
    AND id != v_booking_record.id;

    -- Check capacity constraints
    IF v_current_bookings >= v_slot_bookings THEN
        RETURN QUERY SELECT false, 'Selected time slot is fully booked (max bookings reached)', NULL::JSONB;
        RETURN;
    END IF;

    -- Use number_of_bouquets instead of number_of_visitors
    IF (v_current_bouquets + v_booking_record.number_of_bouquets) > v_slot_capacity THEN
        RETURN QUERY SELECT false, 'Selected time slot does not have enough capacity', NULL::JSONB;
        RETURN;
    END IF;

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
            performed_by_admin,
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
            NOT v_is_admin_action,
            p_admin_user,
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
            performed_by_admin,
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
            NOT v_is_admin_action,
            p_admin_user,
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

-- 4. Verify only one reschedule_booking function remains
SELECT 'Remaining reschedule_booking functions:' as info;
SELECT 
    proname,
    pg_get_function_identity_arguments(oid) as signature
FROM pg_proc 
WHERE proname = 'reschedule_booking';

-- 5. Test the function works for both customer and admin calls
SELECT 'Testing customer reschedule (should fail - booking not found):' as info;
SELECT * FROM reschedule_booking(
    '00000000-0000-0000-0000-000000000000'::UUID,
    CURRENT_DATE + INTERVAL '1 day',
    '10:00 AM',
    'Customer test',
    '127.0.0.1'
    -- p_admin_user is NULL (customer reschedule)
);

SELECT 'Testing admin reschedule (should fail - booking not found):' as info;
SELECT * FROM reschedule_booking(
    '00000000-0000-0000-0000-000000000000'::UUID,
    CURRENT_DATE + INTERVAL '1 day',
    '10:00 AM',
    'Admin test',
    '127.0.0.1',
    'admin@example.com'
);

-- Success message
SELECT 'Duplicate reschedule_booking functions fixed successfully!' as status;
