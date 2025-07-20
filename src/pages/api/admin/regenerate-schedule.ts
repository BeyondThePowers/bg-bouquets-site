import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('Regenerating schedule with correct logic...');

    // 1. Get all settings
    const { data: allSettings, error: settingsError } = await supabaseAdmin
      .from('schedule_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'operating_days', 'time_slots', 'max_bouquets_per_slot', 'max_bookings_per_slot',
        'season_start_month', 'season_start_day', 'season_end_month', 'season_end_day'
      ]);

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to fetch settings',
        details: settingsError
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const settingsMap = {};
    allSettings?.forEach(s => {
      settingsMap[s.setting_key] = s.setting_value;
    });

    const operatingDays = JSON.parse(settingsMap.operating_days || '[]');
    const timeSlots = JSON.parse(settingsMap.time_slots || '[]');
    const maxBouquets = parseInt(settingsMap.max_bouquets_per_slot || '10');
    const maxBookings = parseInt(settingsMap.max_bookings_per_slot || '3');
    const seasonStartMonth = parseInt(settingsMap.season_start_month || '5');
    const seasonStartDay = parseInt(settingsMap.season_start_day || '21');
    const seasonEndMonth = parseInt(settingsMap.season_end_month || '9');
    const seasonEndDay = parseInt(settingsMap.season_end_day || '9');

    console.log('Settings loaded:', {
      operatingDays,
      timeSlots: timeSlots.length,
      maxBouquets,
      maxBookings,
      season: `${seasonStartMonth}/${seasonStartDay} - ${seasonEndMonth}/${seasonEndDay}`
    });

    // 2. Clear future data
    const today = new Date().toISOString().split('T')[0];
    
    const { error: clearSlotsError } = await supabaseAdmin
      .from('time_slots')
      .delete()
      .gte('date', today);
    
    const { error: clearDaysError } = await supabaseAdmin
      .from('open_days')
      .delete()
      .gte('date', today);

    if (clearSlotsError || clearDaysError) {
      console.error('Error clearing data:', clearSlotsError || clearDaysError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to clear existing data',
        details: clearSlotsError || clearDaysError
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Get holidays
    const { data: holidays } = await supabaseAdmin
      .from('holidays')
      .select('date')
      .eq('is_disabled', false);
    
    const holidayDates = new Set(holidays?.map(h => h.date) || []);

    // 4. Generate correct schedule
    const generatedDays = [];
    const generatedSlots = [];
    const daysAhead = 60;

    for (let i = 0; i < daysAhead; i++) {
      const currentDate = new Date();
      currentDate.setDate(currentDate.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

      // Check if within season
      const month = currentDate.getMonth() + 1;
      const day = currentDate.getDate();
      const withinSeason = (
        (month > seasonStartMonth || (month === seasonStartMonth && day >= seasonStartDay)) &&
        (month < seasonEndMonth || (month === seasonEndMonth && day <= seasonEndDay))
      );

      const isHoliday = holidayDates.has(dateStr);
      const isOperatingDay = operatingDays.includes(dayName);
      const isOpen = isOperatingDay && withinSeason && !isHoliday;

      generatedDays.push({
        date: dateStr,
        is_open: isOpen
      });

      if (isOpen) {
        timeSlots.forEach(timeSlot => {
          generatedSlots.push({
            date: dateStr,
            time: timeSlot,
            max_bouquets: maxBouquets,
            max_bookings: maxBookings,
            is_legacy: false
          });
        });
      }
    }

    // 5. Insert the generated data
    if (generatedDays.length > 0) {
      const { error: daysError } = await supabaseAdmin
        .from('open_days')
        .insert(generatedDays);
      
      if (daysError) {
        console.error('Error inserting open days:', daysError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to insert open days',
          details: daysError
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (generatedSlots.length > 0) {
      const { error: slotsError } = await supabaseAdmin
        .from('time_slots')
        .insert(generatedSlots);
      
      if (slotsError) {
        console.error('Error inserting time slots:', slotsError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to insert time slots',
          details: slotsError
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const openDaysCount = generatedDays.filter(d => d.is_open).length;
    
    console.log(`Schedule regenerated successfully: ${openDaysCount} open days, ${generatedSlots.length} time slots`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Schedule regenerated successfully: ${openDaysCount} open days, ${generatedSlots.length} time slots`,
      stats: {
        openDays: openDaysCount,
        timeSlots: generatedSlots.length,
        operatingDays: operatingDays
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Schedule regeneration error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Server error during schedule regeneration',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
