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
| `POST` | `/api/grants` | Create a grant `{ external_id, durationKey }` |
| `POST` | `/api/grants/:id/revoke` | Manual "revoke now" |
| `GET` | `/api/worker/log` | Revocation audit log |
| `POST` | `/api/worker/run` | Trigger a sweep on demand |

## Not in scope for Stage 1 (by design)

- No real Supabase or Discourse connection, and no production secrets.
- No Stripe wiring — grants are created directly (a real Stripe webhook would call
  `POST /api/grants` after `payment_intent.succeeded`).
- No change to the live SSO Edge Functions or the React app.
