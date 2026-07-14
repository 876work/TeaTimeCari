import { supabaseAdmin } from "./supabaseAdmin.ts";

/**
 * Kill-switch lookup. Fails open: if the feature_flags table is missing or
 * unreachable, features stay enabled so a migration gap can't take the
 * platform down.
 */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from("feature_flags")
      .select("enabled")
      .eq("key", key)
      .maybeSingle();

    if (error || !data) return true;

    return data.enabled !== false;
  } catch {
    return true;
  }
}
