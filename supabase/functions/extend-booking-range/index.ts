// Supabase Edge Function to automatically extend booking range
// This function runs daily to check if booking range needs extension

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('🔄 Starting automatic booking range extension check...')
    
    // Get current booking range status
    const { data: statusData, error: statusError } = await supabase
      .rpc('get_booking_range_status')
    
    if (statusError) {
      console.error('❌ Error getting booking range status:', statusError)
      throw statusError
    }
    
    console.log('📊 Current booking range status:', statusData)
    
    // Check if extension is needed and perform it
    const { data: extensionData, error: extensionError } = await supabase
      .rpc('extend_booking_range_if_needed')
    
    if (extensionError) {
      console.error('❌ Error extending booking range:', extensionError)
      throw extensionError
    }
    
    console.log('✅ Extension check result:', extensionData)
    
    // Prepare response
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      timezone: 'America/Edmonton',
      status: statusData,
      extension: extensionData,
      message: extensionData.extended 
        ? `✅ Booking range extended! Generated ${extensionData.generated_days} open days and ${extensionData.generated_slots} time slots.`
        : `ℹ️ No extension needed. ${extensionData.days_remaining} days remaining (threshold: ${extensionData.threshold} days).`
    }
    
    // Log the final result
    console.log('🎯 Final result:', response.message)
    
    return new Response(
      JSON.stringify(response),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('💥 Edge function error:', error)
    
    const errorResponse = {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      timezone: 'America/Edmonton'
    }
    
    return new Response(
      JSON.stringify(errorResponse),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})

/* 
Usage:
- This function should be called daily via cron job
- It automatically checks if booking range needs extension
- Only extends if less than 365 days remaining
- Extends to maintain 400 days of future bookings
- Respects seasonal settings and holidays
- Returns detailed status and extension information

Example cron setup (using external service like cron-job.org):
- URL: https://your-project.supabase.co/functions/v1/extend-booking-range
- Schedule: Daily at 2:00 AM Mountain Time (08:00 UTC in winter, 09:00 UTC in summer)
- Method: POST
- Headers: Authorization: Bearer YOUR_ANON_KEY
*/
