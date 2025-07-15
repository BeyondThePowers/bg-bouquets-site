-- Add Visitor Pass Pricing Support
-- This migration adds visitor pass pricing and booking support
-- Run these statements in order in your Supabase SQL Editor

-- 1. Add visitor pass price setting to schedule_settings
INSERT INTO schedule_settings (setting_key, setting_value, description)
VALUES ('price_per_visitor_pass', '5.00', 'Price charged per visitor pass (age 13+) in CAD')
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  description = EXCLUDED.description;

-- 2. Add visitor pass count column to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS number_of_visitor_passes INTEGER DEFAULT 0;

-- 3. Add index for performance on visitor pass queries
CREATE INDEX IF NOT EXISTS idx_bookings_visitor_passes ON bookings(number_of_visitor_passes) WHERE number_of_visitor_passes > 0;

-- 4. Verify the changes
SELECT setting_key, setting_value, description
FROM schedule_settings
WHERE setting_key IN ('price_per_bouquet', 'price_per_visitor_pass')
ORDER BY setting_key;

-- 5. Verify the new column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND column_name IN ('number_of_bouquets', 'number_of_visitor_passes')
ORDER BY column_name;

-- 6. Show sample of updated bookings table structure
SELECT
  id,
  full_name,
  number_of_bouquets,
  number_of_visitor_passes,
  total_amount,
  created_at
FROM bookings
ORDER BY created_at DESC
LIMIT 5;

COMMIT;