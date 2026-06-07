-- Ensure the primary Tea Time Cari admin account is authorized by the canonical
-- profiles.is_admin flag used by all admin Edge Functions.
UPDATE public.profiles
SET
  is_admin = true,
  updated_at = now()
WHERE lower(email) = 'admin@teatimecari.app';
