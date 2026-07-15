// Seed the Stage 1 store with dummy users and cross-access grants.
//
// Grants are spread across the lifecycle on purpose so the dashboard shows
// something interesting the moment it loads:
//   - a couple already expired (the worker will revoke them on first sweep)
//   - one expiring in seconds (watch it flip live)
//   - some healthy active grants with real countdowns
//   - a couple already revoked (history)
//
// Run:  npm run seed        (only seeds if the store is empty)
//       npm run reset       (wipes and reseeds)

import crypto from "node:crypto";
import { load, reset, db, save } from "./store.mjs";

const now = Date.now();
const mins = (n) => n * 60 * 1000;
const hrs = (n) => n * 60 * 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();

// Dummy roster. external_id mirrors the production contract: it is the permanent
// Supabase registration id sent to DiscourseConnect. These are throwaway UUIDs.
const users = [
  { external_id: crypto.randomUUID(), username: "sandy_w",    email: "sandy@stage1.local",    gender: "women" },
  { external_id: crypto.randomUUID(), username: "wang_yibo",  email: "yibo@stage1.local",     gender: "men"   },
  { external_id: crypto.randomUUID(), username: "x_gamer",    email: "xgamer@stage1.local",   gender: "men"   },
  { external_id: crypto.randomUUID(), username: "arina_k",    email: "arina@stage1.local",    gender: "women" },
  { external_id: crypto.randomUUID(), username: "mark_kyle",  email: "mark@stage1.local",     gender: "men"   },
  { external_id: crypto.randomUUID(), username: "nina_r",     email: "nina@stage1.local",     gender: "women" },
  { external_id: crypto.randomUUID(), username: "ron_21",     email: "ron@stage1.local",      gender: "men"   },
  { external_id: crypto.randomUUID(), username: "savannah_w", email: "savannah@stage1.local", gender: "women" },
];

const U = Object.fromEntries(users.map((u) => [u.username, u]));

function grant({ user, source, grantedMsAgo, durationMs, status = "active", revokedMsAgo }) {
  const granted_at = now - grantedMsAgo;
  return {
    id: crypto.randomUUID(),
    user_external_id: user.external_id,
    username: user.username,
    base_gender: user.gender,
    source,
    granted_at: iso(granted_at),
    expires_at: iso(granted_at + durationMs),
    status,
    revoked_at: revokedMsAgo != null ? iso(now - revokedMsAgo) : null,
    revocation_synced: status === "revoked",
    revoke_reason: status === "revoked" ? "expired" : null,
    retry_count: 0,
  };
}

const grants = [
  // Already past expiry — first sweep should revoke these:
  grant({ user: U.ron_21,    source: "stripe_24h",     grantedMsAgo: hrs(25),  durationMs: hrs(24) }),
  grant({ user: U.arina_k,   source: "stripe_3day",    grantedMsAgo: hrs(73),  durationMs: hrs(72) }),

  // Expiring within seconds — watch it flip live:
  grant({ user: U.mark_kyle, source: "stripe_24h",     grantedMsAgo: hrs(24) - mins(0.4), durationMs: hrs(24) }),

  // Healthy active grants:
  grant({ user: U.sandy_w,   source: "stripe_monthly", grantedMsAgo: hrs(2),   durationMs: hrs(24 * 30) }),
  grant({ user: U.wang_yibo, source: "stripe_3day",    grantedMsAgo: hrs(10),  durationMs: hrs(72) }),
  grant({ user: U.nina_r,    source: "admin_comp",     grantedMsAgo: mins(20), durationMs: hrs(48) }),

  // History — already revoked:
  grant({ user: U.x_gamer,   source: "stripe_24h",  grantedMsAgo: hrs(50), durationMs: hrs(24), status: "revoked", revokedMsAgo: hrs(26) }),
  grant({ user: U.savannah_w,source: "stripe_3day", grantedMsAgo: hrs(96), durationMs: hrs(72), status: "revoked", revokedMsAgo: hrs(24) }),
];

const seed = {
  users,
  grants,
  log: [
    {
      id: crypto.randomUUID(),
      created_at: iso(now - hrs(24)),
      level: "success",
      action: "revoke_synced",
      username: "savannah_w",
      message: "Removed 'xaccess' from savannah_w — grant expired",
      discourse_status: 200,
    },
    {
      id: crypto.randomUUID(),
      created_at: iso(now - hrs(26)),
      level: "success",
      action: "revoke_synced",
      username: "x_gamer",
      message: "Removed 'xaccess' from x_gamer — grant expired",
      discourse_status: 200,
    },
  ],
  meta: { lastSweepAt: null, sweeps: 0 },
};

const force = process.argv.includes("--force");
load();
const existing = db();
if (force || existing.grants.length === 0) {
  reset(seed);
  console.log(`[seed] wrote ${users.length} users and ${grants.length} grants${force ? " (forced reset)" : ""}.`);
} else {
  console.log(`[seed] store already has ${existing.grants.length} grants; skipping. Use 'npm run reset' to overwrite.`);
}
save();
