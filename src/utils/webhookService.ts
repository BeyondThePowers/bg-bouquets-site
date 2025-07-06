/**
 * Webhook Service for Make.com Integration
 * Handles sending booking confirmations and error notifications
 */

// Webhook configuration for easy future modifications
// Consolidated to 2 scenarios for Make.com free plan (2 scenario limit)
const WEBHOOK_CONFIG = {
  booking_confirmed: 'MAKE_BOOKING_WEBHOOK_URL',        // Scenario 1: Confirmations + Errors
  booking_error: 'MAKE_BOOKING_WEBHOOK_URL',            // Scenario 1: Confirmations + Errors
  booking_cancelled: 'MAKE_CANCELLATION_WEBHOOK_URL',   // Scenario 2: Cancellations + Reschedules + Admin
  booking_rescheduled: 'MAKE_CANCELLATION_WEBHOOK_URL', // Scenario 2: Cancellations + Reschedules + Admin
  booking_cancelled_admin: 'MAKE_CANCELLATION_WEBHOOK_URL' // Scenario 2: Cancellations + Reschedules + Admin
} as const;

// Helper function to get webhook URL for event type
function getWebhookUrl(eventType: keyof typeof WEBHOOK_CONFIG): string | undefined {
  const envVarName = WEBHOOK_CONFIG[eventType];
  // In server-side contexts (like Netlify Functions), non-PUBLIC_ env vars are only available via process.env
  return process.env[envVarName] || import.meta.env[envVarName];
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

interface WebhookPayload {
  event: string;
  booking: {
    id: string;
    customer: {
      name: string;
      email: string;
      phone: string;
    };
    visit: {
      date: string;
      time: string;
      visitors: number;
      amount: number;
    };
    payment: {
      method: string;
      status: string;
    };
    metadata: {
      createdAt: string;
      source: string;
    };
  };
}

interface ErrorPayload {
  event: string;
  booking: {
    id: string;
    customer: {
      name: string;
      email: string;
    };
    visit: {
      date: string;
      time: string;
    };
  };
  error: {
    message: string;
    type: string;
  };
  timestamp: string;
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

  // Determine payment status and details
  const isPaymentCompleted = bookingData.paymentMethod === 'pay_now' &&
    (bookingData.paymentCompletedAt || bookingData.squarePaymentId);

  const payload: WebhookPayload = {
    event: 'booking_confirmed',
    booking: {
      id: bookingData.id,
      customer: {
        name: bookingData.fullName,
        email: bookingData.email,
        phone: bookingData.phone,
      },
      visit: {
        date: bookingData.visitDate,
        time: bookingData.preferredTime,
        visitors: bookingData.numberOfVisitors,
        amount: bookingData.totalAmount,
        bouquets: bookingData.numberOfVisitors, // Each visitor gets one bouquet
      },
      payment: {
        method: bookingData.paymentMethod,
        status: isPaymentCompleted ? 'completed' : 'pending',
        // Include Square payment details if available
        ...(bookingData.squareOrderId && { squareOrderId: bookingData.squareOrderId }),
        ...(bookingData.squarePaymentId && { squarePaymentId: bookingData.squarePaymentId }),
        ...(bookingData.paymentCompletedAt && { completedAt: bookingData.paymentCompletedAt }),
        ...(bookingData.paymentDetails && { details: bookingData.paymentDetails }),
      },
      metadata: {
        createdAt: bookingData.createdAt || new Date().toISOString(),
        source: 'website',
        cancellationToken: cancellationToken,
      },
    },
  };

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
    console.error('MAKE_ERROR_WEBHOOK_URL not configured');
    return false;
  }

  const payload: ErrorPayload = {
    event: 'booking_error',
    booking: {
      id: bookingData.id,
      customer: {
        name: bookingData.fullName,
        email: bookingData.email,
      },
      visit: {
        date: bookingData.visitDate,
        time: bookingData.preferredTime,
      },
    },
    error: {
      message: errorInfo.message,
      type: errorInfo.type,
    },
    timestamp: new Date().toISOString(),
  };

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
    console.error('MAKE_CANCELLATION_WEBHOOK_URL not configured');
    return false;
  }

  const payload = {
    event: 'booking_cancelled',
    booking: {
      id: cancellationData.id,
      customer: {
        name: cancellationData.fullName,
        email: cancellationData.email,
        phone: cancellationData.phone,
      },
      visit: {
        date: cancellationData.visitDate,
        time: cancellationData.preferredTime,
        visitors: cancellationData.numberOfVisitors,
        amount: cancellationData.totalAmount,
      },
      payment: {
        method: cancellationData.paymentMethod,
        status: 'cancelled',
      },
      cancellation: {
        reason: cancellationData.cancellationReason || 'No reason provided',
        cancelledAt: new Date().toISOString(),
      },
      metadata: {
        source: 'website',
        emailType: 'customer_cancellation_confirmation',
        cancellationToken: cancellationData.cancellationToken,
      },
    },
  };

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
    console.error('MAKE_ERROR_WEBHOOK_URL not configured');
    return false;
  }

  const payload = {
    event: 'booking_cancelled_admin',
    booking: {
      id: cancellationData.id,
      customer: {
        name: cancellationData.fullName,
        email: cancellationData.email,
        phone: cancellationData.phone,
      },
      visit: {
        date: cancellationData.visitDate,
        time: cancellationData.preferredTime,
        visitors: cancellationData.numberOfVisitors,
        amount: cancellationData.totalAmount,
      },
      payment: {
        method: cancellationData.paymentMethod,
        status: 'cancelled',
      },
      cancellation: {
        reason: cancellationData.cancellationReason || 'No reason provided',
        cancelledAt: new Date().toISOString(),
      },
      metadata: {
        source: 'website',
        emailType: 'admin_cancellation_notification',
        adminEmail: process.env.ADMIN_EMAIL || import.meta.env.ADMIN_EMAIL,
        cancellationToken: cancellationData.cancellationToken,
      },
    },
  };

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
    console.error('MAKE_RESCHEDULE_WEBHOOK_URL not configured');
    return false;
  }

  const payload = {
    event: 'booking_rescheduled',
    booking: {
      id: rescheduleData.id,
      customer: {
        name: rescheduleData.fullName,
        email: rescheduleData.email,
        phone: rescheduleData.phone,
      },
      original: {
        date: rescheduleData.originalDate,
        time: rescheduleData.originalTime,
      },
      new: {
        date: rescheduleData.visitDate,
        time: rescheduleData.preferredTime,
        visitors: rescheduleData.numberOfVisitors,
        amount: rescheduleData.totalAmount,
      },
      payment: {
        method: rescheduleData.paymentMethod,
        status: 'confirmed',
      },
      reschedule: {
        reason: rescheduleData.rescheduleReason || 'No reason provided',
        rescheduledAt: new Date().toISOString(),
      },
      metadata: {
        source: 'website',
        emailType: 'booking_updated',
        cancellationToken: rescheduleData.cancellationToken,
      },
    },
  };

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
