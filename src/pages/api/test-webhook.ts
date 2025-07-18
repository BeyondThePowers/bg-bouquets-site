// src/pages/api/test-webhook.ts
import type { APIRoute } from 'astro';
import { sendBookingConfirmation, sendErrorNotification, sendCancellationConfirmation, sendCancellationNotification, sendRescheduleConfirmation } from '../../services/webhook';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { type = 'confirmation' } = body;

    // Sample booking data for testing
    const { paymentStatus = 'pending' } = body;

    const sampleBookingData = {
      id: `test_${Date.now()}`,
      fullName: 'Test Customer',
      email: 'test@example.com',
      phone: '(555) 123-4567',
      visitDate: '2025-07-15',
      preferredTime: '10:00 AM',
      numberOfVisitors: 2, // Represents number of bouquets
      totalAmount: 70,
      paymentMethod: paymentStatus === 'completed' ? 'pay_now' : 'pay_on_arrival',
      createdAt: new Date().toISOString(),
      // Add payment completion details for online payment tests
      ...(paymentStatus === 'completed' && {
        paymentCompletedAt: new Date().toISOString(),
        squareOrderId: `test-order-${Date.now()}`,
        squarePaymentId: `test-payment-${Date.now()}`,
        paymentDetails: {
          payment_id: `test-payment-${Date.now()}`,
          amount_money: { amount: 7000, currency: 'CAD' },
          status: 'COMPLETED'
        }
      })
    };

    let result;
    let webhookType;

    if (type === 'confirmation') {
      webhookType = 'Booking Confirmation';
      result = await sendBookingConfirmation(sampleBookingData, 'test-cancellation-token-123');
    } else if (type === 'error') {
      webhookType = 'Error Notification';
      result = await sendErrorNotification(sampleBookingData, {
        message: 'Test error notification',
        type: 'test_error',
      });
    } else if (type === 'cancellation') {
      webhookType = 'Cancellation Confirmation';
      result = await sendCancellationConfirmation({
        ...sampleBookingData,
        cancellationReason: 'Test cancellation reason',
        cancellationToken: 'test-cancellation-token-123'
      });
    } else if (type === 'cancellation-admin') {
      webhookType = 'Admin Cancellation Notification';
      result = await sendCancellationNotification({
        ...sampleBookingData,
        cancellationReason: 'Test cancellation reason',
        cancellationToken: 'test-cancellation-token-123'
      });
    } else if (type === 'reschedule') {
      webhookType = 'Reschedule Confirmation';
      result = await sendRescheduleConfirmation({
        ...sampleBookingData,
        originalDate: '2025-07-10',
        originalTime: '6:00 PM',
        rescheduleReason: 'Test reschedule reason',
        cancellationToken: 'test-cancellation-token-123'
      });
    } else {
      return new Response(JSON.stringify({
        error: 'Invalid webhook type. Use "confirmation", "error", "cancellation", "cancellation-admin", or "reschedule"'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: result,
      message: `${webhookType} webhook ${result ? 'sent successfully' : 'failed'}`,
      testData: sampleBookingData
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Test webhook error:', error);
    return new Response(JSON.stringify({
      error: 'Test webhook failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({
    message: 'Webhook test endpoint',
    usage: {
      confirmation: 'POST /api/test-webhook with {"type": "confirmation"}',
      error: 'POST /api/test-webhook with {"type": "error"}',
      cancellation: 'POST /api/test-webhook with {"type": "cancellation"}',
      cancellationAdmin: 'POST /api/test-webhook with {"type": "cancellation-admin"}',
      reschedule: 'POST /api/test-webhook with {"type": "reschedule"}'
    },
    environment: {
      bookingWebhookConfigured: !!(process.env.MAKE_BOOKING_WEBHOOK_URL || import.meta.env.MAKE_BOOKING_WEBHOOK_URL),
      // Note: MAKE_CANCELLATION_WEBHOOK_URL is deprecated - all events now use MAKE_BOOKING_WEBHOOK_URL
      adminEmailConfigured: !!(process.env.ADMIN_EMAIL || import.meta.env.ADMIN_EMAIL),
      consolidatedWebhooks: true // All events now route to single webhook URL
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
