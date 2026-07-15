// Stage 1 cross-access service — API + static admin dashboard.
// Isolated demo: dummy data, in-process mock Discourse, no production access.

import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.mjs";
import { load, db, save, appendLog } from "./store.mjs";
import { runRevocationSweep, revokeGrantNow, startWorker } from "./worker.mjs";
import { CROSS_ACCESS_TIERS, VERIFIED_PLUS_PRODUCT, priceForTier, findTier, formatUsd } from "./tiers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

load();
if (db().grants.length === 0) {
  console.log("[server] store is empty — run `npm run seed` for demo data.");
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const DURATIONS = {
  demo_30s: { ms: 30 * 1000, label: "Demo — 30 seconds", source: "demo" },
  pass_24h: { ms: 24 * 60 * 60 * 1000, label: "24-hour peek", source: "stripe_24h" },
  pass_3day: { ms: 72 * 60 * 60 * 1000, label: "3-day pass", source: "stripe_3day" },
  sub_monthly: { ms: 30 * 24 * 60 * 60 * 1000, label: "Monthly all-access", source: "stripe_monthly" },
  comp: { ms: 48 * 60 * 60 * 1000, label: "Admin comp (48h)", source: "admin_comp" },
};

function summarize() {
  const state = db();
  const now = Date.now();
  const active = state.grants.filter((g) => g.status === "active");
  const expiringSoon = active.filter((g) => new Date(g.expires_at).getTime() - now < 60 * 60 * 1000);
  const overdue = active.filter((g) => new Date(g.expires_at).getTime() <= now);
  const revokedToday = state.grants.filter(
    (g) => g.status === "revoked" && g.revoked_at && now - new Date(g.revoked_at).getTime() < 24 * 60 * 60 * 1000,
  );
  const verifiedPlusCount = state.users.filter((u) => u.verified === "plus").length;
  return {
    activeCount: active.length,
    expiringSoonCount: expiringSoon.length,
    overdueCount: overdue.length,
    revokedTodayCount: revokedToday.length,
    totalUsers: state.users.length,
    verifiedPlusCount,
    worker: {
      intervalMs: config.workerIntervalMs,
      lastSweepAt: state.meta.lastSweepAt,
      sweeps: state.meta.sweeps || 0,
      lastResult: state.meta.lastResult || null,
      xaccessGroup: config.xaccessGroup,
      discourseTarget: config.discourseBaseUrl || "mock (in-process)",
      stage: config.stage,
    },
  };
}

app.get("/api/summary", (_req, res) => res.json(summarize()));

app.get("/api/grants", (_req, res) => {
  const order = { active: 0, revoked: 1, expired: 2 };
  const grants = [...db().grants].sort((a, b) => {
    const s = (order[a.status] ?? 9) - (order[b.status] ?? 9);
    if (s !== 0) return s;
    return new Date(a.expires_at) - new Date(b.expires_at);
  });
  res.json({ grants, users: db().users });
});

/**
 * Shared grant creation used by both the admin quick-grant panel and the
 * storefront checkout — same record shape either way, distinguished only by
 * `checkout_source` and, for paid tiers, a `paid_cents` figure for the log.
 */
function createGrant(state, { user, source, durationMs, label, checkoutSource, paidCents }) {
  const existing = state.grants.find((g) => g.user_external_id === user.external_id && g.status === "active");
  if (existing) return { error: `${user.username} already has an active grant`, status: 409 };

  const grantedAt = Date.now();
  const grant = {
    id: crypto.randomUUID(),
    user_external_id: user.external_id,
    username: user.username,
    base_gender: user.gender,
    source,
    checkout_source: checkoutSource,
    granted_at: new Date(grantedAt).toISOString(),
    expires_at: new Date(grantedAt + durationMs).toISOString(),
    status: "active",
    revoked_at: null,
    revocation_synced: false,
    revoke_reason: null,
    retry_count: 0,
  };
  state.grants.push(grant);

  const priceNote = paidCents != null ? ` — ${formatUsd(paidCents)} (simulated checkout)` : "";
  appendLog({
    level: "info",
    action: checkoutSource === "storefront" ? "checkout_grant" : "grant_created",
    grant_id: grant.id,
    user_external_id: user.external_id,
    username: user.username,
    message: `Granted '${config.xaccessGroup}' to ${user.username} — ${label}${priceNote}`,
  });
  return { grant };
}

app.post("/api/grants", (req, res) => {
  const { external_id, durationKey } = req.body || {};
  const duration = DURATIONS[durationKey];
  if (!duration) return res.status(400).json({ error: "unknown durationKey" });

  const state = db();
  const user = state.users.find((u) => u.external_id === external_id);
  if (!user) return res.status(404).json({ error: "user not found" });

  const result = createGrant(state, {
    user,
    source: duration.source,
    durationMs: duration.ms,
    label: duration.label,
    checkoutSource: "admin",
  });
  if (result.error) return res.status(result.status).json({ error: result.error });
  save();
  res.status(201).json({ grant: result.grant });
});

app.post("/api/grants/:id/revoke", async (req, res) => {
  const result = await revokeGrantNow(req.params.id, "admin_manual");
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

app.get("/api/worker/log", (_req, res) => res.json({ log: db().log }));

app.post("/api/worker/run", async (_req, res) => {
  const result = await runRevocationSweep(new Date());
  res.json(result);
});

app.get("/api/durations", (_req, res) =>
  res.json(Object.entries(DURATIONS).map(([key, v]) => ({ key, label: v.label }))),
);

/* ---------- Storefront: tiered cross-access + Verified+ (research brief §6) ---------- */
/*
 * Stripe is intentionally paused (per product decision) — these endpoints simulate a
 * successful payment_intent.succeeded synchronously instead of taking a card. When
 * Stripe wiring resumes, swap the "simulated" branch below for a real PaymentIntent +
 * webhook: the shape of what happens *after* payment succeeds (createGrant / set
 * user.verified) does not need to change.
 */

app.get("/api/tiers", (req, res) => {
  const state = db();
  const user = state.users.find((u) => u.external_id === req.query.external_id) || null;
  const activeGrant = user ? state.grants.find((g) => g.user_external_id === user.external_id && g.status === "active") : null;

  const tiers = CROSS_ACCESS_TIERS.map((t) => {
    const price = priceForTier(t, user);
    return {
      id: t.id,
      label: t.label,
      tagline: t.tagline,
      featured: !!t.featured,
      durationMs: t.durationMs,
      priceCents: price.cents,
      originalCents: price.originalCents,
      discounted: price.discounted,
      priceLabel: formatUsd(price.cents),
      originalLabel: formatUsd(price.originalCents),
    };
  });

  res.json({
    tiers,
    verifiedPlus: {
      ...VERIFIED_PLUS_PRODUCT,
      priceLabel: formatUsd(VERIFIED_PLUS_PRODUCT.priceCents),
      owned: user?.verified === "plus",
    },
    blockedByActiveGrant: !!activeGrant,
  });
});

app.post("/api/checkout/cross-access", (req, res) => {
  const { external_id, tierId } = req.body || {};
  const tier = findTier(tierId);
  if (!tier) return res.status(400).json({ error: "unknown tierId" });

  const state = db();
  const user = state.users.find((u) => u.external_id === external_id);
  if (!user) return res.status(404).json({ error: "user not found" });

  const price = priceForTier(tier, user);
  const result = createGrant(state, {
    user,
    source: tier.source,
    durationMs: tier.durationMs,
    label: tier.label,
    checkoutSource: "storefront",
    paidCents: price.cents,
  });
  if (result.error) return res.status(result.status).json({ error: result.error });
  save();
  res.status(201).json({ grant: result.grant, paidCents: price.cents, discounted: price.discounted });
});

app.post("/api/checkout/verified-plus", (req, res) => {
  const { external_id } = req.body || {};
  const state = db();
  const user = state.users.find((u) => u.external_id === external_id);
  if (!user) return res.status(404).json({ error: "user not found" });
  if (user.verified === "plus") return res.status(409).json({ error: `${user.username} already has Verified+` });

  user.verified = "plus";
  user.verified_plus_since = new Date().toISOString();
  appendLog({
    level: "success",
    action: "verified_plus_purchased",
    user_external_id: user.external_id,
    username: user.username,
    message: `${user.username} upgraded to Verified+ — ${formatUsd(VERIFIED_PLUS_PRODUCT.priceCents)} (simulated checkout)`,
  });
  save();
  res.status(201).json({ user });
});

app.listen(config.port, () => {
  console.log(`\n  Cross-Access Service · Stage 1 (dummy data)`);
  console.log(`  Dashboard:  http://localhost:${config.port}`);
  console.log(`  Discourse:  ${config.discourseBaseUrl || "mock (in-process)"}\n`);
  startWorker();
});
