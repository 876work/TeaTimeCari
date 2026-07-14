/*
  # Admin dashboard expansion

  1. Helper
    - `is_teatime_admin()` security-definer helper so RLS policies can check
      admin status without exposing admin_roles/profiles directly.

  2. New Tables
    - `feature_flags` - owner-managed kill switches (registration, uploads, purchases, invites)
    - `site_announcements` - in-app banner + email broadcast records
    - `admin_alert_settings` - single-row Slack webhook alerting configuration
    - `admin_alert_events` - log of alerts sent to Slack
    - `email_invites` - lifecycle tracking for email invitations (sent / accepted / revoked)
    - `post_moderation_scores` - automated NSFW screening results per post

  3. Realtime
    - Adds admin-readable SELECT policy on registrations/posts data needed for
      the dashboard's realtime subscriptions.
*/

-- ---------------------------------------------------------------------------
-- Admin check helper for RLS policies
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_teatime_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.admin_roles
      WHERE user_id = auth.uid() AND revoked_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    );
$$;

REVOKE ALL ON FUNCTION public.is_teatime_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_teatime_admin() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Feature flags / kill switches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'feature_flags'
      AND policyname = 'Anyone can read feature flags'
  ) THEN
    CREATE POLICY "Anyone can read feature flags"
      ON public.feature_flags FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'feature_flags'
      AND policyname = 'Service role can manage feature flags'
  ) THEN
    CREATE POLICY "Service role can manage feature flags"
      ON public.feature_flags FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

INSERT INTO public.feature_flags (key, label, description, enabled) VALUES
  ('registrations_enabled', 'New registrations', 'Allow new users to submit registrations. Disable to pause all signups during incidents.', true),
  ('invites_enabled', 'Email invites', 'Allow admins to send email invitations to new members.', true),
  ('premium_purchases_enabled', 'Premium purchases', 'Allow members to purchase premium cross-gender feed access via Stripe.', true),
  ('uploads_enabled', 'Post uploads', 'Allow members to upload new posts. Disable to pause new content during incidents.', true),
  ('community_sso_enabled', 'Community SSO', 'Allow members to sign in to the Discourse community via SSO.', true)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Site announcements (in-app banner + email broadcast)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  variant text NOT NULL DEFAULT 'info' CHECK (variant IN ('info', 'warning', 'critical')),
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'approved', 'male', 'female')),
  show_banner boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  email_sent_at timestamptz,
  email_recipient_count integer,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_announcements ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS site_announcements_active_idx
  ON public.site_announcements (active, starts_at, ends_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'site_announcements'
      AND policyname = 'Anyone can read active banner announcements'
  ) THEN
    CREATE POLICY "Anyone can read active banner announcements"
      ON public.site_announcements FOR SELECT
      TO anon, authenticated
      USING (
        (active = true AND show_banner = true AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()))
        OR public.is_teatime_admin()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'site_announcements'
      AND policyname = 'Service role can manage announcements'
  ) THEN
    CREATE POLICY "Service role can manage announcements"
      ON public.site_announcements FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Slack alerting configuration + event log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_alert_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  alerts_enabled boolean NOT NULL DEFAULT false,
  slack_webhook_url text,
  pending_users_threshold integer NOT NULL DEFAULT 5,
  flagged_posts_threshold integer NOT NULL DEFAULT 3,
  notify_on_new_registration boolean NOT NULL DEFAULT false,
  notify_on_high_risk_post boolean NOT NULL DEFAULT true,
  notify_on_payment_failure boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_alert_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.admin_alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_alert_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS admin_alert_events_created_at_idx
  ON public.admin_alert_events (created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_alert_settings'
      AND policyname = 'Service role can manage alert settings'
  ) THEN
    CREATE POLICY "Service role can manage alert settings"
      ON public.admin_alert_settings FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_alert_events'
      AND policyname = 'Service role can manage alert events'
  ) THEN
    CREATE POLICY "Service role can manage alert events"
      ON public.admin_alert_events FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

INSERT INTO public.admin_alert_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Email invite lifecycle tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'accepted', 'revoked')),
  sent_count integer NOT NULL DEFAULT 1,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  accepted_at timestamptz,
  accepted_registration_id uuid,
  revoked_at timestamptz,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_invites ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS email_invites_email_idx
  ON public.email_invites (lower(email));
CREATE INDEX IF NOT EXISTS email_invites_status_idx
  ON public.email_invites (status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_invites'
      AND policyname = 'Service role can manage email invites'
  ) THEN
    CREATE POLICY "Service role can manage email invites"
      ON public.email_invites FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Automated NSFW / content moderation scores
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.post_moderation_scores (
  post_id uuid PRIMARY KEY,
  nsfw_score numeric NOT NULL DEFAULT 0,
  top_class text,
  class_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text NOT NULL DEFAULT 'nsfwjs-mobilenet-v2',
  scanned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  scanned_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.post_moderation_scores ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'post_moderation_scores'
      AND policyname = 'Admins can read moderation scores'
  ) THEN
    CREATE POLICY "Admins can read moderation scores"
      ON public.post_moderation_scores FOR SELECT
      TO authenticated
      USING (public.is_teatime_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'post_moderation_scores'
      AND policyname = 'Admins can insert moderation scores'
  ) THEN
    CREATE POLICY "Admins can insert moderation scores"
      ON public.post_moderation_scores FOR INSERT
      TO authenticated
      WITH CHECK (public.is_teatime_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'post_moderation_scores'
      AND policyname = 'Admins can update moderation scores'
  ) THEN
    CREATE POLICY "Admins can update moderation scores"
      ON public.post_moderation_scores FOR UPDATE
      TO authenticated
      USING (public.is_teatime_admin())
      WITH CHECK (public.is_teatime_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'post_moderation_scores'
      AND policyname = 'Service role can manage moderation scores'
  ) THEN
    CREATE POLICY "Service role can manage moderation scores"
      ON public.post_moderation_scores FOR ALL
      TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Realtime support for the admin dashboard
-- ---------------------------------------------------------------------------
-- Admins need direct SELECT on registrations for realtime change events.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'registrations')
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'registrations'
        AND policyname = 'Admins can read registrations'
    )
  THEN
    CREATE POLICY "Admins can read registrations"
      ON public.registrations FOR SELECT
      TO authenticated
      USING (public.is_teatime_admin());
  END IF;
END $$;

-- Publish registrations and posts changes to the supabase_realtime publication.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'registrations')
      AND NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'registrations'
      )
    THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.registrations;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'posts')
      AND NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'posts'
      )
    THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_site_announcements_updated_at ON public.site_announcements;
CREATE TRIGGER touch_site_announcements_updated_at
  BEFORE UPDATE ON public.site_announcements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_email_invites_updated_at ON public.email_invites;
CREATE TRIGGER touch_email_invites_updated_at
  BEFORE UPDATE ON public.email_invites
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_feature_flags_updated_at ON public.feature_flags;
CREATE TRIGGER touch_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
