// Generates Arangam's Lottie animations as plain Lottie JSON (Bodymovin 5 format).
// Run:  node shared/lottie/build.mjs   → writes *.json here and copies them into web/ and mobile/.
//
// Every shape is drawn from code, so the files are original and small. To use an animation from
// LottieFiles instead, drop its .json next to these with the same name.
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// ───────────── tiny Lottie toolkit ─────────────
const hex = (h, a = 1) => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a].map((v) => +v.toFixed(4));
};
const C = {
  leaf: '#3E7D2E',
  leafDark: '#2B5A1F',
  leafLight: '#6FA84A',
  marigold: '#F2A007',
  marigoldDeep: '#E07A00',
  marigoldLight: '#FFC93C',
  jasmine: '#FFFBEF',
  zari: '#C8962E',
  brass: '#D4A23A',
  brassDark: '#A87920',
  brassLight: '#F3D27A',
  flameOuter: '#F29F05',
  flameInner: '#FFE08A',
  flameCore: '#FFF8E6',
  glow: '#FFD27A',
  maroon: '#6E1423',
  rose: '#C2185B',
  kumkum: '#C1272D',
  peacock: '#0B5D5E',
  white: '#FFFFFF',
};

const st = (k) => ({ a: 0, k });
const r4 = (v) => (Array.isArray(v) ? v.map(r4) : +(+v).toFixed(3));

/** Animated property. keys: [[frame, value], ...]. mode: 'linear' | 'ease' | 'hold' */
function anim(keys, mode = 'ease') {
  const dims = Array.isArray(keys[0][1]) ? keys[0][1].length : 1;
  const arr = (v) => Array(dims).fill(v);
  const ease =
    mode === 'linear'
      ? { o: { x: arr(0), y: arr(0) }, i: { x: arr(1), y: arr(1) } }
      : { o: { x: arr(0.42), y: arr(0) }, i: { x: arr(0.58), y: arr(1) } };
  return {
    a: 1,
    k: keys.map(([t, v], idx) => {
      const s = Array.isArray(v) ? r4(v) : [r4(v)];
      if (idx === keys.length - 1) return { t, s };
      return mode === 'hold' ? { t, s, h: 1 } : { t, s, ...ease };
    }),
  };
}
/** Same, but each key can carry its own easing ('linear' | 'ease' | 'hold'). */
function animMixed(keys) {
  const dims = Array.isArray(keys[0][1]) ? keys[0][1].length : 1;
  const arr = (v) => Array(dims).fill(v);
  return {
    a: 1,
    k: keys.map(([t, v, mode = 'ease'], idx) => {
      const s = Array.isArray(v) ? r4(v) : [r4(v)];
      if (idx === keys.length - 1) return { t, s };
      if (mode === 'hold') return { t, s, h: 1 };
      return mode === 'linear'
        ? { t, s, o: { x: arr(0), y: arr(0) }, i: { x: arr(1), y: arr(1) } }
        : { t, s, o: { x: arr(0.42), y: arr(0) }, i: { x: arr(0.58), y: arr(1) } };
    }),
  };
}

