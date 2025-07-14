import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

export const POST: APIRoute = async () => {
  try {
    console.log('🔄 Manual booking range extension requested');

    // First get the current status using our GET logic
    const statusResponse = await fetch('http://localhost:4322/api/admin/extend-booking-range');
    const statusResult = await statusResponse.json();

    if (!statusResult.success) {
      return new Response(JSON.stringify(statusResult), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const statusData = statusResult.status;
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

    // Extension needed - use the existing force-refresh logic
    console.log(`🔄 Extension needed: ${statusData.days_remaining} < ${minDaysThreshold} days`);

    const forceRefreshResponse = await fetch('http://localhost:4322/api/admin/force-refresh', {
      method: 'POST'
    });

    const forceRefreshResult = await forceRefreshResponse.json();

    if (!forceRefreshResult.success) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to extend booking range: ' + forceRefreshResult.error
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get updated status after extension
    const updatedStatusResponse = await fetch('http://localhost:4322/api/admin/extend-booking-range');
    const updatedStatusResult = await updatedStatusResponse.json();
    const updatedStatus = updatedStatusResult.success ? updatedStatusResult.status : statusData;

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

    // Get current booking range status manually (since function doesn't exist yet)
    const { data: openDays, error: openError } = await supabaseAdmin
      .from('open_days')
      .select('date')
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(1);

    if (openError) {
      console.error('❌ Error getting open days:', openError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to get open days: ' + openError.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const today = new Date().toISOString().split('T')[0];
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

    const statusData = {
      current_date: today,
      max_future_date: maxFutureDate,
      days_remaining: daysRemaining,
      total_open_days: totalOpenDays || 0,
      total_time_slots: totalTimeSlots || 0,
      needs_extension: daysRemaining < 365
    };

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
