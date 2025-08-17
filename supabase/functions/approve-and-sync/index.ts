// import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { syncUserToDiscourse, buildDiscourseGroups } from "../_shared/sso.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-admin-secret, apikey, x-client-info, content-type",
  "Access-Control-Max-Age": "86400",
};

interface ApprovalRequest {
  user_id: string;
  gender: 'men' | 'women';
  xaccess?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Only handle POST requests
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    // Parse request body
    let requestData: ApprovalRequest;
    try {
      requestData = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user_id, gender, xaccess = false } = requestData;

    // Validate required fields
    if (!user_id || !gender) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_id, gender" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate gender value
    if (!['men', 'women'].includes(gender)) {
      return new Response(
        JSON.stringify({ error: "Invalid gender value. Must be 'men' or 'women'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TODO: Add admin authentication check here
    // For now, we'll proceed without auth check but this should be added in production
    
    // Fetch user from registrations table to get basic info
    const { data: registration, error: regError } = await supabaseAdmin
      .from('registrations')
      .select('id, email, username, firstName, lastName')
      .eq('id', user_id)
      .single();

    if (regError || !registration) {
      return new Response(
        JSON.stringify({ error: "Registration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert profile with approval data
    const profileData = {
      id: user_id,
      email: registration.email,
      username: registration.username,
      full_name: `${registration.firstName} ${registration.lastName}`,
      kyc_status: 'approved',
      gender: gender,
      xaccess: xaccess,
      approved_at: new Date().toISOString()
    };

    const { error: upsertError } = await supabaseAdmin
      .from('profiles')
      .upsert(profileData, {
        onConflict: 'id'
      });

    if (upsertError) {
      console.error("Error upserting profile:", upsertError);
      return new Response(
        JSON.stringify({ error: `Failed to update profile: ${upsertError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build Discourse SSO payload
    const groups = buildDiscourseGroups(gender, xaccess);
    
    const discoursePayload: Record<string, string> = {
      external_id: user_id,
      email: registration.email,
      username: registration.username,
      name: `${registration.firstName} ${registration.lastName}`,
      add_groups: groups
    };

    // Add activation requirement if configured
    const sendActivation = Deno.env.get("SEND_DISCOURSE_ACTIVATION");
    if (sendActivation === "true") {
      discoursePayload.require_activation = "true";
    }

    // Sync to Discourse
    try {
      await syncUserToDiscourse(discoursePayload);
    } catch (discourseError) {
      console.error("Discourse sync failed:", discourseError);
      
      // Don't fail the entire operation if Discourse sync fails
      // The profile is still approved in our system
      return new Response(
        JSON.stringify({ 
          status: "approved_with_sync_error",
          error: `User approved but Discourse sync failed: ${discourseError.message}`,
          profile_updated: true,
          discourse_synced: false
        }),
        { status: 207, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Success response
    return new Response(
      JSON.stringify({ 
        status: "synced",
        profile_updated: true,
        discourse_synced: true,
        groups: groups
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[approve-and-sync] Error:", err?.message || err);
    return new Response(
      JSON.stringify({ 
        error: `Approval and sync failed: ${err?.message || err}`,
        status: "failed"
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});