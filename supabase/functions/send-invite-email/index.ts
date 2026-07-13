import { corsHeaders } from "../_shared/cors.ts";
import { sendInviteEmail } from "../_shared/resendEmail.ts";
import { requireAdmin, writeAdminAuditLog } from "../_shared/adminAuth.ts";

interface InviteRequest {
  emails?: string[];
  dryRun?: boolean;
}

interface InviteResult {
  email: string;
  success: boolean;
  error?: string;
}

interface InviteResponse {
  success: boolean;
  dryRun?: boolean;
  results?: InviteResult[];
  error?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeEmails(rawEmails: unknown): string[] {
  if (!Array.isArray(rawEmails)) return [];

  const seen = new Set<string>();
  const emails: string[] = [];

  for (const raw of rawEmails) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(trimmed);
  }

  return emails;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const adminCheck = await requireAdmin(req, "users:invite");
    if (!adminCheck.actor) {
      return new Response(
        JSON.stringify({ success: false, error: adminCheck.error } as InviteResponse),
        { status: adminCheck.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const actor = adminCheck.actor;

    let requestData: InviteRequest;
    try {
      requestData = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid JSON in request body: ${getErrorMessage(parseError)}` } as InviteResponse),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const emails = normalizeEmails(requestData.emails);

    if (emails.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "At least one email address is required" } as InviteResponse),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const invalidEmails = emails.filter((email) => !EMAIL_REGEX.test(email));
    if (invalidEmails.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid email format: ${invalidEmails.join(", ")}`,
        } as InviteResponse),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (requestData.dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          results: emails.map((email) => ({ email, success: true })),
        } as InviteResponse),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: InviteResult[] = [];

    for (const email of emails) {
      try {
        const emailResult = await sendInviteEmail(email);

        results.push({ email, success: emailResult.success, error: emailResult.error });

        await writeAdminAuditLog({
          actor,
          req,
          action: "user_invited",
          targetType: "invite",
          targetEmail: email,
          metadata: { email: emailResult },
          success: emailResult.success,
          errorMessage: emailResult.success ? null : emailResult.error ?? "Failed to send invite email",
        });
      } catch (emailError: unknown) {
        const message = getErrorMessage(emailError);
        results.push({ email, success: false, error: message });

        await writeAdminAuditLog({
          actor,
          req,
          action: "user_invited",
          targetType: "invite",
          targetEmail: email,
          success: false,
          errorMessage: message,
        });
      }
    }

    const anyFailed = results.some((result) => !result.success);

    return new Response(
      JSON.stringify({ success: !anyFailed, results } as InviteResponse),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    console.error("[send-invite-email] Unexpected error:", message);
    return new Response(
      JSON.stringify({ success: false, error: `Unexpected error: ${message}` } as InviteResponse),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
