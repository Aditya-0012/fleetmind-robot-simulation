import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useId } from 'react';
import type { ReactNode } from 'react';

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = '',
  bodyClass = 'p-4',
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={`panel flex flex-col ${className}`}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-hull-700/70 px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClass}`}>{children}</div>
    </section>
  );
}

export function Badge({ color, children, title }: { color: string; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium"
      style={{ color, backgroundColor: `${color}1A`, boxShadow: `inset 0 0 0 1px ${color}40` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {children}
    </span>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  size = 'md',
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-lg border border-hull-600 bg-hull-950/70 p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`rounded-md font-medium transition-colors ${size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${
              active ? 'bg-hull-700 text-signal-cyan' : 'text-ink-300 hover:text-ink-100'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}) {
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-hull-950/75 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={id}
            className={`panel w-full ${width} bg-hull-900 shadow-2xl`}
            initial={{ y: 12, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <header className="flex items-center justify-between border-b border-hull-700 px-5 py-3.5">
              <h2 id={id} className="text-base font-semibold">
                {title}
              </h2>
              <button className="rounded p-1 text-ink-400 hover:text-ink-100" onClick={onClose} aria-label="Close dialog">
                <X size={18} />
              </button>
            </header>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} width="max-w-md">
      <div className="text-sm text-ink-200">{message}</div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          className={danger ? 'btn-danger' : 'btn-primary'}
          onClick={() => {
            onConfirm();
            onCancel();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="text-ink-400">{icon}</div>
      <p className="font-display text-sm font-semibold text-ink-200">{title}</p>
      {children && <div className="max-w-sm text-xs text-ink-400">{children}</div>}
    </div>
  );
}

/** Small hover tooltip (CSS only, keyboard-accessible through focus-within). */
export function Tip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 w-max max-w-[240px] -translate-x-1/2 rounded-md border border-hull-600 bg-hull-850 px-2 py-1 text-[11px] leading-snug text-ink-200 opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

/** Horizontal stacked bar showing how a population splits across states. */
export function StackBar({ parts, total }: { parts: { label: string; value: number; color: string }[]; total: number }) {
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-hull-800" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')}>
        {parts.map((p) =>
          p.value > 0 ? (
            <div key={p.label} style={{ width: `${(p.value / Math.max(total, 1)) * 100}%`, backgroundColor: p.color }} className="transition-all duration-500" />
          ) : null,
        )}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 sm:grid-cols-6">
        {parts.map((p) => (
          <div key={p.label}>
            <dt className="flex items-center gap-1.5 text-[11px] text-ink-400">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: p.color }} />
              {p.label}
            </dt>
            <dd className="num text-lg font-semibold">{p.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-ink-200">
      {label}
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-signal-cyan' : 'bg-hull-600'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-hull-950 transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}
