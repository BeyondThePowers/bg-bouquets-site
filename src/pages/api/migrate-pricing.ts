// src/pages/api/migrate-pricing.ts
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase-admin';

export const POST: APIRoute = async () => {
  try {
    console.log('🔄 Running pricing migration - adding price_per_bouquet setting');
    
    // Insert the pricing setting with default value
    const { error: insertError } = await supabaseAdmin
      .from('schedule_settings')
      .upsert({
        setting_key: 'price_per_bouquet',
        setting_value: '35.00',
        description: 'Price charged per bouquet in CAD'
      }, {
        onConflict: 'setting_key'
      });

    if (insertError) {
      console.error('Error inserting pricing setting:', insertError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to insert pricing setting: ' + insertError.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify the setting was added
    const { data: verifyData, error: verifyError } = await supabaseAdmin
      .from('schedule_settings')
      .select('setting_key, setting_value, description')
      .eq('setting_key', 'price_per_bouquet')
      .single();

    if (verifyError) {
      console.error('Error verifying pricing setting:', verifyError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to verify pricing setting: ' + verifyError.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Pricing migration completed successfully');
    console.log('Added setting:', verifyData);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Pricing migration completed successfully',
      setting: verifyData
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Pricing migration error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Server error during pricing migration: ' + (error as Error).message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async () => {
  try {
    // Check if pricing setting already exists
    const { data: existingData, error: checkError } = await supabaseAdmin
      .from('schedule_settings')
      .select('setting_key, setting_value, description')
      .eq('setting_key', 'price_per_bouquet')
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Error checking pricing setting: ' + checkError.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const exists = !checkError && existingData;

    return new Response(JSON.stringify({ 
      exists,
      setting: existingData,
      message: exists ? 'Pricing setting already exists' : 'Pricing setting needs to be created'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Pricing migration check error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Server error during pricing migration check: ' + (error as Error).message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
