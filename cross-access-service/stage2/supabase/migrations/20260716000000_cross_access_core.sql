-- Cross-Access Service · Stage 2 — core schema
--
-- TARGET: the ISOLATED Stage 2 Supabase project, NOT production.
-- This file lives under cross-access-service/stage2/ specifically so the root
-- deploy workflow (which only watches root supabase/migrations/**) can never
-- pick it up. Deploy it by linking the Supabase CLI to the Stage 2 project ref.
--
-- These tables are the production-shaped equivalents of the Stage 1 JSON store:
--   cross_access_members  <- store.users        (imported from registrations/profiles)
--   cross_access_grants   <- store.grants        (source of truth for timed access)
--   cross_access_log      <- store.log           (audit trail)

-- gen_random_uuid() is core Postgres since 13 (Supabase runs 15+), so no
-- pgcrypto extension is required.

do $$ begin
  create type cross_access_status as enum ('active', 'revoked', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  -- 'kyc' = the selfie/ID check every approved member already passes in production.
  -- 'plus' = the paid Verified+ upgrade. 'none' exists only for imported edge cases.
  create type verified_tier as enum ('none', 'kyc', 'plus');
exception when duplicate_object then null; end $$;

-- Member roster. In the real cutover this is imported from production
-- registrations/profiles PRESERVING external_id — that id is the permanent
-- DiscourseConnect external_id and must never be regenerated
-- (see docs/discourse-sso-identity.md in the main app).
create table if not exists cross_access_members (
  external_id         uuid primary key,
  username            text not null,
  email               text not null,
  gender              text not null check (gender in ('men', 'women')),
  verified            verified_tier not null default 'kyc',
  verified_plus_since timestamptz,
  created_at          timestamptz not null default now()
);

-- Timed cross-access grants — the source of truth the revocation worker sweeps.
create table if not exists cross_access_grants (
  id                 uuid primary key default gen_random_uuid(),
  user_external_id   uuid not null references cross_access_members (external_id) on delete cascade,
  username           text not null,
  base_gender        text not null check (base_gender in ('men', 'women')),
  source             text not null,                       -- stripe_24h | stripe_3day | stripe_monthly | admin_comp | demo
  checkout_source    text not null default 'admin',       -- admin | storefront
  granted_at         timestamptz not null default now(),
  expires_at         timestamptz not null,
  status             cross_access_status not null default 'active',
  revoked_at         timestamptz,
  revoke_reason      text,
  revocation_synced  boolean not null default false,
  retry_count        integer not null default 0,
  last_error         text,
  created_at         timestamptz not null default now()
);

-- Enforces the Stage 1 "one active grant per member" rule (the 409 guard) at the
-- database level: a partial unique index over active rows only.
create unique index if not exists cross_access_grants_one_active
  on cross_access_grants (user_external_id)
  where status = 'active';

-- The worker's hot path: "active grants whose window has closed." A partial index
-- on expires_at keeps each sweep an index range scan, not a full-table scan.
create index if not exists cross_access_grants_due
  on cross_access_grants (expires_at)
  where status = 'active';

-- Audit trail of every worker + checkout action (mirrors store.log).
create table if not exists cross_access_log (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  level             text not null default 'info',         -- info | success | error
  action            text not null,                        -- grant_created | checkout_grant | revoke_synced | revoke_failed | verified_plus_purchased
  grant_id          uuid,
  user_external_id  uuid,
  username          text,
  message           text not null,
  discourse_status  integer,
  removed_groups    text,
  error             text
);

create index if not exists cross_access_log_created on cross_access_log (created_at desc);

-- Security posture mirrors the production privacy docs: these tables are
-- service-role only. Edge Functions use the service role key, which bypasses RLS.
-- RLS is enabled with NO anon/authenticated policies, so the anon key sees nothing.
alter table cross_access_members enable row level security;
alter table cross_access_grants  enable row level security;
alter table cross_access_log     enable row level security;
