// src/pages/api/garden-mgmt/booking-history.ts
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

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

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, full_name, email, date, time, status, created_at')
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

    // Get booking action history
    const { data: actions, error: actionsError } = await supabase
      .from('booking_actions')
      .select('*')
      .eq('booking_id', bookingId)
      .order('action_timestamp', { ascending: true });

    if (actionsError) {
      console.error('Error fetching booking actions:', actionsError);
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch booking history' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Always include booking creation as the first history entry
    const allActions = [];

    // Add creation event as first entry
    allActions.push({
      id: 'creation',
      booking_id: booking.id,
      action_type: 'booking_created',
      action_timestamp: booking.created_at,
      reason: 'Booking created',
      performed_by_customer: true,
      performed_by_admin: null,
      original_booking_data: {
        customer_name: booking.full_name,
        email: booking.email,
        date: booking.date,
        time: booking.time
      }
    });

    // Add any additional actions
    if (actions && actions.length > 0) {
      allActions.push(...actions);
    }

    return new Response(JSON.stringify({
      booking: {
        id: booking.id,
        customerName: booking.full_name,
        email: booking.email,
        currentDate: booking.date,
        currentTime: booking.time,
        status: booking.status,
        createdAt: booking.created_at
      },
      actions: allActions
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
