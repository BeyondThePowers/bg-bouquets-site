// Test the complete auto-extend functionality

async function testCompleteAutoExtend() {
  console.log('🎯 Testing Complete Auto-Extend Functionality...\n');

  const baseUrl = 'http://localhost:4323';
  const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
  const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';
  
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Check initial booking range
  console.log('1. Checking initial booking range...');
  const { data: initialDays } = await supabase
    .from('open_days')
    .select('date')
    .gte('date', new Date().toISOString().split('T')[0])
    .order('date', { ascending: false })
    .limit(1);

  const today = new Date();
  let initialDaysAhead = 0;
  
  if (initialDays && initialDays.length > 0) {
    const initialMaxDate = initialDays[0].date;
    initialDaysAhead = Math.ceil((new Date(initialMaxDate) - today) / (1000 * 60 * 60 * 24));
    console.log(`Initial range: ${initialMaxDate} (${initialDaysAhead} days ahead)`);
  }

  // 2. Update schedule settings to trigger auto-extend
  console.log('\n2. Updating schedule settings to trigger auto-extend...');
  
  try {
    const response = await fetch(`${baseUrl}/api/admin/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operating_days: ['tuesday', 'thursday', 'saturday'],
        time_slots: ["9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM", "3:00 PM"],
        max_bookings_per_slot: "35",
        max_visitors_per_slot: "70",
        max_visitor_passes_per_booking: "30",
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
        console.log('Message:', result.message);
      } else {
        console.error('❌ Schedule update failed:', result.error);
        return;
      }
    } else {
      console.error('❌ HTTP error:', response.status);
      const text = await response.text();
      console.error('Response:', text);
      return;
    }
  } catch (err) {
    console.error('❌ Error updating schedule:', err.message);
    return;
  }

  // 3. Wait for all operations to complete
  console.log('\n3. Waiting for schedule refresh and auto-extend to complete...');
  await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds

  // 4. Check the final booking range
  console.log('4. Checking final booking range after auto-extend...');
  
  const { data: finalDays } = await supabase
    .from('open_days')
    .select('date')
    .gte('date', new Date().toISOString().split('T')[0])
    .order('date', { ascending: false })
    .limit(1);

  let finalDaysAhead = 0;
  
  if (finalDays && finalDays.length > 0) {
    const finalMaxDate = finalDays[0].date;
    finalDaysAhead = Math.ceil((new Date(finalMaxDate) - today) / (1000 * 60 * 60 * 24));
    console.log(`Final range: ${finalMaxDate} (${finalDaysAhead} days ahead)`);
  }

  // 5. Verify the schedule was updated correctly
  console.log('\n5. Verifying schedule was updated correctly...');
  
  const { data: settings } = await supabase
    .from('schedule_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['operating_days', 'time_slots', 'max_bookings_per_slot']);

  const operatingDays = JSON.parse(settings?.find(s => s.setting_key === 'operating_days')?.setting_value || '[]');
  const timeSlots = JSON.parse(settings?.find(s => s.setting_key === 'time_slots')?.setting_value || '[]');
  const maxBookings = settings?.find(s => s.setting_key === 'max_bookings_per_slot')?.setting_value;

  console.log(`Operating days: ${JSON.stringify(operatingDays)}`);
  console.log(`Time slots: ${timeSlots.length} slots`);
  console.log(`Max bookings: ${maxBookings}`);

  // 6. Check a few sample dates to verify the new schedule
  console.log('\n6. Checking sample dates for new schedule...');
  
  const sampleDates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    sampleDates.push(date.toISOString().split('T')[0]);
  }

  const { data: sampleOpenDays } = await supabase
    .from('open_days')
    .select('date, is_open')
    .in('date', sampleDates)
    .order('date');

  let correctCount = 0;
  let totalCount = 0;

  sampleOpenDays?.forEach(day => {
    const dayName = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const shouldBeOpen = operatingDays.includes(dayName);
    const isCorrect = day.is_open === shouldBeOpen;
    
    if (isCorrect) correctCount++;
    totalCount++;
    
    console.log(`${day.date} (${dayName}): ${day.is_open ? 'OPEN' : 'CLOSED'} - Expected: ${shouldBeOpen ? 'OPEN' : 'CLOSED'} ${isCorrect ? '✅' : '❌'}`);
  });

  const scheduleAccuracy = Math.round((correctCount / totalCount) * 100);

  // 7. Final summary
  console.log('\n🎯 AUTO-EXTEND TEST RESULTS:');
  console.log('');
  console.log(`📊 BOOKING RANGE:`);
  console.log(`   Before: ${initialDaysAhead} days ahead`);
  console.log(`   After:  ${finalDaysAhead} days ahead`);
  console.log(`   Change: +${finalDaysAhead - initialDaysAhead} days`);
  console.log('');
  console.log(`📅 SCHEDULE ACCURACY: ${correctCount}/${totalCount} (${scheduleAccuracy}%)`);
  console.log('');

  const success = finalDaysAhead >= 350 && scheduleAccuracy === 100;
  
  if (success) {
    console.log('🎉 COMPLETE SUCCESS!');
    console.log('✅ Schedule settings updated correctly');
    console.log('✅ Booking range automatically extended to ~1 year');
    console.log('✅ New schedule applied correctly');
    console.log('✅ No manual intervention required');
    console.log('');
    console.log('🚀 WORKFLOW NOW COMPLETE:');
    console.log('1. Admin updates schedule settings in interface');
    console.log('2. Settings are saved to database');
    console.log('3. Schedule is refreshed with new settings');
    console.log('4. Booking range is automatically extended to full year');
    console.log('5. Customers have ~365 days of booking availability');
    console.log('6. Admin never needs to manually extend range');
  } else {
    console.log('⚠️  PARTIAL SUCCESS:');
    console.log(`Range extension: ${finalDaysAhead >= 350 ? 'SUCCESS' : 'NEEDS WORK'}`);
    console.log(`Schedule accuracy: ${scheduleAccuracy === 100 ? 'SUCCESS' : 'NEEDS WORK'}`);
  }
}

testCompleteAutoExtend().catch(console.error);
