import type { APIRoute } from 'astro';
import { supabase } from '../../../../../lib/supabase';

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ success: false, error: 'Holiday ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if holiday exists and if it has existing bookings
    const { data: holiday } = await supabase
      .from('holidays')
      .select('date, name')
      .eq('id', id)
      .single();

    if (!holiday) {
      return new Response(JSON.stringify({ success: false, error: 'Holiday not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if there are existing bookings for this date
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('date', holiday.date);

    if (bookings && bookings.length > 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Cannot remove holiday - there are ${bookings.length} existing bookings for ${holiday.date}` 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete the holiday
    const { error } = await supabase
      .from('holidays')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting holiday:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Refresh future schedule to account for removed holiday
    const { error: refreshError } = await supabase.rpc('refresh_future_schedule');
    if (refreshError) {
      console.warn('Warning: Could not refresh schedule:', refreshError);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Delete holiday error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
