// Debug script to check booking reference length
function generateBookingReference(dateString) {
  // Convert date string (YYYY-MM-DD) to YYYYMMDD format
  const dateStr = dateString.replace(/-/g, '');
  
  // Generate random 4-digit suffix
  const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  // Return formatted reference
  return `BG-${dateStr}-${randomSuffix}`;
}

// Test with a sample date
const testDate = '2025-07-21';
const reference = generateBookingReference(testDate);

console.log('Generated reference:', reference);
console.log('Reference length:', reference.length);
console.log('Expected format: BG-YYYYMMDD-XXXX');
console.log('Expected length: 15 characters');

// Break down the format
const parts = reference.split('-');
console.log('Parts:', parts);
console.log('Part lengths:', parts.map(p => p.length));

// Test multiple references
console.log('\nTesting multiple references:');
for (let i = 0; i < 5; i++) {
  const ref = generateBookingReference(testDate);
  console.log(`${i + 1}. ${ref} (${ref.length} chars)`);
}
