-- Restore login routing for pre-CreatorFlow accounts that have no role yet.
-- Admins must have an explicit role so role-protected admin routes can load.

UPDATE public.profiles p
SET
  role = 'admin',
  status = 'active',
  updated_at = now()
WHERE (
    COALESCE(p.is_admin, false) = true
    OR EXISTS (
      SELECT 1
      FROM public.admin_roles ar
      WHERE ar.user_id = p.id
        AND ar.revoked_at IS NULL
        AND ar.role IN ('owner', 'admin')
    )
  )
  AND (p.role IS DISTINCT FROM 'admin' OR p.status IS DISTINCT FROM 'active');

UPDATE public.profiles
SET
  status = 'active',
  updated_at = now()
WHERE role IS NULL
  AND status IS DISTINCT FROM 'active'
  AND (kyc_status = 'approved' OR COALESCE(xaccess, false) = true);
