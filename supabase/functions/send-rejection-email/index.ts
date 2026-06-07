import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { sendRejectionEmail } from "../_shared/resendEmail.ts";
import { requireAdmin, writeAdminAuditLog } from "../_shared/adminAuth.ts";

interface EmailRequest {
  email: string;
  firstName?: string;
  fullName?: string;
  reason?: string;
  registration_id?: string;
  user_id?: string;
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

function getFirstNameFromFull(fullName: string): string | undefined {
  return fullName.trim().split(/\s+/).filter(Boolean)[0];
}

function buildPreviewGreeting(firstName?: string): string {
  const cleanName = firstName?.trim();
  return cleanName ? `Hi ${cleanName},` : "Hello,";
}

async function updateUserStatus(request: EmailRequest, reason: string): Promise<{ success: boolean; error?: string }> {
  try {
    let query = supabaseAdmin
      .from('registrations')
      .update({
        status: 'rejected',
        rejection_reason: reason || 'No reason provided'
      });

    if (request.registration_id) {
      query = query.eq('id', request.registration_id);
    } else if (request.user_id) {
      query = query.eq('id', request.user_id);
    } else {
      query = query.eq('email', request.email);
    }

    const { error: updateError } = await query;

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
    const adminCheck = await requireAdmin(req, "users:reject");
    if (!adminCheck.actor) {
      return new Response(
        JSON.stringify({ success: false, error: adminCheck.error } as EmailResponse),
        { status: adminCheck.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const actor = adminCheck.actor;

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

    const rejectionReason = reason || "No reason provided";

    const subject = "Your Tea Time Cari Account was not Approved";
    const greeting = buildPreviewGreeting(actualFirstName);
    const text = `${greeting}
Thank you for your interest in Tea Time Cari.
After reviewing your registration, we are unable to approve your account at this time.
To help protect the privacy and safety of the community, some registrations may not be approved if they do not meet our account review requirements.
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
            reason: rejectionReason,
            wouldUpdateStatus: true
          }
        } as EmailResponse),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update user status to rejected (do this before sending email)
    const { success: statusUpdated, error: statusError } = await updateUserStatus(requestData, rejectionReason);

    // Send rejection email
    try {
      const emailResult = await sendRejectionEmail(email, actualFirstName);
      if (!emailResult.success) {
        throw new Error(emailResult.error || "Failed to send rejection email");
      }

      await writeAdminAuditLog({
        actor,
        req,
        action: "user_rejected",
        targetType: "registration",
        targetId: requestData.registration_id || requestData.user_id || null,
        targetEmail: email,
        nextStatus: "rejected",
        reason: rejectionReason,
        metadata: { email: emailResult, statusUpdated, statusUpdateError: statusError },
        success: statusUpdated,
        errorMessage: statusError ?? null,
      });

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

      await writeAdminAuditLog({
        actor,
        req,
        action: "user_rejected",
        targetType: "registration",
        targetId: requestData.registration_id || requestData.user_id || null,
        targetEmail: email,
        nextStatus: "rejected",
        reason: rejectionReason,
        metadata: { email: { success: false, error: emailError.message }, statusUpdated, statusUpdateError: statusError },
        success: statusUpdated,
        errorMessage: statusError ?? emailError.message ?? "Failed to send rejection email",
      });

      return new Response(
        JSON.stringify({
          success: true,
          status: 'rejected_with_email_error',
          warning: emailError.message || 'Failed to send rejection email',
          details: errorDetails
        } as EmailResponse),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

  } catch (err: any) {
    console.error("[send-rejection-email] Unexpected error:", err?.message || err);
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