const tr = ({ p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) => ({
  ty: 'tr',
  p: p.a ? p : st(p),
  a: a.a ? a : st(a),
  s: s.a ? s : st(s),
  r: r.a ? r : st(r),
  o: o.a ? o : st(o),
  sk: st(0),
  sa: st(0),
});
const fill = (color, opacity = 100) => ({ ty: 'fl', c: color.a ? color : st(hex(color)), o: opacity.a ? opacity : st(opacity), r: 1 });
const stroke = (color, w, opacity = 100) => ({ ty: 'st', c: st(hex(color)), o: st(opacity), w: st(w), lc: 2, lj: 2, ml: 4 });
const ellipse = (p, s) => ({ ty: 'el', d: 1, p: st(p), s: s.a ? s : st(s) });
const rect = (p, s, r = 0) => ({ ty: 'rc', d: 1, p: st(p), s: st(s), r: st(r) });
/** Path from vertices with in/out tangents (relative), closed or open. */
const path = (v, i, o, c = true) => ({ ty: 'sh', d: 1, ks: st({ v: r4(v), i: r4(i ?? v.map(() => [0, 0])), o: r4(o ?? v.map(() => [0, 0])), c }) });
const trim = (s, e, o = 0) => ({ ty: 'tm', s: s.a ? s : st(s), e: e.a ? e : st(e), o: st(o), m: 1 });
const group = (items, transform = {}) => ({ ty: 'gr', it: [...items, tr(transform)] });

let layerIndex = 0;
function layer(name, shapes, { p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100, ip = 0, op } = {}) {
  layerIndex += 1;
  const isProp = (x) => x && typeof x === 'object' && !Array.isArray(x) && 'k' in x;
  const ks = {
    o: isProp(o) ? o : st(o),
    r: isProp(r) ? r : st(r),
    p: isProp(p) ? p : st([...p, 0]),
    a: st([...a, 0]),
    s: isProp(s) ? s : st([...s, 100]),
  };
  return { ddd: 0, ind: layerIndex, ty: 4, nm: name, sr: 1, ks, ao: 0, shapes, ip, op, st: 0, bm: 0 };
}
function comp(name, w, h, op, layers, fr = 30) {
  // Lottie draws the first layer on top, so callers list layers back-to-front and we reverse here.
  const ordered = [...layers].reverse().map((l, idx) => ({ ...l, ind: idx + 1, op: l.op ?? op }));
  return { v: '5.7.4', fr, ip: 0, op, w, h, nm: name, ddd: 0, assets: [], layers: ordered, markers: [] };
}

// deterministic noise
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const sampleLoop = (op, step, fn) => {
  const keys = [];
  for (let t = 0; t <= op; t += step) keys.push([t, fn(t)]);
  if (keys[keys.length - 1][0] !== op) keys.push([op, fn(op)]);
  return keys;
};

// ───────────── shapes ─────────────
const leafShape = (len = 72, w = 11) =>
  path(
    [[0, 0], [w, len * 0.44], [0, len], [-w, len * 0.44]],
    [[-8, 6], [0, -len * 0.2], [6, -10], [0, len * 0.22]],
    [[8, 6], [0, len * 0.22], [-6, -10], [0, -len * 0.2]],
  );
const teardrop = (h, w) =>
  path(
    [[0, -h], [w, -h * 0.18], [0, h * 0.18], [-w, -h * 0.18]],
    [[-w * 0.15, -h * 0.2], [0, -h * 0.35], [w * 0.6, 0], [0, h * 0.2]],
    [[w * 0.15, -h * 0.2], [0, h * 0.2], [-w * 0.6, 0], [0, -h * 0.35]],
  );

function marigold(r, color = C.marigold, deep = C.marigoldDeep) {
  const petals = [];
  const n = 8;
  for (let k = 0; k < n; k += 1) {
    const ang = (k / n) * Math.PI * 2;
    petals.push(group([ellipse([0, 0], [r * 0.9, r * 0.9]), fill(deep)], { p: [Math.cos(ang) * r * 0.55, Math.sin(ang) * r * 0.55] }));
  }
  return [
    group([ellipse([0, 0], [r * 0.7, r * 0.7]), fill(C.marigoldLight)]),
    ...petals.slice(0, 4).map((g) => ({ ...g })),
    group([ellipse([0, 0], [r * 2, r * 2]), fill(color)]),
    ...petals.slice(4),
  ];
}

// ───────────── 1. Thoranam (mango-leaf festoon) ─────────────
function thoranam() {
  const W = 1200;
  const H = 230;
  const op = 120; // 4 s loop
  const sag = 26;
  const yAt = (x) => 28 + sag * Math.sin((Math.PI * x) / W);
  const layers = [];
  const R = rng(7);

  // the cord, with jasmine buds threaded on it
  const cordV = [];
  for (let x = 0; x <= W; x += 40) cordV.push([x, yAt(x)]);
  const buds = [];
  for (let x = 12; x < W; x += 16) buds.push(group([ellipse([0, 0], [7, 9]), fill(C.jasmine)], { p: [x, yAt(x) + 1], r: (x * 7) % 40 - 20 }));
  layers.push(layer('cord', [group([path(cordV, null, null, false), stroke(C.zari, 3)]), ...buds.reverse()]));

  const n = 21;
  for (let k = 0; k < n; k += 1) {
    const x = 30 + (k * (W - 60)) / (n - 1);
    const y = yAt(x);
    const amp = 4 + R() * 4;
    const phase = R() * op;
    const rot = anim(sampleLoop(op, 10, (t) => amp * Math.sin((2 * Math.PI * (t + phase)) / op)), 'linear');
    if (k % 2 === 0) {
      // mango leaf, folded over the cord
      const len = 70 + R() * 18;
      layers.push(
        layer(`leaf ${k}`, [
          group([path([[0, 6], [0, len - 6]], null, null, false), stroke(C.leafDark, 1.6, 80)]),
          group([leafShape(len, 11 + R() * 3), fill(k % 4 === 0 ? C.leaf : C.leafLight)]),
          group([rect([0, 2], [10, 8], 3), fill(C.leafDark)]),
        ], { p: [x, y], r: rot }),
      );
    } else {
      // marigold pendant: thread, big flower, small flower, jasmine tip
      layers.push(
        layer(`marigold ${k}`, [
          group([ellipse([0, 0], [6, 8]), fill(C.jasmine)], { p: [0, 88] }),
          group(marigold(9, C.marigoldLight, C.marigold), { p: [0, 70] }),
          group(marigold(14), { p: [0, 40] }),
          group([path([[0, 0], [0, 84]], null, null, false), stroke(C.zari, 1.5)]),
        ], { p: [x, y], r: rot }),
      );
    }
  }
  return comp('thoranam', W, H, op, layers);
}

// ───────────── 2. Kuthuvilakku (brass lamp) ─────────────
function lamp() {
  const W = 300;
  const H = 420;
  const op = 90;
  const cx = 150;
  const layers = [];

  // glows (behind)
  const flames = [
    { x: 74, y: 150, s: 0.85, seed: 3 },
    { x: 150, y: 156, s: 1, seed: 11 },
    { x: 226, y: 150, s: 0.85, seed: 19 },
  ];
  // one soft halo behind the whole plate (rings fake a radial gradient — Lottie shapes have no blur)
  {
    const R = rng(77);
    const flicker = sampleLoop(op, 6, () => 0.8 + R() * 0.4);
    for (const [size, base] of [[250, 4], [190, 5], [136, 7], [92, 9]]) {
      layers.push(
        layer('halo', [group([ellipse([0, 0], [size * 1.25, size]), fill(C.glow)])], {
          p: [cx, 128],
          o: anim(flicker.map(([t, k]) => [t, base * k]), 'linear'),
        }),
      );
    }
  }

  // lamp body (front)
  const body = [
    // top finial: a little swan (annam) silhouette made of ellipses
    group([ellipse([0, 0], [16, 26]), fill(C.brass)], { p: [cx, 58] }),
    group([ellipse([0, 0], [26, 14]), fill(C.brass)], { p: [cx, 76] }),
    group([ellipse([0, 0], [8, 8]), fill(C.brassLight)], { p: [cx + 2, 50] }),
    group([rect([cx, 104], [14, 44], 4), fill(C.brass)]),
    group([ellipse([cx, 84], [34, 10]), fill(C.brassDark)]),
    // oil plate (agal) with five points
    group([
      path([[cx - 92, 152], [cx + 92, 152], [cx + 60, 178], [cx - 60, 178]], [[0, 0], [0, 0], [12, -4], [0, 0]], [[0, 0], [-12, 0], [0, 0], [-12, -4]]),
      fill(C.brass),
    ]),
    group([ellipse([cx, 152], [186, 16]), fill(C.brassLight)]),
    group([ellipse([cx, 152], [150, 8]), fill(C.brassDark, 60)]),
    // stem with rings
    group([rect([cx, 268], [18, 190], 6), fill(C.brass)]),
    group([rect([cx - 4, 268], [5, 186], 3), fill(C.brassLight, 70)]),
    ...[200, 248, 300, 338].map((y, i) => group([ellipse([cx, y], [40 - i * 2, 14]), fill(i % 2 ? C.brassDark : C.brass)])),
    // base
    group([
      path([[cx - 20, 352], [cx + 20, 352], [cx + 82, 402], [cx - 82, 402]], [[0, 0], [0, 0], [30, -18], [0, 0]], [[0, 0], [10, 20], [0, 0], [-10, -26]]),
      fill(C.brass),
    ]),
    group([ellipse([cx, 402], [168, 18]), fill(C.brassDark)]),
    group([ellipse([cx, 396], [150, 10]), fill(C.brassLight, 55)]),
  ];
  layers.push(layer('lamp', body));

  // flames (front-most), each flickering on its own rhythm, anchored at the wick
  for (const f of flames) {
    const R = rng(f.seed);
    const sx = sampleLoop(op, 3, () => 94 + R() * 12);
    const sy = sampleLoop(op, 3, () => 90 + R() * 22);
    const scale = anim(sx.map(([t, v], i) => [t, [v * f.s, sy[i][1] * f.s, 100]]), 'linear');
    const rot = anim(sampleLoop(op, 3, () => -4 + R() * 8), 'linear');
    layers.push(
      layer('flame', [
        group([teardrop(18, 4), fill(C.flameCore)], { p: [0, -6] }),
        group([teardrop(30, 8), fill(C.flameInner)], { p: [0, -4] }),
        group([teardrop(44, 13), fill(C.flameOuter)]),
        group([rect([0, 8], [4, 8], 1), fill(C.maroon)]),
      ], { p: [f.x, f.y - 6], s: scale, r: rot }),
    );
  }
  return comp('kuthuvilakku', W, H, op, layers);
}

// ───────────── 3. Celebrate (booking confirmed) ─────────────
function celebrate() {
  const W = 400;
  const H = 400;
  const op = 96;
  const c = [200, 190];
  const layers = [];
  const R = rng(42);

  const petals = [];
  // expanding zari ring
  layers.push(
    layer('ring', [group([ellipse([0, 0], [150, 150]), stroke(C.zari, 6)])], {
      p: c,
      s: anim([[4, [60, 60, 100]], [30, [175, 175, 100]]]),
      o: anim([[4, 0], [8, 100], [30, 0]]),
    }),
  );
  // badge
  layers.push(
    layer('badge', [group([ellipse([0, 0], [150, 150]), fill(C.peacock)]), group([ellipse([0, 0], [134, 134]), stroke(C.zari, 3)])], {
      p: c,
      s: anim([[0, [0, 0, 100]], [12, [112, 112, 100]], [20, [100, 100, 100]]]),
    }),
  );
  // check mark draws itself
  layers.push(
    layer('check', [
      group([path([[-30, 2], [-8, 24], [34, -22]], null, null, false), stroke(C.white, 12), trim(0, anim([[12, 0], [30, 100]]))]),
    ], { p: c }),
  );
  // petals burst out and drift down
  const colors = [C.marigold, C.marigoldDeep, C.marigoldLight, C.jasmine, C.jasmine, C.rose, C.kumkum];
  for (let k = 0; k < 34; k += 1) {
    const ang = -Math.PI / 2 + (R() - 0.5) * Math.PI * 1.9;
    const speed = 5 + R() * 6;
    const vx = Math.cos(ang) * speed;
    const vy = Math.sin(ang) * speed;
    const g = 0.32;
    const spin = (R() - 0.5) * 24;
    const start = 8 + Math.floor(R() * 6);
    const pos = [];
    for (let t = start; t <= op; t += 4) {
      const dt = t - start;
      const drag = Math.min(dt, 22);
      pos.push([t, [c[0] + Math.cos(ang) * 58 + vx * drag + Math.sin(dt / 6) * 6, c[1] + Math.sin(ang) * 58 + vy * drag + 0.5 * g * Math.max(0, dt - 10) ** 1.6 * 0.18, 0]]);
    }
    const color = colors[k % colors.length];
    const shape = k % 3 === 0 ? [ellipse([0, 0], [9, 9]), fill(color)] : [teardrop(9, 5), fill(color)];
    petals.push(
      layer(`petal ${k}`, [group(shape)], {
        p: anim(pos, 'linear'),
        r: anim(sampleLoop(op - start, 8, (t) => spin * t).map(([t, v]) => [t + start, v]), 'linear'),
        o: anim([[start, 0], [start + 2, 100], [op - 24, 100], [op, 0]]),
        s: anim([[start, [40, 40, 100]], [start + 8, [100 + R() * 40, 100 + R() * 40, 100]]]),
        ip: start,
      }),
    );
  }
  // petals first = drawn behind the ring and badge
  return comp('celebrate', W, H, op, [...petals, ...layers]);
}

// ───────────── 4. Kolam loader ─────────────
function kolam() {
  const W = 200;
  const H = 200;
  const op = 96;
  const cx = 100;
  const cy = 100;
  const layers = [];

  // the line: a four-petal rose (r = a·cos 2θ) around the dots, plus an outer loop
  const rose = [];
  for (let k = 0; k <= 160; k += 1) {
    const th = (k / 160) * Math.PI * 2;
    const r = 72 * Math.cos(2 * th);
    rose.push([cx + r * Math.cos(th + Math.PI / 4), cy + r * Math.sin(th + Math.PI / 4)]);
  }
  const outer = [];
  for (let k = 0; k <= 80; k += 1) {
    const th = (k / 80) * Math.PI * 2;
    const r = 86 + 6 * Math.sin(8 * th);
    outer.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]);
  }
  const draw = trim(anim([[44, 0], [88, 100]]), anim([[0, 0], [50, 100]]));
  layers.push(layer('rose', [group([path(rose, null, null, false), stroke(C.zari, 5), draw])]));
  layers.push(layer('outer', [group([path(outer, null, null, false), stroke(C.zari, 3, 70), trim(anim([[52, 0], [94, 100]]), anim([[8, 0], [60, 100]]))])]));

  // pulli (dots) in a 3×3 grid, pulsing one after another
  let i = 0;
  for (const dy of [-34, 0, 34]) {
    for (const dx of [-34, 0, 34]) {
      const d = i * 6;
      layers.push(
        layer('dot', [group([ellipse([0, 0], [11, 11]), fill(C.kumkum)])], {
          p: [cx + dx, cy + dy],
          s: animMixed([[0, [100, 100, 100]], [d, [100, 100, 100]], [d + 10, [150, 150, 100]], [d + 22, [100, 100, 100]], [op, [100, 100, 100]]]),
        }),
      );
      i += 1;
    }
  }
  return comp('kolam', W, H, op, layers);
}

