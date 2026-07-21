import React, { useEffect, useMemo, useState } from "react";
import { useSupabaseClient, useSession } from "@supabase/auth-helpers-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Users,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Wifi,
  CalendarDays,
  ArrowRight,
  CreditCard,
  Flag,
  HardDrive,
  FileText,
  Image as ImageIcon,
  Mail,
  Megaphone,
  MessageSquare,
  Radio,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { AdminUserReview } from "./ReviewUsers";
import { ReviewFlaggedPosts } from "./ReviewFlaggedPosts";
import { DiscourseCommunityAdmins } from "./DiscourseCommunityAdmins";
import { AdminAuditLogs } from "./AdminAuditLogs";
import { AdminInvites } from "./AdminInvites";
import { AdminPayments } from "./AdminPayments";
import { AdminAnnouncements } from "./AdminAnnouncements";
import { AdminAdvertising } from "./AdminAdvertising";
import { AdminRoles } from "./AdminRoles";
import { AdminFeatureFlags } from "./AdminFeatureFlags";
import { AdminAlerts } from "./AdminAlerts";
import { AdminSystemHealth } from "./AdminSystemHealth";
import {
  AdminButton,
  AdminCard,
  AdminBadge,
  AdminMetricCard,
} from "./ui";
import { getFunctionErrorMessage } from "@/lib/functionError";
import { normalizeApprovalStatus } from "@/lib/auth/approvalStatus";
import { getAdminSession } from "@/lib/adminAuth";

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

interface DailyCount {
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

function bucketLast7Days(dates: Array<string | null | undefined>): DailyCount[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date();

    day.setDate(day.getDate() - (6 - index));
    day.setHours(0, 0, 0, 0);

    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);

    return {
      date: day.toISOString().split("T")[0],
      count: dates.filter((value) => {
        if (!value) return false;

        const createdAt = new Date(value);

        return createdAt >= day && createdAt < nextDay;
      }).length,
    };
  });
}

function dayLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" });
}

type TooltipEntry = {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: { name?: string };
};

function GlassTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: React.ReactNode;
  payload?: TooltipEntry[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="admin-glass rounded-xl px-3 py-2 text-xs shadow-xl">
      {(label || label === 0) && <p className="mb-1 font-semibold text-white">{label}</p>}

      <div className="space-y-0.5">
        {payload.map((entry, index) => (
          <p key={index} className="flex items-center gap-1.5 text-white/80">
            <span
              className="h-2 w-2 flex-shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            {entry.name ?? entry.payload?.name}:{" "}
            <span className="font-semibold text-white">{entry.value}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function RegistrationTrendChart({ data, loading }: { data: DailyCount[]; loading: boolean }) {
  const total = data.reduce((sum, day) => sum + day.count, 0);
  const chartData = data.map((day) => ({ ...day, label: dayLabel(day.date) }));

  return (
    <AdminCard
      title="Registration activity"
      description="New account registrations over the last 7 days"
      actions={
        <AdminBadge>
          {loading ? "Loading" : `${formatNumber(total)} this week`}
        </AdminBadge>
      }
    >
      {loading ? (
        <div className="admin-skeleton-glass h-64 w-full rounded-2xl" aria-label="Loading registration activity" />
      ) : total === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center text-center">
          <CalendarDays className="h-8 w-8 text-white/40" />
          <p className="mt-3 text-sm font-medium text-white/70">No new registrations this week</p>
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="registrationFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.12)" />
              <XAxis
                dataKey="label"
                stroke="rgba(255,255,255,0.5)"
                tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                stroke="rgba(255,255,255,0.5)"
                tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip content={<GlassTooltip />} cursor={{ stroke: "rgba(255,255,255,0.3)", strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="count"
                name="Registrations"
                stroke="#ffffff"
                strokeWidth={2}
                fill="url(#registrationFill)"
                activeDot={{ r: 4, fill: "#ffffff" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </AdminCard>
  );
}

function ModerationTrendChart({ data, loading }: { data: DailyCount[]; loading: boolean }) {
  const total = data.reduce((sum, day) => sum + day.count, 0);
  const chartData = data.map((day) => ({ ...day, label: dayLabel(day.date) }));

  return (
    <AdminCard
      title="Moderation activity"
      description="Newly flagged posts over the last 7 days"
      actions={
        <AdminBadge variant="danger">
          {loading ? "Loading" : `${formatNumber(total)} this week`}
        </AdminBadge>
      }
    >
      {loading ? (
        <div className="admin-skeleton-glass h-56 w-full rounded-2xl" aria-label="Loading moderation activity" />
      ) : total === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center text-center">
          <Flag className="h-8 w-8 text-white/40" />
          <p className="mt-3 text-sm font-medium text-white/70">No newly flagged posts this week</p>
        </div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.12)" />
              <XAxis
                dataKey="label"
                stroke="rgba(255,255,255,0.5)"
                tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                stroke="rgba(255,255,255,0.5)"
                tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip content={<GlassTooltip />} cursor={{ fill: "rgba(255,255,255,0.08)" }} />
              <Bar dataKey="count" name="Flagged posts" fill="#D96E6E" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </AdminCard>
  );
}

type DonutSlice = { name: string; value: number; color: string };

function GlassDonut({
  title,
  description,
  data,
  totalLabel,
  loading,
}: {
  title: string;
  description: string;
  data: DonutSlice[];
  totalLabel?: string;
  loading: boolean;
}) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  const visibleSlices = data.filter((slice) => slice.value > 0);

  return (
    <AdminCard title={title} description={description}>
      {loading ? (
        <div className="admin-skeleton-glass h-48 w-full rounded-2xl" />
      ) : total === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center text-center">
          <p className="text-sm text-white/60">No data yet</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <div className="relative h-44 w-44 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={visibleSlices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="65%"
                  outerRadius="100%"
                  paddingAngle={visibleSlices.length > 1 ? 3 : 0}
                  stroke="none"
                >
                  {visibleSlices.map((slice) => (
                    <Cell key={slice.name} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip content={<GlassTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-white">{formatNumber(total)}</span>
              <span className="text-[11px] uppercase tracking-wide text-white/50">{totalLabel ?? "Total"}</span>
            </div>
          </div>

          <ul className="w-full min-w-0 space-y-2">
            {data.map((slice) => (
              <li key={slice.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-white/80">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                  <span className="truncate">{slice.name}</span>
                </span>
                <span className="flex-shrink-0 font-semibold text-white">{formatNumber(slice.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AdminCard>
  );
}

function GlassShortcutButton({
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
      className="group flex w-full items-center justify-between rounded-2xl border border-white/15 bg-white/5 p-4 text-left transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-purple"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/80 transition group-hover:bg-white/20 group-hover:text-white">
          {icon}
        </span>

        <span className="min-w-0">
          <span className="block text-sm font-semibold text-white">{label}</span>
          <span className="mt-0.5 block text-xs text-white/50">{description}</span>
        </span>
      </span>

      <ArrowRight className="h-4 w-4 flex-shrink-0 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white" />
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

  const [dailyRegs, setDailyRegs] = useState<DailyCount[]>([]);
  const [moderationTrend, setModerationTrend] = useState<DailyCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isOwner, setIsOwner] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const isAdmin = !!session?.user?.id;

  useEffect(() => {
    if (!isAdmin) return;
    getAdminSession()
      .then((admin) => setIsOwner(admin?.role === "owner"))
      .catch(() => setIsOwner(false));
  }, [isAdmin]);

  const fetchData = async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setLoading(true);
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
          body: { limit: 500, offset: 0 },
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

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const { data: flaggedRecent, error: flaggedRecentError } = await supabase
        .from("posts")
        .select("created_at")
        .gte("red_flag_count", 1)
        .gte("created_at", sevenDaysAgo.toISOString());

      if (flaggedRecentError && flaggedRecentError.code !== "42P01") {
        throw flaggedRecentError;
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

      setDailyRegs(bucketLast7Days(users.map((user) => user.created_at)));
      setModerationTrend(
        bucketLast7Days((flaggedRecent ?? []).map((post) => post.created_at as string | null))
      );
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

  // Live updates: refresh dashboard data when registrations or posts change,
  // instead of waiting for a manual refresh.
  useEffect(() => {
    if (!isAdmin) return;

    let refreshTimer: number | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer !== null) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void fetchData({ silent: true });
      }, 1500);
    };

    const channel = supabase
      .channel("admin-dashboard-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "registrations" },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        scheduleRefresh
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      setRealtimeConnected(false);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const totalAttentionItems = useMemo(
    () => stats.pending + moderationStats.flaggedPosts,
    [stats.pending, moderationStats.flaggedPosts]
  );

  const statusDonutData: DonutSlice[] = [
    { name: "Approved", value: stats.approved, color: "#34d399" },
    { name: "Pending", value: stats.pending, color: "#fbbf24" },
    { name: "Suspended", value: stats.suspended, color: "#fb923c" },
    { name: "Banned", value: stats.banned, color: "#f87171" },
  ];

  const presenceDonutData: DonutSlice[] = [
    { name: "Online in app", value: stats.onlineApp, color: "#4B9EC8" },
    { name: "Online in community", value: stats.onlineCommunity, color: "#9B6BAE" },
    { name: "Online in both", value: stats.onlineBoth, color: "#34d399" },
    { name: "Recently active", value: stats.recentlyActive, color: "#fbbf24" },
    { name: "Offline", value: stats.offline, color: "rgba(255,255,255,0.25)" },
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

  if (activePage === "invites") {
    return <AdminInvites activePage={activePage} onNavigate={onNavigate} />;
  }

  if (activePage === "payments") {
    return <AdminPayments activePage={activePage} onNavigate={onNavigate} />;
  }

  if (activePage === "announcements") {
    return <AdminAnnouncements activePage={activePage} onNavigate={onNavigate} />;
  }

  if (activePage === "advertising") {
    return <AdminAdvertising activePage={activePage} onNavigate={onNavigate} />;
  }

  if (activePage === "roles") {
    return <AdminRoles activePage={activePage} onNavigate={onNavigate} />;
  }

  if (activePage === "flags") {
    return <AdminFeatureFlags activePage={activePage} onNavigate={onNavigate} />;
  }

  if (activePage === "alerts") {
    return <AdminAlerts activePage={activePage} onNavigate={onNavigate} />;
  }

  if (activePage === "logs") {
    return <AdminAuditLogs activePage={activePage} onNavigate={onNavigate} />;
  }

  if (activePage === "function-ping") {
    return (
      <AdminSystemHealth
        activePage={activePage}
        onNavigate={onNavigate}
        isOwner={isOwner}
      />
    );
  }

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className="space-y-6">
        <div className="admin-glass rounded-3xl p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Overview
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/70">
                Users, moderation, and system status at a glance — highest-priority queues first.
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 sm:items-end">
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

                <AdminBadge>Last synced {formatTime(lastUpdated)}</AdminBadge>

                <AdminBadge variant={realtimeConnected ? "success" : "muted"}>
                  <Radio className="h-3.5 w-3.5" />
                  {realtimeConnected ? "Live" : "Polling"}
                </AdminBadge>
              </div>

              <AdminButton type="button" variant="glass" onClick={() => fetchData()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </AdminButton>
            </div>
          </div>
        </div>

        {error && (
          <div
            className="flex items-start gap-3 rounded-2xl border border-rose-300/30 bg-rose-500/15 p-4 backdrop-blur-xl"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-white" />

            <div>
              <p className="text-sm font-semibold text-white">
                Dashboard data could not be refreshed
              </p>

              <p className="mt-1 text-sm text-white/70">{error}</p>
            </div>
          </div>
        )}

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
            accent="info"
            description="Waiting for an admin decision"
            loading={loading}
          />

          <AdminMetricCard
            title="Flagged posts"
            value={loading ? "" : formatNumber(moderationStats.flaggedPosts)}
            icon={<Flag className="h-5 w-5" />}
            accent="danger"
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

        <div className="grid gap-6 xl:grid-cols-3">
          <AdminCard
            title="Needs attention"
            description="The highest-priority queues based on existing dashboard data."
            className="xl:col-span-2"
          >
            <div className="space-y-3">
              {loading ? (
                <>
                  <div className="admin-skeleton-glass h-20 rounded-2xl" />
                  <div className="admin-skeleton-glass h-20 rounded-2xl" />
                </>
              ) : totalAttentionItems === 0 ? (
                <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="mt-0.5 h-5 w-5 text-emerald-300" />

                    <div>
                      <p className="text-sm font-semibold text-white">All clear</p>

                      <p className="mt-1 text-sm text-white/70">
                        There are no pending user reviews or flagged posts requiring
                        immediate action.
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
                      className="flex w-full items-center justify-between rounded-2xl border border-amber-300/30 bg-amber-400/10 p-5 text-left transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-amber-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-purple"
                    >
                      <span className="flex items-start gap-3">
                        <Clock className="mt-0.5 h-5 w-5 text-amber-300" />

                        <span>
                          <span className="block text-sm font-semibold text-white">
                            {formatNumber(stats.pending)} pending user{" "}
                            {stats.pending === 1 ? "review" : "reviews"}
                          </span>

                          <span className="mt-1 block text-sm text-white/70">
                            Approve, reject, suspend, or ban from the existing user
                            review queue.
                          </span>
                        </span>
                      </span>

                      <ArrowRight className="h-4 w-4 flex-shrink-0 text-white/60" />
                    </button>
                  )}

                  {moderationStats.flaggedPosts > 0 && (
                    <button
                      type="button"
                      onClick={() => onNavigate?.("flagged-posts")}
                      className="flex w-full items-center justify-between rounded-2xl border border-rose-300/30 bg-rose-400/10 p-5 text-left transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-rose-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-purple"
                    >
                      <span className="flex items-start gap-3">
                        <Flag className="mt-0.5 h-5 w-5 text-rose-300" />

                        <span>
                          <span className="block text-sm font-semibold text-white">
                            {formatNumber(moderationStats.flaggedPosts)} flagged{" "}
                            {moderationStats.flaggedPosts === 1 ? "post" : "posts"}
                          </span>

                          <span className="mt-1 block text-sm text-white/70">
                            Review reported content in the existing moderation
                            workflow.
                          </span>
                        </span>
                      </span>

                      <ArrowRight className="h-4 w-4 flex-shrink-0 text-white/60" />
                    </button>
                  )}
                </>
              )}
            </div>
          </AdminCard>

          <AdminCard title="Quick actions" description="Shortcuts to existing admin destinations.">
            <div className="space-y-3">
              <GlassShortcutButton
                label="Users"
                description="Review and manage accounts"
                icon={<Users className="h-4 w-4" />}
                page="user-reviews"
                onNavigate={onNavigate}
              />

              <GlassShortcutButton
                label="Moderation"
                description="Review flagged posts"
                icon={<Flag className="h-4 w-4" />}
                page="flagged-posts"
                onNavigate={onNavigate}
              />

              <GlassShortcutButton
                label="Payments"
                description="Revenue and payment history"
                icon={<CreditCard className="h-4 w-4" />}
                page="payments"
                onNavigate={onNavigate}
              />

              <GlassShortcutButton
                label="Announcements"
                description="Banners and email broadcasts"
                icon={<Megaphone className="h-4 w-4" />}
                page="announcements"
                onNavigate={onNavigate}
              />

              <GlassShortcutButton
                label="Advertising"
                description="Banner ad management"
                icon={<ImageIcon className="h-4 w-4" />}
                page="advertising"
                onNavigate={onNavigate}
              />

              <GlassShortcutButton
                label="Community admins"
                description="Manage Discourse admins"
                icon={<MessageSquare className="h-4 w-4" />}
                page="discourse-admins"
                onNavigate={onNavigate}
              />

              <GlassShortcutButton
                label="Invites"
                description="Invite new members by email"
                icon={<Mail className="h-4 w-4" />}
                page="invites"
                onNavigate={onNavigate}
              />

              <GlassShortcutButton
                label="Audit logs"
                description="Open admin activity logs"
                icon={<FileText className="h-4 w-4" />}
                page="logs"
                onNavigate={onNavigate}
              />

              {isOwner && (
                <GlassShortcutButton
                  label="System health"
                  description="Open health checks"
                  icon={<HardDrive className="h-4 w-4" />}
                  page="function-ping"
                  onNavigate={onNavigate}
                />
              )}
            </div>
          </AdminCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-5">
          <div className="xl:col-span-3">
            <RegistrationTrendChart data={dailyRegs} loading={loading} />
          </div>

          <div className="xl:col-span-2">
            <GlassDonut
              title="User status"
              description="Current account approval and restriction mix"
              data={statusDonutData}
              totalLabel="Users"
              loading={loading}
            />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <GlassDonut
              title="Presence"
              description="Where members are active right now"
              data={presenceDonutData}
              totalLabel="Tracked"
              loading={loading}
            />
          </div>

          <div className="xl:col-span-3">
            <ModerationTrendChart data={moderationTrend} loading={loading} />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
