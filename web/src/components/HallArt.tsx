import { useId } from 'react';

// Until owners can upload photos, every hall gets an illustrated facade: a mandapam with a stepped
// gopuram roof, banana trees at the door, a mango-leaf thoranam and a kolam on the ground.
// coverStyle (0–7) picks the time of day / colours, so halls look different from each other.

const PALETTES = [
  { sky: ['#FBD3A5', '#F6EAD7'], sun: '#FFF1D6', wall: '#F5E9DA', wing: '#EADBC8', trim: '#C8962E', door: '#6E1423', ground: '#E6D3B3' },
  { sky: ['#9ED6D0', '#E3F1EE'], sun: '#FFFFFF', wall: '#FFF7EC', wing: '#F0E4D2', trim: '#0B5D5E', door: '#0B5D5E', ground: '#D8CBB1' },
  { sky: ['#C9A3D6', '#F7DDE0'], sun: '#FFE9EF', wall: '#FBEFEA', wing: '#EDD7D2', trim: '#C8962E', door: '#5B1A44', ground: '#E2C9C1' },
  { sky: ['#FFC86B', '#FFE9C0'], sun: '#FFF6DA', wall: '#FFF5E6', wing: '#F6E1BF', trim: '#B5651D', door: '#8E2433', ground: '#EAD2A8' },
  { sky: ['#F4B6C2', '#FCE6E9'], sun: '#FFF4F6', wall: '#FFF8F3', wing: '#F3DFD8', trim: '#C2185B', door: '#6E1423', ground: '#E8D0C8' },
  { sky: ['#BDE3C3', '#EDF7EE'], sun: '#FFFFFF', wall: '#FFFBF2', wing: '#EFE6D3', trim: '#2E7D32', door: '#1F4E3D', ground: '#D9CFB4' },
  { sky: ['#1F2A4A', '#5A3F6E'], sun: '#F6E7B8', wall: '#F2E4D0', wing: '#DCCBB2', trim: '#E2B85A', door: '#3A0C15', ground: '#3B3346' },
  { sky: ['#E8E2D6', '#F8F5EE'], sun: '#FFFFFF', wall: '#FFFFFF', wing: '#EEE7DA', trim: '#6E1423', door: '#6E1423', ground: '#DED3BF' },
];

function BananaTree({ x, flip = false }: { x: number; flip?: boolean }) {
  const s = flip ? -1 : 1;
  return (
    <g transform={`translate(${x} 150) scale(${s} 1)`}>
      <path d="M0 0 C1 -14 0 -30 -1 -44" stroke="#5E8C31" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M-1 -44 C8 -56 22 -54 28 -46 C18 -48 8 -46 -1 -40Z" fill="#4C8A2E" />
      <path d="M-1 -44 C-10 -58 -22 -56 -28 -48 C-18 -49 -9 -47 -1 -40Z" fill="#3E7D2E" />
      <path d="M-1 -42 C3 -60 10 -66 16 -66 C10 -60 4 -52 0 -40Z" fill="#6FA84A" />
      <path d="M-1 -30 C10 -34 18 -30 22 -24 C14 -27 6 -27 -1 -26Z" fill="#3E7D2E" />
      <ellipse cx="4" cy="-22" rx="3" ry="5" fill="#7A4A1D" />
    </g>
  );
}

