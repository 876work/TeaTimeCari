import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Guardrails: warn fast if misconfigured
if (!supabaseUrl?.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
  console.warn('[Supabase] VITE_SUPABASE_URL looks wrong:', supabaseUrl);
}

const baseUrl = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  functions: {
    // Always use the proxy path under the primary domain (no cross-domain CORS headaches)
    url: `${baseUrl}/functions/v1`,
  },
});
