import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { parseAndVerifyIncoming, signSsoPayload, buildDiscourseGroups, hmacHex } from "../_shared/sso.ts";

// Generate a random nonce for app-initiated SSO
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

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

    // Get environment variables
    const discourseSsoSecret = Deno.env.get("DISCOURSE_SSO_SECRET");
    const siteBaseUrl = Deno.env.get("SITE_BASE_URL") || "https://teatimecari.app";
    const discourseBaseUrl = Deno.env.get("DISCOURSE_BASE_URL") || "https://community.teatimecari.app";

    if (!discourseSsoSecret) {
      console.error("Missing required environment variables");
      return new Response("Server configuration error", { status: 500, headers: corsHeaders });
    }

    // Check if this is an app-initiated SSO (no sso/sig params) or Discourse-initiated SSO
    if (!sso || !sig) {
      // App-initiated SSO: User logged into our app and we want to log them into Discourse
      console.log("App-initiated SSO request");
      
      // Check for token in query params (from login redirect)
      const tokenFromQuery = url.searchParams.get("token");
      
      // Get current user from Supabase Auth
      let authHeader = req.headers.get("Authorization");
      
      // If no auth header but we have a token in query params, use that
      if (!authHeader && tokenFromQuery) {
        authHeader = `Bearer ${tokenFromQuery}`;
      }
      
      if (!authHeader) {
        // Redirect to login with return URL
        const loginUrl = `${siteBaseUrl}/?redirect=discourse`;
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
        const loginUrl = `${siteBaseUrl}/?redirect=discourse`;
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
        .from('registrations')
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
      if (profile.status !== 'approved') {
        const pendingUrl = `${siteBaseUrl}/kyc-pending`;
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders,
            "Location": pendingUrl
          }
        });
      }

      // Generate a nonce for this SSO session
      const nonce = generateNonce();
      
      // Build Discourse groups based on user's gender and xaccess
      const groups = buildDiscourseGroups(
        profile.gender === 'Male' ? 'men' : 'women', 
        false // xaccess - you can modify this based on your business logic
      );

      // Build SSO response payload for app-initiated SSO
      const responsePayload: Record<string, string> = {
        nonce: nonce,
        external_id: profile.id,
        email: profile.email,
        username: profile.username,
        name: profile.fullName || profile.firstName + ' ' + profile.lastName || profile.username,
        add_groups: groups
      };

      // Sign the response
      const { b64, sig: responseSig } = await signSsoPayload(responsePayload, discourseSsoSecret);

      // Redirect to Discourse SSO login endpoint
      const discourseLoginUrl = `${discourseBaseUrl.replace(/\/+$/, '')}/session/sso_login?sso=${encodeURIComponent(b64)}&sig=${responseSig}`;
      
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": discourseLoginUrl
        }
      });
    } else {
      // Discourse-initiated SSO: Handle the traditional SSO flow from Discourse
      console.log("Discourse-initiated SSO request");
      
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
        const loginUrl = `${siteBaseUrl}/?next=${encodeURIComponent('/sso')}`;
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
        const loginUrl = `${siteBaseUrl}/?next=${encodeURIComponent('/sso')}`;
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders,
            "Location": loginUrl
          }
        });

      // Fetch user profile
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('registrations')
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
      if (profile.status !== 'approved') {
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
      const groups = buildDiscourseGroups(
        profile.gender === 'Male' ? 'men' : 'women', 
        false // xaccess - modify based on your business logic
      );

      // Build SSO response payload
      const responsePayload: Record<string, string> = {
        nonce: nonce,
        external_id: profile.id,
        email: profile.email,
        username: profile.username,
        name: profile.fullName || profile.firstName + ' ' + profile.lastName || profile.username,
        add_groups: groups
      };

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
    }
      }
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