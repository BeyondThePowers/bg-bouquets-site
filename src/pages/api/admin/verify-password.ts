import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { password } = await request.json();

    // Get admin password from settings
    const { data: settings, error } = await supabase
      .from('schedule_settings')
      .select('setting_value')
      .eq('setting_key', 'admin_password')
      .single();

    if (error || !settings) {
      console.error('Error fetching admin password:', error);
      return new Response(JSON.stringify({ success: false, error: 'Configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // The setting_value is stored as JSONB, so it's already a string when we get it
    // If it's stored as "admin123" (with quotes), we need to parse it
    // If it's stored as admin123 (without quotes), we use it directly
    let adminPassword;

    if (typeof settings.setting_value === 'string') {
      // If it's already a string, use it directly
      adminPassword = settings.setting_value;
    } else {
      // If it's stored as JSON, parse it
      adminPassword = settings.setting_value;
    }

    // Remove quotes if they exist (in case it's stored as "admin123")
    if (typeof adminPassword === 'string' && adminPassword.startsWith('"') && adminPassword.endsWith('"')) {
      adminPassword = adminPassword.slice(1, -1);
    }

    console.log('Stored password:', adminPassword, 'Provided password:', password);
    const isValid = password === adminPassword;

    return new Response(JSON.stringify({ success: isValid }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Password verification error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
