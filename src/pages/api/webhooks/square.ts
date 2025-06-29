// src/pages/api/webhooks/square.ts
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

// Square webhook signature verification
function verifySquareSignature(body: string, signature: string, webhookKey: string): boolean {
  try {
    const hmac = crypto.createHmac('sha256', webhookKey);
    hmac.update(body);
    const expectedSignature = hmac.digest('base64');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'base64'),
      Buffer.from(expectedSignature, 'base64')
    );
  } catch (error) {
    console.error('Error verifying Square signature:', error);
    return false;
  }
}

// Send booking data to Make.com webhook
async function sendToMakeWebhook(bookingData: any, webhookType: 'payment_success' | 'payment_failed') {
  const webhookUrl = webhookType === 'payment_success' 
    ? import.meta.env.WEBHOOK_PAYMENT_SUCCESS_URL 
    : import.meta.env.WEBHOOK_PAYMENT_FAILED_URL;

  if (!webhookUrl) {
    console.log(`No webhook URL configured for ${webhookType}`);
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: webhookType,
        booking: bookingData,
        timestamp: new Date().toISOString()
      })
    });

    if (response.ok) {
      console.log(`Successfully sent ${webhookType} webhook to Make.com`);
    } else {
      console.error(`Failed to send ${webhookType} webhook:`, response.status, await response.text());
    }
  } catch (error) {
    console.error(`Error sending ${webhookType} webhook:`, error);
  }
}

// Update booking payment status
async function updateBookingPaymentStatus(orderId: string, status: 'paid' | 'failed', paymentDetails?: any) {
  try {
    // Find booking by order reference (you might need to adjust this based on how you store order IDs)
    const { data: bookings, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('square_order_id', orderId)
      .eq('payment_method', 'pay_now');

    if (fetchError) {
      console.error('Error fetching booking:', fetchError);
      return null;
    }

    if (!bookings || bookings.length === 0) {
      console.log(`No booking found for order ID: ${orderId}`);
      return null;
    }

    const booking = bookings[0];

    // Update payment status
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        payment_status: status,
        square_payment_id: paymentDetails?.payment_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', booking.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating booking payment status:', updateError);
      return null;
    }

    // Add to booking history
    await supabase
      .from('booking_history')
      .insert({
        booking_id: booking.id,
        action: status === 'paid' ? 'payment_completed' : 'payment_failed',
        details: {
          square_order_id: orderId,
          square_payment_id: paymentDetails?.payment_id,
          amount: paymentDetails?.amount_money?.amount,
          currency: paymentDetails?.amount_money?.currency
        },
        created_at: new Date().toISOString()
      });

    console.log(`Updated booking ${booking.id} payment status to: ${status}`);
    return updatedBooking;

  } catch (error) {
    console.error('Error updating booking payment status:', error);
    return null;
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('Square webhook received');

    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-square-signature');

    if (!signature) {
      console.error('Missing Square signature header');
      return new Response('Missing signature', { status: 400 });
    }

    // Verify webhook signature
    const webhookKey = import.meta.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    if (!webhookKey) {
      console.error('Missing Square webhook signature key');
      return new Response('Webhook not configured', { status: 500 });
    }

    if (!verifySquareSignature(rawBody, signature, webhookKey)) {
      console.error('Invalid Square webhook signature');
      return new Response('Invalid signature', { status: 401 });
    }

    // Parse webhook payload
    const payload = JSON.parse(rawBody);
    console.log('Square webhook payload:', JSON.stringify(payload, null, 2));

    const { type, data } = payload;

    // Handle different webhook events
    switch (type) {
      case 'payment.created':
      case 'payment.updated': {
        const payment = data.object.payment;
        const orderId = payment.order_id;
        const status = payment.status;

        console.log(`Payment ${payment.id} status: ${status} for order: ${orderId}`);

        if (status === 'COMPLETED') {
          // Payment successful
          const updatedBooking = await updateBookingPaymentStatus(orderId, 'paid', {
            payment_id: payment.id,
            amount_money: payment.amount_money
          });

          if (updatedBooking) {
            // Send success webhook to Make.com
            await sendToMakeWebhook(updatedBooking, 'payment_success');
          }

        } else if (status === 'FAILED' || status === 'CANCELED') {
          // Payment failed
          const updatedBooking = await updateBookingPaymentStatus(orderId, 'failed', {
            payment_id: payment.id,
            failure_reason: payment.delay_action?.reason || 'Payment failed'
          });

          if (updatedBooking) {
            // Send failure webhook to Make.com
            await sendToMakeWebhook(updatedBooking, 'payment_failed');
          }
        }

        break;
      }

      case 'order.updated': {
        const order = data.object.order;
        console.log(`Order ${order.id} updated with state: ${order.state}`);
        // Handle order updates if needed
        break;
      }

      default:
        console.log(`Unhandled webhook type: ${type}`);
    }

    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('Error processing Square webhook:', error);
    return new Response('Internal server error', { status: 500 });
  }
};

// Handle GET requests (for webhook verification during setup)
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const challenge = url.searchParams.get('challenge');
  
  if (challenge) {
    // Square webhook verification challenge
    return new Response(challenge, { 
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  return new Response('Square webhook endpoint', { status: 200 });
};
