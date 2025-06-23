import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({
    message: 'Environment variable debug endpoint',
    environment: {
      // Public variables (should work everywhere)
      hasPublicSupabaseUrl: !!import.meta.env.PUBLIC_SUPABASE_URL,
      hasPublicSupabaseKey: !!import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
      
      // Private variables (server-side only)
      hasServiceRoleKey: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY),
      hasBookingWebhook: !!(process.env.MAKE_BOOKING_WEBHOOK_URL || import.meta.env.MAKE_BOOKING_WEBHOOK_URL),
      hasCancellationWebhook: !!(process.env.MAKE_CANCELLATION_WEBHOOK_URL || import.meta.env.MAKE_CANCELLATION_WEBHOOK_URL),
      hasAdminEmail: !!(process.env.ADMIN_EMAIL || import.meta.env.ADMIN_EMAIL),
      
      // Show actual values (first few characters only for security)
      bookingWebhookPreview: (process.env.MAKE_BOOKING_WEBHOOK_URL || import.meta.env.MAKE_BOOKING_WEBHOOK_URL)?.substring(0, 30) + '...',
      cancellationWebhookPreview: (process.env.MAKE_CANCELLATION_WEBHOOK_URL || import.meta.env.MAKE_CANCELLATION_WEBHOOK_URL)?.substring(0, 30) + '...',
      adminEmailPreview: (process.env.ADMIN_EMAIL || import.meta.env.ADMIN_EMAIL)?.substring(0, 10) + '...',
      
      // Debug info
      nodeEnv: process.env.NODE_ENV || import.meta.env.NODE_ENV || 'development',
      isServer: typeof window === 'undefined',
      processEnvKeys: Object.keys(process.env).filter(key => key.includes('MAKE_') || key.includes('ADMIN_')),
      importMetaEnvKeys: Object.keys(import.meta.env).filter(key => key.includes('MAKE_') || key.includes('ADMIN_'))
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
