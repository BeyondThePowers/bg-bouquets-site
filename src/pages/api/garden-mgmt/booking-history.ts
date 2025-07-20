// src/pages/api/garden-mgmt/booking-history.ts
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-admin';

// Helper function to provide default reasons for actions
function getDefaultReasonForAction(actionType: string): string {
  switch (actionType) {
    case 'created':
      return 'Booking created';
    case 'modified':
      return 'Booking details updated';
    case 'cancelled':
      return 'Booking cancelled';
    case 'rescheduled':
      return 'Booking rescheduled';
    case 'payment_updated':
      return 'Payment status updated';
    case 'status_changed':
      return 'Booking status changed';
    case 'refund_processed':
      return 'Refund processed';
    case 'admin_action':
      return 'Admin action performed';
    default:
      return 'Action performed';
  }
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

export const GET: APIRoute = async ({ request, url }) => {
  try {
    // Verify admin authentication
    if (!(await verifyAdminAuth(request))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const bookingId = url.searchParams.get('bookingId');

    if (!bookingId) {
      return new Response(JSON.stringify({ 
        error: 'Booking ID is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get booking details with comprehensive audit trail
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('admin_booking_history')
      .select('*')
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

    // Get comprehensive audit trail from new audit logging system
    const { data: auditLogs, error: auditError } = await supabaseAdmin
      .from('booking_audit_log')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true });

    if (auditError) {
      console.error('Error fetching audit logs:', auditError);
      return new Response(JSON.stringify({
        error: 'Failed to fetch booking history'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Format audit logs for frontend consumption
    const formattedActions = (auditLogs || []).map(log => ({
      id: log.id,
      booking_id: log.booking_id,
      action_type: log.action_type,
      action_timestamp: log.created_at,
      reason: log.reason || getDefaultReasonForAction(log.action_type),
      performed_by_customer: log.performed_by === 'customer',
      performed_by_admin: log.performed_by === 'admin' ? log.performed_by_id : null,
      performed_by: log.performed_by,
      performed_by_id: log.performed_by_id,
      ip_address: log.ip_address,
      user_agent: log.user_agent,
      old_values: log.old_values,
      new_values: log.new_values,
      // Legacy fields for backward compatibility
      original_booking_data: log.old_values || {
        customer_name: booking.full_name,
        email: booking.email,
        date: booking.date,
        time: booking.time
      },
      // Extract reschedule info if available
      original_date: log.old_values?.date,
      original_time: log.old_values?.time,
      new_date: log.new_values?.date,
      new_time: log.new_values?.time
    }));

    return new Response(JSON.stringify({
      booking: {
        id: booking.id,
        customerName: booking.full_name,
        email: booking.email,
        currentDate: booking.date,
        currentTime: booking.time,
        status: booking.status,
        createdAt: booking.created_at,
        version: booking.version,
        totalActions: booking.total_actions || formattedActions.length
      },
      actions: formattedActions,
      auditTrail: booking.audit_trail || [] // Full audit trail from view
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Booking history API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
