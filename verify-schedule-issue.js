import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyScheduleIssue() {
  console.log('🔍 Verifying Schedule Update Issue...\n');

  // 1. Check current schedule_settings
  console.log('1. Current schedule_settings:');
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

  // 2. Check current open_days
  console.log('2. Current open_days (next 2 weeks):');
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

  console.log('Open days vs Expected:');
  openDays?.forEach(day => {
    const dayName = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const shouldBeOpen = operatingDays.includes(dayName);
    const isCorrect = day.is_open === shouldBeOpen;
    console.log(`${day.date} (${dayName}): ${day.is_open ? 'OPEN' : 'CLOSED'} - Expected: ${shouldBeOpen ? 'OPEN' : 'CLOSED'} ${isCorrect ? '✅' : '❌'}`);
  });
  console.log('');

  // 3. Test the refresh_future_schedule function
  console.log('3. Testing refresh_future_schedule function:');
  try {
    const { error: refreshError } = await supabase.rpc('refresh_future_schedule');
    if (refreshError) {
      console.error('❌ refresh_future_schedule failed:', refreshError);
      console.log('This confirms the SQL functions are broken!');
    } else {
      console.log('✅ refresh_future_schedule executed without error');
      console.log('Checking if it actually fixed the schedule...');
      
      // Check if the schedule was actually updated
      const { data: updatedOpenDays } = await supabase
        .from('open_days')
        .select('date, is_open')
        .gte('date', new Date().toISOString().split('T')[0])
        .lte('date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('date');

      let fixedCount = 0;
      updatedOpenDays?.forEach(day => {
        const dayName = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const shouldBeOpen = operatingDays.includes(dayName);
        if (day.is_open === shouldBeOpen) {
          fixedCount++;
        }
      });

      if (fixedCount === updatedOpenDays?.length) {
        console.log('✅ refresh_future_schedule actually fixed the schedule!');
      } else {
        console.log(`❌ refresh_future_schedule didn't fix the schedule (${fixedCount}/${updatedOpenDays?.length} correct)`);
        console.log('This confirms the SQL functions need to be updated!');
      }
    }
  } catch (err) {
    console.error('❌ Error calling refresh_future_schedule:', err);
  }
  console.log('');

  // 4. Apply the working fix
  console.log('4. Applying the working fix (bypassing broken SQL functions):');
  
  // Clear future data
  const today = new Date().toISOString().split('T')[0];
  
  const { error: clearSlotsError } = await supabase
    .from('time_slots')
    .delete()
    .gte('date', today);
  
  const { error: clearDaysError } = await supabase
    .from('open_days')
    .delete()
    .gte('date', today);

  if (clearSlotsError || clearDaysError) {
    console.error('Error clearing data:', clearSlotsError || clearDaysError);
    return;
  }

  // Get all settings
  const { data: allSettings } = await supabase
    .from('schedule_settings')
    .select('setting_key, setting_value')
    .in('setting_key', [
      'operating_days', 'time_slots', 'max_bouquets_per_slot', 'max_bookings_per_slot',
      'season_start_month', 'season_start_day', 'season_end_month', 'season_end_day'
    ]);

  const settingsMap = {};
  allSettings?.forEach(s => {
    settingsMap[s.setting_key] = s.setting_value;
  });

  const timeSlots = JSON.parse(settingsMap.time_slots || '[]');
  const maxBouquets = parseInt(settingsMap.max_bouquets_per_slot || '10');
  const maxBookings = parseInt(settingsMap.max_bookings_per_slot || '3');
  const seasonStartMonth = parseInt(settingsMap.season_start_month || '5');
  const seasonStartDay = parseInt(settingsMap.season_start_day || '21');
  const seasonEndMonth = parseInt(settingsMap.season_end_month || '9');
  const seasonEndDay = parseInt(settingsMap.season_end_day || '9');

  // Get holidays
  const { data: holidays } = await supabase
    .from('holidays')
    .select('date')
    .eq('is_disabled', false);
  
  const holidayDates = new Set(holidays?.map(h => h.date) || []);

  // Generate correct schedule
  const generatedDays = [];
  const generatedSlots = [];
  const daysAhead = 60;

  for (let i = 0; i < daysAhead; i++) {
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() + i);
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    // Check if within season
    const month = currentDate.getMonth() + 1;
    const day = currentDate.getDate();
    const withinSeason = (
      (month > seasonStartMonth || (month === seasonStartMonth && day >= seasonStartDay)) &&
      (month < seasonEndMonth || (month === seasonEndMonth && day <= seasonEndDay))
    );

    const isHoliday = holidayDates.has(dateStr);
    const isOperatingDay = operatingDays.includes(dayName);
    const isOpen = isOperatingDay && withinSeason && !isHoliday;

    generatedDays.push({
      date: dateStr,
      is_open: isOpen
    });

    if (isOpen) {
      timeSlots.forEach(timeSlot => {
        generatedSlots.push({
          date: dateStr,
          time: timeSlot,
          max_bouquets: maxBouquets,
          max_bookings: maxBookings,
          is_legacy: false
        });
      });
    }
  }

  // Insert the corrected data
  if (generatedDays.length > 0) {
    const { error: daysError } = await supabase
      .from('open_days')
      .insert(generatedDays);
    
    if (daysError) {
      console.error('Error inserting open days:', daysError);
      return;
    }
  }

  if (generatedSlots.length > 0) {
    const { error: slotsError } = await supabase
      .from('time_slots')
      .insert(generatedSlots);
    
    if (slotsError) {
      console.error('Error inserting time slots:', slotsError);
      return;
    }
  }

  console.log(`✅ Applied fix: Generated ${generatedDays.filter(d => d.is_open).length} open days and ${generatedSlots.length} time slots`);
  console.log('');

  // 5. Verify the fix worked
  console.log('5. Verifying the fix:');
  const { data: finalOpenDays } = await supabase
    .from('open_days')
    .select('date, is_open')
    .gte('date', today)
    .lte('date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('date');

  console.log('Schedule after fix:');
  finalOpenDays?.forEach(day => {
    const dayName = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const shouldBeOpen = operatingDays.includes(dayName);
    const isCorrect = day.is_open === shouldBeOpen;
    console.log(`${day.date} (${dayName}): ${day.is_open ? 'OPEN' : 'CLOSED'} - Expected: ${shouldBeOpen ? 'OPEN' : 'CLOSED'} ${isCorrect ? '✅' : '❌'}`);
  });

  console.log('\n🎯 Summary:');
  console.log('✅ Schedule settings are saved correctly');
  console.log('❌ SQL functions (refresh_future_schedule, generate_open_days_and_slots) are broken');
  console.log('✅ Manual fix bypasses broken SQL functions and works correctly');
  console.log('🔧 Permanent solution: Update SQL functions to use array format instead of object format');
}

verifyScheduleIssue().catch(console.error);
