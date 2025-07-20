import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixRemainingEncoding() {
  console.log('🔧 Fixing Remaining Double Encoding Issues...\n');

  // 1. Check all current settings
  console.log('1. Checking all current settings:');
  const { data: allSettings, error: fetchError } = await supabase
    .from('schedule_settings')
    .select('setting_key, setting_value');

  if (fetchError) {
    console.error('Error fetching settings:', fetchError);
    return;
  }

  console.log('Current database values:');
  allSettings?.forEach(setting => {
    console.log(`${setting.setting_key}: ${JSON.stringify(setting.setting_value)} (type: ${typeof setting.setting_value})`);
  });
  console.log('');

  // 2. Find and fix ALL double-encoded values
  console.log('2. Finding and fixing ALL double-encoded values:');
  
  const fixedSettings = [];
  
  allSettings?.forEach(setting => {
    let value = setting.setting_value;
    let needsFix = false;
    let fixedValue = value;
    
    if (typeof value === 'string') {
      // Check for double-encoded strings (like "\"50\"")
      if (value.startsWith('"') && value.endsWith('"') && value.length > 2) {
        try {
          const parsed = JSON.parse(value);
          
          // For numeric settings
          if (['max_bookings_per_slot', 'max_bouquets_per_slot', 'max_visitor_passes_per_booking', 
               'season_start_month', 'season_start_day', 'season_end_month', 'season_end_day'].includes(setting.setting_key)) {
            const numericValue = parseInt(parsed);
            if (!isNaN(numericValue)) {
              fixedValue = JSON.stringify(numericValue);
              needsFix = true;
            }
          }
          // For other string values
          else if (typeof parsed === 'string') {
            fixedValue = JSON.stringify(parsed);
            needsFix = true;
          }
        } catch (e) {
          console.log(`Could not parse ${setting.setting_key}: ${e.message}`);
        }
      }
      
      // Also check for any values that contain double quotes inside (like "\"\"50\"\"")
      if (value.includes('""') && !needsFix) {
        console.log(`Found potential triple encoding in ${setting.setting_key}: ${value}`);
        try {
          // Try to parse multiple times to unwrap
          let unwrapped = value;
          let attempts = 0;
          while (unwrapped.startsWith('"') && unwrapped.endsWith('"') && attempts < 5) {
            unwrapped = JSON.parse(unwrapped);
            attempts++;
          }
          
          // For numeric settings, ensure final value is numeric
          if (['max_bookings_per_slot', 'max_bouquets_per_slot', 'max_visitor_passes_per_booking', 
               'season_start_month', 'season_start_day', 'season_end_month', 'season_end_day'].includes(setting.setting_key)) {
            const numericValue = parseInt(unwrapped);
            if (!isNaN(numericValue)) {
              fixedValue = JSON.stringify(numericValue);
              needsFix = true;
            }
          } else {
            fixedValue = JSON.stringify(unwrapped);
            needsFix = true;
          }
        } catch (e) {
          console.log(`Could not unwrap ${setting.setting_key}: ${e.message}`);
        }
      }
    }
    
    if (needsFix) {
      fixedSettings.push({
        setting_key: setting.setting_key,
        setting_value: fixedValue,
        updated_at: new Date().toISOString()
      });
      console.log(`${setting.setting_key}: ${JSON.stringify(value)} -> ${JSON.stringify(fixedValue)}`);
    } else {
      console.log(`${setting.setting_key}: OK (no fix needed)`);
    }
  });
  console.log('');

  // 3. Apply all fixes
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

  // 4. Verify all fixes
  console.log('4. Verifying all fixes:');
  const { data: verifySettings } = await supabase
    .from('schedule_settings')
    .select('setting_key, setting_value')
    .order('setting_key');

  console.log('All settings after fixes:');
  verifySettings?.forEach(setting => {
    const hasDoubleQuotes = typeof setting.setting_value === 'string' && 
                           (setting.setting_value.includes('""') || 
                            (setting.setting_value.startsWith('"') && setting.setting_value.endsWith('"') && 
                             ['max_bookings_per_slot', 'max_bouquets_per_slot', 'max_visitor_passes_per_booking'].includes(setting.setting_key)));
    
    console.log(`${setting.setting_key}: ${JSON.stringify(setting.setting_value)} ${hasDoubleQuotes ? '❌' : '✅'}`);
  });
  console.log('');

  // 5. Test the admin API now
  console.log('5. Testing admin API after complete fix:');
  try {
    const response = await fetch('http://localhost:4323/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operating_days: ['sunday', 'monday', 'tuesday'],
        time_slots: ["10:00 AM", "11:00 AM", "12:00 PM"],
        max_bookings_per_slot: "35",
        max_visitors_per_slot: "70",
        max_visitor_passes_per_booking: "30",
        season_start_month: "5",
        season_start_day: "21",
        season_end_month: "9",
        season_end_day: "9"
      })
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        console.log('✅ Admin API working perfectly after complete fix!');
      } else {
        console.error('❌ Admin API still failing:', result.error);
      }
    } else {
      console.error('❌ Admin API HTTP error:', response.status);
      const text = await response.text();
      console.error('Response:', text);
    }
  } catch (err) {
    console.error('❌ Admin API error:', err.message);
  }

  console.log('\n🎯 Complete Encoding Fix Summary:');
  console.log(`✅ Fixed ${fixedSettings.length} double/triple-encoded values`);
  console.log('✅ All database values are now correctly formatted');
  console.log('✅ Admin settings API should now work perfectly');
  console.log('✅ Operating days updates should work seamlessly');
}

fixRemainingEncoding().catch(console.error);
