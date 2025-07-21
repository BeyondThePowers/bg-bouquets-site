-- Add booking reference column to bookings table
-- Run this SQL in your Supabase SQL Editor

-- 1. Add booking_reference column
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS booking_reference VARCHAR(16) NULL;

-- 2. Create unique index to prevent duplicate references
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_booking_reference 
ON bookings(booking_reference) 
WHERE booking_reference IS NOT NULL;

-- 3. Add comment to document the column
COMMENT ON COLUMN bookings.booking_reference IS 'Human-readable booking reference in format BG-YYYYMMDD-XXXX for customer communication and admin reference';

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'bookings' AND column_name = 'booking_reference';
