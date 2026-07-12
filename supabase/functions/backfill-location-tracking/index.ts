import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import { lookupIpLocation } from "../_shared/tracking.ts";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const LOOKUP_DELAY_MS = 250;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function backfillRegistrations(limit: number) {
  const { data, error } = await supabaseAdmin
    .from("registrations")
    .select("id, registration_ip_address")
    .not("registration_ip_address", "is", null)
    .or("registration_location_status.is.null,registration_location_status.eq.failed,registration_location_status.eq.unavailable")
    .limit(limit);

  if (error) throw error;

  let updated = 0;

  for (const row of (data ?? []) as { id: string; registration_ip_address: string }[]) {
    const location = await lookupIpLocation(row.registration_ip_address);

    const { error: updateError } = await supabaseAdmin
      .from("registrations")
      .update({
        registration_city: location.ip_city,
        registration_region: location.ip_region,
        registration_country: location.ip_country,
        registration_country_code: location.ip_country_code,
        registration_timezone: location.ip_timezone,
        registration_ip_location: location.ip_location,
        registration_location_provider: location.ip_location_provider,
        registration_location_status: location.ip_location_status,
      })
      .eq("id", row.id);

    if (updateError) {
      console.warn("backfill-location-tracking registration update failed", { id: row.id, message: updateError.message });
    } else {
      updated += 1;
    }

    await sleep(LOOKUP_DELAY_MS);
  }

  return { scanned: data?.length ?? 0, updated };
}

async function backfillLogins(limit: number) {
  const { data, error } = await supabaseAdmin
    .from("registrations")
    .select("id, last_login_ip_address")
    .not("last_login_ip_address", "is", null)
    .or("last_login_location_status.is.null,last_login_location_status.eq.failed,last_login_location_status.eq.unavailable")
    .limit(limit);

  if (error) throw error;

  let updated = 0;

  for (const row of (data ?? []) as { id: string; last_login_ip_address: string }[]) {
    const location = await lookupIpLocation(row.last_login_ip_address);

    const { error: updateError } = await supabaseAdmin
      .from("registrations")
      .update({
        last_login_city: location.ip_city,
        last_login_region: location.ip_region,
        last_login_country: location.ip_country,
        last_login_country_code: location.ip_country_code,
        last_login_timezone: location.ip_timezone,
        last_login_ip_location: location.ip_location,
        last_login_location_provider: location.ip_location_provider,
        last_login_location_status: location.ip_location_status,
      })
      .eq("id", row.id);

    if (updateError) {
      console.warn("backfill-location-tracking login update failed", { id: row.id, message: updateError.message });
    } else {
      updated += 1;
    }

    await sleep(LOOKUP_DELAY_MS);
  }

  return { scanned: data?.length ?? 0, updated };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    const adminCheck = await requireAdmin(req, "users:view");
    if (!adminCheck.actor) {
      return json(adminCheck.status, { ok: false, error: adminCheck.error });
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const requestedLimit = Number(body?.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const registrations = await backfillRegistrations(limit);
    const logins = await backfillLogins(limit);

    return json(200, { ok: true, registrations, logins });
  } catch (error) {
    console.error("backfill-location-tracking error", error);
    return json(500, { ok: false, error: "internal", detail: error instanceof Error ? error.message : String(error) });
  }
});
