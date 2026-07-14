import { useEffect, useMemo, useState } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import {
  Trash2,
  Download,
  Eye,
  UserX,
  AlertCircle,
  Flag,
  Calendar,
  Filter,
  RefreshCw,
  ScanEye,
  X,
  CheckCircle,
  AlertTriangle,
  Search,
  ShieldAlert,
  Image as ImageIcon,
  SlidersHorizontal,
  User,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { downloadCsv, csvTimestamp } from '@/lib/adminCsv';
import { nsfwRiskLevel, type NsfwScanResult } from '@/lib/nsfwScanner';
import {
  AdminAlert,
  AdminBadge,
  AdminButton,
  AdminEmptyState,
  AdminFilterBar,
  AdminInput,
  AdminMetricCard,
  AdminPageHeader,
  AdminSelect,
  AdminSkeleton,
} from './ui';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const maybeError = error as { message?: unknown };
    if (typeof maybeError.message === 'string') return maybeError.message;
    return JSON.stringify(error);
  }
  return String(error);
}

interface FlaggedPost {
  id: string;
  user_id: string;
  username: string;
  gender: 'Male' | 'Female';
  photo_url: string;
  green_flag_count: number;
  red_flag_count: number;
  created_at: string;
}

interface FilterState {
  gender: 'all' | 'Male' | 'Female';
  redFlagThreshold: number;
  dateFrom: string;
  dateTo: string;
  searchTerm: string;
}

interface ModerationScore {
  post_id: string;
  nsfw_score: number;
  top_class: string | null;
  scanned_at: string;
}

function NsfwScoreBadge({ score }: { score?: ModerationScore }) {
  if (!score) {
    return <AdminBadge variant="muted">Not scanned</AdminBadge>;
  }

  const risk = nsfwRiskLevel(score.nsfw_score);
  const percent = Math.round(score.nsfw_score * 100);

  return (
    <AdminBadge variant={risk === 'high' ? 'danger' : risk === 'medium' ? 'warning' : 'success'}>
      <ScanEye className="h-3.5 w-3.5" />
      AI: {percent}% NSFW{score.top_class ? ` · ${score.top_class}` : ''}
    </AdminBadge>
  );
}

const defaultFilters: FilterState = {
  gender: 'all',
  redFlagThreshold: 1,
  dateFrom: '',
  dateTo: '',
  searchTerm: '',
};

function formatDateTime(date: string) {
  const parsed = new Date(date);
  return {
    date: parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    time: parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  };
}

function isHighPriority(post: FlaggedPost) {
  return post.red_flag_count > 10;
}

function hasActiveFilters(filters: FilterState) {
  return (
    filters.gender !== defaultFilters.gender ||
    filters.redFlagThreshold !== defaultFilters.redFlagThreshold ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo) ||
    Boolean(filters.searchTerm)
  );
}

function StatusBadge({ post }: { post: FlaggedPost }) {
  if (isHighPriority(post)) {
    return (
      <AdminBadge variant="danger">
        <AlertTriangle className="h-3.5 w-3.5" /> High priority
      </AdminBadge>
    );
  }
  return (
    <AdminBadge variant="warning">
      <Flag className="h-3.5 w-3.5" /> Needs review
    </AdminBadge>
  );
}

function ModerationSummaryCards({ posts }: { posts: FlaggedPost[] }) {
  const totalRedFlags = posts.reduce((sum, post) => sum + post.red_flag_count, 0);
  const highPriority = posts.filter(isHighPriority).length;
  const imagePosts = posts.filter((post) => Boolean(post.photo_url)).length;
  const averageRedFlags = posts.length ? Math.round(totalRedFlags / posts.length) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <AdminMetricCard title="Flagged posts" value={posts.length} description="Items matching the current queue filters" icon={<Flag className="h-5 w-5" />} accent="brand" />
      <AdminMetricCard title="High priority" value={highPriority} description="Posts with more than 10 red flags" icon={<ShieldAlert className="h-5 w-5" />} accent={highPriority > 0 ? 'danger' : 'muted'} />
      <AdminMetricCard title="Image posts" value={imagePosts} description="Flagged posts with reviewable media" icon={<ImageIcon className="h-5 w-5" />} accent="info" />
      <AdminMetricCard title="Avg. red flags" value={averageRedFlags} description="Average red flags in this view" icon={<SlidersHorizontal className="h-5 w-5" />} accent="warning" />
    </div>
  );
}

