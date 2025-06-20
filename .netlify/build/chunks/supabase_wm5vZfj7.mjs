import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://jgoucxlacofztynmgbeb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impnb3VjeGxhY29menR5bm1nYmViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxOTE2NjcsImV4cCI6MjA2NTc2NzY2N30.dMfIzNZaYi5EdFUFIh3-jDUdX5wkbkKo5v63yLlu9-Y";
const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

export { supabase as s };
