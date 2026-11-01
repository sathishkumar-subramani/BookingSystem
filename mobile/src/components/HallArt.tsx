import { useId } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

// Port of web/src/components/HallArt.tsx — the illustrated mandapam facade used until photos exist.
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
  return (
    <G transform={`translate(${x} 150) scale(${flip ? -1 : 1} 1)`}>
      <Path d="M0 0 C1 -14 0 -30 -1 -44" stroke="#5E8C31" strokeWidth={4} fill="none" strokeLinecap="round" />
      <Path d="M-1 -44 C8 -56 22 -54 28 -46 C18 -48 8 -46 -1 -40Z" fill="#4C8A2E" />
      <Path d="M-1 -44 C-10 -58 -22 -56 -28 -48 C-18 -49 -9 -47 -1 -40Z" fill="#3E7D2E" />
      <Path d="M-1 -42 C3 -60 10 -66 16 -66 C10 -60 4 -52 0 -40Z" fill="#6FA84A" />
      <Path d="M-1 -30 C10 -34 18 -30 22 -24 C14 -27 6 -27 -1 -26Z" fill="#3E7D2E" />
      <Ellipse cx={4} cy={-22} rx={3} ry={5} fill="#7A4A1D" />
    </G>
  );
}

export function HallArt({ seed = 0, wide = false, style }: { seed?: number; wide?: boolean; style?: StyleProp<ViewStyle> }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const p = PALETTES[((seed % 8) + 8) % 8];
  const night = seed % 8 === 6;
  const wings = seed % 3 !== 1;
  const leaves = Array.from({ length: 9 }, (_, i) => 136 + i * 6);
  const dots = Array.from({ length: 12 }, (_, i) => [160 + Math.cos((i / 12) * Math.PI * 2) * 22, 166 + Math.sin((i / 12) * Math.PI * 2) * 6]);
  return (
    <Svg style={style} width="100%" height="100%" viewBox={wide ? '-120 -6 560 192' : '0 0 320 180'} preserveAspectRatio={wide ? 'xMidYMax slice' : 'xMidYMid slice'}>
      <Defs>
        <LinearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={p.sky[0]} />
          <Stop offset="1" stopColor={p.sky[1]} />
        </LinearGradient>
        <RadialGradient id={`glow${id}`}>
          <Stop offset="0" stopColor="#FFD27A" stopOpacity={0.9} />
          <Stop offset="1" stopColor="#FFD27A" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={-400} y={-20} width={1120} height={200} fill={`url(#sky${id})`} />
      <Circle cx={night ? 262 : 58} cy={night ? 34 : 40} r={night ? 12 : 22} fill={p.sun} opacity={night ? 0.95 : 0.8} />
      {wings && (
        <G>
          <Rect x={34} y={96} width={252} height={56} fill={p.wing} />
          {[48, 72, 238, 262].map((x) => (
            <Path key={x} d={`M${x} 140 v-22 a8 8 0 0 1 16 0 v22z`} fill={p.door} opacity={0.55} />
          ))}
          <Rect x={34} y={92} width={252} height={5} fill={p.trim} />
        </G>
      )}
      <Rect x={92} y={74} width={136} height={78} fill={p.wall} />
      <Rect x={92} y={70} width={136} height={6} fill={p.trim} />
      <Path d="M118 70 L126 56 L194 56 L202 70Z" fill={p.wing} />
      <Path d="M130 56 L137 45 L183 45 L190 56Z" fill={p.wall} />
      <Path d="M141 45 L147 36 L173 36 L179 45Z" fill={p.wing} />
      <Path d="M150 36 Q160 22 170 36Z" fill={p.trim} />
      {[148, 160, 172].map((x) => (
        <Circle key={x} cx={x} cy={x === 160 ? 24 : 34} r={2.4} fill={p.trim} />
      ))}
      {[100, 116, 204, 220].map((x) => (
        <Rect key={x} x={x - 2} y={80} width={4} height={72} fill={p.trim} opacity={0.55} />
      ))}
      {night && <Circle cx={160} cy={124} r={40} fill={`url(#glow${id})`} />}
      <Path d="M140 152 V116 a20 20 0 0 1 40 0 V152Z" fill={p.door} />
      <Path d="M140 152 V116 a20 20 0 0 1 40 0 V152" fill="none" stroke={p.trim} strokeWidth={2} />
      <Path d="M134 98 Q160 106 186 98" stroke={p.trim} strokeWidth={1.2} fill="none" />
      {leaves.map((x, i) => (
        <Path key={x} d={`M${x} ${99 + Math.sin((i / 8) * Math.PI) * 4} q2 6 0 10 q-2 -4 0 -10z`} fill={i % 2 ? '#F2A007' : '#3E7D2E'} />
      ))}
      <BananaTree x={128} />
      <BananaTree x={192} flip />
      <Rect x={-400} y={150} width={1120} height={40} fill={p.ground} />
      <Ellipse cx={160} cy={166} rx={30} ry={9} fill="none" stroke="#FFFDF5" strokeWidth={1.2} opacity={0.9} />
      {dots.map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={1.1} fill="#FFFDF5" />
      ))}
    </Svg>
  );
}

/** The Kanjivaram temple border — a band of zari triangles. */
export function SilkBorder({ height = 18, ground = '#6E1423', zari = '#C8962E' }: { height?: number; ground?: string; zari?: string }) {
  const n = 30;
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${n * 20} 26`} preserveAspectRatio="none">
      <Rect width={n * 20} height={26} fill={ground} />
      {Array.from({ length: n }, (_, i) => (
        <G key={i}>
          <Path d={`M${i * 20} 20 L${i * 20 + 10} 6 L${i * 20 + 20} 20 Z`} fill={zari} />
          <Path d={`M${i * 20 + 5} 20 L${i * 20 + 10} 12 L${i * 20 + 15} 20 Z`} fill={ground} />
          <Circle cx={i * 20 + 10} cy={3} r={1.4} fill={zari} />
        </G>
      ))}
      <Rect y={22} width={n * 20} height={1.6} fill={zari} />
    </Svg>
  );
}
