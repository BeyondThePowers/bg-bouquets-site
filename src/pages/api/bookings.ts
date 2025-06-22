// src/pages/api/bookings.ts
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { sendBookingConfirmation, sendWebhookWithRetry, logWebhookAttempt } from '../../utils/webhookService';

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

    // Validate date is not in the past
    const visitDateObj = new Date(visitDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (visitDateObj < today) {
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
    // Determine payment status based on payment method
    const paymentStatus = paymentMethod === 'pay_now' ? 'paid' : 'pending';

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

    // Create appropriate success message based on payment method
    const successMessage = paymentMethod === 'pay_now'
      ? 'You\'re all set! We\'ve received your payment. You\'ll receive a confirmation email shortly.'
      : 'Thanks for booking! You can pay when you arrive. You\'ll receive a confirmation email shortly.';

    return new Response(JSON.stringify({
      success: true,
      message: successMessage
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Booking API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
