import React, { useEffect, useMemo, useState } from "react";
import { useSupabaseClient, useSession } from "@supabase/auth-helpers-react";
import {
  Users,
  Clock,
  RefreshCw,
  CheckCircle,
  Wifi,
  CalendarDays,
  ArrowRight,
  Flag,
  HardDrive,
  FileText,
  MessageSquare,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { AdminUserReview } from "./ReviewUsers";
import { ReviewFlaggedPosts } from "./ReviewFlaggedPosts";
import { DiscourseCommunityAdmins } from "./DiscourseCommunityAdmins";
import { AdminAuditLogs } from "./AdminAuditLogs";
import FunctionPing from "../../dev/FunctionPing";
import {
  AdminAlert,
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminMetricCard,
  AdminPageHeader,
  AdminSectionHeader,
  AdminSkeleton,
} from "./ui";
import { getFunctionErrorMessage } from "@/lib/functionError";
import { normalizeApprovalStatus } from "@/lib/auth/approvalStatus";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (error && typeof error === "object") {
    const maybeError = error as {
      message?: unknown;
      error?: unknown;
      detail?: unknown;
      details?: unknown;
    };

    const parts = [
      maybeError.message,
      maybeError.error,
      maybeError.detail,
      maybeError.details,
    ]
      .filter(Boolean)
      .map((part) =>
        typeof part === "string" ? part : JSON.stringify(part)
      );

    if (parts.length > 0) return parts.join(": ");

    return JSON.stringify(error);
  }

  return String(error);
}

interface UserStat {
  status: string;
  last_seen_at: string | null;
  created_at: string | null;
}

interface DailyRegistration {
  date: string;
  count: number;
}

interface DashboardStats {
  total: number;
  online: number;
  onlineApp: number;
  onlineCommunity: number;
  onlineBoth: number;
  recentlyActive: number;
  offline: number;
  unknown: number;
  registeredToday: number;
  pending: number;
  banned: number;
  suspended: number;
  approved: number;
}

interface ModerationStats {
  flaggedPosts: number;
  highRiskPosts: number;
}

interface AdminDashboardProps {
  activePage?: string;
  onNavigate?: (page: string) => void;
}

function formatNumber(value: number) {
  return value.toLocaleString();
}

