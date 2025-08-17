// No top-level imports at all. This ensures preflight can't crash.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-admin-secret, content-type, apikey, x-client-info",
  "Vary": "Origin",
};

interface ApprovalRequest {
  user_id: string;
  gender: "men" | "women";
  xaccess?: boolean;
}

Deno.serve(async (req) => {
  // Always answer CORS preflight before touching any env/clients
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Load modules that use env/clients only AFTER the preflight guard
  const [{ supabaseAdmin }, { syncUserToDiscourse, buildDiscourseGroups }] =
    await Promise.all([
      import("../_shared/supabaseAdmin.ts"),
      import("../_shared/sso.ts"),
    ]);

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

    // Fetch registration record
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

    // Upsert profile as approved
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

    // Build Discourse SSO payload & sync
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
