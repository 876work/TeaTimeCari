import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { collectTrackingMetadata } from "../_shared/tracking.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

type ActivityEvent = "login" | "heartbeat";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function requestId(req: Request) { return req.headers.get("x-request-id") || crypto.randomUUID(); }
function isSchemaCacheColumnError(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() || "";
  return error?.code === "PGRST204" || (message.includes("schema cache") && message.includes("could not find"));
}
function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}
function failure(status: number, errorCode: string, message: string, recordedAt: string, rid: string) {
  return json(status, { success: false, ok: false, errorCode, message, recordedAt, requestId: rid });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const rid = requestId(req);
  const recordedAt = new Date().toISOString();
  if (req.method !== "POST") return failure(405, "METHOD_NOT_ALLOWED", "Method not allowed.", recordedAt, rid);

  try {
    const token = getBearerToken(req);
    if (!token) {
      console.warn("track-auth-activity missing authorization", { requestId: rid });
      return failure(401, "MISSING_AUTHENTICATION", "Authentication is required.", recordedAt, rid);
    }

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) {
      console.warn("track-auth-activity invalid authentication", { requestId: rid, authError: authError?.message });
      return failure(401, "INVALID_AUTHENTICATION", "Authentication is invalid or expired.", recordedAt, rid);
    }

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

    const { data, error: updateError } = await admin.from("registrations").update(update).eq("id", authData.user.id).select("id,email,last_seen_at").maybeSingle();
    if (updateError) {
      if (isSchemaCacheColumnError(updateError)) {
        console.warn("track-auth-activity tracking columns unavailable", { requestId: rid, userId: authData.user.id, code: updateError.code });
        return failure(500, "ACTIVITY_SCHEMA_UNAVAILABLE", "Unable to update app activity.", now, rid);
      }
      console.error("track-auth-activity database update failed", { requestId: rid, userId: authData.user.id, code: updateError.code, message: updateError.message });
      return failure(500, "ACTIVITY_UPDATE_FAILED", "Unable to update app activity.", now, rid);
    }
    if (!data) {
      console.warn("track-auth-activity registration not found", { requestId: rid, userId: authData.user.id });
      return failure(404, "REGISTRATION_NOT_FOUND", "Registration record was not found.", now, rid);
    }

    console.info("track-auth-activity heartbeat recorded", { requestId: rid, userId: authData.user.id, event });
    return json(200, { success: true, ok: true, userId: data.id, email: data.email ?? null, event, lastSeenAt: data.last_seen_at ?? now, last_seen_at: data.last_seen_at ?? now, recordedAt: now, source: "react_app" });
  } catch (error) {
    console.error("track-auth-activity unexpected error", { requestId: rid, message: error instanceof Error ? error.message : String(error) });
    return failure(500, "UNEXPECTED_ERROR", "Unable to update app activity.", new Date().toISOString(), rid);
  }
});
