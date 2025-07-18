/**
 * Webhook Service for Make.com Integration
 * Handles sending booking confirmations and error notifications
 */

// Webhook configuration for easy future modifications
// CONSOLIDATED: Booking events route to MAKE_BOOKING_WEBHOOK_URL
// Contact forms route to dedicated MAKE_CONTACT_WEBHOOK_URL
const WEBHOOK_CONFIG = {
  booking_confirmed: 'MAKE_BOOKING_WEBHOOK_URL',        // Booking events → Booking scenario
  booking_error: 'MAKE_BOOKING_WEBHOOK_URL',            // Booking events → Booking scenario
  booking_cancelled: 'MAKE_BOOKING_WEBHOOK_URL',        // Booking events → Booking scenario
  booking_rescheduled: 'MAKE_BOOKING_WEBHOOK_URL',      // Booking events → Booking scenario
  booking_cancelled_admin: 'MAKE_BOOKING_WEBHOOK_URL',  // Booking events → Booking scenario
  contact_message: 'MAKE_BOOKING_WEBHOOK_URL',          // Legacy - will be deprecated
  contact_form: 'MAKE_CONTACT_WEBHOOK_URL'              // Contact forms → Contact scenario
} as const;

// Helper function to get webhook URL for event type
function getWebhookUrl(eventType: keyof typeof WEBHOOK_CONFIG): string | undefined {
  const envVarName = WEBHOOK_CONFIG[eventType];
  // In server-side contexts (like Netlify Functions), non-PUBLIC_ env vars are only available via process.env
  return process.env[envVarName] || import.meta.env[envVarName];
}

/**
 * Create standardized webhook payload with all possible fields
 * This ensures consistent data structure across all Make.com scenarios
 */
export function createStandardizedPayload(
  eventType: string,
  bookingData: BookingData,
  options: {
    cancellationToken?: string;
    cancellationReason?: string;
    rescheduleReason?: string;
    originalDate?: string;
    originalTime?: string;
    errorInfo?: { message: string; type: string };
    emailType?: string;
  } = {}
): StandardizedWebhookPayload {
  const {
    cancellationToken,
    cancellationReason,
    rescheduleReason,
    originalDate,
    originalTime,
    errorInfo,
    emailType
  } = options;

  // Determine payment status and details
  const isPaymentCompleted = bookingData.paymentMethod === 'pay_now' &&
    (bookingData.paymentCompletedAt || bookingData.squarePaymentId);

  const basePayload: StandardizedWebhookPayload = {
    event: eventType,
    booking: {
      id: bookingData.id,
      customer: {
        name: bookingData.fullName,
        email: bookingData.email,
        phone: bookingData.phone || null,
      },
      visit: {
        date: bookingData.visitDate,
        time: bookingData.preferredTime,
        bouquets: bookingData.numberOfVisitors || null, // Primary field using bouquet terminology
        visitors: bookingData.numberOfVisitors || null, // Deprecated: kept for backward compatibility
        visitorPasses: bookingData.numberOfVisitorPasses || null, // New field for visitor passes
        amount: bookingData.totalAmount || null,
      },
      payment: {
        method: bookingData.paymentMethod || null,
        status: eventType.includes('cancelled') ? 'cancelled' :
                eventType === 'booking_rescheduled' ? 'confirmed' :
                isPaymentCompleted ? 'completed' : 'pending',
        // Include Square payment details if available
        ...(bookingData.squareOrderId && { squareOrderId: bookingData.squareOrderId }),
        ...(bookingData.squarePaymentId && { squarePaymentId: bookingData.squarePaymentId }),
        ...(bookingData.paymentCompletedAt && { completedAt: bookingData.paymentCompletedAt }),
        ...(bookingData.paymentDetails && { details: bookingData.paymentDetails }),
      },
      // Add event-specific sections
      ...(originalDate && originalTime && {
        original: { date: originalDate, time: originalTime }
      }),
      ...(eventType === 'booking_rescheduled' && {
        new: {
          date: bookingData.visitDate,
          time: bookingData.preferredTime,
          bouquets: bookingData.numberOfVisitors, // Primary field using bouquet terminology
          visitors: bookingData.numberOfVisitors, // Deprecated: kept for backward compatibility
          visitorPasses: bookingData.numberOfVisitorPasses || null, // New field for visitor passes
          amount: bookingData.totalAmount,
        }
      }),
      ...(cancellationReason && {
        cancellation: {
          reason: cancellationReason,
          token: cancellationToken || null,
        }
      }),
      ...(rescheduleReason && {
        reschedule: {
          reason: rescheduleReason,
        }
      }),
      ...(errorInfo && {
        error: errorInfo
      }),
    },
    // Add metadata
    metadata: {
      timestamp: new Date().toISOString(),
      source: 'bg-bouquet-garden',
      version: '2.0',
      ...(emailType && { emailType }),
    }
  };

  return basePayload;
}

// Type definitions
export interface BookingData {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  visitDate: string;
  preferredTime: string;
  numberOfVisitors?: number;
  numberOfVisitorPasses?: number;
  totalAmount?: number;
  paymentMethod?: string;
  paymentCompletedAt?: string;
  squareOrderId?: string;
  squarePaymentId?: string;
  paymentDetails?: any;
}

