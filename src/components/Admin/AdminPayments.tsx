import { useEffect, useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BadgeCheck,
  CreditCard,
  Download,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { getFunctionErrorMessage } from '@/lib/functionError';
import { downloadCsv, csvTimestamp } from '@/lib/adminCsv';
import {
  AdminAlert,
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminEmptyState,
  AdminMetricCard,
  AdminPageHeader,
  AdminSkeleton,
  StatusBadge,
} from './ui';

interface PaymentRow {
  id: string;
  user_id: string;
  email: string | null;
  username: string | null;
  stripe_payment_intent_id: string;
  feed_access: string;
  amount: number;
  currency: string;
  status: string;
  expires_at: string | null;
  created_at: string;
}

interface PaymentsSummary {
  totalRevenue: number;
  revenue30: number;
  revenuePrior30: number;
  succeededCount: number;
  failedCount: number;
  pendingCount: number;
  activeAccess: number;
  revenueByDay: Array<{ date: string; amount: number; count: number }>;
}

function formatMoney(cents: number, currency = 'usd') {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function RevenueTooltip({
  active,
  label,
  payload,
  currency,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ value?: number; payload?: { count?: number } }>;
  currency: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="admin-glass rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-white">{label}</p>
      <p className="text-white/80">
        Revenue: <span className="font-semibold text-white">{formatMoney(payload[0]?.value ?? 0, currency)}</span>
      </p>
      <p className="text-white/80">
        Payments: <span className="font-semibold text-white">{payload[0]?.payload?.count ?? 0}</span>
      </p>
    </div>
  );
}

export function AdminPayments({
  activePage = 'payments',
  onNavigate,
}: {
  activePage?: string;
  onNavigate?: (page: string) => void;
}) {
  const supabase = useSupabaseClient();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [summary, setSummary] = useState<PaymentsSummary | null>(null);
  const [currency, setCurrency] = useState('usd');
  const [tableMissing, setTableMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPayments = async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) throw new Error('You must be logged in as an admin.');

      const { data, error: fnError } = await supabase.functions.invoke('get-admin-payments', {
        body: { limit: 500 },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (fnError) throw new Error(await getFunctionErrorMessage(fnError));
      if (!data?.ok) throw new Error(data?.error || 'Unable to load payments.');

      setPayments(data.payments ?? []);
      setSummary(data.summary ?? null);
      setCurrency(data.currency ?? 'usd');
      setTableMissing(Boolean(data.tableMissing));
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPayments([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportCsv = () => {
    downloadCsv(`teatimecari-payments-${csvTimestamp()}`, payments, [
      { header: 'Created', value: (row) => row.created_at },
      { header: 'Email', value: (row) => row.email },
      { header: 'Username', value: (row) => row.username },
      { header: 'Amount', value: (row) => (row.amount / 100).toFixed(2) },
      { header: 'Currency', value: (row) => row.currency },
      { header: 'Status', value: (row) => row.status },
      { header: 'Feed access', value: (row) => row.feed_access },
      { header: 'Expires', value: (row) => row.expires_at },
      { header: 'Stripe payment intent', value: (row) => row.stripe_payment_intent_id },
    ]);
  };

  const revenueTrend = (summary?.revenueByDay ?? []).map((day) => ({
    ...day,
    label: new Date(`${day.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  const trendDelta = summary
    ? summary.revenue30 - summary.revenuePrior30
    : 0;

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className="space-y-6">
        <AdminPageHeader
          title="Payments"
          description="Revenue from premium feed access, payment health, and the full Stripe payment history."
          meta={lastUpdated ? `Last refreshed ${lastUpdated.toLocaleTimeString()}` : undefined}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <AdminButton type="button" variant="glass" onClick={exportCsv} disabled={loading || payments.length === 0}>
                <Download className="h-4 w-4" />
                Export CSV
              </AdminButton>
              <AdminButton type="button" variant="glass" onClick={fetchPayments} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </AdminButton>
            </div>
          }
        />

        {error && (
          <AdminAlert variant="error">
            <p className="font-semibold">Unable to load payments</p>
            <p className="mt-1">{error}</p>
          </AdminAlert>
        )}

        {tableMissing && (
          <AdminAlert variant="warning">
            <p className="font-semibold">Payments table not found</p>
            <p className="mt-1">Run the pending database migrations to enable payment tracking.</p>
          </AdminAlert>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard
            title="Revenue (30 days)"
            value={loading ? '' : formatMoney(summary?.revenue30 ?? 0, currency)}
            icon={trendDelta >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            accent={trendDelta >= 0 ? 'success' : 'warning'}
            description={
              summary
                ? `${trendDelta >= 0 ? '+' : ''}${formatMoney(trendDelta, currency)} vs previous 30 days`
                : undefined
            }
            loading={loading}
          />
          <AdminMetricCard
            title="Lifetime revenue"
            value={loading ? '' : formatMoney(summary?.totalRevenue ?? 0, currency)}
            icon={<Wallet className="h-5 w-5" />}
            accent="brand"
            description={`${summary?.succeededCount ?? 0} successful payments`}
            loading={loading}
          />
          <AdminMetricCard
            title="Active premium access"
            value={loading ? '' : String(summary?.activeAccess ?? 0)}
            icon={<BadgeCheck className="h-5 w-5" />}
            accent="info"
            description="Paid access that has not expired"
            loading={loading}
          />
          <AdminMetricCard
            title="Failed payments"
            value={loading ? '' : String(summary?.failedCount ?? 0)}
            icon={<XCircle className="h-5 w-5" />}
            accent={(summary?.failedCount ?? 0) > 0 ? 'danger' : 'muted'}
            description={`${summary?.pendingCount ?? 0} pending / other`}
            loading={loading}
          />
        </div>

        <AdminCard
          title="Revenue trend"
          description="Successful payment volume over the last 30 days"
          actions={
            <AdminBadge>
              {loading ? 'Loading' : `${formatMoney(summary?.revenue30 ?? 0, currency)} this period`}
            </AdminBadge>
          }
        >
          {loading ? (
            <div className="admin-skeleton-glass h-64 w-full rounded-2xl" />
          ) : revenueTrend.every((day) => day.amount === 0) ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <CreditCard className="h-8 w-8 text-white/40" />
              <p className="mt-3 text-sm font-medium text-white/70">No successful payments in the last 30 days</p>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.12)" />
                  <XAxis
                    dataKey="label"
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value: number) => `$${Math.round(value / 100)}`}
                    width={44}
                  />
                  <Tooltip content={<RevenueTooltip currency={currency} />} cursor={{ stroke: 'rgba(255,255,255,0.3)', strokeWidth: 1 }} />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    name="Revenue"
                    stroke="#34d399"
                    strokeWidth={2}
                    fill="url(#revenueFill)"
                    activeDot={{ r: 4, fill: '#34d399' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </AdminCard>

        <AdminCard
          className="p-0"
          title="Payment history"
          description={`Most recent ${payments.length} payments`}
        >
          {loading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2, 3, 4].map((item) => (
                <AdminSkeleton key={item} className="h-12 w-full" />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <AdminEmptyState
              icon={<CreditCard className="h-8 w-8" />}
              title="No payments recorded yet"
              message="Payments will appear here once members purchase premium feed access."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-white/15 bg-white/10">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/50">Member</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/50">Amount</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/50">Status</th>
                    <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/50 md:table-cell">Access</th>
                    <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/50 lg:table-cell">Expires</th>
                    <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/50 md:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="transition-colors hover:bg-white/5">
                      <td className="px-5 py-3">
                        <p className="truncate text-sm font-semibold text-white">{payment.email ?? payment.user_id}</p>
                        {payment.username && <p className="text-xs text-white/50">@{payment.username}</p>}
                      </td>
                      <td className="px-5 py-3 text-sm font-semibold text-white">
                        {formatMoney(payment.amount, payment.currency)}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={payment.status} />
                      </td>
                      <td className="hidden px-5 py-3 md:table-cell">
                        <AdminBadge variant="neutral">{payment.feed_access}</AdminBadge>
                      </td>
                      <td className="hidden px-5 py-3 text-xs text-white/70 lg:table-cell">{formatDateTime(payment.expires_at)}</td>
                      <td className="hidden px-5 py-3 text-xs text-white/70 md:table-cell">{formatDateTime(payment.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>
      </div>
    </AdminLayout>
  );
}