// ───────────── 5. Drifting petals (hero background) ─────────────
function petalsDrift() {
  const W = 1200;
  const H = 700;
  const op = 300; // 10 s loop
  const R = rng(99);
  const layers = [];
  const colors = [C.marigold, C.marigoldLight, C.jasmine, C.jasmine, C.rose];
  for (let k = 0; k < 22; k += 1) {
    const x0 = R() * W;
    const sway = 20 + R() * 40;
    const speedLoops = 1; // each petal falls exactly once per loop, so the loop is seamless
    const offset = R(); // where in its fall it is at frame 0
    const yAt = (t) => {
      const u = (offset + (t / op) * speedLoops) % 1;
      return -30 + u * (H + 60);
    };
    const jumpT = Math.round(((1 - offset) % 1) * op);
    const keys = [];
    for (let t = 0; t <= op; t += 10) {
      if (jumpT > 0 && t < jumpT && t + 10 > jumpT) {
        keys.push([t, [x0 + sway * Math.sin(t / 30 + k), yAt(t), 0], 'linear']);
        keys.push([jumpT - 1, [x0 + sway * Math.sin((jumpT - 1) / 30 + k), H + 29, 0], 'hold']);
        keys.push([jumpT, [x0 + sway * Math.sin(jumpT / 30 + k), -30, 0], 'linear']);
        continue;
      }
      keys.push([t, [x0 + sway * Math.sin(t / 30 + k), yAt(t), 0], 'linear']);
    }
    const color = colors[k % colors.length];
    const size = 0.7 + R() * 0.8;
    layers.push(
      layer(`drift ${k}`, [group([teardrop(17, 10), fill(color)])], {
        p: animMixed(keys),
        r: anim(sampleLoop(op, 30, (t) => (k % 2 ? 1 : -1) * (t * 1.2) + k * 20), 'linear'),
        s: st([size * 100, size * 100, 100]),
        o: 85,
      }),
    );
  }
  return comp('petals-drift', W, H, op, layers);
}

// ───────────── write ─────────────
const outputs = {
  'thoranam.json': thoranam(),
  'lamp.json': lamp(),
  'celebrate.json': celebrate(),
  'kolam.json': kolam(),
  'petals-drift.json': petalsDrift(),
};

const targets = [here, join(here, '../../web/src/assets/lottie'), join(here, '../../mobile/assets/lottie')];
for (const [name, data] of Object.entries(outputs)) {
  const json = JSON.stringify(data);
  writeFileSync(join(here, name), json);
  for (const dir of targets.slice(1)) {
    if (!existsSync(join(dir, '../../..', 'package.json')) && !existsSync(join(dir, '../..', 'package.json'))) continue;
    mkdirSync(dir, { recursive: true });
    copyFileSync(join(here, name), join(dir, name));
  }
  console.log(`${name.padEnd(20)} ${(json.length / 1024).toFixed(1)} KB, ${data.layers.length} layers, ${(data.op / data.fr).toFixed(1)} s`);
}
