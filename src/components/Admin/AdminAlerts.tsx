import { useEffect, useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import {
  Bell,
  BellOff,
  CheckCircle,
  PlayCircle,
  RefreshCw,
  Save,
  Send,
  XCircle,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { getFunctionErrorMessage } from '@/lib/functionError';
import {
  AdminAlert,
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminEmptyState,
  AdminInput,
  AdminPageHeader,
  AdminSkeleton,
} from './ui';

interface AlertSettingsView {
  alerts_enabled: boolean;
  pending_users_threshold: number;
  flagged_posts_threshold: number;
  notify_on_new_registration: boolean;
  notify_on_high_risk_post: boolean;
  notify_on_payment_failure: boolean;
  webhook_configured: boolean;
  webhook_masked: string | null;
}

interface AlertEvent {
  id: string;
  alert_type: string;
  message: string;
  success: boolean;
  error_message: string | null;
  created_at: string;
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

export function AdminAlerts({
  activePage = 'alerts',
  onNavigate,
}: {
  activePage?: string;
  onNavigate?: (page: string) => void;
}) {
  const supabase = useSupabaseClient();

  const [settings, setSettings] = useState<AlertSettingsView | null>(null);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [running, setRunning] = useState(false);

  const [webhookInput, setWebhookInput] = useState('');
  const [form, setForm] = useState({
    alerts_enabled: false,
    pending_users_threshold: 5,
    flagged_posts_threshold: 3,
    notify_on_new_registration: false,
    notify_on_high_risk_post: true,
    notify_on_payment_failure: true,
  });

  const invoke = async (payload: Record<string, unknown>) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) throw new Error('You must be logged in as an admin.');

    const { data, error: fnError } = await supabase.functions.invoke('admin-alerts', {
      body: payload,
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (fnError) throw new Error(await getFunctionErrorMessage(fnError));
    if (!data?.ok) throw new Error(data?.error || 'Alerts request failed.');

    return data;
  };

  const applySettings = (next: AlertSettingsView) => {
    setSettings(next);
    setForm({
      alerts_enabled: next.alerts_enabled,
      pending_users_threshold: next.pending_users_threshold,
      flagged_posts_threshold: next.flagged_posts_threshold,
      notify_on_new_registration: next.notify_on_new_registration,
      notify_on_high_risk_post: next.notify_on_high_risk_post,
      notify_on_payment_failure: next.notify_on_payment_failure,
    });
  };

  const fetchAll = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await invoke({ action: 'get' });
      applySettings(data.settings);
      setEvents(data.events ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const payload: Record<string, unknown> = { ...form };
      if (webhookInput.trim() !== '') payload.slack_webhook_url = webhookInput.trim();

      const data = await invoke({ action: 'save', settings: payload });
      applySettings(data.settings);
      setWebhookInput('');
      setNotice('Alert settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleClearWebhook = async () => {
    setSaving(true);
    setError(null);

    try {
      const data = await invoke({ action: 'save', settings: { slack_webhook_url: '' } });
      applySettings(data.settings);
      setNotice('Slack webhook removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setNotice(null);

    try {
      await invoke({ action: 'test' });
      setNotice('Test message sent — check your Slack channel.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  };

  const handleRunChecks = async () => {
    setRunning(true);
    setError(null);
    setNotice(null);

    try {
      const data = await invoke({ action: 'run-checks' });
      setEvents(data.events ?? []);
      const triggered = (data.results ?? []).filter((result: { triggered: boolean }) => result.triggered).length;
      setNotice(
        triggered > 0
          ? `Checks complete — ${triggered} alert${triggered === 1 ? '' : 's'} sent to Slack.`
          : 'Checks complete — nothing crossed its threshold.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-white/60';

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className="space-y-6">
        <AdminPageHeader
          title="Slack alerts"
          description="Send operational alerts to a Slack channel: review backlogs, high-risk posts, payment failures, and new registrations."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {settings && (
                <AdminBadge variant={settings.alerts_enabled ? 'success' : 'muted'}>
                  {settings.alerts_enabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                  {settings.alerts_enabled ? 'Alerting on' : 'Alerting off'}
                </AdminBadge>
              )}
              <AdminButton type="button" variant="glass" onClick={fetchAll} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </AdminButton>
            </div>
          }
        />

        {error && <AdminAlert variant="error">{error}</AdminAlert>}
        {notice && <AdminAlert variant="success">{notice}</AdminAlert>}

        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((item) => (
              <AdminSkeleton key={item} className="h-48 w-full rounded-3xl" />
            ))}
          </div>
        ) : (
          <>
            <AdminCard
              title="Slack webhook"
              description="Create an incoming webhook in Slack (channel → Integrations → Add an app → Incoming Webhooks) and paste the URL here. The stored URL is never shown again in full."
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-sm text-white/70">
                  Status:
                  {settings?.webhook_configured ? (
                    <AdminBadge variant="success">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Configured {settings.webhook_masked ? `(${settings.webhook_masked})` : ''}
                    </AdminBadge>
                  ) : (
                    <AdminBadge variant="warning">Not configured</AdminBadge>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className={`${labelClass} flex-1`}>
                    New webhook URL
                    <AdminInput
                      type="url"
                      value={webhookInput}
                      onChange={(event) => setWebhookInput(event.target.value)}
                      placeholder="https://hooks.slack.com/services/…"
                      className="mt-2"
                      disabled={saving}
                    />
                  </label>

                  <div className="flex gap-2">
                    <AdminButton
                      type="button"
                      variant="secondary"
                      onClick={handleTest}
                      loading={testing}
                      disabled={!settings?.webhook_configured || testing}
                    >
                      <Send className="h-4 w-4" />
                      Send test
                    </AdminButton>
                    {settings?.webhook_configured && (
                      <AdminButton type="button" variant="ghost" onClick={handleClearWebhook} disabled={saving}>
                        Remove
                      </AdminButton>
                    )}
                  </div>
                </div>
              </div>
            </AdminCard>

            <AdminCard
              title="Alert rules"
              description="Which conditions post to Slack. Thresholds are evaluated when you run checks (or from a scheduled job calling the admin-alerts function)."
            >
              <div className="space-y-5">
                <label className="flex items-center gap-3 text-sm font-semibold text-white">
                  <input
                    type="checkbox"
                    checked={form.alerts_enabled}
                    onChange={(event) => setForm((current) => ({ ...current, alerts_enabled: event.target.checked }))}
                    className="h-4 w-4 rounded border-white/30 bg-white/10"
                  />
                  Enable Slack alerting
                </label>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className={labelClass}>
                    Pending review backlog threshold
                    <AdminInput
                      type="number"
                      min={1}
                      value={form.pending_users_threshold}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, pending_users_threshold: parseInt(event.target.value) || 1 }))
                      }
                      className="mt-2"
                    />
                    <span className="mt-1 block text-[11px] font-normal normal-case text-white/40">
                      Alert when this many registrations are waiting for review.
                    </span>
                  </label>

                  <label className={labelClass}>
                    High-risk post threshold
                    <AdminInput
                      type="number"
                      min={1}
                      value={form.flagged_posts_threshold}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, flagged_posts_threshold: parseInt(event.target.value) || 1 }))
                      }
                      className="mt-2"
                    />
                    <span className="mt-1 block text-[11px] font-normal normal-case text-white/40">
                      Alert when this many posts have 5+ red flags.
                    </span>
                  </label>
                </div>

                <div className="space-y-2 text-sm text-white/80">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={form.notify_on_high_risk_post}
                      onChange={(event) => setForm((current) => ({ ...current, notify_on_high_risk_post: event.target.checked }))}
                      className="h-4 w-4 rounded border-white/30 bg-white/10"
                    />
                    Alert on high-risk posts
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={form.notify_on_payment_failure}
                      onChange={(event) => setForm((current) => ({ ...current, notify_on_payment_failure: event.target.checked }))}
                      className="h-4 w-4 rounded border-white/30 bg-white/10"
                    />
                    Alert on payment failures (last 24 hours)
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={form.notify_on_new_registration}
                      onChange={(event) => setForm((current) => ({ ...current, notify_on_new_registration: event.target.checked }))}
                      className="h-4 w-4 rounded border-white/30 bg-white/10"
                    />
                    Alert on every new registration
                  </label>
                </div>

                <div className="flex flex-wrap justify-end gap-2 border-t border-white/15 pt-4">
                  <AdminButton
                    type="button"
                    variant="secondary"
                    onClick={handleRunChecks}
                    loading={running}
                    disabled={running || !settings?.webhook_configured || !form.alerts_enabled}
                  >
                    <PlayCircle className="h-4 w-4" />
                    Run checks now
                  </AdminButton>
                  <AdminButton type="button" variant="primary" onClick={handleSave} loading={saving} disabled={saving}>
                    <Save className="h-4 w-4" />
                    Save settings
                  </AdminButton>
                </div>
              </div>
            </AdminCard>

            <AdminCard
              className="p-0"
              title="Recent alerts"
              description="The last 50 alerts sent (or attempted) to Slack."
            >
              {events.length === 0 ? (
                <AdminEmptyState
                  icon={<Bell className="h-8 w-8" />}
                  title="No alerts sent yet"
                  message="Alerts appear here after a threshold check triggers or a registration/payment event fires."
                />
              ) : (
                <ul className="divide-y divide-white/10">
                  {events.map((event) => (
                    <li key={event.id} className="flex items-start gap-3 px-5 py-3">
                      {event.success ? (
                        <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" />
                      ) : (
                        <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-300" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white/85">{event.message}</p>
                        <p className="mt-0.5 text-xs text-white/40">
                          {event.alert_type} · {formatDateTime(event.created_at)}
                          {!event.success && event.error_message ? ` · ${event.error_message}` : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </AdminCard>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
