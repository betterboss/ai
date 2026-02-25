import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client (uses service key for full access)
let serverClient = null;

export function getServerClient() {
  if (serverClient) return serverClient;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
  }

  serverClient = createClient(url, key);
  return serverClient;
}

// Browser-side Supabase client (uses anon key, respects RLS)
let browserClient = null;

export function getBrowserClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  browserClient = createClient(url, key);
  return browserClient;
}
