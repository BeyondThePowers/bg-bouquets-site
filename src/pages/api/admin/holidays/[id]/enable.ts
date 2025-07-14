import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../../../lib/supabase-admin';

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

    // Refresh future schedule to account for enabled holiday
    const { error: refreshError } = await supabaseAdmin.rpc('refresh_future_schedule');
    if (refreshError) {
      console.warn('Warning: Could not refresh schedule:', refreshError);
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
