import React, { useEffect, useMemo, useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  FileSearch,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  XCircle,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import {
  AdminAlert,
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminEmptyState,
  AdminFilterBar,
  AdminInput,
  AdminMetricCard,
  AdminSelect,
  AdminSkeleton,
  AdminTable,
  AdminPageHeader,
} from './ui';
import { getFunctionErrorMessage } from '@/lib/functionError';

type AdminAuditLog = {
  id: string;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_email: string | null;
  previous_status: string | null;
  next_status: string | null;
  reason: string | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
};

type AuditCategory = 'all' | 'failed' | 'successful' | 'user' | 'moderation' | 'auth' | 'system';

const actionCategoryLabels: Record<Exclude<AuditCategory, 'all' | 'failed' | 'successful'>, string> = {
  user: 'User action',
  moderation: 'Moderation',
  auth: 'Auth',
  system: 'System',
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAction(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function getActionCategory(log: AdminAuditLog): Exclude<AuditCategory, 'all' | 'failed' | 'successful'> {
  const combined = `${log.action} ${log.target_type ?? ''}`.toLowerCase();
  if (combined.includes('auth') || combined.includes('login') || combined.includes('access')) return 'auth';
  if (combined.includes('moder') || combined.includes('flag') || combined.includes('post') || combined.includes('review')) return 'moderation';
  if (combined.includes('user') || combined.includes('member') || combined.includes('applicant')) return 'user';
  return 'system';
}

function getStatusTransition(log: AdminAuditLog) {
  return [log.previous_status, log.next_status].filter(Boolean).join(' → ') || '—';
}

function matchesSearch(log: AdminAuditLog, search: string) {
  if (!search.trim()) return true;
  const haystack = [
    log.id,
    log.actor_email,
    log.actor_role,
    log.action,
    log.target_type,
    log.target_id,
    log.target_email,
    log.previous_status,
    log.next_status,
    log.reason,
    log.error_message,
    log.created_at,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(search.trim().toLowerCase());
}

function AuditLogStatusBadge({ success }: { success: boolean }) {
  return success ? (
    <AdminBadge variant="success" className="gap-1.5">
      <CheckCircle className="h-3.5 w-3.5" /> Success
    </AdminBadge>
  ) : (
    <AdminBadge variant="danger" className="gap-1.5">
      <XCircle className="h-3.5 w-3.5" /> Failed
    </AdminBadge>
  );
}

function AuditLogActionBadge({ log }: { log: AdminAuditLog }) {
  const category = getActionCategory(log);
  const variant = category === 'moderation' ? 'warning' : category === 'auth' ? 'info' : category === 'user' ? 'brand' : 'neutral';

  return <AdminBadge variant={variant}>{actionCategoryLabels[category]}</AdminBadge>;
}

function DetailField({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-admin-lg border border-admin-border bg-white px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-admin-muted-fg">{label}</dt>
      <dd className={`mt-1 break-words text-sm text-admin-fg ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</dd>
    </div>
  );
}

function AuditLogDetailPanel({ log }: { log: AdminAuditLog }) {
  return (
    <div className="rounded-admin-xl border border-admin-border bg-admin-muted/60 p-4">
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <DetailField label="Log ID" value={log.id} mono />
        <DetailField label="Action" value={log.action} mono />
        <DetailField label="Actor email" value={log.actor_email || 'System'} />
        <DetailField label="Actor role" value={log.actor_role} />
        <DetailField label="Target type" value={log.target_type} />
        <DetailField label="Target ID" value={log.target_id} mono />
        <DetailField label="Target email" value={log.target_email} />
        <DetailField label="Previous status" value={log.previous_status} />
        <DetailField label="Next status" value={log.next_status} />
        <DetailField label="Created at" value={formatDate(log.created_at)} />
        {log.reason && <DetailField label="Reason" value={log.reason} />}
        {log.error_message && <DetailField label="Error details" value={log.error_message} />}
      </dl>
    </div>
  );
}

function AuditLogFilters({ search, setSearch, status, setStatus, category, setCategory, onClear }: {
  search: string;
  setSearch: (value: string) => void;
  status: 'all' | 'success' | 'failed';
  setStatus: (value: 'all' | 'success' | 'failed') => void;
  category: AuditCategory;
  setCategory: (value: AuditCategory) => void;
  onClear: () => void;
}) {
  const hasFilters = search || status !== 'all' || category !== 'all';

  return (
    <AdminFilterBar>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="flex-1 text-xs font-semibold uppercase tracking-wide text-admin-muted-fg">
          Search logs
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <AdminInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search actor, action, target, reason, or error…" className="pl-9" />
          </div>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-admin-muted-fg lg:w-44">
          Result
          <AdminSelect className="mt-1.5" value={status} onChange={(event) => setStatus(event.target.value as 'all' | 'success' | 'failed')}>
            <option value="all">All results</option>
            <option value="success">Successful</option>
            <option value="failed">Failed only</option>
          </AdminSelect>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-admin-muted-fg lg:w-48">
          Category
          <AdminSelect className="mt-1.5" value={category} onChange={(event) => setCategory(event.target.value as AuditCategory)}>
            <option value="all">All categories</option>
            <option value="user">User actions</option>
            <option value="moderation">Moderation</option>
            <option value="auth">Auth</option>
            <option value="system">System</option>
          </AdminSelect>
        </label>
        <AdminButton type="button" variant="ghost" onClick={onClear} disabled={!hasFilters}>
          Clear filters
        </AdminButton>
      </div>
      {hasFilters && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-admin-border pt-3">
          <AdminBadge variant="muted" className="gap-1"><SlidersHorizontal className="h-3 w-3" /> Active filters</AdminBadge>
          {search && <AdminBadge variant="neutral">Search: {search}</AdminBadge>}
          {status !== 'all' && <AdminBadge variant={status === 'failed' ? 'danger' : 'success'}>{status === 'failed' ? 'Failed only' : 'Successful'}</AdminBadge>}
          {category !== 'all' && <AdminBadge variant="brand">{category === 'user' ? 'User actions' : actionCategoryLabels[category as Exclude<AuditCategory, 'all' | 'failed' | 'successful'>]}</AdminBadge>}
        </div>
      )}
    </AdminFilterBar>
  );
}

function AuditLogSummaryCards({ logs, loading }: { logs: AdminAuditLog[]; loading: boolean }) {
  const successful = logs.filter((log) => log.success).length;
  const failed = logs.filter((log) => !log.success).length;
  const userActions = logs.filter((log) => getActionCategory(log) === 'user').length;
  const moderationActions = logs.filter((log) => getActionCategory(log) === 'moderation').length;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <AdminMetricCard title="Loaded logs" value={logs.length} loading={loading} icon={<FileSearch className="h-5 w-5" />} description="From the current audit log load" />
      <AdminMetricCard title="Successful" value={successful} loading={loading} icon={<ShieldCheck className="h-5 w-5" />} accent="success" description="Completed without errors" />
      <AdminMetricCard title="Failed" value={failed} loading={loading} icon={<AlertTriangle className="h-5 w-5" />} accent={failed > 0 ? 'danger' : 'muted'} description="Events with error details" />
      <AdminMetricCard title="User / moderation" value={`${userActions} / ${moderationActions}`} loading={loading} icon={<UserCog className="h-5 w-5" />} accent="info" description="Categorized from visible actions" />
    </div>
  );
}

function AuditLogRow({ log, expanded, onToggle }: { log: AdminAuditLog; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="align-top transition-colors hover:bg-admin-muted/70">
        <td className="px-4 py-4">
          <button type="button" onClick={onToggle} className="inline-flex h-8 w-8 items-center justify-center rounded-admin-md text-admin-muted-fg transition hover:bg-white hover:text-admin-fg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-admin-brand/20" aria-expanded={expanded} aria-label={`${expanded ? 'Hide' : 'Show'} details for ${formatAction(log.action)}`}>
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
        <td className="px-4 py-4"><AuditLogStatusBadge success={log.success} /></td>
        <td className="px-4 py-4">
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-admin-fg">{formatAction(log.action)}</p>
            <AuditLogActionBadge log={log} />
            {log.error_message && <p className="max-w-sm text-xs font-medium text-red-600">{log.error_message}</p>}
            {log.reason && <p className="max-w-sm text-xs text-admin-muted-fg">Reason: {log.reason}</p>}
          </div>
        </td>
        <td className="px-4 py-4">
          <p className="text-sm font-medium text-admin-fg">{log.actor_email || 'System'}</p>
          <p className="mt-1 text-xs text-admin-muted-fg">{log.actor_role || '—'}</p>
        </td>
        <td className="px-4 py-4">
          <p className="text-sm font-medium text-admin-fg">{log.target_email || log.target_id || '—'}</p>
          <p className="mt-1 text-xs text-admin-muted-fg">{log.target_type || '—'}</p>
        </td>
        <td className="px-4 py-4 text-sm text-admin-muted-fg">{getStatusTransition(log)}</td>
        <td className="whitespace-nowrap px-4 py-4 text-sm text-admin-muted-fg">{formatDate(log.created_at)}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="border-t border-admin-border bg-admin-muted/30 px-4 py-4">
            <AuditLogDetailPanel log={log} />
          </td>
        </tr>
      )}
    </>
  );
}

function AuditLogMobileCard({ log, expanded, onToggle }: { log: AdminAuditLog; expanded: boolean; onToggle: () => void }) {
  return (
    <AdminCard className="shadow-admin-sm">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap gap-2"><AuditLogStatusBadge success={log.success} /><AuditLogActionBadge log={log} /></div>
            <h3 className="text-sm font-semibold text-admin-fg">{formatAction(log.action)}</h3>
            <p className="text-xs text-admin-muted-fg"><Clock className="mr-1 inline h-3.5 w-3.5" />{formatDate(log.created_at)}</p>
          </div>
          <button type="button" onClick={onToggle} className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-admin-md border border-admin-border bg-white text-admin-muted-fg shadow-admin-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-admin-brand/20" aria-expanded={expanded} aria-label={`${expanded ? 'Hide' : 'Show'} details for ${formatAction(log.action)}`}>
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
        <div className="grid gap-3 text-sm">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-admin-muted-fg">Actor</p><p className="font-medium text-admin-fg">{log.actor_email || 'System'}</p><p className="text-xs text-admin-muted-fg">{log.actor_role || '—'}</p></div>
          <div><p className="text-xs font-semibold uppercase tracking-wide text-admin-muted-fg">Target</p><p className="font-medium text-admin-fg">{log.target_email || log.target_id || '—'}</p><p className="text-xs text-admin-muted-fg">{log.target_type || '—'}</p></div>
          <div><p className="text-xs font-semibold uppercase tracking-wide text-admin-muted-fg">Status</p><p className="text-admin-muted-fg">{getStatusTransition(log)}</p></div>
        </div>
        {log.error_message && <AdminAlert variant="error" className="py-3">{log.error_message}</AdminAlert>}
        {log.reason && <p className="rounded-admin-lg bg-admin-muted px-3 py-2 text-xs text-admin-muted-fg">Reason: {log.reason}</p>}
        {expanded && <AuditLogDetailPanel log={log} />}
      </div>
    </AdminCard>
  );
}

function AuditLogTable({ logs }: { logs: AdminAuditLog[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <>
      <div className="hidden lg:block">
        <AdminTable>
          <table className="min-w-full divide-y divide-admin-border">
            <thead className="bg-admin-muted/80">
              <tr>
                <th className="w-12 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-admin-muted-fg">Details</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-admin-muted-fg">Result</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-admin-muted-fg">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-admin-muted-fg">Actor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-admin-muted-fg">Target</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-admin-muted-fg">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-admin-muted-fg">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border bg-white">
              {logs.map((log) => <AuditLogRow key={log.id} log={log} expanded={expandedId === log.id} onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)} />)}
            </tbody>
          </table>
        </AdminTable>
      </div>
      <div className="space-y-4 lg:hidden">
        {logs.map((log) => <AuditLogMobileCard key={log.id} log={log} expanded={expandedId === log.id} onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)} />)}
      </div>
    </>
  );
}

function AuditLogLoadingState() {
  return (
    <AdminTable>
      <div className="space-y-3 p-5">
        {[0, 1, 2, 3, 4].map((item) => <AdminSkeleton key={item} className="h-14 w-full" />)}
        <div className="flex items-center justify-center gap-3 py-6 text-sm text-admin-muted-fg"><Loader2 className="h-5 w-5 animate-spin text-admin-brand" /> Loading audit logs…</div>
      </div>
    </AdminTable>
  );
}

export function AdminAuditLogs({ activePage = 'logs', onNavigate }: { activePage?: string; onNavigate?: (page: string) => void }) {
  const supabase = useSupabaseClient();
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'success' | 'failed'>('all');
  const [category, setCategory] = useState<AuditCategory>('all');

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('You must be logged in as an admin.');

      const { data, error: fnError } = await supabase.functions.invoke('get-admin-audit-logs', {
        body: { limit: 100 },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (fnError) throw new Error(await getFunctionErrorMessage(fnError));
      if (!data?.ok) throw new Error(data?.error || 'Unable to load audit logs.');

      setLogs(data.logs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredLogs = useMemo(() => logs.filter((log) => {
    if (status === 'success' && !log.success) return false;
    if (status === 'failed' && log.success) return false;
    if (category !== 'all' && getActionCategory(log) !== category) return false;
    return matchesSearch(log, search);
  }), [logs, search, status, category]);

  const clearFilters = () => {
    setSearch('');
    setStatus('all');
    setCategory('all');
  };

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className="space-y-6">
        <AdminPageHeader
          title="Audit Logs"
          description="Review system activity, admin access checks, user actions, moderation decisions, and failed events."
          meta={!loading && logs[0] ? `Latest visible event: ${formatDate(logs[0].created_at)}` : undefined}
          actions={
            <AdminButton type="button" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </AdminButton>
          }
        />

        {error && <AdminAlert variant="error">{error}</AdminAlert>}

        <AuditLogSummaryCards logs={logs} loading={loading} />

        <AuditLogFilters search={search} setSearch={setSearch} status={status} setStatus={setStatus} category={category} setCategory={setCategory} onClear={clearFilters} />

        <AdminCard className="p-0" title="Event stream" description={`${filteredLogs.length} of ${logs.length} loaded audit events shown`} actions={<AdminBadge variant="muted" className="gap-1.5"><Activity className="h-3.5 w-3.5" /> Latest first</AdminBadge>}>
          {loading ? (
            <AuditLogLoadingState />
          ) : filteredLogs.length === 0 ? (
            <AdminEmptyState icon={<FileSearch className="h-8 w-8" />} title="No audit logs match the current filters" message={logs.length === 0 ? 'Admin actions will appear here once recorded.' : 'Try clearing filters or broadening your search.'} action={logs.length > 0 ? <AdminButton type="button" variant="secondary" onClick={clearFilters}>Clear filters</AdminButton> : undefined} />
          ) : (
            <AuditLogTable logs={filteredLogs} />
          )}
        </AdminCard>
      </div>
    </AdminLayout>
  );
}
