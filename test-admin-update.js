import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAdminUpdate() {
  console.log('🧪 Testing Admin Interface Operating Days Update...\n');

  // 1. Check current state
  console.log('1. Current state:');
  const { data: beforeSettings } = await supabase
    .from('schedule_settings')
    .select('setting_value')
    .eq('setting_key', 'operating_days')
    .single();

  console.log('Current operating days:', JSON.parse(beforeSettings?.setting_value || '[]'));

  const { data: beforeDays } = await supabase
    .from('open_days')
    .select('date, is_open')
    .gte('date', new Date().toISOString().split('T')[0])
    .lte('date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('date');

  console.log('Current open days:');
  beforeDays?.forEach(day => {
    const dayName = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    console.log(`${day.date} (${dayName}): ${day.is_open ? 'OPEN' : 'CLOSED'}`);
  });
  console.log('');

  // 2. Simulate admin interface update - change to Thursday, Friday, Saturday
  console.log('2. Simulating admin update to Thursday, Friday, Saturday...');
  
  const newOperatingDays = ['thursday', 'friday', 'saturday'];
  
  try {
    const response = await fetch('http://localhost:4322/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operating_days: newOperatingDays,
        time_slots: ["10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "6:00 PM", "7:00 PM", "8:00 PM"],
        max_bookings_per_slot: "20",
        max_visitors_per_slot: "40", // This maps to max_bouquets_per_slot
        max_visitor_passes_per_booking: "20",
        season_start_month: "5",
        season_start_day: "21",
        season_end_month: "9",
        season_end_day: "9"
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Admin settings update successful');
    } else {
      console.error('❌ Admin settings update failed:', result.error);
      return;
    }
  } catch (err) {
    console.error('❌ Error calling admin settings API:', err.message);
    return;
  }

  // 3. Wait for changes to propagate
  console.log('3. Waiting for changes to propagate...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 4. Check if settings were updated
  console.log('4. Checking updated settings:');
  const { data: afterSettings } = await supabase
    .from('schedule_settings')
    .select('setting_value')
    .eq('setting_key', 'operating_days')
    .single();

  const updatedOperatingDays = JSON.parse(afterSettings?.setting_value || '[]');
  console.log('Updated operating days:', updatedOperatingDays);

  // 5. Check if open days were updated
  console.log('5. Checking if open days were updated:');
  const { data: afterDays } = await supabase
    .from('open_days')
    .select('date, is_open')
    .gte('date', new Date().toISOString().split('T')[0])
    .lte('date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('date');

  console.log('Updated open days:');
  afterDays?.forEach(day => {
    const dayName = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const shouldBeOpen = updatedOperatingDays.includes(dayName);
    const isCorrect = day.is_open === shouldBeOpen;
    console.log(`${day.date} (${dayName}): ${day.is_open ? 'OPEN' : 'CLOSED'} - Expected: ${shouldBeOpen ? 'OPEN' : 'CLOSED'} ${isCorrect ? '✅' : '❌'}`);
  });

  // 6. Test availability API
  console.log('\n6. Testing availability API after update...');
  try {
    const response = await fetch('http://localhost:4322/api/availability');
    if (response.ok) {
      const availability = await response.json();
      const availableDates = Object.keys(availability);
      console.log(`✅ Availability API working! Found ${availableDates.length} available dates`);
      
      if (availableDates.length > 0) {
        console.log('Sample available dates:', availableDates.slice(0, 5));
        
        // Check if they match the new operating days
        const correctDates = availableDates.filter(date => {
          const dayName = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
          return updatedOperatingDays.includes(dayName);
        });
        
        console.log(`✅ ${correctDates.length}/${availableDates.length} dates match new operating days`);
      }
    } else {
      console.log('⚠️  Availability API error:', response.status);
    }
  } catch (err) {
    console.log('⚠️  Could not test availability API:', err.message);
  }

  // 7. Summary
  console.log('\n🎯 Test Summary:');
  const settingsUpdated = JSON.stringify(updatedOperatingDays) === JSON.stringify(newOperatingDays);
  const scheduleUpdated = afterDays?.every(day => {
    const dayName = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const shouldBeOpen = updatedOperatingDays.includes(dayName);
    return day.is_open === shouldBeOpen;
  });

  console.log(`Settings updated correctly: ${settingsUpdated ? '✅' : '❌'}`);
  console.log(`Schedule reflects new settings: ${scheduleUpdated ? '✅' : '❌'}`);
  
  if (settingsUpdated && scheduleUpdated) {
    console.log('\n🎉 SUCCESS: Operating days updates now work correctly!');
    console.log('The admin interface can update operating days and they are reflected in the booking calendar.');
  } else {
    console.log('\n❌ ISSUE: There are still problems with the operating days update process.');
  }
}

testAdminUpdate().catch(console.error);
