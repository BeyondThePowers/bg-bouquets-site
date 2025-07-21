import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQLDirectly() {
  console.log('🔧 Attempting to execute SQL directly...\n');

  try {
    // Try different methods to execute raw SQL
    console.log('1️⃣ Trying supabase.sql method...');
    
    // Method 1: Try .sql() if it exists
    if (typeof supabase.sql === 'function') {
      const result = await supabase.sql`
        ALTER TABLE bookings 
        ADD COLUMN IF NOT EXISTS booking_reference VARCHAR(15) NULL;
      `;
      console.log('✅ SQL executed via .sql() method:', result);
    } else {
      console.log('❌ .sql() method not available');
    }

    // Method 2: Try using rpc with a custom function
    console.log('\n2️⃣ Trying RPC method...');
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('exec_sql', { 
        query: 'ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_reference VARCHAR(15) NULL;' 
      });
    
    if (rpcError) {
      console.log('❌ RPC method failed:', rpcError.message);
    } else {
      console.log('✅ SQL executed via RPC:', rpcResult);
    }

    // Method 3: Try using the REST API directly
    console.log('\n3️⃣ Trying direct REST API...');
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({
        query: 'ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_reference VARCHAR(15) NULL;'
      })
    });

    if (response.ok) {
      const restResult = await response.json();
      console.log('✅ SQL executed via REST API:', restResult);
    } else {
      console.log('❌ REST API method failed:', response.status, response.statusText);
    }

  } catch (error) {
    console.error('❌ All methods failed:', error);
    
    console.log('\n📋 Manual SQL execution required:');
    console.log('Please copy and paste this SQL into your Supabase SQL Editor:');
    console.log('');
    console.log('-- Add booking reference column');
    console.log('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_reference VARCHAR(15) NULL;');
    console.log('');
    console.log('-- Create unique index');
    console.log('CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_booking_reference');
    console.log('ON bookings(booking_reference)');
    console.log('WHERE booking_reference IS NOT NULL;');
    console.log('');
    console.log('-- Add comment');
    console.log("COMMENT ON COLUMN bookings.booking_reference IS 'Human-readable booking reference in format BG-YYYYMMDD-XXXX for customer communication and admin reference';");
  }
}

executeSQLDirectly();
