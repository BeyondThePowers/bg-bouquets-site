import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkBookingsSchema() {
  console.log('🔍 Checking current bookings table schema...\n');

  try {
    // Get a sample booking to see current columns
    const { data: sampleBooking, error: sampleError } = await supabase
      .from('bookings')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.error('Error fetching sample booking:', sampleError);
      return;
    }

    if (sampleBooking && sampleBooking.length > 0) {
      console.log('📋 Current bookings table columns:');
      const columns = Object.keys(sampleBooking[0]);
      columns.forEach((col, index) => {
        console.log(`  ${index + 1}. ${col}`);
      });
      
      console.log('\n📊 Sample booking data:');
      console.log(JSON.stringify(sampleBooking[0], null, 2));
    } else {
      console.log('📋 No bookings found in the table');
      
      // Try to get table structure from information_schema
      const { data: schemaInfo, error: schemaError } = await supabase
        .rpc('get_table_columns', { table_name: 'bookings' });
      
      if (schemaError) {
        console.log('Could not get schema info:', schemaError);
      } else {
        console.log('Table schema from information_schema:', schemaInfo);
      }
    }

    // Check if there's already a booking reference column
    const hasBookingRef = sampleBooking && sampleBooking.length > 0 && 
      Object.keys(sampleBooking[0]).some(col => 
        col.includes('reference') || col.includes('booking_ref') || col.includes('booking_number')
      );

    console.log(`\n🔍 Has booking reference column: ${hasBookingRef ? 'YES' : 'NO'}`);

    // Get total booking count
    const { count, error: countError } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`📈 Total bookings in database: ${count}`);
    }

  } catch (error) {
    console.error('Error checking schema:', error);
  }
}

checkBookingsSchema();
