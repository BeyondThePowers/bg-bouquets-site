// Quick test to check if reschedule_booking function exists
import { supabase } from './lib/supabase.js';

async function testRescheduleFunction() {
  try {
    console.log('Testing if reschedule_booking function exists...');
    
    // Try to call the function with dummy data
    const { data, error } = await supabase.rpc('reschedule_booking', {
      p_cancellation_token: '00000000-0000-0000-0000-000000000000',
      p_new_date: '2025-07-01',
      p_new_time: '10:00 AM',
      p_reschedule_reason: 'test',
      p_customer_ip: '127.0.0.1'
    });
    
    console.log('Function call result:', { data, error });
    
    if (error) {
      if (error.message && error.message.includes('function reschedule_booking')) {
        console.log('❌ Function reschedule_booking does not exist in database');
        console.log('You need to run the database migration: database/migrations/add_cancellation_support.sql');
      } else {
        console.log('✅ Function exists but returned an error (expected with dummy data)');
        console.log('Error:', error.message);
      }
    } else {
      console.log('✅ Function exists and executed successfully');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testRescheduleFunction();
