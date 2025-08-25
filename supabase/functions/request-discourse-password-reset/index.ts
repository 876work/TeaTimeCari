import { corsHeaders } from "../_shared/cors.ts";

interface PasswordResetRequest {
  email: string;
}

interface PasswordResetResponse {
  success: boolean;
  message?: string;
  error?: string;
  details?: {
    discourseStatus?: number;
    discourseResponse?: string;
    configurationIssues?: string[];
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let requestData: PasswordResetRequest;
    try {
      requestData = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid JSON in request body",
          details: { parseError: parseError.message }
        } as PasswordResetResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const { email } = requestData;

    // Validate required fields
    if (!email) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Email address is required"
        } as PasswordResetResponse),
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
        } as PasswordResetResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Get Discourse configuration
    const discourseBaseUrl = Deno.env.get("DISCOURSE_BASE_URL");
    const discourseApiKey = Deno.env.get("DISCOURSE_ADMIN_API_KEY");
    const discourseApiUsername = Deno.env.get("DISCOURSE_ADMIN_API_USERNAME");

    const configIssues: string[] = [];
    if (!discourseBaseUrl) configIssues.push("DISCOURSE_BASE_URL environment variable not set");
    if (!discourseApiKey) configIssues.push("DISCOURSE_ADMIN_API_KEY environment variable not set");
    if (!discourseApiUsername) configIssues.push("DISCOURSE_ADMIN_API_USERNAME environment variable not set");

    if (configIssues.length > 0) {
      console.error("Discourse configuration issues:", configIssues);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Discourse integration not configured",
          details: { configurationIssues: configIssues }
        } as PasswordResetResponse),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Make request to Discourse password reset endpoint
    const discourseUrl = `${discourseBaseUrl.replace(/\/+$/, '')}/session/forgot_password.json`;
    
    let discourseResponse: Response;
    try {
      discourseResponse = await fetch(discourseUrl, {
        method: "POST",
        headers: {
          "Api-Key": discourseApiKey,
          "Api-Username": discourseApiUsername,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          login: email
        })
      });
    } catch (fetchError) {
      console.error("Network error connecting to Discourse:", fetchError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to connect to Discourse. Please try again later.",
          details: { 
            networkError: fetchError.message || String(fetchError)
          }
        } as PasswordResetResponse),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Parse Discourse response
    let discourseData: any = {};
    let responseText = '';
    try {
      responseText = await discourseResponse.text();
      if (responseText) {
        discourseData = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.warn("Failed to parse Discourse response as JSON:", parseError);
      discourseData = { raw_response: responseText };
    }

    // Handle Discourse response
    if (discourseResponse.ok) {
      // Discourse typically returns 200 for both successful and failed password reset requests
      // to prevent email enumeration attacks
      console.log("Discourse password reset request completed:", discourseResponse.status);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "If an account with this email exists, you will receive a password reset email from our community forum.",
          details: {
            discourseStatus: discourseResponse.status,
            discourseResponse: "Password reset request processed"
          }
        } as PasswordResetResponse),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      // Handle Discourse API errors
      console.error("Discourse API error:", discourseResponse.status, responseText);
      
      let errorMessage = "Failed to process password reset request. Please try again.";
      
      // Parse specific Discourse error messages if available
      if (discourseData.errors && Array.isArray(discourseData.errors)) {
        errorMessage = discourseData.errors.join(', ');
      } else if (discourseData.error) {
        errorMessage = discourseData.error;
      } else if (discourseResponse.status === 429) {
        errorMessage = "Too many password reset requests. Please wait before trying again.";
      } else if (discourseResponse.status === 404) {
        errorMessage = "Password reset service not available. Please contact support.";
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          details: {
            discourseStatus: discourseResponse.status,
            discourseResponse: responseText || "No response body"
          }
        } as PasswordResetResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

  } catch (err: any) {
    console.error("[request-discourse-password-reset] Unexpected error:", err?.message || err);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Unexpected error: ${err?.message || err}`,
        details: { 
          errorType: err?.constructor?.name || 'Unknown'
        }
      } as PasswordResetResponse),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});