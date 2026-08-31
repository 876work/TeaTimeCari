-- Cross-Access Service · Stage 2 — scheduled revocation (research brief Option A)
--
-- TARGET: the ISOLATED Stage 2 Supabase project only.
--
-- This is the production equivalent of the Stage 1 setInterval loop: pg_cron
-- invokes the revocation-sweep Edge Function once a minute over HTTP (pg_net).
-- The Edge Function does the actual work (select due grants -> Discourse
-- remove_groups sync -> mark revoked); this migration only schedules it.
--
-- pg_cron and pg_net are hosted-Supabase extensions and are NOT available in
-- pglite, so the schema test harness runs the previous migration only. Validate
-- this file against a real Stage 2 project.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Secrets live in Vault, never inline. Run these once (values are placeholders):
--   select vault.create_secret(
--     'https://<STAGE2_PROJECT_REF>.functions.supabase.co/revocation-sweep',
--     'revocation_sweep_url');
--   select vault.create_secret('<STAGE2_SERVICE_ROLE_KEY>', 'revocation_sweep_key');

-- Idempotent (re)schedule: unschedule any prior job of the same name first.
do $$
begin
  perform cron.unschedule('cross-access-revocation-sweep');
exception when others then null; -- no existing job
end $$;

select cron.schedule(
  'cross-access-revocation-sweep',
  '* * * * *',   -- every minute
  $cron$
    select net.http_post(
      url     := (select decrypted_secret from vault.decrypted_secrets where name = 'revocation_sweep_url'),
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'revocation_sweep_key')
      ),
      body    := '{}'::jsonb
    );
  $cron$
);

-- Operational check:
--   select * from cron.job where jobname = 'cross-access-revocation-sweep';
--   select * from cron.job_run_details order by start_time desc limit 10;
