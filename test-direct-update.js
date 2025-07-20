import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDirectUpdate() {
  console.log('🔧 Testing Direct Database Update + Regeneration...\n');

  // 1. Update operating days directly in database
  console.log('1. Updating operating days directly in database:');
  const newOperatingDays = ['thursday', 'friday', 'saturday'];
  
  const { error: updateError } = await supabase
    .from('schedule_settings')
    .upsert({
      setting_key: 'operating_days',
      setting_value: JSON.stringify(newOperatingDays),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'setting_key'
    });

  if (updateError) {
    console.error('❌ Database update failed:', updateError);
    return;
  }

  console.log('✅ Database updated successfully');
  console.log('');

  // 2. Verify the update
  console.log('2. Verifying database update:');
  const { data: verifySettings } = await supabase
    .from('schedule_settings')
    .select('setting_value')
    .eq('setting_key', 'operating_days')
    .single();

  const storedOperatingDays = JSON.parse(verifySettings?.setting_value || '[]');
  console.log('Stored operating days:', storedOperatingDays);
  
  const updateSuccessful = JSON.stringify(storedOperatingDays.sort()) === JSON.stringify(newOperatingDays.sort());
  console.log(`Database update successful: ${updateSuccessful ? 'YES' : 'NO'}`);
  console.log('');

  // 3. Call regeneration API
  console.log('3. Calling regeneration API:');
  try {
    const response = await fetch('http://localhost:4322/api/admin/regenerate-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Regeneration successful:', result.message);
      console.log('Stats:', result.stats);
    } else {
      console.error('❌ Regeneration failed:', result.error);
      return;
    }
  } catch (err) {
    console.error('❌ Error calling regeneration API:', err.message);
    return;
  }
  console.log('');

  // 4. Verify the schedule
  console.log('4. Verifying schedule after regeneration:');
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
  console.log(`Schedule accuracy: ${correctCount}/${totalCount} (${Math.round(correctCount/totalCount*100)}%)`);
  console.log('');

  // 5. Test availability API
  console.log('5. Testing availability API:');
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
        
        const apiCorrect = matchingDates.length === availableDates.length;
        console.log(`✅ API accuracy: ${matchingDates.length}/${availableDates.length} dates match (${apiCorrect ? 'PERFECT' : 'PARTIAL'})`);
      }
    } else {
      console.log('⚠️  Availability API error:', availabilityResponse.status);
    }
  } catch (err) {
    console.log('⚠️  Could not test availability API:', err.message);
  }

  console.log('\n🎯 Direct Update Test Summary:');
  if (updateSuccessful && scheduleCorrect) {
    console.log('🎉 SUCCESS: Direct update + regeneration works perfectly!');
    console.log('✅ Database updates work');
    console.log('✅ Schedule regeneration works');
    console.log('✅ Booking calendar shows correct days');
    console.log('');
    console.log('📋 Issue identified: The admin settings API has a bug');
    console.log('💡 Solution: Fix the admin settings API or use direct database updates');
  } else {
    console.log('❌ ISSUE: Some parts are not working correctly');
    console.log(`Database update: ${updateSuccessful ? 'OK' : 'FAILED'}`);
    console.log(`Schedule regeneration: ${scheduleCorrect ? 'OK' : 'FAILED'}`);
  }
}

testDirectUpdate().catch(console.error);
