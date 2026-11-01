import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { animate, AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { Anim } from './Anim';
import type { BookingStatus } from '../api/types';
import { STATUS_NAMES } from '../utils/format';

// ───────── toasts ─────────
type Toast = { id: number; text: string; tone: 'info' | 'error' };
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className={`toast ${t.tone === 'error' ? 'error' : ''}`}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

// ───────── modal ─────────
export function Modal({ open, onClose, title, children, labelledBy }: { open: boolean; onClose: () => void; title: string; children: ReactNode; labelledBy?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    setTimeout(() => ref.current?.querySelector<HTMLElement>('button, input, select, textarea')?.focus(), 30);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  const titleId = labelledBy ?? 'modal-title';
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div
            ref={ref}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <h2 id={titleId}>{title}</h2>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ───────── loading & empty ─────────
export function Loading({ text = 'Loading…' }: { text?: string }) {
  return (
    <div className="loading">
      <Anim name="kolam" style={{ width: 56, height: 56 }} stillFrame={45} />
      <span>{text}</span>
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <motion.div className="empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Anim name="lamp" style={{ width: 90, height: 126, margin: '0 auto 8px' }} stillFrame={20} />
      <h2>{title}</h2>
      {children && <div className="muted">{children}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </motion.div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <motion.p className="form-error" role="alert" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }} transition={{ duration: 0.35 }}>
      {message}
    </motion.p>
  );
}

export const StatusPill = ({ status }: { status: BookingStatus }) => <span className={`pill ${status}`}>{STATUS_NAMES[status]}</span>;

// ───────── numbers that count up when they scroll into view ─────────
export function CountUp({ value, format = (n: number) => Math.round(n).toLocaleString('en-IN') }: { value: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce || !inView) {
      el.textContent = format(reduce ? value : 0);
      return;
    }
    const c = animate(0, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => (el.textContent = format(v)) });
    return () => c.stop();
  }, [value, inView, reduce, format]);
  return <span ref={ref}>{format(value)}</span>;
}

// ───────── scroll reveal ─────────
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Container + item variants for staggered lists. */
export const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.07 } } },
  item: { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } } },
};
