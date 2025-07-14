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
    const status = url.searchParams.get('status') || 'confirmed'; // Default to confirmed (active) bookings
    const period = url.searchParams.get('period') || 'today'; // today, week, month, all
    const payment = url.searchParams.get('payment') || 'all'; // all, pay_on_arrival, online
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const search = url.searchParams.get('search');
    const customStartDate = url.searchParams.get('startDate');
    const customEndDate = url.searchParams.get('endDate');

    // Helper function to get date ranges in Mountain Time
    function getDateRange(period: string) {
      const now = new Date();
      // Convert to Mountain Time (UTC-7 in summer, UTC-6 in winter)
      const mtOffset = now.getTimezoneOffset() + (7 * 60); // Assuming MST for simplicity
      const mtNow = new Date(now.getTime() - (mtOffset * 60 * 1000));

      const today = mtNow.toISOString().split('T')[0];

      switch (period) {
        case 'today':
          return { start: today, end: today };
        case 'week':
          const weekStart = new Date(mtNow);
          weekStart.setDate(mtNow.getDate() - mtNow.getDay()); // Start of week (Sunday)
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)
          return {
            start: weekStart.toISOString().split('T')[0],
            end: weekEnd.toISOString().split('T')[0]
          };
        case 'month':
          const monthStart = new Date(mtNow.getFullYear(), mtNow.getMonth(), 1);
          const monthEnd = new Date(mtNow.getFullYear(), mtNow.getMonth() + 1, 0);
          return {
            start: monthStart.toISOString().split('T')[0],
            end: monthEnd.toISOString().split('T')[0]
          };
        default: // 'all'
          return null;
      }
    }

    // Build query
    let query = supabase
      .from('admin_booking_view')
      .select('*')
      .order('date', { ascending: true }) // Order by date for better dashboard view
      .order('time', { ascending: true })
      .range(offset, offset + limit - 1);

    // Apply status filter
    if (status !== 'all') {
      if (status === 'confirmed') {
        query = query.eq('status', 'confirmed');
      } else if (status === 'cancelled') {
        query = query.eq('status', 'cancelled');
      }
    }

    // Apply date range filter
    let dateRange = null;

    // Use custom date range if provided, otherwise use period-based range
    if (customStartDate && customEndDate) {
      dateRange = { start: customStartDate, end: customEndDate };
    } else {
      dateRange = getDateRange(period);
    }

    if (dateRange) {
      query = query.gte('date', dateRange.start).lte('date', dateRange.end);
    }

    // Apply payment method filter
    if (payment !== 'all') {
      if (payment === 'pay_on_arrival') {
        query = query.eq('payment_method', 'pay_on_arrival');
      } else if (payment === 'online') {
        query = query.eq('payment_method', 'pay_now');
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

    // Get total count for pagination and summary statistics
    let countQuery = supabase
      .from('admin_booking_view')
      .select('*', { count: 'exact', head: true });

    let summaryQuery = supabase
      .from('admin_booking_view')
      .select('payment_status, total_amount, status');

    // Apply same filters to count and summary queries
    if (status !== 'all') {
      if (status === 'confirmed') {
        countQuery = countQuery.eq('status', 'confirmed');
        summaryQuery = summaryQuery.eq('status', 'confirmed');
      } else if (status === 'cancelled') {
        countQuery = countQuery.eq('status', 'cancelled');
        summaryQuery = summaryQuery.eq('status', 'cancelled');
      }
    }

    // Use the same date range logic for count and summary queries
    if (customStartDate && customEndDate) {
      const customRange = { start: customStartDate, end: customEndDate };
      countQuery = countQuery.gte('date', customRange.start).lte('date', customRange.end);
      summaryQuery = summaryQuery.gte('date', customRange.start).lte('date', customRange.end);
    } else if (dateRange) {
      countQuery = countQuery.gte('date', dateRange.start).lte('date', dateRange.end);
      summaryQuery = summaryQuery.gte('date', dateRange.start).lte('date', dateRange.end);
    }

    if (payment !== 'all') {
      if (payment === 'pay_on_arrival') {
        countQuery = countQuery.eq('payment_method', 'pay_on_arrival');
        summaryQuery = summaryQuery.eq('payment_method', 'pay_on_arrival');
      } else if (payment === 'online') {
        countQuery = countQuery.eq('payment_method', 'pay_now');
        summaryQuery = summaryQuery.eq('payment_method', 'pay_now');
      }
    }

    if (search) {
      countQuery = countQuery.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
      summaryQuery = summaryQuery.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const [{ count, error: countError }, { data: summaryData, error: summaryError }] = await Promise.all([
      countQuery,
      summaryQuery
    ]);

    if (countError) {
      console.error('Error counting bookings:', countError);
    }

    if (summaryError) {
      console.error('Error fetching summary data:', summaryError);
    }

    // Calculate summary statistics
    const summary = {
      total: count || 0,
      pending: 0,
      paid: 0,
      revenue: 0
    };

    if (summaryData) {
      summary.pending = summaryData.filter(b => b.payment_status === 'pending').length;
      summary.paid = summaryData.filter(b => b.payment_status === 'paid').length;
      summary.revenue = summaryData
        .filter(b => b.payment_status === 'paid')
        .reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0);
    }

    return new Response(JSON.stringify({
      bookings: bookings || [],
      total: count || 0,
      limit,
      offset,
      summary
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
