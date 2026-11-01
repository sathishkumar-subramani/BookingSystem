import { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/**
 * The Kanjivaram "korvai" border — a band of zari temple-tower triangles between two gold lines.
 * It's the one ornament in the UI: under the hero, and at the top of a booking ticket.
 */
export function SilkBorder({ thin = false, ground = 'var(--brand)', reveal = false }: { thin?: boolean; ground?: string; reveal?: boolean }) {
  const id = useId().replace(/:/g, '');
  const reduce = useReducedMotion();
  const h = thin ? 14 : 26;
  const svg = (
    <svg className={thin ? 'silk thin' : 'silk'} viewBox={`0 0 120 ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id={`k${id}`} width={thin ? 12 : 20} height={h} patternUnits="userSpaceOnUse">
          {thin ? (
            <path d="M0 11 L6 3 L12 11 Z" fill="currentColor" />
          ) : (
            <>
              <path d="M0 20 L10 6 L20 20 Z" fill="currentColor" />
              <path d="M5 20 L10 12 L15 20 Z" fill={ground} />
              <circle cx="10" cy="3" r="1.4" fill="currentColor" />
            </>
          )}
        </pattern>
      </defs>
      <rect width="120" height={h} fill={ground} />
      <rect width="120" height={h} fill={`url(#k${id})`} />
      <rect y={thin ? 12 : 22} width="120" height="1.6" fill="currentColor" />
      {!thin && <rect y="0.6" width="120" height="1" fill="currentColor" opacity="0.7" />}
    </svg>
  );
  if (!reveal || reduce) return svg;
  // On first load the border weaves itself in from the centre outward.
  return (
    <motion.div initial={{ clipPath: 'inset(0 50% 0 50%)' }} animate={{ clipPath: 'inset(0 0% 0 0%)' }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}>
      {svg}
    </motion.div>
  );
}
