-- Establish explicit Tea Time Cari admin roles and a general admin audit trail.

CREATE TABLE IF NOT EXISTS public.admin_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'moderator')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS admin_roles_role_idx ON public.admin_roles (role) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS admin_roles_revoked_at_idx ON public.admin_roles (revoked_at);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  actor_role text,
  action text NOT NULL,
  target_type text,
  target_id text,
  target_email text,
  previous_status text,
  next_status text,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx ON public.admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_actor_user_id_idx ON public.admin_audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS admin_audit_logs_action_idx ON public.admin_audit_logs (action);
CREATE INDEX IF NOT EXISTS admin_audit_logs_target_idx ON public.admin_audit_logs (target_type, target_id);

CREATE OR REPLACE FUNCTION public.update_admin_roles_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_admin_roles_updated_at ON public.admin_roles;
CREATE TRIGGER update_admin_roles_updated_at
  BEFORE UPDATE ON public.admin_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_admin_roles_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_roles'
      AND policyname = 'Service role can manage admin roles'
  ) THEN
    CREATE POLICY "Service role can manage admin roles"
      ON public.admin_roles FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_audit_logs'
      AND policyname = 'Service role can manage admin audit logs'
  ) THEN
    CREATE POLICY "Service role can manage admin audit logs"
      ON public.admin_audit_logs FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Permanent owner admins supplied by the Tea Time Cari owner.
UPDATE public.profiles
SET is_admin = true
WHERE id IN (
  '26236ea5-4a82-4711-a395-c405f28698d4'::uuid,
  'cbd00247-f199-497a-a20e-c66b5c78fbc0'::uuid
)
OR lower(email) IN ('admin@teatimecari.app', 'teatimecari@gmail.com');

INSERT INTO public.admin_roles (user_id, role)
SELECT id, 'owner'
FROM auth.users
WHERE id IN (
  '26236ea5-4a82-4711-a395-c405f28698d4'::uuid,
  'cbd00247-f199-497a-a20e-c66b5c78fbc0'::uuid
)
OR lower(email) IN ('admin@teatimecari.app', 'teatimecari@gmail.com')
ON CONFLICT (user_id) DO UPDATE
SET role = 'owner', revoked_at = NULL;
