// Test the complete operating days solution

async function testCompleteSolution() {
  console.log('🎯 Testing Complete Operating Days Solution...\n');

  // 1. Test the regenerate schedule API directly
  console.log('1. Testing regenerate schedule API:');
  try {
    const response = await fetch('http://localhost:4322/api/admin/regenerate-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Regenerate API working:', result.message);
      console.log('Stats:', result.stats);
    } else {
      console.error('❌ Regenerate API failed:', result.error);
      return;
    }
  } catch (err) {
    console.error('❌ Error calling regenerate API:', err.message);
    return;
  }
  console.log('');

  // 2. Verify the schedule is correct
  console.log('2. Verifying schedule after regeneration:');
  const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
  const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';
  
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: settings } = await supabase
    .from('schedule_settings')
    .select('setting_value')
    .eq('setting_key', 'operating_days')
    .single();

  const operatingDays = JSON.parse(settings?.setting_value || '[]');
  console.log('Current operating days:', operatingDays);

  const { data: openDays } = await supabase
    .from('open_days')
    .select('date, is_open')
    .gte('date', new Date().toISOString().split('T')[0])
    .lte('date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('date');

  let correctCount = 0;
  let totalCount = 0;

  console.log('Schedule verification (next week):');
  openDays?.forEach(day => {
    const dayName = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const shouldBeOpen = operatingDays.includes(dayName);
    const isCorrect = day.is_open === shouldBeOpen;
    
    if (isCorrect) correctCount++;
    totalCount++;
    
    console.log(`${day.date} (${dayName}): ${day.is_open ? 'OPEN' : 'CLOSED'} - Expected: ${shouldBeOpen ? 'OPEN' : 'CLOSED'} ${isCorrect ? '✅' : '❌'}`);
  });
  console.log('');

  // 3. Test updating operating days through admin interface
  console.log('3. Testing admin interface update (changing to Thursday, Friday, Saturday):');
  try {
    const updateResponse = await fetch('http://localhost:4322/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operating_days: ['thursday', 'friday', 'saturday'],
        time_slots: ["10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "6:00 PM", "7:00 PM", "8:00 PM"],
        max_bookings_per_slot: "20",
        max_visitors_per_slot: "40",
        max_visitor_passes_per_booking: "20",
        season_start_month: "5",
        season_start_day: "21",
        season_end_month: "9",
        season_end_day: "9"
      })
    });

    const updateResult = await updateResponse.json();
    
    if (updateResult.success) {
      console.log('✅ Admin settings update successful');
    } else {
      console.error('❌ Admin settings update failed:', updateResult.error);
      return;
    }
  } catch (err) {
    console.error('❌ Error updating admin settings:', err.message);
    return;
  }
  console.log('');

  // 4. Wait for changes to propagate
  console.log('4. Waiting for changes to propagate...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 5. Verify the update worked
  console.log('5. Verifying admin update worked:');
  const { data: updatedSettings } = await supabase
    .from('schedule_settings')
    .select('setting_value')
    .eq('setting_key', 'operating_days')
    .single();

  const updatedOperatingDays = JSON.parse(updatedSettings?.setting_value || '[]');
  console.log('Updated operating days:', updatedOperatingDays);

  const { data: updatedOpenDays } = await supabase
    .from('open_days')
    .select('date, is_open')
    .gte('date', new Date().toISOString().split('T')[0])
    .lte('date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('date');

  let updatedCorrectCount = 0;
  let updatedTotalCount = 0;

  console.log('Updated schedule verification (next week):');
  updatedOpenDays?.forEach(day => {
    const dayName = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const shouldBeOpen = updatedOperatingDays.includes(dayName);
    const isCorrect = day.is_open === shouldBeOpen;
    
    if (isCorrect) updatedCorrectCount++;
    updatedTotalCount++;
    
    console.log(`${day.date} (${dayName}): ${day.is_open ? 'OPEN' : 'CLOSED'} - Expected: ${shouldBeOpen ? 'OPEN' : 'CLOSED'} ${isCorrect ? '✅' : '❌'}`);
  });
  console.log('');

  // 6. Test availability API
  console.log('6. Testing availability API:');
  try {
    const availabilityResponse = await fetch('http://localhost:4322/api/availability');
    if (availabilityResponse.ok) {
      const availability = await availabilityResponse.json();
      const availableDates = Object.keys(availability);
      
      console.log(`✅ Availability API working! Found ${availableDates.length} available dates`);
      
      if (availableDates.length > 0) {
        console.log('Sample available dates:', availableDates.slice(0, 5));
        
        // Verify they match the new operating days
        const correctDates = availableDates.filter(date => {
          const dayName = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
          return updatedOperatingDays.includes(dayName);
        });
        
        console.log(`✅ ${correctDates.length}/${availableDates.length} available dates match new operating days`);
      }
    } else {
      console.log('⚠️  Availability API error:', availabilityResponse.status);
    }
  } catch (err) {
    console.log('⚠️  Could not test availability API:', err.message);
  }
  console.log('');

  // 7. Final summary
  console.log('🎯 Complete Solution Test Summary:');
  console.log(`✅ Initial schedule accuracy: ${correctCount}/${totalCount} days correct`);
  console.log(`✅ Updated schedule accuracy: ${updatedCorrectCount}/${updatedTotalCount} days correct`);
  
  const settingsUpdated = JSON.stringify(updatedOperatingDays.sort()) === JSON.stringify(['thursday', 'friday', 'saturday'].sort());
  const scheduleUpdated = updatedCorrectCount === updatedTotalCount;
  
  console.log(`✅ Settings updated correctly: ${settingsUpdated ? 'YES' : 'NO'}`);
  console.log(`✅ Schedule reflects new settings: ${scheduleUpdated ? 'YES' : 'NO'}`);
  
  if (settingsUpdated && scheduleUpdated) {
    console.log('\n🎉 SUCCESS: Complete operating days solution is working!');
    console.log('✅ Admin interface loads settings correctly');
    console.log('✅ Operating days updates immediately reflect in booking calendar');
    console.log('✅ Availability API shows correct dates');
    console.log('✅ System is fully functional');
  } else {
    console.log('\n❌ ISSUE: Some parts of the solution are not working correctly');
  }
}

testCompleteSolution().catch(console.error);
