import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

export const POST: APIRoute = async () => {
  try {
    console.log('Force refresh requested - clearing all future data and regenerating');
    
    // Step 1: Clear ALL future data (not just > CURRENT_DATE)
    const today = new Date().toISOString().split('T')[0];
    console.log('Today:', today);
    
    const { error: clearSlotsError } = await supabaseAdmin
      .from('time_slots')
      .delete()
      .gte('date', today);
    
    if (clearSlotsError) {
      console.error('Error clearing time slots:', clearSlotsError);
    } else {
      console.log('Cleared future time slots');
    }
    
    const { error: clearDaysError } = await supabaseAdmin
      .from('open_days')
      .delete()
      .gte('date', today);
    
    if (clearDaysError) {
      console.error('Error clearing open days:', clearDaysError);
    } else {
      console.log('Cleared future open days');
    }
    
    // Step 2: Get settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('schedule_settings')
      .select('setting_key, setting_value');
    
    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to fetch settings: ' + settingsError.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const settingsMap = new Map(settings?.map(s => [s.setting_key, s.setting_value]) || []);
    const operatingDaysStr = settingsMap.get('operating_days') as string;
    const timeSlotsStr = settingsMap.get('time_slots') as string;
    const maxCapacity = parseInt(settingsMap.get('max_visitors_per_slot') as string || '10');
    const seasonStartMonth = parseInt(settingsMap.get('season_start_month') as string || '5');
    const seasonStartDay = parseInt(settingsMap.get('season_start_day') as string || '15');
    const seasonEndMonth = parseInt(settingsMap.get('season_end_month') as string || '9');
    const seasonEndDay = parseInt(settingsMap.get('season_end_day') as string || '30');

    console.log('Settings:', {
      operatingDaysStr,
      timeSlotsStr,
      maxCapacity,
      seasonStartMonth,
      seasonStartDay,
      seasonEndMonth,
      seasonEndDay
    });
    
    // Parse the JSON strings
    const operatingDays = JSON.parse(operatingDaysStr || '[]');
    const timeSlots = JSON.parse(timeSlotsStr || '[]');
    
    console.log('Parsed:', { operatingDays, timeSlots });
    
    // Helper function to check if a date is within season
    function isWithinSeason(date: Date): boolean {
      const month = date.getMonth() + 1; // JavaScript months are 0-based
      const day = date.getDate();

      // Create season start and end dates for current year
      const seasonStart = new Date(date.getFullYear(), seasonStartMonth - 1, seasonStartDay);
      const seasonEnd = new Date(date.getFullYear(), seasonEndMonth - 1, seasonEndDay);

      // Handle cross-year seasons (e.g., Nov 1 - Mar 31)
      if (seasonStartMonth > seasonEndMonth) {
        // Season crosses year boundary
        return date >= seasonStart || date <= seasonEnd;
      } else {
        // Normal season within same year
        return date >= seasonStart && date <= seasonEnd;
      }
    }

    // Step 3: Generate dates manually for the next 400 days (over 1 year)
    const daysToGenerate = 400;
    const generatedDays = [];
    const generatedSlots = [];

    for (let i = 0; i < daysToGenerate; i++) {
      const currentDate = new Date();
      currentDate.setDate(currentDate.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];

      // Get day name (lowercase)
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

      // Check if this date is within the season
      const withinSeason = isWithinSeason(currentDate);

      // Check if this date is a holiday
      const { data: holidayCheck } = await supabaseAdmin
        .from('holidays')
        .select('id')
        .eq('date', dateStr)
        .eq('is_disabled', false)
        .single();

      const isHoliday = !!holidayCheck;

      // Check if this day is an operating day, within season, and not a holiday
      const isOpen = operatingDays.includes(dayName) && withinSeason && !isHoliday;
      
      // Insert open day
      generatedDays.push({
        date: dateStr,
        is_open: isOpen
      });
      
      // If it's open, generate time slots
      if (isOpen) {
        for (const timeSlot of timeSlots) {
          generatedSlots.push({
            date: dateStr,
            time: timeSlot,
            max_capacity: maxCapacity
          });
        }
      }
    }
    
    console.log(`Generated ${generatedDays.length} days and ${generatedSlots.length} time slots`);
    
    // Step 4: Insert the generated data
    if (generatedDays.length > 0) {
      const { error: insertDaysError } = await supabaseAdmin
        .from('open_days')
        .insert(generatedDays);
      
      if (insertDaysError) {
        console.error('Error inserting open days:', insertDaysError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to insert open days: ' + insertDaysError.message 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    if (generatedSlots.length > 0) {
      const { error: insertSlotsError } = await supabaseAdmin
        .from('time_slots')
        .insert(generatedSlots);
      
      if (insertSlotsError) {
        console.error('Error inserting time slots:', insertSlotsError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to insert time slots: ' + insertSlotsError.message 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Step 5: Verify what was created
    const { data: openDays } = await supabaseAdmin
      .from('open_days')
      .select('date, is_open')
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(10);
    
    const { data: timeSlotData } = await supabaseAdmin
      .from('time_slots')
      .select('date, time, max_capacity')
      .gte('date', today)
      .order('date, time', { ascending: true })
      .limit(10);
    
    console.log('Verification - Open days:', openDays);
    console.log('Verification - Time slots:', timeSlotData);
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Force refresh completed successfully',
      generatedDays: generatedDays.length,
      generatedSlots: generatedSlots.length,
      sampleOpenDays: openDays?.slice(0, 5),
      sampleTimeSlots: timeSlotData?.slice(0, 5)
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Force refresh error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Server error during force refresh: ' + (error as Error).message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
