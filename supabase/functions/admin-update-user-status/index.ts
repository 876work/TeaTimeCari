import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { sendSuspensionEmail, sendUnsuspensionEmail } from "../_shared/resendEmail.ts";
import { requireAdmin, writeAdminAuditLog } from "../_shared/adminAuth.ts";

type AdminAction = "suspend" | "unsuspend";

type StatusRequest = {
  registration_id?: string;
  user_id?: string;
  action?: AdminAction;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getFirstName(registration: { firstName?: string | null; full_name?: string | null }) {
  const firstName = registration.firstName?.trim();
  if (firstName) return firstName;

  const fullName = registration.full_name?.trim();
  return fullName?.split(/\s+/).filter(Boolean)[0];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    const adminCheck = await requireAdmin(req, "users:suspend");
    if (!adminCheck.actor) return json(adminCheck.status, { ok: false, error: adminCheck.error });
    const actor = adminCheck.actor;

    const body = (await req.json().catch(() => ({}))) as StatusRequest;
    const registrationId = body.registration_id || body.user_id;
    const action = body.action;

    if (!registrationId) return json(400, { ok: false, error: "registration_id is required" });
    if (action !== "suspend" && action !== "unsuspend") {
      return json(400, { ok: false, error: "action must be suspend or unsuspend" });
    }

    const { data: registration, error: lookupError } = await supabaseAdmin
      .from("registrations")
      .select("id, email, username, firstName, full_name, status")
      .eq("id", registrationId)
      .maybeSingle();

    if (lookupError) return json(500, { ok: false, error: "registration lookup failed", detail: lookupError.message });
    if (!registration) return json(404, { ok: false, error: "Registration not found" });
    if (!registration.email) return json(400, { ok: false, error: "Registration email is required" });

    const nextStatus = action === "suspend" ? "suspended" : "approved";
    const { error: updateError } = await supabaseAdmin
      .from("registrations")
      .update({ status: nextStatus })
      .eq("id", registrationId);

    if (updateError) return json(500, { ok: false, error: "status update failed", detail: updateError.message });

    const firstName = getFirstName(registration);
    const emailResult = action === "suspend"
      ? await sendSuspensionEmail(registration.email, firstName)
      : await sendUnsuspensionEmail(registration.email, firstName);

    await writeAdminAuditLog({
      actor,
      req,
      action: action === "suspend" ? "user_suspended" : "user_unsuspended",
      targetType: "registration",
      targetId: registrationId,
      targetEmail: registration.email,
      previousStatus: registration.status,
      nextStatus,
      metadata: { email: emailResult },
      success: true,
    });

    return json(200, {
      ok: true,
      registration_id: registrationId,
      action,
      status: nextStatus,
      previous_status: registration.status,
      email: emailResult,
    });
  } catch (error) {
    console.error("admin-update-user-status error", error);
    return json(500, { ok: false, error: "internal", detail: String(error) });
  }
});
