import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, Route, ShieldAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useSim } from '../../context/SimulationContext';
import type { Notice } from '../../models/Event';
import { formatTick } from '../../models/Event';
import { SEVERITY_COLOR } from '../../utils/format';

interface Toast {
  key: string;
  expires: number;
  title: string;
  lines: string[];
  severity: Notice['severity'];
  kind: Notice['kind'];
  tick?: number;
}

const ToastContext = createContext<(t: Omit<Toast, 'key' | 'expires'>) => void>(() => undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);

const ICON: Record<Notice['kind'], ReactNode> = {
  'failure-recovery': <ShieldAlert size={18} />,
  replanning: <Route size={18} />,
  info: <Info size={18} />,
  warning: <AlertTriangle size={18} />,
  success: <CheckCircle2 size={18} />,
};

/** Shows engine notices (failure recovery, replanning…) plus local UI confirmations. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { state, version } = useSim();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastSeen = useRef<number>(Math.max(0, ...state.notices.map((n) => n.id)));
  const seq = useRef(0);

  const life = (kind: Notice['kind']) => Date.now() + (kind === 'failure-recovery' ? 7000 : 4500);
  const MAX = 3;

  const push = useCallback((t: Omit<Toast, 'key' | 'expires'>) => {
    const key = `t-${++seq.current}`;
    setToasts((prev) => [...prev, { ...t, key, expires: life(t.kind) }].slice(-MAX));
  }, []);

  useEffect(() => {
    const maxId = Math.max(0, ...state.notices.map((n) => n.id));
    if (maxId < lastSeen.current) {
      // engine was reloaded: notice ids restarted, old toasts belong to the previous run
      lastSeen.current = 0;
      setToasts([]);
    }
    const fresh = state.notices.filter((n) => n.id > lastSeen.current);
    if (fresh.length) {
      lastSeen.current = maxId;
      setToasts((prev) => [...prev, ...fresh.map((n) => ({ ...n, key: `t-${++seq.current}`, expires: life(n.kind) }))].slice(-MAX));
    }
  }, [version, state.notices]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const id = setInterval(() => {
      const now = Date.now();
      setToasts((prev) => (prev.some((t) => t.expires <= now) ? prev.filter((t) => t.expires > now) : prev));
    }, 400);
    return () => clearInterval(id);
  }, [toasts.length]);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const color = SEVERITY_COLOR[t.severity];
            return (
              <motion.div
                key={t.key}
                layout
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                className="pointer-events-auto rounded-xl border bg-hull-900/95 p-3.5 shadow-2xl backdrop-blur"
                style={{ borderColor: `${color}55` }}
              >
                <div className="flex items-start gap-3">
                  <span style={{ color }} className="mt-0.5">
                    {ICON[t.kind]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-semibold text-ink-100">
                      {t.title}
                      {t.tick !== undefined && <span className="ml-2 font-mono text-[11px] font-normal text-ink-400">{formatTick(t.tick)}</span>}
                    </p>
                    {t.lines.map((l, i) => (
                      <p key={i} className="mt-0.5 text-xs text-ink-300">
                        {l}
                      </p>
                    ))}
                  </div>
                  <button
                    aria-label="Dismiss notification"
                    className="text-ink-400 hover:text-ink-100"
                    onClick={() => setToasts((prev) => prev.filter((x) => x.key !== t.key))}
                  >
                    <X size={15} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
