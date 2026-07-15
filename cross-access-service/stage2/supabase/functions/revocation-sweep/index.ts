// Cross-Access Service · Stage 2 — revocation-sweep Edge Function
//
// TARGET: the ISOLATED Stage 2 Supabase project only.
//
// This is the production-shaped port of runRevocationSweep() from the Stage 1
// worker (cross-access-service/src/worker.mjs). pg_cron invokes it once a minute
// (see 20260716000100_revocation_schedule.sql). It:
//
//   1. SELECTs active grants whose expires_at has passed
//   2. for each, POSTs a signed remove_groups=xaccess payload to Discourse's
//      /admin/users/sync_sso admin route
//   3. on success, marks the grant revoked; on failure, leaves it active so the
//      next sweep retries (at-least-once)
//   4. writes an audit row for every action
//
// The SELECT/UPDATE are the same operations the Stage 1 JSON worker performs; only
// the storage (Postgres instead of a JSON file) and the Discourse target (a real
// sandbox forum instead of the in-process mock) change.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signSsoPayload, buildRevocationPayload } from "../_shared/sso.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DISCOURSE_BASE_URL = Deno.env.get("DISCOURSE_BASE_URL")!;
const DISCOURSE_API_KEY = Deno.env.get("DISCOURSE_ADMIN_API_KEY")!;
const DISCOURSE_API_USERNAME = Deno.env.get("DISCOURSE_ADMIN_API_USERNAME") || "system";
const DISCOURSE_SSO_SECRET = Deno.env.get("DISCOURSE_SSO_SECRET")!;
const XACCESS_GROUP = Deno.env.get("XACCESS_GROUP") || "xaccess";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface Grant {
  id: string;
  user_external_id: string;
  username: string;
  retry_count: number;
}

/** POST a signed remove_groups payload to Discourse's admin sync route. */
async function syncRemoveGroups(grant: Grant, email: string) {
  const payload = buildRevocationPayload({
    externalId: grant.user_external_id,
    username: grant.username,
    email,
    xaccessGroup: XACCESS_GROUP,
  });
  const { b64, sig } = await signSsoPayload(payload, DISCOURSE_SSO_SECRET);

  const url = `${DISCOURSE_BASE_URL.replace(/\/+$/, "")}/admin/users/sync_sso`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Api-Key": DISCOURSE_API_KEY,
      "Api-Username": DISCOURSE_API_USERNAME,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `sso=${encodeURIComponent(b64)}&sig=${sig}`,
  });

  return { ok: res.ok, status: res.status, error: res.ok ? undefined : await res.text() };
}

async function log(entry: Record<string, unknown>) {
  await admin.from("cross_access_log").insert(entry);
}

async function runRevocationSweep() {
  const nowIso = new Date().toISOString();

  const { data: due, error } = await admin
    .from("cross_access_grants")
    .select("id, user_external_id, username, retry_count")
    .eq("status", "active")
    .lte("expires_at", nowIso);

  if (error) throw new Error(`select due grants failed: ${error.message}`);

  let revoked = 0;
  let failed = 0;

  for (const grant of (due ?? []) as Grant[]) {
    // Look up the member email for the DiscourseConnect payload.
    const { data: member } = await admin
      .from("cross_access_members")
      .select("email")
      .eq("external_id", grant.user_external_id)
      .maybeSingle();

    const email = member?.email ?? `${grant.username}@stage2.local`;
    const res = await syncRemoveGroups(grant, email);

    if (res.ok) {
      await admin
        .from("cross_access_grants")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
          revocation_synced: true,
          revoke_reason: "expired",
        })
        .eq("id", grant.id);
      revoked++;
      await log({
        level: "success",
        action: "revoke_synced",
        grant_id: grant.id,
        user_external_id: grant.user_external_id,
        username: grant.username,
        message: `Removed '${XACCESS_GROUP}' from ${grant.username} — grant expired`,
        discourse_status: res.status,
        removed_groups: XACCESS_GROUP,
      });
    } else {
      // Leave active for the next sweep to retry (at-least-once delivery).
      await admin
        .from("cross_access_grants")
        .update({ retry_count: grant.retry_count + 1, last_error: res.error })
        .eq("id", grant.id);
      failed++;
      await log({
        level: "error",
        action: "revoke_failed",
        grant_id: grant.id,
        user_external_id: grant.user_external_id,
        username: grant.username,
        message: `Discourse sync failed for ${grant.username} (attempt ${grant.retry_count + 1}) — will retry next sweep`,
        discourse_status: res.status,
        error: res.error,
      });
    }
  }

  return { scanned: due?.length ?? 0, revoked, failed };
}

Deno.serve(async (req) => {
  // Invoked by pg_cron with the service-role bearer token; reject anything else.
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const result = await runRevocationSweep();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[revocation-sweep]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
