# Operating Days Format Fix

## Problem Summary

We identified an issue where updates to operating days in the garden management admin interface (/garden-mgmt/admin) weren't reflecting in the booking calendar. There were two key technical issues:

1. **Format Mismatch**: Operating days were stored as a JSON array `["monday", "tuesday"]`, but PostgreSQL functions expect a JSON object with day names as keys `{"monday": true, "tuesday": true}`.

2. **Unnecessary Complexity**: The previous fix added trailing spaces to day names to match PostgreSQL's `to_char(date, 'Day')` output, but this was redundant since the database functions already trim those spaces.

## Simplified Solution

### 1. Frontend Change

The `collectScheduleSettings` function in `src/pages/garden-mgmt/admin.astro` has been simplified:

```javascript
// Get operating days as an object with day names as keys (not an array)
// This format is required for PostgreSQL's JSONB ? operator used in is_slot_valid_in_schedule
const operatingDays: Record<string, boolean> = {};
document.querySelectorAll('#operatingDays .toggle-chip.active').forEach((chip) => {
  const element = chip as HTMLElement;
  const day = element.dataset.day;
  if (day) {
    // Store the day name without spaces - database functions trim spaces anyway
    operatingDays[day] = true;
  }
});
```

This change:
- Still properly stores operating days as an object (required for the `?` operator)
- Eliminates the unnecessary complexity of adding trailing spaces
- Works correctly with the database functions that trim spaces anyway

### 2. Database Fix

The `database/fix-operating-days-format-simple.sql` script converts existing data in the database from array format to object format, without worrying about trailing spaces:

```sql
-- Convert from array format ["monday", "tuesday"] to object format {"monday":true, "tuesday":true}
-- No need to add trailing spaces since the database functions already TRIM() day names

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
  
  -- Convert from array to object format if needed
  IF jsonb_typeof(current_value) = 'array' THEN
    FOR i IN 0..jsonb_array_length(current_value) - 1 LOOP
      day_value := current_value ->> i;
      fixed_value := fixed_value || jsonb_build_object(day_value, true);
    END LOOP;
    
    -- Update the setting with the fixed format
    UPDATE schedule_settings
    SET setting_value = fixed_value
    WHERE setting_key = 'operating_days';
  END IF;
END $$;

-- Refresh the schedule to apply the changes
SELECT refresh_future_schedule();
```

## Why This Works

Looking at the SQL functions:

1. In `is_slot_valid_in_schedule`:
```sql
-- Get day name
day_name := LOWER(TO_CHAR(check_date, 'Day'));
day_name := TRIM(day_name);
   
-- Check if it's an operating day
SELECT (operating_days ? day_name) INTO is_operating_day;
```

2. In `generate_open_days_and_slots`:
```sql
day_name := LOWER(TO_CHAR(current_date_iter, 'Day'));
day_name := TRIM(day_name);

-- Check if this is an operating day
IF (operating_days ? day_name) AND within_season AND NOT is_holiday THEN
```

Both functions **already trim the trailing spaces** from day names before checking if they exist in the operating_days object. This means we don't need to add spaces in the frontend - it's redundant complexity.

## How to Apply the Fix

1. Update the frontend code in `src/pages/garden-mgmt/admin.astro`
2. Run the database script:
   ```
   psql -d [your_database] -f database/fix-operating-days-format-with-validation.sql
   ```
3. Verify that the fix properly updated both the `schedule_settings` and `open_days` tables
4. Test the admin interface by updating operating days - they should now correctly reflect in the booking calendar

## Verifying the Fix

It's essential to verify that our fix properly updates both tables:

1. **schedule_settings table**: Should now store operating days in object format:
   ```json
   {
     "friday": true,
     "monday": true,
     "tuesday": true,
     "saturday": true, 
     "thursday": true
   }
   ```

2. **open_days table**: This is what the booking calendar actually uses to determine available dates. The `fix-operating-days-format-with-validation.sql` script includes comprehensive validation to verify:
   - Monday and Tuesday days are properly marked as `is_open = true` in the `open_days` table
   - Time slots are created for Monday and Tuesday in the `time_slots` table
   - The entire flow from settings to available booking dates is working correctly

If Monday and Tuesday aren't showing as available in the booking calendar after running the fix, check the validation output to identify where the issue might be occurring in the refresh process.

This simpler approach is more maintainable and eliminates unnecessary complexity while solving the original issue.