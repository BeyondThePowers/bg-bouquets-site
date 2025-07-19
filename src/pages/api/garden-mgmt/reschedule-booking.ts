// src/pages/api/garden-mgmt/reschedule-booking.ts
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { sendRescheduleConfirmation, logWebhookAttempt } from '../../../services/webhook';

// Business timezone helper - Alberta, Canada (Mountain Time)
function getBusinessToday(): string {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Edmonton'
  }); // Returns YYYY-MM-DD format
}

// Helper function to verify admin authentication
async function verifyAdminAuth(request: Request): Promise<boolean> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }

    const password = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Get admin password from settings
    const { data: settings, error } = await supabase
      .from('schedule_settings')
      .select('setting_value')
      .eq('setting_key', 'admin_password')
      .single();

    if (error || !settings) {
      return false;
    }

    // Handle password format
    let adminPassword = settings.setting_value;
    if (typeof adminPassword === 'string' && adminPassword.startsWith('"') && adminPassword.endsWith('"')) {
      adminPassword = adminPassword.slice(1, -1);
    }

    return password === adminPassword;
  } catch (error) {
    console.error('Admin auth verification error:', error);
    return false;
  }
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    // Verify admin authentication
    if (!(await verifyAdminAuth(request))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { bookingId, newDate, newTime, reason, adminUser, notifyCustomer = true } = body;

    // Validate required fields
    if (!bookingId || !newDate || !newTime || !adminUser) {
      return new Response(JSON.stringify({ 
        error: 'Booking ID, new date, new time, and admin user are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(newDate)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid date format. Use YYYY-MM-DD' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate new date is not in the past (using business timezone)
    const businessToday = getBusinessToday();
    if (newDate < businessToday) {
      return new Response(JSON.stringify({ 
        error: 'Cannot reschedule to past dates' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get booking details first
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, cancellation_token, status, full_name, email')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ 
        error: 'Booking not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (booking.status === 'cancelled') {
      return new Response(JSON.stringify({ 
        error: 'Cannot reschedule cancelled booking' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Admin rescheduling booking:', { bookingId, adminUser, newDate, newTime });

    // Call the database function to reschedule booking
    const { data, error } = await supabase.rpc('reschedule_booking', {
      p_cancellation_token: booking.cancellation_token,
      p_new_date: newDate,
      p_new_time: newTime,
      p_reschedule_reason: reason || `Rescheduled by admin: ${adminUser}`,
      p_customer_ip: clientAddress || null
    });

    console.log('Admin reschedule result:', { data, error });

    if (error) {
      console.error('Database error during admin reschedule:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to process reschedule. Please try again.' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if reschedule was successful
    const result = data?.[0];
    if (!result?.success) {
      return new Response(JSON.stringify({ 
        error: result?.message || 'Reschedule failed' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const bookingData = result.booking_data;
    console.log('Booking rescheduled successfully by admin:', bookingData);

    // Send reschedule confirmation email if requested (async, don't block response)
    if (notifyCustomer && bookingData) {
      // Prepare data for webhook
      const webhookData = {
        id: bookingData.id,
        fullName: bookingData.full_name,
        email: bookingData.email,
        phone: bookingData.phone,
        visitDate: bookingData.new_date,
        preferredTime: bookingData.new_time,
        numberOfVisitors: bookingData.number_of_visitors,
        totalAmount: bookingData.total_amount,
        paymentMethod: bookingData.payment_method,
        originalDate: bookingData.original_date,
        originalTime: bookingData.original_time,
        rescheduleReason: `Rescheduled by admin: ${reason || 'No reason provided'}`,
        cancellationToken: bookingData.cancellation_token
      };

      // Send reschedule confirmation webhook
      sendRescheduleConfirmation(
        webhookData,
        webhookData.originalDate,
        webhookData.originalTime,
        `Rescheduled by admin: ${reason || 'No reason provided'}`,
        bookingData.cancellation_token
      ).then(success => {
        if (success) {
          console.log('✅ Admin reschedule webhook sent successfully');
        } else {
          console.error('❌ Failed to send admin reschedule webhook');
        }
      }).catch(error => {
        console.error('Admin reschedule webhook sending failed:', error);
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Booking rescheduled successfully by ${adminUser}. ${notifyCustomer ? 'Customer will receive confirmation email.' : 'No email sent to customer.'}`,
      booking: {
        id: bookingData.id,
        customerName: bookingData.full_name,
        originalDate: bookingData.original_date,
        originalTime: bookingData.original_time,
        newDate: bookingData.new_date,
        newTime: bookingData.new_time,
        visitors: bookingData.number_of_visitors,
        amount: bookingData.total_amount
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Admin reschedule API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error. Please try again.' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
