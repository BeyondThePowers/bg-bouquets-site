import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testOperatingDaysFix() {
  console.log('🔍 Testing Operating Days Fix...\n');

  // 1. Check current operating days format
  console.log('1. Checking current operating days format:');
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
  console.log('Is Array:', Array.isArray(currentSettings.setting_value));
  console.log('');

  // 2. Read and execute the fix script
  console.log('2. Executing the fix script...');
  const sqlScript = fs.readFileSync('./database/fix-operating-days-format-with-validation.sql', 'utf8');
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlScript });
    
    if (error) {
      console.error('Error executing fix script:', error);
      return;
    }
    
    console.log('✅ Fix script executed successfully');
    console.log('');
  } catch (err) {
    console.error('Error running fix script:', err);
    return;
  }

  // 3. Check operating days format after fix
  console.log('3. Checking operating days format after fix:');
  const { data: afterSettings, error: afterError } = await supabase
    .from('schedule_settings')
    .select('setting_key, setting_value')
    .eq('setting_key', 'operating_days')
    .single();

  if (afterError) {
    console.error('Error fetching after settings:', afterError);
    return;
  }

  console.log('After fix operating_days:', afterSettings.setting_value);
  console.log('Type:', typeof afterSettings.setting_value);
  console.log('Is Array:', Array.isArray(afterSettings.setting_value));
  console.log('');

  // 4. Check if open days were generated correctly
  console.log('4. Checking if open days were generated correctly:');
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
  console.log('');

  // 5. Test the availability API
  console.log('5. Testing availability API:');
  try {
    const response = await fetch('http://localhost:4322/api/availability');
    const availability = await response.json();
    
    console.log('Availability API response:');
    console.log(JSON.stringify(availability, null, 2));
  } catch (err) {
    console.error('Error testing availability API:', err);
  }

  console.log('\n✅ Operating days fix test completed!');
}

testOperatingDaysFix().catch(console.error);
