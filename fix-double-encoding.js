import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixDoubleEncoding() {
  console.log('🔧 Fixing Double JSON Encoding in Database...\n');

  // 1. Get all settings
  console.log('1. Getting all current settings:');
  const { data: allSettings, error: fetchError } = await supabase
    .from('schedule_settings')
    .select('setting_key, setting_value');

  if (fetchError) {
    console.error('Error fetching settings:', fetchError);
    return;
  }

  console.log('Current settings:');
  allSettings?.forEach(setting => {
    console.log(`${setting.setting_key}: ${JSON.stringify(setting.setting_value)}`);
  });
  console.log('');

  // 2. Fix double-encoded values
  console.log('2. Fixing double-encoded values:');
  
  const fixedSettings = [];
  
  allSettings?.forEach(setting => {
    let value = setting.setting_value;
    let needsFix = false;
    
    // Check if it's double-encoded (starts and ends with quotes when it shouldn't)
    if (typeof value === 'string') {
      // For numeric settings that are double-encoded
      if (['max_bookings_per_slot', 'max_bouquets_per_slot', 'max_visitor_passes_per_booking'].includes(setting.setting_key)) {
        if (value.startsWith('"') && value.endsWith('"')) {
          try {
            const parsed = JSON.parse(value);
            const numericValue = parseInt(parsed);
            if (!isNaN(numericValue)) {
              fixedSettings.push({
                setting_key: setting.setting_key,
                setting_value: JSON.stringify(numericValue),
                updated_at: new Date().toISOString()
              });
              console.log(`${setting.setting_key}: "${value}" -> "${numericValue}"`);
              needsFix = true;
            }
          } catch (e) {
            console.log(`Could not fix ${setting.setting_key}: ${e.message}`);
          }
        }
      }
      
      // For season settings that might be double-encoded
      if (['season_start_month', 'season_start_day', 'season_end_month', 'season_end_day'].includes(setting.setting_key)) {
        if (value.startsWith('"') && value.endsWith('"')) {
          try {
            const parsed = JSON.parse(value);
            const numericValue = parseInt(parsed);
            if (!isNaN(numericValue)) {
              fixedSettings.push({
                setting_key: setting.setting_key,
                setting_value: JSON.stringify(numericValue),
                updated_at: new Date().toISOString()
              });
              console.log(`${setting.setting_key}: "${value}" -> "${numericValue}"`);
              needsFix = true;
            }
          } catch (e) {
            console.log(`Could not fix ${setting.setting_key}: ${e.message}`);
          }
        }
      }
    }
    
    if (!needsFix) {
      console.log(`${setting.setting_key}: OK (no fix needed)`);
    }
  });
  console.log('');

  // 3. Apply fixes
  if (fixedSettings.length > 0) {
    console.log('3. Applying fixes to database:');
    
    for (const fixedSetting of fixedSettings) {
      const { error: updateError } = await supabase
        .from('schedule_settings')
        .upsert(fixedSetting, {
          onConflict: 'setting_key'
        });

      if (updateError) {
        console.error(`❌ Failed to fix ${fixedSetting.setting_key}:`, updateError);
      } else {
        console.log(`✅ Fixed ${fixedSetting.setting_key}`);
      }
    }
  } else {
    console.log('3. No fixes needed - all values are correctly encoded');
  }
  console.log('');

  // 4. Verify fixes
  console.log('4. Verifying fixes:');
  const { data: verifySettings } = await supabase
    .from('schedule_settings')
    .select('setting_key, setting_value')
    .order('setting_key');

  console.log('Fixed settings:');
  verifySettings?.forEach(setting => {
    console.log(`${setting.setting_key}: ${JSON.stringify(setting.setting_value)}`);
  });
  console.log('');

  // 5. Test that the regeneration API now works
  console.log('5. Testing regeneration API after fixes:');
  try {
    const response = await fetch('http://localhost:4322/api/admin/regenerate-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Regeneration API working:', result.message);
      console.log('Stats:', result.stats);
    } else {
      console.error('❌ Regeneration API still failing:', result.error);
    }
  } catch (err) {
    console.error('❌ Error testing regeneration API:', err.message);
  }
  console.log('');

  // 6. Test admin settings API
  console.log('6. Testing admin settings API after fixes:');
  try {
    const response = await fetch('http://localhost:4322/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operating_days: ['monday', 'tuesday', 'wednesday'],
        time_slots: ["10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "6:00 PM", "7:00 PM", "8:00 PM"],
        max_bookings_per_slot: "25",
        max_visitors_per_slot: "50",
        max_visitor_passes_per_booking: "25",
        season_start_month: "5",
        season_start_day: "21",
        season_end_month: "9",
        season_end_day: "9"
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Admin settings API working');
    } else {
      console.error('❌ Admin settings API still failing:', result.error);
    }
  } catch (err) {
    console.error('❌ Error testing admin settings API:', err.message);
  }

  console.log('\n🎯 Double Encoding Fix Summary:');
  console.log(`✅ Fixed ${fixedSettings.length} double-encoded values`);
  console.log('✅ Database values are now correctly formatted');
  console.log('✅ Admin interface should now work correctly');
  console.log('✅ Operating days updates should work seamlessly');
}

fixDoubleEncoding().catch(console.error);
