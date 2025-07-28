// src/services/square.ts
import { ApiClient, OrdersApi, CreateOrderRequest } from 'square-connect';

// Standardized Square product configuration for consistent reporting
const SQUARE_PRODUCT_CONFIG = {
  GARDEN_VISIT: {
    name: 'Garden Visit Experience',
    category: 'Experience'
  }
} as const;

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
  numberOfBouquets: number; // Updated to use bouquet terminology
  totalAmount: number;
}

export interface PaymentLinkResponse {
  success: boolean;
  paymentUrl?: string;
  orderId?: string;
  error?: string;
}

/**
 * Create detailed booking note for Square line item
 * Prioritizes: customer name, visit date, email, booking reference
 * Format: "Key: Value | Key: Value" for easy parsing
 */
function createDetailedBookingNote(booking: BookingDetails): string {
  try {
    // Format amount as currency string
    const formattedAmount = `$${booking.totalAmount.toFixed(2)} CAD`;

    // Create comprehensive note with prioritized fields
    const note = `Visit: ${booking.visitDate} at ${booking.preferredTime} | Customer: ${booking.fullName} | Email: ${booking.email} | Bouquets: ${booking.numberOfBouquets} | Booking: ${booking.bookingId} | Amount: ${formattedAmount}`;

    // Validate length doesn't exceed Square's 500 character limit
    if (note.length > 500) {
      console.warn(`Booking note truncated for booking ${booking.bookingId} (${note.length} chars)`);
      // Fallback to essential information only
      const essentialNote = `Visit: ${booking.visitDate} | Customer: ${booking.fullName} | Email: ${booking.email} | Booking: ${booking.bookingId}`;
      return essentialNote.length > 500 ? essentialNote.substring(0, 497) + '...' : essentialNote;
    }

    return note;
  } catch (error) {
    console.error('Error creating booking note:', error);
    // Fallback to minimal note with essential cross-reference information
    return `Booking: ${booking.bookingId} | Visit: ${booking.visitDate} | Customer: ${booking.fullName}`;
  }
}

/**
 * Create a Square payment link for a booking
 */
export async function createPaymentLink(booking: BookingDetails): Promise<PaymentLinkResponse> {
  try {
    console.log('Creating Square payment link for booking:', booking.bookingId);

    const { ordersApi, config } = getSquareClient();

    if (!config.SQUARE_LOCATION_ID) {
      throw new Error('Square location ID is not configured');
    }

    console.log('Using Square location ID:', config.SQUARE_LOCATION_ID);

    // Create payment link directly with order data (no need for separate order creation)

    // Create detailed booking note for Square Dashboard cross-reference
    const bookingNote = createDetailedBookingNote(booking);

    // Now create payment link using the modern Payment Links API with standardized product name
    const paymentLinkRequest = {
      idempotency_key: `payment-link-${booking.bookingId}-${Date.now()}`,
      description: `${SQUARE_PRODUCT_CONFIG.GARDEN_VISIT.name} - ${booking.visitDate}`,
      order: {
        location_id: config.SQUARE_LOCATION_ID,
        line_items: [{
          name: SQUARE_PRODUCT_CONFIG.GARDEN_VISIT.name, // Standardized product name for consistent reporting
          quantity: booking.numberOfBouquets.toString(),
          base_price_money: {
            amount: Math.round(booking.totalAmount / booking.numberOfBouquets * 100), // Convert to cents
            currency: 'CAD'
          },
          note: bookingNote // Detailed booking information for admin cross-reference
        }]
      },
      checkout_options: {
        redirect_url: `${getBaseUrl()}/booking-success`,
        ask_for_shipping_address: false
      }
    };

    console.log('Payment link request:', JSON.stringify(paymentLinkRequest, null, 2));

    // Use the Payment Links API
    const response = await fetch(`${ordersApi.apiClient.basePath}/v2/online-checkout/payment-links`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2023-10-18'
      },
      body: JSON.stringify(paymentLinkRequest)
    });

    const responseData = await response.json();
    console.log('Square payment link response:', JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      console.error('Square API error:', responseData);
      throw new Error(`Square API error: ${responseData.errors?.[0]?.detail || 'Unknown error'}`);
    }

    if (responseData.errors && responseData.errors.length > 0) {
      console.error('Square API errors:', responseData.errors);
      throw new Error(`Square API error: ${responseData.errors[0].detail}`);
    }

    const paymentLink = responseData.payment_link;
    if (!paymentLink || !paymentLink.url) {
      throw new Error('No payment URL returned from Square');
    }

    console.log('✅ Square payment link created successfully:', paymentLink.url);

    return {
      success: true,
      paymentUrl: paymentLink.url,
      orderId: paymentLink.order_id
    };

  } catch (error) {
    console.error('❌ Error creating Square payment link:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating payment link'
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
 * Get base URL for redirects
 */
function getBaseUrl(): string {
  // Production URL
  if (process.env.URL) {
    return process.env.URL;
  }

  // Netlify deploy preview
  if (process.env.DEPLOY_PRIME_URL) {
    return process.env.DEPLOY_PRIME_URL;
  }

  // Branch deploy
  if (process.env.DEPLOY_URL) {
    return process.env.DEPLOY_URL;
  }

  // Development fallback
  return 'http://localhost:4321';
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
