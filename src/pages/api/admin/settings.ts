import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const GET: APIRoute = async () => {
  try {
    const { data: settings, error } = await supabase
      .from('schedule_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'operating_days',
        'time_slots', 
        'max_bookings_per_slot',
        'max_visitors_per_slot'
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
      max_visitors_per_slot 
    } = await request.json();

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
      return new Response(JSON.stringify({ success: false, error: 'Max visitors per slot must be at least 1' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update settings
    const updates = [
      { setting_key: 'operating_days', setting_value: JSON.stringify(operating_days) },
      { setting_key: 'time_slots', setting_value: JSON.stringify(time_slots) },
      { setting_key: 'max_bookings_per_slot', setting_value: JSON.stringify(max_bookings_per_slot) },
      { setting_key: 'max_visitors_per_slot', setting_value: JSON.stringify(max_visitors_per_slot) }
    ];

    for (const update of updates) {
      const { error } = await supabase
        .from('schedule_settings')
        .upsert({
          ...update,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      if (error) {
        console.error(`Error updating ${update.setting_key}:`, error);
        return new Response(JSON.stringify({ success: false, error: `Failed to update ${update.setting_key}` }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
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
