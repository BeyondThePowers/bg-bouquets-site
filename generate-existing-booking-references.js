import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to generate booking references
function generateBookingReference(dateString) {
  // Convert date string (YYYY-MM-DD) to YYYYMMDD format
  const dateStr = dateString.replace(/-/g, '');
  
  // Generate random 4-digit suffix
  const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  // Return formatted reference
  return `BG-${dateStr}-${randomSuffix}`;
}

async function generateExistingBookingReferences() {
  console.log('🚀 Generating Booking References for Existing Bookings...\n');

  try {
    // Step 1: Check if booking_reference column exists
    console.log('1️⃣ Checking if booking_reference column exists...');
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

    if (!hasBookingReference) {
      console.log('❌ booking_reference column does not exist');
      console.log('\n📋 Please run the following SQL in your Supabase SQL Editor first:');
      console.log('');
      console.log('-- Add booking reference column');
      console.log('ALTER TABLE bookings ADD COLUMN booking_reference VARCHAR(15) NULL;');
      console.log('');
      console.log('-- Create unique index');
      console.log('CREATE UNIQUE INDEX idx_bookings_booking_reference ON bookings(booking_reference) WHERE booking_reference IS NOT NULL;');
      console.log('');
      console.log('Then run this script again.');
      return;
    }

    console.log('✅ booking_reference column exists');

    // Step 2: Get all bookings without references
    console.log('\n2️⃣ Finding bookings without references...');
    
    const { data: bookingsWithoutRefs, error: fetchError } = await supabase
      .from('bookings')
      .select('id, date, created_at, full_name')
      .is('booking_reference', null)
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('❌ Error fetching bookings:', fetchError);
      return;
    }

    console.log(`📊 Found ${bookingsWithoutRefs.length} bookings without references`);

    if (bookingsWithoutRefs.length === 0) {
      console.log('✅ All bookings already have references');
      
      // Show some examples
      const { data: existingRefs, error: existingError } = await supabase
        .from('bookings')
        .select('booking_reference, full_name, date')
        .not('booking_reference', 'is', null)
        .limit(5);

      if (!existingError && existingRefs.length > 0) {
        console.log('\n📋 Sample existing references:');
        existingRefs.forEach((booking, index) => {
          console.log(`  ${index + 1}. ${booking.booking_reference} - ${booking.full_name} (${booking.date})`);
        });
      }
      return;
    }

    // Step 3: Generate and update references
    console.log('\n3️⃣ Generating references for existing bookings...');
    
    let successCount = 0;
    let errorCount = 0;
    const results = [];

    for (const booking of bookingsWithoutRefs) {
      let attempts = 0;
      let success = false;
      
      // Try up to 5 times to generate a unique reference
      while (attempts < 5 && !success) {
        const reference = generateBookingReference(booking.date);
        
        try {
          const { error: updateError } = await supabase
            .from('bookings')
            .update({ booking_reference: reference })
            .eq('id', booking.id);

          if (updateError) {
            if (updateError.code === '23505') { // Unique constraint violation
              attempts++;
              console.log(`⚠️  Reference collision for ${booking.full_name}, retrying... (attempt ${attempts})`);
            } else {
              console.error(`❌ Error updating booking ${booking.id}:`, updateError);
              errorCount++;
              results.push({
                id: booking.id,
                name: booking.full_name,
                date: booking.date,
                reference: null,
                success: false,
                error: updateError.message
              });
              break;
            }
          } else {
            console.log(`✅ Generated reference ${reference} for ${booking.full_name} (${booking.date})`);
            successCount++;
            results.push({
              id: booking.id,
              name: booking.full_name,
              date: booking.date,
              reference: reference,
              success: true
            });
            success = true;
          }
        } catch (err) {
          console.error(`❌ Exception updating booking ${booking.id}:`, err);
          errorCount++;
          results.push({
            id: booking.id,
            name: booking.full_name,
            date: booking.date,
            reference: null,
            success: false,
            error: err.message
          });
          break;
        }
      }

      if (!success && attempts >= 5) {
        console.error(`❌ Failed to generate unique reference for booking ${booking.id} after 5 attempts`);
        errorCount++;
        results.push({
          id: booking.id,
          name: booking.full_name,
          date: booking.date,
          reference: null,
          success: false,
          error: 'Failed to generate unique reference after 5 attempts'
        });
      }
    }

    console.log(`\n📈 Summary: ${successCount} successful, ${errorCount} errors`);

    // Step 4: Verify the results
    console.log('\n4️⃣ Verifying results...');

    const { data: bookingsWithRefs, error: verifyError } = await supabase
      .from('bookings')
      .select('id, booking_reference, date, full_name, created_at')
      .not('booking_reference', 'is', null)
      .order('created_at', { ascending: true })
      .limit(10);

    if (verifyError) {
      console.error('❌ Error verifying results:', verifyError);
    } else {
      console.log('📊 Sample bookings with references:');
      bookingsWithRefs.forEach((booking, index) => {
        console.log(`  ${index + 1}. ${booking.booking_reference} - ${booking.full_name} (${booking.date})`);
      });
    }

    // Check total count
    const { count: totalWithRefs, error: countError } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .not('booking_reference', 'is', null);

    const { count: totalBookings, error: totalError } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true });

    if (!countError && !totalError) {
      console.log(`\n📈 Total bookings with references: ${totalWithRefs} / ${totalBookings}`);
    }

    // Show any errors
    if (errorCount > 0) {
      console.log('\n❌ Errors encountered:');
      results.filter(r => !r.success).forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.name} (${result.date}): ${result.error}`);
      });
    }

    console.log('\n✅ Booking reference generation completed!');

  } catch (error) {
    console.error('❌ Script failed:', error);
  }
}

generateExistingBookingReferences();
