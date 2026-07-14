-- Ensure the primary Tea Time Cari admin account is authorized by the canonical
-- profiles.is_admin flag used by all admin Edge Functions.
--
-- profiles.updated_at is expected (added when the table was created), but a
-- stray out-of-band migration on the hosted DB has been observed to drop it,
-- which aborts this migration and blocks every migration after it. Restore
-- it defensively so the pending migration chain (including feature_flags)
-- isn't held hostage by that drift.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.profiles
SET
  is_admin = true,
  updated_at = now()
WHERE lower(email) = 'admin@teatimecari.app';
