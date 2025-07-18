// src/pages/api/garden-mgmt/toggle-payment.ts
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-admin';

// Helper function to verify admin authentication
async function verifyAdminAuth(request: Request): Promise<boolean> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }

    const password = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Get admin password from settings
    const { data: settings, error } = await supabaseAdmin
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

export const POST: APIRoute = async ({ request }) => {
  try {
    // Verify admin authentication
    if (!(await verifyAdminAuth(request))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { bookingId, newStatus, adminUser } = await request.json();

    if (!bookingId || !newStatus) {
      return new Response(JSON.stringify({ 
        error: 'Booking ID and new status are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate status
    if (!['pending', 'paid'].includes(newStatus)) {
      return new Response(JSON.stringify({
        error: 'Invalid payment status'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get booking to verify it exists and is pay_on_arrival
    console.log('Fetching booking:', bookingId);
    const { data: booking, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('id, full_name, payment_method, payment_status')
      .eq('id', bookingId)
      .single();

    console.log('Fetch result:', { booking, fetchError });

    if (fetchError || !booking) {
      console.error('Booking fetch failed:', fetchError);
      return new Response(JSON.stringify({
        error: 'Booking not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Only allow payment status changes for pay_on_arrival bookings
    if (booking.payment_method !== 'pay_on_arrival') {
      return new Response(JSON.stringify({ 
        error: 'Payment status can only be modified for "pay on arrival" bookings' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update payment status
    console.log('Attempting to update payment status:', {
      bookingId,
      currentStatus: booking.payment_status,
      newStatus,
      paymentMethod: booking.payment_method
    });

    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        payment_status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .select();

    console.log('Update result:', { updateData, updateError });

    if (updateError) {
      console.error('Error updating payment status:', updateError);
      return new Response(JSON.stringify({
        error: 'Failed to update payment status',
        details: updateError.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create history entry for payment status change using shorter action type
    const actionDescription = newStatus === 'paid' ? 'Payment marked as PAID' : 'Payment marked as UNPAID';
    const { error: historyError } = await supabaseAdmin
      .from('booking_actions')
      .insert({
        booking_id: bookingId,
        action_type: 'cancellation', // Using shorter existing allowed type
        original_booking_data: {
          payment_status: booking.payment_status,
          payment_method: booking.payment_method,
          customer_name: booking.full_name
        },
        reason: `${actionDescription} - Status: ${booking.payment_status} → ${newStatus}`,
        performed_by_customer: false,
        performed_by_admin: adminUser || 'Admin',
        action_timestamp: new Date().toISOString()
      });

    if (historyError) {
      console.error('Error creating history entry:', historyError);
      // Don't fail the request if history creation fails, just log it
    }

    // Verify the update worked
    const { data: verifyData, error: verifyError } = await supabaseAdmin
      .from('bookings')
      .select('payment_status')
      .eq('id', bookingId)
      .single();

    console.log('Verification result:', { verifyData, verifyError });

    return new Response(JSON.stringify({
      success: true,
      message: `Payment status updated to ${newStatus}`,
      booking: {
        id: booking.id,
        customerName: booking.full_name,
        paymentStatus: newStatus
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Toggle payment API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
