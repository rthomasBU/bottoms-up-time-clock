import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill in your Supabase project values.',
  );
}

// Single shared Supabase client instance. Only the URL + anon/public key are
// used here - RLS policies (see supabase/migrations/0002_rls_policies.sql)
// are the actual access-control boundary, not key secrecy. The service_role
// key must never be used in this client-side app.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