export interface StandardizedWebhookPayload {
  event: string;
  booking: {
    id: string;
    customer: {
      name: string;
      email: string;
      phone: string | null;
    };
    visit: {
      date: string;
      time: string;
      bouquets: number | null;
      visitors: number | null;
      visitorPasses: number | null;
      amount: number | null;
    };
    payment: {
      method: string | null;
      status: string;
      squareOrderId?: string;
      squarePaymentId?: string;
      completedAt?: string;
      details?: any;
    };
    original?: {
      date: string;
      time: string;
    };
    new?: {
      date: string;
      time: string;
      bouquets: number;
      visitors: number;
      visitorPasses: number | null;
      amount: number;
    };
    cancellation?: {
      reason: string;
      token: string | null;
    };
    reschedule?: {
      reason: string;
    };
    error?: {
      message: string;
      type: string;
    };
  };
  metadata: {
    timestamp: string;
    source: string;
    version: string;
    emailType?: string;
  };
}

export interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  message: string;
  subject?: string;
  type?: string;
}

/**
 * Send webhook with retry logic and proper error handling
 */
export async function sendWebhookWithRetry(
  eventType: keyof typeof WEBHOOK_CONFIG,
  payload: any,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<{ success: boolean; error?: string; attempts: number }> {
  const webhookUrl = getWebhookUrl(eventType);
  
  if (!webhookUrl) {
    console.warn(`⚠️ No webhook URL configured for event type: ${eventType}`);
    return { success: false, error: 'No webhook URL configured', attempts: 0 };
  }

  let lastError: string = '';
  let attempts = 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    attempts = attempt;
    
    try {
      console.log(`📤 Sending webhook (attempt ${attempt}/${maxRetries}) to ${eventType}:`, webhookUrl);
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'BG-Bouquet-Garden/1.0'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        console.log(`✅ Webhook sent successfully on attempt ${attempt}`);
        await logWebhookAttempt(eventType, payload, true, null, attempt);
        return { success: true, attempts };
      } else {
        const errorText = await response.text();
        lastError = `HTTP ${response.status}: ${errorText}`;
        console.error(`❌ Webhook attempt ${attempt} failed:`, lastError);
        await logWebhookAttempt(eventType, payload, false, lastError, attempt);
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Webhook attempt ${attempt} failed:`, lastError);
      await logWebhookAttempt(eventType, payload, false, lastError, attempt);
    }

    // Wait before retrying (except on last attempt)
    if (attempt < maxRetries) {
      console.log(`⏳ Waiting ${retryDelay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      retryDelay *= 2; // Exponential backoff
    }
  }

  console.error(`❌ All webhook attempts failed. Last error: ${lastError}`);
  return { success: false, error: lastError, attempts };
}

/**
 * Send booking confirmation webhook to Make.com
 */
export async function sendBookingConfirmation(bookingData: BookingData, cancellationToken?: string): Promise<boolean> {
  const payload = createStandardizedPayload('booking_confirmed', bookingData, {
    cancellationToken,
  });

  const result = await sendWebhookWithRetry('booking_confirmed', payload);

  if (!result.success) {
    // Send error notification
    await sendErrorNotification(bookingData, {
      message: result.error || 'Unknown webhook error',
      type: 'webhook_failure',
    });
  }

  return result.success;
}

/**
 * Send error notification webhook
 */
export async function sendErrorNotification(bookingData: BookingData, errorInfo: { message: string; type: string }): Promise<boolean> {
  const payload = createStandardizedPayload('booking_error', bookingData, {
    errorInfo,
  });

  const result = await sendWebhookWithRetry('booking_error', payload);
  return result.success;
}

/**
 * Send cancellation confirmation webhook
 */
export async function sendCancellationConfirmation(
  bookingData: BookingData,
  cancellationReason: string,
  cancellationToken?: string
): Promise<boolean> {
  const payload = createStandardizedPayload('booking_cancelled', bookingData, {
    cancellationReason,
    cancellationToken,
  });

  const result = await sendWebhookWithRetry('booking_cancelled', payload);
  return result.success;
}

/**
 * Send cancellation notification to admin
 */
export async function sendCancellationNotification(
  bookingData: BookingData,
  cancellationReason: string,
  cancellationToken?: string
): Promise<boolean> {
  const payload = createStandardizedPayload('booking_cancelled_admin', bookingData, {
    cancellationReason,
    cancellationToken,
  });

  const result = await sendWebhookWithRetry('booking_cancelled_admin', payload);
  return result.success;
}

/**
 * Send reschedule confirmation webhook
 */
export async function sendRescheduleConfirmation(
  bookingData: BookingData,
  originalDate: string,
  originalTime: string,
  rescheduleReason?: string
): Promise<boolean> {
  const payload = createStandardizedPayload('booking_rescheduled', bookingData, {
    originalDate,
    originalTime,
    rescheduleReason,
  });

  const result = await sendWebhookWithRetry('booking_rescheduled', payload);
  return result.success;
}

/**
 * Send contact form message webhook
 */
export async function sendContactFormMessage(contactData: ContactFormData): Promise<boolean> {
  const payload = {
    event: 'contact_form',
    contact: {
      name: contactData.name,
      email: contactData.email,
      phone: contactData.phone || null,
      message: contactData.message,
      subject: contactData.subject || null,
      type: contactData.type || 'general',
    },
    metadata: {
      timestamp: new Date().toISOString(),
      source: 'bg-bouquet-garden',
      version: '2.0',
    }
  };

  const result = await sendWebhookWithRetry('contact_form', payload);
  return result.success;
}

/**
 * Log webhook attempt for debugging
 */
export async function logWebhookAttempt(
  eventType: string,
  payload: any,
  success: boolean,
  error: string | null,
  attempt: number
): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    eventType,
    success,
    error,
    attempt,
    bookingId: payload.booking?.id || 'unknown',
  };

  // In production, you might want to log this to a database or external service
  console.log('Webhook attempt log:', logEntry);
}
