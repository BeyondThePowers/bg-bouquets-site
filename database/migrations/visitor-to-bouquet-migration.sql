-- Visitor to Bouquet Terminology Migration
-- This migration renames database columns and settings from "visitor" to "bouquet" terminology
-- Run this in your Supabase SQL Editor

-- IMPORTANT: Backup your database before running this migration!

BEGIN;

-- 1. Rename columns in bookings table
ALTER TABLE bookings RENAME COLUMN number_of_visitors TO number_of_bouquets;

-- 2. Rename columns in time_slots table  
ALTER TABLE time_slots RENAME COLUMN max_capacity TO max_bouquets;

-- 3. Update settings keys in schedule_settings table
UPDATE schedule_settings 
SET setting_key = 'max_bouquets_per_slot' 
WHERE setting_key = 'max_visitors_per_slot';

-- 4. Verify the migration
SELECT 'Migration completed successfully' as status;

-- Show updated schema
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name IN ('bookings', 'time_slots') 
  AND column_name LIKE '%bouquet%'
ORDER BY table_name, column_name;

-- Show updated settings
SELECT setting_key, setting_value, description 
FROM schedule_settings 
WHERE setting_key LIKE '%bouquet%'
ORDER BY setting_key;

COMMIT;
