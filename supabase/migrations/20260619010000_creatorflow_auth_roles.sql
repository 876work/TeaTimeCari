-- CreatorFlow Supabase Auth roles, profile provisioning, and RLS hardening.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('business', 'creator', 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_status_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('active', 'pending', 'suspended', 'deleted'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.business_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.creator_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_type text,
  approval_status text NOT NULL DEFAULT 'pending_review' CHECK (approval_status IN ('pending_review', 'approved', 'rejected')),
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  onboarding_completed boolean NOT NULL DEFAULT false,
  public_slug text UNIQUE,
  display_name text,
  bio text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_id AND p.role = 'admin' AND p.status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.admin_roles ar
    WHERE ar.user_id = user_id AND ar.revoked_at IS NULL AND ar.role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role text := NEW.raw_user_meta_data->>'role';
BEGIN
  IF requested_role NOT IN ('business', 'creator') THEN
    requested_role := NULL;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, country_code, role, status)
  VALUES (
    NEW.id,
    lower(COALESCE(NEW.email, '')),
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'country_code',
    requested_role,
    CASE WHEN requested_role IS NULL THEN 'pending' ELSE 'active' END
  )
  ON CONFLICT (id) DO NOTHING;

  IF requested_role = 'business' THEN
    INSERT INTO public.business_profiles (id, business_name)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'business_name')
    ON CONFLICT (id) DO NOTHING;
  ELSIF requested_role = 'creator' THEN
    INSERT INTO public.creator_profiles (id, creator_type, approval_status, verification_status)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'creator_type', 'pending_review', 'unverified')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_creatorflow_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_creatorflow_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user_profile();

CREATE OR REPLACE FUNCTION public.prevent_self_role_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() = OLD.id AND NOT public.is_admin(auth.uid()) THEN
    NEW.role := OLD.role;
    NEW.status := OLD.status;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_self_role_status_change ON public.profiles;
CREATE TRIGGER prevent_self_role_status_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_status_change();

DROP TRIGGER IF EXISTS update_business_profiles_updated_at ON public.business_profiles;
CREATE TRIGGER update_business_profiles_updated_at BEFORE UPDATE ON public.business_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_creator_profiles_updated_at ON public.creator_profiles;
CREATE TRIGGER update_creator_profiles_updated_at BEFORE UPDATE ON public.creator_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.is_admin(auth.uid()));
CREATE POLICY "Users can update limited own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id AND status <> 'deleted') WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()) AND status = (SELECT status FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Businesses can manage own business profile" ON public.business_profiles FOR ALL TO authenticated USING (auth.uid() = id AND public.current_user_role() = 'business' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'active')) WITH CHECK (auth.uid() = id AND public.current_user_role() = 'business');
CREATE POLICY "Admins can manage business profiles" ON public.business_profiles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Creators can manage own creator profile" ON public.creator_profiles FOR ALL TO authenticated USING (auth.uid() = id AND public.current_user_role() = 'creator' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'active')) WITH CHECK (auth.uid() = id AND public.current_user_role() = 'creator');
CREATE POLICY "Approved public creator profiles are readable" ON public.creator_profiles FOR SELECT TO anon, authenticated USING (approval_status = 'approved' AND verification_status = 'verified');
CREATE POLICY "Admins can manage creator profiles" ON public.creator_profiles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
