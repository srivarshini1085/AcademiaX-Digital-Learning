import { useEffect, useRef } from 'react';
import { AlertTriangle, Inbox, X } from 'lucide-react';
import { STATUS_LABEL } from '../lib/format';
import { errorMessage } from '../lib/api';

export function PageHeader({ eyebrow, title, children, actions }) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-ink/80 pb-5 sm:flex-row sm:items-end sm:justify-between animate-fade">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-3xl font-medium leading-tight sm:text-4xl">{title}</h1>
        {children && <p className="mt-2 max-w-2xl text-sm text-ink-soft">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

const STATUS_TONE = {
  SEAT_HELD: 'text-warn border-warn/50',
  WAITLISTED: 'text-ink-soft border-ink-soft/50',
  CONFIRMED: 'text-good border-good/50',
  SUCCESS: 'text-good border-good/50',
  PAYMENT_FAILED: 'text-bad border-bad/50',
  FAILED: 'text-bad border-bad/50',
  EXPIRED: 'text-ink-muted border-rule',
  CANCELLED: 'text-ink-muted border-rule',
  REFUNDED: 'text-ink-muted border-rule',
};

export function StatusPill({ status }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-card border px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ${STATUS_TONE[status] || 'text-ink-muted border-rule'}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function SkeletonCards({ count = 6 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card space-y-3 p-5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <Inbox className="mb-3 text-ink-muted" size={22} strokeWidth={1.5} />
      <p className="font-display text-lg">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-soft">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div role="alert" className="card flex flex-col items-start gap-3 border-bad/40 p-5 sm:flex-row sm:items-center">
      <AlertTriangle className="shrink-0 text-bad" size={20} />
      <div className="flex-1 text-sm">
        <p className="font-medium">Could not load this section.</p>
        <p className="text-ink-soft">{errorMessage(error)}</p>
      </div>
      {onRetry && <button className="btn-secondary btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Stat({ label, value, note }) {
  return (
    <div className="border-l-2 border-accent/70 pl-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-display text-3xl tabular-nums">{value}</p>
      {note && <p className="mt-0.5 text-xs text-ink-muted">{note}</p>}
    </div>
  );
}

export function Pagination({ page, totalPages, onChange }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <nav className="mt-6 flex items-center justify-between font-mono text-xs" aria-label="Pagination">
      <button className="btn-quiet btn-sm" disabled={page === 0} onClick={() => onChange(page - 1)}>← Previous</button>
      <span className="text-ink-muted">Page {page + 1} of {totalPages}</span>
      <button className="btn-quiet btn-sm" disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)}>Next →</button>
    </nav>
  );
}

export function Field({ label, error, id, children, hint }) {
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
    </div>
  );
}

export function Modal({ open, title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector('input, select, textarea, button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title}
        className="card max-h-[92vh] w-full max-w-lg overflow-y-auto p-6 shadow-xl animate-fade" onMouseDown={e => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-xl">{title}</h2>
          <button className="btn-quiet btn-sm" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
