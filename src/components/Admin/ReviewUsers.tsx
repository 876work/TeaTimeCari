// src/components/Admin/ReviewUsers.tsx
import React, { useEffect, useState } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import {
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Camera,
  Users,
  Globe,
  MapPin,
  Clock,
  Ban,
  ExternalLink,
  X,
  AlertTriangle,
  Edit3,
  Copy,
  ShieldCheck,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { approveRegistration, retryDiscourseSync } from '@/features/admin/registrations/api/approveRegistration';
import { getFunctionErrorMessage } from '@/lib/functionError';
import { getAdminSession } from '@/lib/adminAuth';
import { normalizeApprovalStatus } from '@/lib/auth/approvalStatus';
import { AdminPresenceBadge, type AdminPresenceStatus, type AdminPresenceSource } from './ui';

const USERS_PAGE_SIZE = 10;

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
  registration_ip_header?: string | null;
  registration_ip_location?: string | null;
  registration_city?: string | null;
  registration_region?: string | null;
  registration_country?: string | null;
  registration_country_code?: string | null;
  registration_timezone?: string | null;
  registration_location_provider?: string | null;
  registration_location_status?: 'not_attempted' | 'success' | 'unavailable' | 'failed' | null;
  registration_browser?: string | null;
  registration_device?: string | null;
  registration_operating_system?: string | null;
  registration_user_agent?: string | null;
  registration_tracked_at?: string | null;
  last_login_at?: string | null;
  last_login_ip_address?: string | null;
  last_login_ip_header?: string | null;
  last_login_ip_location?: string | null;
  last_login_city?: string | null;
  last_login_region?: string | null;
  last_login_country?: string | null;
  last_login_country_code?: string | null;
  last_login_timezone?: string | null;
  last_login_location_provider?: string | null;
  last_login_location_status?: 'not_attempted' | 'success' | 'unavailable' | 'failed' | null;
  last_login_browser?: string | null;
  last_login_device?: string | null;
  last_login_operating_system?: string | null;
  last_login_user_agent?: string | null;
  last_seen_at?: string | null;
  app_last_seen_at?: string | null;
  app_last_login_at?: string | null;
  discourse_last_seen_at?: string | null;
  last_activity_at?: string | null;
  last_activity_source?: AdminPresenceSource;
  presence_status?: AdminPresenceStatus | null;
  presence_checked_at?: string | null;
  discourse_username?: string | null;
  discourse_user_id?: number | null;
  discourse_sync_status?: string | null;
  presence_error?: string | null;
}

type PresenceFilter = 'all' | 'online' | 'offline';
type SortBy = 'registration_desc' | 'registration_asc' | 'last_login_desc' | 'last_login_asc';
type ConfirmationAction = 'reject' | 'suspend' | 'unsuspend';
type EditableUser = Pick<UserRow, 'firstName' | 'lastName' | 'username' | 'email' | 'phone' | 'gender'>;

type AvailabilityConflict = {
  field: 'email' | 'username';
  value: string;
  message: string;
  suggestions?: string[];
};

