// src/components/Admin/ReviewUsers.tsx
import React, { useEffect, useState } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import {
  Check,
  CheckCircle,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Camera,
  Users,
  Globe,
  Clock,
  ExternalLink,
  X,
  AlertTriangle,
  Copy,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { approveRegistration, retryDiscourseSync } from '@/features/admin/registrations/api/approveRegistration';
import { getFunctionErrorMessage } from '@/lib/functionError';
import { getAdminSession } from '@/lib/adminAuth';
import { normalizeApprovalStatus } from '@/lib/auth/approvalStatus';
import {
  AdminAlert,
  AdminBadge,
  AdminButton,
  AdminEmptyState,
  AdminFilterBar,
  AdminIconButton,
  AdminInput,
  AdminMetricCard,
  AdminPageHeader,
  AdminPresenceBadge,
  AdminSelect,
  AdminSkeleton,
  type AdminPresenceStatus,
  type AdminPresenceSource,
} from './ui';
import { PRESENCE_ONLINE_MS, PRESENCE_RECENT_MS } from '@/lib/presenceConstants';

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

type PresenceSystemStatus = {
  appTracking?: { status?: 'healthy' | 'stale' | 'failing' | 'unknown'; lastSuccessfulActivityAt?: string | null; message?: string | null };
  communityTracking?: { status?: 'available' | 'unavailable' | 'degraded' | 'unknown'; checkedAt?: string | null; message?: string | null };
};

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
      <dt className="text-xs text-white/50 uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="text-sm text-white font-medium break-all">
        {value?.trim() ? value.trim() : <span className="text-white/40 font-normal">Not available</span>}
      </dd>
    </div>
  );
}

function genderAccessGroupLabel(gender?: UserRow['gender']) {
  if (gender === 'Male') return 'Men private category / men Discourse group';
  if (gender === 'Female') return 'Women private category / women Discourse group';

  return null;
}

const statusBadgeVariants: Record<string, 'success' | 'warning' | 'danger' | 'muted'> = {
  approved: 'success',
  pending: 'warning',
  suspended: 'warning',
  banned: 'danger',
  rejected: 'muted',
};

