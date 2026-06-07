import { supabase } from '@/lib/supabaseClient';
import { getFunctionErrorMessage } from '@/lib/functionError';

export type AdminRole = 'owner' | 'admin' | 'moderator';

export type AdminSession = {
  user: {
    id: string;
    email: string | null;
  };
  role: AdminRole;
  roles: AdminRole[];
  permissions: string[];
};

export async function getAdminSession(): Promise<AdminSession | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return null;

  const { data, error } = await supabase.functions.invoke('admin-me', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }

  if (!data?.ok || !data?.admin) return null;

  return {
    user: data.user,
    role: data.role,
    roles: data.roles ?? [data.role],
    permissions: data.permissions ?? [],
  };
}

export function hasAdminPermission(admin: AdminSession | null, permission: string) {
  return Boolean(admin?.permissions.includes(permission));
}
