// src/pages/api/test-webhook.ts
import type { APIRoute } from 'astro';
import { sendBookingConfirmation, sendErrorNotification, sendCancellationConfirmation, sendCancellationNotification, sendRescheduleConfirmation } from '../../utils/webhookService';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { type = 'confirmation' } = body;

    // Sample booking data for testing
    const sampleBookingData = {
      id: `test_${Date.now()}`,
      fullName: 'Test Customer',
      email: 'test@example.com',
      phone: '(555) 123-4567',
      visitDate: '2025-07-15',
      preferredTime: '10:00 AM',
      numberOfVisitors: 2,
      totalAmount: 70,
      paymentMethod: 'pay_on_arrival',
      createdAt: new Date().toISOString(),
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
      bookingWebhookConfigured: !!import.meta.env.MAKE_BOOKING_WEBHOOK_URL,
      errorWebhookConfigured: !!import.meta.env.MAKE_ERROR_WEBHOOK_URL,
      adminEmailConfigured: !!import.meta.env.ADMIN_EMAIL,
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
