import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixColumnSize() {
  console.log('🔧 Fixing booking_reference column size...\n');

  try {
    // Check current column info
    console.log('1️⃣ Checking current column information...');
    
    const { data: columnInfo, error: columnError } = await supabase
      .rpc('sql', { 
        query: `
          SELECT column_name, data_type, character_maximum_length 
          FROM information_schema.columns 
          WHERE table_name = 'bookings' AND column_name = 'booking_reference'
        `
      });

    if (columnError) {
      console.log('❌ Cannot check column info via RPC, will proceed with manual SQL');
    } else {
      console.log('📊 Current column info:', columnInfo);
    }

    console.log('\n📋 Please run the following SQL in your Supabase SQL Editor:');
    console.log('');
    console.log('-- Fix booking reference column size');
    console.log('ALTER TABLE bookings ALTER COLUMN booking_reference TYPE VARCHAR(16);');
    console.log('');
    console.log('-- Update comment');
    console.log("COMMENT ON COLUMN bookings.booking_reference IS 'Human-readable booking reference in format BG-YYYYMMDD-XXXX (16 characters) for customer communication and admin reference';");
    console.log('');
    console.log('-- Verify the change');
    console.log('SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = \'bookings\' AND column_name = \'booking_reference\';');
    console.log('');
    console.log('After running the SQL, run the booking reference generation script again.');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixColumnSize();
