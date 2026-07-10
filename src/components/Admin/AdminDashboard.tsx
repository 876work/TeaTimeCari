import React, { useEffect, useState } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  RefreshCw,
  Loader2,
  CheckCircle,
  Wifi,
  WifiOff,
  CalendarDays,
  ArrowRight,
  Flag,
  Database,
  Shield,
  HardDrive,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { AdminUserReview } from './ReviewUsers';
import { ReviewFlaggedPosts } from './ReviewFlaggedPosts';
import { DiscourseCommunityAdmins } from './DiscourseCommunityAdmins';
import { AdminAuditLogs } from './AdminAuditLogs';
import FunctionPing from '../../dev/FunctionPing';
import { getFunctionErrorMessage } from '@/lib/functionError';
import { normalizeApprovalStatus } from '@/lib/auth/approvalStatus';
import { AdminAlert, AdminButton, AdminCard, AdminMetricCard, AdminPageHeader } from './ui';

const ONLINE_THRESHOLD_MS = 15 * 60 * 1000;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const maybeError = error as { message?: unknown; error?: unknown; detail?: unknown; details?: unknown };
    const parts = [maybeError.message, maybeError.error, maybeError.detail, maybeError.details]
      .filter(Boolean)
      .map((part) => (typeof part === 'string' ? part : JSON.stringify(part)));
    if (parts.length > 0) return parts.join(': ');
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
  offline: number;
  registeredToday: number;
  pending: number;
  banned: number;
  suspended: number;
  approved: number;
}

interface AdminDashboardProps {
  activePage?: string;
  onNavigate?: (page: string) => void;
}

function StatCard({
  label,
  value,
  icon,
  sub,
  loading,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  sub?: string;
  loading: boolean;
  accent: 'brand' | 'success' | 'warning' | 'danger' | 'muted' | 'info';
}) {
  return (
    <AdminMetricCard
      title={label}
      value={value.toLocaleString()}
      icon={icon}
      description={sub}
      loading={loading}
      accent={accent}
    />
  );
}

function RegistrationChart({
  data,
  loading,
}: {
  data: DailyRegistration[];
  loading: boolean;
}) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <AdminCard>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">New Registrations</h3>
          <p className="text-xs text-slate-400 mt-0.5">Last 7 days</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
          <span className="text-xs text-slate-500">Registrations</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex items-end gap-2 h-32">
            {data.map((day) => {
              const heightPct = max > 0 ? (day.count / max) * 100 : 0;
              const dayLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'short',
              });

              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <div className="w-full flex flex-col justify-end" style={{ height: '112px' }}>
                    <div
                      title={`${day.count} registrations`}
                      className="w-full bg-blue-100 group-hover:bg-blue-200 rounded-t transition-colors relative"
                      style={{
                        height: `${Math.max(heightPct, day.count > 0 ? 6 : 0)}%`,
                        minHeight: day.count > 0 ? '6px' : '2px',
                      }}
                    >
                      {day.count > 0 && (
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-medium text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {day.count}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">{dayLabel}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{data.reduce((s, d) => s + d.count, 0)} total this week</span>
            <span>Peak: {max} in a day</span>
          </div>
        </>
      )}
    </AdminCard>
  );
}

