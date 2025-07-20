// Debug the Max Visitor Passes per Booking loading issue

async function debugVisitorPasses() {
  console.log('🔍 Debugging Max Visitor Passes per Booking Loading...\n');

  // 1. Check what the admin settings API returns
  console.log('1. Admin Settings API (/api/admin/settings):');
  try {
    const response = await fetch('http://localhost:4322/api/admin/settings');
    const adminSettings = await response.json();
    
    console.log('max_visitor_passes_per_booking from admin API:', adminSettings.max_visitor_passes_per_booking);
    console.log('Type:', typeof adminSettings.max_visitor_passes_per_booking);
    
    // Parse it like the admin interface does
    let adminValue = adminSettings.max_visitor_passes_per_booking;
    if (typeof adminValue === 'string' && adminValue.startsWith('"') && adminValue.endsWith('"')) {
      adminValue = JSON.parse(adminValue);
    }
    console.log('Parsed admin value:', adminValue);
    
  } catch (err) {
    console.error('Error calling admin settings API:', err.message);
  }
  console.log('');

  // 2. Check what the pricing settings API returns
  console.log('2. Pricing Settings API (/api/settings/pricing):');
  try {
    const response = await fetch('http://localhost:4322/api/settings/pricing');
    const pricingSettings = await response.json();
    
    console.log('max_visitor_passes_per_booking from pricing API:', pricingSettings.max_visitor_passes_per_booking);
    console.log('Type:', typeof pricingSettings.max_visitor_passes_per_booking);
    
    // Parse it like the pricing interface does
    let pricingValue = pricingSettings.max_visitor_passes_per_booking;
    if (typeof pricingValue === 'string' && pricingValue.startsWith('"') && pricingValue.endsWith('"')) {
      pricingValue = JSON.parse(pricingValue);
    }
    console.log('Parsed pricing value:', pricingValue);
    
  } catch (err) {
    console.error('Error calling pricing settings API:', err.message);
  }
  console.log('');

  // 3. Check the database directly
  console.log('3. Direct database check:');
  const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
  const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';
  
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: dbValue, error } = await supabase
    .from('schedule_settings')
    .select('setting_value')
    .eq('setting_key', 'max_visitor_passes_per_booking')
    .single();

  if (error) {
    console.error('Database error:', error);
  } else {
    console.log('Database value:', dbValue?.setting_value);
    console.log('Type:', typeof dbValue?.setting_value);
  }
  console.log('');

  // 4. Simulate the loading sequence
  console.log('4. Simulating the loading sequence:');
  console.log('Step 1: loadScheduleSettings() would set field to admin API value');
  console.log('Step 2: loadPricingSettings() would overwrite field with pricing API value');
  console.log('');
  console.log('This explains why the field might appear blank or incorrect!');
  console.log('The pricing API might be returning a different format or empty value.');
}

debugVisitorPasses().catch(console.error);
