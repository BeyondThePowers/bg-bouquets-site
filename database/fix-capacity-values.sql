-- Simplified fix to ensure non-legacy time slots get updated capacity values
-- This script doesn't change behavior for legacy slots

-- 1. First, verify the current capacity settings
SELECT 
  setting_key, 
  setting_value 
FROM 
  schedule_settings 
WHERE 
  setting_key IN ('max_bouquets_per_slot', 'max_bookings_per_slot');

-- 2. Run a one-time update to ensure all non-legacy time slots have the current capacity values
UPDATE 
  time_slots
SET 
  max_bouquets = (SELECT (setting_value #>> '{}')::INTEGER FROM schedule_settings WHERE setting_key = 'max_bouquets_per_slot'),
  max_bookings = (SELECT (setting_value #>> '{}')::INTEGER FROM schedule_settings WHERE setting_key = 'max_bookings_per_slot')
WHERE 
  date > CURRENT_DATE
  AND is_legacy = FALSE;

-- 3. Verify that non-legacy slots were updated with correct values (sample of 5 slots)
SELECT 
  id, 
  date, 
  time, 
  max_bouquets, 
  max_bookings, 
  is_legacy
FROM 
  time_slots
WHERE 
  date > CURRENT_DATE
  AND is_legacy = FALSE
ORDER BY 
  date, time
LIMIT 5;

-- 4. Display a sample of legacy slots to confirm they weren't changed
SELECT 
  id, 
  date, 
  time, 
  max_bouquets, 
  max_bookings, 
  is_legacy
FROM 
  time_slots
WHERE 
  date > CURRENT_DATE
  AND is_legacy = TRUE
ORDER BY 
  date, time
LIMIT 5;

-- Note: Now that the 'enabled' column issue is fixed, the schedule refresh function 
-- called from settings.ts should correctly update capacity values for future slots.
-- This script provides an immediate fix for existing slots.