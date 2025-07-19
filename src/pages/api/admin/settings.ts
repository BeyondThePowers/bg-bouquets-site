import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export const GET: APIRoute = async () => {
  try {
    const { data: settings, error } = await supabase
      .from('schedule_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'operating_days',
        'time_slots',
        'max_bookings_per_slot',
        'max_bouquets_per_slot',
        'max_visitor_passes_per_booking',
        'season_start_month',
        'season_start_day',
        'season_end_month',
        'season_end_day'
      ]);

    if (error) {
      console.error('Error fetching settings:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Convert to object format
    const settingsObj: Record<string, any> = {};
    settings?.forEach(setting => {
      settingsObj[setting.setting_key] = setting.setting_value;
    });

    return new Response(JSON.stringify(settingsObj), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Settings API error:', error);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const {
      operating_days,
      time_slots,
      max_bookings_per_slot,
      max_visitors_per_slot, // Keep this for backward compatibility, will map to max_bouquets_per_slot
      max_visitor_passes_per_booking, // Add support for this parameter
      season_start_month,
      season_start_day,
      season_end_month,
      season_end_day
    } = await request.json();

    // Debug logging
    console.log('Received settings update request:');
    console.log('Operating days:', operating_days);
    console.log('Time slots:', time_slots);
    console.log('Max bookings per slot:', max_bookings_per_slot);
    console.log('Max bouquets per slot:', max_visitors_per_slot);
    console.log('Max visitor passes per booking:', max_visitor_passes_per_booking);
    console.log('Season start:', season_start_month, season_start_day);
    console.log('Season end:', season_end_month, season_end_day);

    // Validate input
    if (!operating_days || !Array.isArray(operating_days) || operating_days.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Operating days are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!time_slots || !Array.isArray(time_slots) || time_slots.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Time slots are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!max_bookings_per_slot || max_bookings_per_slot < 1) {
      return new Response(JSON.stringify({ success: false, error: 'Max bookings per slot must be at least 1' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!max_visitors_per_slot || max_visitors_per_slot < 1) {
      return new Response(JSON.stringify({ success: false, error: 'Max bouquets per slot must be at least 1' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (max_visitor_passes_per_booking === undefined || max_visitor_passes_per_booking < 0) {
      return new Response(JSON.stringify({ success: false, error: 'Max visitor passes per booking must be at least 0' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Define our update functions - completely avoid any potential for object spreading issues
    async function updateSetting(key: string, value: any): Promise<{ success: boolean, error?: any }> {
      console.log(`Updating ${key} with value:`, JSON.stringify(value));
      
      try {
        const { error } = await supabaseAdmin
          .from('schedule_settings')
          .upsert({
            setting_key: key,
            setting_value: JSON.stringify(value),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'setting_key'
          });
        
        if (error) {
          console.error(`Error updating ${key}:`, error);
          console.error('Full error details:', JSON.stringify(error, null, 2));
          return { success: false, error: error };
        }
        
        console.log(`Successfully updated ${key}`);
        return { success: true };
      } catch (err) {
        console.error(`Exception updating ${key}:`, err);
        return { success: false, error: err };
      }
    }
    
    // Update operating days
    const operatingDaysResult = await updateSetting('operating_days', operating_days);
    if (!operatingDaysResult.success) {
      return new Response(JSON.stringify({ success: false, error: `Failed to update operating_days` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update time slots
    const timeSlotsResult = await updateSetting('time_slots', time_slots);
    if (!timeSlotsResult.success) {
      return new Response(JSON.stringify({ success: false, error: `Failed to update time_slots` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update max bookings per slot
    const maxBookingsResult = await updateSetting('max_bookings_per_slot', max_bookings_per_slot);
    if (!maxBookingsResult.success) {
      return new Response(JSON.stringify({ success: false, error: `Failed to update max_bookings_per_slot` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update max bouquets per slot
    const maxBouquetsResult = await updateSetting('max_bouquets_per_slot', max_visitors_per_slot);
    if (!maxBouquetsResult.success) {
      return new Response(JSON.stringify({ success: false, error: `Failed to update max_bouquets_per_slot` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update max visitor passes per booking
    if (max_visitor_passes_per_booking !== undefined) {
      const maxPassesResult = await updateSetting('max_visitor_passes_per_booking', max_visitor_passes_per_booking);
      if (!maxPassesResult.success) {
        return new Response(JSON.stringify({ success: false, error: `Failed to update max_visitor_passes_per_booking` }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Update seasonal settings if provided
    if (season_start_month !== undefined) {
      const result = await updateSetting('season_start_month', season_start_month);
      if (!result.success) {
        return new Response(JSON.stringify({ success: false, error: `Failed to update season_start_month` }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    if (season_start_day !== undefined) {
      const result = await updateSetting('season_start_day', season_start_day);
      if (!result.success) {
        return new Response(JSON.stringify({ success: false, error: `Failed to update season_start_day` }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    if (season_end_month !== undefined) {
      const result = await updateSetting('season_end_month', season_end_month);
      if (!result.success) {
        return new Response(JSON.stringify({ success: false, error: `Failed to update season_end_month` }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    if (season_end_day !== undefined) {
      const result = await updateSetting('season_end_day', season_end_day);
      if (!result.success) {
        return new Response(JSON.stringify({ success: false, error: `Failed to update season_end_day` }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Refresh the schedule to apply the new settings directly using the RPC function
    console.log('Refreshing schedule with new settings via RPC...');
    try {
      const { error: refreshError } = await supabaseAdmin.rpc('refresh_future_schedule');
      
      if (refreshError) {
        console.error('Schedule refresh failed:', refreshError);
        console.warn('Settings updated but schedule refresh failed');
      } else {
        console.log('Schedule refreshed successfully via direct RPC call');
      }
    } catch (error) {
      console.error('Error refreshing schedule:', error);
      console.warn('Settings updated but schedule refresh failed');
    }
    console.log('Refreshing schedule with new settings via RPC...');
    try {
      const { error: refreshError } = await supabaseAdmin.rpc('refresh_future_schedule');
      
      if (refreshError) {
        console.error('Schedule refresh failed:', refreshError);
        console.warn('Settings updated but schedule refresh failed');
      } else {
        console.log('Schedule refreshed successfully via direct RPC call');
      }
    } catch (error) {
      console.error('Error refreshing schedule:', error);
      console.warn('Settings updated but schedule refresh failed');
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Update settings error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
