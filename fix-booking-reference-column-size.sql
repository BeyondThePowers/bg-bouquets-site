-- Fix booking reference column size
-- The format BG-YYYYMMDD-XXXX is actually 16 characters, not 15
-- Run this SQL in your Supabase SQL Editor

-- 1. Alter the column to accommodate 16 characters
ALTER TABLE bookings 
ALTER COLUMN booking_reference TYPE VARCHAR(16);

-- 2. Update the comment to reflect correct length
COMMENT ON COLUMN bookings.booking_reference IS 'Human-readable booking reference in format BG-YYYYMMDD-XXXX (16 characters) for customer communication and admin reference';

-- 3. Verify the change
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'bookings' AND column_name = 'booking_reference';
