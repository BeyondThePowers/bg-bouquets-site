-- Simple migration to add is_legacy column to time_slots
-- Run this first, then run the audit logging migration

-- 1. Add is_legacy column to time_slots table
ALTER TABLE time_slots 
ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN DEFAULT FALSE;

-- 2. Add index for performance on legacy slots
CREATE INDEX IF NOT EXISTS idx_time_slots_legacy ON time_slots(is_legacy) WHERE is_legacy = true;

-- 3. Update existing views to handle the new column
-- Drop existing views first to avoid column conflicts
DROP VIEW IF EXISTS time_slot_status CASCADE;
DROP VIEW IF EXISTS booking_summary CASCADE;

-- Recreate time_slot_status view with legacy information
CREATE VIEW time_slot_status AS
SELECT 
  ts.id,
  ts.date,
  ts.time,
  ts.max_bouquets,
  ts.max_bookings,
  COALESCE(ts.is_legacy, false) as is_legacy,
  COUNT(b.id) as current_bookings,
  COALESCE(SUM(b.number_of_bouquets), 0) as current_bouquets,
  (ts.max_bookings - COUNT(b.id)) as bookings_remaining,
  (ts.max_bouquets - COALESCE(SUM(b.number_of_bouquets), 0)) as bouquet_spots_remaining,
  CASE 
    WHEN COUNT(b.id) >= ts.max_bookings THEN 'BOOKING_LIMIT_REACHED'
    WHEN COALESCE(SUM(b.number_of_bouquets), 0) >= ts.max_bouquets THEN 'BOUQUET_LIMIT_REACHED'
    WHEN COALESCE(ts.is_legacy, false) THEN 'LEGACY_SLOT'
    ELSE 'AVAILABLE'
  END as availability_status
FROM time_slots ts
LEFT JOIN bookings b ON ts.date = b.date AND ts.time = b.time AND b.status = 'confirmed'
GROUP BY ts.id, ts.date, ts.time, ts.max_bouquets, ts.max_bookings, ts.is_legacy
ORDER BY ts.date, ts.time;

-- Recreate booking_summary view with legacy information
CREATE VIEW booking_summary AS
SELECT 
  b.id,
  b.full_name,
  b.email,
  b.phone,
  b.date,
  b.time,
  b.number_of_bouquets,
  b.total_amount,
  b.created_at,
  ts.max_bouquets,
  COALESCE(ts.is_legacy, false) as is_legacy,
  (
    SELECT COALESCE(SUM(number_of_bouquets), 0) 
    FROM bookings b2 
    WHERE b2.date = b.date AND b2.time = b.time AND b2.status = 'confirmed'
  ) as total_bouquets_for_slot
FROM bookings b
JOIN time_slots ts ON b.date = ts.date AND b.time = ts.time
ORDER BY b.date, b.time, b.created_at;

-- 4. Grant necessary permissions
GRANT SELECT ON time_slot_status TO anon, authenticated;
GRANT SELECT ON booking_summary TO anon, authenticated;

-- 5. Verification
SELECT 'is_legacy column added successfully!' as status;

-- Check if column was added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'time_slots' AND column_name = 'is_legacy';

-- Check current time slots
SELECT date, time, max_bouquets, max_bookings, is_legacy
FROM time_slots 
WHERE date >= CURRENT_DATE 
ORDER BY date, time 
LIMIT 5;
