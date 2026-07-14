import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { requireAdmin, writeAdminAuditLog } from "../_shared/adminAuth.ts";
import { describeError, isMissingTableError } from "../_shared/pgErrors.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Variant = "info" | "warning" | "critical";
type Audience = "all" | "approved" | "male" | "female";

type RequestBody = {
  action?: "list" | "create" | "set-active" | "delete" | "send-email";
  announcement_id?: string;
  title?: string;
  body?: string;
  variant?: string;
  audience?: string;
  show_banner?: boolean;
  ends_at?: string | null;
};

const VARIANTS = new Set<Variant>(["info", "warning", "critical"]);
const AUDIENCES = new Set<Audience>(["all", "approved", "male", "female"]);
const RESEND_BATCH_URL = "https://api.resend.com/emails/batch";
const BATCH_SIZE = 50;

const TABLE_MISSING_MESSAGE =
  "The site_announcements table doesn't exist yet. Ask an engineer to run the pending database migration (supabase/migrations/20260714000000_admin_dashboard_expansion.sql) before announcements can be created.";

function missingTableResponse() {
  return json(409, { ok: false, error: TABLE_MISSING_MESSAGE, tableMissing: true });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function listAnnouncements() {
  const { data, error } = await supabaseAdmin
    .from("site_announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    if (isMissingTableError(error)) return { announcements: [], tableMissing: true };
    throw error;
  }

  return { announcements: data ?? [], tableMissing: false };
}

async function getRecipients(audience: Audience): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("registrations")
    .select("email, status, gender")
    .not("email", "is", null);
  if (error) throw error;

  const approvedLike = (status?: string | null) =>
    (status ?? "").toLowerCase().includes("approve");

  const rows = (data ?? []).filter((row) => {
    if (audience === "all") return true;
    if (audience === "approved") return approvedLike(row.status);
    if (audience === "male") return approvedLike(row.status) && row.gender === "Male";
    if (audience === "female") return approvedLike(row.status) && row.gender === "Female";
    return false;
  });

  const seen = new Set<string>();
  const emails: string[] = [];
  for (const row of rows) {
    const email = String(row.email).trim();
    const key = email.toLowerCase();
    if (!email || seen.has(key)) continue;
    seen.add(key);
    emails.push(email);
  }

  return emails;
}

