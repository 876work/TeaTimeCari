/*
  # Advertising system

  1. New Tables
    - `advertisements` - admin-managed banner ads (creative, placement, schedule,
      priority, active flag, denormalized impression/click counters)
    - `ad_impressions` - raw impression events for reporting/fraud checks
    - `ad_clicks` - raw click events for reporting/fraud checks

  2. Storage
    - `ad-creatives` public bucket for banner images, with admin-only writes

  3. Access
    - Anyone (anon/authenticated) can read ads that are active and within their
      scheduling window, mirroring the existing site_announcements pattern.
    - Only the service role (via the admin-ads edge function) can write
      advertisements, and only admins can write ad-creatives storage objects.
*/

-- ---------------------------------------------------------------------------
-- Advertisements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.advertisements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  advertiser_name text,
  image_path text NOT NULL,
  image_width integer,
  image_height integer,
  destination_url text NOT NULL,
  alt_text text,
  placement text NOT NULL CHECK (placement IN ('homepage', 'in_feed', 'footer')),
  device_target text NOT NULL DEFAULT 'all' CHECK (device_target IN ('all', 'desktop', 'mobile')),
  priority integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  impression_count bigint NOT NULL DEFAULT 0,
  click_count bigint NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT advertisements_window_check CHECK (ends_at IS NULL OR ends_at > starts_at)
);

ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS advertisements_eligibility_idx
  ON public.advertisements (placement, active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS advertisements_created_at_idx
  ON public.advertisements (created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'advertisements'
      AND policyname = 'Anyone can read eligible advertisements'
  ) THEN
    CREATE POLICY "Anyone can read eligible advertisements"
      ON public.advertisements FOR SELECT
      TO anon, authenticated
      USING (
        (active = true AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()))
        OR public.is_teatime_admin()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'advertisements'
      AND policyname = 'Service role can manage advertisements'
  ) THEN
    CREATE POLICY "Service role can manage advertisements"
      ON public.advertisements FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

DROP TRIGGER IF EXISTS touch_advertisements_updated_at ON public.advertisements;
CREATE TRIGGER touch_advertisements_updated_at
  BEFORE UPDATE ON public.advertisements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Atomic counters for the tracking edge functions (avoids read-then-write races).
CREATE OR REPLACE FUNCTION public.increment_ad_impression_count(p_ad_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.advertisements SET impression_count = impression_count + 1 WHERE id = p_ad_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_ad_click_count(p_ad_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.advertisements SET click_count = click_count + 1 WHERE id = p_ad_id;
$$;

REVOKE ALL ON FUNCTION public.increment_ad_impression_count(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_ad_click_count(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ad_impression_count(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_ad_click_count(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Raw tracking events (written only by the ad-impression / ad-click edge
-- functions via the service role; read only by admin reporting)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ad_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES public.advertisements(id) ON DELETE CASCADE,
  placement text NOT NULL,
  session_id text,
  device text,
  is_unique boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ad_impressions_ad_id_idx ON public.ad_impressions (ad_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ad_impressions_created_at_idx ON public.ad_impressions (created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ad_impressions'
      AND policyname = 'Service role can manage ad impressions'
  ) THEN
    CREATE POLICY "Service role can manage ad impressions"
      ON public.ad_impressions FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.ad_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES public.advertisements(id) ON DELETE CASCADE,
  placement text NOT NULL,
  session_id text,
  device text,
  is_unique boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ad_clicks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ad_clicks_ad_id_idx ON public.ad_clicks (ad_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ad_clicks_created_at_idx ON public.ad_clicks (created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ad_clicks'
      AND policyname = 'Service role can manage ad clicks'
  ) THEN
    CREATE POLICY "Service role can manage ad clicks"
      ON public.ad_clicks FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Storage: public bucket for ad creatives, admin-only writes
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ad-creatives', 'ad-creatives', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp'];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins can upload ad creatives'
  ) THEN
    CREATE POLICY "Admins can upload ad creatives"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'ad-creatives' AND public.is_teatime_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins can update ad creatives'
  ) THEN
    CREATE POLICY "Admins can update ad creatives"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'ad-creatives' AND public.is_teatime_admin())
      WITH CHECK (bucket_id = 'ad-creatives' AND public.is_teatime_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins can delete ad creatives'
  ) THEN
    CREATE POLICY "Admins can delete ad creatives"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'ad-creatives' AND public.is_teatime_admin());
  END IF;
END $$;
