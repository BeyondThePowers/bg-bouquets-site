// Diagnostic endpoint to check database schema and data
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export const GET: APIRoute = async () => {
  try {
    console.log('🔍 Checking database schema and data...');

    // Check if square columns exist by trying to select them
    const { data: schemaTest, error: schemaError } = await supabaseAdmin
      .from('bookings')
      .select('id, square_order_id, square_payment_id, payment_completed_at')
      .limit(1);

    if (schemaError) {
      console.error('Schema check failed:', schemaError);
      return new Response(JSON.stringify({
        error: 'Database schema check failed',
        details: schemaError,
        suggestion: 'Run the Square migration: /api/migrate-square'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check recent pay_now bookings
    const { data: payNowBookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('id, full_name, email, payment_method, payment_status, square_order_id, square_payment_id, created_at')
      .eq('payment_method', 'pay_now')
      .order('created_at', { ascending: false })
      .limit(5);

    if (bookingsError) {
      console.error('Bookings query failed:', bookingsError);
      return new Response(JSON.stringify({
        error: 'Failed to query bookings',
        details: bookingsError
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Count bookings with missing Square data
    const { count: missingSquareData } = await supabaseAdmin
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('payment_method', 'pay_now')
      .is('square_order_id', null);

    return new Response(JSON.stringify({
      success: true,
      schemaCheck: '✅ Square columns exist',
      payNowBookings: payNowBookings || [],
      totalPayNowBookings: payNowBookings?.length || 0,
      missingSquareData: missingSquareData || 0,
      analysis: {
        hasSquareColumns: true,
        recentBookings: payNowBookings?.map(b => ({
          id: b.id,
          email: b.email,
          hasSquareOrderId: !!b.square_order_id,
          hasSquarePaymentId: !!b.square_payment_id,
          paymentStatus: b.payment_status,
          createdAt: b.created_at
        })) || []
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Database check error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      suggestion: 'Check your Supabase configuration and run migrations'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