async function sendBroadcast(input: {
  title: string;
  body: string;
  recipients: string[];
}): Promise<{ sent: number; failed: number; errors: string[] }> {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL")?.trim();
  const fromName = Deno.env.get("RESEND_FROM_NAME")?.trim() || "Tea Time Cari";

  if (!apiKey) throw new Error("Missing RESEND_API_KEY");
  if (!fromEmail) throw new Error("Missing RESEND_FROM_EMAIL");

  const subject = input.title;
  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const html = `<p>Hello,</p>${paragraphs
    .map((part) => `<p>${escapeHtml(part).replace(/\n/g, "<br/>")}</p>`)
    .join("")}<p>Best regards,<br/>Tea Time Cari Team</p>`;
  const text = `Hello,\n\n${input.body}\n\nBest regards,\nTea Time Cari Team`;

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let index = 0; index < input.recipients.length; index += BATCH_SIZE) {
    const batch = input.recipients.slice(index, index + BATCH_SIZE);

    const response = await fetch(RESEND_BATCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(
        batch.map((to) => ({
          from: `${fromName} <${fromEmail}>`,
          to: [to],
          subject,
          html,
          text,
        })),
      ),
    });

    if (response.ok) {
      sent += batch.length;
    } else {
      failed += batch.length;
      const detail = await response.json().catch(() => ({}));
      errors.push(
        typeof detail?.message === "string"
          ? detail.message
          : `Resend batch error (${response.status})`,
      );
    }
  }

  return { sent, failed, errors };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const adminCheck = await requireAdmin(req, "announcements:manage");
    if (!adminCheck.actor) {
      return json(adminCheck.status, { ok: false, error: adminCheck.error });
    }
    const actor = adminCheck.actor;

    const body = req.method === "POST"
      ? (await req.json().catch(() => ({}))) as RequestBody
      : {} as RequestBody;
    const action = body.action ?? "list";

    if (action === "list") {
      const { announcements, tableMissing } = await listAnnouncements();
      return json(200, { ok: true, announcements, tableMissing });
    }

    if (action === "create") {
      const title = (body.title ?? "").trim();
      const content = (body.body ?? "").trim();
      const variant = VARIANTS.has(body.variant as Variant) ? (body.variant as Variant) : "info";
      const audience = AUDIENCES.has(body.audience as Audience) ? (body.audience as Audience) : "all";

      if (!title) return json(400, { ok: false, error: "Title is required." });
      if (!content) return json(400, { ok: false, error: "Announcement body is required." });

      const { data: created, error } = await supabaseAdmin
        .from("site_announcements")
        .insert({
          title,
          body: content,
          variant,
          audience,
          show_banner: body.show_banner !== false,
          ends_at: body.ends_at || null,
          created_by: actor.userId,
          created_by_email: actor.email,
        })
        .select()
        .single();

      if (error) {
        if (isMissingTableError(error)) return missingTableResponse();
        throw error;
      }

      await writeAdminAuditLog({
        actor,
        req,
        action: "announcement_created",
        targetType: "announcement",
        targetId: created.id,
        metadata: { title, variant, audience },
      });

      const { announcements } = await listAnnouncements();
      return json(200, { ok: true, announcement: created, announcements });
    }

    if (action === "set-active") {
      if (!body.announcement_id) {
        return json(400, { ok: false, error: "announcement_id is required." });
      }

      const { data: current, error: readError } = await supabaseAdmin
        .from("site_announcements")
        .select("id, title, active")
        .eq("id", body.announcement_id)
        .maybeSingle();

      if (readError) {
        if (isMissingTableError(readError)) return missingTableResponse();
        throw readError;
      }
      if (!current) return json(404, { ok: false, error: "Announcement not found." });

      const { error } = await supabaseAdmin
        .from("site_announcements")
        .update({ active: !current.active })
        .eq("id", current.id);

      if (error) {
        if (isMissingTableError(error)) return missingTableResponse();
        throw error;
      }

      await writeAdminAuditLog({
        actor,
        req,
        action: current.active ? "announcement_deactivated" : "announcement_activated",
        targetType: "announcement",
        targetId: current.id,
        metadata: { title: current.title },
      });

      const { announcements } = await listAnnouncements();
      return json(200, { ok: true, announcements });
    }

    if (action === "delete") {
      if (!body.announcement_id) {
        return json(400, { ok: false, error: "announcement_id is required." });
      }

      const { error } = await supabaseAdmin
        .from("site_announcements")
        .delete()
        .eq("id", body.announcement_id);

      if (error) {
        if (isMissingTableError(error)) return missingTableResponse();
        throw error;
      }

      await writeAdminAuditLog({
        actor,
        req,
        action: "announcement_deleted",
        targetType: "announcement",
        targetId: body.announcement_id,
      });

      const { announcements } = await listAnnouncements();
      return json(200, { ok: true, announcements });
    }

    if (action === "send-email") {
      if (!body.announcement_id) {
        return json(400, { ok: false, error: "announcement_id is required." });
      }

      const { data: announcement, error: readError } = await supabaseAdmin
        .from("site_announcements")
        .select("*")
        .eq("id", body.announcement_id)
        .maybeSingle();

      if (readError) {
        if (isMissingTableError(readError)) return missingTableResponse();
        throw readError;
      }
      if (!announcement) return json(404, { ok: false, error: "Announcement not found." });

      const recipients = await getRecipients(announcement.audience as Audience);
      if (recipients.length === 0) {
        return json(400, { ok: false, error: "No recipients match this announcement's audience." });
      }

      const result = await sendBroadcast({
        title: announcement.title,
        body: announcement.body,
        recipients,
      });

      await supabaseAdmin
        .from("site_announcements")
        .update({
          email_sent_at: new Date().toISOString(),
          email_recipient_count: result.sent,
        })
        .eq("id", announcement.id);

      await writeAdminAuditLog({
        actor,
        req,
        action: "announcement_email_sent",
        targetType: "announcement",
        targetId: announcement.id,
        metadata: {
          title: announcement.title,
          audience: announcement.audience,
          sent: result.sent,
          failed: result.failed,
          errors: result.errors.slice(0, 5),
        },
        success: result.failed === 0,
        errorMessage: result.errors[0] ?? null,
      });

      const { announcements } = await listAnnouncements();
      return json(200, {
        ok: true,
        sent: result.sent,
        failed: result.failed,
        errors: result.errors,
        announcements,
      });
    }

    return json(400, { ok: false, error: `Unknown action: ${action}` });
  } catch (error) {
    const message = describeError(error);
    console.error("[admin-announcements] error:", message);
    return json(500, { ok: false, error: message });
  }
});
