-- Remove CreatorFlow database side effects from environments where the reverted
-- CreatorFlow migrations were already applied.
--
-- The CreatorFlow auth trigger attempted to provision public.profiles rows for
-- every new auth.users row without supplying the legacy NOT NULL username field.
-- Supabase surfaces that trigger failure as "Database error creating new user",
-- which blocks normal Tea Time Cari registrations before the register-user Edge
-- Function can insert the application record.

DROP TRIGGER IF EXISTS on_auth_user_created_creatorflow_profile ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user_profile();

DROP TRIGGER IF EXISTS prevent_self_role_status_change ON public.profiles;
DROP FUNCTION IF EXISTS public.prevent_self_role_status_change();
DROP FUNCTION IF EXISTS public.current_user_role();

-- Restore the pre-CreatorFlow profile policies. CreatorFlow replaced these with
-- policies that depended on role/status columns and the removed is_admin helper.
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update limited own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.profiles;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can manage all profiles"
  ON public.profiles FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP FUNCTION IF EXISTS public.slugify(text);
DROP FUNCTION IF EXISTS public.set_creator_profile_slug();
DROP FUNCTION IF EXISTS public.prevent_creator_admin_field_changes();
DROP FUNCTION IF EXISTS public.calculate_creator_profile_completion(uuid);
DROP FUNCTION IF EXISTS public.refresh_creator_profile_completion(uuid);
DROP FUNCTION IF EXISTS public.refresh_creator_completion_trigger();
DROP FUNCTION IF EXISTS public.refresh_creator_completion_availability_trigger();
DO $$
BEGIN
  IF to_regclass('public.creator_profiles') IS NOT NULL THEN
    DROP FUNCTION IF EXISTS public.creator_profile_public(public.creator_profiles);
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.admin_set_creator_status(uuid, text, text);
DROP FUNCTION IF EXISTS public.admin_feature_creator(uuid, boolean);
DROP FUNCTION IF EXISTS public.admin_set_creator_verification(uuid, text);
DROP FUNCTION IF EXISTS public.get_default_currency_for_country(text);
DROP FUNCTION IF EXISTS public.calculate_booking_amounts(numeric);

-- Drop CreatorFlow-only tables and helpers. These are not used by the current
-- application and keeping their triggers/policies around can leave production in
-- a partially reverted state.
DROP TABLE IF EXISTS public.creator_availability CASCADE;
DROP TABLE IF EXISTS public.creator_niches CASCADE;
DROP TABLE IF EXISTS public.creator_platforms CASCADE;
DROP TABLE IF EXISTS public.creator_portfolio CASCADE;
DROP TABLE IF EXISTS public.creator_profiles CASCADE;
DROP TABLE IF EXISTS public.business_profiles CASCADE;
DROP TABLE IF EXISTS public.currency_rates CASCADE;
DROP TABLE IF EXISTS public.payouts CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.creator_services CASCADE;
DROP TABLE IF EXISTS public.platform_settings CASCADE;
DROP TABLE IF EXISTS public.countries CASCADE;
DROP TABLE IF EXISTS public.currencies CASCADE;

-- Remove CreatorFlow-only profile columns/constraints after dependent policies
-- and triggers have been removed. Keep the existing Tea Time Cari is_admin flag.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS role,
  DROP COLUMN IF EXISTS avatar_url,
  DROP COLUMN IF EXISTS country_code,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS status;

-- Restore the admin helper name if an applied CreatorFlow migration replaced it.
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = user_id
      AND p.is_admin = true
  ) OR EXISTS (
    SELECT 1
    FROM public.admin_roles ar
    WHERE ar.user_id = user_id
      AND ar.revoked_at IS NULL
      AND ar.role IN ('owner', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
