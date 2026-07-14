-- The admin approval flow reads/writes these registrations columns, but
-- email_code/email_code_expiry were never captured in a checked-in migration
-- and discourse_welcome_pm_sent_at arrived in a later one, so environments can
-- be missing them. When approve-and-sync selected a missing column, the failed
-- lookup surfaced to admins as a bogus "404: Registration not found". Ensure
-- the columns exist everywhere; every statement is idempotent.

ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS email_code text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS email_code_expiry timestamptz;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS discourse_welcome_pm_sent_at timestamptz;
