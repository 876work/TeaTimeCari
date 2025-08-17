import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Normalize base URL by trimming any trailing slash
const baseUrl = supabaseUrl.replace(/\/$/, '');

// Compute correct Functions URL.
// - Hosted projects use the `functions` subdomain
// - Local CLI or custom domains use the proxy path
const functionsUrl = baseUrl.includes('.supabase.co')
  ? baseUrl.replace('.supabase.co', '.functions.supabase.co')
  : `${baseUrl}/functions/v1`;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  functions: {
    url: functionsUrl,
  },
});
