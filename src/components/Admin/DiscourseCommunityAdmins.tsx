import React, { useEffect, useMemo, useState } from "react";
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react";
import {
  Activity,
  Crown,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  ShieldOff,
  UserCheck,
  X,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import {
  AdminAlert,
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminEmptyState,
  AdminFilterBar,
  AdminInput,
  AdminMetricCard,
  AdminPageHeader,
  AdminSkeleton,
  AdminTable,
} from "./ui";

type DiscourseFlag =
  | "all"
  | "active"
  | "staff"
  | "suspended"
  | "new"
  | "blocked"
  | "suspect";

type AdminAction = "promote" | "demote";

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
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "staff", label: "Staff" },
  { id: "suspended", label: "Suspended" },
  { id: "new", label: "New" },
  { id: "blocked", label: "Blocked" },
  { id: "suspect", label: "Suspect" },
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  return "Unknown error";
}

async function getFunctionErrorMessage(error: unknown) {
  const fallback = getErrorMessage(error);
  const maybeContext = (error as { context?: unknown })?.context;

  const response =
    maybeContext instanceof Response
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
  return (
    user.name?.trim() ||
    user.username?.trim() ||
    user.email?.trim() ||
    `Discourse user #${user.id}`
  );
}

function CommunityRoleBadge({ user }: { user: DiscourseUser }) {
  if (user.admin) return <AdminBadge variant="warning">Admin</AdminBadge>;
  if (user.moderator) return <AdminBadge variant="brand">Moderator</AdminBadge>;

  return <AdminBadge variant="muted">Member</AdminBadge>;
}

function CommunityStatusBadge({ user }: { user: DiscourseUser }) {
  if (user.suspended) return <AdminBadge variant="danger">Suspended</AdminBadge>;
  if (user.active) return <AdminBadge variant="success">Active</AdminBadge>;

  return <AdminBadge variant="muted">Inactive</AdminBadge>;
}

