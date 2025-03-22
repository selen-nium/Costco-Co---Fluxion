// File: /lib/supabase-admin.ts
import { createClient } from '@supabase/supabase-js';

// Check if environment variables are defined
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Log for debugging
if (!supabaseUrl) {
  console.error('NEXT_PUBLIC_SUPABASE_URL is not defined in environment variables');
}

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables');
}

// Create client with null check
export const supabaseAdmin = createClient(
  supabaseUrl || '',
  supabaseServiceKey || ''
);