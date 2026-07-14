import { useEffect, useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { getFunctionErrorMessage } from '@/lib/functionError';
import {
  AdminAlert,
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminEmptyState,
  AdminPageHeader,
  AdminSkeleton,
} from './ui';

interface FeatureFlag {
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  updated_at: string;
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminFeatureFlags({
  activePage = 'flags',
  onNavigate,
}: {
  activePage?: string;
  onNavigate?: (page: string) => void;
}) {
  const supabase = useSupabaseClient();

  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingKey, setProcessingKey] = useState<string | null>(null);
  const [confirmFlag, setConfirmFlag] = useState<FeatureFlag | null>(null);

  const invoke = async (payload: Record<string, unknown>) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) throw new Error('You must be logged in as an admin.');

    const { data, error: fnError } = await supabase.functions.invoke('admin-feature-flags', {
      body: payload,
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (fnError) throw new Error(await getFunctionErrorMessage(fnError));
    if (!data?.ok) throw new Error(data?.error || 'Feature flag request failed.');

    return data;
  };

  const fetchFlags = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await invoke({ action: 'list' });
      setFlags(data.flags ?? []);
      setCanManage(Boolean(data.canManage));
      if (data.tableMissing) {
        setError('The feature_flags table is missing. Run the pending database migrations.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setFlags([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchFlags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyToggle = async (flag: FeatureFlag) => {
    setProcessingKey(flag.key);
    setError(null);

    try {
      const data = await invoke({ action: 'set', key: flag.key, enabled: !flag.enabled });
      setFlags(data.flags ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessingKey(null);
      setConfirmFlag(null);
    }
  };

  const handleToggle = (flag: FeatureFlag) => {
    if (flag.enabled) {
      // Turning a feature OFF is the destructive direction; confirm it.
      setConfirmFlag(flag);
    } else {
      void applyToggle(flag);
    }
  };

  const disabledCount = flags.filter((flag) => !flag.enabled).length;

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className="space-y-6">
        <AdminPageHeader
          title="Feature flags"
          description="Kill switches for critical platform features. Disabling a flag takes effect immediately for new requests — no deploy needed."
          meta={disabledCount > 0 ? `${disabledCount} feature${disabledCount === 1 ? '' : 's'} currently disabled` : 'All features enabled'}
          actions={
            <AdminButton type="button" variant="glass" onClick={fetchFlags} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </AdminButton>
          }
        />

        {error && <AdminAlert variant="error">{error}</AdminAlert>}

        {!loading && !canManage && (
          <AdminAlert variant="info">
            <p className="font-semibold">Read-only view</p>
            <p className="mt-1">Only owner-level admins can change feature flags.</p>
          </AdminAlert>
        )}

        {disabledCount > 0 && (
          <AdminAlert variant="warning">
            <p className="font-semibold">Some features are switched off</p>
            <p className="mt-1">Members will see these features as temporarily unavailable until re-enabled.</p>
          </AdminAlert>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((item) => (
              <AdminSkeleton key={item} className="h-20 w-full rounded-3xl" />
            ))}
          </div>
        ) : flags.length === 0 ? (
          <AdminCard>
            <AdminEmptyState
              icon={<ToggleLeft className="h-8 w-8" />}
              title="No feature flags found"
              message="Run the pending database migrations to seed the default kill switches."
            />
          </AdminCard>
        ) : (
          <div className="space-y-3">
            {flags.map((flag) => (
              <AdminCard key={flag.key}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-white">{flag.label}</h3>
                      <AdminBadge variant={flag.enabled ? 'success' : 'danger'}>
                        {flag.enabled ? 'Enabled' : 'Disabled'}
                      </AdminBadge>
                      <span className="font-mono text-[11px] text-white/40">{flag.key}</span>
                    </div>
                    {flag.description && <p className="mt-1 text-sm text-white/60">{flag.description}</p>}
                    <p className="mt-1 text-xs text-white/40">Last changed {formatDateTime(flag.updated_at)}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => canManage && handleToggle(flag)}
                    disabled={!canManage || processingKey === flag.key}
                    aria-pressed={flag.enabled}
                    aria-label={`${flag.enabled ? 'Disable' : 'Enable'} ${flag.label}`}
                    className={`flex flex-shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30 disabled:cursor-not-allowed disabled:opacity-60 ${
                      flag.enabled
                        ? 'border-emerald-300/40 bg-emerald-400/20 text-white hover:bg-emerald-400/30'
                        : 'border-rose-300/40 bg-rose-400/20 text-white hover:bg-rose-400/30'
                    }`}
                  >
                    {flag.enabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                    {processingKey === flag.key ? 'Saving…' : flag.enabled ? 'On' : 'Off'}
                  </button>
                </div>
              </AdminCard>
            ))}
          </div>
        )}
      </div>

      {confirmFlag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">Disable “{confirmFlag.label}”?</h2>
            <p className="mt-2 text-sm text-slate-600">
              {confirmFlag.description || 'This feature will be unavailable to members immediately.'}
            </p>
            <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              New requests will be rejected with a “temporarily unavailable” message until the flag is re-enabled.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <AdminButton type="button" variant="secondary" onClick={() => setConfirmFlag(null)} disabled={Boolean(processingKey)}>
                Cancel
              </AdminButton>
              <AdminButton
                type="button"
                variant="danger"
                onClick={() => applyToggle(confirmFlag)}
                loading={processingKey === confirmFlag.key}
              >
                Disable feature
              </AdminButton>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
