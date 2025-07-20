import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAutoExtendBehavior() {
  console.log('🧪 Testing Auto-Extend Behavior...\n');

  // First, let's test the current schedule update process
  console.log('1. Testing current schedule update process...');
  
  try {
    // Simulate updating schedule settings (like changing operating days)
    const response = await fetch('http://localhost:4323/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operating_days: ['monday', 'wednesday', 'friday'],
        time_slots: ["10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "6:00 PM", "7:00 PM"],
        max_bookings_per_slot: "30",
        max_visitors_per_slot: "60",
        max_visitor_passes_per_booking: "25",
        season_start_month: "5",
        season_start_day: "21",
        season_end_month: "9",
        season_end_day: "9"
      })
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        console.log('✅ Schedule settings updated successfully');
      } else {
        console.error('❌ Schedule update failed:', result.error);
        return;
      }
    } else {
      console.error('❌ HTTP error:', response.status);
      return;
    }
  } catch (err) {
    console.error('❌ Error updating schedule:', err.message);
    return;
  }

  // Wait for the refresh to complete
  console.log('2. Waiting for schedule refresh to complete...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Check the current booking range
  console.log('3. Checking current booking range...');
  
  const { data: openDays, error: queryError } = await supabase
    .from('open_days')
    .select('date')
    .gte('date', new Date().toISOString().split('T')[0])
    .order('date', { ascending: false })
    .limit(1);

  if (queryError) {
    console.error('❌ Query error:', queryError);
    return;
  }

  if (openDays && openDays.length > 0) {
    const maxDate = openDays[0].date;
    const today = new Date();
    const maxDateObj = new Date(maxDate);
    const daysAhead = Math.ceil((maxDateObj - today) / (1000 * 60 * 60 * 24));
    
    console.log(`Current booking range extends to: ${maxDate}`);
    console.log(`Days ahead: ${daysAhead} days`);
    
    if (daysAhead < 300) {
      console.log('⚠️  Booking range is less than 300 days - needs extension');
      
      // Test the extend booking range API
      console.log('4. Testing extend booking range API...');
      
      try {
        const extendResponse = await fetch('http://localhost:4323/api/admin/extend-booking-range', {
          method: 'POST'
        });

        if (extendResponse.ok) {
          const extendResult = await extendResponse.json();
          if (extendResult.success) {
            console.log('✅ Booking range extended successfully');
            console.log('Message:', extendResult.message);
            
            // Check the new range
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const { data: newOpenDays } = await supabase
              .from('open_days')
              .select('date')
              .gte('date', new Date().toISOString().split('T')[0])
              .order('date', { ascending: false })
              .limit(1);

            if (newOpenDays && newOpenDays.length > 0) {
              const newMaxDate = newOpenDays[0].date;
              const newDaysAhead = Math.ceil((new Date(newMaxDate) - today) / (1000 * 60 * 60 * 24));
              
              console.log(`New booking range extends to: ${newMaxDate}`);
              console.log(`New days ahead: ${newDaysAhead} days`);
              
              if (newDaysAhead >= 350) {
                console.log('🎉 SUCCESS: Booking range now extends ~1 year ahead!');
              }
            }
          } else {
            console.error('❌ Extend range failed:', extendResult.error);
          }
        }
      } catch (err) {
        console.error('❌ Error extending range:', err.message);
      }
    } else {
      console.log('✅ Booking range is adequate (>300 days)');
    }
  }

  console.log('\n🎯 Auto-Extension Implementation Plan:');
  console.log('');
  console.log('CURRENT BEHAVIOR:');
  console.log('1. Admin updates schedule settings');
  console.log('2. refresh_future_schedule() is called');
  console.log('3. Existing slots are updated with new settings');
  console.log('4. Only ~60 days of new schedule is generated');
  console.log('');
  console.log('DESIRED BEHAVIOR:');
  console.log('1. Admin updates schedule settings');
  console.log('2. refresh_future_schedule() is called');
  console.log('3. Existing slots are updated with new settings');
  console.log('4. Booking range is automatically extended to ~365 days');
  console.log('5. No manual "Extend Range" button clicking needed');
  console.log('');
  console.log('IMPLEMENTATION APPROACH:');
  console.log('Since we cannot easily update the SQL function, we can:');
  console.log('1. Modify the admin settings API to call extend-booking-range');
  console.log('2. After refresh_future_schedule(), automatically call extend API');
  console.log('3. This ensures full year availability after any schedule change');
}

testAutoExtendBehavior().catch(console.error);
