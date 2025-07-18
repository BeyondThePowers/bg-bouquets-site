// Debug script to test reschedule booking functionality
// Run with: node debug-reschedule-issue.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugRescheduleIssue() {
  console.log('🔍 Debugging reschedule booking issue...\n');
  console.log('Based on dbmakeup.json analysis:');
  console.log('- booking_actions table exists with correct structure');
  console.log('- bookings table exists with cancellation_token, status, reschedule_count columns');
  console.log('- Most likely issue: missing CHECK constraint on booking_actions.action_type\n');

  try {
    // 1. Check if reschedule_booking function exists
    console.log('1. Testing reschedule_booking function with dummy data...');
    const { data: functions, error: funcError } = await supabase.rpc('reschedule_booking', {
      p_cancellation_token: '00000000-0000-0000-0000-000000000000',
      p_new_date: '2025-07-20',
      p_new_time: '10:00 AM',
      p_reschedule_reason: 'test',
      p_customer_ip: '127.0.0.1'
    });

    if (funcError) {
      console.log('❌ Function call error:', funcError.message);
      console.log('   Full error code:', funcError.code);
      console.log('   Full error details:', funcError.details);

      if (funcError.message.includes('function reschedule_booking')) {
        console.log('   → Function does not exist or has wrong signature');
      } else if (funcError.message.includes('constraint') || funcError.message.includes('check')) {
        console.log('   → Database constraint violation - this is likely the issue!');
        console.log('   → The booking_actions table constraint probably doesn\'t include reschedule_from/reschedule_to');
      } else if (funcError.message.includes('not found')) {
        console.log('   → Expected: booking not found (this is normal for dummy UUID)');
      } else {
        console.log('   → Other database error');
      }
    } else {
      console.log('✅ Function exists and returned:', functions);
    }

    // 2. Check booking_actions table structure
    console.log('\n2. Checking booking_actions table structure...');
    const { data: tableInfo, error: tableError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'booking_actions')
      .order('ordinal_position');

    if (tableError) {
      console.log('❌ Error checking table structure:', tableError.message);
    } else {
      console.log('✅ Table structure:');
      tableInfo.forEach(col => {
        console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }

    // 3. Check existing action types
    console.log('\n3. Checking existing action types in booking_actions...');
    const { data: actionTypes, error: actionError } = await supabase
      .from('booking_actions')
      .select('action_type')
      .limit(1000);

    if (actionError) {
      console.log('❌ Error checking action types:', actionError.message);
    } else {
      const uniqueTypes = [...new Set(actionTypes.map(a => a.action_type))];
      console.log('✅ Existing action types:', uniqueTypes);
    }

    // 4. Try to find a real booking to test with
    console.log('\n4. Looking for a real booking to test with...');
    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select('id, cancellation_token, date, time, status')
      .eq('status', 'confirmed')
      .gte('date', new Date().toISOString().split('T')[0])
      .limit(1);

    if (bookingError) {
      console.log('❌ Error finding bookings:', bookingError.message);
    } else if (bookings && bookings.length > 0) {
      const booking = bookings[0];
      console.log('✅ Found test booking:', {
        id: booking.id,
        date: booking.date,
        time: booking.time,
        token: booking.cancellation_token?.substring(0, 8) + '...'
      });

      // Try to reschedule this booking to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      console.log('\n5. Testing reschedule with real booking...');
      const { data: rescheduleResult, error: rescheduleError } = await supabase.rpc('reschedule_booking', {
        p_cancellation_token: booking.cancellation_token,
        p_new_date: tomorrowStr,
        p_new_time: '10:00 AM',
        p_reschedule_reason: 'Debug test',
        p_customer_ip: '127.0.0.1'
      });

      if (rescheduleError) {
        console.log('❌ Reschedule test failed:', rescheduleError.message);
        console.log('   Full error:', JSON.stringify(rescheduleError, null, 2));
      } else {
        console.log('✅ Reschedule test result:', rescheduleResult);
        
        // Revert the change
        console.log('\n6. Reverting test reschedule...');
        const { error: revertError } = await supabase.rpc('reschedule_booking', {
          p_cancellation_token: booking.cancellation_token,
          p_new_date: booking.date,
          p_new_time: booking.time,
          p_reschedule_reason: 'Reverting debug test',
          p_customer_ip: '127.0.0.1'
        });

        if (revertError) {
          console.log('❌ Failed to revert test:', revertError.message);
        } else {
          console.log('✅ Test reverted successfully');
        }
      }
    } else {
      console.log('ℹ️  No confirmed future bookings found for testing');
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }

  console.log('\n🏁 Debug complete');
}

debugRescheduleIssue();