function BooleanBadge({
  label,
  enabled,
  variant,
}: {
  label: string;
  enabled: boolean;
  variant: "success" | "danger" | "brand" | "warning" | "muted";
}) {
  return (
    <AdminBadge variant={enabled ? variant : "muted"}>
      {label}: {enabled ? "Yes" : "No"}
    </AdminBadge>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Not returned";

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function CommunityAdminSkeletonRows() {
  return (
    <>
      {[0, 1, 2].map((item) => (
        <tr key={item}>
          <td className="px-5 py-5">
            <div className="flex items-center gap-3">
              <AdminSkeleton className="h-10 w-10 rounded-full" />

              <div className="space-y-2">
                <AdminSkeleton className="h-4 w-36" />
                <AdminSkeleton className="h-3 w-24" />
              </div>
            </div>
          </td>

          <td className="px-5 py-5">
            <AdminSkeleton className="h-6 w-24 rounded-full" />
          </td>

          <td className="px-5 py-5">
            <AdminSkeleton className="h-6 w-28 rounded-full" />
          </td>

          <td className="px-5 py-5">
            <AdminSkeleton className="h-4 w-28" />
          </td>

          <td className="px-5 py-5 text-right">
            <AdminSkeleton className="ml-auto h-9 w-32" />
          </td>
        </tr>
      ))}
    </>
  );
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
  const isPromote = pendingAction.action === "promote";
  const userName = displayName(pendingAction.user);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {isPromote
                ? "Promote Discourse admin?"
                : "Demote Discourse admin?"}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              This changes Discourse admin status only. Tea Time Cari app admin
              access is not changed.
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-admin-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-admin-brand/20 disabled:opacity-50"
            aria-label="Close confirmation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-900">{userName}</p>

            <p className="text-xs text-slate-500">
              @{pendingAction.user.username || "unknown"} ·{" "}
              {pendingAction.user.email || "No email returned"}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Discourse user ID: {pendingAction.user.id}
            </p>
          </div>

          <p className="text-sm text-slate-600">
            {isPromote
              ? "Promoting this user grants administrator privileges inside Discourse."
              : "Demoting this user removes administrator privileges inside Discourse. Self-demotion and last-admin demotion are blocked server-side."}
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
            variant={isPromote ? "primary" : "danger"}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPromote ? "Promote Admin" : "Demote Admin"}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

export function DiscourseCommunityAdmins({
  onNavigate,
}: {
  onNavigate?: (page: string) => void;
}) {
  const supabase = useSupabaseClient();
  const session = useSession();

  const [users, setUsers] = useState<DiscourseUser[]>([]);
  const [filter, setFilter] = useState<DiscourseFlag>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const currentEmail = session?.user?.email?.trim().toLowerCase() || "";

  const adminCount = useMemo(
    () => users.filter((user) => user.admin).length,
    [users]
  );

  const moderatorCount = useMemo(
    () => users.filter((user) => user.moderator).length,
    [users]
  );

  const activeCount = useMemo(
    () => users.filter((user) => user.active && !user.suspended).length,
    [users]
  );

  const suspendedCount = useMemo(
    () => users.filter((user) => user.suspended).length,
    [users]
  );

  const hasActiveFilters = filter !== "all" || search.trim().length > 0;

  const fetchUsers = async (nextPage = page) => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!currentSession?.access_token) {
        throw new Error("You must be logged in as a Tea Time Cari admin.");
      }

      const { data, error: fnError } = await supabase.functions.invoke(
        "discourse-admin-users",
        {
          body: {
            action: "list",
            flag: filter,
            page: nextPage,
            search: search.trim() || undefined,
          },
          headers: {
            Authorization: `Bearer ${currentSession.access_token}`,
          },
        }
      );

      if (fnError) {
        throw new Error(await getFunctionErrorMessage(fnError));
      }

      if (!data?.ok) {
        throw new Error(data?.error || "Unable to load Discourse users.");
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

  const clearFilters = () => {
    setFilter("all");
    setSearch("");
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
        throw new Error("You must be logged in as a Tea Time Cari admin.");
      }

      const { data, error: fnError } = await supabase.functions.invoke(
        "discourse-admin-users",
        {
          body: {
            action: pendingAction.action,
            discourse_user_id: pendingAction.user.id,
          },
          headers: {
            Authorization: `Bearer ${currentSession.access_token}`,
          },
        }
      );

      if (fnError) {
        throw new Error(await getFunctionErrorMessage(fnError));
      }

      if (!data?.ok) {
        throw new Error(
          data?.error || "Unable to update Discourse admin status."
        );
      }

      const updatedUser = data.user as DiscourseUser;

      setUsers((prev) =>
        prev.map((user) => (user.id === updatedUser.id ? updatedUser : user))
      );

      setSuccess(
        pendingAction.action === "promote"
          ? `${displayName(updatedUser)} is now a Discourse admin.`
          : `${displayName(updatedUser)} is no longer a Discourse admin.`
      );

      setPendingAction(null);
    } catch (err) {
      setError(
        `Failed to update Discourse admin status: ${getErrorMessage(err)}`
      );
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AdminLayout activePage="discourse-admins" onNavigate={onNavigate}>
      <div className="space-y-6">
        <AdminPageHeader
          title="Community Admins"
          description="Manage community administrators, moderators, and access status for the Tea Time Cari community."
          actions={
            <AdminButton
              type="button"
              onClick={() => fetchUsers(page)}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh users
            </AdminButton>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <AdminMetricCard
            title="Loaded users"
            value={users.length}
            loading={loading}
            accent="info"
            icon={<UserCheck className="h-5 w-5" />}
            description="Returned by the current view"
          />

          <AdminMetricCard
            title="Admins"
            value={adminCount}
            loading={loading}
            accent="warning"
            icon={<Crown className="h-5 w-5" />}
            description="Community administrator role"
          />

          <AdminMetricCard
            title="Moderators"
            value={moderatorCount}
            loading={loading}
            accent="brand"
            icon={<Shield className="h-5 w-5" />}
            description="Community moderator role"
          />

          <AdminMetricCard
            title="Active"
            value={activeCount}
            loading={loading}
            accent="success"
            icon={<Activity className="h-5 w-5" />}
            description="Active and not suspended"
          />

          <AdminMetricCard
            title="Suspended"
            value={suspendedCount}
            loading={loading}
            accent="danger"
            icon={<ShieldOff className="h-5 w-5" />}
            description="Access restricted"
          />
        </div>

        <AdminFilterBar>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold text-admin-fg">
                Find community members
              </h2>

              {hasActiveFilters && (
                <AdminButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  Clear filters
                </AdminButton>
              )}
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFilter(item.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-admin-brand/20 ${
                      filter === item.id
                        ? "border-admin-brand bg-blue-50 text-blue-700"
                        : "border-admin-border bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <form
                name="discourse-admin-search"
                method="POST"
                data-netlify="true"
                onSubmit={handleSearchSubmit}
                className="flex w-full gap-2 lg:w-auto"
              >
                <input
                  type="hidden"
                  name="form-name"
                  value="discourse-admin-search"
                  readOnly
                />

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

                <AdminButton type="submit" disabled={loading} variant="primary">
                  Search
                </AdminButton>
              </form>
            </div>

            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 border-t border-admin-border pt-3">
                {filter !== "all" && (
                  <AdminBadge variant="info">
                    Filter: {FILTERS.find((item) => item.id === filter)?.label}
                  </AdminBadge>
                )}

                {search.trim() && (
                  <AdminBadge variant="neutral">
                    Search: {search.trim()}
                  </AdminBadge>
                )}
              </div>
            )}
          </div>
        </AdminFilterBar>

        {success && <AdminAlert variant="success">{success}</AdminAlert>}

        {error && <AdminAlert variant="error">{error}</AdminAlert>}

        <AdminTable>
          <table className="hidden min-w-full divide-y divide-admin-border md:table">
            <thead className="bg-admin-muted/70">
              <tr>
                {["User", "Role", "Status", "Activity", "Actions"].map(
                  (heading) => (
                    <th
                      key={heading}
                      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-admin-muted-fg ${
                        heading === "Actions" ? "text-right" : "text-left"
                      }`}
                    >
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-admin-border bg-admin-surface">
              {loading && <CommunityAdminSkeletonRows />}

              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <AdminEmptyState
                      icon={<UserCheck className="h-8 w-8" />}
                      title="No community admins match the current filters."
                      message="Try a different status filter, clear the search, or refresh the current page."
                      action={
                        <AdminButton
                          type="button"
                          variant="secondary"
                          onClick={() => fetchUsers(0)}
                        >
                          Retry load
                        </AdminButton>
                      }
                    />
                  </td>
                </tr>
              )}

              {!loading &&
                users.map((user) => {
                  const isSelf = Boolean(
                    currentEmail &&
                      user.email?.trim().toLowerCase() === currentEmail
                  );

                  const demoteDisabled = isSelf || adminCount <= 1;

                  return (
                    <tr
                      key={user.id}
                      className="transition-colors hover:bg-admin-muted/40"
                    >
                      <td className="px-5 py-5 align-top">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-admin-border bg-admin-muted text-admin-muted-fg">
                            {user.admin ? (
                              <Crown className="h-5 w-5 text-amber-500" />
                            ) : (
                              <UserCheck className="h-5 w-5" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-admin-fg">
                              {displayName(user)}
                            </p>

                            <p className="mt-0.5 text-xs text-admin-muted-fg">
                              @{user.username || "unknown"} · ID {user.id}
                            </p>

                            <p className="mt-1 text-xs text-admin-muted-fg">
                              {user.email || "No email returned"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-5 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          <CommunityRoleBadge user={user} />

                          <BooleanBadge
                            label="Admin"
                            enabled={user.admin}
                            variant="warning"
                          />

                          <BooleanBadge
                            label="Moderator"
                            enabled={user.moderator}
                            variant="brand"
                          />
                        </div>
                      </td>

                      <td className="px-5 py-5 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          <CommunityStatusBadge user={user} />

                          <BooleanBadge
                            label="Active"
                            enabled={user.active}
                            variant="success"
                          />

                          <BooleanBadge
                            label="Suspended"
                            enabled={user.suspended}
                            variant="danger"
                          />
                        </div>
                      </td>

                      <td className="px-5 py-5 align-top text-sm text-admin-muted-fg">
                        <div>Joined {formatDate(user.created_at)}</div>
                        <div className="mt-1">
                          Last seen {formatDate(user.last_seen_at)}
                        </div>
                        <div className="mt-1">
                          Trust level {user.trust_level ?? "Not returned"}
                        </div>
                      </td>

                      <td className="px-5 py-5 align-top text-right">
                        {user.admin ? (
                          <AdminButton
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => openAction("demote", user)}
                            disabled={demoteDisabled}
                            title={
                              isSelf
                                ? "You cannot demote yourself."
                                : adminCount <= 1
                                ? "Cannot demote the last loaded admin."
                                : undefined
                            }
                          >
                            <ShieldOff className="h-4 w-4" />
                            Demote
                          </AdminButton>
                        ) : (
                          <AdminButton
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => openAction("promote", user)}
                          >
                            <Shield className="h-4 w-4" />
                            Promote
                          </AdminButton>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>

          <div className="space-y-3 p-4 md:hidden">
            {loading &&
              [0, 1, 2].map((item) => (
                <AdminSkeleton key={item} className="h-44 w-full" />
              ))}

            {!loading && users.length === 0 && (
              <AdminEmptyState
                icon={<UserCheck className="h-8 w-8" />}
                title="No community admins match the current filters."
                message="Try clearing filters or refreshing the current page."
              />
            )}

            {!loading &&
              users.map((user) => {
                const isSelf = Boolean(
                  currentEmail &&
                    user.email?.trim().toLowerCase() === currentEmail
                );

                const demoteDisabled = isSelf || adminCount <= 1;

                return (
                  <AdminCard key={user.id} className="shadow-none">
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-admin-muted text-admin-muted-fg">
                          {user.admin ? (
                            <Crown className="h-5 w-5 text-amber-500" />
                          ) : (
                            <UserCheck className="h-5 w-5" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-admin-fg">
                            {displayName(user)}
                          </p>

                          <p className="text-xs text-admin-muted-fg">
                            @{user.username || "unknown"} · ID {user.id}
                          </p>

                          <p className="mt-1 break-words text-xs text-admin-muted-fg">
                            {user.email || "No email returned"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <CommunityRoleBadge user={user} />
                        <CommunityStatusBadge user={user} />

                        <BooleanBadge
                          label="Moderator"
                          enabled={user.moderator}
                          variant="brand"
                        />
                      </div>

                      <div className="rounded-admin-lg bg-admin-muted p-3 text-xs text-admin-muted-fg">
                        <p>Joined {formatDate(user.created_at)}</p>
                        <p className="mt-1">
                          Last seen {formatDate(user.last_seen_at)}
                        </p>
                        <p className="mt-1">
                          Trust level {user.trust_level ?? "Not returned"}
                        </p>
                      </div>

                      {user.admin ? (
                        <AdminButton
                          type="button"
                          variant="danger"
                          className="w-full"
                          onClick={() => openAction("demote", user)}
                          disabled={demoteDisabled}
                          title={
                            isSelf
                              ? "You cannot demote yourself."
                              : adminCount <= 1
                              ? "Cannot demote the last loaded admin."
                              : undefined
                          }
                        >
                          <ShieldOff className="h-4 w-4" />
                          Demote Admin
                        </AdminButton>
                      ) : (
                        <AdminButton
                          type="button"
                          variant="primary"
                          className="w-full"
                          onClick={() => openAction("promote", user)}
                        >
                          <Shield className="h-4 w-4" />
                          Promote Admin
                        </AdminButton>
                      )}
                    </div>
                  </AdminCard>
                );
              })}
          </div>

          <div className="flex items-center justify-between border-t border-admin-border bg-admin-muted px-4 py-3">
            <AdminButton
              type="button"
              onClick={() => fetchUsers(Math.max(0, page - 1))}
              disabled={loading || page === 0}
              size="sm"
              variant="secondary"
            >
              Previous
            </AdminButton>

            <span className="text-sm font-medium text-admin-muted-fg">
              Page {page + 1}
            </span>

            <AdminButton
              type="button"
              onClick={() => fetchUsers(page + 1)}
              disabled={loading}
              size="sm"
              variant="secondary"
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