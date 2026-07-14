import React from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import {
  Activity,
  BarChart3,
  Bell,
  CreditCard,
  FileText,
  Flag,
  Loader2,
  Mail,
  Megaphone,
  MessageSquare,
  Search,
  Shield,
  ToggleLeft,
  User,
  Users,
} from 'lucide-react';

export const ADMIN_USER_SEARCH_KEY = 'ttc-admin-user-search';

type PaletteUser = {
  id: string;
  email?: string | null;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  status?: string | null;
};

type PaletteDestination = {
  id: string;
  label: string;
  description: string;
  keywords: string;
  icon: React.ReactNode;
};

const destinations: PaletteDestination[] = [
  { id: 'dashboard', label: 'Overview', description: 'Dashboard summary', keywords: 'home overview stats dashboard', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'user-reviews', label: 'Users', description: 'Review registrations and accounts', keywords: 'users members registrations approve kyc', icon: <Users className="h-4 w-4" /> },
  { id: 'flagged-posts', label: 'Moderation', description: 'Flagged posts and NSFW screening', keywords: 'moderation flags posts nsfw reports', icon: <Flag className="h-4 w-4" /> },
  { id: 'payments', label: 'Payments', description: 'Revenue and payment history', keywords: 'payments revenue stripe money billing', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'invites', label: 'Invites', description: 'Email invites and invite codes', keywords: 'invites codes email onboarding', icon: <Mail className="h-4 w-4" /> },
  { id: 'announcements', label: 'Announcements', description: 'Banners and email broadcasts', keywords: 'announcements broadcast banner email news', icon: <Megaphone className="h-4 w-4" /> },
  { id: 'discourse-admins', label: 'Community', description: 'Discourse admins', keywords: 'discourse community forum admins', icon: <MessageSquare className="h-4 w-4" /> },
  { id: 'roles', label: 'Roles', description: 'Admin roles and permissions', keywords: 'roles permissions owner admin moderator team', icon: <Shield className="h-4 w-4" /> },
  { id: 'flags', label: 'Feature flags', description: 'Kill switches', keywords: 'feature flags kill switch toggles', icon: <ToggleLeft className="h-4 w-4" /> },
  { id: 'alerts', label: 'Alerts', description: 'Slack alerting', keywords: 'alerts slack webhook notifications', icon: <Bell className="h-4 w-4" /> },
  { id: 'logs', label: 'Audit logs', description: 'Admin activity trail', keywords: 'logs audit history activity', icon: <FileText className="h-4 w-4" /> },
  { id: 'function-ping', label: 'System health', description: 'Service checks', keywords: 'health status ping uptime system', icon: <Activity className="h-4 w-4" /> },
];

function displayName(user: PaletteUser) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return full || user.username || user.email || 'Unknown user';
}

export function AdminCommandPalette({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate?: (page: string) => void;
}) {
  const supabase = useSupabaseClient();
  const [query, setQuery] = React.useState('');
  const [users, setUsers] = React.useState<PaletteUser[]>([]);
  const [usersLoaded, setUsersLoaded] = React.useState(false);
  const [usersLoading, setUsersLoading] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 20);
  }, [open]);

  React.useEffect(() => {
    if (!open || usersLoaded || usersLoading) return;

    let cancelled = false;

    const loadUsers = async () => {
      setUsersLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const { data } = await supabase.functions.invoke('get-admin-users', {
          body: { limit: 500, offset: 0 },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!cancelled && data?.ok && Array.isArray(data.users)) {
          setUsers(data.users);
          setUsersLoaded(true);
        }
      } catch {
        // Palette user search is best-effort; navigation still works.
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    };

    void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [open, usersLoaded, usersLoading, supabase]);

  const needle = query.trim().toLowerCase();

  const pageResults = destinations.filter(
    (destination) =>
      !needle ||
      destination.label.toLowerCase().includes(needle) ||
      destination.keywords.includes(needle),
  );

  const userResults = needle.length >= 2
    ? users
        .filter((user) =>
          [user.email, user.username, user.firstName, user.lastName]
            .some((value) => (value ?? '').toLowerCase().includes(needle)),
        )
        .slice(0, 8)
    : [];

  type PaletteItem =
    | { kind: 'page'; page: PaletteDestination }
    | { kind: 'user'; user: PaletteUser };

  const items: PaletteItem[] = [
    ...pageResults.map((page) => ({ kind: 'page' as const, page })),
    ...userResults.map((user) => ({ kind: 'user' as const, user })),
  ];

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const selectItem = React.useCallback(
    (item: PaletteItem) => {
      if (item.kind === 'page') {
        onNavigate?.(item.page.id);
      } else {
        try {
          sessionStorage.setItem(
            ADMIN_USER_SEARCH_KEY,
            item.user.email || item.user.username || displayName(item.user),
          );
        } catch {
          // Session storage unavailable; still navigate.
        }
        onNavigate?.('user-reviews');
      }
      onClose();
    },
    [onNavigate, onClose],
  );

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, items.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === 'Enter' && items[activeIndex]) {
      event.preventDefault();
      selectItem(items[activeIndex]);
    }
  };

  React.useEffect(() => {
    const active = listRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  let flatIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-950/60 px-4 pt-[12vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Admin command palette"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="admin-glass w-full max-w-xl overflow-hidden rounded-3xl shadow-2xl" onKeyDown={handleKeyDown}>
        <div className="flex items-center gap-3 border-b border-white/15 px-4 py-3">
          <Search className="h-4 w-4 flex-shrink-0 text-white/50" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages, or type a name, email, or username…"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40"
            aria-label="Search admin"
          />
          {usersLoading && <Loader2 className="h-4 w-4 animate-spin text-white/40" />}
          <kbd className="hidden rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/50 sm:block">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-white/50">
              No matches. Try a page name, email, or username.
            </p>
          )}

          {pageResults.length > 0 && (
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">Go to</p>
          )}
          {pageResults.map((page) => {
            flatIndex += 1;
            const index = flatIndex;
            return (
              <button
                key={page.id}
                type="button"
                data-active={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectItem({ kind: 'page', page })}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  index === activeIndex ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'
                }`}
              >
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/70">
                  {page.icon}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{page.label}</span>
                  <span className="block truncate text-xs text-white/50">{page.description}</span>
                </span>
              </button>
            );
          })}

          {userResults.length > 0 && (
            <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-white/40">Users</p>
          )}
          {userResults.map((user) => {
            flatIndex += 1;
            const index = flatIndex;
            return (
              <button
                key={user.id}
                type="button"
                data-active={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectItem({ kind: 'user', user })}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  index === activeIndex ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'
                }`}
              >
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/70">
                  <User className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{displayName(user)}</span>
                  <span className="block truncate text-xs text-white/50">
                    {user.email ?? '—'}{user.username ? ` · @${user.username}` : ''}
                  </span>
                </span>
                {user.status && (
                  <span className="flex-shrink-0 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/60">
                    {user.status}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-white/15 px-4 py-2 text-[11px] text-white/40">
          <span>↑↓ to navigate · Enter to open</span>
          <span>{usersLoaded ? `${users.length} users indexed` : 'Type 2+ characters to search users'}</span>
        </div>
      </div>
    </div>
  );
}
