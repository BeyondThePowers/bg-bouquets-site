import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async () => {
  const results = {
    timestamp: new Date().toISOString(),
    connection_status: 'unknown',
    tests: {} as Record<string, any>
  };

  try {
    // Test 1: Basic connection
    console.log('Testing Supabase connection...');
    const { data: connectionTest, error: connectionError } = await supabase
      .from('schedule_settings')
      .select('setting_key')
      .limit(1);

    results.tests.basic_connection = {
      success: !connectionError,
      error: connectionError?.message || null,
      data_received: !!connectionTest
    };

    if (connectionError) {
      results.connection_status = 'failed';
      return new Response(JSON.stringify(results, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Test 2: Check required tables exist
    const tables = ['open_days', 'time_slots', 'bookings', 'holidays', 'schedule_settings'];
    const tableTests = {};

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        tableTests[table] = {
          exists: !error,
          has_data: data && data.length > 0,
          error: error?.message || null
        };
      } catch (err) {
        tableTests[table] = {
          exists: false,
          has_data: false,
          error: err.message
        };
      }
    }
    results.tests.tables = tableTests;

    // Test 3: Check schedule settings
    const { data: settings, error: settingsError } = await supabase
      .from('schedule_settings')
      .select('setting_key, setting_value');

    results.tests.schedule_settings = {
      success: !settingsError,
      count: settings?.length || 0,
      settings: settings?.reduce((acc, s) => {
        acc[s.setting_key] = s.setting_value;
        return acc;
      }, {}) || {},
      error: settingsError?.message || null
    };

    // Test 4: Check holidays
    const { data: holidays, error: holidaysError } = await supabase
      .from('holidays')
      .select('count(*)')
      .single();

    results.tests.holidays = {
      success: !holidaysError,
      count: holidays?.count || 0,
      error: holidaysError?.message || null
    };

    // Test 5: Check open days
    const { data: openDays, error: openDaysError } = await supabase
      .from('open_days')
      .select('count(*)')
      .eq('is_open', true)
      .single();

    results.tests.open_days = {
      success: !openDaysError,
      open_days_count: openDays?.count || 0,
      error: openDaysError?.message || null
    };

    // Test 6: Check time slots
    const { data: timeSlots, error: timeSlotsError } = await supabase
      .from('time_slots')
      .select('count(*)')
      .single();

    results.tests.time_slots = {
      success: !timeSlotsError,
      total_slots: timeSlots?.count || 0,
      error: timeSlotsError?.message || null
    };

    // Test 7: Check seasonal operation
    const today = new Date();
    const { data: todaySlots, error: todayError } = await supabase
      .from('time_slots')
      .select('time')
      .eq('date', today.toISOString().split('T')[0]);

    results.tests.seasonal_check = {
      success: !todayError,
      today_available: todaySlots?.length > 0,
      today_slots: todaySlots?.map(s => s.time) || [],
      error: todayError?.message || null
    };

    // Overall status
    const allTestsPassed = Object.values(results.tests).every(test => {
      if (typeof test === 'object' && 'success' in test) {
        return test.success;
      }
      return Object.values(test).every(subTest => subTest.success);
    });

    results.connection_status = allTestsPassed ? 'healthy' : 'issues_detected';

    return new Response(JSON.stringify(results, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Connection test failed:', error);
    results.connection_status = 'failed';
    results.tests.fatal_error = {
      message: error.message,
      stack: error.stack
    };

    return new Response(JSON.stringify(results, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
