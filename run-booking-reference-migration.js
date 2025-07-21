import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runBookingReferenceMigration() {
  console.log('🚀 Running Booking Reference Migration...\n');

  try {
    // Step 1: Check if column already exists
    console.log('1️⃣ Checking current table structure...');
    const { data: sampleBooking, error: sampleError } = await supabase
      .from('bookings')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.error('❌ Error checking table structure:', sampleError);
      return;
    }

    const hasBookingReference = sampleBooking && sampleBooking.length > 0 &&
      'booking_reference' in sampleBooking[0];

    if (hasBookingReference) {
      console.log('✅ booking_reference column already exists');
    } else {
      console.log('⚠️  booking_reference column does not exist - manual SQL execution required');
      console.log('Please run the following SQL in your Supabase SQL Editor:');
      console.log('ALTER TABLE bookings ADD COLUMN booking_reference VARCHAR(15) NULL;');
      console.log('CREATE UNIQUE INDEX idx_bookings_booking_reference ON bookings(booking_reference) WHERE booking_reference IS NOT NULL;');
      return;
    }

    // Step 2: Generate references for existing bookings using JavaScript
    console.log('\n2️⃣ Generating references for existing bookings...');

    // Get all bookings without references
    const { data: bookingsWithoutRefs, error: fetchError } = await supabase
      .from('bookings')
      .select('id, date, created_at')
      .is('booking_reference', null)
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('❌ Error fetching bookings:', fetchError);
      return;
    }

    console.log(`📊 Found ${bookingsWithoutRefs.length} bookings without references`);

    // Generate and update references
    for (const booking of bookingsWithoutRefs) {
      const reference = generateBookingReference(booking.date);

      const { error: updateError } = await supabase
        .from('bookings')
        .update({ booking_reference: reference })
        .eq('id', booking.id);

      if (updateError) {
        console.error(`❌ Error updating booking ${booking.id}:`, updateError);
      } else {
        console.log(`✅ Generated reference ${reference} for booking ${booking.id}`);
      }
    }

    // Verify the migration worked by checking for booking references
    console.log('🔍 Verifying migration results...\n');

    const { data: bookingsWithRefs, error: verifyError } = await supabase
      .from('bookings')
      .select('id, booking_reference, date, created_at')
      .order('created_at', { ascending: true })
      .limit(5);

    if (verifyError) {
      console.error('❌ Error verifying migration:', verifyError);
    } else {
      console.log('📊 Sample bookings with references:');
      bookingsWithRefs.forEach((booking, index) => {
        console.log(`  ${index + 1}. ${booking.booking_reference || 'NO_REFERENCE'} (Date: ${booking.date})`);
      });
    }

    // Check total count of bookings with references
    const { count: totalWithRefs, error: countError } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .not('booking_reference', 'is', null);

    if (!countError) {
      console.log(`\n📈 Total bookings with references: ${totalWithRefs}`);
    }

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Helper function to generate booking references
function generateBookingReference(dateString) {
  // Convert date string (YYYY-MM-DD) to YYYYMMDD format
  const dateStr = dateString.replace(/-/g, '');

  // Generate random 4-digit suffix
  const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

  // Return formatted reference
  return `BG-${dateStr}-${randomSuffix}`;
}

runBookingReferenceMigration();
