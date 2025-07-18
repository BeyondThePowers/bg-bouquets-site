// src/pages/api/bookings.ts
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { sendBookingConfirmation, sendWebhookWithRetry, logWebhookAttempt } from '../../utils/webhookService';
import { createPaymentLink, validateSquareConfig } from '../../utils/squareService';

// Business timezone helper - Alberta, Canada (Mountain Time)
function getBusinessToday(): string {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Edmonton'
  }); // Returns YYYY-MM-DD format
}

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('Booking API called');
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));
    console.log('Request method:', request.method);

    let body;
    try {
      const rawBody = await request.text();
      console.log('Raw request body:', rawBody);

      if (!rawBody || rawBody.trim() === '') {
        throw new Error('Empty request body');
      }

      body = JSON.parse(rawBody);
      console.log('Parsed request body:', body);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      return new Response(JSON.stringify({
        error: 'Invalid JSON in request body',
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const {
      fullName,
      email,
      phone,
      visitDate,
      preferredTime,
      numberOfVisitors,
      totalAmount,
      paymentMethod = 'pay_on_arrival'
    } = body;

    console.log('Extracted fields:', { fullName, email, phone, visitDate, preferredTime, numberOfVisitors, totalAmount, paymentMethod });

    // Basic server-side validation
    if (!fullName || !email || !phone || !visitDate || !preferredTime || !numberOfVisitors) {
      console.log('Validation failed - missing fields');
      return new Response(JSON.stringify({ error: 'Missing required fields.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate date is not in the past (using business timezone)
    const businessToday = getBusinessToday();
    if (visitDate < businessToday) {
      return new Response(JSON.stringify({ error: 'Cannot book for past dates.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate number of visitors
    if (numberOfVisitors < 1 || numberOfVisitors > 20) {
      return new Response(JSON.stringify({ error: 'Number of visitors must be between 1 and 20.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use a transaction-like approach to prevent race conditions
    // 1. Fetch the time slot capacity AND booking limits for the selected date/time
    console.log('Checking time slot for:', { visitDate, preferredTime });
    const { data: slot, error: slotError } = await supabase
      .from('time_slots')
      .select('max_capacity, max_bookings')
      .eq('date', visitDate)
      .eq('time', preferredTime)
      .maybeSingle();

    console.log('Time slot query result:', { slot, slotError });

    if (slotError) {
      console.error('Time slot query error:', slotError);
      return new Response(JSON.stringify({ error: `Database error: ${slotError.message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!slot) {
      console.log('No time slot found for:', { visitDate, preferredTime });
      return new Response(JSON.stringify({ error: 'Selected time slot is not available.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Count existing bookings AND visitors for this slot
    console.log('Checking existing bookings for:', { visitDate, preferredTime });
    const { data: existingBookings, error: bookingError } = await supabase
      .from('bookings')
      .select('id, number_of_visitors')
      .eq('date', visitDate)
      .eq('time', preferredTime);

    console.log('Existing bookings query result:', { existingBookings, bookingError });

    if (bookingError) {
      console.error('Booking query error:', bookingError);
      return new Response(JSON.stringify({ error: `Could not verify availability: ${bookingError.message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calculate current usage
    const currentBookingCount = existingBookings.length;
    const currentVisitorCount = existingBookings.reduce((sum, booking) => sum + (booking.number_of_visitors || 1), 0);

    console.log('Current usage:', {
      currentBookingCount,
      currentVisitorCount,
      maxBookings: slot.max_bookings,
      maxCapacity: slot.max_capacity,
      requestedVisitors: numberOfVisitors
    });

    // 3. Check booking limit first
    if (currentBookingCount >= slot.max_bookings) {
      return new Response(JSON.stringify({
        error: `Maximum bookings reached for this time slot. Only ${slot.max_bookings} bookings allowed per slot.`
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Check visitor capacity limit
    if (currentVisitorCount + numberOfVisitors > slot.max_capacity) {
      const remainingCapacity = slot.max_capacity - currentVisitorCount;
      return new Response(JSON.stringify({
        error: `Not enough visitor capacity remaining. Only ${remainingCapacity} spots available, but you requested ${numberOfVisitors}.`
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 5. Insert new booking (both limits passed)
    // For Square payments, we'll set status to 'pending' until payment is confirmed
    // For pay_on_arrival, we keep it as 'pending' until manually marked as paid
    const paymentStatus = 'pending';

    console.log('Inserting booking with data:', {
      full_name: fullName,
      email,
      phone,
      date: visitDate,
      time: preferredTime,
      number_of_visitors: numberOfVisitors,
      total_amount: totalAmount,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
    });

    const { data: insertedBooking, error: insertError } = await supabase.from('bookings').insert({
      full_name: fullName,
      email,
      phone,
      date: visitDate,
      time: preferredTime,
      number_of_visitors: numberOfVisitors,
      total_amount: totalAmount,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
    }).select('id, created_at, cancellation_token').single();

    console.log('Insert result:', { insertedBooking, insertError });

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: `Booking failed: ${insertError.message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Prepare booking data for webhook
    const bookingData = {
      id: insertedBooking.id,
      fullName,
      email,
      phone,
      visitDate,
      preferredTime,
      numberOfVisitors,
      totalAmount,
      paymentMethod,
      createdAt: insertedBooking.created_at,
    };

    // Handle Square payment for 'pay_now' bookings
    if (paymentMethod === 'pay_now') {
      console.log('Creating Square payment link for pay_now booking');

      // Validate Square configuration
      const squareConfig = validateSquareConfig();
      if (!squareConfig.isValid) {
        console.error('Square configuration invalid:', squareConfig.missing);
        return new Response(JSON.stringify({
          error: 'Online payment is currently unavailable. Please select "Pay on Arrival" or try again later.'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Create Square payment link
      const paymentResult = await createPaymentLink({
        bookingId: insertedBooking.id,
        fullName,
        email,
        visitDate,
        preferredTime,
        numberOfVisitors,
        totalAmount
      });

      if (!paymentResult.success) {
        console.error('Failed to create Square payment link:', paymentResult.error);

        // Delete the booking since payment link creation failed
        await supabase.from('bookings').delete().eq('id', insertedBooking.id);

        return new Response(JSON.stringify({
          error: paymentResult.error || 'Failed to create payment link. Please try again or select "Pay on Arrival".'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Store the Square order ID in the booking for reference
      console.log('Payment result orderId:', paymentResult.orderId);
      if (paymentResult.orderId && paymentResult.orderId !== 'unknown') {
        try {
          console.log('🔄 Updating booking with Square order ID:', paymentResult.orderId, 'for booking ID:', insertedBooking.id);

          const { data: updatedBooking, error: updateError } = await supabaseAdmin
            .from('bookings')
            .update({
              square_order_id: paymentResult.orderId
            })
            .eq('id', insertedBooking.id)
            .select();

          if (updateError) {
            console.error('❌ Failed to update square_order_id:', updateError);
          } else if (updatedBooking && updatedBooking.length > 0) {
            console.log('✅ Successfully stored Square order ID:', paymentResult.orderId, 'for booking:', insertedBooking.id);
            console.log('📋 Updated booking data:', updatedBooking[0]);
          } else {
            console.warn('⚠️ Update succeeded but no rows returned. Booking ID:', insertedBooking.id);
          }
        } catch (updateError) {
          console.error('💥 Exception updating square_order_id:', updateError);
        }
      } else {
        console.warn('⚠️ No valid Square order ID to store:', paymentResult.orderId);
      }

      console.log('Square payment link created successfully:', paymentResult.paymentUrl);

      // Return payment URL for redirect
      return new Response(JSON.stringify({
        success: true,
        requiresPayment: true,
        paymentUrl: paymentResult.paymentUrl,
        bookingId: insertedBooking.id,
        message: 'Booking created! Redirecting to payment...'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Send confirmation email webhook (async, don't block response)
    // Only send for "pay_on_arrival" for now, "pay_now" will be handled post-payment
    if (paymentMethod === 'pay_on_arrival') {
      console.log('Sending booking confirmation webhook for pay_on_arrival booking');

      // Send webhook with retry logic in background
      sendWebhookWithRetry(
        () => sendBookingConfirmation(bookingData, insertedBooking.cancellation_token),
        3, // max retries
        2000 // initial delay
      ).then(success => {
        logWebhookAttempt(
          bookingData.id,
          'confirmation',
          success,
          success ? undefined : 'Failed after retries'
        );
      }).catch(error => {
        console.error('Webhook sending failed:', error);
        logWebhookAttempt(
          bookingData.id,
          'confirmation',
          false,
          error.message
        );
      });
    }

    // Create appropriate success message for pay_on_arrival bookings
    // (pay_now bookings are handled above with payment redirect)
    const successMessage = 'Thanks for booking! You can pay when you arrive. You\'ll receive a confirmation email shortly.';

    return new Response(JSON.stringify({
      success: true,
      message: successMessage
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Booking API error:', error);
    console.error('Error stack:', error.stack);
    return new Response(JSON.stringify({
      error: 'Internal server error. Please try again.',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
