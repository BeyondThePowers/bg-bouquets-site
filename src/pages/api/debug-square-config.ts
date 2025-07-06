// src/pages/api/debug-square-config.ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  try {
    const config = {
      hasWebhookKey: !!(process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || import.meta.env.SQUARE_WEBHOOK_SIGNATURE_KEY),
      hasServiceRoleKey: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY),
      hasPublicUrl: !!(process.env.PUBLIC_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL),
      webhookKeyLength: (process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || import.meta.env.SQUARE_WEBHOOK_SIGNATURE_KEY)?.length || 0,
      webhookKeyPrefix: (process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || import.meta.env.SQUARE_WEBHOOK_SIGNATURE_KEY)?.substring(0, 8) + '...' || 'Not set',
      environment: process.env.NODE_ENV || 'development',
      isProduction: process.env.NODE_ENV === 'production' || import.meta.env.PROD
    };
    
    return new Response(JSON.stringify(config, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
