// Test endpoint to simulate Square webhook calls
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    console.log('Test webhook received:', body);

    // Test with the actual Square order ID from your payment
    const testOrderId = 'me2ZPbMQpZLmGK5SFpObk2KNbmJZY'; // From your Square response
    
    // Simulate a Square webhook payload for payment completion
    const squareWebhookPayload = {
      type: 'payment.updated',
      data: {
        object: {
          payment: {
            id: `test-payment-${Date.now()}`,
            order_id: testOrderId,
            status: 'COMPLETED',
            amount_money: {
              amount: 7000,
              currency: 'CAD'
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        }
      }
    };

    console.log('🧪 Testing Square webhook with payload:', JSON.stringify(squareWebhookPayload, null, 2));

    // Test the new webhook endpoint
    try {
      const newWebhookResponse = await fetch('http://localhost:4321/api/webhooks/square', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-square-signature': 'test-signature' // This will fail signature verification, but we can see if endpoint is called
        },
        body: JSON.stringify(squareWebhookPayload)
      });
      
      console.log('✅ New webhook endpoint response:', newWebhookResponse.status);
    } catch (error) {
      console.error('❌ New webhook endpoint error:', error.message);
    }

    // Test the old webhook endpoint
    try {
      const oldWebhookResponse = await fetch('http://localhost:4321/api/square-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-square-signature': 'test-signature'
        },
        body: JSON.stringify(squareWebhookPayload)
      });
      
      console.log('✅ Old webhook endpoint response:', oldWebhookResponse.status);
    } catch (error) {
      console.error('❌ Old webhook endpoint error:', error.message);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Webhook test completed - check console logs',
      testOrderId: testOrderId,
      squarePayload: squareWebhookPayload
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Test webhook error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async () => {
  return new Response('Test Square webhook endpoint is working', { status: 200 });
};
