// src/pages/api/settings/pricing.ts
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

// GET endpoint - Return current prices (public access)
export const GET: APIRoute = async () => {
  try {
    // Fetch pricing and limit settings
    const { data: settings, error } = await supabase
      .from('schedule_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['price_per_bouquet', 'price_per_visitor_pass', 'max_visitor_passes_per_booking']);

    if (error) {
      console.error('Error fetching pricing settings:', error);
      // Return fallback prices if database error
      return new Response(JSON.stringify({
        price_per_bouquet: '35.00',
        price_per_visitor_pass: '5.00',
        max_visitor_passes_per_booking: '20',
        fallback: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Convert array to object for easier access
    const priceSettings: Record<string, string> = {};
    settings?.forEach(setting => {
      priceSettings[setting.setting_key] = setting.setting_value;
    });

    const bouquetPrice = priceSettings['price_per_bouquet'] || '35.00';
    const visitorPassPrice = priceSettings['price_per_visitor_pass'] || '5.00';
    const maxVisitorPasses = priceSettings['max_visitor_passes_per_booking'] || '20';

    return new Response(JSON.stringify({
      price_per_bouquet: bouquetPrice,
      price_per_visitor_pass: visitorPassPrice,
      max_visitor_passes_per_booking: maxVisitorPasses,
      fallback: false
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Pricing API GET error:', error);
    // Return fallback prices on any error
    return new Response(JSON.stringify({
      price_per_bouquet: '35.00',
      price_per_visitor_pass: '5.00',
      max_visitor_passes_per_booking: '20',
      fallback: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// POST endpoint - Update prices (no auth required - same pattern as /api/admin/settings)
export const POST: APIRoute = async ({ request }) => {
  try {

    const { price_per_bouquet, price_per_visitor_pass, max_visitor_passes_per_booking } = await request.json();

    // Validate bouquet price
    if (price_per_bouquet !== undefined) {
      const bouquetPrice = parseFloat(price_per_bouquet);
      if (isNaN(bouquetPrice) || bouquetPrice < 1 || bouquetPrice > 200) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Bouquet price must be between $1.00 and $200.00'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Validate visitor pass price
    if (price_per_visitor_pass !== undefined) {
      const visitorPrice = parseFloat(price_per_visitor_pass);
      if (isNaN(visitorPrice) || visitorPrice < 0 || visitorPrice > 100) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Visitor pass price must be between $0.00 and $100.00'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Validate visitor pass limit
    if (max_visitor_passes_per_booking !== undefined) {
      const maxLimit = parseInt(max_visitor_passes_per_booking);
      if (isNaN(maxLimit) || maxLimit < 0 || maxLimit > 50) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Visitor pass limit must be between 0 and 50'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const updates: Array<{ setting_key: string; setting_value: string }> = [];
    const response: Record<string, string> = {};

    // Prepare bouquet price update
    if (price_per_bouquet !== undefined) {
      const formattedBouquetPrice = parseFloat(price_per_bouquet).toFixed(2);
      updates.push({
        setting_key: 'price_per_bouquet',
        setting_value: formattedBouquetPrice
      });
      response.price_per_bouquet = formattedBouquetPrice;
    }

    // Prepare visitor pass price update
    if (price_per_visitor_pass !== undefined) {
      const formattedVisitorPrice = parseFloat(price_per_visitor_pass).toFixed(2);
      updates.push({
        setting_key: 'price_per_visitor_pass',
        setting_value: formattedVisitorPrice
      });
      response.price_per_visitor_pass = formattedVisitorPrice;
    }

    // Prepare visitor pass limit update
    if (max_visitor_passes_per_booking !== undefined) {
      const formattedLimit = parseInt(max_visitor_passes_per_booking).toString();
      updates.push({
        setting_key: 'max_visitor_passes_per_booking',
        setting_value: formattedLimit
      });
      response.max_visitor_passes_per_booking = formattedLimit;
    }

    // Perform updates using supabaseAdmin and upsert (same pattern as /api/admin/settings)
    for (const update of updates) {
      console.log(`Updating ${update.setting_key} with value:`, update.setting_value);

      const { error } = await supabaseAdmin
        .from('schedule_settings')
        .upsert({
          setting_key: update.setting_key,
          setting_value: update.setting_value,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      if (error) {
        console.error(`Error updating ${update.setting_key}:`, error);
        console.error('Full error details:', JSON.stringify(error, null, 2));
        return new Response(JSON.stringify({
          success: false,
          error: `Failed to update ${update.setting_key.replace('price_per_', '').replace('max_', '').replace('_per_booking', '')}`
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      console.log(`Successfully updated ${update.setting_key}`);
    }

    return new Response(JSON.stringify({
      success: true,
      ...response
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
