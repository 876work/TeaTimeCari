import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

interface EmailRequest {
  email: string;
  firstName: string;
  reason?: string;
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
    userFound?: boolean;
    statusUpdated?: boolean;
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

async function updateUserStatus(email: string, reason: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error: updateError } = await supabaseAdmin
      .from('registrations')
      .update({ 
        status: 'rejected',
        rejection_reason: reason || 'No reason provided'
      })
      .eq('email', email);

    if (updateError) {
      if (updateError.code === '42P01') {
        console.warn('Registrations table not found, skipping status update for demo');
        return { success: true };
      }
      throw updateError;
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error updating user status:', err);
    return { 
      success: false, 
      error: `Failed to update user status: ${err.message || err}` 
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

    const { email, firstName, reason, dryRun } = requestData;
    
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

    const rejectionReason = reason || "Your application did not meet our requirements";
    
    const subject = "Your account application has been reviewed";
    const text = `Hi ${actualFirstName},
  }
}
)

Thank you for your interest in joining Tea Time Cari.

Unfortunately, we cannot approve your account at this time.

Reason: ${rejectionReason}

If you have questions about this decision or would like to appeal, please reply to this email with additional information.

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
            reason: rejectionReason,
            wouldUpdateStatus: true
          }
        } as EmailResponse),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update user status to rejected (do this before sending email)
    const { success: statusUpdated, error: statusError } = await updateUserStatus(email, rejectionReason);

    // Send rejection email
    try {
      await sendEmail({ to: email, subject, text });
      
      return new Response(
        JSON.stringify({ 
          success: true,
          details: {
            emailSent: true,
            userFound: true,
            statusUpdated,
            statusUpdateError: statusError
          }
        } as EmailResponse),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (emailError: any) {
      console.error("[send-rejection-email] Email sending failed:", emailError.message);
      
      // Extract details from email error
      const errorDetails: any = {
        emailSent: false,
        userFound: true,
        statusUpdated,
        statusUpdateError: statusError
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
          error: emailError.message || 'Failed to send rejection email',
          details: errorDetails
        } as EmailResponse),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

  } catch (err: any) {
    console.error("[send-rejection-email] Unexpected error:", err?.message || err);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: \`Unexpected error: ${err?.message || err}`,
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