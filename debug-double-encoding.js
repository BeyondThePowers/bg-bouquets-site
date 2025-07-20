import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugDoubleEncoding() {
  console.log('🔍 Debugging Double JSON Encoding Issue...\n');

  // 1. Check current database values
  console.log('1. Current database values:');
  const { data: allSettings } = await supabase
    .from('schedule_settings')
    .select('setting_key, setting_value')
    .order('setting_key');

  console.log('Raw database values:');
  allSettings?.forEach(setting => {
    console.log(`${setting.setting_key}: ${JSON.stringify(setting.setting_value)} (type: ${typeof setting.setting_value})`);
  });
  console.log('');

  // 2. Test simple update without JSON.stringify
  console.log('2. Testing update without JSON.stringify:');
  try {
    const { error: simpleError } = await supabase
      .from('schedule_settings')
      .upsert({
        setting_key: 'test_simple',
        setting_value: 'simple_value',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      });

    if (simpleError) {
      console.error('Simple update failed:', simpleError);
    } else {
      console.log('✅ Simple update successful');
    }
  } catch (err) {
    console.error('Simple update error:', err);
  }
  console.log('');

  // 3. Test update with single JSON.stringify
  console.log('3. Testing update with single JSON.stringify:');
  try {
    const testValue = ['thursday', 'friday', 'saturday'];
    const { error: jsonError } = await supabase
      .from('schedule_settings')
      .upsert({
        setting_key: 'test_json',
        setting_value: JSON.stringify(testValue),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      });

    if (jsonError) {
      console.error('JSON update failed:', jsonError);
    } else {
      console.log('✅ JSON update successful');
    }
  } catch (err) {
    console.error('JSON update error:', err);
  }
  console.log('');

  // 4. Check what was actually stored
  console.log('4. Checking what was stored:');
  const { data: testSettings } = await supabase
    .from('schedule_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['test_simple', 'test_json']);

  testSettings?.forEach(setting => {
    console.log(`${setting.setting_key}: ${JSON.stringify(setting.setting_value)} (type: ${typeof setting.setting_value})`);
    
    if (setting.setting_key === 'test_json') {
      try {
        const parsed = JSON.parse(setting.setting_value);
        console.log(`  Parsed: ${JSON.stringify(parsed)}`);
      } catch (e) {
        console.log(`  Parse error: ${e.message}`);
      }
    }
  });
  console.log('');

  // 5. Test the problematic max_bouquets_per_slot value
  console.log('5. Testing problematic max_bouquets_per_slot:');
  const problematicSetting = allSettings?.find(s => s.setting_key === 'max_bouquets_per_slot');
  if (problematicSetting) {
    console.log('Current value:', JSON.stringify(problematicSetting.setting_value));
    console.log('Type:', typeof problematicSetting.setting_value);
    
    // Try to parse it
    try {
      if (typeof problematicSetting.setting_value === 'string') {
        let parsed = problematicSetting.setting_value;
        
        // Handle double encoding
        if (parsed.startsWith('"') && parsed.endsWith('"')) {
          parsed = JSON.parse(parsed);
          console.log('After first parse:', JSON.stringify(parsed));
          
          if (typeof parsed === 'string' && parsed.startsWith('"') && parsed.endsWith('"')) {
            parsed = JSON.parse(parsed);
            console.log('After second parse:', JSON.stringify(parsed));
          }
        }
        
        const finalValue = parseInt(parsed);
        console.log('Final integer value:', finalValue);
        
        // Try to fix it
        const { error: fixError } = await supabase
          .from('schedule_settings')
          .upsert({
            setting_key: 'max_bouquets_per_slot',
            setting_value: JSON.stringify(finalValue),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'setting_key'
          });

        if (fixError) {
          console.error('Fix failed:', fixError);
        } else {
          console.log('✅ Fixed max_bouquets_per_slot');
        }
      }
    } catch (e) {
      console.error('Parse error:', e.message);
    }
  }
  console.log('');

  // 6. Clean up test values
  console.log('6. Cleaning up test values:');
  await supabase.from('schedule_settings').delete().in('setting_key', ['test_simple', 'test_json']);
  console.log('✅ Test values cleaned up');

  console.log('\n🎯 Double Encoding Analysis:');
  console.log('The issue appears to be that some values in the database are double-JSON-encoded.');
  console.log('This happens when JSON.stringify is called on values that are already JSON strings.');
  console.log('Solution: Fix the existing double-encoded values and prevent future double-encoding.');
}

debugDoubleEncoding().catch(console.error);
