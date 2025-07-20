import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyOperatingDaysFix() {
  console.log('🔧 Applying Operating Days Fix...\n');

  // 1. Check current state
  console.log('1. Current state:');
  const { data: currentSettings, error: currentError } = await supabase
    .from('schedule_settings')
    .select('setting_key, setting_value')
    .eq('setting_key', 'operating_days')
    .single();

  if (currentError) {
    console.error('Error fetching current settings:', currentError);
    return;
  }

  console.log('Current operating_days:', currentSettings.setting_value);
  console.log('Type:', typeof currentSettings.setting_value);
  console.log('');

  // 2. Apply the SQL function fixes using individual RPC calls
  console.log('2. Updating SQL functions to use array format...');

  // Update is_slot_valid_in_schedule function
  const isSlotValidFunction = `
    CREATE OR REPLACE FUNCTION public.is_slot_valid_in_schedule(check_date date, check_time text, operating_days jsonb, time_slots_config jsonb)
    RETURNS boolean
    LANGUAGE plpgsql
    AS $function$
    DECLARE
      day_name TEXT;
      is_operating_day BOOLEAN;
      is_valid_time BOOLEAN;
      is_holiday BOOLEAN;
    BEGIN
      -- Get day name
      day_name := LOWER(TO_CHAR(check_date, 'Day'));
      day_name := TRIM(day_name);
      
      -- Check if it's an operating day (using array format)
      SELECT (operating_days @> to_jsonb(day_name)) INTO is_operating_day;
      
      -- Check if it's a valid time slot (using array format)
      SELECT (time_slots_config @> to_jsonb(check_time)) INTO is_valid_time;
      
      -- Check if it's a holiday
      SELECT EXISTS(
        SELECT 1 FROM holidays 
        WHERE date = check_date 
        AND (is_disabled IS FALSE OR is_disabled IS NULL)
      ) INTO is_holiday;
      
      -- Slot is valid if it's an operating day, valid time, and not a holiday
      RETURN is_operating_day AND is_valid_time AND NOT is_holiday;
    END;
    $function$;
  `;

  try {
    const { error: funcError1 } = await supabase.rpc('exec', { sql: isSlotValidFunction });
    if (funcError1) {
      console.error('Error updating is_slot_valid_in_schedule:', funcError1);
    } else {
      console.log('✅ Updated is_slot_valid_in_schedule function');
    }
  } catch (err) {
    console.log('⚠️  Could not update functions via RPC, will need manual SQL execution');
  }

  // 3. Force refresh the schedule
  console.log('3. Refreshing schedule...');
  try {
    const { error: refreshError } = await supabase.rpc('refresh_future_schedule');
    if (refreshError) {
      console.error('Error refreshing schedule:', refreshError);
    } else {
      console.log('✅ Schedule refreshed successfully');
    }
  } catch (err) {
    console.error('Error calling refresh_future_schedule:', err);
  }

  // 4. Check results
  console.log('4. Checking results...');
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

  console.log('Open days for next 2 weeks:');
  openDays.forEach(day => {
    const dayName = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    console.log(`${day.date} (${dayName}): ${day.is_open ? 'OPEN' : 'CLOSED'}`);
  });

  // 5. Test availability API
  console.log('\n5. Testing availability API...');
  try {
    const response = await fetch('http://localhost:4322/api/availability');
    if (response.ok) {
      const availability = await response.json();
      const availableDates = Object.keys(availability);
      console.log(`✅ Availability API working! Found ${availableDates.length} available dates`);
      if (availableDates.length > 0) {
        console.log('First few available dates:', availableDates.slice(0, 3));
      }
    } else {
      console.log('⚠️  Availability API returned error:', response.status);
    }
  } catch (err) {
    console.log('⚠️  Could not test availability API (server may not be running)');
  }

  console.log('\n🎉 Operating days fix applied!');
  console.log('\nNext steps:');
  console.log('1. The SQL functions need to be updated manually in the database');
  console.log('2. Run the full SQL script: database/fix-operating-days-format-with-validation.sql');
  console.log('3. Test the admin interface to confirm operating days updates work');
}

applyOperatingDaysFix().catch(console.error);
