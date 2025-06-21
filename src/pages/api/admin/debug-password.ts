import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const GET: APIRoute = async () => {
  try {
    // Get admin password from settings
    const { data: settings, error } = await supabase
      .from('schedule_settings')
      .select('setting_value')
      .eq('setting_key', 'admin_password')
      .single();

    if (error || !settings) {
      return new Response(JSON.stringify({ 
        error: 'Could not fetch password', 
        details: error?.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      raw_value: settings.setting_value,
      type: typeof settings.setting_value,
      length: settings.setting_value?.length,
      starts_with_quote: settings.setting_value?.startsWith?.('"'),
      ends_with_quote: settings.setting_value?.endsWith?.('"')
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Debug failed', 
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
