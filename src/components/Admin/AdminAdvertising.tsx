import { useEffect, useMemo, useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import imageCompression from 'browser-image-compression';
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
  Image as ImageIcon,
  MousePointerClick,
  Eye,
  Percent,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { getFunctionErrorMessage } from '@/lib/functionError';
import { downloadCsv, csvTimestamp } from '@/lib/adminCsv';
import { debugError } from '@/lib/debugLogger';
import { supabase as supabaseClient } from '@/lib/supabaseClient';
import {
  AdminAlert,
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminEmptyState,
  AdminFilterBar,
  AdminInput,
  AdminMetricCard,
  AdminPageHeader,
  AdminSelect,
  AdminSkeleton,
} from './ui';

type Placement = 'homepage' | 'in_feed' | 'footer';
type DeviceTarget = 'all' | 'desktop' | 'mobile';
type StatusFilter = 'all' | 'active' | 'scheduled' | 'expired' | 'inactive';

interface Advertisement {
  id: string;
  title: string;
  advertiser_name: string | null;
  image_path: string;
  image_width: number | null;
  image_height: number | null;
  destination_url: string;
  alt_text: string | null;
  placement: Placement;
  device_target: DeviceTarget;
  priority: number;
  active: boolean;
  starts_at: string;
  ends_at: string | null;
  impression_count: number;
  click_count: number;
  created_by_email: string | null;
  created_at: string;
}

interface Stats {
  totalImpressions: number;
  totalClicks: number;
  ctr: number;
  bestAd: { id: string; title: string; clicks: number } | null;
  bestPlacement: { placement: string; clicks: number } | null;
  byDay: Array<{ date: string; impressions: number; clicks: number }>;
}

const placementLabels: Record<Placement, string> = {
  homepage: 'Homepage banner',
  in_feed: 'In-feed (between posts)',
  footer: 'Footer banner',
};

const deviceLabels: Record<DeviceTarget, string> = {
  all: 'All devices',
  desktop: 'Desktop only',
  mobile: 'Mobile only',
};

const emptyForm = {
  id: '' as string | null,
  title: '',
  advertiser_name: '',
  destination_url: '',
  alt_text: '',
  placement: 'homepage' as Placement,
  device_target: 'all' as DeviceTarget,
  priority: 0,
  active: true,
  starts_at: '',
  ends_at: '',
};

function toDatetimeLocal(value?: string | null): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function computeStatus(ad: Advertisement): 'active' | 'scheduled' | 'expired' | 'inactive' {
  if (!ad.active) return 'inactive';
  const now = Date.now();
  const starts = new Date(ad.starts_at).getTime();
  const ends = ad.ends_at ? new Date(ad.ends_at).getTime() : null;
  if (starts > now) return 'scheduled';
  if (ends !== null && ends <= now) return 'expired';
  return 'active';
}

const statusBadge: Record<ReturnType<typeof computeStatus>, 'success' | 'info' | 'muted' | 'warning'> = {
  active: 'success',
  scheduled: 'info',
  expired: 'muted',
  inactive: 'warning',
};

function formatDateTime(value?: string | null) {
  if (!value) return 'No expiry';
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

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

export function AdminAdvertising({
  activePage = 'advertising',
  onNavigate,
}: {
  activePage?: string;
  onNavigate?: (page: string) => void;
}) {
  const supabase = useSupabaseClient();

  const [ads, setAds] = useState<Advertisement[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [confirmDelete, setConfirmDelete] = useState<Advertisement | null>(null);

  const [showComposer, setShowComposer] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageDims, setImageDims] = useState<{ width: number; height: number } | null>(null);
  const [existingImagePath, setExistingImagePath] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [processingImage, setProcessingImage] = useState(false);

  const invoke = async (payload: Record<string, unknown>) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) throw new Error('You must be logged in as an admin.');

    const { data, error: fnError } = await supabase.functions.invoke('admin-ads', {
      body: payload,
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (fnError) throw new Error(await getFunctionErrorMessage(fnError));
    if (!data?.ok) throw new Error(data?.error || 'Advertisement request failed.');

    return data;
  };

  const fetchAds = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await invoke({ action: 'list' });
      setAds(data.advertisements ?? []);
      setTableMissing(Boolean(data.tableMissing));
      if (data.tableMissing) {
        setError('The advertisements table is missing. Run the pending database migrations.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setAds([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await invoke({ action: 'stats', days: 30 });
      setStats({
        totalImpressions: data.totalImpressions ?? 0,
        totalClicks: data.totalClicks ?? 0,
        ctr: data.ctr ?? 0,
        bestAd: data.bestAd ?? null,
        bestPlacement: data.bestPlacement ?? null,
        byDay: data.byDay ?? [],
      });
    } catch {
      // Stats are a secondary view; the main list still works without them.
    }
  };

  useEffect(() => {
    void fetchAds();
    void fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const resetComposer = () => {
    setForm(emptyForm);
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setImageDims(null);
    setExistingImagePath(null);
    setFileError(null);
  };

  const openCreateComposer = () => {
    resetComposer();
    setForm({ ...emptyForm, starts_at: toDatetimeLocal(new Date().toISOString()) });
    setShowComposer(true);
  };

  const openEditComposer = (ad: Advertisement) => {
    setForm({
      id: ad.id,
      title: ad.title,
      advertiser_name: ad.advertiser_name ?? '',
      destination_url: ad.destination_url,
      alt_text: ad.alt_text ?? '',
      placement: ad.placement,
      device_target: ad.device_target,
      priority: ad.priority,
      active: ad.active,
      starts_at: toDatetimeLocal(ad.starts_at),
      ends_at: ad.ends_at ? toDatetimeLocal(ad.ends_at) : '',
    });
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(supabaseClient.storage.from('ad-creatives').getPublicUrl(ad.image_path).data.publicUrl);
    setImageDims(ad.image_width && ad.image_height ? { width: ad.image_width, height: ad.image_height } : null);
    setExistingImagePath(ad.image_path);
    setFileError(null);
    setShowComposer(true);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setFileError('Please select a PNG, JPG, or WebP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError('File size must be less than 10MB.');
      return;
    }

    setFileError(null);
    setProcessingImage(true);

    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        initialQuality: 0.9,
      });

      const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(compressed);
        img.onload = () => {
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
          URL.revokeObjectURL(objectUrl);
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Could not read image dimensions.'));
        };
        img.src = objectUrl;
      });

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const nextPreviewUrl = URL.createObjectURL(compressed);

      setSelectedFile(compressed);
      setPreviewUrl(nextPreviewUrl);
      setImageDims(dims);
    } catch (err) {
      debugError('Error processing ad image:', err);
      setFileError('Failed to process image. Please try a different file.');
    } finally {
      setProcessingImage(false);
    }
  };

  const handleSubmit = async () => {
    const title = form.title.trim();
    const destinationUrl = form.destination_url.trim();

    if (!title) {
      setError('Title is required.');
      return;
    }
    if (!destinationUrl) {
      setError('Destination URL is required.');
      return;
    }
    if (!form.id && !selectedFile) {
      setError('A banner image is required.');
      return;
    }

    const processingKey = form.id ?? 'new';
    setProcessingId(processingKey);
    setError(null);
    setNotice(null);

    let uploadedPath: string | null = null;

    try {
      let imagePath = existingImagePath;
      const imageWidth = imageDims?.width;
      const imageHeight = imageDims?.height;

      if (selectedFile) {
        const extension = selectedFile.type === 'image/png' ? 'png' : selectedFile.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${crypto.randomUUID()}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabaseClient.storage
          .from('ad-creatives')
          .upload(path, selectedFile, { cacheControl: '31536000', upsert: false });

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        uploadedPath = path;
        imagePath = path;
      }

      const payload: Record<string, unknown> = {
        title,
        advertiser_name: form.advertiser_name.trim(),
        destination_url: destinationUrl,
        alt_text: form.alt_text.trim(),
        placement: form.placement,
        device_target: form.device_target,
        priority: form.priority,
        active: form.active,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : new Date().toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      };

      if (imagePath) {
        payload.image_path = imagePath;
        payload.image_width = imageWidth ?? null;
        payload.image_height = imageHeight ?? null;
      }

      if (form.id) {
        payload.action = 'update';
        payload.ad_id = form.id;
      } else {
        payload.action = 'create';
      }

      const data = await invoke(payload);
      setAds(data.advertisements ?? []);
      setNotice(form.id ? 'Advertisement updated.' : 'Advertisement created.');
      setShowComposer(false);
      resetComposer();
      void fetchStats();
    } catch (err) {
      if (uploadedPath) {
        await supabaseClient.storage.from('ad-creatives').remove([uploadedPath]).catch(() => {});
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleActive = async (ad: Advertisement) => {
    setProcessingId(ad.id);
    setError(null);

    try {
      const data = await invoke({ action: 'set-active', ad_id: ad.id });
      setAds(data.advertisements ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (ad: Advertisement) => {
    setProcessingId(ad.id);
    setError(null);

    try {
      const data = await invoke({ action: 'delete', ad_id: ad.id });
      setAds(data.advertisements ?? []);
      setNotice('Advertisement deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessingId(null);
      setConfirmDelete(null);
    }
  };

  const handleExportCsv = () => {
    downloadCsv(
      `advertisements-${csvTimestamp()}`,
      ads,
      [
        { header: 'Title', value: (row) => row.title },
        { header: 'Advertiser', value: (row) => row.advertiser_name ?? '' },
        { header: 'Placement', value: (row) => placementLabels[row.placement] },
        { header: 'Device', value: (row) => deviceLabels[row.device_target] },
        { header: 'Status', value: (row) => computeStatus(row) },
        { header: 'Priority', value: (row) => row.priority },
        { header: 'Starts at', value: (row) => row.starts_at },
        { header: 'Ends at', value: (row) => row.ends_at ?? '' },
        { header: 'Impressions', value: (row) => row.impression_count },
        { header: 'Clicks', value: (row) => row.click_count },
        {
          header: 'CTR',
          value: (row) => (row.impression_count > 0 ? (row.click_count / row.impression_count).toFixed(4) : '0'),
        },
        { header: 'Destination URL', value: (row) => row.destination_url },
        { header: 'Created at', value: (row) => row.created_at },
      ],
    );
  };

  const filteredAds = useMemo(() => {
    if (statusFilter === 'all') return ads;
    return ads.filter((ad) => computeStatus(ad) === statusFilter);
  }, [ads, statusFilter]);

  const activeCount = useMemo(() => ads.filter((ad) => computeStatus(ad) === 'active').length, [ads]);

  const chartData = stats?.byDay.map((day) => ({
    ...day,
    label: new Date(`${day.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  })) ?? [];

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className="space-y-6">
        <AdminPageHeader
          title="Advertising"
          description="Upload and manage banner ads shown across the homepage, feed, and footer."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <AdminButton type="button" variant="primary" onClick={openCreateComposer} disabled={tableMissing}>
                <Plus className="h-4 w-4" />
                New ad
              </AdminButton>
              <AdminButton type="button" variant="glass" onClick={handleExportCsv} disabled={ads.length === 0}>
                <Upload className="h-4 w-4" />
                Export CSV
              </AdminButton>
              <AdminButton
                type="button"
                variant="glass"
                onClick={() => {
                  void fetchAds();
                  void fetchStats();
                }}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </AdminButton>
            </div>
          }
        />

        {error && <AdminAlert variant="error">{error}</AdminAlert>}
        {notice && <AdminAlert variant="success">{notice}</AdminAlert>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard
            title="Active ads"
            value={loading ? '' : String(activeCount)}
            icon={<ImageIcon className="h-5 w-5" />}
            accent="brand"
            description={`${ads.length} total`}
            loading={loading}
          />
          <AdminMetricCard
            title="Impressions (30d)"
            value={stats ? stats.totalImpressions.toLocaleString() : ''}
            icon={<Eye className="h-5 w-5" />}
            accent="info"
            loading={!stats}
          />
          <AdminMetricCard
            title="Clicks (30d)"
            value={stats ? stats.totalClicks.toLocaleString() : ''}
            icon={<MousePointerClick className="h-5 w-5" />}
            accent="success"
            loading={!stats}
          />
          <AdminMetricCard
            title="Click-through rate"
            value={stats ? formatPercent(stats.ctr) : ''}
            icon={<Percent className="h-5 w-5" />}
            accent="warning"
            description={
              stats?.bestAd
                ? `Best: ${stats.bestAd.title} (${stats.bestAd.clicks} clicks)`
                : 'No clicks yet'
            }
            loading={!stats}
          />
        </div>

        {chartData.length > 0 && (
          <AdminCard title="Impressions & clicks" description="Last 30 days across all ads">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adImpressionsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.12)" />
                  <XAxis
                    dataKey="label"
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{ background: 'rgba(20,20,30,0.9)', border: 'none', borderRadius: 12, color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="impressions" name="Impressions" stroke="#ffffff" strokeWidth={2} fill="url(#adImpressionsFill)" />
                  <Area type="monotone" dataKey="clicks" name="Clicks" stroke="#34d399" strokeWidth={2} fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </AdminCard>
        )}

        {showComposer && (
          <AdminCard
            title={form.id ? 'Edit advertisement' : 'Create advertisement'}
            description="Upload a banner, set where and when it should appear, then preview it before publishing."
          >
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <div className="space-y-4">
                <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
                  Banner image {form.id ? '(leave blank to keep current image)' : ''}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileSelect}
                    disabled={processingImage || Boolean(processingId)}
                    className="mt-2 block w-full text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/15 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-white/25"
                  />
                </label>
                {fileError && <p className="text-xs font-semibold text-rose-300">{fileError}</p>}
                {imageDims && (
                  <p className="text-xs text-white/50">
                    {imageDims.width}×{imageDims.height}px
                  </p>
                )}

                <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
                  Title
                  <AdminInput
                    value={form.title}
                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Summer promo"
                    className="mt-2"
                    disabled={Boolean(processingId)}
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
                    Advertiser / company
                    <AdminInput
                      value={form.advertiser_name}
                      onChange={(event) => setForm((prev) => ({ ...prev, advertiser_name: event.target.value }))}
                      placeholder="Acme Co."
                      className="mt-2"
                      disabled={Boolean(processingId)}
                    />
                  </label>

                  <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
                    Alt text (accessibility)
                    <AdminInput
                      value={form.alt_text}
                      onChange={(event) => setForm((prev) => ({ ...prev, alt_text: event.target.value }))}
                      placeholder="Acme Co. summer sale banner"
                      className="mt-2"
                      disabled={Boolean(processingId)}
                    />
                  </label>
                </div>

                <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
                  Destination URL
                  <AdminInput
                    type="url"
                    value={form.destination_url}
                    onChange={(event) => setForm((prev) => ({ ...prev, destination_url: event.target.value }))}
                    placeholder="https://example.com"
                    className="mt-2"
                    disabled={Boolean(processingId)}
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
                    Placement
                    <AdminSelect
                      value={form.placement}
                      onChange={(event) => setForm((prev) => ({ ...prev, placement: event.target.value as Placement }))}
                      className="mt-2"
                      disabled={Boolean(processingId)}
                    >
                      {Object.entries(placementLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </AdminSelect>
                  </label>

                  <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
                    Device
                    <AdminSelect
                      value={form.device_target}
                      onChange={(event) => setForm((prev) => ({ ...prev, device_target: event.target.value as DeviceTarget }))}
                      className="mt-2"
                      disabled={Boolean(processingId)}
                    >
                      {Object.entries(deviceLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </AdminSelect>
                  </label>

                  <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
                    Priority
                    <AdminInput
                      type="number"
                      value={form.priority}
                      onChange={(event) => setForm((prev) => ({ ...prev, priority: Number(event.target.value) || 0 }))}
                      className="mt-2"
                      disabled={Boolean(processingId)}
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
                    Start date
                    <AdminInput
                      type="datetime-local"
                      value={form.starts_at}
                      onChange={(event) => setForm((prev) => ({ ...prev, starts_at: event.target.value }))}
                      className="mt-2"
                      disabled={Boolean(processingId)}
                    />
                  </label>

                  <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
                    End date (optional)
                    <AdminInput
                      type="datetime-local"
                      value={form.ends_at}
                      onChange={(event) => setForm((prev) => ({ ...prev, ends_at: event.target.value }))}
                      className="mt-2"
                      disabled={Boolean(processingId)}
                    />
                  </label>
                </div>

                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
                    className="h-4 w-4 rounded border-white/30 bg-white/10"
                    disabled={Boolean(processingId)}
                  />
                  Active
                </label>

                <div className="flex justify-end gap-2">
                  <AdminButton
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowComposer(false);
                      resetComposer();
                    }}
                    disabled={Boolean(processingId)}
                  >
                    Cancel
                  </AdminButton>
                  <AdminButton
                    type="button"
                    variant="primary"
                    onClick={handleSubmit}
                    loading={processingId === (form.id ?? 'new')}
                    disabled={processingImage || Boolean(processingId) || tableMissing}
                  >
                    <ImageIcon className="h-4 w-4" />
                    {form.id ? 'Save changes' : 'Publish advertisement'}
                  </AdminButton>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Preview</p>
                <div className="relative overflow-hidden rounded-2xl bg-white shadow-xl">
                  <span className="absolute left-3 top-3 z-10 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    Sponsored
                  </span>
                  <div className="flex aspect-[320/100] w-full items-center justify-center sm:aspect-[728/90]">
                    {previewUrl ? (
                      <img src={previewUrl} alt={form.alt_text || form.title || 'Ad preview'} className="h-full w-full object-contain" />
                    ) : (
                      <p className="px-4 text-center text-xs text-slate-400">Upload an image to preview the banner</p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-white/50">
                  {placementLabels[form.placement]} · {deviceLabels[form.device_target]}
                </p>
              </div>
            </div>
          </AdminCard>
        )}

        <AdminFilterBar className="flex flex-wrap items-center gap-2">
          {(['all', 'active', 'scheduled', 'expired', 'inactive'] as StatusFilter[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition ${
                statusFilter === value
                  ? 'border-white/40 bg-white/25 text-white'
                  : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {value}
            </button>
          ))}
        </AdminFilterBar>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <AdminSkeleton key={item} className="h-28 w-full rounded-3xl" />
            ))}
          </div>
        ) : filteredAds.length === 0 ? (
          <AdminCard>
            <AdminEmptyState
              icon={<ImageIcon className="h-8 w-8" />}
              title="No advertisements yet"
              message="Create a banner ad to show it on the homepage, in the feed, or in the footer."
            />
          </AdminCard>
        ) : (
          <div className="space-y-4">
            {filteredAds.map((ad) => {
              const status = computeStatus(ad);
              const ctr = ad.impression_count > 0 ? ad.click_count / ad.impression_count : 0;
              const imageUrl = supabaseClient.storage.from('ad-creatives').getPublicUrl(ad.image_path).data.publicUrl;

              return (
                <AdminCard key={ad.id} className={status === 'inactive' || status === 'expired' ? 'opacity-70' : ''}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 flex-1 gap-4">
                      <div className="h-20 w-32 flex-shrink-0 overflow-hidden rounded-xl bg-white/10">
                        <img src={imageUrl} alt="" className="h-full w-full object-contain" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <AdminBadge variant={statusBadge[status]}>{status}</AdminBadge>
                          <AdminBadge variant="neutral">{placementLabels[ad.placement]}</AdminBadge>
                          <AdminBadge variant="muted">{deviceLabels[ad.device_target]}</AdminBadge>
                          <AdminBadge variant="brand">Priority {ad.priority}</AdminBadge>
                        </div>

                        <h3 className="mt-3 truncate text-base font-semibold text-white">{ad.title}</h3>
                        {ad.advertiser_name && <p className="text-sm text-white/60">{ad.advertiser_name}</p>}

                        <p className="mt-2 text-xs text-white/50">
                          {formatDateTime(ad.starts_at)} → {formatDateTime(ad.ends_at)}
                        </p>

                        <p className="mt-2 text-xs text-white/50">
                          {ad.impression_count.toLocaleString()} impressions · {ad.click_count.toLocaleString()} clicks · {formatPercent(ctr)} CTR
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-shrink-0 flex-wrap items-center gap-2 lg:flex-col lg:items-stretch">
                      <AdminButton size="sm" variant="secondary" onClick={() => openEditComposer(ad)} disabled={processingId === ad.id}>
                        Edit
                      </AdminButton>
                      <AdminButton
                        size="sm"
                        variant="secondary"
                        onClick={() => handleToggleActive(ad)}
                        loading={processingId === ad.id}
                      >
                        {ad.active ? 'Deactivate' : 'Activate'}
                      </AdminButton>
                      <AdminButton
                        size="sm"
                        variant="danger"
                        onClick={() => setConfirmDelete(ad)}
                        disabled={processingId === ad.id}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </AdminButton>
                    </div>
                  </div>
                </AdminCard>
              );
            })}
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">Delete this advertisement?</h2>
            <p className="mt-2 text-sm text-slate-600">
              “{confirmDelete.title}” will be removed and its banner will stop appearing on the site. This cannot be undone.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <AdminButton type="button" variant="secondary" onClick={() => setConfirmDelete(null)} disabled={Boolean(processingId)}>
                Cancel
              </AdminButton>
              <AdminButton
                type="button"
                variant="danger"
                onClick={() => handleDelete(confirmDelete)}
                loading={processingId === confirmDelete.id}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </AdminButton>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
