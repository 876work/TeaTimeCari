import React, { useEffect, useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { CheckCircle, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { AdminAlert, AdminButton, AdminEmptyState, AdminPageHeader, AdminTable } from './ui';
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

export function AdminAuditLogs({ activePage = 'logs', onNavigate }: { activePage?: string; onNavigate?: (page: string) => void }) {
  const supabase = useSupabaseClient();
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className="space-y-6">
        <AdminPageHeader
          title="Admin Audit Logs"
          description="Recent admin access checks, user decisions, and operational actions."
          actions={
            <AdminButton type="button" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </AdminButton>
          }
        />

        {error && <AdminAlert variant="error">{error}</AdminAlert>}

        <AdminTable>
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm text-slate-500">Loading audit logs…</p>
            </div>
          ) : logs.length === 0 ? (
            <AdminEmptyState title="No audit logs found" message="Admin actions will appear here once recorded." />
          ) : (
            <div>
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Result</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Actor</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Target</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        {log.success ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-slate-900">{formatAction(log.action)}</p>
                        {log.error_message && <p className="mt-1 max-w-xs text-xs text-red-600">{log.error_message}</p>}
                        {log.reason && <p className="mt-1 max-w-xs text-xs text-slate-500">Reason: {log.reason}</p>}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm text-slate-700">{log.actor_email || 'System'}</p>
                        <p className="text-xs text-slate-400">{log.actor_role || '—'}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm text-slate-700">{log.target_email || log.target_id || '—'}</p>
                        <p className="text-xs text-slate-400">{log.target_type || '—'}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {[log.previous_status, log.next_status].filter(Boolean).join(' → ') || '—'}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">{formatDate(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminTable>
      </div>
    </AdminLayout>
  );
}
