import { corsHeaders } from "../_shared/cors.ts";
// ^ keep this one at top; it should be a plain object and safe to import

interface ApprovalRequest {
  user_id: string;
  gender: "men" | "women";
  xaccess?: boolean;
}

Deno.serve(async (req) => {
  // Always answer CORS preflight without touching any env-dependent code
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ⬇️ Move env/secret-using imports *after* preflight
  const { supabaseAdmin } = await import("../_shared/supabaseAdmin.ts");
  const { syncUserToDiscourse, buildDiscourseGroups } = await import("../_shared/sso.ts");

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    // Parse JSON body
    let requestData: ApprovalRequest;
    try {
      requestData = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user_id, gender, xaccess = false } = requestData;

    // Validate input
    if (!user_id || !gender) {
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

    // --- (Optional auth gate was here) ---
    // // const adminSecret = Deno.env.get("ADMIN_APPROVE_SECRET");
    // // if (adminSecret) {
    // //   const incoming = req.headers.get("x-admin-secret");
    // //   if (incoming !== adminSecret) {
    // //     return new Response(JSON.stringify({ error: "unauthorized" }), {
    // //       status: 401,
    // //       headers: { ...corsHeaders, "Content-Type": "application/json" },
    // //     });
    // //   }
    // // }

    // Pull basic user info from registrations
    const { data: registration, error: regError } = await supabaseAdmin
      .from("registrations")
      .select("id, email, username, firstName, lastName")
      .eq("id", user_id)
      .single();

    if (regError || !registration) {
      return new Response(
        JSON.stringify({ error: "Registration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert the profile with approval fields
    const profileData = {
      id: user_id,
      email: registration.email,
      username: registration.username,
      full_name: `${registration.firstName} ${registration.lastName}`,
      kyc_status: "approved",
      gender,
      xaccess,
      approved_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabaseAdmin
      .from("profiles")
      .upsert(profileData, { onConflict: "id" });

    if (upsertError) {
      console.error("Error upserting profile:", upsertError);
      return new Response(
        JSON.stringify({ error: `Failed to update profile: ${upsertError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build & send Discourse SSO sync
    const groups = buildDiscourseGroups(gender, xaccess);

    const payload: Record<string, string> = {
      external_id: user_id,
      email: registration.email,
      username: registration.username,
      name: `${registration.firstName} ${registration.lastName}`,
      add_groups: groups,
    };
    if ((Deno.env.get("SEND_DISCOURSE_ACTIVATION") || "").toLowerCase() === "true") {
      payload.require_activation = "true";
    }

    try {
      await syncUserToDiscourse(payload);
    } catch (discourseError: any) {
      console.error("Discourse sync failed:", discourseError);
      return new Response(
        JSON.stringify({
          status: "approved_with_sync_error",
          error: `User approved but Discourse sync failed: ${discourseError?.message || discourseError}`,
          profile_updated: true,
          discourse_synced: false,
        }),
        { status: 207, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Success
    return new Response(
      JSON.stringify({
        status: "synced",
        profile_updated: true,
        discourse_synced: true,
        groups,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[approve-and-sync] Error:", err?.message || err);
    return new Response(
      JSON.stringify({
        error: `Approval and sync failed: ${err?.message || err}`,
        status: "failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
