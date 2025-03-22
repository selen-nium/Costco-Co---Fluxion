// File: /lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with proper error handling for missing environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check if environment variables are defined
if (!supabaseUrl) {
  console.error('NEXT_PUBLIC_SUPABASE_URL is missing in environment variables');
}

if (!supabaseAnonKey) {
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing in environment variables');
}

// Create the Supabase client with fallbacks to prevent the "supabaseUrl is required" error
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co', 
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);

// Admin client for operations that need service role access (like user management)
// This should only be used in server-side code (API routes)
export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);