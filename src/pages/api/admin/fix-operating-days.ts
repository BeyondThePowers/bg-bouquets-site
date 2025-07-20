import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('Applying operating days format fix...');

    // 1. Update is_slot_valid_in_schedule function to use array format
    const isSlotValidFunction = `
      CREATE OR REPLACE FUNCTION public.is_slot_valid_in_schedule(check_date date, check_time text, operating_days jsonb, time_slots_config jsonb)
      RETURNS boolean
      LANGUAGE plpgsql
      AS $function$
      DECLARE
        day_name TEXT;
        is_operating_day BOOLEAN;
        is_valid_time BOOLEAN;
        is_holiday BOOLEAN;
      BEGIN
        -- Get day name
        day_name := LOWER(TO_CHAR(check_date, 'Day'));
        day_name := TRIM(day_name);
        
        -- Check if it's an operating day (using array format)
        SELECT (operating_days @> to_jsonb(day_name)) INTO is_operating_day;
        
        -- Check if it's a valid time slot (using array format)
        SELECT (time_slots_config @> to_jsonb(check_time)) INTO is_valid_time;
        
        -- Check if it's a holiday
        SELECT EXISTS(
          SELECT 1 FROM holidays 
          WHERE date = check_date 
          AND (is_disabled IS FALSE OR is_disabled IS NULL)
        ) INTO is_holiday;
        
        -- Slot is valid if it's an operating day, valid time, and not a holiday
        RETURN is_operating_day AND is_valid_time AND NOT is_holiday;
      END;
      $function$;
    `;

    const { error: funcError1 } = await supabaseAdmin.rpc('exec_sql', { sql_query: isSlotValidFunction });
    if (funcError1) {
      console.error('Error updating is_slot_valid_in_schedule:', funcError1);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to update is_slot_valid_in_schedule function',
        details: funcError1
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Update generate_open_days_and_slots function to use array format
    const generateFunction = `
      CREATE OR REPLACE FUNCTION public.generate_open_days_and_slots(days_ahead integer DEFAULT 60)
      RETURNS void
      LANGUAGE plpgsql
      AS $function$
      DECLARE
        operating_days JSONB;
        time_slots JSONB;
        max_capacity INTEGER;
        max_bookings INTEGER;
        current_date_iter DATE;
        day_name TEXT;
        time_slot TEXT;
        is_holiday BOOLEAN;
        season_start_month INTEGER;
        season_start_day INTEGER;
        season_end_month INTEGER;
        season_end_day INTEGER;
        within_season BOOLEAN;
      BEGIN
        -- Get current settings
        SELECT setting_value INTO operating_days FROM schedule_settings WHERE setting_key = 'operating_days';
        SELECT setting_value INTO time_slots FROM schedule_settings WHERE setting_key = 'time_slots';
        SELECT (setting_value #>> '{}')::INTEGER INTO max_capacity FROM schedule_settings WHERE setting_key = 'max_bouquets_per_slot';
        SELECT (setting_value #>> '{}')::INTEGER INTO max_bookings FROM schedule_settings WHERE setting_key = 'max_bookings_per_slot';
        
        -- Get season settings
        SELECT (setting_value #>> '{}')::INTEGER INTO season_start_month FROM schedule_settings WHERE setting_key = 'season_start_month';
        SELECT (setting_value #>> '{}')::INTEGER INTO season_start_day FROM schedule_settings WHERE setting_key = 'season_start_day';
        SELECT (setting_value #>> '{}')::INTEGER INTO season_end_month FROM schedule_settings WHERE setting_key = 'season_end_month';
        SELECT (setting_value #>> '{}')::INTEGER INTO season_end_day FROM schedule_settings WHERE setting_key = 'season_end_day';

        -- Generate dates for the specified number of days ahead
        FOR i IN 0..days_ahead LOOP
          current_date_iter := CURRENT_DATE + INTERVAL '1 day' * i;

          -- Get day name (lowercase)
          day_name := LOWER(TO_CHAR(current_date_iter, 'Day'));
          day_name := TRIM(day_name);

          -- Check if this date is a holiday
          SELECT EXISTS(
            SELECT 1 FROM holidays 
            WHERE date = current_date_iter 
            AND (is_disabled IS FALSE OR is_disabled IS NULL)
          ) INTO is_holiday;
          
          -- Check if within season
          within_season := (
            (EXTRACT(MONTH FROM current_date_iter) > season_start_month OR 
             (EXTRACT(MONTH FROM current_date_iter) = season_start_month AND EXTRACT(DAY FROM current_date_iter) >= season_start_day))
            AND
            (EXTRACT(MONTH FROM current_date_iter) < season_end_month OR 
             (EXTRACT(MONTH FROM current_date_iter) = season_end_month AND EXTRACT(DAY FROM current_date_iter) <= season_end_day))
          );

          -- Check if this is an operating day and within season and not a holiday (using array format)
          IF (operating_days @> to_jsonb(day_name)) AND within_season AND NOT is_holiday THEN
            -- Insert open day (skip if exists)
            INSERT INTO open_days (date, is_open)
            VALUES (current_date_iter, true)
            ON CONFLICT (date) DO UPDATE SET is_open = true;

            -- Insert time slots for this open day (skip if exists)
            FOR j IN 0..jsonb_array_length(time_slots) - 1 LOOP
              time_slot := time_slots ->> j;
              INSERT INTO time_slots (date, time, max_bouquets, max_bookings, is_legacy)
              VALUES (current_date_iter, time_slot, max_capacity, max_bookings, false)
              ON CONFLICT (date, time) DO UPDATE SET
                max_bouquets = CASE WHEN time_slots.is_legacy THEN time_slots.max_bouquets ELSE EXCLUDED.max_bouquets END,
                max_bookings = CASE WHEN time_slots.is_legacy THEN time_slots.max_bookings ELSE EXCLUDED.max_bookings END;
            END LOOP;
          ELSE
            -- Mark as closed if it's a holiday or not an operating day or out of season
            INSERT INTO open_days (date, is_open)
            VALUES (current_date_iter, false)
            ON CONFLICT (date) DO UPDATE SET is_open = false;
          END IF;
        END LOOP;
      END;
      $function$;
    `;

    const { error: funcError2 } = await supabaseAdmin.rpc('exec_sql', { sql_query: generateFunction });
    if (funcError2) {
      console.error('Error updating generate_open_days_and_slots:', funcError2);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to update generate_open_days_and_slots function',
        details: funcError2
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Refresh the schedule to apply the fix
    const { error: refreshError } = await supabaseAdmin.rpc('refresh_future_schedule');
    if (refreshError) {
      console.error('Error refreshing schedule:', refreshError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to refresh schedule after fix',
        details: refreshError
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Operating days fix applied successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Operating days format fix applied successfully. Schedule has been refreshed.' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Operating days fix error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Server error applying fix',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
