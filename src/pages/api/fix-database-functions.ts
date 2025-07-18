// API endpoint to fix database functions for bouquet terminology
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase-admin';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('Fixing database functions for bouquet terminology...');

    // SQL to fix the cancel_booking function
    const fixCancelBookingSQL = `
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
$$;`;

    // Execute the SQL
    const { error } = await supabaseAdmin.rpc('exec', { sql: fixCancelBookingSQL });

    if (error) {
      console.error('Error fixing cancel_booking function:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to fix cancel_booking function: ' + error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Database functions fixed successfully');

    return new Response(JSON.stringify({
      success: true,
      message: 'Database functions fixed successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fixing database functions:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error: ' + error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
