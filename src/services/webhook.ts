/**
 * Webhook Service for Make.com Integration
 *
 * This service handles all webhook communications with Make.com scenarios,
 * providing standardized payload formats, retry logic, and consistent error handling.
 *
 * The service implements a consolidated approach where:
 * - All booking-related events route to a single Make.com scenario (MAKE_BOOKING_WEBHOOK_URL)
 * - Contact form submissions route to a dedicated scenario (MAKE_CONTACT_WEBHOOK_URL)
 *
 * Each webhook function includes internal logging via the logWebhookAttempt function,
 * which eliminates the need for redundant logging in API endpoints.
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
 * Creates a standardized webhook payload with all possible fields
 *
 * This function ensures consistent data structure across all Make.com scenarios by
 * generating a unified payload format with appropriate sections based on the event type.
 *
 * @param eventType - The type of event being sent (e.g., 'booking_confirmed')
 * @param bookingData - The booking data object containing all booking details
 * @param options - Optional parameters specific to the event type:
 *   - cancellationToken: Token used for cancellation verification
 *   - cancellationReason: Reason for cancellation
 *   - rescheduleReason: Reason for rescheduling
 *   - originalDate: Original booking date (for reschedule events)
 *   - originalTime: Original booking time (for reschedule events)
 *   - errorInfo: Error details for error notifications
 *   - emailType: Type of email notification to send
 * @returns A standardized webhook payload object ready to be sent to Make.com
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
        // Always include Square payment details (null when not applicable)
        squareOrderId: bookingData.squareOrderId || null,
        squarePaymentId: bookingData.squarePaymentId || null,
        completedAt: bookingData.paymentCompletedAt || null,
        details: bookingData.paymentDetails || null,
      },
      // Add event-specific sections
      ...(originalDate && originalTime && {
        original: { date: originalDate, time: originalTime }
      }),
      ...(eventType === 'booking_rescheduled' && {
        new: {
          date: bookingData.visitDate,
          time: bookingData.preferredTime,
          bouquets: bookingData.numberOfVisitors ?? 0, // Primary field using bouquet terminology
          visitors: bookingData.numberOfVisitors ?? 0, // Deprecated: kept for backward compatibility
          visitorPasses: bookingData.numberOfVisitorPasses || null, // New field for visitor passes
          amount: bookingData.totalAmount ?? 0,
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
      ...(cancellationToken && { cancellationToken }),
    }
  };

  return basePayload;
}

/**
 * Prepares booking data for webhook delivery from API endpoint data
 *
 * This helper function standardizes the way booking data is prepared for webhooks
 * across different API endpoints, ensuring consistent data format.
 *
 * @param booking - The booking data from the database
 * @returns A properly formatted BookingData object ready for webhook delivery
 */
export function prepareBookingWebhookData(booking: any): BookingData {
  return {
    id: booking.id,
    fullName: booking.full_name || booking.fullName,
    email: booking.email,
    phone: booking.phone,
    visitDate: booking.visit_date || booking.visitDate,
    preferredTime: booking.preferred_time || booking.preferredTime,
    numberOfVisitors: booking.number_of_visitors || booking.numberOfVisitors,
    numberOfVisitorPasses: booking.number_of_visitor_passes || booking.numberOfVisitorPasses,
    totalAmount: booking.total_amount || booking.totalAmount,
    paymentMethod: booking.payment_method || booking.paymentMethod,
    paymentCompletedAt: booking.payment_completed_at || booking.paymentCompletedAt,
    squareOrderId: booking.square_order_id || booking.squareOrderId,
    squarePaymentId: booking.square_payment_id || booking.squarePaymentId,
    paymentDetails: booking.payment_details || booking.paymentDetails
  };
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
      squareOrderId: string | null;
      squarePaymentId: string | null;
      completedAt: string | null;
      details: any | null;
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

/**
 * Prepares contact form data for webhook delivery from API endpoint data
 *
 * This helper function standardizes the way contact form data is prepared
 * for webhooks across different API endpoints.
 *
 * @param formData - The form submission data
 * @param type - The type of contact form ('general_contact' or 'flower_request')
 * @returns A properly formatted ContactFormData object ready for webhook delivery
 */
export function prepareContactFormData(formData: any, type: 'general_contact' | 'flower_request'): ContactFormData {
  return {
    id: formData.id,
    name: formData.name || formData.fullName,
    email: formData.email,
    phone: formData.phone,
    message: formData.message,
    subject: formData.subject,
    type: type,
    flower: type === 'flower_request' ? formData.flower : undefined,
    notes: formData.notes,
    createdAt: formData.createdAt || new Date().toISOString()
  };
}

export interface ContactFormData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  subject?: string;
  type: 'general_contact' | 'flower_request';
  // Flower-specific fields
  flower?: string;
  notes?: string;
  createdAt: string;
}

