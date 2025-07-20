-- Fix operating days format to be compatible with is_slot_valid_in_schedule function
-- Convert from array format ["monday", "tuesday"] to object format {"monday":true, "tuesday":true}
-- No need to add trailing spaces since the database functions already TRIM() day names

-- First, check the current operating_days format
SELECT setting_key, setting_value 
FROM schedule_settings
WHERE setting_key = 'operating_days';

-- Apply the fix using a more reliable method that handles both array and object formats
DO $$
DECLARE
  current_value JSONB;
  fixed_value JSONB := '{}'::JSONB;
  day_value TEXT;
BEGIN
  -- Get the current operating_days value
  SELECT setting_value INTO current_value 
  FROM schedule_settings 
  WHERE setting_key = 'operating_days';
  
  -- If null or empty, initialize with an empty object
  IF current_value IS NULL OR current_value = 'null'::JSONB THEN
    current_value := '[]'::JSONB;
  END IF;
  
  -- Check if it's already in object format
  IF jsonb_typeof(current_value) = 'object' THEN
    -- Already in correct format, do nothing
    RAISE NOTICE 'Operating days already in object format: %', current_value;
    RETURN;
  ELSIF jsonb_typeof(current_value) = 'array' THEN
    -- Convert from array to object format
    FOR i IN 0..jsonb_array_length(current_value) - 1 LOOP
      day_value := current_value ->> i;
      fixed_value := fixed_value || jsonb_build_object(day_value, true);
    END LOOP;
    
    -- Update the setting with the fixed format
    UPDATE schedule_settings
    SET setting_value = fixed_value
    WHERE setting_key = 'operating_days';
    
    RAISE NOTICE 'Converted operating days from array to object format: % -> %', current_value, fixed_value;
  ELSE
    RAISE EXCEPTION 'Unexpected operating_days format: %', current_value;
  END IF;
END $$;

-- Refresh the schedule to apply the changes
SELECT refresh_future_schedule();

-- Verify the updated operating_days format
SELECT setting_key, setting_value 
FROM schedule_settings
WHERE setting_key = 'operating_days';