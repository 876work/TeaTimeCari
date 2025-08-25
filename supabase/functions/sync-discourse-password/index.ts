import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

interface SyncPasswordRequest {
  email: string;
  password: string;
}

interface SyncPasswordResponse {
  success: boolean;
  message?: string;
  error?: string;
  details?: {
    userFound?: boolean;
    discourseStatus?: number;
    discourseResponse?: string;
    configurationIssues?: string[];
  };
}

async function updateDiscoursePassword(email: string, password: string): Promise<{ success: boolean; error?: string; details?: any }> {
  const discourseBaseUrl = Deno.env.get("DISCOURSE_BASE_URL");
  const discourseApiKey = Deno.env.get("DISCOURSE_ADMIN_API_KEY");
  const discourseApiUsername = Deno.env.get("DISCOURSE_ADMIN_API_USERNAME");

  const configIssues: string[] = [];
  if (!discourseBaseUrl) configIssues.push("DISCOURSE_BASE_URL environment variable not set");
  if (!discourseApiKey) configIssues.push("DISCOURSE_ADMIN_API_KEY environment variable not set");
  if (!discourseApiUsername) configIssues.push("DISCOURSE_ADMIN_API_USERNAME environment variable not set");

  if (configIssues.length > 0) {
    return {
      success: false,
      error: "Discourse integration not configured",
      details: { configurationIssues }
    };
  }

  try {
    // First, find the user in Discourse by email
    const userLookupUrl = `${discourseBaseUrl.replace(/\/+$/, '')}/u/by-email/${encodeURIComponent(email)}.json`;
    
    const lookupResponse = await fetch(userLookupUrl, {
      method: "GET",
      headers: {
        "Api-Key": discourseApiKey,
        "Api-Username": discourseApiUsername,
        "Accept": "application/json"
      }
    });

    if (!lookupResponse.ok) {
      const errorText = await lookupResponse.text();
      
      if (lookupResponse.status === 404) {
        return {
          success: false,
          error: "User not found in Discourse",
          details: { 
            userFound: false,
            discourseStatus: lookupResponse.status 
          }
        };
      }
      
      throw new Error(`User lookup failed: ${lookupResponse.status} ${errorText}`);
    }

    const userData = await lookupResponse.json();
    const discourseUserId = userData.user?.id;

    if (!discourseUserId) {
      return {
        success: false,
        error: "Could not find Discourse user ID",
        details: { userFound: false }
      };
    }

    // Update the user's password in Discourse
    const updateUrl = `${discourseBaseUrl.replace(/\/+$/, '')}/admin/users/${discourseUserId}.json`;
    
    const updateResponse = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        "Api-Key": discourseApiKey,
        "Api-Username": discourseApiUsername,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        password: password
      })
    });

    const updateText = await updateResponse.text();
    
    if (!updateResponse.ok) {
      throw new Error(`Password update failed: ${updateResponse.status} ${updateText}`);
    }

    return {
      success: true,
      details: {
        userFound: true,
        discourseStatus: updateResponse.status,
        discourseResponse: "Password updated successfully"
      }
    };

  } catch (err: any) {
    console.error("Discourse password update error:", err);
    return {
      success: false,
      error: err.message || "Failed to update Discourse password",
      details: { error: err.message }
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Method not allowed" 
        } as SyncPasswordResponse),
        { 
          status: 405, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Get the authorization header to verify the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing authorization header" 
        } as SyncPasswordResponse),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Verify the user session
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid authorization token" 
        } as SyncPasswordResponse),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Parse request body
    let requestData: SyncPasswordRequest;
    try {
      requestData = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid JSON in request body" 
        } as SyncPasswordResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const { email, password } = requestData;

    // Validate required fields
    if (!email || !password) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Email and password are required" 
        } as SyncPasswordResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid email format" 
        } as SyncPasswordResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Security check: ensure user can only update their own password
    if (user.email !== email) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "You can only update your own password" 
        } as SyncPasswordResponse),
        { 
          status: 403, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Validate password strength
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Password must be at least 6 characters long" 
        } as SyncPasswordResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Update password in Discourse
    const result = await updateDiscoursePassword(email, password);

    if (result.success) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Password successfully synced to Discourse",
          details: result.details
        } as SyncPasswordResponse),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } else {
      // Return the error but don't fail the request completely
      // This allows the main app password reset to succeed even if Discourse sync fails
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error || "Failed to sync password to Discourse",
          details: result.details
        } as SyncPasswordResponse),
        { 
          status: 200, // Use 200 so the client knows the main reset succeeded
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

  } catch (err: any) {
    console.error("[sync-discourse-password] Unexpected error:", err?.message || err);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Unexpected error: ${err?.message || err}`,
        details: { 
          errorType: err?.constructor?.name || 'Unknown'
        }
      } as SyncPasswordResponse),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});