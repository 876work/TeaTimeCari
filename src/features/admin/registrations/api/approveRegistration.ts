// src/features/admin/registrations/api/approveRegistration.ts
import { supabase } from '@/lib/supabaseClient';

export async function approveRegistration(registrationId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not logged in");

  const { data, error } = await supabase.functions.invoke("approve-and-sync", {
    body: { registration_id: registrationId },
    headers: { Authorization: `Bearer ${session.access_token}` }
  });

  if (error) {
    const ctx: any = (error as any).context;
    const res = ctx?.response ?? {};
    // Try every known place Supabase puts the error text
    const b = res.body ?? res.data ?? res.error ?? res._data;
    const h = res.headers ?? {};
    const headerMsg = h["x-error-message"] || h["X-Error-Message"];
    const status = res.status;
    const reason =
      (typeof b === "string" && b) ||
      (b?.error) ||
      headerMsg ||
      error.message;

    console.error("Edge function error:", { status, body: b, headers: h });
    throw new Error(reason || `Edge Function failed (status ${status ?? "?"})`);
  }

  return data;
}