function FlaggedPostFilters({ filters, onChange, onReset }: { filters: FilterState; onChange: (key: keyof FilterState, value: string | number) => void; onReset: () => void }) {
  const active = hasActiveFilters(filters);
  const labelClass = 'mb-2 block text-xs font-semibold uppercase tracking-wide text-white/60';

  return (
    <AdminFilterBar>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-white"><Filter className="h-4 w-4 text-white/50" /> Queue filters</h3>
        <AdminButton type="button" variant="ghost" size="sm" onClick={onReset} disabled={!active}>
          Clear filters
        </AdminButton>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <label htmlFor="search" className={labelClass}>Search username</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <AdminInput type="text" id="search" value={filters.searchTerm} onChange={(e) => onChange('searchTerm', e.target.value)} placeholder="Search by username…" className="pl-10" />
          </div>
        </div>
        <div>
          <label htmlFor="gender-filter" className={labelClass}>Gender</label>
          <AdminSelect id="gender-filter" value={filters.gender} onChange={(e) => onChange('gender', e.target.value)}>
            <option value="all">All genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </AdminSelect>
        </div>
        <div>
          <label htmlFor="threshold" className={labelClass}>Min red flags</label>
          <AdminInput type="number" id="threshold" min="1" value={filters.redFlagThreshold} onChange={(e) => onChange('redFlagThreshold', parseInt(e.target.value) || 1)} />
        </div>
        <div className="grid grid-cols-2 gap-3 md:col-span-2 xl:col-span-1 xl:grid-cols-1">
          <div>
            <label htmlFor="date-from" className={labelClass}>From</label>
            <AdminInput type="date" id="date-from" value={filters.dateFrom} onChange={(e) => onChange('dateFrom', e.target.value)} />
          </div>
          <div>
            <label htmlFor="date-to" className={labelClass}>To</label>
            <AdminInput type="date" id="date-to" value={filters.dateTo} onChange={(e) => onChange('dateTo', e.target.value)} />
          </div>
        </div>
      </div>

      {active && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/15 pt-4">
          {filters.searchTerm && <AdminBadge variant="neutral">Search: {filters.searchTerm}</AdminBadge>}
          {filters.gender !== 'all' && <AdminBadge variant="neutral">Gender: {filters.gender}</AdminBadge>}
          {filters.redFlagThreshold !== 1 && <AdminBadge variant="neutral">Minimum flags: {filters.redFlagThreshold}</AdminBadge>}
          {filters.dateFrom && <AdminBadge variant="neutral">From: {filters.dateFrom}</AdminBadge>}
          {filters.dateTo && <AdminBadge variant="neutral">To: {filters.dateTo}</AdminBadge>}
        </div>
      )}
    </AdminFilterBar>
  );
}

