// src/pages/api/test-payloads.ts
import type { APIRoute } from 'astro';

// Import the actual webhook service functions to show real payload structure
// Note: We'll import the createStandardizedPayload function if it was exported
// For now, we'll manually create payloads that match the actual webhook service structure

/**
 * Generate standardized test payloads for all webhook event types
 * This endpoint helps verify the new unified payload structure
 */
export const GET: APIRoute = async ({ url }) => {
  const eventType = url.searchParams.get('event') || 'all';
  
  const baseBookingData = {
    id: `test_${Date.now()}`,
    fullName: 'Test Customer',
    email: 'test@example.com',
    phone: '(555) 123-4567',
    visitDate: '2025-07-15',
    preferredTime: '10:00 AM',
    numberOfVisitors: 2, // Represents number of bouquets
    totalAmount: 70,
    paymentMethod: 'pay_on_arrival',
    createdAt: new Date().toISOString(),
  };

  const paymentCompletedData = {
    ...baseBookingData,
    paymentMethod: 'pay_now',
    paymentCompletedAt: new Date().toISOString(),
    squareOrderId: `test-order-${Date.now()}`,
    squarePaymentId: `test-payment-${Date.now()}`,
    paymentDetails: {
      payment_id: `test-payment-${Date.now()}`,
      amount_money: { amount: 7000, currency: 'CAD' },
      status: 'COMPLETED'
    }
  };

  const testPayloads = {
    booking_confirmed_pending: {
      event: 'booking_confirmed',
      booking: {
        id: baseBookingData.id,
        customer: {
          name: baseBookingData.fullName,
          email: baseBookingData.email,
          phone: baseBookingData.phone,
        },
        visit: {
          date: baseBookingData.visitDate,
          time: baseBookingData.preferredTime,
          visitors: baseBookingData.numberOfVisitors,
          amount: baseBookingData.totalAmount,
          bouquets: baseBookingData.numberOfVisitors,
        },
        payment: {
          method: baseBookingData.paymentMethod,
          status: 'pending',
          squareOrderId: null,
          squarePaymentId: null,
          completedAt: null,
          details: null,
        },
        original: null,
        new: null,
        cancellation: null,
        reschedule: null,
        error: null,
        metadata: {
          createdAt: baseBookingData.createdAt,
          source: 'website',
          emailType: null,
          cancellationToken: 'test-cancellation-token-123',
          adminEmail: null,
          timestamp: null,
        },
      },
    },

    booking_confirmed_completed: {
      event: 'booking_confirmed',
      booking: {
        id: paymentCompletedData.id,
        customer: {
          name: paymentCompletedData.fullName,
          email: paymentCompletedData.email,
          phone: paymentCompletedData.phone,
        },
        visit: {
          date: paymentCompletedData.visitDate,
          time: paymentCompletedData.preferredTime,
          visitors: paymentCompletedData.numberOfVisitors,
          amount: paymentCompletedData.totalAmount,
          bouquets: paymentCompletedData.numberOfVisitors,
        },
        payment: {
          method: paymentCompletedData.paymentMethod,
          status: 'completed',
          squareOrderId: paymentCompletedData.squareOrderId,
          squarePaymentId: paymentCompletedData.squarePaymentId,
          completedAt: paymentCompletedData.paymentCompletedAt,
          details: paymentCompletedData.paymentDetails,
        },
        original: null,
        new: null,
        cancellation: null,
        reschedule: null,
        error: null,
        metadata: {
          createdAt: paymentCompletedData.createdAt,
          source: 'website',
          emailType: null,
          cancellationToken: 'test-cancellation-token-123',
          adminEmail: null,
          timestamp: null,
        },
      },
    },

    booking_error: {
      event: 'booking_error',
      booking: {
        id: baseBookingData.id,
        customer: {
          name: baseBookingData.fullName,
          email: baseBookingData.email,
          phone: null,
        },
        visit: {
          date: baseBookingData.visitDate,
          time: baseBookingData.preferredTime,
          visitors: null,
          amount: null,
        },
        payment: {
          method: null,
          status: 'pending',
          squareOrderId: null,
          squarePaymentId: null,
          completedAt: null,
          details: null,
        },
        original: null,
        new: null,
        cancellation: null,
        reschedule: null,
        error: {
          message: 'Test error notification',
          type: 'test_error',
        },
        metadata: {
          createdAt: baseBookingData.createdAt,
          source: 'website',
          emailType: null,
          cancellationToken: null,
          adminEmail: null,
          timestamp: new Date().toISOString(),
        },
      },
    },

    booking_cancelled: {
      event: 'booking_cancelled',
      booking: {
        id: baseBookingData.id,
        customer: {
          name: baseBookingData.fullName,
          email: baseBookingData.email,
          phone: baseBookingData.phone,
        },
        visit: {
          date: baseBookingData.visitDate,
          time: baseBookingData.preferredTime,
          visitors: baseBookingData.numberOfVisitors,
          amount: baseBookingData.totalAmount,
        },
        payment: {
          method: baseBookingData.paymentMethod,
          status: 'cancelled',
          squareOrderId: null,
          squarePaymentId: null,
          completedAt: null,
          details: null,
        },
        original: null,
        new: null,
        cancellation: {
          reason: 'Test cancellation reason',
          cancelledAt: new Date().toISOString(),
        },
        reschedule: null,
        error: null,
        metadata: {
          createdAt: baseBookingData.createdAt,
          source: 'website',
          emailType: 'customer_cancellation_confirmation',
          cancellationToken: 'test-cancellation-token-123',
          adminEmail: null,
          timestamp: null,
        },
      },
    },

    booking_cancelled_admin: {
      event: 'booking_cancelled_admin',
      booking: {
        id: baseBookingData.id,
        customer: {
          name: baseBookingData.fullName,
          email: baseBookingData.email,
          phone: baseBookingData.phone,
        },
        visit: {
          date: baseBookingData.visitDate,
          time: baseBookingData.preferredTime,
          visitors: baseBookingData.numberOfVisitors,
          amount: baseBookingData.totalAmount,
        },
        payment: {
          method: baseBookingData.paymentMethod,
          status: 'cancelled',
          squareOrderId: null,
          squarePaymentId: null,
          completedAt: null,
          details: null,
        },
        original: null,
        new: null,
        cancellation: {
          reason: 'Test admin cancellation reason',
          cancelledAt: new Date().toISOString(),
        },
        reschedule: null,
        error: null,
        metadata: {
          createdAt: baseBookingData.createdAt,
          source: 'website',
          emailType: 'admin_cancellation_notification',
          cancellationToken: 'test-cancellation-token-123',
          adminEmail: 'tim@ecosi.io',
          timestamp: null,
        },
      },
    },

    booking_rescheduled: {
      event: 'booking_rescheduled',
      booking: {
        id: baseBookingData.id,
        customer: {
          name: baseBookingData.fullName,
          email: baseBookingData.email,
          phone: baseBookingData.phone,
        },
        visit: {
          date: baseBookingData.visitDate,
          time: baseBookingData.preferredTime,
          visitors: baseBookingData.numberOfVisitors,
          amount: baseBookingData.totalAmount,
        },
        payment: {
          method: baseBookingData.paymentMethod,
          status: 'confirmed',
          squareOrderId: null,
          squarePaymentId: null,
          completedAt: null,
          details: null,
        },
        original: {
          date: '2025-07-10',
          time: '6:00 PM',
        },
        new: {
          date: baseBookingData.visitDate,
          time: baseBookingData.preferredTime,
          visitors: baseBookingData.numberOfVisitors,
          amount: baseBookingData.totalAmount,
        },
        cancellation: null,
        reschedule: {
          reason: 'Test reschedule reason',
          rescheduledAt: new Date().toISOString(),
        },
        error: null,
        metadata: {
          createdAt: baseBookingData.createdAt,
          source: 'website',
          emailType: 'booking_updated',
          cancellationToken: 'test-cancellation-token-123',
          adminEmail: null,
          timestamp: null,
        },
      },
    },
  };

  if (eventType === 'all') {
    return new Response(JSON.stringify({
      message: 'Standardized webhook test payloads for all event types',
      note: 'All events now route to MAKE_BOOKING_WEBHOOK_URL with consistent structure',
      payloads: testPayloads,
      usage: {
        specific: 'GET /api/test-payloads?event=booking_confirmed',
        all: 'GET /api/test-payloads (or ?event=all)'
      }
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const payload = testPayloads[eventType as keyof typeof testPayloads];
  if (!payload) {
    return new Response(JSON.stringify({
      error: 'Invalid event type',
      availableEvents: Object.keys(testPayloads)
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({
    message: `Test payload for ${eventType}`,
    payload
  }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
