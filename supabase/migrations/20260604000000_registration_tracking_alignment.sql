-- Ensure production/staging registrations tables include the admin activity
-- tracking columns consumed by get-admin-users and track-auth-activity.
-- This is intentionally non-destructive so it can be safely applied to an
-- environment where some or all columns already exist.

ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS registration_ip_address text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS registration_ip_location text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS registration_browser text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS registration_device text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS registration_operating_system text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS registration_user_agent text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS registration_tracked_at timestamptz;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS last_login_ip_address text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS last_login_ip_location text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS last_login_browser text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS last_login_device text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS last_login_operating_system text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS last_login_user_agent text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS registrations_created_at_idx ON public.registrations (created_at DESC);
CREATE INDEX IF NOT EXISTS registrations_last_login_at_idx ON public.registrations (last_login_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS registrations_last_seen_at_idx ON public.registrations (last_seen_at DESC NULLS LAST);

-- Keep admin authorization schema aligned in environments where the earlier
-- tracking migration was missed or partially applied.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS profiles_is_admin_idx ON public.profiles (is_admin) WHERE is_admin = true;
