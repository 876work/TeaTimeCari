// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import { debugError, debugLog } from '@/lib/debugLogger';

declare global {
  interface Window {
    __sb?: ReturnType<typeof createClient>;
    __SB_INSTANTIATIONS?: number;
  }
}

export const supabase = (() => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const hasMissingConfig = !url || !anon;

  if (hasMissingConfig && typeof window !== 'undefined') {
    debugError(
      '[supabase] Missing required Vite environment variables: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY. ' +
      'Set these in your frontend environment (for Netlify, add them in Site settings → Environment variables).'
    );
  }

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
    if (!window.__sb) {
      window.__sb = createClient(
        hasMissingConfig ? 'https://invalid.localhost' : url,
        hasMissingConfig ? 'missing-anon-key' : anon,
        options
      );
    }
    return window.__sb;
  }
  // SSR/build-time usage (doesn't run in the browser)
  return createClient(
    hasMissingConfig ? 'https://invalid.localhost' : url,
    hasMissingConfig ? 'missing-anon-key' : anon,
    options
  );
})();
if (typeof window !== 'undefined') {
  window.__SB_INSTANTIATIONS = (window.__SB_INSTANTIATIONS || 0) + 1;
  debugLog('[supabase] instances:', window.__SB_INSTANTIATIONS);
}
