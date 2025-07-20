import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';

export const POST: APIRoute = async ({ params }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ success: false, error: 'Holiday ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if holiday exists and is auto-generated
    const { data: holiday } = await supabaseAdmin
      .from('holidays')
      .select('date, name, is_auto_generated, is_disabled')
      .eq('id', id)
      .single();

    if (!holiday) {
      return new Response(JSON.stringify({ success: false, error: 'Holiday not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!holiday.is_auto_generated) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Only automatic holidays can be enabled/disabled' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!holiday.is_disabled) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Holiday is already enabled' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Enable the holiday
    const { error } = await supabaseAdmin
      .from('holidays')
      .update({ is_disabled: false })
      .eq('id', id);

    if (error) {
      console.error('Error enabling holiday:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Refresh future schedule to account for enabled holiday using the robust regeneration API
    try {
      const siteUrl = process.env.SITE_URL || import.meta.env.SITE_URL || 'http://localhost:4322';
      const regenerateResponse = await fetch(`${siteUrl}/api/admin/regenerate-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (regenerateResponse.ok) {
        const regenerateResult = await regenerateResponse.json();
        console.log('Schedule regenerated successfully after enabling holiday:', regenerateResult.message);
      } else {
        console.warn('Schedule regeneration failed after enabling holiday:', regenerateResponse.status);
        // Fallback to the SQL function if the API call fails
        const { error: fallbackError } = await supabaseAdmin.rpc('refresh_future_schedule');
        if (fallbackError) {
          console.warn('Fallback schedule refresh also failed:', fallbackError);
        }
      }
    } catch (refreshError) {
      console.warn('Warning: Could not refresh schedule after enabling holiday:', refreshError);
      // Fallback to the SQL function if the API call fails
      const { error: fallbackError } = await supabaseAdmin.rpc('refresh_future_schedule');
      if (fallbackError) {
        console.warn('Fallback schedule refresh also failed:', fallbackError);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Enable holiday error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
