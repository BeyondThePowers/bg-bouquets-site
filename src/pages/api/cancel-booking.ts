// src/pages/api/cancel-booking.ts
import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { sendCancellationConfirmation, sendCancellationNotification } from '../../services/webhook';

// Business timezone helper - Alberta, Canada (Mountain Time)
function getBusinessToday(): string {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Edmonton'
  }); // Returns YYYY-MM-DD format
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    console.log('Cancellation API called');
    
    const body = await request.json();
    const { cancellationToken, reason } = body;

    // Validate required fields
    if (!cancellationToken) {
      return new Response(JSON.stringify({ 
        error: 'Cancellation token is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate token format (should be UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(cancellationToken)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid cancellation token format' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Attempting to cancel booking with token:', cancellationToken);

    // Call the database function to cancel booking
    const { data, error } = await supabase.rpc('cancel_booking', {
      p_cancellation_token: cancellationToken,
      p_cancellation_reason: reason || null,
      p_customer_ip: clientAddress || null
    });

    console.log('Cancellation result:', { data, error });

    if (error) {
      console.error('Database error during cancellation:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to process cancellation. Please try again.' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if cancellation was successful
    const result = data?.[0];
    if (!result?.success) {
      return new Response(JSON.stringify({ 
        error: result?.message || 'Cancellation failed' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const bookingData = result.booking_data;
    console.log('Booking cancelled successfully:', bookingData);

    // Send cancellation confirmation emails (async, don't block response)
    if (bookingData) {
      // Send confirmation to customer
      sendCancellationConfirmation({
        id: bookingData.id,
        fullName: bookingData.full_name,
        email: bookingData.email,
        phone: bookingData.phone,
        visitDate: bookingData.date,
        preferredTime: bookingData.time,
        numberOfVisitors: bookingData.number_of_visitors,
        totalAmount: bookingData.total_amount,
        paymentMethod: bookingData.payment_method,
        cancellationReason: reason,
        cancellationToken: bookingData.cancellation_token
      }).catch(error => {
        console.error('Failed to send cancellation confirmation:', error);
      });

      // Send notification to admin
      sendCancellationNotification({
        id: bookingData.id,
        fullName: bookingData.full_name,
        email: bookingData.email,
        phone: bookingData.phone,
        visitDate: bookingData.date,
        preferredTime: bookingData.time,
        numberOfVisitors: bookingData.number_of_visitors,
        totalAmount: bookingData.total_amount,
        paymentMethod: bookingData.payment_method,
        cancellationReason: reason,
        cancellationToken: bookingData.cancellation_token
      }).catch(error => {
        console.error('Failed to send admin cancellation notification:', error);
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Your booking has been cancelled successfully. You will receive a confirmation email shortly.',
      booking: {
        date: bookingData.date,
        time: bookingData.time,
        visitors: bookingData.number_of_visitors
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Cancellation API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error. Please try again.' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// GET endpoint to check cancellation token validity
export const GET: APIRoute = async ({ url }) => {
  try {
    const cancellationToken = url.searchParams.get('token');
    
    if (!cancellationToken) {
      return new Response(JSON.stringify({ 
        error: 'Cancellation token is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Look up booking by cancellation token
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('id, full_name, email, date, time, number_of_visitors, total_amount, status')
      .eq('cancellation_token', cancellationToken)
      .single();

    if (error || !booking) {
      return new Response(JSON.stringify({ 
        error: 'Invalid or expired cancellation link' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (booking.status === 'cancelled') {
      return new Response(JSON.stringify({ 
        error: 'This booking has already been cancelled' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if booking is in the past (using business timezone)
    const businessToday = getBusinessToday();

    if (booking.date < businessToday) {
      return new Response(JSON.stringify({ 
        error: 'Cannot cancel bookings for past dates' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      valid: true,
      booking: {
        customerName: booking.full_name,
        email: booking.email,
        date: booking.date,
        time: booking.time,
        visitors: booking.number_of_visitors,
        amount: booking.total_amount
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Cancellation validation error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
