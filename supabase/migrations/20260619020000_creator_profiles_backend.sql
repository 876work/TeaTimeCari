-- CreatorFlow creator profile backend, discovery, admin actions, storage, and RLS.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'creator_profiles' AND column_name = 'public_slug')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'creator_profiles' AND column_name = 'slug') THEN
    ALTER TABLE public.creator_profiles RENAME COLUMN public_slug TO slug;
  END IF;
END $$;

ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS country_code text REFERENCES public.countries(code),
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS travel_availability text,
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS profile_completion integer NOT NULL DEFAULT 0 CHECK (profile_completion BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS average_rating numeric NOT NULL DEFAULT 0 CHECK (average_rating >= 0),
  ADD COLUMN IF NOT EXISTS review_count integer NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creator_profiles_creator_type_chk') THEN
    ALTER TABLE public.creator_profiles ADD CONSTRAINT creator_profiles_creator_type_chk CHECK (creator_type IN ('ugc_creator', 'influencer', 'both'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creator_profiles_travel_availability_chk') THEN
    ALTER TABLE public.creator_profiles ADD CONSTRAINT creator_profiles_travel_availability_chk CHECK (travel_availability IS NULL OR travel_availability IN ('local_only', 'national', 'regional_caribbean', 'international'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.creator_portfolio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  content_type text NOT NULL CHECK (content_type IN ('video', 'image', 'link', 'case_study', 'social_post', 'other')),
  category text,
  external_url text,
  thumbnail_url text,
  media_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.creator_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'x', 'website', 'other')),
  username text,
  profile_url text,
  follower_count integer NOT NULL DEFAULT 0 CHECK (follower_count >= 0),
  engagement_rate numeric NOT NULL DEFAULT 0 CHECK (engagement_rate >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.creator_niches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  niche text NOT NULL CHECK (niche IN ('lifestyle', 'food', 'travel', 'beauty', 'fashion', 'fitness', 'technology', 'parenting', 'business', 'entertainment', 'education', 'health', 'other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creator_id, niche)
);

CREATE TABLE IF NOT EXISTS public.creator_availability (
  creator_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  available_days text[] NOT NULL DEFAULT '{}',
  available_start_time time,
  available_end_time time,
  minimum_notice_hours integer NOT NULL DEFAULT 24 CHECK (minimum_notice_hours >= 0),
  unavailable_dates date[] NOT NULL DEFAULT '{}',
  is_paused boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_services
  ADD COLUMN IF NOT EXISTS service_type text,
  ADD COLUMN IF NOT EXISTS service_name text,
  ADD COLUMN IF NOT EXISTS deliverables text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS turnaround_time text,
  ADD COLUMN IF NOT EXISTS usage_rights text;

UPDATE public.creator_services SET service_name = COALESCE(service_name, title) WHERE service_name IS NULL;
ALTER TABLE public.creator_services ALTER COLUMN service_name SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creator_services_service_type_chk') THEN
    ALTER TABLE public.creator_services ADD CONSTRAINT creator_services_service_type_chk CHECK (service_type IS NULL OR service_type IN ('event_coverage', 'ugc_content', 'influencer_campaign', 'custom'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.slugify(value text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(value, 'creator')), '[^a-z0-9]+', '-', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.set_creator_profile_slug() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE base_slug text; candidate text; suffix text;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' OR (TG_OP = 'UPDATE' AND NEW.display_name IS DISTINCT FROM OLD.display_name) THEN
    base_slug := left(public.slugify(COALESCE(NEW.display_name, 'creator')), 50);
    candidate := base_slug;
    WHILE EXISTS (SELECT 1 FROM public.creator_profiles WHERE slug = candidate AND id <> NEW.id) LOOP
      suffix := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      candidate := left(base_slug, 43) || '-' || suffix;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.prevent_creator_admin_field_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() = OLD.id AND NOT public.is_admin(auth.uid()) THEN
    NEW.approval_status := OLD.approval_status;
    NEW.verification_status := OLD.verification_status;
    NEW.average_rating := OLD.average_rating;
    NEW.review_count := OLD.review_count;
    NEW.is_featured := OLD.is_featured;
    NEW.suspended_at := OLD.suspended_at;
    NEW.rejection_reason := OLD.rejection_reason;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.calculate_creator_profile_completion(target_creator_id uuid) RETURNS integer LANGUAGE plpgsql STABLE AS $$
DECLARE cp public.creator_profiles%ROWTYPE; score integer := 0;
BEGIN
  SELECT * INTO cp FROM public.creator_profiles WHERE id = target_creator_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF cp.display_name IS NOT NULL AND cp.creator_type IS NOT NULL AND cp.country_code IS NOT NULL THEN score := score + 20; END IF;
  IF cp.profile_photo_url IS NOT NULL OR cp.avatar_url IS NOT NULL THEN score := score + 10; END IF;
  IF length(coalesce(cp.bio, '')) >= 20 THEN score := score + 10; END IF;
  IF EXISTS (SELECT 1 FROM public.creator_niches WHERE creator_id = target_creator_id) THEN score := score + 10; END IF;
  IF EXISTS (SELECT 1 FROM public.creator_platforms WHERE creator_id = target_creator_id) THEN score := score + 15; END IF;
  IF EXISTS (SELECT 1 FROM public.creator_portfolio WHERE creator_id = target_creator_id) THEN score := score + 15; END IF;
  IF EXISTS (SELECT 1 FROM public.creator_services WHERE creator_id = target_creator_id AND is_active = true) THEN score := score + 15; END IF;
  IF EXISTS (SELECT 1 FROM public.creator_availability WHERE creator_id = target_creator_id) THEN score := score + 5; END IF;
  RETURN LEAST(score, 100);
END; $$;

CREATE OR REPLACE FUNCTION public.refresh_creator_profile_completion(target_creator_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.creator_profiles SET profile_completion = public.calculate_creator_profile_completion(target_creator_id), updated_at = now() WHERE id = target_creator_id;
END; $$;

CREATE OR REPLACE FUNCTION public.refresh_creator_completion_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_creator_profile_completion(OLD.creator_id);
    RETURN OLD;
  END IF;
  PERFORM public.refresh_creator_profile_completion(NEW.creator_id);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.refresh_creator_completion_availability_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_creator_profile_completion(OLD.creator_id);
    RETURN OLD;
  END IF;
  PERFORM public.refresh_creator_profile_completion(NEW.creator_id);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.creator_profile_public(creator public.creator_profiles) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT creator.approval_status = 'approved'
    AND creator.is_public = true
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = creator.id AND p.status = 'active');
$$;

CREATE OR REPLACE FUNCTION public.admin_set_creator_status(target_creator_id uuid, new_approval_status text, reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can update creator approval status'; END IF;
  IF new_approval_status NOT IN ('pending_review', 'approved', 'rejected', 'suspended') THEN RAISE EXCEPTION 'Invalid approval status'; END IF;
  UPDATE public.creator_profiles
  SET approval_status = CASE WHEN new_approval_status = 'suspended' THEN approval_status ELSE new_approval_status END,
      suspended_at = CASE WHEN new_approval_status = 'suspended' THEN now() ELSE NULL END,
      rejection_reason = CASE WHEN new_approval_status = 'rejected' THEN reason ELSE NULL END,
      updated_at = now()
  WHERE id = target_creator_id;
  IF new_approval_status = 'suspended' THEN UPDATE public.profiles SET status = 'suspended' WHERE id = target_creator_id; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_feature_creator(target_creator_id uuid, should_feature boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can feature creators'; END IF;
  UPDATE public.creator_profiles SET is_featured = should_feature, updated_at = now() WHERE id = target_creator_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_creator_verification(target_creator_id uuid, new_verification_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Only admins can update verification'; END IF;
  IF new_verification_status NOT IN ('unverified', 'pending', 'verified', 'rejected') THEN RAISE EXCEPTION 'Invalid verification status'; END IF;
  UPDATE public.creator_profiles SET verification_status = new_verification_status, updated_at = now() WHERE id = target_creator_id;
END; $$;

DROP TRIGGER IF EXISTS set_creator_profile_slug ON public.creator_profiles;
CREATE TRIGGER set_creator_profile_slug BEFORE INSERT OR UPDATE OF display_name, slug ON public.creator_profiles FOR EACH ROW EXECUTE FUNCTION public.set_creator_profile_slug();
DROP TRIGGER IF EXISTS prevent_creator_admin_field_changes ON public.creator_profiles;
CREATE TRIGGER prevent_creator_admin_field_changes BEFORE UPDATE ON public.creator_profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_creator_admin_field_changes();

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['creator_portfolio','creator_platforms','creator_availability'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS refresh_creator_completion_services ON public.creator_services;
CREATE TRIGGER refresh_creator_completion_services AFTER INSERT OR UPDATE OR DELETE ON public.creator_services FOR EACH ROW EXECUTE FUNCTION public.refresh_creator_completion_trigger();
DROP TRIGGER IF EXISTS refresh_creator_completion_portfolio ON public.creator_portfolio;
CREATE TRIGGER refresh_creator_completion_portfolio AFTER INSERT OR UPDATE OR DELETE ON public.creator_portfolio FOR EACH ROW EXECUTE FUNCTION public.refresh_creator_completion_trigger();
DROP TRIGGER IF EXISTS refresh_creator_completion_platforms ON public.creator_platforms;
CREATE TRIGGER refresh_creator_completion_platforms AFTER INSERT OR UPDATE OR DELETE ON public.creator_platforms FOR EACH ROW EXECUTE FUNCTION public.refresh_creator_completion_trigger();
DROP TRIGGER IF EXISTS refresh_creator_completion_niches ON public.creator_niches;
CREATE TRIGGER refresh_creator_completion_niches AFTER INSERT OR UPDATE OR DELETE ON public.creator_niches FOR EACH ROW EXECUTE FUNCTION public.refresh_creator_completion_trigger();
DROP TRIGGER IF EXISTS refresh_creator_completion_availability ON public.creator_availability;
CREATE TRIGGER refresh_creator_completion_availability AFTER INSERT OR UPDATE OR DELETE ON public.creator_availability FOR EACH ROW EXECUTE FUNCTION public.refresh_creator_completion_availability_trigger();

ALTER TABLE public.creator_portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_niches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved public creator profiles are readable" ON public.creator_profiles;
CREATE POLICY "Public approved active creator profiles are readable" ON public.creator_profiles FOR SELECT TO anon, authenticated USING (public.creator_profile_public(creator_profiles));

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['creator_services','creator_portfolio','creator_platforms','creator_niches'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %L ON public.%I', 'Creators can manage own ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %L ON public.%I', 'Public can read approved ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %L ON public.%I', 'Admins can manage ' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (auth.uid() = creator_id AND public.current_user_role() = ''creator'') WITH CHECK (auth.uid() = creator_id AND public.current_user_role() = ''creator'')', 'Creators can manage own ' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.id = creator_id AND public.creator_profile_public(cp)))', 'Public can read approved ' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()))', 'Admins can manage ' || t, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Creators can manage own creator_availability" ON public.creator_availability;
DROP POLICY IF EXISTS "Public can read approved creator_availability" ON public.creator_availability;
DROP POLICY IF EXISTS "Admins can manage creator_availability" ON public.creator_availability;
CREATE POLICY "Creators can manage own creator_availability" ON public.creator_availability FOR ALL TO authenticated USING (auth.uid() = creator_id AND public.current_user_role() = 'creator') WITH CHECK (auth.uid() = creator_id AND public.current_user_role() = 'creator');
CREATE POLICY "Public can read approved creator_availability" ON public.creator_availability FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.id = creator_id AND public.creator_profile_public(cp)));
CREATE POLICY "Admins can manage creator_availability" ON public.creator_availability FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true), ('creator-portfolios', 'creator-portfolios', true) ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Users can upload own avatar folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own portfolio folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own portfolio folder" ON storage.objects;
CREATE POLICY "Users can upload own avatar folder" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own avatar folder" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text) WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can upload own portfolio folder" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'creator-portfolios' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own portfolio folder" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'creator-portfolios' AND (storage.foldername(name))[1] = auth.uid()::text) WITH CHECK (bucket_id = 'creator-portfolios' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE INDEX IF NOT EXISTS creator_profiles_public_idx ON public.creator_profiles(approval_status, is_public, is_featured);
CREATE INDEX IF NOT EXISTS creator_profiles_slug_idx ON public.creator_profiles(slug);
CREATE INDEX IF NOT EXISTS creator_services_creator_id_idx ON public.creator_services(creator_id);
CREATE INDEX IF NOT EXISTS creator_portfolio_creator_id_idx ON public.creator_portfolio(creator_id);
CREATE INDEX IF NOT EXISTS creator_platforms_creator_id_idx ON public.creator_platforms(creator_id);
CREATE INDEX IF NOT EXISTS creator_niches_creator_id_idx ON public.creator_niches(creator_id);

CREATE OR REPLACE FUNCTION public.set_creator_service_default_currency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.currency_code IS NULL THEN
    NEW.currency_code := public.get_default_currency_for_country(
      COALESCE(
        (SELECT cp.country_code FROM public.creator_profiles cp WHERE cp.id = NEW.creator_id),
        (SELECT p.country_code FROM public.profiles p WHERE p.id = NEW.creator_id),
        (SELECT value FROM public.platform_settings WHERE key = 'default_country')
      )
    );
  END IF;
  NEW.title := COALESCE(NEW.title, NEW.service_name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_creator_service_default_currency ON public.creator_services;
CREATE TRIGGER set_creator_service_default_currency
  BEFORE INSERT ON public.creator_services
  FOR EACH ROW
  EXECUTE FUNCTION public.set_creator_service_default_currency();
