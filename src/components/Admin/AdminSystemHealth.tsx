import { useEffect, useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { getFunctionErrorMessage } from '@/lib/functionError';
import FunctionPing from '../../dev/FunctionPing';
import {
  AdminAlert,
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminPageHeader,
  AdminSkeleton,
} from './ui';

type CheckStatus = 'ok' | 'warn' | 'fail';

interface HealthCheck {
  id: string;
  name: string;
  status: CheckStatus;
  message: string;
  latencyMs: number | null;
}

const statusConfig: Record<CheckStatus, { badge: 'success' | 'warning' | 'danger'; label: string; icon: React.ReactNode }> = {
  ok: { badge: 'success', label: 'Operational', icon: <CheckCircle className="h-4 w-4 text-emerald-300" /> },
  warn: { badge: 'warning', label: 'Degraded', icon: <AlertTriangle className="h-4 w-4 text-amber-300" /> },
  fail: { badge: 'danger', label: 'Failing', icon: <XCircle className="h-4 w-4 text-rose-300" /> },
};

export function AdminSystemHealth({
  activePage = 'function-ping',
  onNavigate,
  isOwner,
}: {
  activePage?: string;
  onNavigate?: (page: string) => void;
  isOwner: boolean;
}) {
  const supabase = useSupabaseClient();

  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [overall, setOverall] = useState<CheckStatus | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const runChecks = async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) throw new Error('You must be logged in as an admin.');

      const { data, error: fnError } = await supabase.functions.invoke('admin-health-check', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (fnError) throw new Error(await getFunctionErrorMessage(fnError));
      if (!data?.ok) throw new Error(data?.error || 'Unable to run health checks.');

      setChecks(data.checks ?? []);
      setOverall(data.overall ?? null);
      setCheckedAt(data.checkedAt ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setChecks([]);
      setOverall(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overallConfig = overall ? statusConfig[overall] : null;

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className="space-y-6">
        <AdminPageHeader
          title="System health"
          description="Live connectivity checks for the database, Resend email, Stripe payments, the Discourse community, and Slack alerting."
          meta={checkedAt ? `Last checked ${new Date(checkedAt).toLocaleTimeString()}` : undefined}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {overallConfig && (
                <AdminBadge variant={overallConfig.badge}>{overallConfig.label}</AdminBadge>
              )}
              <AdminButton type="button" variant="glass" onClick={runChecks} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Run checks
              </AdminButton>
            </div>
          }
        />

        {error && (
          <AdminAlert variant="error">
            <p className="font-semibold">Health checks could not run</p>
            <p className="mt-1">{error}</p>
          </AdminAlert>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <AdminSkeleton key={item} className="h-32 w-full rounded-3xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {checks.map((check) => {
              const config = statusConfig[check.status];
              return (
                <AdminCard key={check.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {config.icon}
                        <h3 className="text-sm font-semibold text-white">{check.name}</h3>
                      </div>
                      <p className="mt-2 text-sm text-white/70">{check.message}</p>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                      <AdminBadge variant={config.badge}>{config.label}</AdminBadge>
                      {check.latencyMs !== null && (
                        <span className="text-[11px] text-white/40">{check.latencyMs} ms</span>
                      )}
                    </div>
                  </div>
                </AdminCard>
              );
            })}
          </div>
        )}

        {isOwner && (
          <AdminCard
            title="Function diagnostics"
            description="Owner-only raw diagnostics for edge functions (sends real test emails to placeholder addresses)."
            actions={
              <AdminButton type="button" variant="secondary" size="sm" onClick={() => setShowDiagnostics((open) => !open)}>
                <Activity className="h-4 w-4" />
                {showDiagnostics ? 'Hide diagnostics' : 'Show diagnostics'}
              </AdminButton>
            }
          >
            {showDiagnostics ? (
              <FunctionPing />
            ) : (
              <p className="text-sm text-white/60">
                Expand to ping individual edge functions and run maintenance jobs like the location backfill.
              </p>
            )}
          </AdminCard>
        )}
      </div>
    </AdminLayout>
  );
}
