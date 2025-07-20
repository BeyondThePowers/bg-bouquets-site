-- Fix operating days format to be compatible with is_slot_valid_in_schedule function
-- Convert from array format ["monday", "tuesday"] to object format {"monday": true, "tuesday": true}

DO $$
DECLARE
    current_value JSONB;
    new_value JSONB := '{}'::JSONB;
    day_value TEXT;
    is_array BOOLEAN;
BEGIN
    -- Get current operating_days setting
    SELECT setting_value INTO current_value 
    FROM schedule_settings 
    WHERE setting_key = 'operating_days';
    
    -- Check if current value exists
    IF current_value IS NULL THEN
        RAISE NOTICE 'No operating_days setting found';
        RETURN;
    END IF;
    
    -- Check if it's already in the correct format (object)
    -- PostgreSQL function jsonb_typeof returns 'array' or 'object'
    is_array := (jsonb_typeof(current_value) = 'array');
    
    IF is_array THEN
        RAISE NOTICE 'Converting operating_days from array to object format';
        
        -- Convert array to object with keys
        FOR i IN 0..jsonb_array_length(current_value) - 1 LOOP
            day_value := current_value->>i;
            new_value := new_value || jsonb_build_object(day_value, true);
        END LOOP;
        
        -- Update the setting with the new format
        UPDATE schedule_settings
        SET setting_value = new_value
        WHERE setting_key = 'operating_days';
        
        RAISE NOTICE 'Converted operating_days from % to %', current_value, new_value;
    ELSE
        RAISE NOTICE 'operating_days already in object format: %', current_value;
    END IF;
    
    -- Refresh the schedule to apply the corrected format
    PERFORM refresh_future_schedule();
    
    RAISE NOTICE 'Schedule refreshed with corrected operating_days format';
END $$;