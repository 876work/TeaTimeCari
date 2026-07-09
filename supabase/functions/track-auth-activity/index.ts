import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { collectTrackingMetadata } from "../_shared/tracking.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

type ActivityEvent = "login" | "heartbeat";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isSchemaCacheColumnError(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() || "";
  return (
    error?.code === "PGRST204" ||
    (message.includes("schema cache") && message.includes("could not find"))
  );
}

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const token = getBearerToken(req);
    if (!token) return json(401, { error: "Unauthorized" });

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json(401, { error: "Unauthorized" });

    const body = await req.json().catch(() => ({}));
    const event: ActivityEvent = body?.event === "login" ? "login" : "heartbeat";
    const now = new Date().toISOString();

    const update: Record<string, string | null> = { last_seen_at: now };

    if (event === "login") {
      const tracking = await collectTrackingMetadata(req);
      update.last_login_at = now;
      update.last_login_ip_address = tracking.ip_address;
      update.last_login_ip_header = tracking.ip_header;
      update.last_login_ip_location = tracking.ip_location;
      update.last_login_city = tracking.ip_city;
      update.last_login_region = tracking.ip_region;
      update.last_login_country = tracking.ip_country;
      update.last_login_country_code = tracking.ip_country_code;
      update.last_login_timezone = tracking.ip_timezone;
      update.last_login_location_provider = tracking.ip_location_provider;
      update.last_login_location_status = tracking.ip_location_status;
      update.last_login_browser = tracking.browser;
      update.last_login_device = tracking.device;
      update.last_login_operating_system = tracking.operating_system;
      update.last_login_user_agent = tracking.user_agent;
    }

    const { error: updateError } = await admin
      .from("registrations")
      .update(update)
      .eq("id", authData.user.id);

    if (updateError) {
      if (isSchemaCacheColumnError(updateError)) {
        console.warn(
          "registrations tracking columns are unavailable; skipping best-effort auth activity update",
          updateError,
        );
        return json(200, { ok: true, event, last_seen_at: now, trackingPersisted: false });
      }

      return json(500, { error: "tracking update failed", detail: updateError.message });
    }

    return json(200, { ok: true, event, last_seen_at: now, trackingPersisted: true });
  } catch (error) {
    return json(500, { error: "internal", detail: String(error) });
  }
});
