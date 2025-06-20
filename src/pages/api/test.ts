import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    environment: {
      hasSupabaseUrl: !!import.meta.env.PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
      nodeEnv: import.meta.env.NODE_ENV || 'development'
    }
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
};
