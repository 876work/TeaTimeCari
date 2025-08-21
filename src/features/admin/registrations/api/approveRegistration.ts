// src/features/admin/registrations/api/approveRegistration.ts
import { supabase } from "@/lib/supabaseClient";

export async function approveRegistration(registrationId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not logged in");

  const { data, error } = await supabase.functions.invoke("approve-and-sync", {
    body: { registration_id: registrationId },
    headers: { Authorization: `Bearer ${session.access_token}` }
  });

  if (error) {
    // Supabase wraps the response; pull our JSON error out
    const ctx = (error as any).context;
    const body = ctx?.response?.body;
    const reason =
      (typeof body === "string" && body) ||
      (body && body.error) ||
      error.message;

    console.error("Edge function error:", { status: ctx?.response?.status, body });
    throw new Error(reason || "Edge Function failed");
  }

  return data;
}
