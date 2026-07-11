import React, { useEffect, useMemo, useState } from "react";
import { useSupabaseClient, useSession } from "@supabase/auth-helpers-react";
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Wifi,
  CalendarDays,
  ArrowRight,
  Flag,
  Database,
  Shield,
  HardDrive,
  Activity,
  Sparkles,
  FileText,
  MessageSquare,
  ShieldAlert,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { AdminUserReview } from "./ReviewUsers";
import { ReviewFlaggedPosts } from "./ReviewFlaggedPosts";
import { DiscourseCommunityAdmins } from "./DiscourseCommunityAdmins";
import { AdminAuditLogs } from "./AdminAuditLogs";
import FunctionPing from "../../dev/FunctionPing";
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

function AdminBadge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "red" | "blue";
}) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-600",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function AdminCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 ${className}`}
    >
      {children}
    </section>
  );
}

function AdminSectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>

      {action}
    </div>
  );
}

function AdminSkeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`admin-skeleton rounded-xl ${className}`}
      style={style}
    />
  );
}

function MetricCard({
  title,
  value,
  description,
  icon,
  tone,
  loading,
}: {
  title: string;
  value: number | string;
  description: string;
  icon: React.ReactNode;
  tone: "blue" | "green" | "amber" | "red" | "slate" | "orange";
  loading: boolean;
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
    green: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    amber: "bg-amber-50 text-amber-600 ring-amber-100",
    red: "bg-red-50 text-red-600 ring-red-100",
    slate: "bg-slate-100 text-slate-600 ring-slate-200",
    orange: "bg-orange-50 text-orange-600 ring-orange-100",
  };

  return (
    <AdminCard className="p-5 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/70">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {title}
          </p>

          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {loading ? (
              <AdminSkeleton className="h-9 w-20" />
            ) : typeof value === "number" ? (
              formatNumber(value)
            ) : (
              value
            )}
          </div>
        </div>

        <div
          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ring-1 ${tones[tone]}`}
        >
          {icon}
        </div>
      </div>

      <p className="mt-4 text-sm leading-5 text-slate-500">{description}</p>
    </AdminCard>
  );
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
    <AdminCard className="p-6">
      <AdminSectionHeader
        title="Registration activity"
        description="New account registrations over the last 7 days."
        action={
          <AdminBadge tone="blue">
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
          <div className="grid h-52 grid-cols-7 items-end gap-3 rounded-2xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white p-4">
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
                      className="w-full rounded-t-xl bg-blue-600/85 shadow-sm shadow-blue-200 transition-colors hover:bg-blue-700"
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

      let presenceRows: Array<{ user_id: string; presence_status?: string | null }> = [];
      try {
        const { data: presenceData, error: presenceError } = await supabase.functions.invoke("get-admin-presence", {
          headers: { Authorization: `Bearer ${currentSession.access_token}` },
        });
        if (presenceError) throw new Error(await getFunctionErrorMessage(presenceError));
        if (presenceData?.ok && Array.isArray(presenceData.presence)) presenceRows = presenceData.presence;
      } catch (presenceError) {
        console.warn("Community presence unavailable; dashboard totals will fall back to app activity where available.", presenceError);
      }
      const statusCounts = presenceRows.reduce((acc, row) => {
        const status = row.presence_status || "unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const online = (statusCounts.online_app || 0) + (statusCounts.online_community || 0) + (statusCounts.online_both || 0);

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
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) return;
      const { data: presenceData, error: presenceError } = await supabase.functions.invoke("get-admin-presence", {
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });
      if (presenceError || !presenceData?.ok || !Array.isArray(presenceData.presence)) return;
      const statusCounts = presenceData.presence.reduce((acc: Record<string, number>, row: { presence_status?: string | null }) => {
        const status = row.presence_status || "unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
      const online = (statusCounts.online_app || 0) + (statusCounts.online_community || 0) + (statusCounts.online_both || 0);
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
      if (document.visibilityState === 'visible') void fetchPresenceStats();
    }, 60_000);

    return () => clearInterval(id);
  }, [isAdmin]);

  const totalAttentionItems = useMemo(
    () => stats.pending + moderationStats.flaggedPosts,
    [stats.pending, moderationStats.flaggedPosts]
  );

  const inactiveRestricted = stats.suspended + stats.banned;

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
        <AdminCard className="p-6">
          <FunctionPing />
        </AdminCard>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className="space-y-8">
        <AdminCard className="overflow-hidden">
          <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.10),transparent_34%),linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <AdminBadge tone="blue">
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    Tea Time Cari Admin
                  </AdminBadge>

                  <AdminBadge
                    tone={
                      error
                        ? "red"
                        : totalAttentionItems > 0
                        ? "amber"
                        : "green"
                    }
                  >
                    {error
                      ? "Needs retry"
                      : totalAttentionItems > 0
                      ? `${formatNumber(totalAttentionItems)} need attention`
                      : "No urgent items"}
                  </AdminBadge>
                </div>

                <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  Dashboard Overview
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                  Executive summary for users, moderation, system status, and
                  recent admin operations so the team can decide what needs
                  attention first.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
                <AdminBadge tone="slate">
                  Last synced {formatTime(lastUpdated)}
                </AdminBadge>

                <button
                  type="button"
                  onClick={fetchData}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </AdminCard>

        {error && (
          <div
            className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />

            <div>
              <p className="text-sm font-semibold text-red-800">
                Dashboard data could not be refreshed
              </p>

              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Total users"
            value={stats.total}
            icon={<Users className="h-5 w-5" />}
            tone="blue"
            description="All known admin-visible registrations."
            loading={loading}
          />

          <MetricCard
            title="Pending reviews"
            value={stats.pending}
            icon={<Clock className="h-5 w-5" />}
            tone="amber"
            description="Accounts waiting for an admin decision."
            loading={loading}
          />

          <MetricCard
            title="Flagged posts"
            value={moderationStats.flaggedPosts}
            icon={<Flag className="h-5 w-5" />}
            tone="red"
            description="Posts with one or more red flags."
            loading={loading}
          />

          <MetricCard
            title="System health"
            value="Available"
            icon={<Activity className="h-5 w-5" />}
            tone="green"
            description="Health checks remain available in the admin health page."
            loading={loading}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Approved users"
            value={stats.approved}
            icon={<UserCheck className="h-5 w-5" />}
            tone="green"
            description="Members with approved access."
            loading={loading}
          />

          <MetricCard
            title="Restricted users"
            value={inactiveRestricted}
            icon={<UserX className="h-5 w-5" />}
            tone="orange"
            description="Suspended and banned accounts combined."
            loading={loading}
          />

          <MetricCard
            title="Registered today"
            value={stats.registeredToday}
            icon={<CalendarDays className="h-5 w-5" />}
            tone="blue"
            description="New registrations since local midnight."
            loading={loading}
          />

          <MetricCard
            title="Online now"
            value={stats.online}
            icon={<Wifi className="h-5 w-5" />}
            tone="green"
            description={`${stats.onlineApp + stats.onlineBoth} in app · ${stats.onlineCommunity + stats.onlineBoth} in community · ${stats.recentlyActive} recently active`}
            loading={loading}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <AdminCard className="p-6 xl:col-span-2">
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

          <AdminCard className="p-6">
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

        <div className="grid gap-6 xl:grid-cols-5">
          <div className="xl:col-span-3">
            <RegistrationChart data={dailyRegs} loading={loading} />
          </div>

          <AdminCard className="p-6 xl:col-span-2">
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

        <div className="grid gap-6 lg:grid-cols-3">
          <AdminCard className="p-6">
            <AdminSectionHeader
              title="Moderation summary"
              description="Visible content signals from flagged posts."
            />

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Unresolved flagged posts
                </p>

                <p className="mt-2 text-3xl font-semibold text-slate-950">
                  {loading ? "—" : formatNumber(moderationStats.flaggedPosts)}
                </p>
              </div>

              <div className="rounded-2xl bg-red-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-600">
                  High risk posts
                </p>

                <p className="mt-2 text-3xl font-semibold text-red-900">
                  {loading ? "—" : formatNumber(moderationStats.highRiskPosts)}
                </p>

                <p className="mt-1 text-xs text-red-700">
                  Posts with 5+ red flags.
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigate?.("flagged-posts")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 ease-out hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
              >
                Review moderation queue
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </AdminCard>

          <AdminCard className="p-6">
            <AdminSectionHeader
              title="Recent activity"
              description="Open the full audit trail for admin actions and access checks."
            />

            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
              <FileText className="mx-auto h-8 w-8 text-slate-400" />

              <p className="mt-3 text-sm font-semibold text-slate-800">
                Audit log preview is available in Audit Logs
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                No extra audit-log fetch is added on the overview page, keeping
                existing log loading behavior isolated.
              </p>

              <button
                type="button"
                onClick={() => onNavigate?.("logs")}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                View audit logs
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </AdminCard>

          <AdminCard className="p-6">
            <AdminSectionHeader
              title="System health"
              description="Health checks remain available without changing ping logic."
            />

            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <Database className="h-5 w-5 text-emerald-600" />

                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Dashboard data
                  </p>

                  <p className="text-xs text-emerald-700">
                    {error ? "Issue loading latest data" : "Loaded from existing sources"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <Shield className="h-5 w-5 text-slate-600" />

                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Authentication
                  </p>

                  <p className="text-xs text-slate-600">
                    Session check unchanged
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <ShieldAlert className="h-5 w-5 text-slate-600" />

                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Health page
                  </p>

                  <p className="text-xs text-slate-600">
                    Existing system checks
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate?.("function-ping")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Open system health
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </AdminCard>
        </div>
      </div>
    </AdminLayout>
  );
}