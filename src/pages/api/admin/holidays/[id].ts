import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

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
    const { data: holiday } = await supabaseAdmin
      .from('holidays')
      .select('date, name, is_auto_generated')
      .eq('id', id)
      .single();

    if (!holiday) {
      return new Response(JSON.stringify({ success: false, error: 'Holiday not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if there are existing bookings for this date
    const { data: bookings } = await supabaseAdmin
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

    // For automatic holidays, disable instead of delete
    // For manual holidays, delete completely
    let error;
    if (holiday.is_auto_generated) {
      // Disable automatic holiday
      const result = await supabaseAdmin
        .from('holidays')
        .update({ is_disabled: true })
        .eq('id', id);
      error = result.error;
    } else {
      // Delete manual holiday completely
      const result = await supabaseAdmin
        .from('holidays')
        .delete()
        .eq('id', id);
      error = result.error;
    }

    if (error) {
      console.error('Error deleting holiday:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Refresh future schedule to account for removed holiday
    const { error: refreshError } = await supabaseAdmin.rpc('refresh_future_schedule');
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