export function AdminDashboard({ activePage = 'dashboard', onNavigate }: AdminDashboardProps) {
  const supabase = useSupabaseClient();
  const session = useSession();

  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    online: 0,
    offline: 0,
    registeredToday: 0,
    pending: 0,
    banned: 0,
    suspended: 0,
    approved: 0,
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
        throw new Error('You must be logged in as an admin.');
      }

      const { data, error: fnError } = await supabase.functions.invoke('get-admin-users', {
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });

      if (fnError) {
        throw new Error(await getFunctionErrorMessage(fnError));
      }

      if (!data?.ok) {
        throw new Error(
          [data?.error, data?.detail, data?.details]
            .filter(Boolean)
            .map((part) => (typeof part === 'string' ? part : JSON.stringify(part)))
            .join(': ') || 'Unable to load dashboard data.',
        );
      }

      const users: UserStat[] = (data.users || []).map((user: Partial<UserStat>) => ({
        status: user.status || 'unknown',
        created_at: user.created_at || null,
        last_seen_at: user.last_seen_at || null,
      }));

      const now = Date.now();

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const isOnline = (u: UserStat) => {
        if (!u.last_seen_at) return false;
        const t = new Date(u.last_seen_at).getTime();
        return Number.isFinite(t) && now - t <= ONLINE_THRESHOLD_MS;
      };

      const online = users.filter(isOnline).length;

      setStats({
        total: users.length,
        online,
        offline: users.length - online,
        registeredToday: users.filter((u) => u.created_at && new Date(u.created_at) >= todayStart).length,
        pending: users.filter((u) => normalizeApprovalStatus(u.status) === 'pending').length,
        banned: users.filter((u) => normalizeApprovalStatus(u.status) === 'banned').length,
        suspended: users.filter((u) => normalizeApprovalStatus(u.status) === 'suspended').length,
        approved: users.filter((u) => normalizeApprovalStatus(u.status) === 'approved').length,
      });

      const days: DailyRegistration[] = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        d.setHours(0, 0, 0, 0);

        const next = new Date(d);
        next.setDate(d.getDate() + 1);

        return {
          date: d.toISOString().split('T')[0],
          count: users.filter((u) => {
            if (!u.created_at) return false;
            const t = new Date(u.created_at);
            return t >= d && t < next;
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

  useEffect(() => {
    if (!isAdmin) {
      setError('Access denied.');
      setLoading(false);
      return;
    }

    fetchData();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const id = setInterval(fetchData, 30000);

    return () => clearInterval(id);
  }, [isAdmin]);

  if (activePage === 'user-reviews') return <AdminUserReview activePage={activePage} onNavigate={onNavigate} />;
  if (activePage === 'flagged-posts') return <ReviewFlaggedPosts activePage={activePage} onNavigate={onNavigate} />;
  if (activePage === 'discourse-admins') return <DiscourseCommunityAdmins onNavigate={onNavigate} />;
  if (activePage === 'logs') return <AdminAuditLogs activePage={activePage} onNavigate={onNavigate} />;

  if (activePage === 'function-ping') {
    return (
      <AdminLayout activePage={activePage} onNavigate={onNavigate}>
        <AdminCard>
          <FunctionPing />
        </AdminCard>
      </AdminLayout>
    );
  }

  const quickLinks = [
    { label: 'Review users', page: 'user-reviews', path: '/admin/users', icon: <Users className="w-4 h-4" /> },
    { label: 'Flagged posts', page: 'flagged-posts', path: '/admin/flagged-posts', icon: <Flag className="w-4 h-4" /> },
    { label: 'Discourse admins', page: 'discourse-admins', path: '/admin/discourse-admins', icon: <Shield className="w-4 h-4" /> },
    { label: 'Logs', page: 'logs', path: '/admin/logs', icon: <Database className="w-4 h-4" /> },
    { label: 'Health', page: 'function-ping', path: '/admin/health', icon: <HardDrive className="w-4 h-4" /> },
  ];

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className="space-y-6">
        {/* Page header */}
        <AdminPageHeader
          title="Overview"
          description="System health, registrations, and moderation shortcuts"
          actions={
            <>
              <p className="text-xs font-medium text-admin-muted-fg">Last refreshed at {lastUpdated.toLocaleTimeString()}</p>
              <AdminButton onClick={fetchData} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </AdminButton>
            </>
          }
        />

        {/* Error */}
        {error && <AdminAlert variant="error">{error}</AdminAlert>}

        {/* Quick links */}
        <AdminCard>
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Quick Links</h2>
            <p className="mt-1 text-xs text-slate-500">
              Jump to common admin routes without leaving the dashboard. Route docs:{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">docs/url-paths.md</code>; smoke checklist:{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">docs/smoke-test-checklist.md</code>.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {quickLinks.map((link) => (
              <button
                key={link.page}
                type="button"
                onClick={() => onNavigate?.(link.page)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <span className="text-slate-400">{link.icon}</span>
                <span>
                  <span className="block">{link.label}</span>
                  <span className="block text-xs font-normal text-slate-400">{link.path}</span>
                </span>
              </button>
            ))}
          </div>
        </AdminCard>

        {/* Primary stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Users"
            value={stats.total}
            icon={<Users className="w-5 h-5" />}
            accent="brand"
            sub="All registrations"
            loading={loading}
          />
          <StatCard
            label="Online Now"
            value={stats.online}
            icon={<Wifi className="w-5 h-5" />}
            accent="success"
            sub="Active within 15 min"
            loading={loading}
          />
          <StatCard
            label="Offline"
            value={stats.offline}
            icon={<WifiOff className="w-5 h-5" />}
            accent="muted"
            sub="Inactive users"
            loading={loading}
          />
          <StatCard
            label="Registered Today"
            value={stats.registeredToday}
            icon={<CalendarDays className="w-5 h-5" />}
            accent="info"
            sub="Since midnight"
            loading={loading}
          />
        </div>

        {/* Secondary stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Pending Approval"
            value={stats.pending}
            icon={<Clock className="w-5 h-5" />}
            accent="warning"
            sub="Awaiting review"
            loading={loading}
          />
          <StatCard
            label="Approved"
            value={stats.approved}
            icon={<UserCheck className="w-5 h-5" />}
            accent="success"
            sub="Access granted"
            loading={loading}
          />
          <StatCard
            label="Suspended"
            value={stats.suspended}
            icon={<UserX className="w-5 h-5" />}
            accent="warning"
            sub="Temporarily blocked"
            loading={loading}
          />
          <StatCard
            label="Banned"
            value={stats.banned}
            icon={<UserX className="w-5 h-5" />}
            accent="danger"
            sub="Restricted accounts"
            loading={loading}
          />
        </div>

        {/* Chart + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RegistrationChart data={dailyRegs} loading={loading} />
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button
                onClick={() => onNavigate?.('user-reviews')}
                className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-900">Review Users</p>
                    {stats.pending > 0 && (
                      <p className="text-xs text-amber-600 font-medium">{stats.pending} pending approval</p>
                    )}
                    {stats.pending === 0 && (
                      <p className="text-xs text-slate-500">Manage registrations</p>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-blue-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                onClick={() => onNavigate?.('flagged-posts')}
                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Flag className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-900">Flagged Posts</p>
                    <p className="text-xs text-slate-500">Content moderation</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">System Health</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Database', sub: 'Connected', icon: <Database className="w-5 h-5" /> },
              { label: 'Authentication', sub: 'Active', icon: <Shield className="w-5 h-5" /> },
              { label: 'Storage', sub: 'Operational', icon: <HardDrive className="w-5 h-5" /> },
            ].map(({ label, sub, icon }) => (
              <div key={label} className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl">
                <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-emerald-600">{icon}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{label}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                    <span className="text-xs text-emerald-700">{sub}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Registration breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">User Status Breakdown</h3>
          <div className="space-y-3">
            {[
              { label: 'Approved', count: stats.approved, color: 'bg-emerald-500', pct: stats.total > 0 ? (stats.approved / stats.total) * 100 : 0 },
              { label: 'Pending', count: stats.pending, color: 'bg-amber-400', pct: stats.total > 0 ? (stats.pending / stats.total) * 100 : 0 },
              { label: 'Banned', count: stats.banned, color: 'bg-red-400', pct: stats.total > 0 ? (stats.banned / stats.total) * 100 : 0 },
            ].map(({ label, count, color, pct }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-16 text-right flex-shrink-0">{label}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${color}`}
                    style={{ width: `${Math.max(pct, count > 0 ? 2 : 0)}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-slate-700 w-8 flex-shrink-0">{loading ? '—' : count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}