function FlaggedPostCard({ post, moderationScore, processingPostId, onViewImage, onDeletePost, onBanUser }: { post: FlaggedPost; moderationScore?: ModerationScore; processingPostId: string | null; onViewImage: (imageUrl: string) => void; onDeletePost: (postId: string, photoUrl: string, username: string) => void; onBanUser: (userId: string, username: string) => void }) {
  const posted = formatDateTime(post.created_at);
  const isDeleting = processingPostId === post.id;
  const isBanning = processingPostId === post.user_id;

  return (
    <article className={`admin-glass group rounded-2xl p-4 transition hover:-translate-y-0.5 sm:p-5 ${isHighPriority(post) ? 'ring-2 ring-rose-400/50' : ''}`}>
      <div className="grid gap-5 lg:grid-cols-[140px_1fr_auto] lg:items-start">
        <button type="button" onClick={() => onViewImage(post.photo_url)} className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/15 bg-white/5 focus:outline-none focus:ring-4 focus:ring-white/30 sm:aspect-square lg:h-32 lg:w-32" aria-label={`View full image for post by @${post.username}`}>
          <img src={post.photo_url} alt="Post thumbnail" className="h-full w-full object-cover transition duration-200 group-hover:scale-105" />
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-white backdrop-blur"><Eye className="h-3 w-3" /> Preview</span>
        </button>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge post={post} />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white"><User className="h-3.5 w-3.5" /> {post.gender}</span>
            <NsfwScoreBadge score={moderationScore} />
          </div>

          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="truncate text-lg font-semibold text-white">@{post.username}</h3>
                <p className="mt-1 text-sm text-white/60">User ID: <span className="font-mono text-xs">{post.user_id}</span></p>
              </div>
              <div className="flex items-center gap-2 text-sm text-white/60"><Calendar className="h-4 w-4" /><span>{posted.date}</span><span className="text-white/30">•</span><span>{posted.time}</span></div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/15 bg-white/5 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-white/50">Red flags</p><p className="mt-1 flex items-center gap-2 text-xl font-bold text-rose-300" aria-label={`Red flags: ${post.red_flag_count}`}><Flag className="h-4 w-4" aria-hidden="true" />{post.red_flag_count}</p></div>
            <div className="rounded-xl border border-white/15 bg-white/5 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-white/50">Green flags</p><p className="mt-1 flex items-center gap-2 text-xl font-bold text-emerald-300" aria-label={`Green flags: ${post.green_flag_count}`}><CheckCircle className="h-4 w-4" aria-hidden="true" />{post.green_flag_count}</p></div>
            <div className="rounded-xl border border-white/15 bg-white/5 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-white/50">Risk signal</p><p className={`mt-1 text-sm font-bold ${isHighPriority(post) ? 'text-rose-300' : 'text-amber-300'}`}>{isHighPriority(post) ? 'Escalated' : 'Standard review'}</p></div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:w-40 lg:flex-col">
          <AdminButton type="button" variant="secondary" onClick={() => onViewImage(post.photo_url)}>
            <Eye className="h-4 w-4" /> View
          </AdminButton>
          <AdminButton type="button" variant="danger" onClick={() => onDeletePost(post.id, post.photo_url, post.username)} loading={isDeleting}>
            {!isDeleting && <Trash2 className="h-4 w-4" />} Delete
          </AdminButton>
          <AdminButton type="button" variant="secondary" onClick={() => onBanUser(post.user_id, post.username)} loading={isBanning}>
            {!isBanning && <UserX className="h-4 w-4" />} Ban user
          </AdminButton>
        </div>
      </div>
    </article>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((item) => (
        <div key={item} className="admin-glass rounded-3xl p-5">
          <div className="flex gap-5">
            <AdminSkeleton className="h-28 w-28 rounded-admin-xl" />
            <div className="flex-1 space-y-3">
              <AdminSkeleton className="h-4 w-32" />
              <AdminSkeleton className="h-7 w-52" />
              <div className="grid grid-cols-3 gap-3">
                <AdminSkeleton className="h-16" />
                <AdminSkeleton className="h-16" />
                <AdminSkeleton className="h-16" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReviewFlaggedPosts({ activePage = 'flagged-posts', onNavigate }: { activePage?: string; onNavigate?: (page: string) => void }) {
  const supabase = useSupabaseClient();
  const session = useSession();
  const [flaggedPosts, setFlaggedPosts] = useState<FlaggedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingPostId, setProcessingPostId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [moderationScores, setModerationScores] = useState<Map<string, ModerationScore>>(new Map());
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const isAdmin = session?.user?.email?.includes('admin');

  const loadModerationScores = async (postIds: string[]) => {
    if (postIds.length === 0) return;

    try {
      const { data, error: scoreError } = await supabase
        .from('post_moderation_scores')
        .select('post_id, nsfw_score, top_class, scanned_at')
        .in('post_id', postIds);

      if (scoreError || !Array.isArray(data)) return;

      setModerationScores((current) => {
        const next = new Map(current);
        for (const row of data) {
          next.set(row.post_id, { ...row, nsfw_score: Number(row.nsfw_score) });
        }
        return next;
      });
    } catch {
      // AI scores are additive; the queue works without them.
    }
  };

  const fetchFlaggedPosts = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('posts').select('*').gte('red_flag_count', filters.redFlagThreshold).order('red_flag_count', { ascending: false });
      if (filters.gender !== 'all') query = query.eq('gender', filters.gender);
      if (filters.dateFrom) query = query.gte('created_at', new Date(filters.dateFrom).toISOString());
      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDate.toISOString());
      }
      const { data, error: fetchError } = await query;
      if (fetchError) {
        if (fetchError.code === '42P01') {
          console.warn('Posts table not found, using mock data');
          setMockData();
          return;
        }
        throw fetchError;
      }
      let filteredData = data || [];
      if (filters.searchTerm) filteredData = filteredData.filter((post) => post.username.toLowerCase().includes(filters.searchTerm.toLowerCase()));
      setFlaggedPosts(filteredData);
      void loadModerationScores(filteredData.map((post) => post.id));
    } catch (err: unknown) {
      console.error('Error fetching flagged posts:', err);
      setError(`Failed to fetch flagged posts: ${getErrorMessage(err)}`);
      setMockData();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      setError('Access Denied: You must be an administrator to view this page.');
      setLoading(false);
      return;
    }
    fetchFlaggedPosts();
  }, [isAdmin, supabase, filters]);

  const setMockData = () => {
    const mockPosts: FlaggedPost[] = [
      { id: '1', user_id: 'user-1', username: 'problematic_user', gender: 'Male', photo_url: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=400', green_flag_count: 2, red_flag_count: 15, created_at: new Date().toISOString() },
      { id: '2', user_id: 'user-2', username: 'flagged_content', gender: 'Female', photo_url: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=400', green_flag_count: 5, red_flag_count: 8, created_at: new Date(Date.now() - 86400000).toISOString() },
      { id: '3', user_id: 'user-3', username: 'reported_user', gender: 'Male', photo_url: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=400', green_flag_count: 1, red_flag_count: 3, created_at: new Date(Date.now() - 172800000).toISOString() },
    ];
    let filteredMockData = mockPosts.filter((post) => post.red_flag_count >= filters.redFlagThreshold);
    if (filters.gender !== 'all') filteredMockData = filteredMockData.filter((post) => post.gender === filters.gender);
    if (filters.searchTerm) filteredMockData = filteredMockData.filter((post) => post.username.toLowerCase().includes(filters.searchTerm.toLowerCase()));
    setFlaggedPosts(filteredMockData);
    setLoading(false);
  };

  const handleDeletePost = async (postId: string, photoUrl: string, username: string) => {
    if (!confirm(`Are you sure you want to delete the post by @${username}? This action cannot be undone.`)) return;
    setProcessingPostId(postId);
    setError(null);
    try {
      const urlParts = photoUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const userId = urlParts[urlParts.length - 2];
      const filePath = `posts/${userId}/${fileName}`;
      const { error: storageError } = await supabase.storage.from('posts').remove([filePath]);
      if (storageError) console.warn('Storage deletion failed:', storageError);
      const { error: deleteError } = await supabase.from('posts').delete().eq('id', postId);
      if (deleteError && deleteError.code !== '42P01') throw deleteError;
      setFlaggedPosts((prev) => prev.filter((post) => post.id !== postId));
      alert(`Post by @${username} has been deleted successfully.`);
    } catch (err: unknown) {
      console.error('Error deleting post:', err);
      setError(`Failed to delete post: ${getErrorMessage(err)}`);
    } finally {
      setProcessingPostId(null);
    }
  };

  const handleBanUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to ban @${username}? This will prevent them from accessing the platform.`)) return;
    setProcessingPostId(userId);
    setError(null);
    try {
      const { error: banError } = await supabase.from('registrations').update({ status: 'banned' }).eq('id', userId);
      if (banError && banError.code !== '42P01') throw banError;
      try {
        await supabase.from('moderation_logs').insert([{ admin_id: session?.user?.id, action: 'ban_user', target_user_id: userId, reason: 'Banned via flagged posts review', created_at: new Date().toISOString() }]);
      } catch (logError) {
        console.warn('Failed to log moderation action:', logError);
      }
      setFlaggedPosts((prev) => prev.filter((post) => post.user_id !== userId));
      alert(`User @${username} has been banned successfully.`);
    } catch (err: unknown) {
      console.error('Error banning user:', err);
      setError(`Failed to ban user: ${getErrorMessage(err)}`);
    } finally {
      setProcessingPostId(null);
    }
  };

  const handleScanQueue = async () => {
    const targets = flaggedPosts.filter((post) => Boolean(post.photo_url));

    if (targets.length === 0) {
      setScanNotice('No image posts in the current queue to scan.');
      return;
    }

    setScanning(true);
    setScanNotice(null);
    setScanProgress({ done: 0, total: targets.length });

    let scanned = 0;
    let failed = 0;

    try {
      // Lazy-load TensorFlow + the NSFW model only when a scan is requested.
      const { scanImageUrl } = await import('@/lib/nsfwScanner');

      for (const post of targets) {
        let result: NsfwScanResult | null = null;

        try {
          result = await scanImageUrl(post.photo_url);
        } catch {
          failed += 1;
        }

        if (result) {
          scanned += 1;
          const score: ModerationScore = {
            post_id: post.id,
            nsfw_score: result.nsfwScore,
            top_class: result.topClass,
            scanned_at: new Date().toISOString(),
          };

          setModerationScores((current) => new Map(current).set(post.id, score));

          // Persist so other admins see the score without rescanning.
          const { error: saveError } = await supabase
            .from('post_moderation_scores')
            .upsert(
              {
                post_id: post.id,
                nsfw_score: result.nsfwScore,
                top_class: result.topClass,
                class_scores: result.classScores,
                model: result.model,
                scanned_by: session?.user?.id ?? null,
                scanned_at: score.scanned_at,
              },
              { onConflict: 'post_id' },
            );

          if (saveError) console.warn('Unable to persist moderation score:', saveError);
        }

        setScanProgress({ done: scanned + failed, total: targets.length });
      }

      setScanNotice(
        `AI screening complete: ${scanned} image${scanned === 1 ? '' : 's'} scored${
          failed > 0 ? `, ${failed} could not be scanned (image blocked or unreachable)` : ''
        }. Scores run fully in your browser — images never leave Supabase.`,
      );
    } catch (scanError: unknown) {
      setScanNotice(`AI screening unavailable: ${getErrorMessage(scanError)}`);
    } finally {
      setScanning(false);
      setScanProgress(null);
    }
  };

  const exportCsv = () => {
    downloadCsv(`teatimecari-flagged-posts-${csvTimestamp()}`, flaggedPosts, [
      { header: 'Post ID', value: (post) => post.id },
      { header: 'Username', value: (post) => post.username },
      { header: 'User ID', value: (post) => post.user_id },
      { header: 'Gender', value: (post) => post.gender },
      { header: 'Red flags', value: (post) => post.red_flag_count },
      { header: 'Green flags', value: (post) => post.green_flag_count },
      { header: 'AI NSFW score', value: (post) => moderationScores.get(post.id)?.nsfw_score ?? '' },
      { header: 'AI top class', value: (post) => moderationScores.get(post.id)?.top_class ?? '' },
      { header: 'Created', value: (post) => post.created_at },
      { header: 'Photo URL', value: (post) => post.photo_url },
    ]);
  };

  const openImageModal = (imageUrl: string) => { setSelectedImage(imageUrl); setIsImageModalOpen(true); };
  const closeImageModal = () => { setSelectedImage(null); setIsImageModalOpen(false); };
  const handleFilterChange = (key: keyof FilterState, value: string | number) => setFilters((prev) => ({ ...prev, [key]: value }));
  const resetFilters = () => setFilters(defaultFilters);

  const totalRedFlags = useMemo(() => flaggedPosts.reduce((sum, post) => sum + post.red_flag_count, 0), [flaggedPosts]);

  if (!isAdmin) {
    return <AdminLayout activePage={activePage} onNavigate={onNavigate}><div className="rounded-3xl border border-rose-300/30 bg-rose-500/15 p-8 text-center backdrop-blur-xl"><AlertCircle className="mx-auto mb-4 h-16 w-16 text-rose-300" /><h2 className="mb-4 text-2xl font-bold text-white">Access Denied</h2><p className="text-white/70">You do not have administrative privileges to view this page.</p></div></AdminLayout>;
  }

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className="space-y-6">
        <AdminPageHeader
          title="Moderation"
          description="Review flagged content, inspect risk signals, and act on reported posts."
          meta={`${flaggedPosts.length} posts · ${totalRedFlags} total red flags in the current view`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <AdminButton type="button" variant="secondary" onClick={handleScanQueue} disabled={loading || scanning || flaggedPosts.length === 0} loading={scanning}>
                {!scanning && <ScanEye className="h-4 w-4" />}
                {scanning && scanProgress
                  ? `Scanning ${scanProgress.done}/${scanProgress.total}…`
                  : 'AI scan queue'}
              </AdminButton>
              <AdminButton type="button" variant="glass" onClick={exportCsv} disabled={loading || flaggedPosts.length === 0}>
                <Download className="h-4 w-4" />
                Export CSV
              </AdminButton>
              <AdminButton type="button" variant="glass" onClick={fetchFlaggedPosts} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh queue
              </AdminButton>
            </div>
          }
        />

        {scanNotice && (
          <AdminAlert variant="info">
            <p>{scanNotice}</p>
          </AdminAlert>
        )}

        <ModerationSummaryCards posts={flaggedPosts} />
        <FlaggedPostFilters filters={filters} onChange={handleFilterChange} onReset={resetFilters} />

        {error && (
          <AdminAlert variant="error">
            <p className="font-semibold">Unable to load moderation queue</p>
            <p className="mt-1">{error}</p>
          </AdminAlert>
        )}

        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-white">Flagged post queue</h2>
            <p className="mt-1 text-sm text-white/70">Ordered by red flag count, highest first.</p>
          </div>
          {loading ? <LoadingSkeleton /> : flaggedPosts.length === 0 ? (
            <div className="admin-glass rounded-3xl">
              <AdminEmptyState
                icon={<CheckCircle className="h-8 w-8" />}
                title="No flagged posts need review right now"
                message={hasActiveFilters(filters) ? 'Try clearing or adjusting filters to broaden the moderation queue.' : 'All posts are currently within the configured flag threshold.'}
                action={
                  hasActiveFilters(filters) ? (
                    <AdminButton type="button" variant="secondary" onClick={resetFilters}>
                      Clear filters
                    </AdminButton>
                  ) : undefined
                }
              />
            </div>
          ) : <div className="space-y-4">{flaggedPosts.map((post) => <FlaggedPostCard key={post.id} post={post} moderationScore={moderationScores.get(post.id)} processingPostId={processingPostId} onViewImage={openImageModal} onDeletePost={handleDeletePost} onBanUser={handleBanUser} />)}</div>}
        </section>

        {isImageModalOpen && selectedImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Post image preview">
            <div className="relative max-h-full w-full max-w-5xl rounded-3xl border border-white/10 bg-slate-900 p-3 shadow-2xl sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-4 px-1"><div><p className="text-sm font-semibold text-white">Post image preview</p><p className="text-xs text-white/50">Review media without changing image access behavior.</p></div><button type="button" onClick={closeImageModal} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-white/20" aria-label="Close image preview"><X className="h-5 w-5" /></button></div>
              <div className="flex max-h-[78vh] items-center justify-center overflow-hidden rounded-2xl bg-black"><img src={selectedImage} alt="Full size post" className="max-h-[78vh] max-w-full object-contain" /></div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
