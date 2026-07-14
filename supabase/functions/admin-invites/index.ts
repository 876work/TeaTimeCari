import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { requireAdmin, writeAdminAuditLog } from "../_shared/adminAuth.ts";
import { sendInviteEmail } from "../_shared/resendEmail.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type RequestBody = {
  action?: "list" | "resend" | "revoke" | "toggle-code" | "create-code";
  invite_id?: string;
  code_id?: string;
  code?: string;
  usage_limit?: number;
  expires_in_days?: number;
};

function isMissingTable(error: { code?: string } | null) {
  return error?.code === "42P01";
}

async function listInvites() {
  const { data: invites, error } = await supabaseAdmin
    .from("email_invites")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    if (isMissingTable(error)) return { invites: [], tableMissing: true };
    throw error;
  }

  const rows = invites ?? [];

  // Mark invites as accepted when a registration exists for the email.
  const pendingEmails = rows
    .filter((invite) => invite.status === "sent" || invite.status === "failed")
    .map((invite) => invite.email.toLowerCase());

  if (pendingEmails.length > 0) {
    const { data: registrations } = await supabaseAdmin
      .from("registrations")
      .select("id, email, created_at")
      .in("email", pendingEmails);

    const registrationByEmail = new Map(
      (registrations ?? [])
        .filter((reg) => reg.email)
        .map((reg) => [String(reg.email).toLowerCase(), reg]),
    );

    for (const invite of rows) {
      const reg = registrationByEmail.get(invite.email.toLowerCase());
      if (reg && (invite.status === "sent" || invite.status === "failed")) {
        invite.status = "accepted";
        invite.accepted_at = reg.created_at ?? new Date().toISOString();
        invite.accepted_registration_id = reg.id;

        await supabaseAdmin
          .from("email_invites")
          .update({
            status: "accepted",
            accepted_at: invite.accepted_at,
            accepted_registration_id: reg.id,
          })
          .eq("id", invite.id);
      }
    }
  }

  return { invites: rows, tableMissing: false };
}

async function listInviteCodes() {
  const { data, error } = await supabaseAdmin
    .from("invite_codes")
    .select("id, code, usage_limit, usage_count, is_active, expires_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }

  return data ?? [];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const adminCheck = await requireAdmin(req, "users:invite");
    if (!adminCheck.actor) {
      return json(adminCheck.status, { ok: false, error: adminCheck.error });
    }
    const actor = adminCheck.actor;

    const body = req.method === "POST"
      ? (await req.json().catch(() => ({}))) as RequestBody
      : {} as RequestBody;
    const action = body.action ?? "list";

    if (action === "list") {
      const { invites, tableMissing } = await listInvites();
      return json(200, {
        ok: true,
        invites,
        codes: await listInviteCodes(),
        tableMissing,
      });
    }

    if (action === "resend") {
      if (!body.invite_id) return json(400, { ok: false, error: "invite_id is required." });

      const { data: invite, error } = await supabaseAdmin
        .from("email_invites")
        .select("*")
        .eq("id", body.invite_id)
        .maybeSingle();

      if (error) throw error;
      if (!invite) return json(404, { ok: false, error: "Invite not found." });
      if (invite.status === "revoked") {
        return json(400, { ok: false, error: "This invite was revoked. Send a new invite instead." });
      }

      const result = await sendInviteEmail(invite.email);

      await supabaseAdmin
        .from("email_invites")
        .update({
          status: result.success ? "sent" : "failed",
          sent_count: (invite.sent_count ?? 1) + 1,
          last_sent_at: new Date().toISOString(),
          last_error: result.success ? null : result.error ?? "Failed to send invite email",
        })
        .eq("id", invite.id);

      await writeAdminAuditLog({
        actor,
        req,
        action: "invite_resent",
        targetType: "invite",
        targetId: invite.id,
        targetEmail: invite.email,
        success: result.success,
        errorMessage: result.success ? null : result.error ?? "Failed to send invite email",
      });

      if (!result.success) {
        return json(200, { ok: false, error: result.error ?? "Failed to resend invite." });
      }

      const { invites } = await listInvites();
      return json(200, { ok: true, invites });
    }

    if (action === "revoke") {
      if (!body.invite_id) return json(400, { ok: false, error: "invite_id is required." });

      const { data: invite, error } = await supabaseAdmin
        .from("email_invites")
        .update({ status: "revoked", revoked_at: new Date().toISOString() })
        .eq("id", body.invite_id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!invite) return json(404, { ok: false, error: "Invite not found." });

      await writeAdminAuditLog({
        actor,
        req,
        action: "invite_revoked",
        targetType: "invite",
        targetId: invite.id,
        targetEmail: invite.email,
        nextStatus: "revoked",
      });

      const { invites } = await listInvites();
      return json(200, { ok: true, invites });
    }

    if (action === "toggle-code") {
      if (!body.code_id) return json(400, { ok: false, error: "code_id is required." });

      const { data: code, error: readError } = await supabaseAdmin
        .from("invite_codes")
        .select("id, code, is_active")
        .eq("id", body.code_id)
        .maybeSingle();

      if (readError) throw readError;
      if (!code) return json(404, { ok: false, error: "Invite code not found." });

      const { error: updateError } = await supabaseAdmin
        .from("invite_codes")
        .update({ is_active: !code.is_active })
        .eq("id", code.id);

      if (updateError) throw updateError;

      await writeAdminAuditLog({
        actor,
        req,
        action: code.is_active ? "invite_code_deactivated" : "invite_code_activated",
        targetType: "invite_code",
        targetId: code.id,
        metadata: { code: code.code },
      });

      return json(200, { ok: true, codes: await listInviteCodes() });
    }

    if (action === "create-code") {
      const code = (body.code ?? "").trim().toUpperCase();
      if (!code || code.length < 4) {
        return json(400, { ok: false, error: "Code must be at least 4 characters." });
      }

      const usageLimit = Number.isFinite(body.usage_limit)
        ? Math.min(Math.max(Math.floor(body.usage_limit!), 1), 10000)
        : 10;
      const expiresInDays = Number.isFinite(body.expires_in_days)
        ? Math.min(Math.max(Math.floor(body.expires_in_days!), 1), 365)
        : 30;

      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

      const { error: insertError } = await supabaseAdmin.from("invite_codes").insert({
        code,
        usage_limit: usageLimit,
        expires_at: expiresAt,
        created_by: actor.userId,
      });

      if (insertError) {
        if (insertError.code === "23505") {
          return json(400, { ok: false, error: `Invite code "${code}" already exists.` });
        }
        throw insertError;
      }

      await writeAdminAuditLog({
        actor,
        req,
        action: "invite_code_created",
        targetType: "invite_code",
        metadata: { code, usageLimit, expiresAt },
      });

      return json(200, { ok: true, codes: await listInviteCodes() });
    }

    return json(400, { ok: false, error: `Unknown action: ${action}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[admin-invites] error:", message);
    return json(500, { ok: false, error: message });
  }
});
