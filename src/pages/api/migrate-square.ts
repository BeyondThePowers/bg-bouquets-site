// src/pages/api/migrate-square.ts
// Temporary API endpoint to run Square integration migration
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('Running Square integration migration...');

    // Add Square-specific columns to bookings table
    const migrations = [
      `ALTER TABLE bookings 
       ADD COLUMN IF NOT EXISTS square_order_id VARCHAR(255) NULL,
       ADD COLUMN IF NOT EXISTS square_payment_id VARCHAR(255) NULL,
       ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMPTZ NULL;`,
      
      `CREATE INDEX IF NOT EXISTS idx_bookings_square_order_id ON bookings(square_order_id);`,
      `CREATE INDEX IF NOT EXISTS idx_bookings_square_payment_id ON bookings(square_payment_id);`,
      `CREATE INDEX IF NOT EXISTS idx_bookings_payment_completed_at ON bookings(payment_completed_at);`,
      
      `UPDATE bookings 
       SET payment_completed_at = created_at 
       WHERE payment_status = 'paid' AND payment_completed_at IS NULL;`
    ];

    const results = [];
    
    for (const migration of migrations) {
      try {
        console.log('Executing:', migration);
        const { data, error } = await supabase.rpc('exec_sql', { sql: migration });
        
        if (error) {
          console.error('Migration error:', error);
          results.push({ sql: migration, success: false, error: error.message });
        } else {
          console.log('Migration successful');
          results.push({ sql: migration, success: true });
        }
      } catch (err) {
        console.error('Migration exception:', err);
        results.push({ sql: migration, success: false, error: err.message });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Migration completed',
      results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Migration API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
