// src/components/Admin/ReviewUsers.tsx
import React, { useEffect, useState } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import {
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  User,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Camera,
  Users,
  CalendarDays,
  Globe,
  MapPin,
  Clock,
  Ban,
  ExternalLink,
  X,
  AlertTriangle,
  Edit3,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { approveRegistration, retryDiscourseSync } from '@/features/admin/registrations/api/approveRegistration';
import { getFunctionErrorMessage } from '@/lib/functionError';
import { getAdminSession } from '@/lib/adminAuth';
import { normalizeApprovalStatus } from '@/lib/auth/approvalStatus';

const ONLINE_THRESHOLD_MS = 15 * 60 * 1000;

interface UserRow {
  id: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  username?: string | null;
  gender?: 'Male' | 'Female' | null;
  captureType?: 'selfie' | 'id' | null;
  imageData?: string | null;
  status: string;
  created_at?: string | null;
  password_temp?: string | null;
  rejection_reason?: string | null;
  email_code?: string | null;
  email_code_expiry?: string | null;
  last_code_sent_at?: string | null;
  last_code_delivery_status?: string | null;
  registration_ip_address?: string | null;
  registration_ip_location?: string | null;
  registration_browser?: string | null;
  registration_device?: string | null;
  registration_operating_system?: string | null;
  registration_user_agent?: string | null;
  registration_tracked_at?: string | null;
  last_login_at?: string | null;
  last_login_ip_address?: string | null;
  last_login_ip_location?: string | null;
  last_login_browser?: string | null;
  last_login_device?: string | null;
  last_login_operating_system?: string | null;
  last_login_user_agent?: string | null;
  last_seen_at?: string | null;
}

type PresenceFilter = 'all' | 'online' | 'offline';
type SortBy = 'registration_desc' | 'registration_asc' | 'last_login_desc' | 'last_login_asc';
type ConfirmationAction = 'reject' | 'suspend' | 'unsuspend';
type EditableUser = Pick<UserRow, 'firstName' | 'lastName' | 'username' | 'email' | 'phone' | 'gender'>;

interface PendingConfirmation {
  action: ConfirmationAction;
  user: UserRow;
  reason: string;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'banned' | 'suspended';

const safeDisplayName = (u: UserRow) => {
  const full = [u.fullName, [u.firstName, u.lastName].filter(Boolean).join(' ')].find(
    (s) => (s ?? '').trim(),
  );
  return (full ?? '').trim() || u.username || u.email || 'Unknown user';
};

const getErrorMessage = (err: unknown) => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const maybeError = err as { message?: unknown; error?: unknown; detail?: unknown; details?: unknown };
    const parts = [maybeError.message, maybeError.error, maybeError.detail, maybeError.details]
      .filter(Boolean)
      .map((part) => (typeof part === 'string' ? part : JSON.stringify(part)));
    if (parts.length > 0) return parts.join(': ');
    return JSON.stringify(err);
  }
  return String(err);
};

const fmt = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatDateTime = (value?: string | null) => {
  const d = fmt(value);
  if (!d) return null;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const na = (value?: string | null) => value?.trim() || null;

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="text-sm text-slate-800 font-medium break-all">
        {value?.trim() ? value.trim() : <span className="text-slate-400 font-normal">Not available</span>}
      </dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-slate-100 text-slate-600 border-slate-200',
    banned: 'bg-red-50 text-red-700 border-red-200',
    suspended: 'bg-orange-50 text-orange-700 border-orange-200',
  };

  const displayStatus = normalizeApprovalStatus(status);
  const cls = map[displayStatus] ?? 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1).replace('_', ' ')}
    </span>
  );
}

