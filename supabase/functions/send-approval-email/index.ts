import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { generate6DigitCode, expiresAt, sha256Hex } from "../_shared/crypto.ts";

interface EmailRequest {
  email: string;
  firstName: string;
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

async function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  const apiKey = Deno.env.get("SENDGRID_API_KEY");
  const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL");
  
  const configIssues: string[] = [];
  if (!apiKey) configIssues.push("SENDGRID_API_KEY environment variable not set");
  if (!fromEmail) configIssues.push("SENDGRID_FROM_EMAIL environment variable not set");
  
  if (configIssues.length > 0) {
    throw new Error(`SendGrid configuration error: ${configIssues.join(', ')}`);
  }

  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: fromEmail },
    subject,
    content: [{ type: "text/plain", value: text }],
  };

  let response: Response;
  try {
    response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (fetchError) {
    throw new Error(`Network error connecting to SendGrid: ${fetchError.message || fetchError}`);
  }

  if (!response.ok) {
    let errorBody = '';
    try {
      errorBody = await response.text();
    } catch (bodyError) {
      errorBody = 'Unable to read error response';
    }
    
    // Parse SendGrid error for better reporting
    let parsedError = errorBody;
    try {
      const errorJson = JSON.parse(errorBody);
      if (errorJson.errors && Array.isArray(errorJson.errors)) {
        parsedError = errorJson.errors.map((err: any) => err.message || err).join(', ');
      }
    } catch (parseError) {
      // Keep original error body if parsing fails
    }
    
    throw new Error(`SendGrid API error (${response.status}): ${parsedError}`);
  }
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
    let actualFirstName = firstName;
    if (!actualFirstName && requestData.fullName) {
      actualFirstName = getFirstNameFromFull(requestData.fullName);
    }
    if (!actualFirstName) {
      actualFirstName = 'user';
    }

    // Validate required fields
    const missingFields: string[] = [];
    if (!email) missingFields.push("email");
    if (!actualFirstName || actualFirstName === 'user') missingFields.push("firstName or fullName");

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

    // Generate email code if we have a user ID
    let emailCode = `SLU${generate6DigitCode()}`;
    let codeGenerationError: string | undefined;

    if (userId) {
      const { code, error } = await generateAndStoreEmailCode(userId);
      emailCode = code;
      if (error) {
        codeGenerationError = error;
      }
    }

    const subject = "Your account has been approved";
    const text = `Hi ${firstName},
    const text = `Hi ${actualFirstName},

Good news — your account has been approved! 

Your verification code is: ${emailCode}

This code expires in 24 hours. Please enter it in the app to complete your account activation.

Regards,
The Tea Time Cari Team`;

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
      await sendEmail({ to: email, subject, text });
      
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