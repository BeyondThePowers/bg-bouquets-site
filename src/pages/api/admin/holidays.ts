import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async () => {
  try {
    const { data: holidays, error } = await supabase
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
    const { date, name, reason } = await request.json();

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
    const { data: existing } = await supabase
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
    const { error } = await supabase
      .from('holidays')
      .insert({
        date,
        name,
        reason: reason || null, // Include reason if provided
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

    // Refresh future schedule to account for new holiday
    const { error: refreshError } = await supabase.rpc('refresh_future_schedule');
    if (refreshError) {
      console.warn('Warning: Could not refresh schedule:', refreshError);
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
