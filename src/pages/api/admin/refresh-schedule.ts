import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export const POST: APIRoute = async () => {
  try {
    console.log('Manual schedule refresh requested');
    
    // Check current settings first
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
    
    console.log('Current settings:', settings);
    
    // Check if we have the required settings
    const settingsMap = new Map(settings?.map(s => [s.setting_key, s.setting_value]) || []);
    const operatingDays = settingsMap.get('operating_days');
    const timeSlots = settingsMap.get('time_slots');
    
    console.log('Operating days setting:', operatingDays);
    console.log('Time slots setting:', timeSlots);
    
    // Call the refresh function
    console.log('Calling refresh_future_schedule...');
    const { data, error } = await supabaseAdmin.rpc('refresh_future_schedule');
    
    if (error) {
      console.error('Error calling refresh_future_schedule:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Refresh function failed: ' + error.message,
        details: error
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log('Refresh function result:', data);
    
    // Check what was created
    const { data: openDays, error: openError } = await supabaseAdmin
      .from('open_days')
      .select('date, is_open')
      .order('date', { ascending: true })
      .limit(10);
    
    console.log('Open days after refresh:', openDays);
    
    const { data: timeSlotData, error: slotError } = await supabaseAdmin
      .from('time_slots')
      .select('date, time, max_capacity')
      .order('date, time', { ascending: true })
      .limit(10);
    
    console.log('Time slots after refresh:', timeSlotData);
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Schedule refresh completed',
      settings: Object.fromEntries(settingsMap),
      openDaysCount: openDays?.length || 0,
      timeSlotsCount: timeSlotData?.length || 0,
      sampleOpenDays: openDays?.slice(0, 5),
      sampleTimeSlots: timeSlotData?.slice(0, 5)
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Manual refresh error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Server error during manual refresh: ' + (error as Error).message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
