// src/pages/api/add-square-columns.ts
// Temporary endpoint to add Square columns to the database
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('Adding Square columns to bookings table...');

    // Check if columns already exist by trying to select them
    const { data: testData, error: testError } = await supabase
      .from('bookings')
      .select('square_order_id, square_payment_id, payment_completed_at')
      .limit(1);

    if (!testError) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Square columns already exist in the database',
        columns: ['square_order_id', 'square_payment_id', 'payment_completed_at']
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Columns do not exist, attempting to add them...');
    console.log('Test error:', testError);

    // Try to add the columns using raw SQL
    // Note: This might not work with RLS enabled, but let's try
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE bookings 
        ADD COLUMN IF NOT EXISTS square_order_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS square_payment_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMPTZ;
      `
    });

    if (error) {
      console.error('Failed to add columns via RPC:', error);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Could not add columns automatically. Please add them manually in Supabase SQL editor.',
        sqlToRun: `
          ALTER TABLE bookings 
          ADD COLUMN IF NOT EXISTS square_order_id VARCHAR(255),
          ADD COLUMN IF NOT EXISTS square_payment_id VARCHAR(255),
          ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMPTZ;
          
          CREATE INDEX IF NOT EXISTS idx_bookings_square_order_id ON bookings(square_order_id);
          CREATE INDEX IF NOT EXISTS idx_bookings_square_payment_id ON bookings(square_payment_id);
          CREATE INDEX IF NOT EXISTS idx_bookings_payment_completed_at ON bookings(payment_completed_at);
        `,
        originalError: error
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Square columns added successfully',
      result: data
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error adding Square columns:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      sqlToRun: `
        ALTER TABLE bookings 
        ADD COLUMN IF NOT EXISTS square_order_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS square_payment_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMPTZ;
        
        CREATE INDEX IF NOT EXISTS idx_bookings_square_order_id ON bookings(square_order_id);
        CREATE INDEX IF NOT EXISTS idx_bookings_square_payment_id ON bookings(square_payment_id);
        CREATE INDEX IF NOT EXISTS idx_bookings_payment_completed_at ON bookings(payment_completed_at);
      `
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
