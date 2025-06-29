-- =====================================================
-- ADD SQUARE PAYMENT TRACKING COLUMNS
-- =====================================================
-- 
-- This script adds columns to track Square payment information
-- for webhook processing and payment status tracking.
--
-- Run this in Supabase SQL Editor before testing Square payments
--
-- =====================================================

-- Add Square tracking columns to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS square_order_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS square_payment_id VARCHAR(255);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_square_order_id ON bookings(square_order_id);
CREATE INDEX IF NOT EXISTS idx_bookings_square_payment_id ON bookings(square_payment_id);

-- Add comments for documentation
COMMENT ON COLUMN bookings.square_order_id IS 'Square order ID for tracking payment webhooks';
COMMENT ON COLUMN bookings.square_payment_id IS 'Square payment ID after successful payment';

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'bookings' 
AND column_name IN ('square_order_id', 'square_payment_id')
ORDER BY column_name;
