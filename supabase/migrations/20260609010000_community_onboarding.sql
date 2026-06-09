-- Track first-session community onboarding before sending newly approved users to Discourse.
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS community_onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS discourse_welcome_pm_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS registrations_community_onboarding_pending_idx
  ON public.registrations (id)
  WHERE status = 'approved' AND community_onboarding_completed_at IS NULL;

-- If registrations RLS is enabled in an environment, approved users still need to
-- read their own access group and onboarding flag to decide whether to show the
-- welcome screen before Discourse.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'registrations'
      AND policyname = 'Users can read own community onboarding status'
  ) THEN
    CREATE POLICY "Users can read own community onboarding status"
      ON public.registrations FOR SELECT TO authenticated
      USING (auth.uid() = id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.mark_community_onboarding_complete()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  completed_at timestamptz;
BEGIN
  UPDATE public.registrations
  SET community_onboarding_completed_at = COALESCE(community_onboarding_completed_at, now())
  WHERE id = auth.uid()
    AND status = 'approved'
  RETURNING community_onboarding_completed_at INTO completed_at;

  IF completed_at IS NULL THEN
    RAISE EXCEPTION 'Approved registration not found for current user'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN completed_at;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_community_onboarding_complete() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_community_onboarding_complete() TO authenticated;
