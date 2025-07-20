# Operating Days Format Fix

## Issue Summary

There was a mismatch in how operating days were being stored and how the database functions expected to read them:

1. **Front-end format (admin.astro):** Operating days were being stored as a JSON array of strings: 
   ```json
   ["monday", "tuesday", "wednesday"]
   ```

2. **Database expectations:** The PostgreSQL functions (`is_slot_valid_in_schedule` and `generate_open_days_and_slots`) expected operating days as a JSON object with day names as keys:
   ```json
   {"monday": true, "tuesday": true, "wednesday": true}
   ```

This mismatch caused updates to operating days in the admin interface to not reflect in the booking calendar.

## Implemented Fixes

### 1. Frontend Fix

Updated `collectScheduleSettings()` in `src/pages/garden-mgmt/admin.astro` to store operating days as an object with day names as keys, instead of as an array:

```javascript
// Get operating days as an object with day names as keys (not an array)
const operatingDays: Record<string, boolean> = {};
document.querySelectorAll('#operatingDays .toggle-chip.active').forEach((chip) => {
  const element = chip as HTMLElement;
  const day = element.dataset.day;
  if (day) operatingDays[day] = true;
});
```

### 2. Database Fix

Created a migration script (`database/fix-operating-days-format.sql`) to update any existing operating days data in the database from the array format to the object format:

```sql
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
    
    -- Check if it's in array format and convert if needed
    is_array := (jsonb_typeof(current_value) = 'array');
    
    IF is_array THEN
        -- Convert array to object with keys
        FOR i IN 0..jsonb_array_length(current_value) - 1 LOOP
            day_value := current_value->>i;
            new_value := new_value || jsonb_build_object(day_value, true);
        END LOOP;
        
        -- Update the setting with the new format
        UPDATE schedule_settings
        SET setting_value = new_value
        WHERE setting_key = 'operating_days';
    END IF;
    
    -- Refresh the schedule to apply the corrected format
    PERFORM refresh_future_schedule();
END $$;
```

## Testing Instructions

1. **Run the migration script:**
   ```
   psql -d [your_database] -f database/fix-operating-days-format.sql
   ```
   Or run it through your database management tool.

2. **Test in the admin interface:**
   - Go to `/garden-mgmt/admin`
   - Update the operating days
   - Lock the schedule and apply changes (or schedule the update)

3. **Check the booking calendar:**
   - The booking calendar should now reflect the updated operating days
   - Verify that only the selected days of the week are available for booking

## Technical Details

The key issue was in the PostgreSQL operator usage:
- The `?` operator in PostgreSQL (used in `operating_days ? day_name`) checks if a string exists as a key in a JSONB object
- It does not check if a string exists as a value in a JSONB array
- This required changing the storage format to match the expected usage in the database functions

This fix ensures that when operating days are updated in the admin interface, the data is stored in a format that the database functions can correctly interpret when generating the booking calendar.