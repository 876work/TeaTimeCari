-- Add secure registration/login tracking fields for admin-only review.
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

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS registrations_created_at_idx ON public.registrations (created_at DESC);
CREATE INDEX IF NOT EXISTS registrations_last_login_at_idx ON public.registrations (last_login_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS registrations_last_seen_at_idx ON public.registrations (last_seen_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS profiles_is_admin_idx ON public.profiles (is_admin) WHERE is_admin = true;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;

-- Keep sensitive tracking fields away from regular users. Service-role Edge Functions
-- read/write all rows. Authenticated admins may read the table for operational use,
-- but frontend admin views should still use get-admin-users to avoid exposing service keys.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'registrations'
      AND policyname = 'Admins can read registrations'
  ) THEN
    CREATE POLICY "Admins can read registrations"
      ON public.registrations FOR SELECT TO authenticated
      USING (public.is_current_user_admin());
  END IF;
END $$;