interface PendingConfirmation {
  action: ConfirmationAction;
  user: UserRow;
  reason: string;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'banned' | 'suspended';

type TrackingStatus = {
  trackingFieldsAvailable: boolean;
  omittedFields: string[];
};

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

function genderAccessGroupLabel(gender?: UserRow['gender']) {
  if (gender === 'Male') return 'Men private category / men Discourse group';
  if (gender === 'Female') return 'Women private category / women Discourse group';

  return null;
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


function SummaryCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  helper,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  helper?: string;
}) {
  return (
    <div className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value.toLocaleString()}</p>
          {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
        </div>
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <span className={iconColor}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

function initialsFor(user: UserRow) {
  const name = safeDisplayName(user);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return initials || '?';
}

function CopyButton({ value, label }: { value?: string | null; label: string }) {
  if (!value) return null;

  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(value)}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

function registrationLocationDisplay(user: UserRow) {
  const cityCountry = [user.registration_city, user.registration_country].filter(Boolean).join(', ');
  if (cityCountry) return cityCountry;
  if (user.registration_ip_location?.trim()) return user.registration_ip_location.trim();
  if (!user.registration_tracked_at && !user.created_at) return 'No registration tracking recorded';
  if (!user.registration_ip_address) return 'IP unavailable';
  if (user.registration_location_status === 'failed') return 'Location lookup failed';
  if (user.registration_location_status === 'unavailable') return 'Location lookup unavailable';
  if (user.registration_location_status === 'not_attempted') return 'Location lookup not attempted';
  return 'Location lookup unavailable';
}

function loginLocationDisplay(user: UserRow) {
  const structured = [user.last_login_city, user.last_login_region, user.last_login_country].filter(Boolean).join(', ');
  if (structured) return structured;
  if (user.last_login_ip_location?.trim()) return user.last_login_ip_location.trim();
  if (!user.last_login_at) return 'No login recorded';
  if (!user.last_login_ip_address) return 'IP unavailable';
  if (user.last_login_location_status === 'failed') return 'Location lookup failed';
  if (user.last_login_location_status === 'unavailable') return 'Location lookup unavailable';
  if (user.last_login_location_status === 'not_attempted') return 'Location lookup not attempted';
  return 'Location lookup unavailable';
}

function DetailPanel({ user }: { user: UserRow }) {
  return (
    <div className="bg-slate-50 border-t border-slate-200 px-6 py-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-sky-200 p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-sky-500" />
            <h4 className="text-sm font-semibold text-slate-900">Gender Access Review</h4>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Self-selected gender" value={user.gender} />
            <Field label="Access controlled" value={genderAccessGroupLabel(user.gender)} />
          </dl>

          <p className="mt-4 rounded-lg bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-900">
            This selection controls the user's default private category, community feed visibility, and Discourse group sync.
            If the applicant reports a wrong selection, update access through the approved support/admin process without asking them to start over.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-slate-400" />
            <h4 className="text-sm font-semibold text-slate-900">Registration Tracking</h4>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Timestamp" value={formatDateTime(user.created_at)} />
            <Field label="IP Address" value={na(user.registration_ip_address)} />
            <Field label="IP Header" value={na(user.registration_ip_header)} />
            <Field label="Registered From" value={registrationLocationDisplay(user)} />
            <Field label="Country Code" value={na(user.registration_country_code)} />
            <Field label="Timezone" value={na(user.registration_timezone)} />
            <Field label="Location Provider" value={na(user.registration_location_provider)} />
            <Field label="Location Status" value={na(user.registration_location_status)} />
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
            <Field label="App Last Seen" value={formatDateTime(user.app_last_seen_at ?? user.last_seen_at)} />
            <Field label="App Last Login" value={formatDateTime(user.app_last_login_at ?? user.last_login_at)} />
            <Field label="Discourse Last Seen" value={formatDateTime(user.discourse_last_seen_at)} />
            <Field label="Last Activity" value={formatDateTime(user.last_activity_at)} />
            <Field label="Activity Source" value={user.last_activity_source ?? null} />
            <Field label="Presence Last Checked" value={formatDateTime(user.presence_checked_at)} />
            <Field label="Discourse Sync Status" value={na(user.discourse_sync_status)} />
            <Field label="Login IP" value={na(user.last_login_ip_address)} />
            <Field label="Login IP Header" value={na(user.last_login_ip_header)} />
            <Field label="Login Location" value={loginLocationDisplay(user)} />
            <Field label="Login Country Code" value={na(user.last_login_country_code)} />
            <Field label="Login Timezone" value={na(user.last_login_timezone)} />
            <Field label="Location Provider" value={na(user.last_login_location_provider)} />
            <Field label="Location Status" value={na(user.last_login_location_status)} />
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
            <Field label="Verification Visibility" value={user.imageData ? 'Restricted to authorized admin review; never public' : null} />
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
  const [currentPage, setCurrentPage] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>({ trackingFieldsAvailable: true, omittedFields: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [presenceWarning, setPresenceWarning] = useState<string | null>(null);
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
  const [editConflicts, setEditConflicts] = useState<AvailabilityConflict[]>([]);
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

  const isOnline = (u: UserRow) => ['online_app', 'online_community', 'online_both'].includes(u.presence_status ?? '');
  const isOffline = (u: UserRow) => (u.presence_status ?? 'unknown') === 'offline';

  const applyLocalAppPresenceFallback = (user: UserRow): UserRow => {
    if (user.presence_status || !user.last_seen_at) return user;

    const lastSeenTime = new Date(user.last_seen_at).getTime();
    if (!Number.isFinite(lastSeenTime)) return { ...user, presence_status: 'unknown' };

    const ageMs = Date.now() - lastSeenTime;

    return {
      ...user,
      app_last_seen_at: user.last_seen_at,
      app_last_login_at: user.last_login_at ?? null,
      last_activity_at: user.last_seen_at,
      last_activity_source: 'app',
      presence_status: ageMs <= 5 * 60 * 1000 ? 'online_app' : ageMs <= 15 * 60 * 1000 ? 'recently_active' : 'offline',
    };
  };

  type PresencePayload = { user_id: string; error?: string | null } & Partial<UserRow>;

  const mergePresenceIntoUsers = (rows: UserRow[], presenceById: Map<string, PresencePayload>) => rows.map((user) => {
    const p = presenceById.get(user.id);
    if (!p) return applyLocalAppPresenceFallback(user);

    return {
      ...user,
      app_last_seen_at: p.app_last_seen_at,
      app_last_login_at: p.app_last_login_at,
      discourse_last_seen_at: p.discourse_last_seen_at,
      last_activity_at: p.last_activity_at,
      last_activity_source: p.last_activity_source,
      presence_status: p.presence_status,
      presence_checked_at: p.presence_checked_at,
      discourse_username: p.discourse_username,
      discourse_user_id: p.discourse_user_id,
      discourse_sync_status: p.discourse_sync_status,
      presence_error: p.error,
    };
  });

  const loadPresence = async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s?.access_token) return new Map<string, PresencePayload>();

    const { data, error: fnErr } = await supabase.functions.invoke('get-admin-presence', {
      headers: { Authorization: `Bearer ${s.access_token}` },
    });

    if (fnErr) throw new Error(await getFunctionErrorMessage(fnErr));
    if (!data?.ok) throw new Error(data?.error || 'Unable to load presence.');

    setPresenceWarning(data.discourseUnavailable ? (data.error || 'Community presence unavailable') : null);

    return new Map<string, PresencePayload>((data.presence ?? []).map((p: PresencePayload) => [p.user_id, p]));
  };

  const fetchPresence = async () => {
    try {
      const presenceById = await loadPresence();
      setUsers((prev) => mergePresenceIntoUsers(prev, presenceById));
    } catch {
      setPresenceWarning(`Community presence unavailable. App presence is still shown when available.`);
    }
  };

  const fetchUsers = async (page = currentPage) => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session: s },
      } = await supabase.auth.getSession();

      if (!s?.access_token) throw new Error('You must be logged in as an admin.');

      const { data, error: fnErr } = await supabase.functions.invoke('get-admin-users', {
        body: { limit: USERS_PAGE_SIZE, offset: page * USERS_PAGE_SIZE },
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

      let usersWithPresence = mapped;
      try {
        usersWithPresence = mergePresenceIntoUsers(mapped, await loadPresence());
      } catch {
        setPresenceWarning(`Community presence unavailable. App presence is still shown when available.`);
      }

      setUsers(usersWithPresence);
      setTotalUsers(typeof data.total === 'number' ? data.total : mapped.length);
      setCurrentPage(page);
      setExpandedId(null);
      setTrackingStatus({
        trackingFieldsAvailable: data.trackingFieldsAvailable !== false,
        omittedFields: Array.isArray(data.omittedFields) ? data.omittedFields : [],
      });
      setLastUpdated(new Date());
    } catch (err) {
      setError(`Failed to fetch users: ${getErrorMessage(err)}`);
      setUsers([]);
      setTotalUsers(0);
      setTrackingStatus({ trackingFieldsAvailable: true, omittedFields: [] });
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

    fetchUsers(0);

    getAdminSession()
      .then((admin) => setIsOwner(admin?.role === 'owner'))
      .catch(() => setIsOwner(false));
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchPresence();
    }, 60_000);
    return () => window.clearInterval(id);
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
    setEditConflicts([]);
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
    setEditConflicts([]);
  };

  const handleEditFormChange = (field: keyof EditableUser, value: string) => {
    setEditConflicts((current) => current.filter((conflict) => conflict.field !== field));
    setEditForm((current) => ({
      ...current,
      [field]: field === 'gender' ? (value as UserRow['gender']) : value,
    }));
  };

  const handleSaveUserProfile = async () => {
    if (!editingUser) return;

    setProcessingId(editingUser.id);
    setError(null);
    setEditConflicts([]);

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
      if (!data?.ok) {
        if (Array.isArray(data?.conflicts)) setEditConflicts(data.conflicts);
        throw new Error(data?.message || data?.error || 'Failed to update user profile');
      }

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
    total: totalUsers,
    pending: users.filter((u) => normalizeApprovalStatus(u.status) === 'pending').length,
    approved: users.filter((u) => normalizeApprovalStatus(u.status) === 'approved').length,
    suspended: users.filter((u) => normalizeApprovalStatus(u.status) === 'suspended').length,
    banned: users.filter((u) => normalizeApprovalStatus(u.status) === 'banned').length,
    online: users.filter(isOnline).length,
    syncIssues: Object.values(actionMessages).filter((message) => message.canRetryDiscourse).length,
    recentlyActive: users.filter((u) => u.presence_status === 'recently_active').length,
    offline: users.filter(isOffline).length,
    unknown: users.filter((u) => !u.presence_status || u.presence_status === 'unknown').length,
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
          (presenceFilter === 'offline' && isOffline(u)))
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

  const clearFilters = () => {
    setSearch('');
    setFilterStatus('all');
    setPresenceFilter('all');
    setSortBy('registration_desc');
  };

  const hasActiveFilters = Boolean(search.trim()) || filterStatus !== 'all' || presenceFilter !== 'all' || sortBy !== 'registration_desc';
  const totalPages = Math.max(1, Math.ceil(totalUsers / USERS_PAGE_SIZE));
  const canGoPrevious = currentPage > 0;
  const canGoNext = (currentPage + 1) * USERS_PAGE_SIZE < totalUsers;
  const pageStart = totalUsers === 0 ? 0 : currentPage * USERS_PAGE_SIZE + 1;
  const pageEnd = currentPage * USERS_PAGE_SIZE + users.length;

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className="space-y-6">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-5 py-6 text-white sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                  <ShieldCheck className="h-3.5 w-3.5" /> Admin access review
                </div>
                <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">User Review Queue & Members</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Review registrations, manage account status, inspect verification details, and monitor member access without changing approval workflows.
                </p>
              </div>

              <div className="flex flex-col items-start gap-2 sm:items-end">
                <p className="text-xs font-medium text-slate-300">
                  Last refreshed: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Not loaded yet'}
                </p>

                <div className="flex items-center gap-2">
                  {discourseBaseUrl && (
                    <button
                      onClick={() => window.open(discourseBaseUrl, '_blank')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span className="hidden sm:inline">Community Forum</span>
                    </button>
                  )}

                  <button
                    onClick={() => fetchUsers(currentPage)}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-100 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
            </div>
          </div>
        </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Total members" value={summaryStats.total} helper="All registrations" icon={<Users className="w-5 h-5" />} iconBg="bg-blue-50" iconColor="text-blue-600" />
          <SummaryCard label="Pending review" value={summaryStats.pending} helper="Needs admin decision" icon={<Clock className="w-5 h-5" />} iconBg="bg-amber-50" iconColor="text-amber-600" />
          <SummaryCard label="Approved" value={summaryStats.approved} helper={`${summaryStats.online} online · ${summaryStats.recentlyActive} recent`} icon={<CheckCircle className="w-5 h-5" />} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
          <SummaryCard label="Access issues" value={summaryStats.suspended + summaryStats.banned + summaryStats.syncIssues} helper={`${summaryStats.suspended} suspended · ${summaryStats.banned} banned · ${summaryStats.syncIssues} sync`} icon={<AlertTriangle className="w-5 h-5" />} iconBg="bg-orange-50" iconColor="text-orange-600" />
        </div>

        {presenceWarning && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{presenceWarning}</div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3" role="alert">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {!trackingStatus.trackingFieldsAvailable && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
            <p className="text-sm font-semibold text-orange-900">Tracking schema warning</p>
            <p className="mt-1 text-sm text-orange-800">
              Some login tracking columns are missing from the active database, so affected fields may show troubleshooting placeholders instead of saved values.
              {trackingStatus.omittedFields.length > 0 ? ` Missing: ${trackingStatus.omittedFields.join(', ')}.` : ''}
            </p>
          </div>
        )}

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Discourse sync note</p>
          <p className="mt-1 text-sm text-amber-800">
            If approval succeeded but Discourse access failed, retry sync after checking Discourse settings.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Find the right account quickly</h3>
              <p className="text-xs text-slate-500">Search, filter by status or presence, and sort without changing the underlying member data.</p>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, phone, or username..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:w-auto">
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

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setFilterStatus('pending')} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100">Pending</button>
            <button type="button" onClick={() => setPresenceFilter('online')} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100">Online</button>
            <button type="button" onClick={() => setFilterStatus('suspended')} className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-200 hover:bg-orange-100">Suspended</button>
            {summaryStats.syncIssues > 0 && <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">{summaryStats.syncIssues} needs sync</span>}
          </div>

          <p className="text-xs text-slate-400 mt-3">
            Showing <span className="font-medium text-slate-600">{filtered.length}</span> filtered users from accounts {pageStart}-{pageEnd} of{' '}
            <span className="font-medium text-slate-600">{totalUsers}</span>
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
                  onClick={() => fetchUsers(currentPage)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
              )}
            </div>
          ) : (
            <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50/95 border-b border-slate-200 backdrop-blur">
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
                    const isExpanded = expandedId === user.id;
                    const isProcessing = processingId === user.id;
                    const normalizedStatus = normalizeApprovalStatus(user.status);

                    return (
                      <React.Fragment key={user.id}>
                        <tr className={`hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50' : ''}`}>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-slate-100 text-sm font-bold text-blue-700 ring-1 ring-slate-200">
                                {initialsFor(user)}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-950" title={safeDisplayName(user)}>{safeDisplayName(user)}</p>
                                <div className="mt-0.5 flex items-center gap-1">
                                  <p className="truncate text-xs text-slate-400" title={user.username ?? undefined}>@{user.username ?? '—'}</p>
                                  <CopyButton value={user.username} label="username" />
                                </div>
                                {actionMessages[user.id] && (
                                  <p className={`mt-1 max-w-xs text-xs ${actionMessages[user.id].type === 'success' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {actionMessages[user.id].message}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 hidden md:table-cell">
                            <div className="flex max-w-[260px] items-center gap-1">
                              <p className="truncate text-sm text-slate-700" title={user.email ?? undefined}>{user.email ?? <span className="text-slate-400">—</span>}</p>
                              <CopyButton value={user.email} label="email" />
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">{user.phone ?? '—'}</p>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex flex-col gap-1.5">
                              <StatusBadge status={user.status} />
                              <AdminPresenceBadge status={user.presence_status} appLastSeenAt={user.app_last_seen_at ?? user.last_seen_at} discourseLastSeenAt={user.discourse_last_seen_at} lastActivityAt={user.last_activity_at} source={user.last_activity_source} checkedAt={user.presence_checked_at} error={user.presence_error} />
                            </div>
                          </td>

                          <td className="px-5 py-4 hidden lg:table-cell">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${user.gender === 'Male' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'}`}>
                              {user.gender ?? '—'}
                            </span>
                          </td>

                          <td className="px-5 py-4 hidden lg:table-cell">
                            <p className="text-xs text-slate-700">{formatDateTime(user.created_at) ?? '—'}</p>
                            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {registrationLocationDisplay(user)}
                            </p>
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
                                  title="View restricted verification photo"
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
            <div className="divide-y divide-slate-100 md:hidden">
              {filtered.map((user) => {
                const isExpanded = expandedId === user.id;
                const isProcessing = processingId === user.id;
                const normalizedStatus = normalizeApprovalStatus(user.status);

                return (
                  <div key={`${user.id}-mobile`} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-slate-100 text-sm font-bold text-blue-700 ring-1 ring-slate-200">
                        {initialsFor(user)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-950">{safeDisplayName(user)}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <StatusBadge status={user.status} />
                          <AdminPresenceBadge status={user.presence_status} appLastSeenAt={user.app_last_seen_at ?? user.last_seen_at} discourseLastSeenAt={user.discourse_last_seen_at} lastActivityAt={user.last_activity_at} source={user.last_activity_source} checkedAt={user.presence_checked_at} error={user.presence_error} />
                        </div>
                        <p className="mt-2 truncate text-xs text-slate-500">{user.email ?? 'No email'}</p>
                        <p className="mt-1 text-xs text-slate-400">Registered {formatDateTime(user.created_at) ?? '—'}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => setExpandedId(isExpanded ? null : user.id)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">{isExpanded ? 'Hide details' : 'Details'}</button>
                      {user.imageData && <button onClick={() => setImageModal(user.imageData!)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Photo</button>}
                      {isOwner && <button onClick={() => openEditUser(user)} disabled={isProcessing} className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50">Edit</button>}
                      {normalizedStatus === 'pending' && <button onClick={() => handleApprove(user)} disabled={isProcessing} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">Approve</button>}
                      {normalizedStatus === 'pending' && <button onClick={() => requestConfirmation('reject', user)} disabled={isProcessing} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">Reject</button>}
                      {actionMessages[user.id]?.canRetryDiscourse && <button onClick={() => handleRetryDiscourseSync(user)} disabled={isProcessing} className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50">Retry sync</button>}
                      {normalizedStatus === 'approved' && <button onClick={() => requestConfirmation('suspend', user)} disabled={isProcessing} className="rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50">Suspend</button>}
                      {normalizedStatus === 'suspended' && <button onClick={() => requestConfirmation('unsuspend', user)} disabled={isProcessing} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">Unsuspend</button>}
                    </div>

                    {isExpanded && <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200"><DetailPanel user={user} /></div>}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Page <span className="font-semibold text-slate-700">{currentPage + 1}</span> of{' '}
                <span className="font-semibold text-slate-700">{totalPages}</span> · Loading {USERS_PAGE_SIZE} accounts at a time
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchUsers(currentPage - 1)}
                  disabled={!canGoPrevious || loading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Load previous 10 accounts"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>

                <button
                  type="button"
                  onClick={() => fetchUsers(currentPage + 1)}
                  disabled={!canGoNext || loading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Load next 10 accounts"
                >
                  Next 10
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            </>
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
                {editConflicts
                  .filter((conflict) => conflict.field === 'username')
                  .map((conflict) => (
                    <div key={`${conflict.field}-${conflict.value}`} className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                      <p>{conflict.message}</p>
                      {conflict.suggestions && conflict.suggestions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {conflict.suggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => handleEditFormChange('username', suggestion)}
                              className="rounded-full bg-white px-2 py-1 font-semibold text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
                            >
                              @{suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
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
                {editConflicts
                  .filter((conflict) => conflict.field === 'email')
                  .map((conflict) => (
                    <p key={`${conflict.field}-${conflict.value}`} className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                      {conflict.message}
                    </p>
                  ))}
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

            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 shadow-lg">
              <p className="font-semibold">Restricted verification photo</p>
              <p className="mt-1">Use only for registration review, safety, fraud prevention, legal, audit, or dispute needs. Do not copy, download, or share publicly.</p>
            </div>

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