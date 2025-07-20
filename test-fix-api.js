import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testFixAPI() {
  console.log('🧪 Testing Operating Days Fix API...\n');

  // 1. Check current state before fix
  console.log('1. State BEFORE fix:');
  const { data: beforeOpenDays } = await supabase
    .from('open_days')
    .select('date, is_open')
    .gte('date', new Date().toISOString().split('T')[0])
    .lte('date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('date');

  beforeOpenDays?.forEach(day => {
    const dayName = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    console.log(`${day.date} (${dayName}): ${day.is_open ? 'OPEN' : 'CLOSED'}`);
  });
  console.log('');

  // 2. Apply the fix via API
  console.log('2. Applying fix via API...');
  try {
    const response = await fetch('http://localhost:4322/api/admin/fix-operating-days', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Fix applied successfully:', result.message);
    } else {
      console.error('❌ Fix failed:', result.error);
      if (result.details) {
        console.error('Details:', result.details);
      }
      return;
    }
  } catch (err) {
    console.error('❌ Error calling fix API:', err.message);
    return;
  }
  console.log('');

  // 3. Wait a moment for changes to propagate
  console.log('3. Waiting for changes to propagate...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 4. Check state after fix
  console.log('4. State AFTER fix:');
  const { data: afterOpenDays } = await supabase
    .from('open_days')
    .select('date, is_open')
    .gte('date', new Date().toISOString().split('T')[0])
    .lte('date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('date');

  const { data: operatingDaysSetting } = await supabase
    .from('schedule_settings')
    .select('setting_value')
    .eq('setting_key', 'operating_days')
    .single();

  const operatingDays = JSON.parse(operatingDaysSetting?.setting_value || '[]');
  console.log('Operating days setting:', operatingDays);
  console.log('');

  afterOpenDays?.forEach(day => {
    const dayName = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const shouldBeOpen = operatingDays.includes(dayName);
    const isCorrect = day.is_open === shouldBeOpen;
    console.log(`${day.date} (${dayName}): ${day.is_open ? 'OPEN' : 'CLOSED'} - Should be: ${shouldBeOpen ? 'OPEN' : 'CLOSED'} ${isCorrect ? '✅' : '❌'}`);
  });
  console.log('');

  // 5. Test availability API
  console.log('5. Testing availability API...');
  try {
    const response = await fetch('http://localhost:4322/api/availability');
    if (response.ok) {
      const availability = await response.json();
      const availableDates = Object.keys(availability);
      console.log(`✅ Availability API working! Found ${availableDates.length} available dates`);
      
      // Check if the available dates match the operating days
      const correctDates = availableDates.filter(date => {
        const dayName = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        return operatingDays.includes(dayName);
      });
      
      console.log(`✅ ${correctDates.length} out of ${availableDates.length} available dates match operating days`);
      
      if (availableDates.length > 0) {
        console.log('First few available dates:', availableDates.slice(0, 5));
      }
    } else {
      console.log('⚠️  Availability API returned error:', response.status);
    }
  } catch (err) {
    console.log('⚠️  Could not test availability API:', err.message);
  }

  console.log('\n🎉 Fix test completed!');
}

testFixAPI().catch(console.error);
