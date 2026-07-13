import React from 'react';
import { AlertCircle, CheckCircle, Info, Loader2, XCircle } from 'lucide-react';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const buttonVariants = {
  primary: 'border-admin-brand bg-admin-brand text-white shadow-admin-sm hover:bg-admin-brand-hover focus-visible:ring-admin-brand/25',
  secondary: 'border-white/25 bg-white/90 text-admin-fg shadow-admin-sm hover:bg-white focus-visible:ring-white/40',
  ghost: 'border-transparent bg-transparent text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-white/30',
  danger: 'border-admin-danger bg-admin-danger text-white shadow-admin-sm hover:bg-red-700 focus-visible:ring-admin-danger/25',
  success: 'border-admin-success bg-admin-success text-white shadow-admin-sm hover:bg-emerald-700 focus-visible:ring-admin-success/25',
  subtle: 'border-white/20 bg-white/10 text-white hover:bg-white/20 focus-visible:ring-white/30',
  glass: 'border-white/25 bg-white/10 text-white shadow-none hover:bg-white/20 focus-visible:ring-white/40',
};

const buttonSizes = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-11 px-5 text-sm' };

type AdminButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
  loading?: boolean;
};

export function AdminButton({ className, variant = 'secondary', size = 'md', loading, disabled, children, ...props }: AdminButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-admin-md border font-semibold transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-4 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function AdminIconButton({ className, label, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-admin-md text-white/60 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function AdminCard({ title, description, actions, footer, className, children }: { title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; footer?: React.ReactNode; className?: string; children?: React.ReactNode }) {
  return (
    <section className={cn('admin-glass overflow-hidden rounded-3xl transition-shadow duration-200 ease-out', className)}>
      {(title || description || actions) && (
        <div className="flex flex-col gap-4 border-b border-white/15 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">{title && <h2 className="text-sm font-semibold text-white">{title}</h2>}{description && <p className="mt-1 text-xs text-white/60">{description}</p>}</div>
          {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children && <div className="p-5">{children}</div>}
      {footer && <div className="border-t border-white/15 bg-white/5 px-5 py-3">{footer}</div>}
    </section>
  );
}

const badgeVariants = {
  success: 'border-emerald-300/40 bg-emerald-400/20 text-white',
  warning: 'border-amber-300/40 bg-amber-400/20 text-white',
  danger: 'border-rose-300/40 bg-rose-400/20 text-white',
  info: 'border-brand-purple-light/40 bg-brand-purple/25 text-white',
  neutral: 'border-white/25 bg-white/10 text-white',
  muted: 'border-white/15 bg-white/5 text-white/60',
  brand: 'border-brand-blue-light/40 bg-brand-blue/25 text-white',
};
export function AdminBadge({ variant = 'neutral', className, children }: { variant?: keyof typeof badgeVariants; className?: string; children: React.ReactNode }) { return <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5 transition-colors duration-150', badgeVariants[variant], className)}>{children}</span>; }

// Alias kept for call sites that pre-date the glass unification; identical to AdminBadge now.
export const AdminGlassBadge = AdminBadge;

const control = 'w-full rounded-admin-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white shadow-none outline-none transition-all duration-150 placeholder:text-white/40 hover:border-white/30 focus:border-white/50 focus:ring-4 focus:ring-white/15 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/30';
export const AdminInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => <input ref={ref} className={cn(control, className)} {...props} />);
AdminInput.displayName = 'AdminInput';
export const AdminSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => <select ref={ref} className={cn(control, '[&>option]:text-slate-900', className)} {...props} />);
AdminSelect.displayName = 'AdminSelect';

export function AdminAlert({ variant = 'info', children, className, role }: { variant?: 'info'|'success'|'warning'|'error'; children: React.ReactNode; className?: string; role?: string }) {
  const cfg = {
    info: ['border-brand-purple-light/40 bg-brand-purple/15 text-white', Info],
    success: ['border-emerald-300/40 bg-emerald-400/15 text-white', CheckCircle],
    warning: ['border-amber-300/40 bg-amber-400/15 text-white', AlertCircle],
    error: ['border-rose-300/40 bg-rose-400/15 text-white', XCircle],
  } as const;
  const [styles, Icon] = cfg[variant];
  return <div className={cn('flex items-start gap-3 rounded-2xl border p-4 text-sm backdrop-blur-xl', styles, className)} role={role ?? (variant === 'error' ? 'alert' : 'status')}><Icon className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" /> <div className="text-white/85 [&_p:first-child]:font-semibold [&_p:first-child]:text-white">{children}</div></div>;
}

export function AdminPageHeader({ title, description, actions, meta }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; meta?: React.ReactNode }) { return <div className="admin-glass admin-page-enter flex flex-col gap-4 rounded-3xl p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8"><div className="min-w-0"><h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h1>{description && <p className="mt-1 max-w-3xl text-sm leading-6 text-white/70">{description}</p>}{meta && <div className="mt-2 text-xs text-white/60">{meta}</div>}</div>{actions && <div className="flex flex-col items-start gap-2 sm:items-end">{actions}</div>}</div>; }
export function AdminFilterBar({ className, children }: { className?: string; children: React.ReactNode }) { return <div className={cn('admin-glass rounded-3xl p-4', className)}>{children}</div>; }

const metricAccents = {
  brand: 'bg-brand-blue/25 text-white ring-1 ring-white/20',
  info: 'bg-brand-purple/30 text-white ring-1 ring-white/20',
  success: 'bg-emerald-400/25 text-white ring-1 ring-white/20',
  warning: 'bg-amber-400/25 text-white ring-1 ring-white/20',
  danger: 'bg-rose-400/25 text-white ring-1 ring-white/20',
  muted: 'bg-white/10 text-white/70 ring-1 ring-white/15',
};

export function AdminMetricCard({ title, value, icon, description, loading, accent = 'brand' }: { title: React.ReactNode; value: React.ReactNode; icon?: React.ReactNode; description?: React.ReactNode; loading?: boolean; accent?: keyof typeof metricAccents }) {
  return (
    <AdminCard className="p-0">
      <div className="flex items-start gap-4 p-5">
        {icon && <div className={cn('flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl', metricAccents[accent])}>{icon}</div>}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">{title}</p>
          <p className="mt-0.5 text-2xl font-bold text-white">{loading ? <Loader2 className="inline h-5 w-5 animate-spin text-white/60" /> : value}</p>
          {description && <p className="mt-0.5 text-xs text-white/50">{description}</p>}
        </div>
      </div>
    </AdminCard>
  );
}

export function AdminEmptyState({ icon, title, message, action }: { icon?: React.ReactNode; title: React.ReactNode; message?: React.ReactNode; action?: React.ReactNode }) { return <div className="flex flex-col items-center justify-center px-6 py-14 text-center">{icon && <div className="mb-3 text-white/40">{icon}</div>}<p className="text-sm font-semibold text-white">{title}</p>{message && <p className="mt-1 text-xs text-white/60">{message}</p>}{action && <div className="mt-4">{action}</div>}</div>; }
export function AdminSkeleton({ className, style }: { className?: string; style?: React.CSSProperties }) { return <div className={cn('admin-skeleton-glass rounded-admin-md', className)} style={style} />; }
export function AdminTable({ children, className }: { children: React.ReactNode; className?: string }) { return <div className={cn('admin-glass overflow-hidden rounded-3xl transition-shadow duration-200 ease-out', className)}><div className="overflow-x-auto">{children}</div></div>; }

export type AdminPresenceStatus = 'online_app'|'online_community'|'online_both'|'recently_active'|'offline'|'unknown';
export type AdminPresenceSource = 'app'|'community'|'both'|null;

function relativeTime(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  const diff = Math.max(0, Date.now() - time);
  const mins = Math.max(1, Math.round(diff / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} day ago`;
}

export function AdminPresenceBadge({ status = 'unknown', appLastSeenAt, discourseLastSeenAt, lastActivityAt, checkedAt, error, communityUnavailable = false, compact = false }: { status?: AdminPresenceStatus | null; appLastSeenAt?: string | null; discourseLastSeenAt?: string | null; lastActivityAt?: string | null; source?: AdminPresenceSource; checkedAt?: string | null; error?: string | null; communityUnavailable?: boolean; compact?: boolean }) {
  const cfg: Record<AdminPresenceStatus, { label: string; cls: string; dot: string }> = {
    online_app: { label: 'Online in App', cls: 'border-emerald-300/40 bg-emerald-400/20 text-white', dot: 'bg-emerald-400' },
    online_community: { label: 'Online in Community', cls: 'border-brand-purple-light/40 bg-brand-purple/25 text-white', dot: 'bg-brand-purple-light' },
    online_both: { label: 'Online in App and Community', cls: 'border-emerald-300/40 bg-emerald-400/25 text-white', dot: 'bg-emerald-400' },
    recently_active: { label: 'Recently Active', cls: 'border-amber-300/40 bg-amber-400/20 text-white', dot: 'bg-amber-400' },
    offline: { label: 'Offline', cls: 'border-white/20 bg-white/10 text-white/70', dot: 'bg-white/40' },
    unknown: { label: 'Unknown', cls: 'border-white/15 bg-white/5 text-white/50', dot: 'bg-white/30' },
  };
  const value = status || 'unknown';
  const c = cfg[value] || cfg.unknown;
  const statusHelper = value === 'online_community' ? `Last active in community ${relativeTime(discourseLastSeenAt) ?? ''}`.trim() : value === 'online_app' ? `Active in app · Last seen ${relativeTime(appLastSeenAt) ?? ''}`.trim() : value === 'online_both' ? `Active in app and community · Last active ${relativeTime(lastActivityAt) ?? ''}`.trim() : lastActivityAt ? `Last active ${relativeTime(lastActivityAt)}` : checkedAt ? 'Last activity unknown' : 'Last activity unknown';
  const helper = [statusHelper, communityUnavailable ? 'Community status unavailable' : null, error].filter(Boolean).join(' · ');
  return <span className={cn('inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5', c.cls)} title={helper}><span className={cn('h-2 w-2 flex-shrink-0 rounded-full', c.dot)} /> <span className="truncate">{compact ? c.label.replace('Online in ', '') : c.label}</span>{!compact && <span className="hidden max-w-[12rem] truncate font-normal opacity-70 xl:inline">· {helper}</span>}</span>;
}

export function StatusBadge({ status }: { status?: string | null }) { const normalized=(status||'unknown').toLowerCase(); const variant= normalized.includes('approve')||normalized==='active'||normalized==='success' ? 'success' : normalized.includes('pending')||normalized.includes('sync') ? 'warning' : normalized.includes('reject')||normalized.includes('ban')||normalized.includes('suspend')||normalized.includes('fail') ? 'danger' : normalized==='unknown' ? 'muted' : 'info'; return <AdminBadge variant={variant}>{status || 'Unknown'}</AdminBadge>; }
export function PresenceBadge({ status }: { status?: 'online'|'offline'|'active'|'inactive'|'suspended'|'unknown' }) { const value=status||'unknown'; const variant=value==='online'||value==='active'?'success':value==='suspended'?'danger':value==='unknown'?'muted':'neutral'; return <AdminBadge variant={variant}>{value[0].toUpperCase()+value.slice(1)}</AdminBadge>; }
