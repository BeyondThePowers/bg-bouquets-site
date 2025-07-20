// Test a simple operating days update

async function testSimpleUpdate() {
  console.log('🧪 Testing Simple Operating Days Update...\n');

  // 1. Check current state
  console.log('1. Current state:');
  const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
  const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';
  
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: currentSettings } = await supabase
    .from('schedule_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['operating_days', 'season_start_month', 'season_start_day']);

  console.log('Current settings:');
  currentSettings?.forEach(setting => {
    console.log(`${setting.setting_key}: ${setting.setting_value}`);
  });
  console.log('');

  // 2. Test just updating operating days (minimal update)
  console.log('2. Testing minimal update (just operating days):');
  try {
    const response = await fetch('http://localhost:4322/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operating_days: ['thursday', 'friday', 'saturday'],
        time_slots: ["10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "6:00 PM", "7:00 PM", "8:00 PM"],
        max_bookings_per_slot: "20",
        max_visitors_per_slot: "40",
        max_visitor_passes_per_booking: "20",
        season_start_month: "5",  // Use string format
        season_start_day: "21",   // Use string format
        season_end_month: "9",    // Use string format
        season_end_day: "9"       // Use string format
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Update successful');
    } else {
      console.error('❌ Update failed:', result.error);
      
      // Try to get more details
      if (response.status !== 200) {
        console.error('Response status:', response.status);
        console.error('Response text:', await response.text());
      }
      return;
    }
  } catch (err) {
    console.error('❌ Error during update:', err.message);
    return;
  }
  console.log('');

  // 3. Wait and verify
  console.log('3. Waiting for changes to propagate...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 4. Check if settings were updated
  console.log('4. Verifying settings update:');
  const { data: updatedSettings } = await supabase
    .from('schedule_settings')
    .select('setting_key, setting_value')
    .eq('setting_key', 'operating_days')
    .single();

  const newOperatingDays = JSON.parse(updatedSettings?.setting_value || '[]');
  console.log('New operating days:', newOperatingDays);

  const expectedDays = ['thursday', 'friday', 'saturday'];
  const settingsMatch = JSON.stringify(newOperatingDays.sort()) === JSON.stringify(expectedDays.sort());
  console.log(`Settings updated correctly: ${settingsMatch ? 'YES' : 'NO'}`);
  console.log('');

  // 5. Check if schedule was regenerated
  console.log('5. Checking if schedule was regenerated:');
  const { data: openDays } = await supabase
    .from('open_days')
    .select('date, is_open')
    .gte('date', new Date().toISOString().split('T')[0])
    .lte('date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('date');

  let correctCount = 0;
  let totalCount = 0;

  console.log('Schedule verification:');
  openDays?.forEach(day => {
    const dayName = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const shouldBeOpen = newOperatingDays.includes(dayName);
    const isCorrect = day.is_open === shouldBeOpen;
    
    if (isCorrect) correctCount++;
    totalCount++;
    
    console.log(`${day.date} (${dayName}): ${day.is_open ? 'OPEN' : 'CLOSED'} - Expected: ${shouldBeOpen ? 'OPEN' : 'CLOSED'} ${isCorrect ? '✅' : '❌'}`);
  });

  const scheduleCorrect = correctCount === totalCount;
  console.log(`Schedule updated correctly: ${scheduleCorrect ? 'YES' : 'NO'} (${correctCount}/${totalCount})`);
  console.log('');

  // 6. Test availability API
  console.log('6. Testing availability API:');
  try {
    const availabilityResponse = await fetch('http://localhost:4322/api/availability');
    if (availabilityResponse.ok) {
      const availability = await availabilityResponse.json();
      const availableDates = Object.keys(availability);
      
      console.log(`✅ Found ${availableDates.length} available dates`);
      
      if (availableDates.length > 0) {
        console.log('Sample dates:', availableDates.slice(0, 3));
        
        // Check if they match the new operating days
        const matchingDates = availableDates.filter(date => {
          const dayName = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
          return newOperatingDays.includes(dayName);
        });
        
        console.log(`✅ ${matchingDates.length}/${availableDates.length} dates match new operating days`);
      }
    } else {
      console.log('⚠️  Availability API error:', availabilityResponse.status);
    }
  } catch (err) {
    console.log('⚠️  Could not test availability API:', err.message);
  }

  console.log('\n🎯 Simple Update Test Summary:');
  if (settingsMatch && scheduleCorrect) {
    console.log('🎉 SUCCESS: Operating days update is working perfectly!');
    console.log('✅ Settings are saved correctly');
    console.log('✅ Schedule is regenerated correctly');
    console.log('✅ Booking calendar will show the correct days');
  } else {
    console.log('❌ ISSUE: Some parts are not working correctly');
    console.log(`Settings: ${settingsMatch ? 'OK' : 'FAILED'}`);
    console.log(`Schedule: ${scheduleCorrect ? 'OK' : 'FAILED'}`);
  }
}

testSimpleUpdate().catch(console.error);
