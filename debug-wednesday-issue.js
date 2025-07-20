import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugWednesdayIssue() {
  console.log('🔍 Debugging Why Wednesday is Closed...\n');

  // 1. Check all relevant settings
  console.log('1. Checking all schedule settings:');
  const { data: allSettings } = await supabase
    .from('schedule_settings')
    .select('setting_key, setting_value')
    .in('setting_key', [
      'operating_days', 'season_start_month', 'season_start_day', 
      'season_end_month', 'season_end_day'
    ]);

  const settingsMap = {};
  allSettings?.forEach(s => {
    settingsMap[s.setting_key] = s.setting_value;
  });

  const operatingDays = JSON.parse(settingsMap.operating_days || '[]');
  const seasonStartMonth = parseInt(settingsMap.season_start_month || '5');
  const seasonStartDay = parseInt(settingsMap.season_start_day || '21');
  const seasonEndMonth = parseInt(settingsMap.season_end_month || '9');
  const seasonEndDay = parseInt(settingsMap.season_end_day || '9');

  console.log('Operating days:', operatingDays);
  console.log('Season:', `${seasonStartMonth}/${seasonStartDay} - ${seasonEndMonth}/${seasonEndDay}`);
  console.log('');

  // 2. Check if we're in season
  console.log('2. Checking if current date is in season:');
  const today = new Date();
  const currentMonth = today.getMonth() + 1; // JavaScript months are 0-based
  const currentDay = today.getDate();
  
  console.log(`Today: ${currentMonth}/${currentDay}`);
  
  const withinSeason = (
    (currentMonth > seasonStartMonth || (currentMonth === seasonStartMonth && currentDay >= seasonStartDay)) &&
    (currentMonth < seasonEndMonth || (currentMonth === seasonEndMonth && currentDay <= seasonEndDay))
  );
  
  console.log(`Within season: ${withinSeason ? 'YES' : 'NO'}`);
  console.log('');

  // 3. Check for holidays
  console.log('3. Checking for holidays:');
  const { data: holidays } = await supabase
    .from('holidays')
    .select('date, name, is_disabled')
    .gte('date', new Date().toISOString().split('T')[0])
    .lte('date', new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('date');

  if (holidays && holidays.length > 0) {
    console.log('Holidays in next 2 weeks:');
    holidays.forEach(holiday => {
      console.log(`${holiday.date}: ${holiday.name} (disabled: ${holiday.is_disabled})`);
    });
  } else {
    console.log('No holidays found in next 2 weeks');
  }
  console.log('');

  // 4. Test specific Wednesday dates
  console.log('4. Testing specific Wednesday logic:');
  const nextWednesday = new Date();
  nextWednesday.setDate(nextWednesday.getDate() + (3 - nextWednesday.getDay() + 7) % 7);
  if (nextWednesday.getDay() !== 3) {
    nextWednesday.setDate(nextWednesday.getDate() + 7);
  }

  const wednesdayStr = nextWednesday.toISOString().split('T')[0];
  const wednesdayMonth = nextWednesday.getMonth() + 1;
  const wednesdayDay = nextWednesday.getDate();

  console.log(`Next Wednesday: ${wednesdayStr} (${wednesdayMonth}/${wednesdayDay})`);

  // Check if Wednesday is in operating days
  const isOperatingDay = operatingDays.includes('wednesday');
  console.log(`Is operating day: ${isOperatingDay}`);

  // Check if Wednesday is in season
  const wednesdayInSeason = (
    (wednesdayMonth > seasonStartMonth || (wednesdayMonth === seasonStartMonth && wednesdayDay >= seasonStartDay)) &&
    (wednesdayMonth < seasonEndMonth || (wednesdayMonth === seasonEndMonth && wednesdayDay <= seasonEndDay))
  );
  console.log(`Is in season: ${wednesdayInSeason}`);

  // Check if Wednesday is a holiday
  const wednesdayHoliday = holidays?.find(h => h.date === wednesdayStr && !h.is_disabled);
  console.log(`Is holiday: ${wednesdayHoliday ? 'YES - ' + wednesdayHoliday.name : 'NO'}`);

  const shouldBeOpen = isOperatingDay && wednesdayInSeason && !wednesdayHoliday;
  console.log(`Should be open: ${shouldBeOpen ? 'YES' : 'NO'}`);
  console.log('');

  // 5. Force regenerate the schedule
  console.log('5. Force regenerating schedule...');
  
  // Clear future data
  const todayStr = new Date().toISOString().split('T')[0];
  
  await supabase.from('time_slots').delete().gte('date', todayStr);
  await supabase.from('open_days').delete().gte('date', todayStr);

  // Call the fixed SQL function
  const { error: refreshError } = await supabase.rpc('refresh_future_schedule');
  if (refreshError) {
    console.error('Error refreshing schedule:', refreshError);
    return;
  }

  console.log('✅ Schedule regenerated');
  console.log('');

  // 6. Check the result
  console.log('6. Checking Wednesday after regeneration:');
  const { data: updatedOpenDays } = await supabase
    .from('open_days')
    .select('date, is_open')
    .gte('date', todayStr)
    .lte('date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('date');

  updatedOpenDays?.forEach(day => {
    const dayName = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    if (dayName === 'wednesday') {
      console.log(`${day.date} (${dayName}): ${day.is_open ? 'OPEN' : 'CLOSED'} ${day.is_open ? '✅' : '❌'}`);
    }
  });

  console.log('\n🎯 Diagnosis:');
  if (!withinSeason) {
    console.log('❌ ISSUE: Current date is outside the business season');
    console.log(`   Season: ${seasonStartMonth}/${seasonStartDay} - ${seasonEndMonth}/${seasonEndDay}`);
    console.log(`   Current: ${currentMonth}/${currentDay}`);
    console.log('   Solution: Update season settings in admin interface');
  } else if (wednesdayHoliday) {
    console.log('❌ ISSUE: Wednesday is marked as a holiday');
    console.log('   Solution: Disable the holiday in admin interface');
  } else if (!isOperatingDay) {
    console.log('❌ ISSUE: Wednesday is not in operating days');
    console.log('   This should not happen - check database');
  } else {
    console.log('✅ All conditions met - Wednesday should be open');
    console.log('   If still closed, there may be a bug in the SQL function');
  }
}

debugWednesdayIssue().catch(console.error);
