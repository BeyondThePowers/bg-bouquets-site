// src/pages/api/garden-mgmt/document-refund.ts
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

// Helper function to verify admin authentication
async function verifyAdminAuth(request: Request): Promise<boolean> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }

    const password = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Get admin password from settings
    const { data: settings, error } = await supabase
      .from('schedule_settings')
      .select('setting_value')
      .eq('setting_key', 'admin_password')
      .single();

    if (error || !settings) {
      return false;
    }

    // Handle password format
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

export const POST: APIRoute = async ({ request }) => {
  try {
    // Verify admin authentication
    if (!(await verifyAdminAuth(request))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { bookingId, refundAmount, refundMethod, refundNotes, adminUser, previousRefund } = body;

    // Validate required fields
    if (!bookingId || !refundAmount || !refundMethod || !adminUser) {
      return new Response(JSON.stringify({ 
        error: 'Booking ID, refund amount, refund method, and admin user are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate refund amount is positive
    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0) {
      return new Response(JSON.stringify({ 
        error: 'Refund amount must be a positive number' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Documenting refund:', { bookingId, refundAmount: amount, refundMethod, adminUser });

    // Call the database function to document refund
    const { data, error } = await supabase.rpc('document_refund', {
      p_booking_id: bookingId,
      p_refund_amount: amount,
      p_refund_method: refundMethod,
      p_refund_notes: refundNotes || null,
      p_admin_user: adminUser
    });

    console.log('Refund documentation result:', { data, error });

    if (error) {
      console.error('Database error during refund documentation:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to document refund. Please try again.' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if documentation was successful
    const result = data?.[0];
    if (!result?.success) {
      return new Response(JSON.stringify({
        error: result?.message || 'Refund documentation failed'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create history entry for refund documentation/update
    try {
      let historyReason = '';

      if (previousRefund) {
        // This is an update - create a diff
        const changes = [];

        if (previousRefund.amount !== amount) {
          changes.push(`Amount: $${previousRefund.amount} → $${amount}`);
        }

        if (previousRefund.method !== refundMethod) {
          changes.push(`Method: ${previousRefund.method} → ${refundMethod}`);
        }

        if ((previousRefund.notes || '') !== (refundNotes || '')) {
          changes.push(`Notes: "${previousRefund.notes || 'none'}" → "${refundNotes || 'none'}"`);
        }

        if (changes.length > 0) {
          historyReason = `Refund document updated - ${changes.join(', ')}`;
        } else {
          historyReason = 'Refund document updated (no changes detected)';
        }
      } else {
        // This is a new refund
        historyReason = `Refund documented - Amount: $${amount}, Method: ${refundMethod}${refundNotes ? `, Notes: ${refundNotes}` : ''}`;
      }

      const { error: historyError } = await supabaseAdmin
        .from('booking_actions')
        .insert({
          booking_id: bookingId,
          action_type: 'cancellation', // Using existing allowed type
          original_booking_data: {
            previous_refund: previousRefund,
            new_refund: {
              amount,
              method: refundMethod,
              notes: refundNotes
            }
          },
          reason: historyReason,
          performed_by_customer: false,
          performed_by_admin: adminUser,
          action_timestamp: new Date().toISOString()
        });

      if (historyError) {
        console.error('Error creating refund history entry:', historyError);
        // Don't fail the request if history creation fails, just log it
      }
    } catch (historyError) {
      console.error('Error creating refund history:', historyError);
      // Don't fail the request if history creation fails
    }

    // Get updated booking details for response
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, full_name, email, date, time, total_amount, admin_refund_amount, admin_refund_method, admin_refund_date, admin_refund_by')
      .eq('id', bookingId)
      .single();

    if (bookingError) {
      console.error('Error fetching updated booking:', bookingError);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Refund documented successfully',
      refund: {
        bookingId,
        customerName: booking?.full_name,
        originalAmount: booking?.total_amount,
        refundAmount: amount,
        refundMethod,
        refundNotes,
        refundDate: booking?.admin_refund_date,
        refundBy: adminUser
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Refund documentation API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error. Please try again.' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async ({ request, url }) => {
  try {
    // Verify admin authentication
    if (!(await verifyAdminAuth(request))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const bookingId = url.searchParams.get('bookingId');

    if (!bookingId) {
      return new Response(JSON.stringify({ 
        error: 'Booking ID is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get refund information for the booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('id, full_name, email, date, time, total_amount, admin_refund_amount, admin_refund_method, admin_refund_notes, admin_refund_date, admin_refund_by')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      return new Response(JSON.stringify({ 
        error: 'Booking not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      booking: {
        id: booking.id,
        customerName: booking.full_name,
        email: booking.email,
        date: booking.date,
        time: booking.time,
        totalAmount: booking.total_amount,
        refund: booking.admin_refund_amount ? {
          amount: booking.admin_refund_amount,
          method: booking.admin_refund_method,
          notes: booking.admin_refund_notes,
          date: booking.admin_refund_date,
          processedBy: booking.admin_refund_by
        } : null
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Refund information API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
