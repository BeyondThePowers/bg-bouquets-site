import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSQLFunctionDirectly() {
  console.log('🔬 Testing SQL Function Logic Directly...\n');

  // 1. Get the exact data the SQL function uses
  console.log('1. Getting exact data used by SQL function:');
  const { data: allSettings } = await supabase
    .from('schedule_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['operating_days', 'time_slots']);

  const settingsMap = {};
  allSettings?.forEach(s => {
    settingsMap[s.setting_key] = s.setting_value;
  });

  console.log('Raw operating_days from DB:', settingsMap.operating_days);
  console.log('Raw time_slots from DB:', settingsMap.time_slots);
  console.log('');

  // 2. Test the array check logic manually
  console.log('2. Testing array check logic:');
  const operatingDays = settingsMap.operating_days; // Keep as JSONB
  const timeSlots = settingsMap.time_slots; // Keep as JSONB
  
  console.log('Operating days JSONB:', operatingDays);
  console.log('Time slots JSONB:', timeSlots);
  
  // Test the specific logic used in the SQL function
  const testDate = '2025-07-23'; // Next Wednesday
  const testTime = '10:00 AM'; // First time slot
  
  console.log(`Testing date: ${testDate}`);
  console.log(`Testing time: ${testTime}`);
  console.log('');

  // 3. Test the SQL function components using raw SQL
  console.log('3. Testing SQL function components:');
  
  // Test day name extraction
  const { data: dayNameResult } = await supabase.rpc('exec_sql', {
    sql_query: `SELECT LOWER(TRIM(TO_CHAR('${testDate}'::date, 'Day'))) as day_name;`
  });
  
  if (dayNameResult && dayNameResult.length > 0) {
    const dayName = dayNameResult[0].day_name;
    console.log(`Day name extracted: "${dayName}"`);
    
    // Test the array contains check
    const { data: arrayCheckResult } = await supabase.rpc('exec_sql', {
      sql_query: `SELECT ('${JSON.stringify(operatingDays)}'::jsonb @> to_jsonb('${dayName}')) as is_operating_day;`
    });
    
    if (arrayCheckResult && arrayCheckResult.length > 0) {
      console.log(`Array contains check: ${arrayCheckResult[0].is_operating_day}`);
    }
    
    // Test time slot check
    const { data: timeCheckResult } = await supabase.rpc('exec_sql', {
      sql_query: `SELECT ('${JSON.stringify(timeSlots)}'::jsonb @> to_jsonb('${testTime}')) as is_valid_time;`
    });
    
    if (timeCheckResult && timeCheckResult.length > 0) {
      console.log(`Time slot check: ${timeCheckResult[0].is_valid_time}`);
    }
    
    // Test holiday check
    const { data: holidayCheckResult } = await supabase.rpc('exec_sql', {
      sql_query: `SELECT EXISTS(SELECT 1 FROM holidays WHERE date = '${testDate}' AND (is_disabled IS FALSE OR is_disabled IS NULL)) as is_holiday;`
    });
    
    if (holidayCheckResult && holidayCheckResult.length > 0) {
      console.log(`Holiday check: ${holidayCheckResult[0].is_holiday}`);
    }
    
  } else {
    console.log('❌ Could not extract day name');
  }
  console.log('');

  // 4. Test the complete is_slot_valid_in_schedule function
  console.log('4. Testing complete is_slot_valid_in_schedule function:');
  try {
    const { data: functionResult, error: functionError } = await supabase.rpc('is_slot_valid_in_schedule', {
      check_date: testDate,
      check_time: testTime,
      operating_days: operatingDays,
      time_slots_config: timeSlots
    });
    
    if (functionError) {
      console.error('Function error:', functionError);
    } else {
      console.log(`is_slot_valid_in_schedule result: ${functionResult}`);
    }
  } catch (err) {
    console.error('Error calling function:', err);
  }
  console.log('');

  // 5. Apply the working manual fix
  console.log('5. Applying manual fix to verify logic:');
  
  // Clear and regenerate manually with the exact same logic
  const todayStr = new Date().toISOString().split('T')[0];
  
  await supabase.from('time_slots').delete().gte('date', todayStr);
  await supabase.from('open_days').delete().gte('date', todayStr);

  // Manual generation with exact same logic as SQL function should use
  const { data: seasonSettings } = await supabase
    .from('schedule_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['season_start_month', 'season_start_day', 'season_end_month', 'season_end_day', 'max_bouquets_per_slot', 'max_bookings_per_slot']);

  const seasonMap = {};
  seasonSettings?.forEach(s => {
    seasonMap[s.setting_key] = s.setting_value;
  });

  const seasonStartMonth = parseInt(seasonMap.season_start_month || '5');
  const seasonStartDay = parseInt(seasonMap.season_start_day || '21');
  const seasonEndMonth = parseInt(seasonMap.season_end_month || '9');
  const seasonEndDay = parseInt(seasonMap.season_end_day || '9');
  const maxBouquets = parseInt(seasonMap.max_bouquets_per_slot || '10');
  const maxBookings = parseInt(seasonMap.max_bookings_per_slot || '3');

  const parsedOperatingDays = JSON.parse(operatingDays);
  const parsedTimeSlots = JSON.parse(timeSlots);

  console.log('Manual generation with parsed data:');
  console.log('Operating days:', parsedOperatingDays);
  console.log('Time slots:', parsedTimeSlots);

  const generatedDays = [];
  const generatedSlots = [];

  for (let i = 0; i < 14; i++) {
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() + i);
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    const month = currentDate.getMonth() + 1;
    const day = currentDate.getDate();
    const withinSeason = (
      (month > seasonStartMonth || (month === seasonStartMonth && day >= seasonStartDay)) &&
      (month < seasonEndMonth || (month === seasonEndMonth && day <= seasonEndDay))
    );

    const isOperatingDay = parsedOperatingDays.includes(dayName);
    const isOpen = isOperatingDay && withinSeason;

    generatedDays.push({
      date: dateStr,
      is_open: isOpen
    });

    if (isOpen) {
      parsedTimeSlots.forEach(timeSlot => {
        generatedSlots.push({
          date: dateStr,
          time: timeSlot,
          max_bouquets: maxBouquets,
          max_bookings: maxBookings,
          is_legacy: false
        });
      });
    }

    if (dayName === 'wednesday') {
      console.log(`${dateStr} (${dayName}): Operating=${isOperatingDay}, Season=${withinSeason}, Open=${isOpen}`);
    }
  }

  // Insert manual data
  if (generatedDays.length > 0) {
    await supabase.from('open_days').insert(generatedDays);
  }
  if (generatedSlots.length > 0) {
    await supabase.from('time_slots').insert(generatedSlots);
  }

  console.log(`✅ Manual generation: ${generatedDays.filter(d => d.is_open).length} open days, ${generatedSlots.length} time slots`);

  // Check result
  const { data: finalCheck } = await supabase
    .from('open_days')
    .select('date, is_open')
    .eq('date', '2025-07-23')
    .single();

  console.log(`Final check - 2025-07-23: ${finalCheck?.is_open ? 'OPEN' : 'CLOSED'} ${finalCheck?.is_open ? '✅' : '❌'}`);
}

testSQLFunctionDirectly().catch(console.error);
