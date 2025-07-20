import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugOperatingDays() {
  console.log('🔍 Debugging Operating Days Issue...\n');

  // 1. Check all schedule settings
  console.log('1. All schedule settings:');
  const { data: allSettings, error: settingsError } = await supabase
    .from('schedule_settings')
    .select('setting_key, setting_value')
    .order('setting_key');

  if (settingsError) {
    console.error('Error fetching settings:', settingsError);
    return;
  }

  allSettings.forEach(setting => {
    console.log(`${setting.setting_key}: ${JSON.stringify(setting.setting_value)}`);
  });
  console.log('');

  // 2. Check what the generate_open_days_and_slots function is actually using
  console.log('2. Testing what days should be open based on current settings:');
  
  const operatingDays = allSettings.find(s => s.setting_key === 'operating_days')?.setting_value;
  console.log('Operating days from DB:', operatingDays);
  console.log('Type:', typeof operatingDays);
  console.log('Is Array:', Array.isArray(operatingDays));
  
  // Parse if it's a string
  let parsedOperatingDays;
  if (typeof operatingDays === 'string') {
    try {
      parsedOperatingDays = JSON.parse(operatingDays);
    } catch (e) {
      parsedOperatingDays = operatingDays;
    }
  } else {
    parsedOperatingDays = operatingDays;
  }
  
  console.log('Parsed operating days:', parsedOperatingDays);
  console.log('');

  // 3. Check what days are currently marked as open
  console.log('3. Current open days status:');
  const { data: openDays, error: openError } = await supabase
    .from('open_days')
    .select('date, is_open')
    .gte('date', new Date().toISOString().split('T')[0])
    .lte('date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('date');

  if (openError) {
    console.error('Error fetching open days:', openError);
    return;
  }

  openDays.forEach(day => {
    const dayName = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const shouldBeOpen = Array.isArray(parsedOperatingDays) ? 
      parsedOperatingDays.includes(dayName) : 
      parsedOperatingDays[dayName] === true;
    
    console.log(`${day.date} (${dayName}): ${day.is_open ? 'OPEN' : 'CLOSED'} - Should be: ${shouldBeOpen ? 'OPEN' : 'CLOSED'} ${day.is_open === shouldBeOpen ? '✅' : '❌'}`);
  });
  console.log('');

  // 4. Check if there are any time slots for the days that should be open
  console.log('4. Time slots for days that should be open:');
  const { data: timeSlots, error: slotsError } = await supabase
    .from('time_slots')
    .select('date, time, max_bouquets, is_legacy')
    .gte('date', new Date().toISOString().split('T')[0])
    .lte('date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('date, time');

  if (slotsError) {
    console.error('Error fetching time slots:', slotsError);
    return;
  }

  const slotsByDate = {};
  timeSlots.forEach(slot => {
    if (!slotsByDate[slot.date]) slotsByDate[slot.date] = [];
    slotsByDate[slot.date].push(slot);
  });

  Object.keys(slotsByDate).forEach(date => {
    const dayName = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const shouldBeOpen = Array.isArray(parsedOperatingDays) ? 
      parsedOperatingDays.includes(dayName) : 
      parsedOperatingDays[dayName] === true;
    
    console.log(`${date} (${dayName}) - Should be open: ${shouldBeOpen ? 'YES' : 'NO'}`);
    slotsByDate[date].forEach(slot => {
      console.log(`  ${slot.time} (max: ${slot.max_bouquets}, legacy: ${slot.is_legacy})`);
    });
  });

  console.log('\n🔍 Debug complete!');
  console.log('\nSummary:');
  console.log(`- Operating days setting: ${JSON.stringify(parsedOperatingDays)}`);
  console.log(`- Days currently open: ${openDays.filter(d => d.is_open).length} out of ${openDays.length}`);
  console.log(`- Time slots available: ${timeSlots.length}`);
}

debugOperatingDays().catch(console.error);
