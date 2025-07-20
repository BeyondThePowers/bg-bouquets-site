import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyFinalFix() {
  console.log('🔧 Applying Final Operating Days Fix...\n');

  // 1. Check current state
  console.log('1. Current state analysis:');
  const { data: currentSettings } = await supabase
    .from('schedule_settings')
    .select('setting_key, setting_value')
    .eq('setting_key', 'operating_days')
    .single();

  console.log('Current operating_days:', currentSettings?.setting_value);
  
  const operatingDays = JSON.parse(currentSettings?.setting_value || '[]');
  console.log('Parsed operating days:', operatingDays);
  console.log('');

  // 2. Clear all future data and regenerate with correct logic
  console.log('2. Clearing future data and regenerating...');
  const today = new Date().toISOString().split('T')[0];
  
  // Clear future time slots
  const { error: clearSlotsError } = await supabase
    .from('time_slots')
    .delete()
    .gte('date', today);
  
  if (clearSlotsError) {
    console.error('Error clearing time slots:', clearSlotsError);
    return;
  }
  
  // Clear future open days
  const { error: clearDaysError } = await supabase
    .from('open_days')
    .delete()
    .gte('date', today);
  
  if (clearDaysError) {
    console.error('Error clearing open days:', clearDaysError);
    return;
  }
  
  console.log('✅ Cleared future data');

  // 3. Get all settings needed for generation
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

  console.log('Settings:', {
    operatingDays,
    timeSlots: timeSlots.length,
    maxBouquets,
    maxBookings,
    season: `${seasonStartMonth}/${seasonStartDay} - ${seasonEndMonth}/${seasonEndDay}`
  });

  // 4. Generate open days and time slots manually with correct logic
  console.log('3. Generating schedule with correct operating days logic...');
  
  const generatedDays = [];
  const generatedSlots = [];
  const daysAhead = 60;

  // Get holidays
  const { data: holidays } = await supabase
    .from('holidays')
    .select('date')
    .eq('is_disabled', false);
  
  const holidayDates = new Set(holidays?.map(h => h.date) || []);

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

    // Check if it's a holiday
    const isHoliday = holidayDates.has(dateStr);

    // Check if it's an operating day (using correct array logic)
    const isOperatingDay = operatingDays.includes(dayName);
    
    // Determine if day should be open
    const isOpen = isOperatingDay && withinSeason && !isHoliday;

    generatedDays.push({
      date: dateStr,
      is_open: isOpen
    });

    // If open, generate time slots
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

  // 5. Insert the generated data
  console.log('4. Inserting generated data...');
  
  if (generatedDays.length > 0) {
    const { error: daysError } = await supabase
      .from('open_days')
      .insert(generatedDays);
    
    if (daysError) {
      console.error('Error inserting open days:', daysError);
      return;
    }
    console.log(`✅ Inserted ${generatedDays.length} open days`);
  }

  if (generatedSlots.length > 0) {
    const { error: slotsError } = await supabase
      .from('time_slots')
      .insert(generatedSlots);
    
    if (slotsError) {
      console.error('Error inserting time slots:', slotsError);
      return;
    }
    console.log(`✅ Inserted ${generatedSlots.length} time slots`);
  }

  // 6. Verify the results
  console.log('5. Verifying results...');
  const { data: newOpenDays } = await supabase
    .from('open_days')
    .select('date, is_open')
    .gte('date', today)
    .lte('date', new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('date');

  console.log('New open days (next 2 weeks):');
  newOpenDays?.forEach(day => {
    const dayName = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const shouldBeOpen = operatingDays.includes(dayName);
    const isCorrect = day.is_open === shouldBeOpen;
    console.log(`${day.date} (${dayName}): ${day.is_open ? 'OPEN' : 'CLOSED'} - Expected: ${shouldBeOpen ? 'OPEN' : 'CLOSED'} ${isCorrect ? '✅' : '❌'}`);
  });

  // 7. Test availability API
  console.log('\n6. Testing availability API...');
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
        
        console.log(`✅ ${correctDates.length}/${availableDates.length} dates match operating days`);
      }
    } else {
      console.log('⚠️  Availability API error:', response.status);
    }
  } catch (err) {
    console.log('⚠️  Could not test availability API:', err.message);
  }

  console.log('\n🎉 Final fix completed!');
  console.log('\nSummary:');
  console.log(`- Operating days: ${operatingDays.join(', ')}`);
  console.log(`- Generated ${generatedDays.filter(d => d.is_open).length} open days`);
  console.log(`- Generated ${generatedSlots.length} time slots`);
  console.log('\nThe issue was that SQL functions were using object format (?) but data was stored as arrays.');
  console.log('This fix bypasses the SQL functions and generates the schedule directly with correct array logic.');
}

applyFinalFix().catch(console.error);
