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

    // Update settings
    const updates = [
      { setting_key: 'operating_days', setting_value: JSON.stringify(operating_days) },
      { setting_key: 'time_slots', setting_value: JSON.stringify(time_slots) },
      { setting_key: 'max_bookings_per_slot', setting_value: JSON.stringify(max_bookings_per_slot) },
      { setting_key: 'max_bouquets_per_slot', setting_value: JSON.stringify(max_visitors_per_slot) }
    ];

    // Add seasonal settings if provided
    if (season_start_month !== undefined) {
      updates.push({ setting_key: 'season_start_month', setting_value: JSON.stringify(season_start_month) });
    }
    if (season_start_day !== undefined) {
      updates.push({ setting_key: 'season_start_day', setting_value: JSON.stringify(season_start_day) });
    }
    if (season_end_month !== undefined) {
      updates.push({ setting_key: 'season_end_month', setting_value: JSON.stringify(season_end_month) });
    }
    if (season_end_day !== undefined) {
      updates.push({ setting_key: 'season_end_day', setting_value: JSON.stringify(season_end_day) });
    }

    for (const update of updates) {
      console.log(`Updating ${update.setting_key} with value:`, update.setting_value);

      const { error } = await supabaseAdmin
        .from('schedule_settings')
        .upsert({
          ...update,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      if (error) {
        console.error(`Error updating ${update.setting_key}:`, error);
        console.error('Full error details:', JSON.stringify(error, null, 2));
        return new Response(JSON.stringify({ success: false, error: `Failed to update ${update.setting_key}` }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      console.log(`Successfully updated ${update.setting_key}`);
    }

    // Refresh the schedule to apply the new settings using our working force refresh
    console.log('Refreshing schedule with new settings...');
    try {
      const forceRefreshResponse = await fetch('http://localhost:4322/api/admin/force-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (forceRefreshResponse.ok) {
        console.log('Schedule refreshed successfully via force refresh');
      } else {
        console.error('Force refresh failed:', await forceRefreshResponse.text());
      }
    } catch (error) {
      console.error('Error calling force refresh:', error);
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
