// src/pages/api/garden-mgmt/booking-notes.ts
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-admin';

// Helper function to verify admin authentication (reused from existing pattern)
async function verifyAdminAuth(request: Request): Promise<boolean> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }

    const password = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Get admin password from settings (same pattern as existing auth)
    const { data: settings, error } = await supabaseAdmin
      .from('schedule_settings')
      .select('setting_value')
      .eq('setting_key', 'admin_password')
      .single();

    if (error || !settings) {
      return false;
    }

    // Handle password format (same logic as existing verify-password.ts)
    let adminPassword = settings.setting_value;
    if (typeof adminPassword === 'string' && adminPassword.startsWith('"') && adminPassword.endsWith('"')) {
      adminPassword = adminPassword.slice(1, -1);
    }

    return password === adminPassword;
  } catch (error) {
    console.error('Admin auth verification error:', error);
    return false;
  }
}

// GET: Retrieve notes for a specific booking
export const GET: APIRoute = async ({ request, url }) => {
  try {
    // Verify admin authentication
    if (!(await verifyAdminAuth(request))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get booking ID from query parameters
    const bookingId = url.searchParams.get('bookingId');
    if (!bookingId) {
      return new Response(JSON.stringify({ error: 'Booking ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch booking notes from database
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('id, notes, notes_created_at, notes_updated_at, full_name')
      .eq('id', bookingId)
      .single();

    if (error) {
      console.error('Database error fetching booking notes:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch booking notes' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Return booking notes data
    return new Response(JSON.stringify({
      success: true,
      data: {
        bookingId: booking.id,
        customerName: booking.full_name,
        notes: booking.notes || '',
        notesCreatedAt: booking.notes_created_at,
        notesUpdatedAt: booking.notes_updated_at,
        hasNotes: !!(booking.notes && booking.notes.trim())
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unexpected error in GET booking notes:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// POST: Save/update notes for a booking
export const POST: APIRoute = async ({ request }) => {
  try {
    // Verify admin authentication
    if (!(await verifyAdminAuth(request))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const body = await request.json();
    const { bookingId, notes, adminUser } = body;

    // Validate required fields
    if (!bookingId) {
      return new Response(JSON.stringify({ error: 'Booking ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!adminUser || typeof adminUser !== 'string' || adminUser.trim() === '') {
      return new Response(JSON.stringify({ error: 'Admin user is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate notes (allow empty string to clear notes)
    const cleanNotes = notes === null || notes === undefined ? null : String(notes).trim();
    
    if (cleanNotes && cleanNotes.length > 2000) {
      return new Response(JSON.stringify({ 
        error: 'Notes cannot exceed 2000 characters',
        currentLength: cleanNotes.length,
        maxLength: 2000
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use the database function to update notes with proper timestamp handling
    const { data, error } = await supabaseAdmin.rpc('update_booking_notes', {
      p_booking_id: bookingId,
      p_notes: cleanNotes || null, // Convert empty string to null
      p_admin_user: adminUser.trim()
    });

    if (error) {
      console.error('Database error updating booking notes:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to update booking notes',
        details: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if the function returned success
    const result = data && data.length > 0 ? data[0] : null;
    if (!result || !result.success) {
      return new Response(JSON.stringify({ 
        error: result?.message || 'Failed to update booking notes' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch updated booking data to return current state
    const { data: updatedBooking, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('notes, notes_created_at, notes_updated_at, full_name')
      .eq('id', bookingId)
      .single();

    if (fetchError) {
      console.error('Error fetching updated booking:', fetchError);
      // Still return success since the update worked
      return new Response(JSON.stringify({
        success: true,
        message: 'Notes updated successfully',
        data: {
          bookingId,
          notes: cleanNotes,
          hasNotes: !!(cleanNotes && cleanNotes.trim())
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Return success with updated data
    return new Response(JSON.stringify({
      success: true,
      message: 'Notes updated successfully',
      data: {
        bookingId,
        customerName: updatedBooking.full_name,
        notes: updatedBooking.notes || '',
        notesCreatedAt: updatedBooking.notes_created_at,
        notesUpdatedAt: updatedBooking.notes_updated_at,
        hasNotes: !!(updatedBooking.notes && updatedBooking.notes.trim())
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unexpected error in POST booking notes:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
