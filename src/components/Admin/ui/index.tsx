import React from 'react';
import { AlertCircle, CheckCircle, Info, Loader2, XCircle } from 'lucide-react';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const buttonVariants = {
  primary: 'border-admin-brand bg-admin-brand text-white shadow-admin-sm hover:bg-admin-brand-hover focus-visible:ring-admin-brand/25',
  secondary: 'border-admin-border bg-white text-admin-fg shadow-admin-sm hover:bg-admin-muted focus-visible:ring-admin-brand/20',
  ghost: 'border-transparent bg-transparent text-admin-muted-fg hover:bg-admin-muted hover:text-admin-fg focus-visible:ring-admin-brand/20',
  danger: 'border-admin-danger bg-admin-danger text-white shadow-admin-sm hover:bg-red-700 focus-visible:ring-admin-danger/25',
  success: 'border-admin-success bg-admin-success text-white shadow-admin-sm hover:bg-emerald-700 focus-visible:ring-admin-success/25',
  subtle: 'border-admin-border bg-admin-muted text-admin-fg hover:bg-slate-200/70 focus-visible:ring-admin-brand/20',
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

export function AdminCard({ title, description, actions, footer, className, children }: { title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; footer?: React.ReactNode; className?: string; children?: React.ReactNode }) {
  return (
    <section className={cn('overflow-hidden rounded-admin-xl border border-admin-border/80 bg-admin-surface shadow-admin-sm shadow-slate-200/50 transition-shadow duration-200 ease-out', className)}>
      {(title || description || actions) && (
        <div className="flex flex-col gap-4 border-b border-admin-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">{title && <h2 className="text-sm font-semibold text-admin-fg">{title}</h2>}{description && <p className="mt-1 text-xs text-admin-muted-fg">{description}</p>}</div>
          {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children && <div className="p-5">{children}</div>}
      {footer && <div className="border-t border-admin-border bg-admin-muted px-5 py-3">{footer}</div>}
    </section>
  );
}

const badgeVariants = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700', warning: 'border-amber-200 bg-amber-50 text-amber-700', danger: 'border-red-200 bg-red-50 text-red-700', info: 'border-sky-200 bg-sky-50 text-sky-700', neutral: 'border-slate-200 bg-white text-slate-700', muted: 'border-slate-200 bg-slate-50 text-slate-500', brand: 'border-blue-200 bg-blue-50 text-blue-700',
};
export function AdminBadge({ variant = 'neutral', className, children }: { variant?: keyof typeof badgeVariants; className?: string; children: React.ReactNode }) { return <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5 transition-colors duration-150', badgeVariants[variant], className)}>{children}</span>; }

const control = 'w-full rounded-admin-md border border-admin-border bg-white px-3 py-2 text-sm text-admin-fg shadow-admin-sm outline-none transition-all duration-150 placeholder:text-slate-400 hover:border-slate-300 focus:border-admin-brand focus:ring-4 focus:ring-admin-brand/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';
export const AdminInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => <input ref={ref} className={cn(control, className)} {...props} />);
AdminInput.displayName = 'AdminInput';
export const AdminSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => <select ref={ref} className={cn(control, className)} {...props} />);
AdminSelect.displayName = 'AdminSelect';

export function AdminAlert({ variant = 'info', children, className, role }: { variant?: 'info'|'success'|'warning'|'error'; children: React.ReactNode; className?: string; role?: string }) {
  const cfg = { info: ['border-sky-200 bg-sky-50 text-sky-800', Info], success: ['border-emerald-200 bg-emerald-50 text-emerald-800', CheckCircle], warning: ['border-amber-200 bg-amber-50 text-amber-800', AlertCircle], error: ['border-red-200 bg-red-50 text-red-800', XCircle] } as const;
  const [styles, Icon] = cfg[variant];
  return <div className={cn('flex items-start gap-3 rounded-admin-lg border p-4 text-sm shadow-admin-sm', styles, className)} role={role ?? (variant === 'error' ? 'alert' : 'status')}><Icon className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" /> <div>{children}</div></div>;
}

export function AdminPageHeader({ title, description, actions, meta }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; meta?: React.ReactNode }) { return <div className="admin-page-enter flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-xl font-bold tracking-tight text-admin-fg sm:text-2xl">{title}</h1>{description && <p className="mt-1 max-w-3xl text-sm leading-6 text-admin-muted-fg">{description}</p>}{meta && <div className="mt-2 text-xs text-admin-muted-fg">{meta}</div>}</div>{actions && <div className="flex flex-col items-start gap-2 sm:items-end">{actions}</div>}</div>; }
export function AdminFilterBar({ className, children }: { className?: string; children: React.ReactNode }) { return <div className={cn('rounded-admin-xl border border-admin-border/80 bg-admin-surface p-4 shadow-admin-sm shadow-slate-200/50', className)}>{children}</div>; }
export function AdminMetricCard({ title, value, icon, description, loading, accent = 'brand' }: { title: React.ReactNode; value: React.ReactNode; icon?: React.ReactNode; description?: React.ReactNode; loading?: boolean; accent?: 'brand'|'success'|'warning'|'danger'|'muted'|'info' }) { const accents={brand:'bg-blue-50 text-blue-600',success:'bg-emerald-50 text-emerald-600',warning:'bg-amber-50 text-amber-600',danger:'bg-red-50 text-red-600',muted:'bg-slate-100 text-slate-500',info:'bg-sky-50 text-sky-600'}; return <AdminCard className="p-0"><div className="flex items-start gap-4 p-5">{icon && <div className={cn('flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-admin-lg', accents[accent])}>{icon}</div>}<div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-admin-muted-fg">{title}</p><p className="mt-0.5 text-2xl font-bold text-admin-fg">{loading ? <Loader2 className="inline h-5 w-5 animate-spin text-slate-400" /> : value}</p>{description && <p className="mt-0.5 text-xs text-admin-muted-fg">{description}</p>}</div></div></AdminCard>; }
export function AdminEmptyState({ icon, title, message, action }: { icon?: React.ReactNode; title: React.ReactNode; message?: React.ReactNode; action?: React.ReactNode }) { return <div className="flex flex-col items-center justify-center px-6 py-14 text-center">{icon && <div className="mb-3 text-slate-400">{icon}</div>}<p className="text-sm font-semibold text-admin-fg">{title}</p>{message && <p className="mt-1 text-xs text-admin-muted-fg">{message}</p>}{action && <div className="mt-4">{action}</div>}</div>; }
export function AdminSkeleton({ className }: { className?: string }) { return <div className={cn('admin-skeleton rounded-admin-md', className)} />; }
export function AdminTable({ children, className }: { children: React.ReactNode; className?: string }) { return <div className={cn('overflow-hidden rounded-admin-xl border border-admin-border/80 bg-admin-surface shadow-admin-sm shadow-slate-200/50 transition-shadow duration-200 ease-out', className)}><div className="overflow-x-auto">{children}</div></div>; }

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

export function AdminPresenceBadge({ status = 'unknown', appLastSeenAt, discourseLastSeenAt, lastActivityAt, checkedAt, error, compact = false }: { status?: AdminPresenceStatus | null; appLastSeenAt?: string | null; discourseLastSeenAt?: string | null; lastActivityAt?: string | null; source?: AdminPresenceSource; checkedAt?: string | null; error?: string | null; compact?: boolean }) {
  const cfg: Record<AdminPresenceStatus, { label: string; cls: string; dot: string }> = {
    online_app: { label: 'Online in App', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
    online_community: { label: 'Online in Community', cls: 'border-indigo-200 bg-indigo-50 text-indigo-700', dot: 'bg-indigo-500' },
    online_both: { label: 'Online in App and Community', cls: 'border-green-200 bg-green-50 text-green-700', dot: 'bg-green-500' },
    recently_active: { label: 'Recently Active', cls: 'border-amber-200 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
    offline: { label: 'Offline', cls: 'border-slate-200 bg-slate-50 text-slate-600', dot: 'bg-slate-400' },
    unknown: { label: 'Unknown', cls: 'border-gray-200 bg-gray-50 text-gray-600', dot: 'bg-gray-400' },
  };
  const value = status || 'unknown';
  const c = cfg[value] || cfg.unknown;
  const helper = error || (value === 'online_community' ? `Last active in community ${relativeTime(discourseLastSeenAt) ?? ''}`.trim() : value === 'online_app' ? `Last seen ${relativeTime(appLastSeenAt) ?? ''}`.trim() : lastActivityAt ? `Last active ${relativeTime(lastActivityAt)}` : checkedAt ? 'Last activity unknown' : 'Last activity unknown');
  return <span className={cn('inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5', error ? 'border-red-200 bg-red-50 text-red-700' : c.cls)} title={helper}><span className={cn('h-2 w-2 flex-shrink-0 rounded-full', error ? 'bg-red-500' : c.dot)} /> <span className="truncate">{compact ? c.label.replace('Online in ', '') : c.label}</span>{!compact && <span className="hidden max-w-[12rem] truncate font-normal opacity-80 xl:inline">· {helper}</span>}</span>;
}

export function StatusBadge({ status }: { status?: string | null }) { const normalized=(status||'unknown').toLowerCase(); const variant= normalized.includes('approve')||normalized==='active'||normalized==='success' ? 'success' : normalized.includes('pending')||normalized.includes('sync') ? 'warning' : normalized.includes('reject')||normalized.includes('ban')||normalized.includes('suspend')||normalized.includes('fail') ? 'danger' : normalized==='unknown' ? 'muted' : 'info'; return <AdminBadge variant={variant}>{status || 'Unknown'}</AdminBadge>; }
export function PresenceBadge({ status }: { status?: 'online'|'offline'|'active'|'inactive'|'suspended'|'unknown' }) { const value=status||'unknown'; const variant=value==='online'||value==='active'?'success':value==='suspended'?'danger':value==='unknown'?'muted':'neutral'; return <AdminBadge variant={variant}>{value[0].toUpperCase()+value.slice(1)}</AdminBadge>; }