function PresenceBadge({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
        online ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
      }`}
    >
      {online ? (
        <span className="relative flex w-2 h-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full w-2 h-2 bg-green-500"></span>
        </span>
      ) : (
        <span className="w-2 h-2 rounded-full bg-slate-400 inline-block"></span>
      )}
      {online ? 'Online' : 'Offline'}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div>
        <p className="text-xl font-bold text-slate-900">{value.toLocaleString()}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function DetailPanel({ user }: { user: UserRow }) {
  return (
    <div className="bg-slate-50 border-t border-slate-200 px-6 py-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-slate-400" />
            <h4 className="text-sm font-semibold text-slate-900">Registration Tracking</h4>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Timestamp" value={formatDateTime(user.created_at)} />
            <Field label="IP Address" value={na(user.registration_ip_address)} />
            <Field label="Location" value={na(user.registration_ip_location)} />
            <Field label="Browser" value={na(user.registration_browser)} />
            <Field label="Device" value={na(user.registration_device)} />
            <Field label="Operating System" value={na(user.registration_operating_system)} />
          </dl>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-slate-400" />
            <h4 className="text-sm font-semibold text-slate-900">Login & Activity</h4>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Last Login" value={formatDateTime(user.last_login_at)} />
            <Field label="Last Seen" value={formatDateTime(user.last_seen_at)} />
            <Field label="Login IP" value={na(user.last_login_ip_address)} />
            <Field label="Login Location" value={na(user.last_login_ip_location)} />
            <Field label="Login Browser" value={na(user.last_login_browser)} />
            <Field label="Login Device" value={na(user.last_login_device)} />
            <Field label="Login OS" value={na(user.last_login_operating_system)} />
            <Field
              label="Photo Type"
              value={
                user.captureType === 'selfie'
                  ? 'Selfie'
                  : user.captureType === 'id'
                    ? 'ID Document'
                    : null
              }
            />
          </dl>
        </div>
      </div>
    </div>
  );
}

export function AdminUserReview({
  activePage = 'user-reviews',
  onNavigate,
}: {
  activePage?: string;
  onNavigate?: (page: string) => void;
}) {
  const supabase = useSupabaseClient();
  const session = useSession();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionMessages, setActionMessages] = useState<
    Record<string, { type: 'success' | 'warning'; message: string; canRetryDiscourse?: boolean }>
  >({});

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [presenceFilter, setPresenceFilter] = useState<PresenceFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('registration_desc');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [imageModal, setImageModal] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState<EditableUser>({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    phone: '',
    gender: 'Male',
  });

  const [discourseBaseUrl] = useState(() => import.meta.env.VITE_DISCOURSE_BASE_URL || '');

  const isAdmin = !!session?.user?.id;

  const isOnline = (u: UserRow) => {
    if (!u.last_seen_at) return false;
    const t = new Date(u.last_seen_at).getTime();
    return Number.isFinite(t) && Date.now() - t <= ONLINE_THRESHOLD_MS;
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session: s },
      } = await supabase.auth.getSession();

      if (!s?.access_token) throw new Error('You must be logged in as an admin.');

      const { data, error: fnErr } = await supabase.functions.invoke('get-admin-users', {
        headers: { Authorization: `Bearer ${s.access_token}` },
      });

      if (fnErr) throw new Error(await getFunctionErrorMessage(fnErr));

      if (!data?.ok) {
        throw new Error(
          [data?.error, data?.detail, data?.details]
            .filter(Boolean)
            .map((part) => (typeof part === 'string' ? part : JSON.stringify(part)))
            .join(': ') || 'Unable to load users.',
        );
      }

      const mapped: UserRow[] = (data.users ?? []).map((u: UserRow) => ({
        ...u,
        fullName: [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || null,
      }));

      setUsers(mapped);
      setLastUpdated(new Date());
    } catch (err) {
      setError(`Failed to fetch users: ${getErrorMessage(err)}`);
      setUsers([]);
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

    fetchUsers();

    getAdminSession()
      .then((admin) => setIsOwner(admin?.role === 'owner'))
      .catch(() => setIsOwner(false));
  }, [isAdmin]);

  const handleApprove = async (user: UserRow) => {
    if (!confirm(`Approve ${user.username ?? safeDisplayName(user)}?`)) return;

    setProcessingId(user.id);
    setError(null);

    try {
      const data = await approveRegistration(user.id);
      const status = data?.status ?? 'approved';
      const syncError = data?.discourse?.error || data?.discourse?.message || 'Discourse sync failed.';
      const emailError = data?.emails?.approved?.error || 'Approval email failed.';

      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: 'approved' } : u)));

      if (status === 'approved_with_sync_error') {
        setActionMessages((prev) => ({
          ...prev,
          [user.id]: {
            type: 'warning',
            message: `Approved, but Discourse sync needs attention: ${syncError}`,
            canRetryDiscourse: true,
          },
        }));
      } else if (status === 'approved_with_email_error') {
        setActionMessages((prev) => ({
          ...prev,
          [user.id]: {
            type: 'warning',
            message: `Approved, but the approval email needs attention: ${emailError}`,
          },
        }));
      } else {
        setActionMessages((prev) => ({
          ...prev,
          [user.id]: { type: 'success', message: 'Approved, emailed, and synced to Discourse.' },
        }));
      }
    } catch (err) {
      setError(`Failed to approve: ${getErrorMessage(err)}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRetryDiscourseSync = async (user: UserRow) => {
    setProcessingId(user.id);
    setError(null);

    try {
      const data = await retryDiscourseSync(user.id);
      const status = data?.status;

      if (status === 'discourse_sync_retried') {
        setActionMessages((prev) => ({
          ...prev,
          [user.id]: { type: 'success', message: 'Discourse sync retry completed successfully.' },
        }));
      } else {
        const syncError = data?.discourse?.error || data?.discourse?.message || 'Discourse sync retry failed.';
        setActionMessages((prev) => ({
          ...prev,
          [user.id]: { type: 'warning', message: syncError, canRetryDiscourse: true },
        }));
      }
    } catch (err) {
      setError(`Failed to retry Discourse sync: ${getErrorMessage(err)}`);
    } finally {
      setProcessingId(null);
    }
  };

  const openEditUser = (user: UserRow) => {
    setEditingUser(user);
    setEditForm({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      username: user.username ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      gender: user.gender ?? 'Male',
    });
  };

  const closeEditUser = () => {
    if (processingId) return;
    setEditingUser(null);
  };

  const handleEditFormChange = (field: keyof EditableUser, value: string) => {
    setEditForm((current) => ({
      ...current,
      [field]: field === 'gender' ? (value as UserRow['gender']) : value,
    }));
  };

  const handleSaveUserProfile = async () => {
    if (!editingUser) return;

    setProcessingId(editingUser.id);
    setError(null);

    try {
      const {
        data: { session: s },
      } = await supabase.auth.getSession();

      if (!s) throw new Error('Not authenticated.');

      const { data, error: fnErr } = await supabase.functions.invoke('admin-update-user-profile', {
        body: { registration_id: editingUser.id, ...editForm },
        headers: { Authorization: `Bearer ${s.access_token}` },
      });

      if (fnErr) throw new Error(await getFunctionErrorMessage(fnErr));
      if (!data?.ok) throw new Error(data?.error || 'Failed to update user profile');

      const updatedUser = data.user as Partial<UserRow>;

      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                ...updatedUser,
                fullName:
                  [updatedUser.firstName ?? editForm.firstName, updatedUser.lastName ?? editForm.lastName]
                    .filter(Boolean)
                    .join(' ')
                    .trim() || updatedUser.username || editForm.username || null,
              }
            : u,
        ),
      );

      const discourseWarning =
        data.discourse?.success === false
          ? `Profile saved, but Discourse sync needs attention: ${
              data.discourse?.error || data.discourse?.message || 'Sync failed.'
            }`
          : '';

      setActionMessages((prev) => ({
        ...prev,
        [editingUser.id]: {
          type: discourseWarning ? 'warning' : 'success',
          message: discourseWarning || 'Profile updated and synced across the app.',
        },
      }));

      setEditingUser(null);
    } catch (err) {
      setError(`Failed to update user profile: ${getErrorMessage(err)}`);
    } finally {
      setProcessingId(null);
    }
  };

  const requestConfirmation = (action: ConfirmationAction, user: UserRow) => {
    setPendingConfirmation({ action, user, reason: '' });
  };

  const closeConfirmation = () => {
    if (processingId) return;
    setPendingConfirmation(null);
  };

  const executeReject = async (user: UserRow, reason: string) => {
    setProcessingId(user.id);
    setError(null);

    try {
      const {
        data: { session: s },
      } = await supabase.auth.getSession();

      if (!s) throw new Error('Not authenticated.');

      const { data, error: fnErr } = await supabase.functions.invoke('send-rejection-email', {
        body: {
          registration_id: user.id,
          email: user.email,
          firstName: user.firstName,
          fullName: user.fullName,
          reason: reason || undefined,
        },
        headers: { Authorization: `Bearer ${s.access_token}` },
      });

      if (fnErr) throw new Error(await getFunctionErrorMessage(fnErr));
      if (!data?.success) throw new Error(data?.error || 'Failed to reject user');

      if (data?.status === 'rejected_with_email_error') {
        setActionMessages((prev) => ({
          ...prev,
          [user.id]: {
            type: 'warning',
            message: `Rejected, but rejection email needs attention: ${data.warning || 'Email failed.'}`,
          },
        }));
      }

      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: 'rejected' } : u)));
    } catch (err) {
      setError(`Failed to reject: ${getErrorMessage(err)}`);
    } finally {
      setProcessingId(null);
    }
  };

  const executeSuspension = async (user: UserRow, action: 'suspend' | 'unsuspend') => {
    setProcessingId(user.id);
    setError(null);

    try {
      const {
        data: { session: s },
      } = await supabase.auth.getSession();

      if (!s) throw new Error('Not authenticated.');

      const { data, error: fnErr } = await supabase.functions.invoke('admin-update-user-status', {
        body: { registration_id: user.id, action },
        headers: { Authorization: `Bearer ${s.access_token}` },
      });

      if (fnErr) throw new Error(await getFunctionErrorMessage(fnErr));
      if (!data?.ok) throw new Error(data?.error || 'Failed to update user status');

      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: data.status } : u)));
    } catch (err) {
      setError(`Failed to ${action === 'suspend' ? 'suspend user' : 'remove suspension'}: ${getErrorMessage(err)}`);
    } finally {
      setProcessingId(null);
    }
  };

  const confirmPendingAction = async () => {
    if (!pendingConfirmation) return;

    const { action, user, reason } = pendingConfirmation;

    if (action === 'reject') {
      await executeReject(user, reason);
    } else {
      await executeSuspension(user, action);
    }

    setPendingConfirmation(null);
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const summaryStats = {
    total: users.length,
    pending: users.filter((u) => normalizeApprovalStatus(u.status) === 'pending').length,
    approved: users.filter((u) => normalizeApprovalStatus(u.status) === 'approved').length,
    suspended: users.filter((u) => normalizeApprovalStatus(u.status) === 'suspended').length,
    online: users.filter(isOnline).length,
    offline: users.filter((u) => !isOnline(u)).length,
    today: users.filter((u) => u.created_at && new Date(u.created_at) >= todayStart).length,
  };

  const filtered = users
    .filter((u) => {
      const needle = search.trim().toLowerCase();
      const hay = [u.fullName, u.firstName, u.lastName, u.email, u.username, u.phone].map(
        (v) => (v ?? '').toLowerCase(),
      );

      return (
        (!needle || hay.some((h) => h.includes(needle))) &&
        (filterStatus === 'all' || normalizeApprovalStatus(u.status) === filterStatus) &&
        (presenceFilter === 'all' ||
          (presenceFilter === 'online' && isOnline(u)) ||
          (presenceFilter === 'offline' && !isOnline(u)))
      );
    })
    .sort((a, b) => {
      const ts = (v?: string | null) => (v ? new Date(v).getTime() || 0 : 0);

      switch (sortBy) {
        case 'registration_asc':
          return ts(a.created_at) - ts(b.created_at);
        case 'last_login_desc':
          return ts(b.last_login_at) - ts(a.last_login_at);
        case 'last_login_asc':
          return ts(a.last_login_at) - ts(b.last_login_at);
        default:
          return ts(b.created_at) - ts(a.created_at);
      }
    });

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">User Management</h2>
            <p className="text-sm text-slate-500 mt-0.5">View and manage all user registrations</p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <p className="text-xs font-medium text-slate-500">
              Last refreshed: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Not loaded yet'}
            </p>

            <div className="flex items-center gap-2">
              {discourseBaseUrl && (
                <button
                  onClick={() => window.open(discourseBaseUrl, '_blank')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline">Community Forum</span>
                </button>
              )}

              <button
                onClick={fetchUsers}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <SummaryCard label="Total Users" value={summaryStats.total} icon={<Users className="w-4 h-4" />} iconBg="bg-blue-50" iconColor="text-blue-600" />
          <SummaryCard label="Pending Approval" value={summaryStats.pending} icon={<Clock className="w-4 h-4" />} iconBg="bg-amber-50" iconColor="text-amber-600" />
          <SummaryCard label="Approved" value={summaryStats.approved} icon={<CheckCircle className="w-4 h-4" />} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
          <SummaryCard label="Suspended" value={summaryStats.suspended} icon={<Ban className="w-4 h-4" />} iconBg="bg-orange-50" iconColor="text-orange-600" />
          <SummaryCard label="Registered Today" value={summaryStats.today} icon={<CalendarDays className="w-4 h-4" />} iconBg="bg-sky-50" iconColor="text-sky-600" />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3" role="alert">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Discourse sync note</p>
          <p className="mt-1 text-sm text-amber-800">
            If approval succeeded but Discourse access failed, retry sync after checking Discourse settings.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, phone, or username..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="banned">Banned</option>
                <option value="suspended">Suspended</option>
              </select>

              <select
                value={presenceFilter}
                onChange={(e) => setPresenceFilter(e.target.value as PresenceFilter)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">All Users</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="registration_desc">Newest registrations</option>
                <option value="registration_asc">Oldest registrations</option>
                <option value="last_login_desc">Recent login first</option>
                <option value="last_login_asc">Oldest login first</option>
              </select>
            </div>
          </div>

          <div className="mt-3 space-y-1 text-xs text-slate-500">
            <p>Search by name, username, email, or phone.</p>
            <p>Online means active within the last 15 minutes.</p>
          </div>

          <p className="text-xs text-slate-400 mt-3">
            Showing <span className="font-medium text-slate-600">{filtered.length}</span> of{' '}
            <span className="font-medium text-slate-600">{users.length}</span> users
            {lastUpdated && <span className="ml-2">• Last refreshed at {lastUpdated.toLocaleTimeString()}</span>}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-sm text-slate-500">Loading users...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center">
                <Users className="w-7 h-7 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700">
                  {users.length === 0 ? 'No users found' : 'No users match your filters'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {users.length === 0
                    ? 'User registrations will appear here.'
                    : 'Try adjusting your search or filter criteria.'}
                </p>
              </div>
              {users.length === 0 && (
                <button
                  onClick={fetchUsers}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Contact</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Gender</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Registered</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden xl:table-cell">Last Login</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden xl:table-cell">IP / Browser</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filtered.map((user) => {
                    const online = isOnline(user);
                    const isExpanded = expandedId === user.id;
                    const isProcessing = processingId === user.id;
                    const normalizedStatus = normalizeApprovalStatus(user.status);

                    return (
                      <React.Fragment key={user.id}>
                        <tr className={`hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50' : ''}`}>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                                <User className="w-4 h-4 text-blue-500" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-900">{safeDisplayName(user)}</p>
                                <p className="text-xs text-slate-400">@{user.username ?? '—'}</p>
                                {actionMessages[user.id] && (
                                  <p className={`mt-1 max-w-xs text-xs ${actionMessages[user.id].type === 'success' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {actionMessages[user.id].message}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 hidden md:table-cell">
                            <p className="text-sm text-slate-700">{user.email ?? <span className="text-slate-400">—</span>}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{user.phone ?? '—'}</p>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex flex-col gap-1.5">
                              <StatusBadge status={user.status} />
                              <PresenceBadge online={online} />
                            </div>
                          </td>

                          <td className="px-5 py-4 hidden lg:table-cell">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${user.gender === 'Male' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'}`}>
                              {user.gender ?? '—'}
                            </span>
                          </td>

                          <td className="px-5 py-4 hidden lg:table-cell">
                            <p className="text-xs text-slate-700">{formatDateTime(user.created_at) ?? '—'}</p>
                            {user.registration_ip_location && (
                              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {user.registration_ip_location}
                              </p>
                            )}
                          </td>

                          <td className="px-5 py-4 hidden xl:table-cell">
                            <p className="text-xs text-slate-700">{formatDateTime(user.last_login_at) ?? '—'}</p>
                            {user.last_login_ip_location && (
                              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {user.last_login_ip_location}
                              </p>
                            )}
                          </td>

                          <td className="px-5 py-4 hidden xl:table-cell">
                            {user.registration_ip_address && (
                              <p className="text-xs text-slate-600 font-mono">{user.registration_ip_address}</p>
                            )}
                            {(user.registration_browser || user.registration_operating_system) && (
                              <p className="text-xs text-slate-400 mt-0.5">
                                {[user.registration_browser, user.registration_operating_system]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            )}
                            {!user.registration_ip_address && !user.registration_browser && (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : user.id)}
                                title={isExpanded ? 'Hide details' : 'View details'}
                                aria-label={`${isExpanded ? 'Hide' : 'View'} details for ${user.username || user.email}`}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>

                              {user.imageData && (
                                <button
                                  onClick={() => setImageModal(user.imageData!)}
                                  title="View photo"
                                  aria-label={`View registration photo for ${user.username || user.email}`}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                >
                                  <Camera className="w-4 h-4" />
                                </button>
                              )}

                              {isOwner && (
                                <button
                                  onClick={() => openEditUser(user)}
                                  disabled={isProcessing}
                                  title="Edit user profile"
                                  aria-label={`Edit ${user.username || user.email}`}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                                >
                                  <Edit3 className="w-4 h-4" />
                                  <span>Edit</span>
                                </button>
                              )}

                              {normalizedStatus === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleApprove(user)}
                                    disabled={isProcessing}
                                    title="Approve user"
                                    aria-label={`Approve ${user.username || user.email}`}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                  >
                                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                    <span>Approve</span>
                                  </button>

                                  <button
                                    onClick={() => requestConfirmation('reject', user)}
                                    disabled={isProcessing}
                                    title="Reject user"
                                    aria-label={`Reject ${user.username || user.email}`}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                                  >
                                    <XCircle className="w-4 h-4" />
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}

                              {actionMessages[user.id]?.canRetryDiscourse && (
                                <button
                                  onClick={() => handleRetryDiscourseSync(user)}
                                  disabled={isProcessing}
                                  title="Retry Discourse sync"
                                  aria-label={`Retry Discourse sync for ${user.username || user.email}`}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                                >
                                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                  <span>Retry sync</span>
                                </button>
                              )}

                              {normalizedStatus === 'approved' && (
                                <button
                                  onClick={() => requestConfirmation('suspend', user)}
                                  disabled={isProcessing}
                                  title="Suspend user"
                                  aria-label={`Suspend ${user.username || user.email}`}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-50 text-xs font-medium text-orange-700 hover:bg-orange-100 transition-colors disabled:opacity-50"
                                >
                                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                                  <span>Suspend</span>
                                </button>
                              )}

                              {normalizedStatus === 'suspended' && (
                                <button
                                  onClick={() => requestConfirmation('unsuspend', user)}
                                  disabled={isProcessing}
                                  title="Remove suspension"
                                  aria-label={`Remove suspension for ${user.username || user.email}`}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                >
                                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                  <span>Unsuspend</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className="p-0">
                              <div className="transition-all duration-200 animate-in slide-in-from-top-1">
                                <DetailPanel user={user} />
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="admin-edit-user-title">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="admin-edit-user-title" className="text-lg font-bold text-slate-900">Edit user profile</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Owner-only changes update registrations, profiles, posts, comments, Auth email, and Discourse group sync.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditUser}
                disabled={Boolean(processingId)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                aria-label="Close edit user dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                First name
                <input
                  value={editForm.firstName ?? ''}
                  onChange={(event) => handleEditFormChange('firstName', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Last name
                <input
                  value={editForm.lastName ?? ''}
                  onChange={(event) => handleEditFormChange('lastName', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Username
                <input
                  value={editForm.username ?? ''}
                  onChange={(event) => handleEditFormChange('username', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Email
                <input
                  type="email"
                  value={editForm.email ?? ''}
                  onChange={(event) => handleEditFormChange('email', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Phone
                <input
                  value={editForm.phone ?? ''}
                  onChange={(event) => handleEditFormChange('phone', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Gender category
                <select
                  value={editForm.gender ?? 'Male'}
                  onChange={(event) => handleEditFormChange('gender', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Male">Male / men category</option>
                  <option value="Female">Female / women category</option>
                </select>
              </label>
            </div>

            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
              Changing gender moves the user into the selected feed/category, removes the old Discourse gender group, and updates their existing posts/comments to the new category label.
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeEditUser}
                disabled={Boolean(processingId)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveUserProfile}
                disabled={Boolean(processingId) || !editForm.email?.trim() || !editForm.username?.trim()}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {processingId === editingUser.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                Save and sync
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="admin-confirmation-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>

              <div>
                <h2 id="admin-confirmation-title" className="text-lg font-bold text-slate-900">
                  {pendingConfirmation.action === 'reject'
                    ? 'Reject this application?'
                    : pendingConfirmation.action === 'suspend'
                      ? 'Suspend this user?'
                      : 'Remove suspension?'}
                </h2>

                <p className="mt-2 text-sm text-slate-600">
                  {safeDisplayName(pendingConfirmation.user)}
                  {pendingConfirmation.user.username && ` (@${pendingConfirmation.user.username})`}
                  {pendingConfirmation.user.email && ` • ${pendingConfirmation.user.email}`}
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  {pendingConfirmation.action === 'reject'
                    ? 'This marks the registration as rejected and sends a rejection email.'
                    : pendingConfirmation.action === 'suspend'
                      ? 'This prevents the user from logging in or using Tea Time Cari.'
                      : 'This restores the user status so access can resume according to their account state.'}
                </p>
              </div>
            </div>

            {pendingConfirmation.action === 'reject' && (
              <div className="mt-5">
                <label htmlFor="rejection-reason" className="block text-sm font-semibold text-slate-700">
                  Rejection reason (optional)
                </label>
                <textarea
                  id="rejection-reason"
                  value={pendingConfirmation.reason}
                  onChange={(event) =>
                    setPendingConfirmation((current) =>
                      current ? { ...current, reason: event.target.value } : current,
                    )
                  }
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add a short reason for the rejection email"
                />
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeConfirmation}
                disabled={Boolean(processingId)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmPendingAction}
                disabled={Boolean(processingId)}
                className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                  pendingConfirmation.action === 'reject'
                    ? 'bg-red-600 hover:bg-red-700'
                    : pendingConfirmation.action === 'suspend'
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {processingId === pendingConfirmation.user.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                {pendingConfirmation.action === 'reject'
                  ? 'Reject application'
                  : pendingConfirmation.action === 'suspend'
                    ? 'Suspend user'
                    : 'Remove suspension'}
              </button>
            </div>
          </div>
        </div>
      )}

      {imageModal && (
        <div
          className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50"
          onClick={() => setImageModal(null)}
        >
          <div className="relative max-w-2xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setImageModal(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-slate-100 transition-colors z-10"
            >
              <X className="w-4 h-4 text-slate-700" />
            </button>

            <img
              src={imageModal}
              alt="Registration photo"
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </AdminLayout>
  );
}