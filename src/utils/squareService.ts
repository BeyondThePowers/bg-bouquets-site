// src/utils/squareService.ts
import { ApiClient, OrdersApi, CreateOrderRequest } from 'square-connect';

// Square configuration - get from environment
function getSquareConfig() {
  const config = {
    SQUARE_APPLICATION_ID: import.meta.env.SQUARE_APPLICATION_ID || process.env.SQUARE_APPLICATION_ID,
    SQUARE_APPLICATION_SECRET: import.meta.env.SQUARE_APPLICATION_SECRET || process.env.SQUARE_APPLICATION_SECRET,
    SQUARE_ACCESS_TOKEN: import.meta.env.SQUARE_ACCESS_TOKEN || process.env.SQUARE_ACCESS_TOKEN,
    SQUARE_LOCATION_ID: import.meta.env.SQUARE_LOCATION_ID || process.env.SQUARE_LOCATION_ID,
    SQUARE_WEBHOOK_SIGNATURE_KEY: import.meta.env.SQUARE_WEBHOOK_SIGNATURE_KEY || process.env.SQUARE_WEBHOOK_SIGNATURE_KEY
  };

  console.log('Square config debug:', {
    hasApplicationId: !!config.SQUARE_APPLICATION_ID,
    hasApplicationSecret: !!config.SQUARE_APPLICATION_SECRET,
    hasAccessToken: !!config.SQUARE_ACCESS_TOKEN,
    hasLocationId: !!config.SQUARE_LOCATION_ID,
    hasWebhookKey: !!config.SQUARE_WEBHOOK_SIGNATURE_KEY,
    accessTokenPrefix: config.SQUARE_ACCESS_TOKEN?.substring(0, 10) + '...'
  });

  return config;
}

// Initialize Square client only when needed
function getSquareClient() {
  const config = getSquareConfig();

  if (!config.SQUARE_ACCESS_TOKEN) {
    throw new Error('Square access token is not configured');
  }

  // Initialize Square API client
  const apiClient = new ApiClient();

  // Determine environment based on access token
  const isSandbox = config.SQUARE_ACCESS_TOKEN.startsWith('EAAAl');
  apiClient.basePath = isSandbox
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';

  console.log('Square environment:', isSandbox ? 'sandbox' : 'production');
  console.log('Square base path:', apiClient.basePath);

  // Set authentication
  apiClient.authentications['oauth2'].accessToken = config.SQUARE_ACCESS_TOKEN;

  // Create API instances
  const ordersApi = new OrdersApi(apiClient);

  return {
    ordersApi,
    config,
    apiClient
  };
}

export interface BookingDetails {
  bookingId: string;
  fullName: string;
  email: string;
  visitDate: string;
  preferredTime: string;
  numberOfVisitors: number;
  totalAmount: number;
}

export interface PaymentLinkResponse {
  success: boolean;
  paymentUrl?: string;
  orderId?: string;
  error?: string;
}

/**
 * Create a Square payment link for a booking
 */
