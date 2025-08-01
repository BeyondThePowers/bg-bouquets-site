// src/pages/api/square-webhook.ts
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { sendBookingConfirmation, logWebhookAttempt } from '../../services/webhook';
import crypto from 'crypto';

// Initialize Supabase admin client for server-side operations
const supabaseAdmin = createClient(
  process.env.PUBLIC_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

// Square webhook signature verification (correct method with notification URL)
function verifySquareSignature(body: string, signature: string, webhookKey: string, notificationUrl: string): boolean {
  try {
    // Square signature calculation: HMAC-SHA256(signature_key, notification_url + body)
    const hmac = crypto.createHmac('sha256', webhookKey);
    hmac.update(notificationUrl + body);
    const expectedSignature = hmac.digest('base64');

    console.log('Square signature verification:', {
      notificationUrl,
      bodyLength: body.length,
      providedSignature: signature.substring(0, 20) + '...',
      expectedSignature: expectedSignature.substring(0, 20) + '...',
      webhookKeyLength: webhookKey.length
    });

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'base64'),
      Buffer.from(expectedSignature, 'base64')
    );
  } catch (error) {
    console.error('Error verifying Square signature:', error);
    return false;
  }
}

// Add GET endpoint for testing
export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({
    message: 'Square webhook endpoint is accessible',
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request, url }) => {
  try {
    console.log('🔥 OLD SQUARE WEBHOOK ENDPOINT CALLED: /api/square-webhook');
    console.log('Request headers:', Object.fromEntries(request.headers.entries()));

    // Get the raw body for signature verification
    const rawBody = await request.text();
    console.log('Raw webhook body length:', rawBody.length);

    // Get the Square signature from headers (correct header name)
    const signature = request.headers.get('x-square-hmacsha256-signature');
    if (!signature) {
      console.error('Missing Square signature header (x-square-hmacsha256-signature)');
      return new Response('Missing signature', { status: 400 });
    }

    // Verify the webhook signature using the correct Square method
    const webhookKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || import.meta.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    if (!webhookKey) {
      console.error('Square webhook signature key not configured');
      return new Response('Webhook not configured', { status: 500 });
    }

    // Get the notification URL (this should match what's configured in Square Dashboard)
    const notificationUrl = 'https://bgbouquet.com/api/square-webhook';

    const isValidSignature = verifySquareSignature(rawBody, signature, webhookKey, notificationUrl);
    if (!isValidSignature) {
      console.error('Invalid Square webhook signature');
      return new Response('Invalid signature', { status: 401 });
    }

    // Parse the webhook payload
    let webhookData;
    try {
      webhookData = JSON.parse(rawBody);
    } catch (error) {
      console.error('Failed to parse webhook JSON:', error);
      return new Response('Invalid JSON', { status: 400 });
    }

    console.log('Square webhook data:', JSON.stringify(webhookData, null, 2));

    // Handle different webhook event types
    const eventType = webhookData.type;
    console.log('Processing Square webhook event:', eventType);

    switch (eventType) {
      case 'payment.created':
      case 'payment.updated':
        await handlePaymentEvent(webhookData);
        break;
      
      case 'order.updated':
        await handleOrderEvent(webhookData);
        break;
      
      default:
        console.log('Unhandled Square webhook event type:', eventType);
        break;
    }

    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('Square webhook error:', error);
    return new Response('Internal server error', { status: 500 });
  }
};

/**
 * Handle Square payment events (payment.created, payment.updated)
 */
async function handlePaymentEvent(webhookData: any) {
  try {
    const payment = webhookData.data?.object?.payment;
    if (!payment) {
      console.error('No payment data in webhook');
      return;
    }

    const orderId = payment.order_id;
    const paymentId = payment.id;
    const status = payment.status;
    const amountMoney = payment.amount_money;

    console.log('Processing payment event:', {
      orderId,
      paymentId,
      status,
      amount: amountMoney
    });

    // Find the booking by Square order ID
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('square_order_id', orderId)
      .single();

    if (bookingError || !booking) {
      console.error('Booking not found for Square order:', orderId, bookingError);
      return;
    }

    console.log('Found booking for payment:', booking.id);

    // Handle different payment statuses
    if (status === 'COMPLETED') {
      console.log('Payment completed, updating booking status');
      
      // Check if we already processed this payment completion to prevent duplicate webhooks
      const { data: existingPayment, error: paymentCheckError } = await supabaseAdmin
        .from('bookings')
        .select('payment_completed_at, square_payment_id')
        .eq('id', booking.id)
        .single();

      if (existingPayment?.square_payment_id === paymentId && existingPayment?.payment_completed_at) {
        console.log('Payment already processed for booking:', booking.id, 'payment:', paymentId);
        return; // Skip duplicate processing
      }
      
      // Update booking to paid status
      const { error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({
          payment_status: 'paid',
          square_payment_id: paymentId,
          payment_completed_at: new Date().toISOString()
        })
        .eq('id', booking.id);

      if (updateError) {
        console.error('Failed to update booking payment status:', updateError);
        return;
      }

      // Send confirmation email
      console.log('Sending booking confirmation email for paid booking');

      const { sendBookingConfirmation, prepareBookingWebhookData } = await import('../../services/webhook');

      // Use the standardized webhook data preparation function
      const bookingData = prepareBookingWebhookData({
        ...booking,
        // Add Square payment completion data
        square_payment_id: paymentId,
        payment_completed_at: new Date().toISOString(),
        payment_details: {
          payment_id: paymentId,
          amount_money: amountMoney,
          status: status
        }
      });

      // Send webhook with retry logic in background
      sendBookingConfirmation(bookingData, booking.cancellation_token).then(success => {
        if (success) {
          console.log('✅ Square payment webhook sent successfully');
        } else {
          console.error('❌ Failed to send Square payment webhook');
        }
      }).catch(error => {
        console.error('Webhook sending failed:', error);
      });

    } else if (status === 'FAILED' || status === 'CANCELED') {
      console.log('Payment failed or canceled, updating booking status');
      
      // Update booking to failed status
      const { error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({
          payment_status: 'failed',
          square_payment_id: paymentId
        })
        .eq('id', booking.id);

      if (updateError) {
        console.error('Failed to update booking payment status:', updateError);
        return;
      }

      // Optionally, you could delete the booking or send a failure notification
      console.log('Payment failed for booking:', booking.id);
    }

  } catch (error) {
    console.error('Error handling payment event:', error);
  }
}

/**
 * Handle Square order events (order.updated)
 */
async function handleOrderEvent(webhookData: any) {
  try {
    const order = webhookData.data?.object?.order;
    if (!order) {
      console.error('No order data in webhook');
      return;
    }

    const orderId = order.id;
    const state = order.state;

    console.log('Processing order event:', {
      orderId,
      state
    });

    // Find the booking by Square order ID
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, payment_status')
      .eq('square_order_id', orderId)
      .single();

    if (bookingError || !booking) {
      console.error('Booking not found for Square order:', orderId, bookingError);
      return;
    }

    console.log('Found booking for order event:', booking.id, 'Current status:', booking.payment_status);

    // Handle order state changes if needed
    // Most payment processing will be handled by payment events
    // This is mainly for logging and additional order tracking

  } catch (error) {
    console.error('Error handling order event:', error);
  }
}
