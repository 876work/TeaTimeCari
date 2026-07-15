# Cross-Access Service — Stage 1 (dummy data)

An **isolated** staging service that implements the timed cross-access flow for Tea
Time Cari: a member pays for temporary access to the opposite-gender Discourse
community (the `xaccess` group), and that access is **automatically revoked when it
expires** by a scheduled worker.

> **This service touches no production code, data, or credentials.** It lives in its
> own directory, runs on its own port, stores dummy data in a local JSON file, and
> talks to an in-process **mock** Discourse. Nothing here is wired to the live app.

It implements **Option A** from the research brief: a *scheduled revocation worker*
as the source of truth for ending a grant, because DiscourseConnect's `add_groups`
only ever adds — ending a timed grant requires an explicit `remove_groups` sync,
which is what this worker sends.

## Run it

```bash
cd cross-access-service
npm install
npm run seed      # load dummy users + grants (spread across the lifecycle)
npm start         # dashboard at http://localhost:4300
```

Then open **http://localhost:4300**. To watch the worker live:

1. In **Grant cross-access**, pick a member and **Demo — 30 seconds**, click *Grant access*.
2. Watch the countdown in the **Grants** table tick down.
3. When it hits zero, the next sweep flips it to **Revoked** and a `sync_sso → 200`
   line appears in **Worker activity**. You can also click **Run sweep now**.

`npm run reset` wipes and reseeds the dummy store.

## What each piece maps to in production (Stage 2+)

| Stage 1 (here) | Stage 2+ (real) |
| --- | --- |
| `src/store.mjs` JSON file | Supabase Postgres tables (`cross_access_grants`, `revocation_log`) |
| `runRevocationSweep()` in `src/worker.mjs` | A Supabase **scheduled Edge Function** invoked by `pg_cron` |
| `setInterval` cadence | `pg_cron` schedule (e.g. `*/1 * * * *`) |
| `src/discourseMock.mjs` | A real `fetch()` to `{DISCOURSE_BASE_URL}/admin/users/sync_sso` |
| `src/sso.mjs` (Node crypto) | `supabase/functions/_shared/sso.ts` (Deno WebCrypto) — **same wire format** |
| Dummy users in `seed.mjs` | Real `registrations` / `profiles` rows (IDs preserved as `external_id`) |

The signing in `src/sso.mjs` is intentionally **byte-compatible** with the production
`_shared/sso.ts` helper: `sig = hex(HMAC_SHA256(base64(querystring(payload)), secret))`.
The mock Discourse re-verifies that signature exactly as a real Discourse would, so
the signed `remove_groups` payloads produced here are already Stage-2 ready.

## Design of the sweep (why it's safe)

- **Idempotent / at-least-once.** A failed Discourse sync leaves the grant `active`
  so the next sweep retries it (`retry_count` increments). A succeeded sync marks the
  grant `revoked` so it is never double-processed.
- **Auditable.** Every action (grant, auto-revoke, manual revoke, failure) is written
  to `revocation_log` and shown in *Worker activity*.
- **Backstop-friendly.** The research brief recommends pairing this worker (source of
  truth) with a live `expires_at > now()` check inside the SSO login path so a slow
  sweep never leaves a stale grant active past the member's next login. That SSO-path
  check is a Stage 2 change to the real `sso.ts` and is intentionally **not** made here.

## API (for reference)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/summary` | Tiles + worker status |
| `GET` | `/api/grants` | All grants + user roster |
| `POST` | `/api/grants` | Admin quick-grant `{ external_id, durationKey }` |
| `POST` | `/api/grants/:id/revoke` | Manual "revoke now" |
| `GET` | `/api/worker/log` | Revocation + purchase audit log |
| `POST` | `/api/worker/run` | Trigger a sweep on demand |
| `GET` | `/api/tiers?external_id=` | Cross-access + Verified+ catalog, priced for that member |
| `POST` | `/api/checkout/cross-access` | Simulated purchase `{ external_id, tierId }` |
| `POST` | `/api/checkout/verified-plus` | Simulated Verified+ upgrade `{ external_id }` |

## Monetization surfaces (research brief §6)

Two ideas from the brief, built on top of the Stage 1 worker:

**Tiered cross-access** — `/storefront.html` sells three passes (`24-Hour Peek`,
`3-Day Pass`, `Monthly All-Access`) defined in `src/tiers.mjs`. Every tier calls the
same `createGrant()` helper as the admin panel, so a storefront purchase and an
admin comp look identical in the Grants table (distinguished only by a `buy` chip)
and are revoked by the exact same scheduled worker — no separate code path to expire.

**Verified+ badge** — reuses the KYC identity check that already exists in
production (face-api.js selfie verification) as the *base* trust signal, and sells a
one-time gold-badge upgrade on top of it (`POST /api/checkout/verified-plus`). Owning
Verified+ also knocks 15% off every cross-access tier (`VERIFIED_PLUS_DISCOUNT` in
`src/tiers.mjs`) — a concrete example of the brief's point that these features should
share one mechanism rather than growing in isolation.

**Checkout is simulated, on purpose.** Stripe wiring is paused for this build. Both
checkout endpoints complete a dummy transaction synchronously instead of creating a
real PaymentIntent. When Stripe work resumes, only the *front half* changes (a real
Stripe Elements form + webhook instead of an instant POST) — `createGrant()` and the
`user.verified = "plus"` write are already the right shape for a
`payment_intent.succeeded` handler to call into.

## Not in scope for Stage 1 (by design)

- No real Supabase or Discourse connection, and no production secrets.
- No real Stripe integration (explicitly paused) — see "Checkout is simulated" above.
- No change to the live SSO Edge Functions or the React app.