export async function createPaymentLink(booking: BookingDetails): Promise<PaymentLinkResponse> {
  try {
    console.log('Creating Square payment link for booking:', booking.bookingId);

    // Initialize Square client
    const { ordersApi, config, apiClient } = getSquareClient();

    // Validate required environment variables
    if (!config.SQUARE_ACCESS_TOKEN || !config.SQUARE_LOCATION_ID) {
      console.error('Missing Square configuration:', {
        hasAccessToken: !!config.SQUARE_ACCESS_TOKEN,
        hasLocationId: !!config.SQUARE_LOCATION_ID
      });
      return {
        success: false,
        error: 'Square payment configuration is incomplete'
      };
    }

    // Create payment link directly with order data (no need for separate order creation)

    // Now create payment link using the modern Payment Links API
    const paymentLinkRequest = {
      idempotency_key: `payment-link-${booking.bookingId}-${Date.now()}`,
      description: `Garden Visit - ${booking.visitDate} at ${booking.preferredTime}`,
      order: {
        location_id: config.SQUARE_LOCATION_ID,
        line_items: [{
          name: `Garden Visit - ${booking.visitDate} at ${booking.preferredTime}`,
          quantity: booking.numberOfVisitors.toString(),
          base_price_money: {
            amount: Math.round(booking.totalAmount / booking.numberOfVisitors * 100), // Convert to cents
            currency: 'CAD'
          }
        }]
      },
      checkout_options: {
        redirect_url: `${process.env.PUBLIC_URL || 'http://localhost:4321'}/booking-success`,
        ask_for_shipping_address: false
      }
    };

    console.log('Creating Square payment link:', JSON.stringify(paymentLinkRequest, null, 2));

    // Use direct HTTP request since the old SDK doesn't support Payment Links API
    const response = await fetch(`${apiClient.basePath}/v2/online-checkout/payment-links`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2023-10-18'
      },
      body: JSON.stringify(paymentLinkRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Square payment link creation failed:', response.status, errorText);
      throw new Error(`Payment link creation failed: ${response.status} ${errorText}`);
    }

    const paymentLinkResponse = await response.json();

    console.log('🔍 Full Square API Response:', JSON.stringify(paymentLinkResponse, null, 2));

    if (!paymentLinkResponse.payment_link?.url) {
      console.error('Failed to create Square payment link:', paymentLinkResponse);
      return {
        success: false,
        error: 'Failed to create payment link'
      };
    }

    console.log('Square payment link created successfully:', paymentLinkResponse.payment_link.url);

    // Extract order ID from related_resources (this is where Square puts the actual order ID)
    const orderId = paymentLinkResponse.related_resources?.orders?.[0]?.id || 'unknown';
    console.log('🎯 Square order ID extracted:', orderId);
    console.log('🔍 Related resources structure:', JSON.stringify(paymentLinkResponse.related_resources, null, 2));

    return {
      success: true,
      paymentUrl: paymentLinkResponse.payment_link.url,
      orderId: orderId
    };

  } catch (error) {
    console.error('Error creating Square payment link:', error);

    // Check if it's a Square API error by looking at the error structure
    if (error && typeof error === 'object' && 'statusCode' in error && 'errors' in error) {
      console.error('Square API Error:', {
        statusCode: error.statusCode,
        errors: error.errors
      });
      return {
        success: false,
        error: `Payment system error: ${error.errors?.[0]?.detail || 'Unknown error'}`
      };
    }

    return {
      success: false,
      error: 'Failed to create payment link'
    };
  }
}

/**
 * Verify Square webhook signature
 */
export function verifyWebhookSignature(body: string, signature: string, url: string): boolean {
  try {
    const config = getSquareConfig();

    if (!config.SQUARE_WEBHOOK_SIGNATURE_KEY) {
      console.error('Square webhook signature key not configured');
      return false;
    }

    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', config.SQUARE_WEBHOOK_SIGNATURE_KEY);
    hmac.update(url + body);
    const expectedSignature = hmac.digest('base64');

    return signature === expectedSignature;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Get the base URL for redirects
 */
function getBaseUrl(): string {
  // In production, use the actual domain
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // Server-side fallback
  return process.env.SITE_URL || 'http://localhost:4321';
}

/**
 * Validate Square configuration
 */
export function validateSquareConfig(): { isValid: boolean; missing: string[] } {
  const config = getSquareConfig();
  const required = {
    SQUARE_APPLICATION_ID: config.SQUARE_APPLICATION_ID,
    SQUARE_APPLICATION_SECRET: config.SQUARE_APPLICATION_SECRET,
    SQUARE_ACCESS_TOKEN: config.SQUARE_ACCESS_TOKEN,
    SQUARE_LOCATION_ID: config.SQUARE_LOCATION_ID,
    SQUARE_WEBHOOK_SIGNATURE_KEY: config.SQUARE_WEBHOOK_SIGNATURE_KEY
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key, _]) => key);

  return {
    isValid: missing.length === 0,
    missing
  };
}
