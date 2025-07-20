import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export const GET: APIRoute = async () => {
  try {
    const { data: holidays, error } = await supabaseAdmin
      .from('holidays')
      .select('*')
      .gte('date', new Date().toISOString().split('T')[0]) // Only future holidays
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching holidays:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(holidays || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Holidays API error:', error);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { date, name } = await request.json();

    if (!date || !name) {
      return new Response(JSON.stringify({ success: false, error: 'Date and name are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate date is not in the past
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      return new Response(JSON.stringify({ success: false, error: 'Cannot add holidays in the past' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if holiday already exists
    const { data: existing } = await supabaseAdmin
      .from('holidays')
      .select('id')
      .eq('date', date)
      .single();

    if (existing) {
      return new Response(JSON.stringify({ success: false, error: 'Holiday already exists for this date' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Add new holiday
    const { error } = await supabaseAdmin
      .from('holidays')
      .insert({
        date,
        name,
        is_recurring: false,
        is_auto_generated: false
      });

    if (error) {
      console.error('Error adding holiday:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Refresh future schedule to account for new holiday using the robust regeneration API
    try {
      // Use the more robust regenerate-schedule API instead of the SQL function
      const siteUrl = process.env.SITE_URL || import.meta.env.SITE_URL || 'http://localhost:4322';
      const regenerateResponse = await fetch(`${siteUrl}/api/admin/regenerate-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (regenerateResponse.ok) {
        const regenerateResult = await regenerateResponse.json();
        console.log('Schedule regenerated successfully after adding holiday:', regenerateResult.message);
      } else {
        console.warn('Schedule regeneration failed after adding holiday:', regenerateResponse.status);
        // Fallback to the SQL function if the API call fails
        const { error: fallbackError } = await supabaseAdmin.rpc('refresh_future_schedule');
        if (fallbackError) {
          console.warn('Fallback schedule refresh also failed:', fallbackError);
        }
      }
    } catch (refreshError) {
      console.warn('Warning: Could not refresh schedule after adding holiday:', refreshError);
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
    console.error('Add holiday error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
