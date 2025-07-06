-- Square Integration Migration
-- Run this SQL directly in your Supabase SQL Editor

-- Add Square-specific columns to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS square_order_id VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS square_payment_id VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS payment_completed_at TIMESTAMPTZ NULL;

-- Create indexes for Square payment tracking
CREATE INDEX IF NOT EXISTS idx_bookings_square_order_id ON bookings(square_order_id);
CREATE INDEX IF NOT EXISTS idx_bookings_square_payment_id ON bookings(square_payment_id);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_completed_at ON bookings(payment_completed_at);

-- Add comments for documentation
COMMENT ON COLUMN bookings.square_order_id IS 'Square order ID for tracking payment orders';
COMMENT ON COLUMN bookings.square_payment_id IS 'Square payment ID after successful payment';
COMMENT ON COLUMN bookings.payment_completed_at IS 'Timestamp when payment was completed (for both Square and manual payments)';

-- Update existing paid bookings to have payment_completed_at timestamp
UPDATE bookings 
SET payment_completed_at = created_at 
WHERE payment_status = 'paid' AND payment_completed_at IS NULL;

-- Verify the migration
SELECT 
  COUNT(*) as total_bookings,
  COUNT(square_order_id) as bookings_with_square_order_id,
  COUNT(square_payment_id) as bookings_with_square_payment_id,
  COUNT(payment_completed_at) as bookings_with_completion_time
FROM bookings;