function StatusBadge({ status }: { status: string }) {
  const displayStatus = normalizeApprovalStatus(status);

  return (
    <AdminBadge variant={statusBadgeVariants[displayStatus] ?? 'muted'}>
      {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1).replace('_', ' ')}
    </AdminBadge>
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
  const [copied, setCopied] = useState(false);

  if (!value) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard write failed (e.g. permissions); no confirmation to show.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40"
      title={copied ? 'Copied!' : `Copy ${label}`}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
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
    <div className="border-t border-white/15 bg-white/5 px-6 py-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/15 bg-white/5 p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-brand-purple-light" />
            <h4 className="text-sm font-semibold text-white">Gender Access Review</h4>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Self-selected gender" value={user.gender} />
            <Field label="Access controlled" value={genderAccessGroupLabel(user.gender)} />
          </dl>

          <p className="mt-4 rounded-lg bg-white/10 px-3 py-2 text-xs leading-relaxed text-white/80">
            This selection controls the user's default private category, community feed visibility, and Discourse group sync.
            If the applicant reports a wrong selection, update access through the approved support/admin process without asking them to start over.
          </p>
        </div>

        <div className="rounded-xl border border-white/15 bg-white/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-white/40" />
            <h4 className="text-sm font-semibold text-white">Registration Tracking</h4>
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

        <div className="rounded-xl border border-white/15 bg-white/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-white/40" />
            <h4 className="text-sm font-semibold text-white">Login & Activity</h4>
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
  const [presenceSystemStatus, setPresenceSystemStatus] = useState<PresenceSystemStatus | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionMessages, setActionMessages] = useState<
    Record<string, { type: 'success' | 'warning'; message: string; canRetryDiscourse?: boolean }>
  >({});
  const [toast, setToast] = useState<{ type: 'success' | 'warning'; message: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(id);
  }, [toast]);

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
  const [editSaveError, setEditSaveError] = useState<string | null>(null);
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
      presence_status: ageMs <= PRESENCE_ONLINE_MS ? 'online_app' : ageMs <= PRESENCE_RECENT_MS ? 'recently_active' : 'offline',
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

    setPresenceSystemStatus(data.systemStatus ?? null);
    setPresenceWarning(data.systemStatus?.communityTracking?.status && data.systemStatus.communityTracking.status !== 'available' ? (data.systemStatus.communityTracking.message || 'Community presence unavailable. App presence remains available.') : null);

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
        const message = `Approved, but Discourse sync needs attention: ${syncError}`;
        setActionMessages((prev) => ({
          ...prev,
          [user.id]: { type: 'warning', message, canRetryDiscourse: true },
        }));
        setToast({ type: 'warning', message: `@${user.username ?? safeDisplayName(user)}: ${message}` });
      } else if (status === 'approved_with_email_error') {
        const message = `Approved, but the approval email needs attention: ${emailError}`;
        setActionMessages((prev) => ({
          ...prev,
          [user.id]: { type: 'warning', message },
        }));
        setToast({ type: 'warning', message: `@${user.username ?? safeDisplayName(user)}: ${message}` });
      } else {
        const message = 'Approved, emailed, and synced to Discourse.';
        setActionMessages((prev) => ({
          ...prev,
          [user.id]: { type: 'success', message },
        }));
        setToast({ type: 'success', message: `@${user.username ?? safeDisplayName(user)} — ${message}` });
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
    setEditSaveError(null);
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
    setEditSaveError(null);
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
    setEditSaveError(null);
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
      setEditSaveError(getErrorMessage(err));
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

  const appTrackingHealth = presenceSystemStatus?.appTracking?.status;
  const communityHealth = presenceSystemStatus?.communityTracking?.status;
  const communityDown = Boolean(communityHealth && communityHealth !== 'available' && communityHealth !== 'unknown');
  const systemNotices = [
    appTrackingHealth && appTrackingHealth !== 'healthy' && appTrackingHealth !== 'unknown'
      ? `App activity tracking is ${appTrackingHealth} — last recorded activity ${formatDateTime(presenceSystemStatus?.appTracking?.lastSuccessfulActivityAt) ?? 'unknown'}.`
      : null,
    communityDown
      ? 'Community activity could not be checked. App presence is still shown.'
      : null,
    presenceWarning && !communityDown ? presenceWarning : null,
    !trackingStatus.trackingFieldsAvailable
      ? `Some tracking columns are missing from the database${trackingStatus.omittedFields.length > 0 ? ` (${trackingStatus.omittedFields.join(', ')})` : ''}, so affected fields may be empty.`
      : null,
  ].filter((notice): notice is string => Boolean(notice));
  const totalPages = Math.max(1, Math.ceil(totalUsers / USERS_PAGE_SIZE));
  const canGoPrevious = currentPage > 0;
  const canGoNext = (currentPage + 1) * USERS_PAGE_SIZE < totalUsers;
  const pageStart = totalUsers === 0 ? 0 : currentPage * USERS_PAGE_SIZE + 1;
  const pageEnd = currentPage * USERS_PAGE_SIZE + users.length;

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      {toast && (
        <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4 sm:justify-end sm:pr-8" role="status">
          <div className="w-full max-w-sm">
            <AdminAlert variant={toast.type === 'success' ? 'success' : 'warning'}>
              <p>{toast.message}</p>
            </AdminAlert>
          </div>
        </div>
      )}
      <div className="space-y-6">
        <AdminPageHeader
          title="Users"
          description="Review registrations, manage account status, and monitor member access."
          meta={lastUpdated ? `Last refreshed ${lastUpdated.toLocaleTimeString()}` : undefined}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {discourseBaseUrl && (
                <AdminButton
                  type="button"
                  variant="glass"
                  onClick={() => window.open(discourseBaseUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                  Community forum
                </AdminButton>
              )}

              <AdminButton
                type="button"
                variant="glass"
                onClick={() => fetchUsers(currentPage)}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </AdminButton>
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard title="Total members" value={summaryStats.total} description="All registrations" icon={<Users className="h-5 w-5" />} accent="brand" />
          <AdminMetricCard title="Pending review" value={summaryStats.pending} description="Needs an admin decision" icon={<Clock className="h-5 w-5" />} accent="warning" />
          <AdminMetricCard title="Approved" value={summaryStats.approved} description={`${summaryStats.online} online · ${summaryStats.recentlyActive} recent`} icon={<CheckCircle className="h-5 w-5" />} accent="success" />
          <AdminMetricCard title="Access issues" value={summaryStats.suspended + summaryStats.banned + summaryStats.syncIssues} description={`${summaryStats.suspended} suspended · ${summaryStats.banned} banned · ${summaryStats.syncIssues} sync`} icon={<AlertTriangle className="h-5 w-5" />} accent={summaryStats.suspended + summaryStats.banned + summaryStats.syncIssues > 0 ? 'danger' : 'muted'} />
        </div>

        {error && <AdminAlert variant="error">{error}</AdminAlert>}

        {systemNotices.length > 0 && (
          <AdminAlert variant="warning">
            {systemNotices.map((notice) => (
              <p key={notice}>{notice}</p>
            ))}
          </AdminAlert>
        )}

        <AdminFilterBar>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <AdminInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, phone, or username…"
                className="pl-9"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:w-auto">
              <AdminSelect value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}>
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="banned">Banned</option>
                <option value="suspended">Suspended</option>
              </AdminSelect>

              <AdminSelect value={presenceFilter} onChange={(e) => setPresenceFilter(e.target.value as PresenceFilter)}>
                <option value="all">All users</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </AdminSelect>

              <AdminSelect value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
                <option value="registration_desc">Newest registrations</option>
                <option value="registration_asc">Oldest registrations</option>
                <option value="last_login_desc">Recent login first</option>
                <option value="last_login_asc">Oldest login first</option>
              </AdminSelect>
            </div>

            {hasActiveFilters && (
              <AdminButton type="button" variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </AdminButton>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {(
              [
                { label: 'Pending', apply: () => setFilterStatus('pending') },
                { label: 'Online', apply: () => setPresenceFilter('online') },
                { label: 'Suspended', apply: () => setFilterStatus('suspended') },
              ] as const
            ).map(({ label, apply }) => (
              <button
                key={label}
                type="button"
                onClick={apply}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
              >
                {label}
              </button>
            ))}
            {summaryStats.syncIssues > 0 && (
              <AdminBadge variant="danger">{summaryStats.syncIssues} needs sync</AdminBadge>
            )}
          </div>

          <p className="mt-3 text-xs text-white/50">
            Showing <span className="font-medium text-white/80">{filtered.length}</span> filtered users from accounts {pageStart}-{pageEnd} of{' '}
            <span className="font-medium text-white/80">{totalUsers}</span>
          </p>
        </AdminFilterBar>

        <div className="admin-glass overflow-hidden rounded-3xl">
          {loading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2, 3, 4].map((item) => (
                <AdminSkeleton key={item} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <AdminEmptyState
              icon={<Users className="h-8 w-8" />}
              title={users.length === 0 ? 'No users found' : 'No users match your filters'}
              message={
                users.length === 0
                  ? 'User registrations will appear here.'
                  : 'Try adjusting your search or filter criteria.'
              }
              action={
                users.length === 0 ? (
                  <AdminButton type="button" variant="primary" onClick={() => fetchUsers(currentPage)}>
                    <RefreshCw className="h-4 w-4" />
                    Retry
                  </AdminButton>
                ) : (
                  <AdminButton type="button" variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </AdminButton>
                )
              }
            />
          ) : (
            <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-white/15 bg-white/10 backdrop-blur">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wider">User</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wider hidden md:table-cell">Contact</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wider hidden lg:table-cell">Gender</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wider hidden lg:table-cell">Registered</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-white/50 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {filtered.map((user) => {
                    const isExpanded = expandedId === user.id;
                    const isProcessing = processingId === user.id;
                    const normalizedStatus = normalizeApprovalStatus(user.status);

                    return (
                      <React.Fragment key={user.id}>
                        <tr className={`hover:bg-white/5 transition-colors ${isExpanded ? 'bg-white/5' : ''}`}>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white ring-1 ring-white/15">
                                {initialsFor(user)}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white" title={safeDisplayName(user)}>{safeDisplayName(user)}</p>
                                <div className="mt-0.5 flex items-center gap-1">
                                  <p className="truncate text-xs text-white/50" title={user.username ?? undefined}>@{user.username ?? '—'}</p>
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
                              <p className="truncate text-sm text-white/80" title={user.email ?? undefined}>{user.email ?? <span className="text-white/40">—</span>}</p>
                              <CopyButton value={user.email} label="email" />
                            </div>
                            <p className="text-xs text-white/50 mt-0.5">{user.phone ?? '—'}</p>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex flex-col gap-1.5">
                              <StatusBadge status={user.status} />
                              <AdminPresenceBadge status={user.presence_status} appLastSeenAt={user.app_last_seen_at ?? user.last_seen_at} discourseLastSeenAt={user.discourse_last_seen_at} lastActivityAt={user.last_activity_at} source={user.last_activity_source} checkedAt={user.presence_checked_at} error={user.presence_error} communityUnavailable={presenceSystemStatus?.communityTracking?.status === 'unavailable'} />
                            </div>
                          </td>

                          <td className="px-5 py-4 hidden lg:table-cell">
                            <AdminBadge variant="neutral">{user.gender ?? '—'}</AdminBadge>
                          </td>

                          <td className="px-5 py-4 hidden lg:table-cell">
                            <p className="text-xs text-white/70">{formatDateTime(user.created_at) ?? '—'}</p>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <AdminIconButton
                                onClick={() => setExpandedId(isExpanded ? null : user.id)}
                                label={`${isExpanded ? 'Hide' : 'View'} details for ${user.username || user.email}`}
                              >
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </AdminIconButton>

                              {user.imageData && (
                                <AdminIconButton
                                  onClick={() => setImageModal(user.imageData!)}
                                  label={`View verification photo for ${user.username || user.email}`}
                                >
                                  <Camera className="h-4 w-4" />
                                </AdminIconButton>
                              )}

                              {isOwner && (
                                <AdminButton
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => openEditUser(user)}
                                  disabled={isProcessing}
                                  aria-label={`Edit ${user.username || user.email}`}
                                >
                                  Edit
                                </AdminButton>
                              )}

                              {normalizedStatus === 'pending' && (
                                <>
                                  <AdminButton
                                    size="sm"
                                    variant="success"
                                    onClick={() => handleApprove(user)}
                                    loading={isProcessing}
                                    aria-label={`Approve ${user.username || user.email}`}
                                  >
                                    Approve
                                  </AdminButton>

                                  <AdminButton
                                    size="sm"
                                    variant="danger"
                                    onClick={() => requestConfirmation('reject', user)}
                                    disabled={isProcessing}
                                    aria-label={`Reject ${user.username || user.email}`}
                                  >
                                    Reject
                                  </AdminButton>
                                </>
                              )}

                              {actionMessages[user.id]?.canRetryDiscourse && (
                                <AdminButton
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleRetryDiscourseSync(user)}
                                  loading={isProcessing}
                                  aria-label={`Retry Discourse sync for ${user.username || user.email}`}
                                >
                                  Retry sync
                                </AdminButton>
                              )}

                              {normalizedStatus === 'approved' && (
                                <AdminButton
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => requestConfirmation('suspend', user)}
                                  disabled={isProcessing}
                                  aria-label={`Suspend ${user.username || user.email}`}
                                >
                                  Suspend
                                </AdminButton>
                              )}

                              {normalizedStatus === 'suspended' && (
                                <AdminButton
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => requestConfirmation('unsuspend', user)}
                                  disabled={isProcessing}
                                  aria-label={`Remove suspension for ${user.username || user.email}`}
                                >
                                  Unsuspend
                                </AdminButton>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="p-0">
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
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white ring-1 ring-white/15">
                        {initialsFor(user)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{safeDisplayName(user)}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <StatusBadge status={user.status} />
                          <AdminPresenceBadge status={user.presence_status} appLastSeenAt={user.app_last_seen_at ?? user.last_seen_at} discourseLastSeenAt={user.discourse_last_seen_at} lastActivityAt={user.last_activity_at} source={user.last_activity_source} checkedAt={user.presence_checked_at} error={user.presence_error} communityUnavailable={presenceSystemStatus?.communityTracking?.status === 'unavailable'} />
                        </div>
                        <p className="mt-2 truncate text-xs text-white/60">{user.email ?? 'No email'}</p>
                        <p className="mt-1 text-xs text-white/50">Registered {formatDateTime(user.created_at) ?? '—'}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <AdminButton size="sm" variant="secondary" onClick={() => setExpandedId(isExpanded ? null : user.id)}>{isExpanded ? 'Hide details' : 'Details'}</AdminButton>
                      {user.imageData && <AdminButton size="sm" variant="secondary" onClick={() => setImageModal(user.imageData!)}>Photo</AdminButton>}
                      {isOwner && <AdminButton size="sm" variant="secondary" onClick={() => openEditUser(user)} disabled={isProcessing}>Edit</AdminButton>}
                      {normalizedStatus === 'pending' && <AdminButton size="sm" variant="success" onClick={() => handleApprove(user)} loading={isProcessing}>Approve</AdminButton>}
                      {normalizedStatus === 'pending' && <AdminButton size="sm" variant="danger" onClick={() => requestConfirmation('reject', user)} disabled={isProcessing}>Reject</AdminButton>}
                      {actionMessages[user.id]?.canRetryDiscourse && <AdminButton size="sm" variant="secondary" onClick={() => handleRetryDiscourseSync(user)} loading={isProcessing}>Retry sync</AdminButton>}
                      {normalizedStatus === 'approved' && <AdminButton size="sm" variant="secondary" onClick={() => requestConfirmation('suspend', user)} disabled={isProcessing}>Suspend</AdminButton>}
                      {normalizedStatus === 'suspended' && <AdminButton size="sm" variant="secondary" onClick={() => requestConfirmation('unsuspend', user)} disabled={isProcessing}>Unsuspend</AdminButton>}
                    </div>

                    {isExpanded && <div className="mt-4 overflow-hidden rounded-2xl border border-white/15"><DetailPanel user={user} /></div>}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col gap-3 border-t border-white/15 bg-white/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-white/50">
                Page <span className="font-semibold text-white/80">{currentPage + 1}</span> of{' '}
                <span className="font-semibold text-white/80">{totalPages}</span> · Loading {USERS_PAGE_SIZE} accounts at a time
              </p>

              <div className="flex items-center gap-2">
                <AdminButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => fetchUsers(currentPage - 1)}
                  disabled={!canGoPrevious || loading}
                  aria-label="Load previous 10 accounts"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </AdminButton>

                <AdminButton
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => fetchUsers(currentPage + 1)}
                  disabled={!canGoNext || loading}
                  aria-label="Load next 10 accounts"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </AdminButton>
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

              <AdminIconButton
                onClick={closeEditUser}
                disabled={Boolean(processingId)}
                label="Close edit user dialog"
              >
                <X className="h-5 w-5" />
              </AdminIconButton>
            </div>

            {editSaveError && (
              <AdminAlert variant="error" className="mt-4">
                {editSaveError}
              </AdminAlert>
            )}

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                First name
                <AdminInput
                  value={editForm.firstName ?? ''}
                  onChange={(event) => handleEditFormChange('firstName', event.target.value)}
                  className="mt-2"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Last name
                <AdminInput
                  value={editForm.lastName ?? ''}
                  onChange={(event) => handleEditFormChange('lastName', event.target.value)}
                  className="mt-2"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Username
                <AdminInput
                  value={editForm.username ?? ''}
                  onChange={(event) => handleEditFormChange('username', event.target.value)}
                  className="mt-2"
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
                <AdminInput
                  type="email"
                  value={editForm.email ?? ''}
                  onChange={(event) => handleEditFormChange('email', event.target.value)}
                  className="mt-2"
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
                <AdminInput
                  value={editForm.phone ?? ''}
                  onChange={(event) => handleEditFormChange('phone', event.target.value)}
                  className="mt-2"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Gender category
                <AdminSelect
                  value={editForm.gender ?? 'Male'}
                  onChange={(event) => handleEditFormChange('gender', event.target.value)}
                  className="mt-2"
                >
                  <option value="Male">Male / men category</option>
                  <option value="Female">Female / women category</option>
                </AdminSelect>
              </label>
            </div>

            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
              Changing gender moves the user into the selected feed/category, removes the old Discourse gender group, and updates their existing posts/comments to the new category label.
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <AdminButton type="button" variant="secondary" onClick={closeEditUser} disabled={Boolean(processingId)}>
                Cancel
              </AdminButton>

              <AdminButton
                type="button"
                variant="primary"
                onClick={handleSaveUserProfile}
                loading={processingId === editingUser.id}
                disabled={Boolean(processingId) || !editForm.email?.trim() || !editForm.username?.trim()}
              >
                Save and sync
              </AdminButton>
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
                  className="mt-2 w-full rounded-admin-md border border-admin-border bg-white px-3 py-2 text-sm text-admin-fg shadow-admin-sm outline-none transition-all duration-150 placeholder:text-slate-400 hover:border-slate-300 focus:border-admin-brand focus:ring-4 focus:ring-admin-brand/10"
                  placeholder="Add a short reason for the rejection email"
                />
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <AdminButton type="button" variant="secondary" onClick={closeConfirmation} disabled={Boolean(processingId)}>
                Cancel
              </AdminButton>

              <AdminButton
                type="button"
                variant={pendingConfirmation.action === 'unsuspend' ? 'success' : 'danger'}
                onClick={confirmPendingAction}
                loading={processingId === pendingConfirmation.user.id}
                disabled={Boolean(processingId)}
              >
                {pendingConfirmation.action === 'reject'
                  ? 'Reject application'
                  : pendingConfirmation.action === 'suspend'
                    ? 'Suspend user'
                    : 'Remove suspension'}
              </AdminButton>
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
              className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-admin-brand/30"
              aria-label="Close photo preview"
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