/**
 * Sends a webhook with retry logic and proper error handling
 *
 * This function handles the actual delivery of webhook payloads to Make.com,
 * with built-in retry logic, error handling, and logging.
 *
 * @param eventType - The type of event being sent (must match a key in WEBHOOK_CONFIG)
 * @param payload - The payload data to send
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param retryDelay - Initial delay between retries in ms (default: 1000, doubles each retry)
 * @returns Object containing success status, error message (if any), and number of attempts made
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
 * Sends a booking confirmation webhook to Make.com
 *
 * This function creates and sends a standardized booking confirmation payload.
 * If the webhook fails after all retries, it automatically sends an error notification.
 *
 * @param bookingData - The booking data object containing all booking details
 * @param cancellationTokenOrOptions - Either a string token (legacy) or an options object
 * @returns A promise resolving to a boolean indicating success or failure
 *
 * @example Legacy usage:
 * ```
 * sendBookingConfirmation(bookingData, 'abc123');
 * ```
 *
 * @example Options object usage:
 * ```
 * sendBookingConfirmation(bookingData, { cancellationToken: 'abc123' });
 * ```
 */
export async function sendBookingConfirmation(
  bookingData: BookingData,
  cancellationTokenOrOptions?: string | { cancellationToken?: string }
): Promise<boolean> {
  // Support both old and new parameter patterns
  let options: { cancellationToken?: string } = {};
  
  if (typeof cancellationTokenOrOptions === 'string') {
    // Legacy parameter pattern
    options.cancellationToken = cancellationTokenOrOptions;
  } else if (cancellationTokenOrOptions) {
    // New options object pattern
    options = cancellationTokenOrOptions;
  }
  
  const payload = createStandardizedPayload('booking_confirmed', bookingData, options);

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
 * Sends an error notification webhook to Make.com
 *
 * This function creates and sends a standardized error notification payload.
 *
 * @param bookingData - The booking data object containing all booking details
 * @param errorInfo - Object containing error details:
 *   - message: Error message
 *   - type: Error type (e.g., 'payment_failed', 'webhook_failure')
 * @returns A promise resolving to a boolean indicating success or failure
 */
export async function sendErrorNotification(bookingData: BookingData, errorInfo: { message: string; type: string }): Promise<boolean> {
  const payload = createStandardizedPayload('booking_error', bookingData, {
    errorInfo,
  });

  const result = await sendWebhookWithRetry('booking_error', payload);
  return result.success;
}

/**
 * Sends a cancellation confirmation webhook to Make.com
 *
 * This function creates and sends a standardized cancellation confirmation payload
 * to notify customers of booking cancellations.
 *
 * @param bookingData - The booking data object containing all booking details
 * @param cancellationReasonOrOptions - Either a string reason for cancellation (legacy)
 *   or an options object with cancellationReason and optional cancellationToken
 * @param cancellationToken - Optional token used for cancellation verification (legacy parameter)
 * @returns A promise resolving to a boolean indicating success or failure
 *
 * @example Legacy usage:
 * ```
 * sendCancellationConfirmation(bookingData, 'Customer requested cancellation', 'abc123');
 * ```
 *
 * @example Options object usage:
 * ```
 * sendCancellationConfirmation(bookingData, {
 *   cancellationReason: 'Customer requested cancellation',
 *   cancellationToken: 'abc123'
 * });
 * ```
 */
export async function sendCancellationConfirmation(
  bookingData: BookingData,
  cancellationReasonOrOptions: string | {
    cancellationReason: string;
    cancellationToken?: string;
  },
  cancellationToken?: string
): Promise<boolean> {
  // Support both old and new parameter patterns
  let options: { cancellationReason: string; cancellationToken?: string };
  
  if (typeof cancellationReasonOrOptions === 'string') {
    // Legacy parameter pattern
    options = {
      cancellationReason: cancellationReasonOrOptions,
      cancellationToken
    };
  } else {
    // New options object pattern
    options = cancellationReasonOrOptions;
  }
  
  const payload = createStandardizedPayload('booking_cancelled', bookingData, options);

  const result = await sendWebhookWithRetry('booking_cancelled', payload);
  return result.success;
}

/**
 * Sends a cancellation notification to admin via Make.com
 *
 * This function creates and sends a standardized cancellation notification payload
 * to notify administrators of booking cancellations.
 *
 * @param bookingData - The booking data object containing all booking details
 * @param cancellationReasonOrOptions - Either a string reason for cancellation (legacy)
 *   or an options object with cancellationReason and optional cancellationToken
 * @param cancellationToken - Optional token used for cancellation verification (legacy parameter)
 * @returns A promise resolving to a boolean indicating success or failure
 *
 * @example Legacy usage:
 * ```
 * sendCancellationNotification(bookingData, 'Admin cancelled due to weather', 'abc123');
 * ```
 *
 * @example Options object usage:
 * ```
 * sendCancellationNotification(bookingData, {
 *   cancellationReason: 'Admin cancelled due to weather',
 *   cancellationToken: 'abc123'
 * });
 * ```
 */
export async function sendCancellationNotification(
  bookingData: BookingData,
  cancellationReasonOrOptions: string | {
    cancellationReason: string;
    cancellationToken?: string;
  },
  cancellationToken?: string
): Promise<boolean> {
  // Support both old and new parameter patterns
  let options: { cancellationReason: string; cancellationToken?: string };
  
  if (typeof cancellationReasonOrOptions === 'string') {
    // Legacy parameter pattern
    options = {
      cancellationReason: cancellationReasonOrOptions,
      cancellationToken
    };
  } else {
    // New options object pattern
    options = cancellationReasonOrOptions;
  }
  
  const payload = createStandardizedPayload('booking_cancelled_admin', bookingData, options);

  const result = await sendWebhookWithRetry('booking_cancelled_admin', payload);
  return result.success;
}

/**
 * Sends a reschedule confirmation webhook to Make.com
 *
 * This function creates and sends a standardized reschedule confirmation payload
 * to notify customers of booking reschedules.
 *
 * @param bookingData - The booking data object containing all booking details
 * @param originalDateOrOptions - Either the original date (legacy) or an options object
 * @param originalTime - The original time of the booking before rescheduling (legacy)
 * @param rescheduleReason - Optional reason for rescheduling (legacy)
 * @param cancellationToken - Optional token used for cancellation verification (legacy)
 * @returns A promise resolving to a boolean indicating success or failure
 *
 * @example Legacy usage:
 * ```
 * sendRescheduleConfirmation(bookingData, '2023-01-01', '10:00 AM', 'Customer requested', 'abc123');
 * ```
 *
 * @example Options object usage:
 * ```
 * sendRescheduleConfirmation(bookingData, {
 *   originalDate: '2023-01-01',
 *   originalTime: '10:00 AM',
 *   rescheduleReason: 'Customer requested',
 *   cancellationToken: 'abc123'
 * });
 * ```
 */
export async function sendRescheduleConfirmation(
  bookingData: BookingData,
  originalDateOrOptions: string | {
    originalDate: string;
    originalTime: string;
    rescheduleReason?: string;
    cancellationToken?: string;
  },
  originalTime?: string,
  rescheduleReason?: string,
  cancellationToken?: string
): Promise<boolean> {
  // Support both old and new parameter patterns
  let options: {
    originalDate: string;
    originalTime: string;
    rescheduleReason?: string;
    cancellationToken?: string;
  };
  
  if (typeof originalDateOrOptions === 'string') {
    // Legacy parameter pattern
    options = {
      originalDate: originalDateOrOptions,
      originalTime: originalTime!, // We know this is provided in legacy calls
      rescheduleReason,
      cancellationToken
    };
  } else {
    // New options object pattern
    options = originalDateOrOptions;
  }
  
  const payload = createStandardizedPayload('booking_rescheduled', bookingData, options);

  const result = await sendWebhookWithRetry('booking_rescheduled', payload);
  return result.success;
}

/**
 * Sends a unified contact form message webhook to Make.com
 *
 * This function handles both general contact forms and flower requests,
 * creating and sending a standardized contact form payload.
 *
 * @param contactData - The contact form data containing all submission details
 * @returns A promise resolving to a boolean indicating success or failure
 */
export async function sendContactFormMessage(contactData: ContactFormData): Promise<boolean> {
  const payload = {
    event: 'contact_form',
    contact: {
      id: contactData.id,
      type: contactData.type,
      customer: {
        name: contactData.name,
        email: contactData.email,
        phone: contactData.phone || null,
      },
      message: {
        subject: contactData.subject || null,
        content: contactData.message,
        // Flower-specific fields (null for general contact forms)
        flower: contactData.flower || null,
        notes: contactData.notes || null,
      },
      metadata: {
        timestamp: contactData.createdAt,
        source: 'bg-bouquet-garden',
        version: '2.0',
        formType: contactData.type,
      }
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
