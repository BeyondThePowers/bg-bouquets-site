/**
 * BLUEBELL GARDENS - BOOKING DATA RESET SCRIPT (JavaScript/API Version)
 * 
 * This script safely removes all booking-related data using Supabase API calls.
 * Use this if you prefer API-based deletion over direct SQL execution.
 * 
 * Usage:
 * 1. Set your Supabase credentials in environment variables
 * 2. Run: node scripts/reset-booking-data.js
 * 3. Or import and call resetBookingData() function
 */

import { createClient } from '@supabase/supabase-js';

// Configuration - Update these with your Supabase details
const SUPABASE_URL = process.env.SUPABASE_URL || 'your-supabase-url';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-key';

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Get count of records in a table
 */
async function getRecordCount(tableName) {
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error(`Error counting ${tableName}:`, error);
    return 0;
  }
  
  return count || 0;
}

/**
 * Delete all records from a table
 */
async function deleteAllRecords(tableName) {
  console.log(`Deleting all records from ${tableName}...`);
  
  // First, get all record IDs
  const { data, error: fetchError } = await supabase
    .from(tableName)
    .select('id');
  
  if (fetchError) {
    console.error(`Error fetching ${tableName} records:`, fetchError);
    return false;
  }
  
  if (!data || data.length === 0) {
    console.log(`No records found in ${tableName}`);
    return true;
  }
  
  // Delete in batches to avoid timeout
  const batchSize = 100;
  const batches = [];
  
  for (let i = 0; i < data.length; i += batchSize) {
    batches.push(data.slice(i, i + batchSize));
  }
  
  for (const batch of batches) {
    const ids = batch.map(record => record.id);
    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .in('id', ids);
    
    if (deleteError) {
      console.error(`Error deleting batch from ${tableName}:`, deleteError);
      return false;
    }
    
    console.log(`Deleted ${ids.length} records from ${tableName}`);
  }
  
  return true;
}

/**
 * Main function to reset all booking data
 */
async function resetBookingData() {
  console.log('🚀 Starting booking data reset...\n');
  
  try {
    // Display current record counts
    console.log('📊 BEFORE DELETION:');
    const beforeCounts = {
      bookings: await getRecordCount('bookings'),
      booking_history: await getRecordCount('booking_history'),
      refunds: await getRecordCount('refunds')
    };
    
    console.log(`Bookings: ${beforeCounts.bookings}`);
    console.log(`Booking History: ${beforeCounts.booking_history}`);
    console.log(`Refunds: ${beforeCounts.refunds}\n`);
    
    // Confirm deletion
    if (process.env.NODE_ENV !== 'development') {
      console.log('⚠️  WARNING: This will permanently delete all booking data!');
      console.log('Set NODE_ENV=development to skip this confirmation.\n');
      
      // In a real script, you might want to add readline for confirmation
      // For now, we'll proceed if explicitly confirmed
      if (!process.env.CONFIRM_DELETE) {
        console.log('❌ Deletion cancelled. Set CONFIRM_DELETE=true to proceed.');
        return;
      }
    }
    
    // Delete data in correct order (respecting foreign key constraints)
    console.log('🗑️  DELETING DATA:\n');
    
    // 1. Delete refunds first (references bookings)
    const refundsDeleted = await deleteAllRecords('refunds');
    if (!refundsDeleted) {
      throw new Error('Failed to delete refunds');
    }
    
    // 2. Delete booking history (references bookings)
    const historyDeleted = await deleteAllRecords('booking_history');
    if (!historyDeleted) {
      throw new Error('Failed to delete booking history');
    }
    
    // 3. Delete main bookings table
    const bookingsDeleted = await deleteAllRecords('bookings');
    if (!bookingsDeleted) {
      throw new Error('Failed to delete bookings');
    }
    
    // Verify deletion
    console.log('\n📊 AFTER DELETION:');
    const afterCounts = {
      bookings: await getRecordCount('bookings'),
      booking_history: await getRecordCount('booking_history'),
      refunds: await getRecordCount('refunds')
    };
    
    console.log(`Bookings: ${afterCounts.bookings}`);
    console.log(`Booking History: ${afterCounts.booking_history}`);
    console.log(`Refunds: ${afterCounts.refunds}\n`);
    
    // Check if deletion was successful
    const totalRemaining = afterCounts.bookings + afterCounts.booking_history + afterCounts.refunds;
    
    if (totalRemaining === 0) {
      console.log('✅ SUCCESS: All booking data has been safely removed!');
      
      // Verify configuration data is preserved
      console.log('\n🔧 CONFIGURATION DATA PRESERVED:');
      const configCounts = {
        schedule_settings: await getRecordCount('schedule_settings'),
        open_days: await getRecordCount('open_days')
      };
      
      console.log(`Schedule Settings: ${configCounts.schedule_settings}`);
      console.log(`Open Days: ${configCounts.open_days}`);
      
    } else {
      throw new Error(`Some records were not deleted. ${totalRemaining} records remaining.`);
    }
    
  } catch (error) {
    console.error('❌ ERROR during reset:', error.message);
    console.log('\n🔄 You may need to run the script again or check for foreign key constraints.');
    process.exit(1);
  }
}

/**
 * Optional: Insert sample test data
 */
async function insertSampleData() {
  console.log('\n🧪 Inserting sample test data...');
  
  const sampleBookings = [
    {
      full_name: 'Test User 1',
      email: 'test1@example.com',
      phone: '(555) 123-4567',
      date: '2025-07-01',
      time: '10:00 AM',
      number_of_visitors: 2,
      total_amount: 70,
      payment_method: 'pay_on_arrival',
      payment_status: 'pending'
    },
    {
      full_name: 'Test User 2',
      email: 'test2@example.com',
      phone: '(555) 234-5678',
      date: '2025-07-01',
      time: '2:00 PM',
      number_of_visitors: 1,
      total_amount: 35,
      payment_method: 'pay_now',
      payment_status: 'paid'
    },
    {
      full_name: 'Test User 3',
      email: 'test3@example.com',
      phone: '(555) 345-6789',
      date: '2025-07-02',
      time: '11:00 AM',
      number_of_visitors: 4,
      total_amount: 140,
      payment_method: 'pay_on_arrival',
      payment_status: 'pending'
    }
  ];
  
  const { data, error } = await supabase
    .from('bookings')
    .insert(sampleBookings);
  
  if (error) {
    console.error('Error inserting sample data:', error);
  } else {
    console.log(`✅ Inserted ${sampleBookings.length} sample bookings`);
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  resetBookingData()
    .then(() => {
      // Uncomment the next line if you want to insert sample data
      // return insertSampleData();
    })
    .then(() => {
      console.log('\n🎉 Database reset completed successfully!');
      console.log('You can now proceed with fresh testing.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

// Export for use in other scripts
export { resetBookingData, insertSampleData };
