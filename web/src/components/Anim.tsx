import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react';
import { useReducedMotion } from 'motion/react';

// Lottie player (SVG renderer only), loaded on demand so the first paint doesn't wait for lottie-web.
const Lottie = lazy(() => import('lottie-react').then((m) => ({ default: m.LottieSvg })));

export type AnimName = 'thoranam' | 'lamp' | 'celebrate' | 'kolam' | 'petals-drift';

const files = import.meta.glob<{ default: object }>('../assets/lottie/*.json');
const cache = new Map<AnimName, object>();

interface Props {
  name: AnimName;
  loop?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Frame shown instead of playing when the visitor prefers reduced motion. */
  stillFrame?: number;
  label?: string;
  onComplete?: () => void;
  /** 'cover-top' fills the box and crops the bottom (for the thoranam strip). */
  fit?: 'contain' | 'cover-top';
}

export function Anim({ name, loop = true, className, style, stillFrame = 0, label, onComplete, fit = 'contain' }: Props) {
  const reduce = useReducedMotion();
  const [data, setData] = useState<object | null>(cache.get(name) ?? null);

  useEffect(() => {
    let alive = true;
    if (!cache.has(name)) {
      files[`../assets/lottie/${name}.json`]?.().then((m) => {
        cache.set(name, m.default);
        if (alive) setData(m.default);
      });
    }
    return () => {
      alive = false;
    };
  }, [name]);

  useEffect(() => {
    // Reduced motion shows a still frame and never "completes", so report completion ourselves.
    if (!reduce || !onComplete) return;
    const t = setTimeout(onComplete, 1200);
    return () => clearTimeout(t);
  }, [reduce, onComplete]);

  const box = <div className={className} style={style} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
  if (!data) return box;
  return (
    <Suspense fallback={box}>
      <div className={className} style={style} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
        <Lottie
          src={data}
          loop={reduce ? false : loop}
          autoplay={!reduce}
          segment={reduce ? [stillFrame, stillFrame + 1] : undefined}
          subscriptions={onComplete ? { complete: onComplete } : undefined}
          rendererSettings={{ preserveAspectRatio: fit === 'cover-top' ? 'xMidYMin slice' : 'xMidYMid meet' }}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </Suspense>
  );
}
