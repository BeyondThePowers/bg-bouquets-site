import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase-admin';

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

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    console.log('🔍 Test cancel booking API called');
    
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    console.log('🔐 Admin auth result:', authResult);
    
    if (!authResult) {
      console.log('❌ Admin authentication failed');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Admin authenticated, parsing request body...');
    const body = await request.json();
    const { bookingId, reason, adminUser, notifyCustomer = true } = body;
    console.log('📝 Request data:', { bookingId, reason, adminUser, notifyCustomer });

    // Validate required fields
    if (!bookingId || !adminUser) {
      console.log('❌ Missing required fields');
      return new Response(JSON.stringify({ 
        error: 'Booking ID and admin user are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get booking details first for cancellation token
    console.log('🔍 Looking up booking with ID:', bookingId);
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('cancellation_token, full_name, email, phone, date, time, number_of_visitors, total_amount, payment_method, status')
      .eq('id', bookingId)
      .single();

    console.log('📊 Booking lookup result:', { booking, bookingError });

    if (bookingError || !booking) {
      console.log('❌ Booking not found or error:', bookingError);
      return new Response(JSON.stringify({ 
        error: 'Booking not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (booking.status === 'cancelled') {
      console.log('❌ Booking already cancelled');
      return new Response(JSON.stringify({ 
        error: 'Booking is already cancelled' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Booking found, would proceed with cancellation');
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Test successful - booking found and ready for cancellation',
      booking: {
        id: bookingId,
        customerName: booking.full_name,
        date: booking.date,
        time: booking.time,
        status: booking.status
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Test cancel booking error:', error);
    return new Response(JSON.stringify({ 
      error: 'Server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
