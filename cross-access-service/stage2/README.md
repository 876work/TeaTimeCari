# Cross-Access Service — Stage 2 (production-shaped, isolated)

Stage 1 proved the revocation worker against dummy data. Stage 2 is the same design
rebuilt in its **production shape**: a real Supabase schema, a scheduled Edge Function,
and a data-parity import — all targeting an **isolated Stage 2 Supabase project**, not
production.

> **Isolation is enforced two ways.** (1) These files live under
> `cross-access-service/stage2/`, so the repo's deploy workflow — which only watches
> the root `supabase/functions/**` and `supabase/migrations/**` — can never pick them
> up. (2) The import script refuses to write to a target matching `PROD_URL_GUARD`.
> Deploying Stage 2 requires you to explicitly link the Supabase CLI to the Stage 2
> project ref. Nothing here can reach production on its own.

## What's here

```
stage2/
  supabase/
    migrations/
      20260716000000_cross_access_core.sql       # tables, enums, indexes, RLS
      20260716000100_revocation_schedule.sql      # pg_cron + pg_net schedule (real project only)
    functions/
      _shared/sso.ts                              # DiscourseConnect signing (Deno/WebCrypto)
      revocation-sweep/index.ts                   # the worker, as an Edge Function
  scripts/
    import-from-production.mjs                     # data parity: prod shape -> Stage 2, IDs preserved
  test/
    schema.test.mjs                                # runs the migration in real Postgres (pglite)
```

## How Stage 1 maps onto Stage 2

| Stage 1 (dummy) | Stage 2 (this) |
| --- | --- |
| `src/store.mjs` JSON file | `cross_access_*` Postgres tables |
| `runRevocationSweep()` in `src/worker.mjs` | `revocation-sweep/index.ts` Edge Function |
| `setInterval` cadence | `pg_cron` `* * * * *` schedule invoking the function via `pg_net` |
| `src/discourseMock.mjs` | real `fetch()` to `{DISCOURSE_BASE_URL}/admin/users/sync_sso` |
| `src/sso.mjs` (Node crypto) | `_shared/sso.ts` (Deno WebCrypto) — **byte-identical signatures** (verified) |
| 409 duplicate-grant guard in `server.mjs` | `cross_access_grants_one_active` partial unique index |
| dummy users in `seed.mjs` | `import-from-production.mjs` (real `registrations`/`payments`, IDs preserved) |

## Verify locally (no Supabase needed)

```bash
cd cross-access-service/stage2
npm install
npm test          # applies the core migration in pglite and exercises the worker's SQL
```

The test proves, against real Postgres: the migration applies, the worker's "due
grants" query selects only expired active rows, the one-active-grant index enforces the
409 guard, and revoking frees a member to be re-granted. (The `pg_cron` schedule
migration isn't exercised in pglite — those extensions are hosted-Supabase only.)

Signature compatibility between the Stage 2 Deno signer and the Discourse-validated
Stage 1 Node signer is verified separately: both produce identical `sso`/`sig` for the
same payload.

## Deploy to the Stage 2 project (never production)

```bash
# 1. Link the CLI to the ISOLATED Stage 2 project (its own ref, not production's)
supabase link --project-ref <STAGE2_PROJECT_REF>

# 2. Apply schema
supabase db push        # runs the two migrations above

# 3. Set function secrets (Stage 2 values — a sandbox Discourse, a Stage 2 SSO secret)
supabase secrets set \
  DISCOURSE_BASE_URL=https://sandbox.your-forum.example \
  DISCOURSE_ADMIN_API_KEY=... \
  DISCOURSE_ADMIN_API_USERNAME=system \
  DISCOURSE_SSO_SECRET=... \
  XACCESS_GROUP=xaccess

# 4. Deploy the worker
supabase functions deploy revocation-sweep

# 5. Store the schedule secrets in Vault, then run 20260716000100 (see its comments)
```

## Data parity (Stage 2 of the brief)

`import-from-production.mjs` reads production **read-only** and writes into the Stage 2
project, **preserving `external_id`** — mandatory, because that id is the permanent
DiscourseConnect key (see the main app's `docs/discourse-sso-identity.md`). Regenerating
it would break every existing member's forum link.

```bash
# Dry run first — prints counts and samples, writes nothing:
SOURCE_SUPABASE_URL=https://<prod-ref>.supabase.co SOURCE_SERVICE_ROLE_KEY=... \
TARGET_SUPABASE_URL=https://<stage2-ref>.supabase.co TARGET_SERVICE_ROLE_KEY=... \
PROD_URL_GUARD=https://<prod-ref>.supabase.co \
npm run import:dry

# When the counts look right, add --commit (npm run import:commit).
```

It maps approved `registrations` → `cross_access_members` and unexpired `opposite`
`payments` → active `cross_access_grants`, and is idempotent (member upsert on the
preserved id), so it can be re-run to catch up new signups before cutover.

## Zero-downtime cutover (Stage 3 of the brief)

DiscourseConnect is stateless per request (sign → verify → redirect), so there is no
session to migrate. The cutover is an endpoint swap:

1. Run the import (`--commit`) to bring Stage 2 to parity, then re-run it close to
   cutover to catch late signups.
2. Point the SSO endpoints Discourse already calls (`/sso`, `/sso-complete`) at the
   Stage 2 backend via env/feature-flag swap. Discourse itself needs no reconfig if the
   endpoint URL is unchanged.
3. The next SSO round-trip after the swap uses Stage 2. Rollback is the same swap in
   reverse — keep Stage 1/production warm and read-only for a defined window.

## Deliberately out of scope for Stage 2

- No connection to production from CI or from any file here (isolation, above).
- No Stripe wiring (still paused) — the storefront checkout Edge Function that a real
  `payment_intent.succeeded` webhook would call is left for when Stripe resumes; its
  post-payment effect is already the `createGrant`/`verified` write shape from Stage 1.
- The live `expires_at > now()` SSO-path backstop the brief recommends is a change to
  the real `sso.ts` login path and stays out of this isolated service by design.
