// src/pages/api/garden-mgmt/bookings.ts
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

    // Get admin password from settings (same pattern as existing auth)
    const { data: settings, error } = await supabase
      .from('schedule_settings')
      .select('setting_value')
      .eq('setting_key', 'admin_password')
      .single();

    if (error || !settings) {
      return false;
    }

    // Handle password format (same logic as existing verify-password.ts)
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

    // Parse query parameters
    const status = url.searchParams.get('status') || 'all'; // all, confirmed, cancelled
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const search = url.searchParams.get('search');

    // Build query
    let query = supabase
      .from('admin_booking_view')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status !== 'all') {
      if (status === 'confirmed') {
        query = query.eq('status', 'confirmed');
      } else if (status === 'cancelled') {
        query = query.eq('status', 'cancelled');
      }
    }

    // Apply search filter
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: bookings, error } = await query;

    if (error) {
      console.error('Error fetching bookings:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fix booking status logic - should only be 'active' or 'cancelled', not 'refunded'
    if (bookings) {
      bookings.forEach(booking => {
        booking.booking_status = booking.status === 'cancelled' ? 'cancelled' : 'active';
      });
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('admin_booking_view')
      .select('*', { count: 'exact', head: true });

    if (status !== 'all') {
      if (status === 'confirmed') {
        countQuery = countQuery.eq('status', 'confirmed');
      } else if (status === 'cancelled') {
        countQuery = countQuery.eq('status', 'cancelled');
      }
    }

    if (search) {
      countQuery = countQuery.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error counting bookings:', countError);
    }

    return new Response(JSON.stringify({
      bookings: bookings || [],
      total: count || 0,
      limit,
      offset
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Admin bookings API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
