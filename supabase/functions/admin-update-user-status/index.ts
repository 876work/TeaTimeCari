import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { sendSuspensionEmail, sendUnsuspensionEmail } from "../_shared/resendEmail.ts";

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

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function isSchemaCacheColumnError(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() || "";
  return (
    error?.code === "PGRST204" ||
    error?.code === "42703" ||
    (message.includes("schema cache") && message.includes("could not find")) ||
    (message.includes("column") && message.includes("does not exist"))
  );
}

async function isAdmin(userId: string, email?: string | null) {
  const adminEmailFallback = email?.toLowerCase().includes("admin") ?? false;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01" || isSchemaCacheColumnError(error)) return adminEmailFallback;
    throw error;
  }

  return Boolean(data?.is_admin) || adminEmailFallback;
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
    const token = getBearerToken(req);
    if (!token) return json(401, { ok: false, error: "Unauthorized" });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) return json(401, { ok: false, error: "Unauthorized" });
    if (!(await isAdmin(authData.user.id, authData.user.email))) {
      return json(403, { ok: false, error: "Forbidden: admin only" });
    }

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
