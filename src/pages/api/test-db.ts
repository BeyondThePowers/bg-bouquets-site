// Test database connection and basic queries
import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const GET: APIRoute = async () => {
  try {
    console.log('Testing database connection...');

    // Test 1: Basic connection
    const { data: testData, error: testError } = await supabase
      .from('open_days')
      .select('*')
      .limit(1);

    console.log('Basic connection test:', { testData, testError });

    // Test 2: Check table structures
    const tests = [];

    // Test open_days
    const { data: openDays, error: openError } = await supabase
      .from('open_days')
      .select('*')
      .limit(5);
    
    tests.push({
      table: 'open_days',
      success: !openError,
      error: openError?.message,
      count: openDays?.length || 0,
      sample: openDays?.[0]
    });

    // Test time_slots
    const { data: timeSlots, error: slotsError } = await supabase
      .from('time_slots')
      .select('*')
      .limit(5);
    
    tests.push({
      table: 'time_slots',
      success: !slotsError,
      error: slotsError?.message,
      count: timeSlots?.length || 0,
      sample: timeSlots?.[0]
    });

    // Test bookings
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('*')
      .limit(5);
    
    tests.push({
      table: 'bookings',
      success: !bookingsError,
      error: bookingsError?.message,
      count: bookings?.length || 0,
      sample: bookings?.[0]
    });

    // Test availability query
    const { data: availability, error: availError } = await supabase
      .from('open_days')
      .select('date')
      .eq('is_open', true)
      .order('date', { ascending: true })
      .limit(3);

    tests.push({
      table: 'availability_query',
      success: !availError,
      error: availError?.message,
      count: availability?.length || 0,
      sample: availability?.[0]
    });

    const result = {
      status: 'Database connection test completed',
      timestamp: new Date().toISOString(),
      tests,
      supabaseUrl: process.env.PUBLIC_SUPABASE_URL ? 'Set' : 'Missing',
      supabaseKey: process.env.PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing'
    };

    console.log('Database test results:', result);

    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Database test error:', error);
    return new Response(JSON.stringify({ 
      error: 'Database test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
