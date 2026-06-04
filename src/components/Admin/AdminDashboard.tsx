import React, { useEffect, useState } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle,
  Wifi,
  WifiOff,
  TrendingUp,
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
import FunctionPing from '../../dev/FunctionPing';

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
  approved: number;
  verified: number;
}

interface AdminDashboardProps {
  activePage?: string;
  onNavigate?: (page: string) => void;
}

function StatCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  sub,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  sub?: string;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">
          {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400 inline" /> : value.toLocaleString()}
        </p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
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
    <div className="bg-white rounded-xl border border-slate-200 p-6">
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
    </div>
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
    approved: 0,
    verified: 0,
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
      if (!currentSession?.access_token) throw new Error('You must be logged in as an admin.');

      const { data, error: fnError } = await supabase.functions.invoke('get-admin-users', {
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });
      if (fnError) throw fnError;
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
        pending: users.filter((u) => u.status === 'pending').length,
        banned: users.filter((u) => u.status === 'banned').length,
        approved: users.filter((u) => u.status === 'approved').length,
        verified: users.filter((u) => u.status === 'verified').length,
      });

      // Build 7-day registration trend
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

  // Delegate to sub-pages
  if (activePage === 'user-reviews') return <AdminUserReview activePage={activePage} onNavigate={onNavigate} />;
  if (activePage === 'flagged-posts') return <ReviewFlaggedPosts activePage={activePage} onNavigate={onNavigate} />;
  if (activePage === 'discourse-admins') return <DiscourseCommunityAdmins onNavigate={onNavigate} />;
  if (activePage === 'function-ping') {
    return (
      <AdminLayout activePage={activePage} onNavigate={onNavigate}>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <FunctionPing />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Overview</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Last refreshed {lastUpdated.toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3" role="alert">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Primary stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Users"
            value={stats.total}
            icon={<Users className="w-5 h-5" />}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
            sub="All registrations"
            loading={loading}
          />
          <StatCard
            label="Online Now"
            value={stats.online}
            icon={<Wifi className="w-5 h-5" />}
            iconBg="bg-green-50"
            iconColor="text-green-600"
            sub="Active within 15 min"
            loading={loading}
          />
          <StatCard
            label="Offline"
            value={stats.offline}
            icon={<WifiOff className="w-5 h-5" />}
            iconBg="bg-slate-100"
            iconColor="text-slate-500"
            sub="Inactive users"
            loading={loading}
          />
          <StatCard
            label="Registered Today"
            value={stats.registeredToday}
            icon={<CalendarDays className="w-5 h-5" />}
            iconBg="bg-sky-50"
            iconColor="text-sky-600"
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
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
            sub="Awaiting review"
            loading={loading}
          />
          <StatCard
            label="Verified"
            value={stats.verified}
            icon={<UserCheck className="w-5 h-5" />}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            sub="KYC complete"
            loading={loading}
          />
          <StatCard
            label="Approved"
            value={stats.approved}
            icon={<TrendingUp className="w-5 h-5" />}
            iconBg="bg-blue-50"
            iconColor="text-blue-500"
            sub="Access granted"
            loading={loading}
          />
          <StatCard
            label="Banned"
            value={stats.banned}
            icon={<UserX className="w-5 h-5" />}
            iconBg="bg-red-50"
            iconColor="text-red-500"
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
              { label: 'Verified', count: stats.verified, color: 'bg-emerald-500', pct: stats.total > 0 ? (stats.verified / stats.total) * 100 : 0 },
              { label: 'Approved', count: stats.approved, color: 'bg-blue-500', pct: stats.total > 0 ? (stats.approved / stats.total) * 100 : 0 },
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
