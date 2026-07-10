import React, { useEffect, useMemo, useState } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import {
  Trash2,
  Eye,
  UserX,
  Loader2,
  AlertCircle,
  Flag,
  Calendar,
  Filter,
  RefreshCw,
  X,
  CheckCircle,
  AlertTriangle,
  Search,
  ShieldAlert,
  Image as ImageIcon,
  Sparkles,
  SlidersHorizontal,
  User,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';

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

function MetricCard({
  label,
  value,
  description,
  icon,
  tone = 'slate',
}: {
  label: string;
  value: number | string;
  description: string;
  icon: React.ReactNode;
  tone?: 'slate' | 'red' | 'amber' | 'blue' | 'emerald';
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    red: 'bg-red-50 text-red-700 border-red-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${tones[tone]}`}>{icon}</div>
      </div>
      <p className="mt-3 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function StatusBadge({ post }: { post: FlaggedPost }) {
  if (isHighPriority(post)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
        <AlertTriangle className="h-3.5 w-3.5" /> High priority
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
      <Flag className="h-3.5 w-3.5" /> Needs review
    </span>
  );
}

function ModerationSummaryCards({ posts }: { posts: FlaggedPost[] }) {
  const totalRedFlags = posts.reduce((sum, post) => sum + post.red_flag_count, 0);
  const highPriority = posts.filter(isHighPriority).length;
  const imagePosts = posts.filter((post) => Boolean(post.photo_url)).length;
  const averageRedFlags = posts.length ? Math.round(totalRedFlags / posts.length) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Flagged posts" value={posts.length} description="Items matching the current queue filters." icon={<Flag className="h-5 w-5" />} tone="blue" />
      <MetricCard label="High priority" value={highPriority} description="Posts with more than 10 red flags." icon={<ShieldAlert className="h-5 w-5" />} tone="red" />
      <MetricCard label="Image posts" value={imagePosts} description="Flagged posts with reviewable media." icon={<ImageIcon className="h-5 w-5" />} tone="emerald" />
      <MetricCard label="Avg. red flags" value={averageRedFlags} description="Average red flags in this view." icon={<SlidersHorizontal className="h-5 w-5" />} tone="amber" />
    </div>
  );
}

function FlaggedPostFilters({ filters, onChange, onReset }: { filters: FilterState; onChange: (key: keyof FilterState, value: string | number) => void; onReset: () => void }) {
  const active = hasActiveFilters(filters);
  const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10';
  const labelClass = 'mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-950"><Filter className="h-4 w-4 text-slate-500" /> Queue filters</h3>
          <p className="mt-1 text-sm text-slate-500">Narrow the queue without changing moderation behavior.</p>
        </div>
        <button type="button" onClick={onReset} disabled={!active} className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
          Clear filters
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <label htmlFor="search" className={labelClass}>Search username</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="text" id="search" value={filters.searchTerm} onChange={(e) => onChange('searchTerm', e.target.value)} placeholder="Search by username..." className={`${inputClass} pl-10`} />
          </div>
        </div>
        <div>
          <label htmlFor="gender-filter" className={labelClass}>Gender</label>
          <select id="gender-filter" value={filters.gender} onChange={(e) => onChange('gender', e.target.value)} className={inputClass}>
            <option value="all">All genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
        <div>
          <label htmlFor="threshold" className={labelClass}>Min red flags</label>
          <input type="number" id="threshold" min="1" value={filters.redFlagThreshold} onChange={(e) => onChange('redFlagThreshold', parseInt(e.target.value) || 1)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3 md:col-span-2 xl:col-span-1 xl:grid-cols-1">
          <div>
            <label htmlFor="date-from" className={labelClass}>From</label>
            <input type="date" id="date-from" value={filters.dateFrom} onChange={(e) => onChange('dateFrom', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="date-to" className={labelClass}>To</label>
            <input type="date" id="date-to" value={filters.dateTo} onChange={(e) => onChange('dateTo', e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      {active && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {filters.searchTerm && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">Search: {filters.searchTerm}</span>}
          {filters.gender !== 'all' && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">Gender: {filters.gender}</span>}
          {filters.redFlagThreshold !== 1 && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">Minimum flags: {filters.redFlagThreshold}</span>}
          {filters.dateFrom && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">From: {filters.dateFrom}</span>}
          {filters.dateTo && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">To: {filters.dateTo}</span>}
        </div>
      )}
    </section>
  );
}

function FlaggedPostCard({ post, processingPostId, onViewImage, onDeletePost, onBanUser }: { post: FlaggedPost; processingPostId: string | null; onViewImage: (imageUrl: string) => void; onDeletePost: (postId: string, photoUrl: string, username: string) => void; onBanUser: (userId: string, username: string) => void }) {
  const posted = formatDateTime(post.created_at);
  const isDeleting = processingPostId === post.id;
  const isBanning = processingPostId === post.user_id;

  return (
    <article className={`group rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5 ${isHighPriority(post) ? 'border-red-200 ring-1 ring-red-100' : 'border-slate-200'}`}>
      <div className="grid gap-5 lg:grid-cols-[140px_1fr_auto] lg:items-start">
        <button type="button" onClick={() => onViewImage(post.photo_url)} className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-500/20 sm:aspect-square lg:h-32 lg:w-32" aria-label={`View full image for post by @${post.username}`}>
          <img src={post.photo_url} alt="Post thumbnail" className="h-full w-full object-cover transition duration-200 group-hover:scale-105" />
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-white backdrop-blur"><Eye className="h-3 w-3" /> Preview</span>
        </button>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge post={post} />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"><User className="h-3.5 w-3.5" /> {post.gender}</span>
          </div>

          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="truncate text-lg font-semibold text-slate-950">@{post.username}</h3>
                <p className="mt-1 text-sm text-slate-500">User ID: <span className="font-mono text-xs">{post.user_id}</span></p>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500"><Calendar className="h-4 w-4" /><span>{posted.date}</span><span className="text-slate-300">•</span><span>{posted.time}</span></div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Red flags</p><p className="mt-1 flex items-center gap-2 text-xl font-bold text-red-600"><Flag className="h-4 w-4" />{post.red_flag_count}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Green flags</p><p className="mt-1 flex items-center gap-2 text-xl font-bold text-emerald-600"><CheckCircle className="h-4 w-4" />{post.green_flag_count}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk signal</p><p className={`mt-1 text-sm font-bold ${isHighPriority(post) ? 'text-red-700' : 'text-amber-700'}`}>{isHighPriority(post) ? 'Escalated' : 'Standard review'}</p></div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:w-40 lg:flex-col">
          <button type="button" onClick={() => onViewImage(post.photo_url)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-500/10"><Eye className="h-4 w-4" /> View</button>
          <button type="button" onClick={() => onDeletePost(post.id, post.photo_url, post.username)} disabled={isDeleting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-red-500/20">{isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete</button>
          <button type="button" onClick={() => onBanUser(post.user_id, post.username)} disabled={isBanning} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-slate-500/20">{isBanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />} Ban user</button>
        </div>
      </div>
    </article>
  );
}

function LoadingSkeleton() {
  return <div className="space-y-4">{[0, 1, 2].map((item) => <div key={item} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex gap-5"><div className="h-28 w-28 animate-pulse rounded-2xl bg-slate-200" /><div className="flex-1 space-y-3"><div className="h-4 w-32 animate-pulse rounded bg-slate-200" /><div className="h-7 w-52 animate-pulse rounded bg-slate-200" /><div className="grid grid-cols-3 gap-3"><div className="h-16 animate-pulse rounded-xl bg-slate-100" /><div className="h-16 animate-pulse rounded-xl bg-slate-100" /><div className="h-16 animate-pulse rounded-xl bg-slate-100" /></div></div></div></div>)}</div>;
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
  const isAdmin = session?.user?.email?.includes('admin') || true;

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

  const openImageModal = (imageUrl: string) => { setSelectedImage(imageUrl); setIsImageModalOpen(true); };
  const closeImageModal = () => { setSelectedImage(null); setIsImageModalOpen(false); };
  const handleFilterChange = (key: keyof FilterState, value: string | number) => setFilters((prev) => ({ ...prev, [key]: value }));
  const resetFilters = () => setFilters(defaultFilters);

  const totalRedFlags = useMemo(() => flaggedPosts.reduce((sum, post) => sum + post.red_flag_count, 0), [flaggedPosts]);

  if (!isAdmin) {
    return <AdminLayout activePage={activePage} onNavigate={onNavigate}><div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm"><AlertCircle className="mx-auto mb-4 h-16 w-16 text-red-500" /><h2 className="mb-4 text-2xl font-bold text-red-600">Access Denied</h2><p className="text-slate-700">You do not have administrative privileges to view this page.</p></div></AdminLayout>;
  }

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200 ring-1 ring-white/15"><Sparkles className="h-3.5 w-3.5" /> Moderation workspace</span>
                <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Moderation Queue</h1>
                <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">Review flagged content, inspect risk signals, preview reported images, and take existing moderation actions from a focused admin queue.</p>
              </div>
              <button type="button" onClick={fetchFlaggedPosts} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70 focus:outline-none focus:ring-4 focus:ring-white/20"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh queue</button>
            </div>
          </div>
          <div className="grid gap-4 p-4 text-sm text-slate-600 sm:grid-cols-3 sm:p-6">
            <div className="rounded-2xl bg-slate-50 p-4"><span className="font-semibold text-slate-950">Current view</span><p className="mt-1">{flaggedPosts.length} posts and {totalRedFlags} total red flags.</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><span className="font-semibold text-slate-950">Priority rule</span><p className="mt-1">Posts above 10 red flags are marked high priority.</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><span className="font-semibold text-slate-950">Actions</span><p className="mt-1">Delete post and ban user actions remain unchanged.</p></div>
          </div>
        </section>

        <ModerationSummaryCards posts={flaggedPosts} />
        <FlaggedPostFilters filters={filters} onChange={handleFilterChange} onReset={resetFilters} />

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4" role="alert"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" /><div><p className="font-semibold text-red-800">Unable to load moderation queue</p><p className="mt-1 text-sm text-red-700">{error}</p></div></div></div>}

        <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 shadow-sm sm:p-4">
          <div className="mb-4 flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold text-slate-950">Flagged post queue</h2><p className="text-sm text-slate-500">Cards are ordered by red flag count, highest first.</p></div></div>
          {loading ? <LoadingSkeleton /> : flaggedPosts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><CheckCircle className="mx-auto h-12 w-12 text-emerald-500" /><h3 className="mt-4 text-lg font-semibold text-slate-950">No flagged posts need review right now.</h3><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{hasActiveFilters(filters) ? 'Try clearing or adjusting filters to broaden the moderation queue.' : 'All posts are currently within the configured flag threshold.'}</p></div>
          ) : <div className="space-y-4">{flaggedPosts.map((post) => <FlaggedPostCard key={post.id} post={post} processingPostId={processingPostId} onViewImage={openImageModal} onDeletePost={handleDeletePost} onBanUser={handleBanUser} />)}</div>}
        </section>

        {isImageModalOpen && selectedImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Post image preview">
            <div className="relative max-h-full w-full max-w-5xl rounded-3xl border border-white/10 bg-slate-900 p-3 shadow-2xl sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-4 px-1"><div><p className="text-sm font-semibold text-white">Post image preview</p><p className="text-xs text-slate-400">Review media without changing image access behavior.</p></div><button type="button" onClick={closeImageModal} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-white/20" aria-label="Close image preview"><X className="h-5 w-5" /></button></div>
              <div className="flex max-h-[78vh] items-center justify-center overflow-hidden rounded-2xl bg-black"><img src={selectedImage} alt="Full size post" className="max-h-[78vh] max-w-full object-contain" /></div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
