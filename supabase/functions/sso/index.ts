import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { parseAndVerifyIncoming, signSsoPayload, buildDiscourseGroups } from "../_shared/sso.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Only handle GET requests for SSO
    if (req.method !== "GET") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const sso = url.searchParams.get("sso");
    const sig = url.searchParams.get("sig");

    if (!sso || !sig) {
      return new Response("Missing SSO parameters", { status: 400, headers: corsHeaders });
    }

    // Get environment variables
    const discourseSsoSecret = Deno.env.get("DISCOURSE_SSO_SECRET");
    const siteBaseUrl = Deno.env.get("SITE_BASE_URL");

    if (!discourseSsoSecret || !siteBaseUrl) {
      console.error("Missing required environment variables");
      return new Response("Server configuration error", { status: 500, headers: corsHeaders });
    }

    // Parse and verify incoming SSO request
    let incomingParams: URLSearchParams;
    try {
      incomingParams = await parseAndVerifyIncoming(sso, sig, discourseSsoSecret);
    } catch (err) {
      console.error("SSO verification failed:", err);
      return new Response("Invalid SSO request", { status: 403, headers: corsHeaders });
    }

    const nonce = incomingParams.get("nonce");
    const returnSsoUrl = incomingParams.get("return_sso_url");

    if (!nonce || !returnSsoUrl) {
      return new Response("Missing required SSO parameters", { status: 400, headers: corsHeaders });
    }

    // Get current user from Supabase Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      // Redirect to login with return URL
      const loginUrl = `${siteBaseUrl}/login?next=${encodeURIComponent('/sso-return')}`;
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": loginUrl
        }
      });
    }

    // Verify user session
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      // Redirect to login
      const loginUrl = `${siteBaseUrl}/login?next=${encodeURIComponent('/sso-return')}`;
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": loginUrl
        }
      });
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile not found for user:", user.id);
      const pendingUrl = `${siteBaseUrl}/kyc-pending`;
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": pendingUrl
        }
      });
    }

    // Check KYC approval status
    if (profile.kyc_status !== 'approved') {
      const pendingUrl = `${siteBaseUrl}/kyc-pending`;
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": pendingUrl
        }
      });
    }

    // Build Discourse groups
    const groups = buildDiscourseGroups(profile.gender, profile.xaccess || false);

    // Build SSO response payload
    const responsePayload: Record<string, string> = {
      nonce: nonce,
      external_id: profile.id,
      email: profile.email,
      username: profile.username,
      name: profile.full_name || profile.username,
      add_groups: groups
    };

    // Optional: Add custom user field for gender
    // responsePayload['custom.user_field_1'] = profile.gender;

    // Sign the response
    const { b64, sig: responseSig } = await signSsoPayload(responsePayload, discourseSsoSecret);

    // Redirect back to Discourse
    const redirectUrl = `${returnSsoUrl}?sso=${encodeURIComponent(b64)}&sig=${responseSig}`;
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        "Location": redirectUrl
      }
    });

  } catch (err: any) {
    console.error("[sso] Error:", err?.message || err);
    return new Response(
      JSON.stringify({ error: "SSO processing failed" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});