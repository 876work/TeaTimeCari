// Scheduled cross-access revocation worker (research brief §4, Option A).
//
// runRevocationSweep() is written as a pure-ish function of (db, now, deps) so it
// maps 1:1 onto a Supabase scheduled Edge Function in Stage 2+:
//
//   pg_cron ('*/1 * * * *')  ->  invokes the Edge Function
//   Edge Function            ->  SELECT ... FROM cross_access_grants
//                                WHERE status='active' AND expires_at <= now()
//                            ->  for each: POST /admin/users/sync_sso remove_groups=xaccess
//                            ->  UPDATE grant SET status='revoked'
//
// Here the SELECT/UPDATE hit the JSON store and the POST hits the mock Discourse,
// but the shape and ordering of operations are the production shape.

import { db, save, appendLog } from "./store.mjs";
import { signSsoPayload, buildRevocationPayload } from "./sso.mjs";
import { mockDiscourseSyncSso } from "./discourseMock.mjs";
import { config } from "./config.mjs";

/**
 * Find active grants whose window has closed and revoke them in Discourse.
 * @param {Date} now
 * @returns {Promise<{scanned:number, revoked:number, failed:number, ids:string[]}>}
 */
export async function runRevocationSweep(now = new Date()) {
  const state = db();
  const nowMs = now.getTime();

  const due = state.grants.filter(
    (g) => g.status === "active" && new Date(g.expires_at).getTime() <= nowMs,
  );

  let revoked = 0;
  let failed = 0;
  const ids = [];

  for (const grant of due) {
    const user = state.users.find((u) => u.external_id === grant.user_external_id);
    const payload = buildRevocationPayload({
      externalId: grant.user_external_id,
      username: grant.username,
      email: user?.email,
      xaccessGroup: config.xaccessGroup,
    });

    const { b64, sig } = signSsoPayload(payload, config.ssoSecret);
    const res = await mockDiscourseSyncSso({ b64, sig });

    if (res.ok) {
      grant.status = "revoked";
      grant.revoked_at = new Date().toISOString();
      grant.revocation_synced = true;
      grant.revoke_reason = "expired";
      grant.retry_count = grant.retry_count || 0;
      revoked++;
      ids.push(grant.id);
      appendLog({
        level: "success",
        action: "revoke_synced",
        grant_id: grant.id,
        user_external_id: grant.user_external_id,
        username: grant.username,
        message: `Removed '${config.xaccessGroup}' from ${grant.username} — grant expired`,
        discourse_status: res.status,
        removed_groups: res.applied?.removed_groups,
      });
    } else {
      // Leave the grant active so the next sweep retries it (at-least-once delivery).
      grant.retry_count = (grant.retry_count || 0) + 1;
      grant.last_error = res.error;
      failed++;
      appendLog({
        level: "error",
        action: "revoke_failed",
        grant_id: grant.id,
        user_external_id: grant.user_external_id,
        username: grant.username,
        message: `Discourse sync failed for ${grant.username} (attempt ${grant.retry_count}) — will retry next sweep`,
        discourse_status: res.status,
        error: res.error,
      });
    }
  }

  state.meta.lastSweepAt = new Date().toISOString();
  state.meta.sweeps = (state.meta.sweeps || 0) + 1;
  state.meta.lastResult = { scanned: due.length, revoked, failed };
  save();

  return { scanned: due.length, revoked, failed, ids };
}

/**
 * Manually revoke a single grant immediately (admin "Revoke now" button).
 * Same Discourse sync path as the scheduled sweep.
 */
export async function revokeGrantNow(grantId, reason = "admin_manual") {
  const state = db();
  const grant = state.grants.find((g) => g.id === grantId);
  if (!grant) return { ok: false, error: "grant not found" };
  if (grant.status !== "active") return { ok: false, error: `grant is already ${grant.status}` };

  const user = state.users.find((u) => u.external_id === grant.user_external_id);
  const payload = buildRevocationPayload({
    externalId: grant.user_external_id,
    username: grant.username,
    email: user?.email,
    xaccessGroup: config.xaccessGroup,
  });
  const { b64, sig } = signSsoPayload(payload, config.ssoSecret);
  const res = await mockDiscourseSyncSso({ b64, sig });

  if (!res.ok) {
    appendLog({
      level: "error",
      action: "revoke_failed",
      grant_id: grant.id,
      user_external_id: grant.user_external_id,
      username: grant.username,
      message: `Manual revoke failed for ${grant.username}`,
      error: res.error,
    });
    save();
    return { ok: false, error: res.error };
  }

  grant.status = "revoked";
  grant.revoked_at = new Date().toISOString();
  grant.revocation_synced = true;
  grant.revoke_reason = reason;
  appendLog({
    level: "success",
    action: "revoke_synced",
    grant_id: grant.id,
    user_external_id: grant.user_external_id,
    username: grant.username,
    message: `Manually revoked '${config.xaccessGroup}' from ${grant.username}`,
    discourse_status: res.status,
    removed_groups: res.applied?.removed_groups,
  });
  save();
  return { ok: true };
}

let timer = null;

/** Start the recurring sweep. Also runs once immediately on boot. */
export function startWorker() {
  if (timer) return;
  const tick = async () => {
    try {
      await runRevocationSweep(new Date());
    } catch (err) {
      console.error("[worker] sweep error:", err);
    }
  };
  tick();
  timer = setInterval(tick, config.workerIntervalMs);
  console.log(`[worker] revocation sweep running every ${config.workerIntervalMs}ms`);
}

export function stopWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
