-- Audit promote/demote attempts performed against Discourse from the Tea Time Cari admin portal.
CREATE TABLE IF NOT EXISTS public.discourse_admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL CHECK (action IN ('promote', 'demote')),
  target_discourse_user_id integer NOT NULL,
  target_username text,
  target_email text,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discourse_admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS discourse_admin_audit_logs_created_at_idx
  ON public.discourse_admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS discourse_admin_audit_logs_actor_user_id_idx
  ON public.discourse_admin_audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS discourse_admin_audit_logs_target_discourse_user_id_idx
  ON public.discourse_admin_audit_logs (target_discourse_user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'discourse_admin_audit_logs'
      AND policyname = 'Service role can manage discourse admin audit logs'
  ) THEN
    CREATE POLICY "Service role can manage discourse admin audit logs"
      ON public.discourse_admin_audit_logs FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;
