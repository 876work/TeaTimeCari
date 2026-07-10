import React, { useEffect, useMemo, useState } from 'react';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import {
  Crown,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  ShieldOff,
  UserCheck,
  X,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import {
  AdminAlert,
  AdminBadge,
  AdminButton,
  AdminFilterBar,
  AdminInput,
  AdminMetricCard,
  AdminPageHeader,
  AdminTable,
} from './ui';

type DiscourseFlag = 'all' | 'active' | 'staff' | 'suspended' | 'new' | 'blocked' | 'suspect';
type AdminAction = 'promote' | 'demote';

type DiscourseUser = {
  id: number;
  username: string | null;
  name: string | null;
  email: string | null;
  active: boolean;
  admin: boolean;
  moderator: boolean;
  suspended: boolean;
  staged: boolean;
  created_at: string | null;
  last_seen_at: string | null;
  trust_level: number | null;
  can_grant_admin: boolean;
  can_revoke_admin: boolean;
};

type PendingAction = {
  action: AdminAction;
  user: DiscourseUser;
};

const FILTERS: { id: DiscourseFlag; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'staff', label: 'Staff' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'new', label: 'New' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'suspect', label: 'Suspect' },
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

async function getFunctionErrorMessage(error: unknown) {
  const fallback = getErrorMessage(error);
  const maybeContext = (error as { context?: unknown })?.context;
  const response = maybeContext instanceof Response
    ? maybeContext
    : (maybeContext as { response?: Response } | undefined)?.response;

  if (!response) return fallback;

  try {
    const body = await response.clone().json();
    if (body?.error) return String(body.error);
    if (body?.message) return String(body.message);
  } catch {
    try {
      const text = await response.clone().text();
      if (text) return text;
    } catch {
      // Fall through to the Supabase client error message.
    }
  }

  return fallback;
}

function displayName(user: DiscourseUser) {
  return user.name?.trim() || user.username?.trim() || user.email?.trim() || `Discourse user #${user.id}`;
}

function Badge({
  label,
  enabled,
  tone,
}: {
  label: string;
  enabled: boolean;
  tone: 'blue' | 'green' | 'red' | 'slate' | 'purple';
}) {
  const variant = enabled
    ? ({ blue: 'info', green: 'success', red: 'danger', slate: 'neutral', purple: 'brand' } as const)[tone]
    : 'muted';

  return <AdminBadge variant={variant}>{label}: {enabled ? 'Yes' : 'No'}</AdminBadge>;
}

function ConfirmationModal({
  pendingAction,
  loading,
  onCancel,
  onConfirm,
}: {
  pendingAction: PendingAction;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isPromote = pendingAction.action === 'promote';
  const userName = displayName(pendingAction.user);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {isPromote ? 'Promote Discourse admin?' : 'Demote Discourse admin?'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              This changes Discourse admin status only. Tea Time Cari app admin access is not changed.
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            aria-label="Close confirmation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-900">{userName}</p>
            <p className="text-xs text-slate-500">
              @{pendingAction.user.username || 'unknown'} · {pendingAction.user.email || 'No email returned'}
            </p>
            <p className="mt-2 text-xs text-slate-500">Discourse user ID: {pendingAction.user.id}</p>
          </div>

          <p className="text-sm text-slate-600">
            {isPromote
              ? 'Promoting this user grants administrator privileges inside Discourse.'
              : 'Demoting this user removes administrator privileges inside Discourse. Self-demotion and last-admin demotion are blocked server-side.'}
          </p>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 p-5">
          <AdminButton type="button" onClick={onCancel} disabled={loading}>
            Cancel
          </AdminButton>

          <AdminButton
            type="button"
            onClick={onConfirm}
            disabled={loading}
            variant={isPromote ? 'primary' : 'danger'}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPromote ? 'Promote Admin' : 'Demote Admin'}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

export function DiscourseCommunityAdmins({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const supabase = useSupabaseClient();
  const session = useSession();

  const [users, setUsers] = useState<DiscourseUser[]>([]);
  const [filter, setFilter] = useState<DiscourseFlag>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const currentEmail = session?.user?.email?.trim().toLowerCase() || '';
  const adminCount = useMemo(() => users.filter((user) => user.admin).length, [users]);

  const fetchUsers = async (nextPage = page) => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!currentSession?.access_token) {
        throw new Error('You must be logged in as a Tea Time Cari admin.');
      }

      const { data, error: fnError } = await supabase.functions.invoke('discourse-admin-users', {
        body: {
          action: 'list',
          flag: filter,
          page: nextPage,
          search: search.trim() || undefined,
        },
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });

      if (fnError) throw new Error(await getFunctionErrorMessage(fnError));

      if (!data?.ok) {
        throw new Error(data?.error || 'Unable to load Discourse users.');
      }

      setUsers(data.users ?? []);
      setPage(nextPage);
    } catch (err) {
      setUsers([]);
      setError(`Failed to load Discourse users: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(0);
    // Search is intentionally submitted manually so typing does not call Discourse on every keypress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    fetchUsers(0);
  };

  const openAction = (action: AdminAction, user: DiscourseUser) => {
    setError(null);
    setSuccess(null);
    setPendingAction({ action, user });
  };

  const confirmAction = async () => {
    if (!pendingAction) return;

    setActionLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!currentSession?.access_token) {
        throw new Error('You must be logged in as a Tea Time Cari admin.');
      }

      const { data, error: fnError } = await supabase.functions.invoke('discourse-admin-users', {
        body: {
          action: pendingAction.action,
          discourse_user_id: pendingAction.user.id,
        },
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });

      if (fnError) throw new Error(await getFunctionErrorMessage(fnError));

      if (!data?.ok) {
        throw new Error(data?.error || 'Unable to update Discourse admin status.');
      }

      const updatedUser = data.user as DiscourseUser;

      setUsers((prev) =>
        prev.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
      );

      setSuccess(
        pendingAction.action === 'promote'
          ? `${displayName(updatedUser)} is now a Discourse admin.`
          : `${displayName(updatedUser)} is no longer a Discourse admin.`,
      );

      setPendingAction(null);
    } catch (err) {
      setError(`Failed to update Discourse admin status: ${getErrorMessage(err)}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AdminLayout activePage="discourse-admins" onNavigate={onNavigate}>
      <div className="space-y-6">
        <AdminPageHeader
          title="Discourse/Community Admins"
          description="Review Discourse users and promote or demote Discourse-only administrator access."
          actions={
            <AdminButton type="button" onClick={() => fetchUsers(page)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </AdminButton>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <AdminMetricCard title="Loaded Users" value={users.length} loading={loading} accent="info" />
          <AdminMetricCard title="Discourse Admins" value={adminCount} loading={loading} accent="warning" />
          <AdminMetricCard title="Filter" value={<span className="capitalize">{filter}</span>} accent="muted" />
        </div>

        <AdminFilterBar>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    filter === item.id
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <form name="discourse-admin-search" method="POST" data-netlify="true" onSubmit={handleSearchSubmit} className="flex w-full gap-2 lg:w-auto">
              <input type="hidden" name="form-name" value="discourse-admin-search" readOnly />
              <div className="relative flex-1 lg:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <AdminInput
                  type="search"
                  name="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search username or email"
                  className="pl-9"
                />
              </div>

              <AdminButton type="submit" disabled={loading} variant="primary">Search</AdminButton>
            </form>
          </div>
        </AdminFilterBar>

        {success && <AdminAlert variant="success">{success}</AdminAlert>}

        {error && <AdminAlert variant="error">{error}</AdminAlert>}

        <AdminTable>
          <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Admin
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                      <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-blue-500" />
                      Loading Discourse users…
                    </td>
                  </tr>
                )}

                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                      No Discourse users found for this filter.
                    </td>
                  </tr>
                )}

                {!loading &&
                  users.map((user) => {
                    const isSelf = Boolean(currentEmail && user.email?.trim().toLowerCase() === currentEmail);

                    return (
                      <tr key={user.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                              {user.admin ? (
                                <Crown className="h-5 w-5 text-amber-500" />
                              ) : (
                                <UserCheck className="h-5 w-5" />
                              )}
                            </div>

                            <div>
                              <p className="text-sm font-semibold text-slate-900">{displayName(user)}</p>
                              <p className="text-xs text-slate-500">
                                @{user.username || 'unknown'} · ID {user.id}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top text-sm text-slate-600">
                          {user.email || <span className="text-slate-400">No email returned</span>}
                        </td>

                        <td className="px-4 py-4 align-top">
                          <Badge label="Admin" enabled={user.admin} tone="purple" />
                        </td>

                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-wrap gap-1.5">
                            <Badge label="Active" enabled={user.active} tone="green" />
                            <Badge label="Moderator" enabled={user.moderator} tone="blue" />
                            <Badge label="Suspended" enabled={user.suspended} tone="red" />
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top text-right">
                          {user.admin ? (
                            <AdminButton
                              type="button"
                              variant="danger"
                              onClick={() => openAction('demote', user)}
                              disabled={isSelf || adminCount <= 1}
                              title={
                                isSelf
                                  ? 'You cannot demote yourself.'
                                  : adminCount <= 1
                                    ? 'Cannot demote the last loaded admin.'
                                    : undefined
                              }
                              size="sm"
                            >
                              <ShieldOff className="h-4 w-4" />
                              Demote Admin
                            </AdminButton>
                          ) : (
                            <AdminButton
                              type="button"
                              variant="primary"
                              onClick={() => openAction('promote', user)}
                              size="sm"
                            >
                              <Shield className="h-4 w-4" />
                              Promote Admin
                            </AdminButton>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
            <AdminButton
              type="button"
              onClick={() => fetchUsers(Math.max(0, page - 1))}
              disabled={loading || page === 0}
              size="sm"
            >
              Previous
            </AdminButton>

            <span className="text-sm text-slate-500">Page {page + 1}</span>

            <AdminButton
              type="button"
              onClick={() => fetchUsers(page + 1)}
              disabled={loading}
              size="sm"
            >
              Next
            </AdminButton>
          </div>
        </AdminTable>
      </div>

      {pendingAction && (
        <ConfirmationModal
          pendingAction={pendingAction}
          loading={actionLoading}
          onCancel={() => setPendingAction(null)}
          onConfirm={confirmAction}
        />
      )}
    </AdminLayout>
  );
}
