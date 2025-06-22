// lib/supabase-admin.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase admin environment variables');
  console.error('Required: PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');

  if (import.meta.env.DEV) {
    console.error('\n📝 To fix this:');
    console.error('1. Add SUPABASE_SERVICE_ROLE_KEY to your .env file');
    console.error('2. Get the service role key from your Supabase dashboard');
    console.error('3. Restart your development server');
  } else {
    console.error('Please set SUPABASE_SERVICE_ROLE_KEY in your Netlify dashboard environment variables');
  }
}

// Create admin client with service role key (bypasses RLS)
export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
