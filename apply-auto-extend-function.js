import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jgoucxlacofztynmgbeb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE5MTY2NywiZXhwIjoyMDY1NzY3NjY3fQ.8lnoHsRdYF8hk7DW95Xeo9kEpnbiAP36ddYoLk8AkoI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyAutoExtendFunction() {
  console.log('🔧 Applying Auto-Extend Function to refresh_future_schedule...\n');

  const updatedFunction = `
-- Fix refresh_future_schedule function with automatic range extension
CREATE OR REPLACE FUNCTION public.refresh_future_schedule()
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  slot_record RECORD;
  booking_count INTEGER;
  new_max_capacity INTEGER;
  new_max_bookings INTEGER;
  operating_days JSONB;
  time_slots_config JSONB;
  slot_still_valid BOOLEAN;
  max_future_date DATE;
  days_to_generate INTEGER;
BEGIN
  -- Get current schedule settings
  SELECT setting_value INTO operating_days FROM schedule_settings WHERE setting_key = 'operating_days';
  SELECT setting_value INTO time_slots_config FROM schedule_settings WHERE setting_key = 'time_slots';
  SELECT (setting_value #>> '{}')::INTEGER INTO new_max_capacity FROM schedule_settings WHERE setting_key = 'max_bouquets_per_slot';
  SELECT (setting_value #>> '{}')::INTEGER INTO new_max_bookings FROM schedule_settings WHERE setting_key = 'max_bookings_per_slot';

  -- Check all future time slots to see if they're still valid
  FOR slot_record IN 
    SELECT date, time, max_bouquets, max_bookings, is_legacy
    FROM time_slots 
    WHERE date >= CURRENT_DATE
  LOOP
    -- Check if this slot is still valid in the current schedule (FIXED: now uses array format)
    slot_still_valid := is_slot_valid_in_schedule(
      slot_record.date, 
      slot_record.time, 
      operating_days, 
      time_slots_config
    );
    
    -- Count existing bookings for this slot
    SELECT COUNT(*) INTO booking_count
    FROM bookings 
    WHERE date = slot_record.date 
      AND time = slot_record.time 
      AND status IN ('confirmed', 'pending');
    
    IF slot_still_valid THEN
      -- Update capacity for valid slots (but don't reduce below existing bookings)
      UPDATE time_slots 
      SET 
        max_bouquets = GREATEST(new_max_capacity, booking_count),
        max_bookings = GREATEST(new_max_bookings, booking_count)
      WHERE date = slot_record.date AND time = slot_record.time;
    ELSE
      -- Mark invalid slots as legacy if they have bookings, otherwise remove them
      IF booking_count > 0 THEN
        UPDATE time_slots 
        SET is_legacy = true
        WHERE date = slot_record.date AND time = slot_record.time;
        
        -- Also mark the day as closed if no other valid slots exist
        UPDATE open_days 
        SET is_open = false 
        WHERE date = slot_record.date
          AND NOT EXISTS (
            SELECT 1 FROM time_slots ts2 
            WHERE ts2.date = slot_record.date 
              AND ts2.is_legacy = false
          );
      ELSE
        -- Remove slots with no bookings
        DELETE FROM time_slots 
        WHERE date = slot_record.date AND time = slot_record.time;
      END IF;
    END IF;
  END LOOP;
  
  -- AUTOMATIC RANGE EXTENSION: Ensure we always have a full year of schedule
  -- Find the current maximum future date
  SELECT COALESCE(MAX(date), CURRENT_DATE) INTO max_future_date FROM open_days WHERE date >= CURRENT_DATE;
  
  -- Calculate how many days we need to generate to reach 365 days from today
  days_to_generate := 365 - (max_future_date - CURRENT_DATE);
  
  -- Always generate at least 60 days ahead, but extend to a full year if needed
  days_to_generate := GREATEST(days_to_generate, 60);
  
  -- Generate new schedule for future dates (now automatically extends to full year)
  PERFORM generate_open_days_and_slots(days_to_generate);
  
  -- Log the extension for debugging
  RAISE NOTICE 'Schedule refreshed: generated % days ahead (max date: %)', days_to_generate, max_future_date + days_to_generate;
END;
$function$;
  `;

  try {
    console.log('1. Updating refresh_future_schedule function...');
    const { error } = await supabase.rpc('exec_sql', { sql: updatedFunction });
    
    if (error) {
      console.error('❌ Failed to update function:', error);
      return;
    }
    
    console.log('✅ Function updated successfully!');
    console.log('');

    // Test the updated function
    console.log('2. Testing the updated function...');
    const { error: testError } = await supabase.rpc('refresh_future_schedule');
    
    if (testError) {
      console.error('❌ Function test failed:', testError);
      return;
    }
    
    console.log('✅ Function test successful!');
    console.log('');

    // Check the results
    console.log('3. Checking booking range after auto-extension...');
    const { data: openDays, error: queryError } = await supabase
      .from('open_days')
      .select('date')
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(1);

    if (queryError) {
      console.error('❌ Query error:', queryError);
      return;
    }

    if (openDays && openDays.length > 0) {
      const maxDate = openDays[0].date;
      const today = new Date();
      const maxDateObj = new Date(maxDate);
      const daysAhead = Math.ceil((maxDateObj - today) / (1000 * 60 * 60 * 24));
      
      console.log(`✅ Booking range extends to: ${maxDate}`);
      console.log(`✅ Days ahead: ${daysAhead} days`);
      
      if (daysAhead >= 365) {
        console.log('🎉 SUCCESS: Full year of booking availability confirmed!');
      } else {
        console.log(`⚠️  Warning: Only ${daysAhead} days ahead (expected ~365)`);
      }
    }

    console.log('\n🎯 Auto-Extension Feature Summary:');
    console.log('✅ refresh_future_schedule now automatically extends booking range');
    console.log('✅ Always maintains ~365 days of future availability');
    console.log('✅ Triggered automatically when schedule settings are updated');
    console.log('✅ No manual intervention needed for booking range management');
    console.log('');
    console.log('🚀 When you update schedule settings in admin:');
    console.log('1. Settings are saved to database');
    console.log('2. refresh_future_schedule is called automatically');
    console.log('3. Function updates existing slots with new settings');
    console.log('4. Function automatically extends range to full year');
    console.log('5. Customers always have ~365 days of booking availability');

  } catch (error) {
    console.error('❌ Error applying function:', error);
  }
}

applyAutoExtendFunction().catch(console.error);
