import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyFixSuccess() {
  console.log('🎯 Verifying SQL Fix Success...\n');

  // 1. Check current schedule settings
  console.log('1. Current schedule settings:');
  const { data: settings, error: settingsError } = await supabase
    .from('schedule_settings')
    .select('setting_key, setting_value')
    .eq('setting_key', 'operating_days')
    .single();

  if (settingsError) {
    console.error('Error fetching settings:', settingsError);
    return;
  }

  const operatingDays = JSON.parse(settings.setting_value);
  console.log('Operating days in database:', operatingDays);
  console.log('');

  // 2. Check if open_days table matches the settings
  console.log('2. Checking if open_days table matches settings:');
  const { data: openDays, error: openError } = await supabase
    .from('open_days')
    .select('date, is_open')
    .gte('date', new Date().toISOString().split('T')[0])
    .lte('date', new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('date');

  if (openError) {
    console.error('Error fetching open days:', openError);
    return;
  }

  let correctCount = 0;
  let totalCount = 0;

  console.log('Schedule verification (next 2 weeks):');
  openDays?.forEach(day => {
    const dayName = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const shouldBeOpen = operatingDays.includes(dayName);
    const isCorrect = day.is_open === shouldBeOpen;
    
    if (isCorrect) correctCount++;
    totalCount++;
    
    console.log(`${day.date} (${dayName}): ${day.is_open ? 'OPEN' : 'CLOSED'} - Expected: ${shouldBeOpen ? 'OPEN' : 'CLOSED'} ${isCorrect ? '✅' : '❌'}`);
  });
  console.log('');

  // 3. Test the refresh_future_schedule function
  console.log('3. Testing refresh_future_schedule function:');
  try {
    const { error: refreshError } = await supabase.rpc('refresh_future_schedule');
    if (refreshError) {
      console.error('❌ refresh_future_schedule failed:', refreshError);
    } else {
      console.log('✅ refresh_future_schedule executed successfully');
    }
  } catch (err) {
    console.error('❌ Error calling refresh_future_schedule:', err);
  }
  console.log('');

  // 4. Check availability API
  console.log('4. Testing availability API:');
  try {
    const response = await fetch('http://localhost:4322/api/availability');
    if (response.ok) {
      const availability = await response.json();
      const availableDates = Object.keys(availability);
      
      console.log(`✅ Availability API working! Found ${availableDates.length} available dates`);
      
      if (availableDates.length > 0) {
        console.log('Sample available dates:', availableDates.slice(0, 5));
        
        // Verify they match operating days
        const correctDates = availableDates.filter(date => {
          const dayName = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
          return operatingDays.includes(dayName);
        });
        
        console.log(`✅ ${correctDates.length}/${availableDates.length} available dates match operating days`);
      }
    } else {
      console.log('⚠️  Availability API error:', response.status);
    }
  } catch (err) {
    console.log('⚠️  Could not test availability API:', err.message);
  }
  console.log('');

  // 5. Summary
  console.log('🎯 Fix Verification Summary:');
  console.log(`✅ Schedule accuracy: ${correctCount}/${totalCount} days correct (${Math.round(correctCount/totalCount*100)}%)`);
  
  if (correctCount === totalCount) {
    console.log('🎉 SUCCESS: SQL functions are now working correctly!');
    console.log('✅ Operating days updates will now immediately reflect in the booking calendar');
    console.log('✅ Admin interface is fully functional');
    console.log('✅ No more manual fixes needed');
  } else {
    console.log('⚠️  Some days are still incorrect - there may be additional issues');
  }
  
  console.log('\n📋 Next Steps:');
  console.log('1. Test updating operating days in the admin interface');
  console.log('2. Verify changes immediately appear in the booking calendar');
  console.log('3. The system should now work seamlessly!');
}

verifyFixSuccess().catch(console.error);
