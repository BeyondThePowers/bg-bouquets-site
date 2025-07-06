// src/pages/api/test-square-signature.ts
import type { APIRoute } from 'astro';
import crypto from 'crypto';

// Test Square signature verification with known values
function verifySquareSignature(body: string, signature: string, webhookKey: string, notificationUrl: string): boolean {
  try {
    const hmac = crypto.createHmac('sha256', webhookKey);
    hmac.update(notificationUrl + body);
    const expectedSignature = hmac.digest('base64');

    console.log('Signature verification test:', {
      notificationUrl,
      bodyLength: body.length,
      providedSignature: signature,
      expectedSignature: expectedSignature,
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

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-square-hmacsha256-signature') || '';
    const webhookKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || import.meta.env.SQUARE_WEBHOOK_SIGNATURE_KEY || '';
    
    const notificationUrl = 'https://bgbouquet.com/api/square-webhook';
    const isValid = verifySquareSignature(body, signature, webhookKey, notificationUrl);
    
    return new Response(JSON.stringify({
      message: 'Signature test endpoint',
      hasWebhookKey: !!webhookKey,
      webhookKeyLength: webhookKey.length,
      bodyLength: body.length,
      hasSignature: !!signature,
      signatureValid: isValid,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async () => {
  const webhookKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || import.meta.env.SQUARE_WEBHOOK_SIGNATURE_KEY || '';
  
  return new Response(JSON.stringify({
    message: 'Square signature test endpoint',
    hasWebhookKey: !!webhookKey,
    webhookKeyLength: webhookKey.length,
    webhookKeyPrefix: webhookKey.substring(0, 8) + '...' || 'Not set',
    environment: process.env.NODE_ENV || 'development'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
