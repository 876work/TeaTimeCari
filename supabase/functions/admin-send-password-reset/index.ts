import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { requireAdmin, writeAdminAuditLog } from "../_shared/adminAuth.ts";

const SITE_BASE_URL = Deno.env.get("SITE_BASE_URL") || "https://teatimecari.app";

type ResetRequest = {
  registration_id?: string;
  user_id?: string;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    const adminCheck = await requireAdmin(req, "users:reset_password");
    if (!adminCheck.actor) return json(adminCheck.status, { ok: false, error: adminCheck.error });
    const actor = adminCheck.actor;

    const body = (await req.json().catch(() => ({}))) as ResetRequest;
    const registrationId = body.registration_id || body.user_id;

    if (!registrationId) return json(400, { ok: false, error: "registration_id is required" });

    const { data: registration, error: lookupError } = await supabaseAdmin
      .from("registrations")
      .select("id, email, username")
      .eq("id", registrationId)
      .maybeSingle();

    if (lookupError) return json(500, { ok: false, error: "registration lookup failed", detail: lookupError.message });
    if (!registration) return json(404, { ok: false, error: "Registration not found" });
    if (!registration.email) return json(400, { ok: false, error: "Registration email is required" });

    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(registration.email, {
      redirectTo: `${SITE_BASE_URL}/reset-password`,
    });

    if (resetError) {
      await writeAdminAuditLog({
        actor,
        req,
        action: "user_password_reset_sent",
        targetType: "registration",
        targetId: registrationId,
        targetEmail: registration.email,
        success: false,
        errorMessage: resetError.message,
      });
      return json(500, { ok: false, error: "Failed to send reset email", detail: resetError.message });
    }

    await writeAdminAuditLog({
      actor,
      req,
      action: "user_password_reset_sent",
      targetType: "registration",
      targetId: registrationId,
      targetEmail: registration.email,
      success: true,
    });

    return json(200, { ok: true, registration_id: registrationId, email: registration.email });
  } catch (error) {
    console.error("admin-send-password-reset error", error);
    return json(500, { ok: false, error: "internal", detail: String(error) });
  }
});
