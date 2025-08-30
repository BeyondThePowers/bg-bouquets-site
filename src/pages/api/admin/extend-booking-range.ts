import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-admin';

// Extract the status check logic into a reusable function
async function getBookingRangeStatus() {
  try {
    // Get current booking range status
    const today = new Date().toISOString().split('T')[0];
    
    const { data: openDays, error: openError } = await supabaseAdmin
      .from('open_days')
      .select('date')
      .gte('date', today)
      .order('date', { ascending: false })
      .limit(1);
    
    if (openError) {
      console.error('❌ Error getting open days:', openError);
      throw new Error('Failed to get open days: ' + openError.message);
    }
    
    const maxFutureDate = openDays?.[0]?.date || today;
    const daysRemaining = Math.floor((new Date(maxFutureDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
    
    // Count total open days and time slots
    const { count: totalOpenDays } = await supabaseAdmin
      .from('open_days')
      .select('*', { count: 'exact', head: true })
      .gte('date', today)
      .eq('is_open', true);
    
    const { count: totalTimeSlots } = await supabaseAdmin
      .from('time_slots')
      .select('*', { count: 'exact', head: true })
      .gte('date', today);
    
    return {
      current_date: today,
      max_future_date: maxFutureDate,
      days_remaining: daysRemaining,
      total_open_days: totalOpenDays || 0,
      total_time_slots: totalTimeSlots || 0,
      needs_extension: daysRemaining < 365
    };
  } catch (error) {
    console.error('Error in getBookingRangeStatus:', error);
    throw error;
  }
}

// Function to perform the force refresh operation directly
async function performForceRefresh() {
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
      throw new Error('Failed to clear time slots: ' + clearSlotsError.message);
    } else {
      console.log('Cleared future time slots');
    }
    
    const { error: clearDaysError } = await supabaseAdmin
      .from('open_days')
      .delete()
      .gte('date', today);
    
    if (clearDaysError) {
      console.error('Error clearing open days:', clearDaysError);
      throw new Error('Failed to clear open days: ' + clearDaysError.message);
    } else {
      console.log('Cleared future open days');
    }
    
    // Step 2: Get settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('schedule_settings')
      .select('setting_key, setting_value');
    
    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      throw new Error('Failed to fetch settings: ' + settingsError.message);
    }
    
    const settingsMap = new Map(settings?.map(s => [s.setting_key, s.setting_value]) || []);
    const operatingDaysStr = settingsMap.get('operating_days') as string;
    const timeSlotsStr = settingsMap.get('time_slots') as string;
    const maxBouquets = parseInt(settingsMap.get('max_bouquets_per_slot') as string || '10');
    const maxBookings = parseInt(settingsMap.get('max_bookings_per_slot') as string || '3');
    const seasonStartMonth = parseInt(settingsMap.get('season_start_month') as string || '5');
    const seasonStartDay = parseInt(settingsMap.get('season_start_day') as string || '15');
    const seasonEndMonth = parseInt(settingsMap.get('season_end_month') as string || '9');
    const seasonEndDay = parseInt(settingsMap.get('season_end_day') as string || '30');

    console.log('Settings:', {
      operatingDaysStr,
      timeSlotsStr,
      maxBouquets,
      maxBookings,
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

    // Step 3: Generate dates in batches to avoid timeouts
    const totalDaysToGenerate = 400;
    const batchSize = 100;
    const totalGeneratedDays = [];
    const totalGeneratedSlots = [];

    // Pre-fetch all holidays to avoid repeated database queries
    const { data: allHolidays } = await supabaseAdmin
      .from('holidays')
      .select('date')
      .eq('is_disabled', false);

    const holidayDates = new Set(allHolidays?.map(h => h.date) || []);
    console.log(`Loaded ${holidayDates.size} holidays for batch processing`);

    // Process in batches
    for (let batchStart = 0; batchStart < totalDaysToGenerate; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, totalDaysToGenerate);
      const batchNumber = Math.floor(batchStart / batchSize) + 1;
      const totalBatches = Math.ceil(totalDaysToGenerate / batchSize);

      console.log(`Processing batch ${batchNumber}/${totalBatches}: days ${batchStart}-${batchEnd-1}`);

      const batchDays = [];
      const batchSlots = [];

      for (let i = batchStart; i < batchEnd; i++) {
        const currentDate = new Date();
        currentDate.setDate(currentDate.getDate() + i);
        const dateStr = currentDate.toISOString().split('T')[0];

        // Get day name (lowercase)
        const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

        // Check if this date is within the season
        const withinSeason = isWithinSeason(currentDate);

        // Check if this date is a holiday (using pre-fetched data)
        const isHoliday = holidayDates.has(dateStr);

        // Check if this day is an operating day, within season, and not a holiday
        const isOpen = operatingDays.includes(dayName) && withinSeason && !isHoliday;

        // Add to batch
        batchDays.push({
          date: dateStr,
          is_open: isOpen
        });

        // If it's open, generate time slots
        if (isOpen) {
          for (const timeSlot of timeSlots) {
            batchSlots.push({
              date: dateStr,
              time: timeSlot,
              max_bouquets: maxBouquets,
              max_bookings: maxBookings
            });
          }
        }
      }

      console.log(`Batch ${batchNumber}: Generated ${batchDays.length} days, ${batchSlots.length} slots`);

      // Insert batch data
      if (batchDays.length > 0) {
        const { error: insertDaysError } = await supabaseAdmin
          .from('open_days')
          .insert(batchDays);

        if (insertDaysError) {
          console.error(`Error inserting batch ${batchNumber} open days:`, insertDaysError);
          throw new Error(`Failed to insert batch ${batchNumber} open days: ` + insertDaysError.message);
        }
      }

      if (batchSlots.length > 0) {
        const { error: insertSlotsError } = await supabaseAdmin
          .from('time_slots')
          .insert(batchSlots);

        if (insertSlotsError) {
          console.error(`Error inserting batch ${batchNumber} time slots:`, insertSlotsError);
          throw new Error(`Failed to insert batch ${batchNumber} time slots: ` + insertSlotsError.message);
        }
      }

      // Add to totals
      totalGeneratedDays.push(...batchDays);
      totalGeneratedSlots.push(...batchSlots);

      console.log(`Batch ${batchNumber} completed successfully`);
    }

    console.log(`All batches completed! Total: ${totalGeneratedDays.length} days, ${totalGeneratedSlots.length} slots`);
    
    // Return success result
    return {
      success: true,
      message: 'Force refresh completed successfully',
      generatedDays: totalGeneratedDays.length,
      generatedSlots: totalGeneratedSlots.length
    };
  } catch (error) {
    console.error('Force refresh error:', error);
    throw error;
  }
}

export const POST: APIRoute = async () => {
  try {
    console.log('🔄 Manual booking range extension requested');

    // Get the current status directly using our extracted function
    const statusData = await getBookingRangeStatus();
    console.log('📊 Current booking range status:', statusData);

    // Check if extension is needed
    const minDaysThreshold = 365;
    const targetDays = 400;

    if (statusData.days_remaining >= minDaysThreshold) {
      const response = {
        success: true,
        timestamp: new Date().toISOString(),
        timezone: 'America/Edmonton',
        status: statusData,
        extension: {
          extended: false,
          reason: 'sufficient_range',
          days_remaining: statusData.days_remaining,
          threshold: minDaysThreshold
        },
        message: `ℹ️ No extension needed. ${statusData.days_remaining} days remaining (threshold: ${minDaysThreshold} days).`
      };

      console.log('🎯 Manual extension result:', response.message);
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Extension needed - call our direct function instead of making an HTTP request
    console.log(`🔄 Extension needed: ${statusData.days_remaining} < ${minDaysThreshold} days`);

    const forceRefreshResult = await performForceRefresh();

    // Since our performForceRefresh function only returns a successful result or throws an error,
    // we don't need to check !forceRefreshResult.success anymore - it's always true

    // Get updated status after extension - directly using our function
    const updatedStatus = await getBookingRangeStatus();

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      timezone: 'America/Edmonton',
      status: updatedStatus,
      extension: {
        extended: true,
        reason: 'range_extended',
        previous_days_remaining: statusData.days_remaining,
        new_days_remaining: updatedStatus.days_remaining,
        generated_days: forceRefreshResult.generatedDays,
        generated_slots: forceRefreshResult.generatedSlots
      },
      message: `✅ Booking range extended! Generated ${forceRefreshResult.generatedDays} open days and ${forceRefreshResult.generatedSlots} time slots.`
    };

    console.log('🎯 Manual extension result:', response.message);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Manual extension error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Server error during manual extension: ' + (error as Error).message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async () => {
  try {
    console.log('📊 Booking range status requested');

    // Use our extracted function for consistency
    try {
      const statusData = await getBookingRangeStatus();
      console.log('📊 Current booking range status:', statusData);
      
      return new Response(JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        timezone: 'America/Edmonton',
        status: statusData
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      throw error;
    }

  } catch (error) {
    console.error('💥 Status check error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Server error during status check: ' + (error as Error).message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
