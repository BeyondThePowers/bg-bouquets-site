import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

export const POST: APIRoute = async () => {
  try {
    // Find the latest holiday year in the database
    const { data: latestHoliday, error: queryError } = await supabaseAdmin
      .from('holidays')
      .select('date')
      .eq('is_auto_generated', true)
      .order('date', { ascending: false })
      .limit(1);

    if (queryError) {
      console.error('Error querying latest holiday:', queryError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to query existing holidays'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calculate the year range
    const currentYear = new Date().getFullYear();
    let startYear = currentYear;

    if (latestHoliday && latestHoliday.length > 0) {
      const latestYear = new Date(latestHoliday[0].date).getFullYear();
      // Start from the year after the latest existing holiday, or current year if later
      startYear = Math.max(latestYear + 1, currentYear);
    }

    const endYear = startYear + 2; // Generate 3 years: startYear, startYear+1, startYear+2

    console.log(`Latest existing holiday year: ${latestHoliday?.[0] ? new Date(latestHoliday[0].date).getFullYear() : 'none'}`);
    console.log(`Generating holidays from ${startYear} to ${endYear}`);

    // Check if we actually need to generate any new years
    if (startYear > endYear) {
      return new Response(JSON.stringify({
        success: true,
        years_generated: 0,
        message: 'No new holidays needed - coverage already extends beyond current requirements'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Call the database function to generate holidays
    const { error } = await supabaseAdmin.rpc('generate_canadian_holidays', {
      start_year: startYear,
      end_year: endYear
    });

    if (error) {
      console.error('Error generating holidays:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to generate holidays: ' + error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Refresh the schedule to account for new holidays
    const { error: refreshError } = await supabaseAdmin.rpc('refresh_future_schedule');
    if (refreshError) {
      console.warn('Warning: Could not refresh schedule:', refreshError);
    }

    const yearsGenerated = endYear - startYear + 1;

    return new Response(JSON.stringify({
      success: true,
      years_generated: yearsGenerated,
      start_year: startYear,
      end_year: endYear,
      message: yearsGenerated > 0 ?
        `Generated holidays for ${startYear}-${endYear}` :
        'No new holidays needed - coverage already extends beyond current requirements'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Generate holidays error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Server error while generating holidays' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
