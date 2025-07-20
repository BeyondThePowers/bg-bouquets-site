// Test the admin settings loading fix
// This simulates what the admin interface should do

async function testAdminLoading() {
  console.log('🧪 Testing Admin Settings Loading Fix...\n');

  // 1. Get the settings like the admin interface does
  console.log('1. Fetching settings from admin API:');
  try {
    const response = await fetch('http://localhost:4322/api/admin/settings');
    const settings = await response.json();
    
    console.log('Raw settings from API:');
    console.log(JSON.stringify(settings, null, 2));
    console.log('');

    // 2. Test the parsing logic for each field
    console.log('2. Testing parsing logic:');
    
    // Test max_bookings_per_slot
    let maxBookings = settings.max_bookings_per_slot;
    if (typeof maxBookings === 'string' && maxBookings.startsWith('"') && maxBookings.endsWith('"')) {
      maxBookings = JSON.parse(maxBookings);
    }
    console.log(`max_bookings_per_slot: "${settings.max_bookings_per_slot}" -> "${maxBookings}"`);

    // Test max_bouquets_per_slot
    let maxBouquets = settings.max_bouquets_per_slot;
    if (typeof maxBouquets === 'string' && maxBouquets.startsWith('"') && maxBouquets.endsWith('"')) {
      maxBouquets = JSON.parse(maxBouquets);
    }
    console.log(`max_bouquets_per_slot: "${settings.max_bouquets_per_slot}" -> "${maxBouquets}"`);

    // Test max_visitor_passes_per_booking
    let maxVisitorPasses = settings.max_visitor_passes_per_booking;
    if (typeof maxVisitorPasses === 'string' && maxVisitorPasses.startsWith('"') && maxVisitorPasses.endsWith('"')) {
      maxVisitorPasses = JSON.parse(maxVisitorPasses);
    }
    console.log(`max_visitor_passes_per_booking: "${settings.max_visitor_passes_per_booking}" -> "${maxVisitorPasses}"`);

    // Test operating days
    let operatingDays = [];
    if (Array.isArray(settings.operating_days)) {
      operatingDays = settings.operating_days;
    } else if (typeof settings.operating_days === 'string') {
      try {
        operatingDays = JSON.parse(settings.operating_days || '[]');
      } catch (error) {
        console.error('Error parsing operating_days JSON:', error);
        operatingDays = [];
      }
    }
    console.log(`operating_days: "${settings.operating_days}" -> [${operatingDays.join(', ')}]`);

    // Test season settings
    let seasonStartMonth = settings.season_start_month;
    if (typeof seasonStartMonth === 'string' && seasonStartMonth.startsWith('"') && seasonStartMonth.endsWith('"')) {
      seasonStartMonth = JSON.parse(seasonStartMonth);
    }
    console.log(`season_start_month: "${settings.season_start_month}" -> "${seasonStartMonth}"`);

    console.log('');

    // 3. Verify the values are what we expect
    console.log('3. Verification:');
    console.log(`✅ Max Bookings: ${maxBookings} (should be 20)`);
    console.log(`✅ Max Bouquets: ${maxBouquets} (should be 40)`);
    console.log(`✅ Max Visitor Passes: ${maxVisitorPasses} (should be 20)`);
    console.log(`✅ Operating Days: [${operatingDays.join(', ')}] (should include thursday, friday, saturday)`);
    console.log(`✅ Season Start Month: ${seasonStartMonth} (should be 5)`);

    // 4. Check if the values are correct
    const isCorrect = 
      maxBookings === '20' &&
      maxBouquets === '40' &&
      maxVisitorPasses === '20' &&
      operatingDays.includes('thursday') &&
      operatingDays.includes('friday') &&
      operatingDays.includes('saturday') &&
      seasonStartMonth === '5';

    console.log('');
    if (isCorrect) {
      console.log('🎉 SUCCESS: All settings are parsing correctly!');
      console.log('The admin interface should now display the correct values.');
    } else {
      console.log('❌ ISSUE: Some settings are not parsing correctly.');
    }

  } catch (err) {
    console.error('Error testing admin loading:', err.message);
  }
}

testAdminLoading().catch(console.error);
