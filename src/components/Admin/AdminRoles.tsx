import { useEffect, useState } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { RefreshCw, Shield, ShieldCheck, ShieldOff, UserPlus } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { getFunctionErrorMessage } from '@/lib/functionError';
import {
  AdminAlert,
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminEmptyState,
  AdminInput,
  AdminPageHeader,
  AdminSelect,
  AdminSkeleton,
} from './ui';

interface AdminRoleRow {
  user_id: string;
  role: 'owner' | 'admin' | 'moderator';
  email: string | null;
  username: string | null;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
}

const roleDescriptions: Record<AdminRoleRow['role'], string> = {
  owner: 'Full access, including roles, feature flags, and system diagnostics.',
  admin: 'User review, moderation, invites, payments, announcements, and alerts.',
  moderator: 'User suspension and post moderation only.',
};

const roleBadgeVariant: Record<AdminRoleRow['role'], 'danger' | 'info' | 'neutral'> = {
  owner: 'danger',
  admin: 'info',
  moderator: 'neutral',
};

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function AdminRoles({
  activePage = 'roles',
  onNavigate,
}: {
  activePage?: string;
  onNavigate?: (page: string) => void;
}) {
  const supabase = useSupabaseClient();
  const session = useSession();

  const [admins, setAdmins] = useState<AdminRoleRow[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [grantEmail, setGrantEmail] = useState('');
  const [grantRole, setGrantRole] = useState<'admin' | 'moderator' | 'owner'>('moderator');
  const [confirmRevoke, setConfirmRevoke] = useState<AdminRoleRow | null>(null);

  const invoke = async (body: Record<string, unknown>) => {
    const {
      data: { session: current },
    } = await supabase.auth.getSession();

    if (!current?.access_token) throw new Error('You must be logged in as an admin.');

    const { data, error: fnError } = await supabase.functions.invoke('admin-manage-roles', {
      body,
      headers: { Authorization: `Bearer ${current.access_token}` },
    });

    if (fnError) throw new Error(await getFunctionErrorMessage(fnError));
    if (!data?.ok) throw new Error(data?.error || 'Role request failed.');

    return data;
  };

  const fetchAdmins = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await invoke({ action: 'list' });
      setAdmins(data.admins ?? []);
      setCanManage(Boolean(data.canManage));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGrant = async () => {
    if (!grantEmail.trim()) return;

    setProcessing(true);
    setError(null);
    setNotice(null);

    try {
      const data = await invoke({ action: 'grant', email: grantEmail.trim(), role: grantRole });
      setAdmins(data.admins ?? []);
      setNotice(`${grantEmail.trim()} is now ${grantRole === 'owner' ? 'an owner' : `a ${grantRole}`}.`);
      setGrantEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessing(false);
    }
  };

  const handleRevoke = async (row: AdminRoleRow) => {
    setProcessing(true);
    setError(null);
    setNotice(null);

    try {
      const data = await invoke({ action: 'revoke', user_id: row.user_id, email: row.email });
      setAdmins(data.admins ?? []);
      setNotice(`Admin access revoked for ${row.email ?? row.user_id}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessing(false);
      setConfirmRevoke(null);
    }
  };

  const activeAdmins = admins.filter((row) => !row.revoked_at);
  const revokedAdmins = admins.filter((row) => Boolean(row.revoked_at));

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className="space-y-6">
        <AdminPageHeader
          title="Roles & permissions"
          description="Grant and revoke platform admin roles. Owners manage everything; admins run day-to-day operations; moderators handle content and suspensions."
          actions={
            <AdminButton type="button" variant="glass" onClick={fetchAdmins} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </AdminButton>
          }
        />

        {error && <AdminAlert variant="error">{error}</AdminAlert>}
        {notice && <AdminAlert variant="success">{notice}</AdminAlert>}

        {!loading && !canManage && (
          <AdminAlert variant="info">
            <p className="font-semibold">Read-only view</p>
            <p className="mt-1">Only owner-level admins can grant or revoke roles.</p>
          </AdminAlert>
        )}

        {canManage && (
          <AdminCard
            title="Grant a role"
            description="The person must already have a Tea Time Cari account. Granting a new role replaces any existing role."
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1 text-xs font-semibold uppercase tracking-wide text-white/60">
                Account email
                <AdminInput
                  type="email"
                  value={grantEmail}
                  onChange={(event) => setGrantEmail(event.target.value)}
                  placeholder="member@example.com"
                  className="mt-2"
                  disabled={processing}
                />
              </label>

              <label className="text-xs font-semibold uppercase tracking-wide text-white/60 sm:w-44">
                Role
                <AdminSelect
                  value={grantRole}
                  onChange={(event) => setGrantRole(event.target.value as typeof grantRole)}
                  className="mt-2"
                  disabled={processing}
                >
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </AdminSelect>
              </label>

              <AdminButton
                type="button"
                variant="primary"
                onClick={handleGrant}
                loading={processing}
                disabled={processing || !grantEmail.trim()}
              >
                <UserPlus className="h-4 w-4" />
                Grant role
              </AdminButton>
            </div>

            <p className="mt-3 text-xs text-white/50">{roleDescriptions[grantRole]}</p>
          </AdminCard>
        )}

        <AdminCard
          className="p-0"
          title="Active admins"
          description={`${activeAdmins.length} account${activeAdmins.length === 1 ? '' : 's'} with admin access`}
        >
          {loading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2].map((item) => (
                <AdminSkeleton key={item} className="h-12 w-full" />
              ))}
            </div>
          ) : activeAdmins.length === 0 ? (
            <AdminEmptyState
              icon={<Shield className="h-8 w-8" />}
              title="No explicit admin roles found"
              message="Permanent owners configured via environment variables do not appear in this list."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-white/15 bg-white/10">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/50">Account</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/50">Role</th>
                    <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/50 md:table-cell">Granted</th>
                    {canManage && <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-white/50">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {activeAdmins.map((row) => (
                    <tr key={row.user_id} className="transition-colors hover:bg-white/5">
                      <td className="px-5 py-3">
                        <p className="truncate text-sm font-semibold text-white">{row.email ?? row.user_id}</p>
                        {row.username && <p className="text-xs text-white/50">@{row.username}</p>}
                      </td>
                      <td className="px-5 py-3">
                        <AdminBadge variant={roleBadgeVariant[row.role]}>
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {row.role.charAt(0).toUpperCase() + row.role.slice(1)}
                        </AdminBadge>
                      </td>
                      <td className="hidden px-5 py-3 text-xs text-white/70 md:table-cell">{formatDateTime(row.created_at)}</td>
                      {canManage && (
                        <td className="px-5 py-3 text-right">
                          <AdminButton
                            size="sm"
                            variant="secondary"
                            onClick={() => setConfirmRevoke(row)}
                            disabled={processing || row.user_id === session?.user?.id}
                            title={row.user_id === session?.user?.id ? 'You cannot revoke your own role' : undefined}
                          >
                            <ShieldOff className="h-4 w-4" />
                            Revoke
                          </AdminButton>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>

        {revokedAdmins.length > 0 && (
          <AdminCard
            className="p-0"
            title="Revoked roles"
            description="Kept for auditing. Grant a role again to restore access."
          >
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <tbody className="divide-y divide-white/10">
                  {revokedAdmins.map((row) => (
                    <tr key={row.user_id} className="transition-colors hover:bg-white/5">
                      <td className="px-5 py-3">
                        <p className="truncate text-sm font-medium text-white/70">{row.email ?? row.user_id}</p>
                      </td>
                      <td className="px-5 py-3">
                        <AdminBadge variant="muted">{row.role}</AdminBadge>
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-white/50">
                        Revoked {formatDateTime(row.revoked_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminCard>
        )}
      </div>

      {confirmRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">Revoke admin access?</h2>
            <p className="mt-2 text-sm text-slate-600">
              {confirmRevoke.email ?? confirmRevoke.user_id} will immediately lose their{' '}
              <span className="font-semibold">{confirmRevoke.role}</span> role and access to the admin portal.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <AdminButton type="button" variant="secondary" onClick={() => setConfirmRevoke(null)} disabled={processing}>
                Cancel
              </AdminButton>
              <AdminButton type="button" variant="danger" onClick={() => handleRevoke(confirmRevoke)} loading={processing}>
                Revoke access
              </AdminButton>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
