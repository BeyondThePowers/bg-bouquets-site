/**
 * Webhook Service for Make.com Integration
 * Handles sending booking confirmations and error notifications
 */

// Webhook configuration for easy future modifications
// CONSOLIDATED: All events now route to single Make.com scenario (MAKE_BOOKING_WEBHOOK_URL)
// This allows for unified scenario management with event-based filtering
const WEBHOOK_CONFIG = {
  booking_confirmed: 'MAKE_BOOKING_WEBHOOK_URL',        // All events → Single scenario
  booking_error: 'MAKE_BOOKING_WEBHOOK_URL',            // All events → Single scenario
  booking_cancelled: 'MAKE_BOOKING_WEBHOOK_URL',        // All events → Single scenario
  booking_rescheduled: 'MAKE_BOOKING_WEBHOOK_URL',      // All events → Single scenario
  booking_cancelled_admin: 'MAKE_BOOKING_WEBHOOK_URL'   // All events → Single scenario
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
function createStandardizedPayload(
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
        visitors: bookingData.numberOfVisitors || null,
        amount: bookingData.totalAmount || null,
        ...(eventType === 'booking_confirmed' && { bouquets: bookingData.numberOfVisitors }),
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
          visitors: bookingData.numberOfVisitors,
          amount: bookingData.totalAmount,
        }
      }),
      ...(cancellationReason && {
        cancellation: {
          reason: cancellationReason,
          cancelledAt: new Date().toISOString(),
        }
      }),
      ...(rescheduleReason && {
        reschedule: {
          reason: rescheduleReason,
          rescheduledAt: new Date().toISOString(),
        }
      }),
      ...(errorInfo && {
        error: {
          message: errorInfo.message,
          type: errorInfo.type,
        }
      }),
      metadata: {
        createdAt: bookingData.createdAt || new Date().toISOString(),
        source: 'website',
        ...(emailType && { emailType }),
        ...(cancellationToken && { cancellationToken }),
        ...(eventType === 'booking_cancelled_admin' && {
          adminEmail: process.env.ADMIN_EMAIL || import.meta.env.ADMIN_EMAIL
        }),
        ...(errorInfo && { timestamp: new Date().toISOString() }),
      },
    },
  };

  return basePayload;
}

interface BookingData {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  visitDate: string;
  preferredTime: string;
  numberOfVisitors: number;
  totalAmount: number;
  paymentMethod: string;
  createdAt?: string;
  // Square payment integration fields
  squareOrderId?: string;
  squarePaymentId?: string;
  paymentCompletedAt?: string;
  paymentDetails?: {
    payment_id?: string;
    amount_money?: { amount: number; currency: string };
    status?: string;
  };
}

interface CancellationData extends BookingData {
  cancellationReason?: string;
  cancellationToken?: string;
}

interface RescheduleData extends BookingData {
  originalDate: string;
  originalTime: string;
  rescheduleReason?: string;
  cancellationToken?: string;
}

/**
 * Standardized webhook payload structure for all event types
 * All fields are included in every payload with null values when not applicable
 * This ensures consistent data structure across all Make.com scenarios
 */
interface StandardizedWebhookPayload {
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
      visitors: number | null;
      amount: number | null;
      bouquets?: number | null; // Only for booking confirmations
    };
    payment: {
      method: string | null;
      status: string;
      // Square payment details (only for online payments)
      squareOrderId?: string | null;
      squarePaymentId?: string | null;
      completedAt?: string | null;
      details?: {
        payment_id?: string;
        amount_money?: { amount: number; currency: string };
        status?: string;
      } | null;
    };
    // Original booking details (only for reschedules)
    original?: {
      date: string;
      time: string;
    } | null;
    // New booking details (only for reschedules)
    new?: {
      date: string;
      time: string;
      visitors: number;
      amount: number;
    } | null;
    // Cancellation details (only for cancellations)
    cancellation?: {
      reason: string;
      cancelledAt: string;
    } | null;
    // Reschedule details (only for reschedules)
    reschedule?: {
      reason: string;
      rescheduledAt: string;
    } | null;
    // Error details (only for error events)
    error?: {
      message: string;
      type: string;
    } | null;
    metadata: {
      createdAt: string | null;
      source: string;
      emailType?: string | null;
      cancellationToken?: string | null;
      adminEmail?: string | null;
      timestamp?: string | null; // For error events
    };
  };
}

/**
 * Send booking confirmation webhook to Make.com
 */
