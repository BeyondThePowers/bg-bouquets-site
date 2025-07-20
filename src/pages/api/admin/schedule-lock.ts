import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

// Route to get current schedule lock status
export const GET: APIRoute = async () => {
  try {
    // Get the current lock status
    const { data, error } = await supabase
      .from('schedule_settings')
      .select('schedule_update_in_progress, schedule_update_scheduled_at, schedule_update_scheduled_by')
      .eq('setting_key', 'max_bouquets_per_slot')
      .single();

    if (error) {
      console.error('Error fetching schedule lock status:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      isLocked: data?.schedule_update_in_progress || false,
      scheduledUpdate: data?.schedule_update_scheduled_at || null,
      scheduledBy: data?.schedule_update_scheduled_by || null
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Schedule lock API error:', error);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Route to set schedule lock status
export const POST: APIRoute = async ({ request }) => {
  try {
    const {
      action, // 'lock', 'unlock', or 'schedule'
      scheduledTime, // ISO string for scheduled updates
      settings // JSON of settings to apply
    } = await request.json();

    if (!action) {
      return new Response(JSON.stringify({ error: 'Action is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get the current admin username (would come from auth in a real system)
    const adminUser = 'admin'; // Placeholder - should be replaced with actual auth

    switch (action) {
      case 'lock':
        // Lock the schedule for immediate editing
        await supabase
          .from('schedule_settings')
          .update({
            schedule_update_in_progress: true,
            schedule_update_scheduled_at: null,
            schedule_update_scheduled_by: adminUser,
            schedule_update_json: JSON.stringify({
              lock_timestamp: new Date().toISOString(),
              lock_by: adminUser,
              settings: settings || []
            })
          })
          .eq('setting_key', 'max_bouquets_per_slot');
        
        // Log the lock action
        await supabase
          .from('schedule_update_logs')
          .insert({
            updated_by: adminUser,
            update_type: 'immediate_lock',
            status: 'in_progress'
          });
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Schedule locked for editing'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      case 'unlock':
        // Apply changes and unlock the schedule
        if (settings && Array.isArray(settings)) {
          // First update all the settings
          for (const setting of settings) {
            if (setting.key && setting.value !== undefined) {
              await supabase
                .from('schedule_settings')
                .update({ setting_value: String(setting.value) })
                .eq('setting_key', setting.key);
            }
          }
          
          // Refresh the schedule with new settings
          await supabase.rpc('refresh_future_schedule');
        }

        // Unlock the schedule
        await supabase
          .from('schedule_settings')
          .update({
            schedule_update_in_progress: false,
            schedule_update_scheduled_at: null,
            schedule_update_scheduled_by: null,
            schedule_update_json: null
          })
          .eq('setting_key', 'max_bouquets_per_slot');
        
        // Log the unlock and apply action
        await supabase
          .from('schedule_update_logs')
          .insert({
            updated_by: adminUser,
            update_type: 'immediate_apply',
            update_data: settings ? JSON.stringify(settings) : null,
            status: 'completed'
          });
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Schedule changes applied and unlocked'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      case 'schedule':
        // Validate scheduled time
        if (!scheduledTime) {
          return new Response(JSON.stringify({ error: 'Scheduled time is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Schedule an update for later
        await supabase
          .from('schedule_settings')
          .update({
            schedule_update_in_progress: false,
            schedule_update_scheduled_at: scheduledTime,
            schedule_update_scheduled_by: adminUser,
            schedule_update_json: JSON.stringify({
              scheduled_at: scheduledTime,
              scheduled_by: adminUser,
              settings: settings || []
            })
          })
          .eq('setting_key', 'max_bouquets_per_slot');
        
        // Log the schedule action
        await supabase
          .from('schedule_update_logs')
          .insert({
            updated_by: adminUser,
            update_type: 'scheduled',
            update_data: JSON.stringify({
              scheduled_at: scheduledTime,
              settings: settings || []
            }),
            status: 'scheduled'
          });
        
        return new Response(JSON.stringify({
          success: true,
          message: `Schedule update scheduled for ${new Date(scheduledTime).toLocaleString()}`
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('Schedule lock API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};