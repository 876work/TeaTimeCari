// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = (() => {
  const url  = import.meta.env.VITE_SUPABASE_URL!;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY!;
  // Singleton across reloads/HMR
  if (typeof window !== 'undefined') {
    // @ts-ignore
    if (!window.__sb) window.__sb = createClient(url, anon);
    // @ts-ignore
    return window.__sb;
  }
  return createClient(url, anon);
})();

if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__SB_INSTANTIATIONS = (window.__SB_INSTANTIATIONS || 0) + 1;
  // @ts-ignore
  console.log('[supabase] instances:', window.__SB_INSTANTIATIONS);
}