export function HallArt({ seed = 0, className, wide = false }: { seed?: number; className?: string; wide?: boolean }) {
  const id = useId().replace(/:/g, '');
  const p = PALETTES[((seed % 8) + 8) % 8];
  const night = seed % 8 === 6;
  const wings = seed % 3 !== 1; // some halls get side wings
  const leaves = Array.from({ length: 9 }, (_, i) => 136 + i * 6);
  const kolamDots = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return [160 + Math.cos(a) * 22, 166 + Math.sin(a) * 6];
  });
  return (
    <svg className={className} viewBox={wide ? "-260 -6 840 192" : "0 0 320 180"} preserveAspectRatio={wide ? "xMidYMax slice" : "xMidYMid slice"} role="img" aria-label="Illustration of the hall entrance">
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset="1" stopColor={p.sky[1]} />
        </linearGradient>
        <radialGradient id={`glow${id}`}>
          <stop offset="0" stopColor="#FFD27A" stopOpacity="0.9" />
          <stop offset="1" stopColor="#FFD27A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="-400" y="-20" width="1120" height="200" fill={`url(#sky${id})`} />
      <circle cx={night ? 262 : 58} cy={night ? 34 : 40} r={night ? 12 : 22} fill={p.sun} opacity={night ? 0.95 : 0.8} />
      {night && [30, 80, 120, 210, 290, 240].map((x, i) => <circle key={x} cx={x} cy={14 + ((i * 17) % 40)} r="1" fill="#fff" opacity="0.8" />)}

      {/* side wings */}
      {wings && (
        <g>
          <rect x="34" y="96" width="252" height="56" fill={p.wing} />
          {[48, 72, 238, 262].map((x) => (
            <path key={x} d={`M${x} 140 v-22 a8 8 0 0 1 16 0 v22z`} fill={p.door} opacity="0.55" />
          ))}
          <rect x="34" y="92" width="252" height="5" fill={p.trim} />
        </g>
      )}
      {/* main hall */}
      <rect x="92" y="74" width="136" height="78" fill={p.wall} />
      <rect x="92" y="70" width="136" height="6" fill={p.trim} />
      {/* stepped gopuram-style roof */}
      <path d="M118 70 L126 56 L194 56 L202 70Z" fill={p.wing} />
      <path d="M130 56 L137 45 L183 45 L190 56Z" fill={p.wall} />
      <path d="M141 45 L147 36 L173 36 L179 45Z" fill={p.wing} />
      <path d="M150 36 Q160 22 170 36Z" fill={p.trim} />
      {[148, 160, 172].map((x) => (
        <circle key={x} cx={x} cy={x === 160 ? 24 : 34} r="2.4" fill={p.trim} />
      ))}
      <rect x="126" y="56" width="68" height="2" fill={p.trim} opacity="0.6" />
      {/* pillars */}
      {[100, 116, 204, 220].map((x) => (
        <rect key={x} x={x - 2} y="80" width="4" height="72" fill={p.trim} opacity="0.55" />
      ))}
      {/* door arch */}
      {night && <circle cx="160" cy="124" r="40" fill={`url(#glow${id})`} />}
      <path d="M140 152 V116 a20 20 0 0 1 40 0 V152Z" fill={p.door} />
      <path d="M140 152 V116 a20 20 0 0 1 40 0 V152" fill="none" stroke={p.trim} strokeWidth="2" />
      {/* thoranam over the door */}
      <path d="M134 98 Q160 106 186 98" stroke={p.trim} strokeWidth="1.2" fill="none" />
      {leaves.map((x, i) => (
        <path
          key={x}
          d={`M${x} ${99 + Math.sin((i / 8) * Math.PI) * 4} q2 6 0 10 q-2 -4 0 -10z`}
          fill={i % 2 ? '#F2A007' : '#3E7D2E'}
        />
      ))}
      <BananaTree x={128} />
      <BananaTree x={192} flip />
      {wide && (
        <>
          {/* a coconut grove on either side when there's room */}
          {[-200, -150, -90, 410, 470, 530].map((x, i) => (
            <g key={x} transform={`translate(${x} 150)`} opacity={0.9 - (i % 3) * 0.15}>
              <path d={`M0 0 C${i % 2 ? 4 : -4} -30 ${i % 2 ? 10 : -8} -60 ${i % 2 ? 6 : -4} -84`} stroke="#7A5A33" strokeWidth="4" fill="none" />
              {[-60, -25, 15, 50, 85].map((a) => (
                <path key={a} d="M0 0 q14 -6 30 6 q-16 -2 -30 -6z" fill="#3E7D2E" transform={`translate(${i % 2 ? 6 : -4} -84) rotate(${a})`} />
              ))}
            </g>
          ))}
        </>
      )}
      {/* ground + kolam */}
      <rect x="-400" y="150" width="1120" height="40" fill={p.ground} />
      <ellipse cx="160" cy="166" rx="30" ry="9" fill="none" stroke="#FFFDF5" strokeWidth="1.2" opacity="0.9" />
      {kolamDots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.1" fill="#FFFDF5" />
      ))}
      {night && (
        <>
          <circle cx="134" cy="146" r="9" fill={`url(#glow${id})`} />
          <circle cx="186" cy="146" r="9" fill={`url(#glow${id})`} />
        </>
      )}
    </svg>
  );
}
