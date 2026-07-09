-- Add structured, diagnosable location tracking fields for registration and login events.
-- Existing display columns remain in place for backwards-compatible dashboard rendering.

ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS registration_ip_header text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS registration_city text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS registration_region text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS registration_country text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS registration_country_code text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS registration_timezone text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS registration_location_provider text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS registration_location_status text;

ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS last_login_ip_header text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS last_login_city text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS last_login_region text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS last_login_country text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS last_login_country_code text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS last_login_timezone text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS last_login_location_provider text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS last_login_location_status text;
