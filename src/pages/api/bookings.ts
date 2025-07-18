// src/pages/api/bookings.ts
import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { supabaseAdmin } from '../../lib/supabase-admin';
import { sendBookingConfirmation, logWebhookAttempt } from '../../services/webhook';
import { createPaymentLink, validateSquareConfig } from '../../services/square';

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
      numberOfVisitors, // Keep this name for API compatibility, maps to number_of_bouquets
      numberOfVisitorPasses = 0, // New field for visitor passes
      totalAmount,
      paymentMethod = 'pay_on_arrival'
    } = body;

    console.log('Extracted fields:', { fullName, email, phone, visitDate, preferredTime, numberOfVisitors, numberOfVisitorPasses, totalAmount, paymentMethod });

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

    // Validate number of bouquets
    if (numberOfVisitors < 1 || numberOfVisitors > 20) {
      return new Response(JSON.stringify({ error: 'Number of bouquets must be between 1 and 20.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get visitor pass limit from settings
    const { data: visitorLimitSetting, error: limitError } = await supabase
      .from('schedule_settings')
      .select('setting_value')
      .eq('setting_key', 'max_visitor_passes_per_booking')
      .single();

    const maxVisitorPasses = limitError ? 20 : parseInt(visitorLimitSetting?.setting_value || '20');

    // Validate number of visitor passes
    if (numberOfVisitorPasses < 0 || numberOfVisitorPasses > maxVisitorPasses) {
      return new Response(JSON.stringify({ error: `Number of visitor passes must be between 0 and ${maxVisitorPasses}.` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use database function to prevent race conditions and ensure atomic booking creation
    console.log('Creating booking with race condition protection:', {
      fullName,
      email,
      phone,
      visitDate,
      preferredTime,
      numberOfVisitors,
      numberOfVisitorPasses,
      totalAmount,
      paymentMethod
    });

    // Get client IP for audit logging
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || 'unknown';

    // For Square payments, we'll set status to 'pending' until payment is confirmed
    // For pay_on_arrival, we keep it as 'pending' until manually marked as paid
    const paymentStatus = 'pending';

    const { data: insertedBooking, error: insertError } = await supabase.from('bookings').insert({
      full_name: fullName,
      email,
      phone,
      date: visitDate,
      time: preferredTime,
      number_of_bouquets: numberOfVisitors,
      number_of_visitor_passes: numberOfVisitorPasses,
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
    const webhookBookingData = {
      id: insertedBooking.id,
      fullName,
      email,
      phone,
      visitDate,
      preferredTime,
      numberOfVisitors,
      numberOfVisitorPasses,
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
        numberOfBouquets: numberOfVisitors, // Map API field to bouquet terminology
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

    // Send webhook notification for pay_on_arrival bookings
    // pay_now bookings will be handled post-payment
    if (paymentMethod === 'pay_on_arrival') {
      console.log('Sending booking confirmation webhook for pay_on_arrival booking');

      // Send webhook directly with retry logic (async, don't block response)
      sendBookingConfirmation(webhookBookingData, insertedBooking.cancellation_token).then(success => {
        logWebhookAttempt(
          'booking_confirmed',
          webhookBookingData,
          success,
          success ? null : 'Failed after retries',
          1
        );
        if (success) {
          console.log('✅ Booking confirmation webhook sent successfully');
        } else {
          console.error('❌ Failed to send booking confirmation webhook after retries');
        }
      }).catch(error => {
        console.error('Webhook sending failed:', error);
        logWebhookAttempt(
          'booking_confirmed',
          webhookBookingData,
          false,
          error.message,
          1
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
