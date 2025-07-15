// src/pages/api/migrate-bouquet-terminology.ts
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export const POST: APIRoute = async () => {
  try {
    console.log('🔄 Running bouquet terminology migration');
    
    // Step 1: Check if migration is needed
    const { data: checkData, error: checkError } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'bookings')
      .eq('column_name', 'number_of_visitors');

    if (checkError) {
      console.log('Column check failed, assuming migration needed');
    }

    const migrationNeeded = !checkError && checkData && checkData.length > 0;
    
    if (!migrationNeeded) {
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Migration already completed - bouquet terminology is in use',
        alreadyMigrated: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('Migration needed, proceeding with schema changes...');

    // Step 2: Rename columns in bookings table
    const { error: bookingsError } = await supabaseAdmin.rpc('exec_sql', {
      sql: 'ALTER TABLE bookings RENAME COLUMN number_of_visitors TO number_of_bouquets;'
    });

    if (bookingsError) {
      console.error('Error renaming bookings column:', bookingsError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to rename bookings column: ' + bookingsError.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Step 3: Rename columns in time_slots table
    const { error: timeSlotsError } = await supabaseAdmin.rpc('exec_sql', {
      sql: 'ALTER TABLE time_slots RENAME COLUMN max_capacity TO max_bouquets;'
    });

    if (timeSlotsError) {
      console.error('Error renaming time_slots column:', timeSlotsError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to rename time_slots column: ' + timeSlotsError.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Step 4: Update settings keys
    const { error: settingsError } = await supabaseAdmin
      .from('schedule_settings')
      .update({ setting_key: 'max_bouquets_per_slot' })
      .eq('setting_key', 'max_visitors_per_slot');

    if (settingsError) {
      console.error('Error updating settings key:', settingsError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to update settings key: ' + settingsError.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Step 5: Verify the migration
    const { data: verifyBookings, error: verifyBookingsError } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'bookings')
      .eq('column_name', 'number_of_bouquets');

    const { data: verifyTimeSlots, error: verifyTimeSlotsError } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'time_slots')
      .eq('column_name', 'max_bouquets');

    const { data: verifySettings, error: verifySettingsError } = await supabaseAdmin
      .from('schedule_settings')
      .select('setting_key, setting_value')
      .eq('setting_key', 'max_bouquets_per_slot');

    if (verifyBookingsError || verifyTimeSlotsError || verifySettingsError) {
      console.error('Verification errors:', { verifyBookingsError, verifyTimeSlotsError, verifySettingsError });
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Migration completed but verification failed' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const bookingsColumnExists = verifyBookings && verifyBookings.length > 0;
    const timeSlotsColumnExists = verifyTimeSlots && verifyTimeSlots.length > 0;
    const settingsKeyExists = verifySettings && verifySettings.length > 0;

    console.log('✅ Bouquet terminology migration completed successfully');
    console.log('Verification results:', {
      bookingsColumnExists,
      timeSlotsColumnExists,
      settingsKeyExists
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Bouquet terminology migration completed successfully',
      verification: {
        bookingsColumnExists,
        timeSlotsColumnExists,
        settingsKeyExists
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Bouquet terminology migration error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Server error during bouquet terminology migration: ' + (error as Error).message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async () => {
  try {
    // Check current schema state
    const { data: bookingsColumns, error: bookingsError } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'bookings')
      .in('column_name', ['number_of_visitors', 'number_of_bouquets']);

    const { data: timeSlotsColumns, error: timeSlotsError } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'time_slots')
      .in('column_name', ['max_capacity', 'max_bouquets']);

    const { data: settingsKeys, error: settingsError } = await supabaseAdmin
      .from('schedule_settings')
      .select('setting_key')
      .in('setting_key', ['max_visitors_per_slot', 'max_bouquets_per_slot']);

    if (bookingsError || timeSlotsError || settingsError) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Error checking schema state' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const hasVisitorTerminology = (
      bookingsColumns?.some(col => col.column_name === 'number_of_visitors') ||
      timeSlotsColumns?.some(col => col.column_name === 'max_capacity') ||
      settingsKeys?.some(key => key.setting_key === 'max_visitors_per_slot')
    );

    const hasBouquetTerminology = (
      bookingsColumns?.some(col => col.column_name === 'number_of_bouquets') ||
      timeSlotsColumns?.some(col => col.column_name === 'max_bouquets') ||
      settingsKeys?.some(key => key.setting_key === 'max_bouquets_per_slot')
    );

    return new Response(JSON.stringify({ 
      hasVisitorTerminology,
      hasBouquetTerminology,
      migrationNeeded: hasVisitorTerminology && !hasBouquetTerminology,
      currentState: {
        bookingsColumns: bookingsColumns?.map(col => col.column_name) || [],
        timeSlotsColumns: timeSlotsColumns?.map(col => col.column_name) || [],
        settingsKeys: settingsKeys?.map(key => key.setting_key) || []
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Schema check error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Server error during schema check: ' + (error as Error).message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
