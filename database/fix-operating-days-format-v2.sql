-- Fix operating days format to be compatible with is_slot_valid_in_schedule function
-- Convert from array format ["monday", "tuesday"] to object format {"monday": true, "tuesday": true}

DO $$
DECLARE
    current_value TEXT;
    parsed_json JSONB;
    new_value JSONB := '{}'::JSONB;
    day_value TEXT;
BEGIN
    -- Get current operating_days setting as raw text
    SELECT setting_value INTO current_value 
    FROM schedule_settings 
    WHERE setting_key = 'operating_days';
    
    -- Check if current value exists
    IF current_value IS NULL THEN
        RAISE NOTICE 'No operating_days setting found';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Current operating_days: %', current_value;
    
    -- Parse the JSON string to JSONB
    BEGIN
        parsed_json := current_value::JSONB;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error parsing JSON: %, trying to escape', SQLERRM;
        -- If direct conversion fails, try with escaped string
        parsed_json := concat('"', replace(current_value, '"', '\"'), '"')::JSONB;
    END;
    
    -- Check if it's already in the correct format
    IF jsonb_typeof(parsed_json) = 'object' AND 
       (parsed_json ? 'monday' OR parsed_json ? 'tuesday' OR parsed_json ? 'wednesday') THEN
        RAISE NOTICE 'operating_days already in object format: %', parsed_json;
        RETURN;
    END IF;
    
    -- If it's an array, convert to object
    IF jsonb_typeof(parsed_json) = 'array' THEN
        RAISE NOTICE 'Converting operating_days from array to object format';
        
        -- Convert array to object with keys
        FOR i IN 0..jsonb_array_length(parsed_json) - 1 LOOP
            day_value := parsed_json->>i;
            new_value := new_value || jsonb_build_object(day_value, true);
        END LOOP;
        
        -- Update the setting with the new format
        UPDATE schedule_settings
        SET setting_value = new_value::TEXT
        WHERE setting_key = 'operating_days';
        
        RAISE NOTICE 'Converted operating_days from % to %', parsed_json, new_value;
        
        -- Refresh the schedule to apply the corrected format
        PERFORM refresh_future_schedule();
        
        RAISE NOTICE 'Schedule refreshed with corrected operating_days format';
    ELSE
        RAISE NOTICE 'Could not determine format of operating_days: %', parsed_json;
        RAISE NOTICE 'Type detected: %', jsonb_typeof(parsed_json);
        
        -- Try manual string parsing as fallback
        IF current_value LIKE '[%]' THEN
            RAISE NOTICE 'Attempting manual array parsing';
            
            -- Remove brackets and split by commas
            current_value := replace(replace(current_value, '[', ''), ']', '');
            
            -- Extract day names (handling various formats with quotes)
            FOR day_part IN SELECT regexp_split_to_table(current_value, ',') LOOP
                -- Clean up the day name by removing quotes
                day_value := regexp_replace(day_part, '["\s]', '', 'g');
                IF length(day_value) > 0 THEN
                    new_value := new_value || jsonb_build_object(day_value, true);
                END IF;
            END LOOP;
            
            -- Update the setting
            UPDATE schedule_settings
            SET setting_value = new_value::TEXT
            WHERE setting_key = 'operating_days';
            
            RAISE NOTICE 'Manually converted to: %', new_value;
            
            -- Refresh the schedule
            PERFORM refresh_future_schedule();
        END IF;
    END IF;
END $$;

-- Check the result
SELECT setting_key, setting_value 
FROM schedule_settings 
WHERE setting_key = 'operating_days';