export async function sendBookingConfirmation(bookingData: BookingData, cancellationToken?: string): Promise<boolean> {
  const webhookUrl = getWebhookUrl('booking_confirmed');

  if (!webhookUrl) {
    console.error('MAKE_BOOKING_WEBHOOK_URL not configured');
    return false;
  }

  const payload = createStandardizedPayload('booking_confirmed', bookingData, {
    cancellationToken,
  });

  try {
    console.log('Sending booking confirmation webhook:', payload.booking.id);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Webhook failed with status: ${response.status}`);
    }

    console.log('Booking confirmation webhook sent successfully');
    return true;
  } catch (error) {
    console.error('Failed to send booking confirmation webhook:', error);
    
    // Send error notification
    await sendErrorNotification(bookingData, {
      message: error instanceof Error ? error.message : 'Unknown webhook error',
      type: 'webhook_failure',
    });
    
    return false;
  }
}

/**
 * Send error notification webhook to Make.com
 */
export async function sendErrorNotification(
  bookingData: BookingData,
  errorInfo: { message: string; type: string }
): Promise<boolean> {
  const webhookUrl = getWebhookUrl('booking_error');

  if (!webhookUrl) {
    console.error('MAKE_BOOKING_WEBHOOK_URL not configured');
    return false;
  }

  const payload = createStandardizedPayload('booking_error', bookingData, {
    errorInfo,
  });

  try {
    console.log('Sending error notification webhook:', payload.booking.id);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Error webhook failed with status: ${response.status}`);
    }

    console.log('Error notification webhook sent successfully');
    return true;
  } catch (error) {
    console.error('Failed to send error notification webhook:', error);
    // Don't create infinite loop - just log the error
    return false;
  }
}

/**
 * Send webhook with retry logic
 */
export async function sendWebhookWithRetry(
  webhookFunction: () => Promise<boolean>,
  maxRetries: number = 3,
  retryDelay: number = 2000
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const success = await webhookFunction();
      if (success) {
        return true;
      }
    } catch (error) {
      console.error(`Webhook attempt ${attempt} failed:`, error);
    }

    if (attempt < maxRetries) {
      console.log(`Retrying webhook in ${retryDelay}ms... (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      retryDelay *= 1.5; // Exponential backoff
    }
  }

  console.error(`All ${maxRetries} webhook attempts failed`);
  return false;
}

/**
 * Send cancellation confirmation webhook to Make.com (for customer)
 */
export async function sendCancellationConfirmation(cancellationData: CancellationData): Promise<boolean> {
  const webhookUrl = getWebhookUrl('booking_cancelled');

  if (!webhookUrl) {
    console.error('MAKE_BOOKING_WEBHOOK_URL not configured');
    return false;
  }

  const payload = createStandardizedPayload('booking_cancelled', cancellationData, {
    cancellationReason: cancellationData.cancellationReason || 'No reason provided',
    cancellationToken: cancellationData.cancellationToken,
    emailType: 'customer_cancellation_confirmation',
  });

  try {
    console.log('Sending cancellation confirmation webhook:', payload.booking.id);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Cancellation webhook failed with status: ${response.status}`);
    }

    console.log('Cancellation confirmation webhook sent successfully');
    return true;
  } catch (error) {
    console.error('Failed to send cancellation confirmation webhook:', error);
    return false;
  }
}

/**
 * Send cancellation notification webhook to Make.com (for admin)
 */
export async function sendCancellationNotification(cancellationData: CancellationData): Promise<boolean> {
  const webhookUrl = getWebhookUrl('booking_cancelled_admin');

  if (!webhookUrl) {
    console.error('MAKE_BOOKING_WEBHOOK_URL not configured');
    return false;
  }

  const payload = createStandardizedPayload('booking_cancelled_admin', cancellationData, {
    cancellationReason: cancellationData.cancellationReason || 'No reason provided',
    cancellationToken: cancellationData.cancellationToken,
    emailType: 'admin_cancellation_notification',
  });

  try {
    console.log('Sending admin cancellation notification webhook:', payload.booking.id);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Admin cancellation webhook failed with status: ${response.status}`);
    }

    console.log('Admin cancellation notification webhook sent successfully');
    return true;
  } catch (error) {
    console.error('Failed to send admin cancellation notification webhook:', error);
    return false;
  }
}

/**
 * Send reschedule confirmation webhook to Make.com
 */
export async function sendRescheduleConfirmation(rescheduleData: RescheduleData): Promise<boolean> {
  const webhookUrl = getWebhookUrl('booking_rescheduled');

  if (!webhookUrl) {
    console.error('MAKE_BOOKING_WEBHOOK_URL not configured');
    return false;
  }

  const payload = createStandardizedPayload('booking_rescheduled', rescheduleData, {
    originalDate: rescheduleData.originalDate,
    originalTime: rescheduleData.originalTime,
    rescheduleReason: rescheduleData.rescheduleReason || 'No reason provided',
    cancellationToken: rescheduleData.cancellationToken,
    emailType: 'booking_updated',
  });

  try {
    console.log('Sending reschedule confirmation webhook:', payload.booking.id);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Reschedule webhook failed with status: ${response.status}`);
    }

    console.log('Reschedule confirmation webhook sent successfully');
    return true;
  } catch (error) {
    console.error('Failed to send reschedule confirmation webhook:', error);
    return false;
  }
}

/**
 * Log webhook attempt to database (for tracking)
 */
export async function logWebhookAttempt(
  bookingId: string,
  webhookType: 'confirmation' | 'error' | 'cancellation' | 'reschedule',
  success: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    // This could be expanded to log to database if needed
    const logEntry = {
      bookingId,
      webhookType,
      success,
      errorMessage,
      timestamp: new Date().toISOString(),
    };

    console.log('Webhook attempt logged:', logEntry);

    // TODO: Optionally save to database for tracking
    // await supabase.from('webhook_logs').insert(logEntry);
  } catch (error) {
    console.error('Failed to log webhook attempt:', error);
  }
}
