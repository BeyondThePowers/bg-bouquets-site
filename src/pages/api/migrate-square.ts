// src/pages/api/migrate-square.ts
// Temporary API endpoint to run Square integration migration
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-admin';

async function runMigration() {
  try {
    console.log('Checking Square integration migration status...');

    const results = [];

    // Check if Square columns exist
    try {
      const { data: testData, error: testError } = await supabaseAdmin
        .from('bookings')
        .select('id, square_order_id, square_payment_id, payment_completed_at')
        .limit(1);

      if (testError && testError.code === '42703') {
        // Columns don't exist
        results.push({
          check: 'square_columns',
          success: false,
          error: 'Square columns do not exist',
          action_required: 'Run the SQL migration manually'
        });
      } else if (testError) {
        // Other error
        results.push({
          check: 'square_columns',
          success: false,
          error: testError.message
        });
      } else {
        // Columns exist
        results.push({
          check: 'square_columns',
          success: true,
          message: 'Square columns exist'
        });
      }
    } catch (err) {
      results.push({
        check: 'square_columns',
        success: false,
        error: err.message
      });
    }

    // Check existing data
    try {
      const { data: bookings, error: bookingsError } = await supabaseAdmin
        .from('bookings')
        .select('id, payment_method, payment_status, square_order_id, square_payment_id')
        .eq('payment_method', 'pay_now')
        .limit(10);

      if (bookingsError) {
        results.push({
          check: 'existing_data',
          success: false,
          error: bookingsError.message
        });
      } else {
        const withSquareOrderId = bookings?.filter(b => b.square_order_id) || [];
        const withSquarePaymentId = bookings?.filter(b => b.square_payment_id) || [];

        results.push({
          check: 'existing_data',
          success: true,
          total_pay_now_bookings: bookings?.length || 0,
          with_square_order_id: withSquareOrderId.length,
          with_square_payment_id: withSquarePaymentId.length
        });
      }
    } catch (err) {
      results.push({
        check: 'existing_data',
        success: false,
        error: err.message
      });
    }

    const allChecksSuccessful = results.every(r => r.success);

    return {
      success: allChecksSuccessful,
      message: allChecksSuccessful ? 'Migration checks passed' : 'Migration required',
      results,
      manual_migration_required: !allChecksSuccessful,
      sql_file: 'database/square-migration.sql'
    };

  } catch (error) {
    console.error('Migration API error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export const GET: APIRoute = async () => {
  const result = await runMigration();
  return new Response(JSON.stringify(result), {
    status: result.success ? 200 : 500,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request }) => {
  const result = await runMigration();
  return new Response(JSON.stringify(result), {
    status: result.success ? 200 : 500,
    headers: { 'Content-Type': 'application/json' }
  });
};
