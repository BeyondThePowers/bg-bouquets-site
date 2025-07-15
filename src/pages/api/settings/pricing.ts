// src/pages/api/settings/pricing.ts
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

// Helper function to verify admin authentication
async function verifyAdminAuth(request: Request): Promise<boolean> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }

    const password = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Get admin password from settings (same pattern as existing auth)
    const { data: settings, error } = await supabase
      .from('schedule_settings')
      .select('setting_value')
      .eq('setting_key', 'admin_password')
      .single();

    if (error || !settings) {
      return false;
    }

    return settings.setting_value === password;
  } catch (error) {
    console.error('Admin auth error:', error);
    return false;
  }
}

// GET endpoint - Return current price (public access)
export const GET: APIRoute = async () => {
  try {
    const { data: setting, error } = await supabase
      .from('schedule_settings')
      .select('setting_value')
      .eq('setting_key', 'price_per_bouquet')
      .single();

    if (error) {
      console.error('Error fetching price setting:', error);
      // Return fallback price if database error
      return new Response(JSON.stringify({ 
        price_per_bouquet: '35.00',
        fallback: true 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const price = setting?.setting_value || '35.00';
    
    return new Response(JSON.stringify({ 
      price_per_bouquet: price,
      fallback: false 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Pricing API GET error:', error);
    // Return fallback price on any error
    return new Response(JSON.stringify({ 
      price_per_bouquet: '35.00',
      fallback: true 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// POST endpoint - Update price (admin auth required)
export const POST: APIRoute = async ({ request }) => {
  try {
    // Verify admin authentication
    const isAuthorized = await verifyAdminAuth(request);
    if (!isAuthorized) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { price_per_bouquet } = await request.json();

    // Validate price
    const price = parseFloat(price_per_bouquet);
    if (isNaN(price) || price < 1 || price > 200) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Price must be between $1.00 and $200.00' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Ensure max 2 decimal places
    const formattedPrice = price.toFixed(2);

    // Update the setting
    const { error } = await supabase
      .from('schedule_settings')
      .update({ setting_value: formattedPrice })
      .eq('setting_key', 'price_per_bouquet');

    if (error) {
      console.error('Error updating price setting:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to update price setting' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      price_per_bouquet: formattedPrice
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Pricing API POST error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
