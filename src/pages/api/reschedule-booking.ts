// src/pages/api/reschedule-booking.ts
import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { sendRescheduleConfirmation, logWebhookAttempt } from '../../services/webhook';

// Business timezone helper - Alberta, Canada (Mountain Time)
function getBusinessToday(): string {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Edmonton'
  }); // Returns YYYY-MM-DD format
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    console.log('Reschedule API called');
    
    const body = await request.json();
    const { cancellationToken, newDate, newTime, reason } = body;

    // Validate required fields
    if (!cancellationToken || !newDate || !newTime) {
      return new Response(JSON.stringify({ 
        error: 'Cancellation token, new date, and new time are required' 
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

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(newDate)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid date format. Use YYYY-MM-DD' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate new date is not in the past (using business timezone)
    const businessToday = getBusinessToday();
    if (newDate < businessToday) {
      return new Response(JSON.stringify({ 
        error: 'Cannot reschedule to past dates' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Attempting to reschedule booking:', { cancellationToken, newDate, newTime });

    // Call the database function to reschedule booking
    const { data, error } = await supabase.rpc('reschedule_booking', {
      p_cancellation_token: cancellationToken,
      p_new_date: newDate,
      p_new_time: newTime,
      p_reschedule_reason: reason || null,
      p_customer_ip: clientAddress || null
    });

    console.log('Reschedule result:', { data, error });

    if (error) {
      console.error('Database error during reschedule:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));

      // Check if it's a function not found error
      if (error.message && error.message.includes('function reschedule_booking')) {
        return new Response(JSON.stringify({
          error: 'Database function not found. Please ensure the database migration has been applied.'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Provide more specific error messages based on the error type
      let errorMessage = 'Failed to process reschedule. Please try again.';

      if (error.message) {
        if (error.message.includes('constraint') || error.message.includes('check')) {
          errorMessage = 'Database constraint error. Please contact support.';
        } else if (error.message.includes('not found')) {
          errorMessage = 'Booking not found or already cancelled.';
        } else if (error.message.includes('past date')) {
          errorMessage = 'Cannot reschedule to past dates.';
        } else if (error.message.includes('capacity') || error.message.includes('full')) {
          errorMessage = 'Selected time slot is fully booked. Please choose another time.';
        } else {
          errorMessage = `Database error: ${error.message}`;
        }
      }

      return new Response(JSON.stringify({
        error: errorMessage
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if reschedule was successful
    const result = data?.[0];
    if (!result?.success) {
      return new Response(JSON.stringify({ 
        error: result?.message || 'Reschedule failed' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const bookingData = result.booking_data;
    console.log('Booking rescheduled successfully:', bookingData);

    // Send reschedule confirmation email (async, don't block response)
    if (bookingData) {
      // Prepare data for webhook
      const webhookData = {
        id: bookingData.id,
        fullName: bookingData.full_name,
        email: bookingData.email,
        phone: bookingData.phone,
        visitDate: bookingData.new_date,
        preferredTime: bookingData.new_time,
        numberOfVisitors: bookingData.number_of_bouquets,
        totalAmount: bookingData.total_amount,
        paymentMethod: bookingData.payment_method,
        originalDate: bookingData.original_date,
        originalTime: bookingData.original_time,
        rescheduleReason: reason,
        cancellationToken: cancellationToken
      };

      // Send reschedule confirmation webhook
      sendRescheduleConfirmation(webhookData, originalDate, originalTime, reason, cancellationToken).then(success => {
        logWebhookAttempt(
          bookingData.id,
          'reschedule',
          success,
          success ? undefined : 'Failed after retries'
        );
        if (success) {
          console.log('✅ Reschedule webhook sent successfully');
        } else {
          console.error('❌ Failed to send reschedule webhook');
        }
      }).catch(error => {
        console.error('Reschedule webhook sending failed:', error);
        logWebhookAttempt(
          bookingData.id,
          'reschedule',
          false,
          error.message
        );
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Your booking has been rescheduled successfully. You will receive a confirmation email shortly.',
      booking: {
        originalDate: bookingData.original_date,
        originalTime: bookingData.original_time,
        newDate: bookingData.new_date,
        newTime: bookingData.new_time,
        visitors: bookingData.number_of_bouquets
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Reschedule API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error. Please try again.' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// GET endpoint to validate reschedule token and show current booking
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
      .select('id, full_name, email, date, time, number_of_bouquets, total_amount, status, reschedule_count')
      .eq('cancellation_token', cancellationToken)
      .single();

    if (error || !booking) {
      return new Response(JSON.stringify({ 
        error: 'Invalid or expired reschedule link' 
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
        error: 'Cannot reschedule bookings for past dates' 
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
        currentDate: booking.date,
        currentTime: booking.time,
        visitors: booking.number_of_bouquets,
        amount: booking.total_amount,
        rescheduleCount: booking.reschedule_count
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Reschedule validation error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};


