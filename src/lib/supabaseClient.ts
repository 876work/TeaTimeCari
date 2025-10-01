// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = (() => {
  const url  = import.meta.env.VITE_SUPABASE_URL!;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY!;

  const options = {
    auth: {
      // unique so any accidental second client (default key) won't collide
      storageKey: 'ttc-auth',
      persistSession: true,
      autoRefreshToken: true,
      flowType: 'pkce',
    },
  };

  // Singleton across reloads/HMR
  if (typeof window !== 'undefined') {
    // @ts-ignore
   if (!window.__sb) window.__sb = createClient(url, anon, options);
    // @ts-ignore
    return window.__sb;
  }
  // SSR/build-time usage (doesn't run in the browser)
  return createClient(url, anon, options);
})();
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__SB_INSTANTIATIONS = (window.__SB_INSTANTIATIONS || 0) + 1;
  // @ts-ignore
  console.log('[supabase] instances:', window.__SB_INSTANTIATIONS);
}