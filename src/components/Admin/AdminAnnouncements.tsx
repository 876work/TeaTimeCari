import { useEffect, useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import {
  Megaphone,
  Plus,
  RefreshCw,
  Send,
  Trash2,
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
  AdminSelect,
  AdminSkeleton,
} from './ui';

interface Announcement {
  id: string;
  title: string;
  body: string;
  variant: 'info' | 'warning' | 'critical';
  audience: 'all' | 'approved' | 'male' | 'female';
  show_banner: boolean;
  active: boolean;
  starts_at: string;
  ends_at: string | null;
  email_sent_at: string | null;
  email_recipient_count: number | null;
  created_by_email: string | null;
  created_at: string;
}

const audienceLabels: Record<Announcement['audience'], string> = {
  all: 'All registered users',
  approved: 'Approved members',
  male: 'Approved men',
  female: 'Approved women',
};

const variantBadge: Record<Announcement['variant'], 'info' | 'warning' | 'danger'> = {
  info: 'info',
  warning: 'warning',
  critical: 'danger',
};

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

export function AdminAnnouncements({
  activePage = 'announcements',
  onNavigate,
}: {
  activePage?: string;
  onNavigate?: (page: string) => void;
}) {
  const supabase = useSupabaseClient();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState<Announcement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null);

  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [variant, setVariant] = useState<Announcement['variant']>('info');
  const [audience, setAudience] = useState<Announcement['audience']>('all');
  const [showBanner, setShowBanner] = useState(true);

  const invoke = async (payload: Record<string, unknown>) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) throw new Error('You must be logged in as an admin.');

    const { data, error: fnError } = await supabase.functions.invoke('admin-announcements', {
      body: payload,
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (fnError) throw new Error(await getFunctionErrorMessage(fnError));
    if (!data?.ok) throw new Error(data?.error || 'Announcement request failed.');

    return data;
  };

  const fetchAnnouncements = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await invoke({ action: 'list' });
      setAnnouncements(data.announcements ?? []);
      setTableMissing(Boolean(data.tableMissing));
      if (data.tableMissing) {
        setError('The site_announcements table is missing. Run the pending database migrations.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAnnouncements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    setProcessingId('new');
    setError(null);
    setNotice(null);

    try {
      const data = await invoke({
        action: 'create',
        title: title.trim(),
        body: body.trim(),
        variant,
        audience,
        show_banner: showBanner,
      });
      setAnnouncements(data.announcements ?? []);
      setNotice('Announcement created. It is live as an in-app banner while active.');
      setTitle('');
      setBody('');
      setVariant('info');
      setAudience('all');
      setShowBanner(true);
      setShowComposer(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleActive = async (announcement: Announcement) => {
    setProcessingId(announcement.id);
    setError(null);

    try {
      const data = await invoke({ action: 'set-active', announcement_id: announcement.id });
      setAnnouncements(data.announcements ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (announcement: Announcement) => {
    setProcessingId(announcement.id);
    setError(null);

    try {
      const data = await invoke({ action: 'delete', announcement_id: announcement.id });
      setAnnouncements(data.announcements ?? []);
      setNotice('Announcement deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessingId(null);
      setConfirmDelete(null);
    }
  };

  const handleSendEmail = async (announcement: Announcement) => {
    setProcessingId(announcement.id);
    setError(null);
    setNotice(null);

    try {
      const data = await invoke({ action: 'send-email', announcement_id: announcement.id });
      setAnnouncements(data.announcements ?? []);
      setNotice(
        `Broadcast sent to ${data.sent} recipient${data.sent === 1 ? '' : 's'} via Resend${
          data.failed > 0 ? ` (${data.failed} failed: ${data.errors?.[0] ?? 'unknown error'})` : ''
        }.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessingId(null);
      setConfirmEmail(null);
    }
  };

  return (
    <AdminLayout activePage={activePage} onNavigate={onNavigate}>
      <div className="space-y-6">
        <AdminPageHeader
          title="Announcements"
          description="Publish in-app banners and send email broadcasts to members through Resend."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <AdminButton
                type="button"
                variant="primary"
                onClick={() => setShowComposer((open) => !open)}
                disabled={tableMissing}
              >
                <Plus className="h-4 w-4" />
                New announcement
              </AdminButton>
              <AdminButton type="button" variant="glass" onClick={fetchAnnouncements} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </AdminButton>
            </div>
          }
        />

        {error && <AdminAlert variant="error">{error}</AdminAlert>}
        {notice && <AdminAlert variant="success">{notice}</AdminAlert>}

        {showComposer && (
          <AdminCard
            title="Compose announcement"
            description="Banners appear in the app immediately while the announcement is active. Email is only sent when you choose to broadcast."
          >
            <div className="space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
                Title
                <AdminInput
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Scheduled maintenance this weekend"
                  className="mt-2"
                  disabled={processingId === 'new'}
                />
              </label>

              <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
                Message
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={4}
                  placeholder="What do members need to know?"
                  disabled={processingId === 'new'}
                  className="mt-2 w-full rounded-admin-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none transition-all duration-150 hover:border-white/30 focus:border-white/50 focus:ring-4 focus:ring-white/15 disabled:cursor-not-allowed disabled:bg-white/5"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
                  Severity
                  <AdminSelect value={variant} onChange={(event) => setVariant(event.target.value as Announcement['variant'])} className="mt-2">
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </AdminSelect>
                </label>

                <label className="block text-xs font-semibold uppercase tracking-wide text-white/60">
                  Audience
                  <AdminSelect value={audience} onChange={(event) => setAudience(event.target.value as Announcement['audience'])} className="mt-2">
                    <option value="all">All registered users</option>
                    <option value="approved">Approved members</option>
                    <option value="male">Approved men</option>
                    <option value="female">Approved women</option>
                  </AdminSelect>
                </label>

                <label className="flex items-end gap-2 pb-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={showBanner}
                    onChange={(event) => setShowBanner(event.target.checked)}
                    className="h-4 w-4 rounded border-white/30 bg-white/10"
                  />
                  Show as in-app banner
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <AdminButton type="button" variant="secondary" onClick={() => setShowComposer(false)} disabled={processingId === 'new'}>
                  Cancel
                </AdminButton>
                <AdminButton
                  type="button"
                  variant="primary"
                  onClick={handleCreate}
                  loading={processingId === 'new'}
                  disabled={!title.trim() || !body.trim() || processingId === 'new' || tableMissing}
                >
                  <Megaphone className="h-4 w-4" />
                  Publish announcement
                </AdminButton>
              </div>
            </div>
          </AdminCard>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <AdminSkeleton key={item} className="h-24 w-full rounded-3xl" />
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <AdminCard>
            <AdminEmptyState
              icon={<Megaphone className="h-8 w-8" />}
              title="No announcements yet"
              message="Create an announcement to show an in-app banner or email your members."
            />
          </AdminCard>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <AdminCard key={announcement.id} className={announcement.active ? '' : 'opacity-70'}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminBadge variant={variantBadge[announcement.variant]}>{announcement.variant}</AdminBadge>
                      <AdminBadge variant={announcement.active ? 'success' : 'muted'}>
                        {announcement.active ? 'Active' : 'Inactive'}
                      </AdminBadge>
                      {announcement.show_banner && <AdminBadge variant="neutral">Banner</AdminBadge>}
                      <AdminBadge variant="neutral">{audienceLabels[announcement.audience]}</AdminBadge>
                    </div>

                    <h3 className="mt-3 text-base font-semibold text-white">{announcement.title}</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-white/70">{announcement.body}</p>

                    <p className="mt-3 text-xs text-white/50">
                      Created {formatDateTime(announcement.created_at)}
                      {announcement.created_by_email ? ` by ${announcement.created_by_email}` : ''}
                      {announcement.email_sent_at
                        ? ` · Emailed to ${announcement.email_recipient_count ?? '?'} recipients ${formatDateTime(announcement.email_sent_at)}`
                        : ' · Not emailed yet'}
                    </p>
                  </div>

                  <div className="flex flex-shrink-0 flex-wrap items-center gap-2 lg:flex-col lg:items-stretch">
                    <AdminButton
                      size="sm"
                      variant="secondary"
                      onClick={() => setConfirmEmail(announcement)}
                      disabled={processingId === announcement.id}
                    >
                      <Send className="h-4 w-4" />
                      {announcement.email_sent_at ? 'Send email again' : 'Send email'}
                    </AdminButton>
                    <AdminButton
                      size="sm"
                      variant="secondary"
                      onClick={() => handleToggleActive(announcement)}
                      loading={processingId === announcement.id}
                    >
                      {announcement.active ? 'Deactivate' : 'Activate'}
                    </AdminButton>
                    <AdminButton
                      size="sm"
                      variant="danger"
                      onClick={() => setConfirmDelete(announcement)}
                      disabled={processingId === announcement.id}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </AdminButton>
                  </div>
                </div>
              </AdminCard>
            ))}
          </div>
        )}
      </div>

      {confirmEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">Email this announcement?</h2>
            <p className="mt-2 text-sm text-slate-600">
              “{confirmEmail.title}” will be emailed via Resend to{' '}
              <span className="font-semibold">{audienceLabels[confirmEmail.audience].toLowerCase()}</span>. This cannot be undone.
            </p>
            {confirmEmail.email_sent_at && (
              <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                This announcement was already emailed on {formatDateTime(confirmEmail.email_sent_at)}. Sending again will email everyone another copy.
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <AdminButton type="button" variant="secondary" onClick={() => setConfirmEmail(null)} disabled={Boolean(processingId)}>
                Cancel
              </AdminButton>
              <AdminButton
                type="button"
                variant="primary"
                onClick={() => handleSendEmail(confirmEmail)}
                loading={processingId === confirmEmail.id}
              >
                <Send className="h-4 w-4" />
                Send broadcast
              </AdminButton>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">Delete this announcement?</h2>
            <p className="mt-2 text-sm text-slate-600">
              “{confirmDelete.title}” will be removed and its banner will disappear from the app. Emails that were already sent are unaffected.
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
