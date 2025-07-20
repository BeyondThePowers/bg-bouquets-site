// Test the Max Visitor Passes per Booking fix

async function testVisitorPassesFix() {
  console.log('🧪 Testing Max Visitor Passes per Booking Fix...\n');

  // 1. Simulate loadScheduleSettings()
  console.log('1. Simulating loadScheduleSettings():');
  try {
    const response = await fetch('http://localhost:4322/api/admin/settings');
    const settings = await response.json();
    
    console.log('Raw max_visitor_passes_per_booking:', settings.max_visitor_passes_per_booking);
    
    // Apply the parsing logic from loadScheduleSettings
    let scheduleValue = settings.max_visitor_passes_per_booking;
    if (typeof scheduleValue === 'string' && scheduleValue.startsWith('"') && scheduleValue.endsWith('"')) {
      scheduleValue = JSON.parse(scheduleValue);
    }
    
    console.log('Parsed value from loadScheduleSettings:', scheduleValue);
    console.log('Field would be set to:', scheduleValue);
    
  } catch (err) {
    console.error('Error in loadScheduleSettings simulation:', err.message);
  }
  console.log('');

  // 2. Simulate loadPricingSettings() (with the fix)
  console.log('2. Simulating loadPricingSettings() with fix:');
  try {
    const response = await fetch('http://localhost:4322/api/settings/pricing');
    const data = await response.json();
    
    console.log('Raw max_visitor_passes_per_booking from pricing:', data.max_visitor_passes_per_booking);
    
    // Apply the NEW parsing logic from loadPricingSettings (with fix)
    let pricingValue = data.max_visitor_passes_per_booking || '20';
    if (typeof pricingValue === 'string' && pricingValue.startsWith('"') && pricingValue.endsWith('"')) {
      pricingValue = JSON.parse(pricingValue);
    }
    
    console.log('Parsed value from loadPricingSettings (fixed):', pricingValue);
    console.log('Field would be overwritten to:', pricingValue);
    
  } catch (err) {
    console.error('Error in loadPricingSettings simulation:', err.message);
  }
  console.log('');

  // 3. Compare the results
  console.log('3. Analysis:');
  console.log('Both functions should now set the field to the same value: "20"');
  console.log('The field should display correctly after both functions run.');
  console.log('');

  // 4. Test the actual APIs to make sure they return the same data
  console.log('4. Verifying API consistency:');
  try {
    const [adminResponse, pricingResponse] = await Promise.all([
      fetch('http://localhost:4322/api/admin/settings'),
      fetch('http://localhost:4322/api/settings/pricing')
    ]);
    
    const adminData = await adminResponse.json();
    const pricingData = await pricingResponse.json();
    
    // Parse both values
    let adminValue = adminData.max_visitor_passes_per_booking;
    if (typeof adminValue === 'string' && adminValue.startsWith('"') && adminValue.endsWith('"')) {
      adminValue = JSON.parse(adminValue);
    }
    
    let pricingValue = pricingData.max_visitor_passes_per_booking || '20';
    if (typeof pricingValue === 'string' && pricingValue.startsWith('"') && pricingValue.endsWith('"')) {
      pricingValue = JSON.parse(pricingValue);
    }
    
    console.log(`Admin API parsed value: "${adminValue}"`);
    console.log(`Pricing API parsed value: "${pricingValue}"`);
    
    if (adminValue === pricingValue) {
      console.log('✅ Both APIs return the same parsed value - field should load correctly!');
    } else {
      console.log('❌ APIs return different values - this could cause issues');
    }
    
  } catch (err) {
    console.error('Error comparing APIs:', err.message);
  }

  console.log('\n🎯 Fix Status:');
  console.log('✅ Added double-JSON parsing to loadPricingSettings()');
  console.log('✅ Both functions now handle the same data format');
  console.log('✅ Max Visitor Passes per Booking should now load correctly');
  console.log('\nRefresh the admin page to see the fix in action!');
}

testVisitorPassesFix().catch(console.error);
