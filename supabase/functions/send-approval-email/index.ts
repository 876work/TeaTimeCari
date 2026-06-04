import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { generate6DigitCode, expiresAt } from "../_shared/crypto.ts";
import { sendApprovalEmail } from "../_shared/resendEmail.ts";

interface EmailRequest {
  email: string;
  firstName?: string;
  fullName?: string;
  dryRun?: boolean;
}

interface EmailResponse {
  success: boolean;
  dryRun?: boolean;
  preview?: {
    to: string;
    subject: string;
    text: string;
  };
  error?: string;
  details?: {
    sendgridStatus?: number;
    sendgridResponse?: string;
    configurationIssues?: string[];
  };
}

function getFirstNameFromFull(fullName: string): string | undefined {
  return fullName.trim().split(/\s+/).filter(Boolean)[0];
}

function buildPreviewGreeting(firstName?: string): string {
  const cleanName = firstName?.trim();
  return cleanName ? `Hi ${cleanName},` : "Hello,";
}

async function generateAndStoreEmailCode(userId: string): Promise<{ code: string; error?: string }> {
  try {
    const emailCode = `SLU${generate6DigitCode()}`;
    const codeExpiry = expiresAt(24); // 24 hours

    const { error: updateError } = await supabaseAdmin
      .from('registrations')
      .update({
        email_code: emailCode,
        email_code_expiry: codeExpiry
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Database update error:', updateError);
      return { 
        code: emailCode, 
        error: `Failed to store verification code: ${updateError.message}` 
      };
    }

    return { code: emailCode };
  } catch (err: any) {
    console.error('Error generating email code:', err);
    return { 
      code: `SLU${generate6DigitCode()}`, 
      error: `Code generation error: ${err.message || err}` 
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let requestData: EmailRequest;
    try {
      requestData = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid JSON in request body",
          details: { parseError: parseError.message }
        } as EmailResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const { email, firstName, dryRun } = requestData;
    
    // Handle both fullName and firstName for backward compatibility
    let actualFirstName = firstName?.trim();
    if (!actualFirstName && requestData.fullName) {
      actualFirstName = getFirstNameFromFull(requestData.fullName);
    }

    // Validate required fields
    const missingFields: string[] = [];
    if (!email) missingFields.push("email");

    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Missing required fields: ${missingFields.join(', ')}`,
          details: { missingFields }
        } as EmailResponse),
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
          error: "Invalid email format",
          details: { providedEmail: email }
        } as EmailResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Find user by email to get user ID for code generation
    let userId: string | null = null;
    try {
      const { data: userData, error: userError } = await supabaseAdmin
        .from('registrations')
        .select('id')
        .eq('email', email)
        .single();

      if (userError) {
        if (userError.code === 'PGRST116') {
          console.warn(`User not found for email: ${email}`);
        } else if (userError.code !== '42P01') {
          throw userError;
        }
      } else {
        userId = userData.id;
      }
    } catch (dbError: any) {
      console.warn('Database lookup failed:', dbError);
      // Continue without user ID for dry run or demo purposes
    }

    // Generate email code if we have a user ID.
    // The updated approval email no longer displays the code, but the existing
    // code-generation side effect is preserved for any flows that still read it.
    let codeGenerationError: string | undefined;

    if (userId) {
      const { error } = await generateAndStoreEmailCode(userId);
      if (error) {
        codeGenerationError = error;
      }
    }

    const subject = "Your Tea Time Cari Account has been Approved";
    const siteBaseUrl = (Deno.env.get("SITE_BASE_URL")?.trim() || "https://teatimecari.app").replace(/\/+$/, "");
    const communityGuidelinesUrl = `${siteBaseUrl}/community-guidelines`;
    const greeting = buildPreviewGreeting(actualFirstName);
    const text = `${greeting}
Your Tea Time Cari account has been approved.
You can now log in here:
${siteBaseUrl}/login
Tea Time Cari is built around privacy, respectful sharing, and community support. Please take a moment to review our Privacy Policy, Terms of Service, and Community Guidelines before participating.
Privacy Policy:
${siteBaseUrl}/privacy-policy
Terms of Service:
${siteBaseUrl}/terms-of-service
Community Guidelines:
${communityGuidelinesUrl}
Welcome to the community.
Best regards,
Tea Time Cari Team`;

    // Handle dry run
    if (dryRun) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          dryRun: true, 
          preview: { to: email, subject, text },
          details: {
            userId: userId || 'not_found',
            codeGenerated: !!userId,
            codeGenerationError
          }
        } as EmailResponse),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send actual email
    try {
      const emailResult = await sendApprovalEmail(email, actualFirstName);
      if (!emailResult.success) {
        throw new Error(emailResult.error || "Failed to send approval email");
      }
      
      return new Response(
        JSON.stringify({ 
          success: true,
          details: {
            emailSent: true,
            codeGenerated: !!userId,
            codeGenerationError
          }
        } as EmailResponse),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (emailError: any) {
      console.error("[send-approval-email] Email sending failed:", emailError.message);
      
      // Extract details from email error
      const errorDetails: any = {
        emailSent: false,
        codeGenerated: !!userId,
        codeGenerationError
      };

      if (emailError.message.includes('SendGrid API error')) {
        const statusMatch = emailError.message.match(/\((\d+)\)/);
        if (statusMatch) {
          errorDetails.sendgridStatus = parseInt(statusMatch[1]);
        }
        errorDetails.sendgridResponse = emailError.message;
      } else if (emailError.message.includes('configuration error')) {
        errorDetails.configurationIssues = [emailError.message];
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: emailError.message || 'Failed to send approval email',
          details: errorDetails
        } as EmailResponse),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

  } catch (err: any) {
    console.error("[send-approval-email] Unexpected error:", err?.message || err);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Unexpected error: ${err?.message || err}`,
        details: { 
          errorType: err?.constructor?.name || 'Unknown',
          stack: err?.stack 
        }
      } as EmailResponse),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
