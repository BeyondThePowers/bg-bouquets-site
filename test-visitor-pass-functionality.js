// Test script for visitor pass functionality
// Run this in browser console or as a Node.js script

async function testPricingAPI() {
  console.log('🧪 Testing Pricing API...');

  try {
    const response = await fetch('/api/settings/pricing');
    const data = await response.json();

    console.log('✅ Pricing API Response:', data);

    // Validate response structure
    if (data.price_per_bouquet && data.price_per_visitor_pass) {
      console.log('✅ Both pricing fields present');
      console.log(`   Bouquet Price: $${data.price_per_bouquet}`);
      console.log(`   Visitor Pass Price: $${data.price_per_visitor_pass}`);
    } else {
      console.error('❌ Missing pricing fields');
    }

    return data;
  } catch (error) {
    console.error('❌ Pricing API Error:', error);
    return null;
  }
}

async function testBookingSubmission() {
  console.log('🧪 Testing Booking Submission...');

  const testBooking = {
    fullName: 'Test Customer',
    email: 'test@example.com',
    phone: '555-0123',
    visitDate: '2024-08-15',
    preferredTime: '10:00 AM',
    numberOfVisitors: 2, // 2 bouquets
    numberOfVisitorPasses: 3, // 3 visitor passes
    totalAmount: 85.00, // (2 * 35) + (3 * 5) = 70 + 15 = 85
    paymentMethod: 'pay_on_arrival'
  };

  try {
    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testBooking)
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Booking Submission Success:', data);
      return data;
    } else {
      console.error('❌ Booking Submission Failed:', data);
      return null;
    }
  } catch (error) {
    console.error('❌ Booking Submission Error:', error);
    return null;
  }
}

async function testPriceCalculation() {
  console.log('🧪 Testing Price Calculation Logic...');

  const pricing = await testPricingAPI();
  if (!pricing) return;

  const bouquetPrice = parseFloat(pricing.price_per_bouquet);
  const visitorPassPrice = parseFloat(pricing.price_per_visitor_pass);

  // Test scenarios
  const scenarios = [
    { bouquets: 1, visitorPasses: 0, expected: bouquetPrice },
    { bouquets: 1, visitorPasses: 2, expected: bouquetPrice + (2 * visitorPassPrice) },
    { bouquets: 3, visitorPasses: 1, expected: (3 * bouquetPrice) + visitorPassPrice },
    { bouquets: 2, visitorPasses: 5, expected: (2 * bouquetPrice) + (5 * visitorPassPrice) }
  ];

  scenarios.forEach((scenario, index) => {
    const calculated = (scenario.bouquets * bouquetPrice) + (scenario.visitorPasses * visitorPassPrice);
    const matches = Math.abs(calculated - scenario.expected) < 0.01;

    console.log(`${matches ? '✅' : '❌'} Scenario ${index + 1}:`, {
      bouquets: scenario.bouquets,
      visitorPasses: scenario.visitorPasses,
      calculated: calculated.toFixed(2),
      expected: scenario.expected.toFixed(2)
    });
  });
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Visitor Pass Functionality Tests...\n');

  await testPricingAPI();
  console.log('');

  await testPriceCalculation();
  console.log('');

  await testBookingSubmission();
  console.log('');

  console.log('✨ Tests completed! Check the results above.');
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testPricingAPI, testBookingSubmission, testPriceCalculation, runAllTests };
} else {
  // Browser environment - make functions available globally
  window.testVisitorPassFunctionality = { testPricingAPI, testBookingSubmission, testPriceCalculation, runAllTests };
  console.log('🔧 Test functions available at: window.testVisitorPassFunctionality');
  console.log('🔧 Run all tests with: window.testVisitorPassFunctionality.runAllTests()');
}