function formatTime(value: Date) {
  return value.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
const RECENTLY_ACTIVE_THRESHOLD_MS = 15 * 60 * 1000;

function getAppPresenceStatus(lastSeenAt?: string | null) {
  if (!lastSeenAt) return "unknown";

  const time = new Date(lastSeenAt).getTime();

  if (!Number.isFinite(time)) return "unknown";

  const ageMs = Date.now() - time;

  if (ageMs <= ONLINE_THRESHOLD_MS) return "online_app";
  if (ageMs <= RECENTLY_ACTIVE_THRESHOLD_MS) return "recently_active";

  return "offline";
}

function countPresenceStatuses(rows: Array<{ presence_status?: string | null }>) {
  return rows.reduce((acc, row) => {
    const status = row.presence_status || "unknown";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function RegistrationChart({
  data,
  loading,
}: {
  data: DailyRegistration[];
  loading: boolean;
}) {
  const max = Math.max(...data.map((day) => day.count), 1);
  const total = data.reduce((sum, day) => sum + day.count, 0);

  return (
    <AdminCard>
      <AdminSectionHeader
        title="Registration activity"
        description="New account registrations over the last 7 days."
        action={
          <AdminBadge variant="brand">
            {loading ? "Loading" : `${formatNumber(total)} this week`}
          </AdminBadge>
        }
      />

      {loading ? (
        <div
          className="mt-8 grid h-52 grid-cols-7 items-end gap-3"
          aria-label="Loading registration activity"
        >
          {Array.from({ length: 7 }).map((_, index) => (
            <AdminSkeleton
              key={index}
              className="w-full"
              style={{ height: `${44 + index * 8}px` }}
            />
          ))}
        </div>
      ) : data.length === 0 || total === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-slate-400" />

          <p className="mt-3 text-sm font-medium text-slate-700">
            No new registrations this week
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Registration activity will appear here as accounts are created.
          </p>
        </div>
      ) : (
        <div className="mt-8">
          <div className="grid h-52 grid-cols-7 items-end gap-3 rounded-admin-xl border border-slate-100 bg-slate-50/60 p-4">
            {data.map((day) => {
              const heightPct = (day.count / max) * 100;

              const label = new Date(`${day.date}T00:00:00`).toLocaleDateString(
                "en-US",
                { weekday: "short" }
              );

              const dateLabel = new Date(
                `${day.date}T00:00:00`
              ).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });

              return (
                <div
                  key={day.date}
                  className="flex h-full min-w-0 flex-col items-center justify-end gap-2"
                >
                  <span className="text-xs font-semibold text-slate-600">
                    {day.count}
                  </span>

                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-md bg-admin-brand transition-colors hover:bg-admin-brand-hover"
                      title={`${day.count} registrations on ${dateLabel}`}
                      style={{
                        height: `${Math.max(
                          heightPct,
                          day.count > 0 ? 8 : 1
                        )}%`,
                      }}
                    />
                  </div>

                  <span className="text-xs text-slate-500">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AdminCard>
  );
}

function ShortcutButton({
  label,
  description,
  icon,
  page,
  onNavigate,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  page: string;
  onNavigate?: (page: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate?.(page)}
      className="group flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/60 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700">
          {icon}
        </span>

        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-900">
            {label}
          </span>

          <span className="mt-0.5 block text-xs text-slate-500">
            {description}
          </span>
        </span>
      </span>

      <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
    </button>
  );
}

export function AdminDashboard({
  activePage = "dashboard",
  onNavigate,
}: AdminDashboardProps) {
  const supabase = useSupabaseClient();
  const session = useSession();

  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    online: 0,
    onlineApp: 0,
    onlineCommunity: 0,
    onlineBoth: 0,
    recentlyActive: 0,
    offline: 0,
    unknown: 0,
    registeredToday: 0,
    pending: 0,
    banned: 0,
    suspended: 0,
    approved: 0,
  });

  const [moderationStats, setModerationStats] = useState<ModerationStats>({
    flaggedPosts: 0,
    highRiskPosts: 0,
  });

  const [dailyRegs, setDailyRegs] = useState<DailyRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const isAdmin = !!session?.user?.id;

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!currentSession?.access_token) {
        throw new Error("You must be logged in as an admin.");
      }

      const { data, error: fnError } = await supabase.functions.invoke(
        "get-admin-users",
        {
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
          [data?.error, data?.detail, data?.details]
            .filter(Boolean)
            .map((part) =>
              typeof part === "string" ? part : JSON.stringify(part)
            )
            .join(": ") || "Unable to load dashboard data."
        );
      }

      const users: UserStat[] = (data.users || []).map(
        (user: Partial<UserStat>) => ({
          status: user.status || "unknown",
          created_at: user.created_at || null,
          last_seen_at: user.last_seen_at || null,
        })
      );

      const { count: flaggedCount, error: flaggedError } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .gte("red_flag_count", 1);

      if (flaggedError && flaggedError.code !== "42P01") {
        throw flaggedError;
      }

      const { count: highRiskCount, error: highRiskError } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .gte("red_flag_count", 5);

      if (highRiskError && highRiskError.code !== "42P01") {
        throw highRiskError;
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      let presenceRows: Array<{
        user_id?: string;
        presence_status?: string | null;
      }> = [];

      try {
        const { data: presenceData, error: presenceError } =
          await supabase.functions.invoke("get-admin-presence", {
            headers: {
              Authorization: `Bearer ${currentSession.access_token}`,
            },
          });

        if (presenceError) {
          throw new Error(await getFunctionErrorMessage(presenceError));
        }

        if (presenceData?.ok && Array.isArray(presenceData.presence)) {
          presenceRows = presenceData.presence;
        }
      } catch (presenceError) {
        console.warn(
          "Community presence unavailable; dashboard totals will fall back to app activity where available.",
          presenceError
        );
      }

      if (presenceRows.length === 0) {
        presenceRows = users.map((user) => ({
          presence_status: getAppPresenceStatus(user.last_seen_at),
        }));
      }

      const statusCounts = countPresenceStatuses(presenceRows);

      const online =
        (statusCounts.online_app || 0) +
        (statusCounts.online_community || 0) +
        (statusCounts.online_both || 0);

      setStats({
        total: users.length,
        online,
        onlineApp: statusCounts.online_app || 0,
        onlineCommunity: statusCounts.online_community || 0,
        onlineBoth: statusCounts.online_both || 0,
        recentlyActive: statusCounts.recently_active || 0,
        offline: statusCounts.offline ?? Math.max(0, users.length - online),
        unknown: statusCounts.unknown || 0,
        registeredToday: users.filter(
          (user) =>
            user.created_at && new Date(user.created_at) >= todayStart
        ).length,
        pending: users.filter(
          (user) => normalizeApprovalStatus(user.status) === "pending"
        ).length,
        banned: users.filter(
          (user) => normalizeApprovalStatus(user.status) === "banned"
        ).length,
        suspended: users.filter(
          (user) => normalizeApprovalStatus(user.status) === "suspended"
        ).length,
        approved: users.filter(
          (user) => normalizeApprovalStatus(user.status) === "approved"
        ).length,
      });

      setModerationStats({
        flaggedPosts: flaggedCount ?? 0,
        highRiskPosts: highRiskCount ?? 0,
      });

      const days: DailyRegistration[] = Array.from({ length: 7 }, (_, index) => {
        const day = new Date();

        day.setDate(day.getDate() - (6 - index));
        day.setHours(0, 0, 0, 0);

        const nextDay = new Date(day);
        nextDay.setDate(day.getDate() + 1);

        return {
          date: day.toISOString().split("T")[0],
          count: users.filter((user) => {
            if (!user.created_at) return false;

            const createdAt = new Date(user.created_at);

            return createdAt >= day && createdAt < nextDay;
          }).length,
        };
      });

      setDailyRegs(days);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      setError(`Failed to load dashboard data: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchPresenceStats = async () => {
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!currentSession?.access_token) return;

      const { data: presenceData, error: presenceError } =
        await supabase.functions.invoke("get-admin-presence", {
          headers: {
            Authorization: `Bearer ${currentSession.access_token}`,
          },
        });

      if (
        presenceError ||
        !presenceData?.ok ||
        !Array.isArray(presenceData.presence)
      ) {
        return;
      }

      const statusCounts = countPresenceStatuses(presenceData.presence);

      const online =
        (statusCounts.online_app || 0) +
        (statusCounts.online_community || 0) +
        (statusCounts.online_both || 0);

      setStats((current) => ({
        ...current,
        total: Math.max(current.total, presenceData.presence.length),
        online,
        onlineApp: statusCounts.online_app || 0,
        onlineCommunity: statusCounts.online_community || 0,
        onlineBoth: statusCounts.online_both || 0,
        recentlyActive: statusCounts.recently_active || 0,
        offline: statusCounts.offline || 0,
        unknown: statusCounts.unknown || 0,
      }));

      setLastUpdated(new Date());
    } catch (presenceError) {
      console.warn("Presence stats refresh failed", presenceError);
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      setError("Access denied.");
      setLoading(false);
      return;
    }

    fetchData();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const id = setInterval(() => {
      if (document.visibilityState === "visible") void fetchPresenceStats();
    }, 60_000);

    return () => clearInterval(id);
  }, [isAdmin]);

  const totalAttentionItems = useMemo(
    () => stats.pending + moderationStats.flaggedPosts,
    [stats.pending, moderationStats.flaggedPosts]
  );

  const statusRows = [
    {
      label: "Approved",
      count: stats.approved,
      color: "bg-emerald-500",
      text: "text-emerald-700",
    },
    {
      label: "Pending",
      count: stats.pending,
      color: "bg-amber-400",
      text: "text-amber-700",
    },
    {
      label: "Suspended",
      count: stats.suspended,
      color: "bg-orange-400",
      text: "text-orange-700",
    },
    {
      label: "Banned",
      count: stats.banned,
      color: "bg-red-500",
      text: "text-red-700",
    },
  ];

  if (activePage === "user-reviews") {
    return <AdminUserReview activePage={activePage} onNavigate={onNavigate} />;
  }

  if (activePage === "flagged-posts") {
    return (
      <ReviewFlaggedPosts activePage={activePage} onNavigate={onNavigate} />
    );
  }

  if (activePage === "discourse-admins") {
    return <DiscourseCommunityAdmins onNavigate={onNavigate} />;
  }

  if (activePage === "logs") {
    return <AdminAuditLogs activePage={activePage} onNavigate={onNavigate} />;
  }

  if (activePage === "function-ping") {
    return (
      <AdminLayout activePage={activePage} onNavigate={onNavigate}>
        <AdminCard>
          <FunctionPing />
        </AdminCard>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className="space-y-6">
        <AdminPageHeader
          title="Overview"
          description="Users, moderation, and system status at a glance — highest-priority queues first."
          meta={`Last synced ${formatTime(lastUpdated)}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <AdminBadge
                variant={
                  error ? "danger" : totalAttentionItems > 0 ? "warning" : "success"
                }
              >
                {error
                  ? "Needs retry"
                  : totalAttentionItems > 0
                  ? `${formatNumber(totalAttentionItems)} need attention`
                  : "No urgent items"}
              </AdminBadge>

              <AdminButton type="button" onClick={fetchData} disabled={loading}>
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </AdminButton>
            </div>
          }
        />

        {error && (
          <AdminAlert variant="error">
            <p className="font-semibold">Dashboard data could not be refreshed</p>
            <p className="mt-1">{error}</p>
          </AdminAlert>
        )}

        <div className="grid gap-6 xl:grid-cols-3">
          <AdminCard className="xl:col-span-2">
            <AdminSectionHeader
              title="Needs attention"
              description="The highest-priority queues based on existing dashboard data."
            />

            <div className="mt-5 space-y-3">
              {loading ? (
                <>
                  <AdminSkeleton className="h-20" />
                  <AdminSkeleton className="h-20" />
                </>
              ) : totalAttentionItems === 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="mt-0.5 h-5 w-5 text-emerald-600" />

                    <div>
                      <p className="text-sm font-semibold text-emerald-900">
                        All clear
                      </p>

                      <p className="mt-1 text-sm text-emerald-700">
                        There are no pending user reviews or flagged posts
                        requiring immediate action.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {stats.pending > 0 && (
                    <button
                      type="button"
                      onClick={() => onNavigate?.("user-reviews")}
                      className="flex w-full items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-5 text-left transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-amber-100 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                    >
                      <span className="flex items-start gap-3">
                        <Clock className="mt-0.5 h-5 w-5 text-amber-700" />

                        <span>
                          <span className="block text-sm font-semibold text-amber-950">
                            {formatNumber(stats.pending)} pending user{" "}
                            {stats.pending === 1 ? "review" : "reviews"}
                          </span>

                          <span className="mt-1 block text-sm text-amber-700">
                            Approve, reject, suspend, or ban from the existing
                            user review queue.
                          </span>
                        </span>
                      </span>

                      <ArrowRight className="h-4 w-4 text-amber-700" />
                    </button>
                  )}

                  {moderationStats.flaggedPosts > 0 && (
                    <button
                      type="button"
                      onClick={() => onNavigate?.("flagged-posts")}
                      className="flex w-full items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-5 text-left transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-red-100 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    >
                      <span className="flex items-start gap-3">
                        <Flag className="mt-0.5 h-5 w-5 text-red-700" />

                        <span>
                          <span className="block text-sm font-semibold text-red-950">
                            {formatNumber(moderationStats.flaggedPosts)}{" "}
                            flagged{" "}
                            {moderationStats.flaggedPosts === 1
                              ? "post"
                              : "posts"}
                          </span>

                          <span className="mt-1 block text-sm text-red-700">
                            Review reported content in the existing moderation
                            workflow.
                          </span>
                        </span>
                      </span>

                      <ArrowRight className="h-4 w-4 text-red-700" />
                    </button>
                  )}
                </>
              )}
            </div>
          </AdminCard>

          <AdminCard>
            <AdminSectionHeader
              title="Quick actions"
              description="Shortcuts to existing admin destinations."
            />

            <div className="mt-5 space-y-3">
              <ShortcutButton
                label="Users"
                description="Review and manage accounts"
                icon={<Users className="h-4 w-4" />}
                page="user-reviews"
                onNavigate={onNavigate}
              />

              <ShortcutButton
                label="Moderation"
                description="Review flagged posts"
                icon={<Flag className="h-4 w-4" />}
                page="flagged-posts"
                onNavigate={onNavigate}
              />

              <ShortcutButton
                label="Community admins"
                description="Manage Discourse admins"
                icon={<MessageSquare className="h-4 w-4" />}
                page="discourse-admins"
                onNavigate={onNavigate}
              />

              <ShortcutButton
                label="Audit logs"
                description="Open admin activity logs"
                icon={<FileText className="h-4 w-4" />}
                page="logs"
                onNavigate={onNavigate}
              />

              <ShortcutButton
                label="System health"
                description="Open health checks"
                icon={<HardDrive className="h-4 w-4" />}
                page="function-ping"
                onNavigate={onNavigate}
              />
            </div>
          </AdminCard>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard
            title="Total users"
            value={loading ? "" : formatNumber(stats.total)}
            icon={<Users className="h-5 w-5" />}
            accent="brand"
            description="All admin-visible registrations"
            loading={loading}
          />

          <AdminMetricCard
            title="Pending reviews"
            value={loading ? "" : formatNumber(stats.pending)}
            icon={<Clock className="h-5 w-5" />}
            accent="warning"
            description="Waiting for an admin decision"
            loading={loading}
          />

          <AdminMetricCard
            title="Flagged posts"
            value={loading ? "" : formatNumber(moderationStats.flaggedPosts)}
            icon={<Flag className="h-5 w-5" />}
            accent={moderationStats.flaggedPosts > 0 ? "danger" : "muted"}
            description={`${formatNumber(moderationStats.highRiskPosts)} high risk (5+ red flags)`}
            loading={loading}
          />

          <AdminMetricCard
            title="Online now"
            value={loading ? "" : formatNumber(stats.online)}
            icon={<Wifi className="h-5 w-5" />}
            accent="success"
            description={`${stats.onlineApp + stats.onlineBoth} in app · ${
              stats.onlineCommunity + stats.onlineBoth
            } in community · ${stats.recentlyActive} recent`}
            loading={loading}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-5">
          <div className="xl:col-span-3">
            <RegistrationChart data={dailyRegs} loading={loading} />
          </div>

          <AdminCard className="xl:col-span-2">
            <AdminSectionHeader
              title="User status overview"
              description="Current account approval and restriction mix."
            />

            <div className="mt-6 space-y-4">
              {statusRows.map(({ label, count, color, text }) => {
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;

                return (
                  <div key={label}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className={`text-sm font-semibold ${text}`}>
                        {label}
                      </span>

                      <span className="text-sm font-medium text-slate-700">
                        {loading ? "—" : formatNumber(count)}
                      </span>
                    </div>

                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${color}`}
                        style={{
                          width: `${Math.max(
                            pct,
                            count > 0 ? 2 : 0
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </AdminCard>
        </div>

      </div>
    </AdminLayout>
  );
}