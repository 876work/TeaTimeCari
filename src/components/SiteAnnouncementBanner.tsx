import React from 'react';
import { AlertTriangle, Info, Megaphone, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

type BannerAnnouncement = {
  id: string;
  title: string;
  body: string;
  variant: 'info' | 'warning' | 'critical';
};

const DISMISSED_KEY = 'ttc-dismissed-announcements';

function getDismissed(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function dismiss(id: string) {
  try {
    const next = [...new Set([...getDismissed(), id])];
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  } catch {
    // Session storage unavailable; the banner simply reappears next load.
  }
}

const variantStyles: Record<BannerAnnouncement['variant'], { container: string; icon: React.ReactNode }> = {
  info: {
    container: 'border-sky-200 bg-sky-50 text-sky-900',
    icon: <Info className="h-4 w-4 flex-shrink-0 text-sky-600" aria-hidden="true" />,
  },
  warning: {
    container: 'border-amber-200 bg-amber-50 text-amber-900',
    icon: <Megaphone className="h-4 w-4 flex-shrink-0 text-amber-600" aria-hidden="true" />,
  },
  critical: {
    container: 'border-rose-200 bg-rose-50 text-rose-900',
    icon: <AlertTriangle className="h-4 w-4 flex-shrink-0 text-rose-600" aria-hidden="true" />,
  },
};

export function SiteAnnouncementBanner() {
  const [announcements, setAnnouncements] = React.useState<BannerAnnouncement[]>([]);
  const [dismissedIds, setDismissedIds] = React.useState<string[]>(getDismissed);

  React.useEffect(() => {
    let cancelled = false;

    const loadAnnouncements = async () => {
      try {
        const { data, error } = await supabase
          .from('site_announcements')
          .select('id, title, body, variant')
          .eq('active', true)
          .eq('show_banner', true)
          .order('created_at', { ascending: false })
          .limit(3);

        if (!cancelled && !error && Array.isArray(data)) {
          setAnnouncements(data as BannerAnnouncement[]);
        }
      } catch {
        // Banner is best-effort; never block the app on it.
      }
    };

    void loadAnnouncements();

    return () => {
      cancelled = true;
    };
  }, []);

  const visible = announcements.filter((announcement) => !dismissedIds.includes(announcement.id));

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 px-4 pt-4">
      {visible.map((announcement) => {
        const styles = variantStyles[announcement.variant] ?? variantStyles.info;

        return (
          <div
            key={announcement.id}
            role="status"
            className={`mx-auto flex max-w-4xl items-start gap-3 rounded-2xl border p-3 shadow-sm ${styles.container}`}
          >
            <span className="mt-0.5">{styles.icon}</span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">{announcement.title}</p>
              <p className="mt-0.5 whitespace-pre-wrap opacity-90">{announcement.body}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                dismiss(announcement.id);
                setDismissedIds(getDismissed());
              }}
              className="rounded-full p-1 opacity-60 transition hover:bg-black/5 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
              aria-label={`Dismiss announcement: ${announcement.title}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
