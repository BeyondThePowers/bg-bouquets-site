// src/pages/api/garden-mgmt/cancel-booking.ts
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { sendCancellationConfirmation, sendCancellationNotification } from '../../../services/webhook';

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
    const { bookingId, reason, adminUser, notifyCustomer = true } = body;

    // Validate required fields
    if (!bookingId || !adminUser) {
      return new Response(JSON.stringify({ 
        error: 'Booking ID and admin user are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get booking details first for cancellation token
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('cancellation_token, full_name, email, phone, date, time, number_of_visitors, total_amount, payment_method, status')
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
        error: 'Booking is already cancelled' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Admin cancelling booking:', { bookingId, adminUser, reason });

    // Call the database function to cancel booking (with admin flag)
    const { data, error } = await supabase.rpc('cancel_booking', {
      p_cancellation_token: booking.cancellation_token,
      p_cancellation_reason: reason || 'Cancelled by admin',
      p_customer_ip: clientAddress || null,
      p_admin_user: adminUser
    });

    console.log('Admin cancellation result:', { data, error });

    if (error) {
      console.error('Database error during admin cancellation:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to process cancellation. Please try again.' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if cancellation was successful
    const result = data?.[0];
    if (!result?.success) {
      return new Response(JSON.stringify({ 
        error: result?.message || 'Cancellation failed' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const bookingData = result.booking_data;
    console.log('Admin booking cancelled successfully:', bookingData);

    // Send cancellation emails if requested (async, don't block response)
    if (notifyCustomer && bookingData) {
      // Prepare booking data for webhooks
      const webhookData = {
        id: bookingData.id,
        fullName: bookingData.full_name,
        email: bookingData.email,
        phone: bookingData.phone,
        visitDate: bookingData.date,
        preferredTime: bookingData.time,
        numberOfVisitors: bookingData.number_of_visitors,
        totalAmount: bookingData.total_amount,
        paymentMethod: bookingData.payment_method
      };

      // Send confirmation to customer
      sendCancellationConfirmation(
        webhookData,
        `Cancelled by admin: ${reason || 'No reason provided'}`,
        bookingData.cancellation_token
      ).catch(error => {
        console.error('Failed to send customer cancellation confirmation:', error);
      });

      // Send notification to admin
      sendCancellationNotification(
        webhookData,
        `Admin cancellation by ${adminUser}: ${reason || 'No reason provided'}`,
        bookingData.cancellation_token
      ).catch(error => {
        console.error('Failed to send admin cancellation notification:', error);
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Booking cancelled successfully by admin',
      booking: {
        id: bookingData.id,
        customerName: bookingData.full_name,
        date: bookingData.date,
        time: bookingData.time,
        visitors: bookingData.number_of_visitors
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Admin cancellation API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error. Please try again.' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
