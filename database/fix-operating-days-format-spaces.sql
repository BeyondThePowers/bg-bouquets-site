-- Fix operating days format with trailing spaces to match how day names are stored
-- Note the trailing spaces in the day name keys - these are critical!

-- Check the current format
SELECT setting_key, setting_value 
FROM schedule_settings 
WHERE setting_key = 'operating_days';

-- Update with trailing spaces matching the database format
UPDATE schedule_settings
SET setting_value = '{"monday ":true,"tuesday ":true,"thursday ":true,"friday   ":true,"saturday ":true}'
WHERE setting_key = 'operating_days';

-- Verify the update
SELECT setting_key, setting_value 
FROM schedule_settings 
WHERE setting_key = 'operating_days';

-- Call refresh to regenerate open days and time slots
SELECT refresh_future_schedule();

-- Verify that open days were created for all correct days of week
SELECT date, EXTRACT(DOW FROM date) as day_of_week, to_char(date, 'Day') as day_name
FROM open_days
WHERE is_open = true
AND date > CURRENT_DATE
ORDER BY date
LIMIT 20;

-- For reference: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday