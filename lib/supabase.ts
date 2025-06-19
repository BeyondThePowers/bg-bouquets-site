// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY');

  if (import.meta.env.DEV) {
    console.error('\n📝 To fix this:');
    console.error('1. Copy .env.example to .env');
    console.error('2. Fill in your actual Supabase credentials');
    console.error('3. Restart your development server');
  } else {
    console.error('Please set these in your Netlify dashboard environment variables');
  }
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
