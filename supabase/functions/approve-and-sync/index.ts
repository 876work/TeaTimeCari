import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { syncUserToDiscourse, buildDiscourseGroups } from "../_shared/sso.ts";

interface ApprovalRequest {
  user_id: string;            // registration.id (NOT auth id)
  gender: "men" | "women";
  xaccess?: boolean;
}

function mustEnv(k: string): string {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`missing env: ${k}`);
  return v;
}

// Ensure an auth.users record exists for the email.
// Returns the auth user id (existing or newly created).
async function ensureAuthUserIdForEmail(email: string): Promise<string> {
  const SUPABASE_URL = mustEnv("SUPABASE_URL");
  const SRK = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

  // 1) Try to find by email via Admin REST
  const lookup = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } }
  );
  const lookupJson = await lookup.json().catch(() => ({} as any));
  const existing = lookupJson?.users?.find((u: any) =>
    (u?.email || "").toLowerCase() === email.toLowerCase()
  );
  if (existing?.id) return existing.id as string;

  // 2) Create if not found (email already verified; your app controls access via KYC)
  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, email_confirm: true }),
  });
  const createJson = await createRes.json().catch(() => ({} as any));
  if (!createRes.ok || !createJson?.id) {
    throw new Error(
      `admin create user failed: ${createJson?.msg || createRes.status}`
    );
  }
  return createJson.id as string;
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    let body: ApprovalRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user_id: registrationId, gender, xaccess = false } = body;

    if (!registrationId || !gender) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_id, gender" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!["men", "women"].includes(gender)) {
      return new Response(
        JSON.stringify({ error: "Invalid gender value. Must be 'men' or 'women'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load the pending registration (source of truth before approval)
    const { data: reg, error: regErr } = await supabaseAdmin
      .from("registrations")
      .select("id, email, username, firstName, lastName")
      .eq("id", registrationId)
      .single();

    if (regErr || !reg) {
      return new Response(
        JSON.stringify({ error: "Registration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get or create auth user for this email
    const authUserId = await ensureAuthUserIdForEmail(reg.email);

    // Upsert the approved profile using the AUTH USER ID as PK (FK to auth.users)
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: authUserId,
          email: reg.email,
          username: reg.username,
          full_name: `${reg.firstName ?? ""} ${reg.lastName ?? ""}`.trim(),
          kyc_status: "approved",
          approved_at: new Date().toISOString(),
          // add these columns to profiles if you want them stored; otherwise remove:
          // gender,
          // xaccess,
        },
        { onConflict: "id" }
      );

    if (upErr) {
      return new Response(
        JSON.stringify({ error: `Failed to update profile: ${upErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build Discourse groups and payload; use authUserId as external_id
    const groups = buildDiscourseGroups(gender, xaccess);
    const payload: Record<string, string> = {
      external_id: authUserId,
      email: reg.email,
      username: reg.username,
      name: `${reg.firstName ?? ""} ${reg.lastName ?? ""}`.trim(),
      add_groups: groups,
    };
    if ((Deno.env.get("SEND_DISCOURSE_ACTIVATION") || "").toLowerCase() === "true") {
      payload.require_activation = "true";
    }

    // Try syncing to Discourse; if it fails, still report approval success
    try {
      await syncUserToDiscourse(payload);
    } catch (e: any) {
      console.error("Discourse sync failed:", e);
      return new Response(
        JSON.stringify({
          status: "approved_with_sync_error",
          error: `User approved but Discourse sync failed: ${e?.message || e}`,
          profile_updated: true,
          discourse_synced: false,
          external_id: authUserId,
          groups,
        }),
        { status: 207, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // All good
    return new Response(
      JSON.stringify({
        status: "synced",
        profile_updated: true,
        discourse_synced: true,
        external_id: authUserId,
        groups,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[approve-and-sync] Error:", err?.message || err);
    return new Response(
      JSON.stringify({
        status: "failed",
        error: `Approval and sync failed: ${err?.message || err}`,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
