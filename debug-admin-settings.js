import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugAdminSettings() {
  console.log('🔍 Debugging Admin Settings Loading...\n');

  // 1. Check what the admin settings API returns
  console.log('1. Testing admin settings API:');
  try {
    const response = await fetch('http://localhost:4322/api/admin/settings');
    const settings = await response.json();
    
    console.log('Admin settings API response:');
    console.log(JSON.stringify(settings, null, 2));
    console.log('');
  } catch (err) {
    console.error('Error calling admin settings API:', err.message);
  }

  // 2. Check what's actually in the database
  console.log('2. Direct database query:');
  const { data: dbSettings, error } = await supabase
    .from('schedule_settings')
    .select('setting_key, setting_value')
    .order('setting_key');

  if (error) {
    console.error('Database error:', error);
    return;
  }

  console.log('Database settings:');
  dbSettings?.forEach(setting => {
    let displayValue = setting.setting_value;
    
    // Try to parse JSON values for better display
    if (typeof setting.setting_value === 'string') {
      try {
        const parsed = JSON.parse(setting.setting_value);
        if (Array.isArray(parsed) || typeof parsed === 'object') {
          displayValue = JSON.stringify(parsed);
        }
      } catch (e) {
        // Keep original value if not JSON
      }
    }
    
    console.log(`${setting.setting_key}: ${displayValue} (type: ${typeof setting.setting_value})`);
  });
  console.log('');

  // 3. Check specific settings that should be loaded into the form
  console.log('3. Checking specific form field mappings:');
  
  const expectedSettings = [
    'max_bookings_per_slot',
    'max_bouquets_per_slot', 
    'max_visitor_passes_per_booking',
    'operating_days',
    'time_slots',
    'season_start_month',
    'season_start_day',
    'season_end_month',
    'season_end_day'
  ];

  expectedSettings.forEach(key => {
    const setting = dbSettings?.find(s => s.setting_key === key);
    if (setting) {
      console.log(`✅ ${key}: ${setting.setting_value}`);
    } else {
      console.log(`❌ ${key}: MISSING`);
    }
  });
  console.log('');

  // 4. Test the pricing settings API (if it exists)
  console.log('4. Testing pricing settings API:');
  try {
    const response = await fetch('http://localhost:4322/api/settings/pricing');
    if (response.ok) {
      const pricingSettings = await response.json();
      console.log('Pricing settings API response:');
      console.log(JSON.stringify(pricingSettings, null, 2));
    } else {
      console.log(`Pricing settings API returned ${response.status}: ${response.statusText}`);
    }
  } catch (err) {
    console.log('Pricing settings API not available or error:', err.message);
  }
  console.log('');

  // 5. Check what values should be displayed in the form
  console.log('5. Expected form field values:');
  
  const maxBookings = dbSettings?.find(s => s.setting_key === 'max_bookings_per_slot')?.setting_value;
  const maxBouquets = dbSettings?.find(s => s.setting_key === 'max_bouquets_per_slot')?.setting_value;
  const maxVisitorPasses = dbSettings?.find(s => s.setting_key === 'max_visitor_passes_per_booking')?.setting_value;
  const operatingDays = dbSettings?.find(s => s.setting_key === 'operating_days')?.setting_value;
  
  console.log('Form field mappings:');
  console.log(`#maxBookings should show: ${maxBookings}`);
  console.log(`#maxVisitors should show: ${maxBouquets}`);
  console.log(`#maxVisitorPassesPerBooking should show: ${maxVisitorPasses}`);
  console.log(`Operating days chips should show: ${operatingDays}`);

  console.log('\n🔍 Debug complete!');
}

debugAdminSettings().catch(console.error);
