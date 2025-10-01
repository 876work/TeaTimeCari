// src/lib/supabaseClient.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  // eslint-disable-next-line no-var
  var __supabase_singleton__: SupabaseClient | undefined;
}

export const supabase =
  globalThis.__supabase_singleton__ ??
  createClient(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_ANON_KEY!
  );

globalThis.__supabase_singleton__ = supabase;

