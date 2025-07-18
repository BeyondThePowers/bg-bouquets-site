// Manual endpoint to simulate payment completion for testing
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase-admin';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { orderId } = await request.json();
    
    if (!orderId) {
      return new Response(JSON.stringify({
        error: 'Order ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('🔧 Manually completing payment for order:', orderId);

    // Find the booking by Square order ID
    const { data: booking, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('square_order_id', orderId)
      .single();

    if (fetchError || !booking) {
      console.error('Booking not found:', fetchError);
      return new Response(JSON.stringify({
        error: 'Booking not found for order ID: ' + orderId
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Found booking:', booking.id);

    // Update booking to paid status
    const { data: updatedBooking, error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        payment_status: 'paid',
        square_payment_id: `manual-test-${Date.now()}`,
        payment_completed_at: new Date().toISOString()
      })
      .eq('id', booking.id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update booking:', updateError);
      return new Response(JSON.stringify({
        error: 'Failed to update booking payment status'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Booking updated to paid status');

    // Send confirmation email
    const { sendBookingConfirmation } = await import('../../utils/webhookService');
    
    const bookingData = {
      id: updatedBooking.id,
      fullName: updatedBooking.full_name,
      email: updatedBooking.email,
      phone: updatedBooking.phone,
      visitDate: updatedBooking.date,
      preferredTime: updatedBooking.time,
      numberOfVisitors: updatedBooking.number_of_visitors,
      totalAmount: updatedBooking.total_amount,
      paymentMethod: updatedBooking.payment_method,
      createdAt: updatedBooking.created_at,
      paymentCompletedAt: updatedBooking.payment_completed_at,
      squareOrderId: updatedBooking.square_order_id,
      squarePaymentId: updatedBooking.square_payment_id,
      paymentDetails: {
        payment_id: updatedBooking.square_payment_id,
        amount_money: { amount: updatedBooking.total_amount * 100, currency: 'CAD' },
        status: 'COMPLETED'
      }
    };

    console.log('📧 Sending confirmation email...');
    const emailSent = await sendBookingConfirmation(bookingData, updatedBooking.cancellation_token);

    return new Response(JSON.stringify({
      success: true,
      message: 'Payment completed and confirmation email sent',
      booking: {
        id: updatedBooking.id,
        email: updatedBooking.email,
        paymentStatus: updatedBooking.payment_status,
        emailSent: emailSent
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Manual payment completion error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async () => {
  return new Response('Manual payment completion endpoint', { status: 200 });
};
