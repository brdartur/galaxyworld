/* Процедурные равнопромежуточные текстуры планет.
   Полноценный градиентный шум Перлина (3D) + фрактальные октавы (fBm)
   + domain warping для живых завихрений облаков. Бесшовность по долготе —
   через цилиндрические координаты. Никаких сетевых ресурсов. */

import { SOLAR_PLASMA_RGB } from './solarAppearance';

export interface TexData {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

const TAU = Math.PI * 2;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- шум Перлина (3D, улучшенный) ---------- */
function makePerlin(seed: number) {
  const rnd = mulberry32(seed);
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const grad = (hash: number, x: number, y: number, z: number) => {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  };

  return (x: number, y: number, z: number) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = fade(x);
    const v = fade(y);
    const w = fade(z);
    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;
    return lerp(
      lerp(
        lerp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u),
        lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u),
        v
      ),
      lerp(
        lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u),
        lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u),
        v
      ),
      w
    ); // примерно [-1, 1]
  };
}

type Noise3 = (x: number, y: number, z: number) => number;

/** фрактальный шум (fBm), нормированный в [-1, 1] */
function makeFbm(n: Noise3, oct = 4, lac = 2, gain = 0.5) {
  return (x: number, y: number, z: number) => {
    let a = 0;
    let amp = 0.5;
    let f = 1;
    let norm = 0;
    for (let i = 0; i < oct; i++) {
      a += amp * n(x * f, y * f, z * f);
      norm += amp;
      amp *= gain;
      f *= lac;
    }
    return a / norm;
  };
}

/** цилиндрические координаты => бесшовность по долготе */
function cyl(lon: number, lat: number, s: number): [number, number, number] {
  const a = lon * TAU;
  return [(Math.cos(a) * s) / TAU, (Math.sin(a) * s) / TAU, lat * s];
}

function smoothstep(a: number, b: number, v: number) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const n01 = (v: number) => v * 0.5 + 0.5; // [-1,1] -> [0,1]

function hex(v: string): [number, number, number] {
  const n = parseInt(v.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

type Packer = (u: number, v: number) => [number, number, number];

function bake(w: number, h: number, fn: Packer): TexData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const c = fn(u, v);
      const i = (y * w + x) * 4;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = 255;
    }
  }
  return { w, h, data };
}

/* ================= СОЛНЦЕ — жёлто-золотая фотосфера ================= */
function sunGen(w: number, h: number): TexData {
  const nFine = makeFbm(makePerlin(91), 3, 2.2, 0.55); // грануляция
  const nCell = makeFbm(makePerlin(92), 2, 2, 0.5); // супергранулы
  const nSpotW = makeFbm(makePerlin(93), 3, 2, 0.5); // warping для пятен
  const rnd = mulberry32(94);
  const spots = Array.from({ length: 7 }, () => ({
    u: rnd(),
    v: 0.2 + rnd() * 0.6,
    r: 0.003 + Math.pow(rnd(), 2) * 0.008,
  }));
  return bake(w, h, (u, v) => {
    const lat = 0.5 - v;
    // мелкая зернистость фотосферы
    const [cx1, cy1, cz1] = cyl(u, lat, 85);
    const gran = n01(nFine(cx1, cy1, cz1));
    // ячейки супергрануляции с warping
    const [wx, wy, wz] = cyl(u, lat, 6);
    const wx2 = wx + nSpotW(wx * 2, wy * 2, wz * 2) * 0.9;
    const wy2 = wy + nSpotW(wy * 2, wz * 2, wx * 2) * 0.9;
    const cell = Math.abs(nCell(wx2, wy2, wz)); // ridged -> сетка ярких ячеек
    const m = 0.9 + (gran - 0.5) * 0.18 + cell * 0.06;
    // Мелкая грануляция яркой фотосферы, без крупных тёмных «кратеров».
    let r = SOLAR_PLASMA_RGB[0] * m;
    let g = SOLAR_PLASMA_RGB[1] * m;
    let b = SOLAR_PLASMA_RGB[2] * m * m;
    // горячие факелы
    const hot = smoothstep(0.62, 0.85, gran + cell * 0.3);
    r += hot * 6;
    g += hot * 12;
    b += hot * 8;
    // солнечные пятна: тёмное ядро + полутень
    for (const s of spots) {
      let du = u - s.u;
      du -= Math.round(du);
      const dd = Math.hypot(du * 1.6, v - s.v);
      const irregular = dd < s.r * 3 ? nSpotW(cx1 * 2, cy1 * 2, cz1 * 2) * .45 : 0;
      const t = dd / s.r + irregular;
      if (t < 2.2) {
        const umbra = smoothstep(1, 0.45, t);
        const pen = smoothstep(2.2, 1, t) * 0.55;
        const f = 1 - umbra * 0.72 - pen * 0.35;
        r *= f;
        g *= f * (1 - umbra * 0.08);
        b *= f * (1 - umbra * 0.2);
      }
    }
    // лёгкое потемнение у полюсов текстуры (уходит на лимб)
    const pole = smoothstep(0.86, 1, Math.abs(lat) * 2);
    r -= pole * 40;
    g -= pole * 46;
    b -= pole * 30;
    return [r, g, b];
  });
}

/* ================= МЕРКУРИЙ ================= */
function mercuryGen(w: number, h: number): TexData {
  const n1 = makeFbm(makePerlin(111), 4, 2, 0.5);
  const n2 = makeFbm(makePerlin(112), 3, 2, 0.5);
  const rnd = mulberry32(113);
  const craters = Array.from({ length: 190 }, () => ({
    u: rnd(),
    v: 0.05 + rnd() * 0.9,
    r: Math.pow(rnd(), 2.1) * 0.045 + 0.0016,
    ray: rnd() > 0.86,
  }));
  return bake(w, h, (u, v) => {
    const lat = 0.5 - v;
    const [x1, y1, z1] = cyl(u, lat, 4.2);
    const m1 = n01(n1(x1, y1, z1));
    const [x2, y2, z2] = cyl(u, lat, 10);
    const m2 = n01(n2(x2, y2, z2));
    // серо-коричневый реголит с тёмными «морями»
    const mare = smoothstep(0.55, 0.75, m1) * 0.3;
    let m = 0.62 + (m2 - 0.5) * 0.5 - mare;
    let r = 168 * m + 12;
    let g = 152 * m + 10;
    let b = 134 * m + 8;
    for (const c of craters) {
      let du = u - c.u;
      du -= Math.round(du);
      const dist = Math.hypot(du, v - c.v);
      if (dist < c.r * (c.ray ? 3 : 1.15)) {
        const t = dist / c.r;
        if (t < 1.15) {
          if (t < 0.7) {
            const f = 1 - (1 - t / 0.7) * 0.52;
            r *= f;
            g *= f;
            b *= f;
          } else {
            const f = 1 + (1 - (t - 0.7) / 0.45) * 0.5;
            r = Math.min(255, r * f);
            g = Math.min(255, g * f);
            b = Math.min(255, b * f);
          }
        } else if (c.ray && t < 3) {
          // светлые лучи выброса
          const rf = (1 - (t - 1.15) / 1.85) * 0.3;
          r += rf * 60;
          g += rf * 58;
          b += rf * 52;
        }
      }
    }
    return [r, g, b];
  });
}

/* ================= ВЕНЕРА ================= */
function venusGen(w: number, h: number): TexData {
  const n1 = makeFbm(makePerlin(211), 4, 2, 0.55);
  const n2 = makeFbm(makePerlin(212), 3, 2, 0.5);
  const n3 = makeFbm(makePerlin(213), 2, 2, 0.5);
  return bake(w, h, (u, v) => {
    const lat = 0.5 - v;
    // сильный warping: серные облака закручены
    const [x0, y0, z0] = cyl(u, lat, 3);
    const w1 = n1(x0 * 1.7, y0 * 1.7, z0 * 1.7) * 0.5;
    const [x1, y1, z1] = cyl(u, lat + w1 * 0.16, 6);
    const w2 = n2(x1, y1, z1) * 0.3;
    // вытянутые шевроны (Y-образная структура)
    const vv = v + w1 * 0.22 + w2 * 0.12;
    const chevron = Math.sin(vv * 13 + Math.sin(u * TAU * 2 + vv * 5) * 2.4 + n3(x1 * 2, y1 * 2, z1 * 2) * 2);
    const base = 0.72 + chevron * 0.16 + (n01(n2(x1 * 2.4, y1 * 2.4, z1 * 2.4)) - 0.5) * 0.22;
    // тёмные полярные капюшоны
    const hood = smoothstep(0.78, 0.99, Math.abs(lat) * 2) * 0.42;
    let r = 238 * base + 8;
    let g = 203 * base + 4;
    let b = 132 * base;
    const f = 1 - hood;
    r *= f + 0.06;
    g *= f + 0.02;
    b *= f;
    return [r, g, b];
  });
}

/* ================= ЗЕМЛЯ ================= */
function earthGen(w: number, h: number): TexData {
  const nLand = makeFbm(makePerlin(311), 4, 2, 0.52);
  const nWarp = makeFbm(makePerlin(312), 3, 2, 0.5);
  const nDet = makeFbm(makePerlin(313), 3, 2.2, 0.5);
  const nDry = makeFbm(makePerlin(314), 3, 2, 0.5);
  const nCloud = makeFbm(makePerlin(315), 4, 2, 0.55);
  const oceanDeep: [number, number, number] = [10, 42, 108];
  const oceanMid: [number, number, number] = [16, 74, 148];
  const shelf: [number, number, number] = [38, 128, 178];
  const land1: [number, number, number] = [46, 106, 52];
  const land2: [number, number, number] = [118, 142, 66];
  const desert: [number, number, number] = [196, 164, 106];
  const mount: [number, number, number] = [128, 108, 84];
  return bake(w, h, (u, v) => {
    const lat = 0.5 - v;
    // континенты: warped fBm
    const [wx, wy, wz] = cyl(u, lat, 2.3);
    const warp = nWarp(wx * 1.6, wy * 1.6, wz * 1.6) * 0.55;
    const [x1, y1, z1] = cyl(u + warp * 0.14, lat + warp * 0.1, 2.3);
    let land = nLand(x1, y1, z1) * 0.66 + nDet(x1 * 2.2, y1 * 2.2, z1 * 2.2) * 0.34;
    land += 0.06 - Math.pow(Math.abs(lat), 3.2) * 0.5;
    const coast = smoothstep(0.0, 0.035, land);
    let col: [number, number, number];
    if (land > 0) {
      // суша
      const e = clamp01(land * 5);
      const [dx2, dy2, dz2] = cyl(u, lat, 5);
      const detail = n01(nDet(dx2, dy2, dz2));
      const dryness = n01(nDry(x1 * 1.4, y1 * 1.4, z1 * 1.4));
      let base = mix(land1, land2, detail * 0.8 + e * 0.2);
      // пустыни в сухих тропических поясах
      const desertMask = smoothstep(0.6, 0.78, dryness) * smoothstep(0.42, 0.16, Math.abs(Math.abs(lat) - 0.24));
      base = mix(base, desert, desertMask * 0.9);
      // горы светлее
      base = mix(base, mount, smoothstep(0.55, 0.85, e) * 0.7);
      // снежные шапки гор и полюсов
      const snow = smoothstep(0.6, 0.78, Math.abs(lat) + detail * 0.12 + e * 0.1);
      base = mix(base, [236, 240, 246], snow);
      col = base;
    } else {
      // океан: глубина + мелководье у берегов
      const depth = clamp01(-land * 4);
      let base = mix(shelf, mix(oceanMid, oceanDeep, depth), smoothstep(0, 0.5, depth));
      col = mix(shelf, base, smoothstep(0, 0.06, -land));
    }
    void coast;
    // облака — отдельный warped-слой
    const [cx2, cy2, cz2] = cyl(u, lat, 3.4);
    const cw = nWarp(cx2 * 2, cy2 * 2, cz2 * 2) * 0.4;
    let cloud = nCloud(cx2 + cw, cy2 + cw, cz2 * 1.4);
    cloud = smoothstep(0.12, 0.42, cloud) * (0.6 + 0.4 * n01(nDet(cx2 * 5, cy2 * 5, cz2 * 5)));
    col = mix(col, [255, 255, 255], cloud * 0.92);
    // полярный лёд
    const ice = smoothstep(0.87, 0.965, Math.abs(lat) * 2 + n01(nDet(cx2 * 3, cy2 * 3, cz2 * 3)) * 0.05);
    col = mix(col, [238, 245, 252], ice);
    return col;
  });
}

/* ================= МАРС ================= */
function marsGen(w: number, h: number): TexData {
  const n1 = makeFbm(makePerlin(411), 4, 2, 0.52);
  const n2 = makeFbm(makePerlin(412), 3, 2, 0.5);
  const nW = makeFbm(makePerlin(413), 3, 2, 0.5);
  const rnd = mulberry32(414);
  const craters = Array.from({ length: 80 }, () => ({
    u: rnd(),
    v: 0.07 + rnd() * 0.86,
    r: Math.pow(rnd(), 2) * 0.032 + 0.002,
  }));
  const rust: [number, number, number] = [198, 106, 72];
  const dark: [number, number, number] = [96, 52, 38];
  const dust: [number, number, number] = [226, 152, 104];
  return bake(w, h, (u, v) => {
    const lat = 0.5 - v;
    const [wx, wy, wz] = cyl(u, lat, 3);
    const warp = nW(wx * 1.5, wy * 1.5, wz * 1.5) * 0.4;
    const [x1, y1, z1] = cyl(u + warp * 0.1, lat, 3.4);
    const m1 = n01(n1(x1, y1, z1));
    const m2 = n01(n2(x1 * 2.4, y1 * 2.4, z1 * 2.4));
    const darkMask = smoothstep(0.52, 0.72, m1);
    let col = mix(rust, dark, darkMask * 0.75);
    col = mix(col, dust, smoothstep(0.62, 0.82, m2) * 0.5);
    // каньон Маринер — изогнутая тёмная борозда
    let du = u - 0.27;
    du -= Math.round(du);
    const canyonPath = 0.53 + Math.sin(du * 22) * 0.02 + n2(x1 * 3, y1 * 3, z1 * 3) * 0.02;
    const canyon = smoothstep(0.045, 0.012, Math.abs(v - canyonPath)) * smoothstep(0.17, 0.03, Math.abs(du));
    col = mix(col, [70, 38, 28], canyon * 0.8);
    // кратеры
    for (const c of craters) {
      let ddu = u - c.u;
      ddu -= Math.round(ddu);
      const dist = Math.hypot(ddu, v - c.v);
      if (dist < c.r) {
        const t = dist / c.r;
        const f = t < 0.7 ? 1 - (1 - t / 0.7) * 0.42 : 1 + (1 - (t - 0.7) / 0.3) * 0.32;
        col = [col[0] * f, col[1] * f, col[2] * f];
      }
    }
    // полярные шапки
    const cap = smoothstep(0.9, 0.985, Math.abs(lat) * 2 + m2 * 0.04);
    col = mix(col, [236, 228, 218], cap);
    return col;
  });
}

/* ================= ГАЗОВЫЕ ГИГАНТЫ ================= */
interface Band { pos: number; col: string; wd: number }

function gasGen(
  seed: number,
  w: number,
  h: number,
  bands: Band[],
  opts: {
    turb: number; // амплитуда турбулентности полос
    stretch?: number; // вытянутость по долготе
    spot?: { u: number; v: number; r: number; col: string; swirl?: boolean };
    streaks?: { col: string; th: number; power?: number };
    polarDark?: number;
  }
): TexData {
  const n1 = makeFbm(makePerlin(seed), 4, 2, 0.55);
  const n2 = makeFbm(makePerlin(seed + 17), 3, 2, 0.5);
  const n3 = makeFbm(makePerlin(seed + 29), 2, 2, 0.5);
  const cols = bands.map((b) => ({ pos: b.pos, wd: b.wd, col: hex(b.col) }));
  const stretch = opts.stretch ?? 1;
  return bake(w, h, (u, v) => {
    const lat = 0.5 - v;
    // domain warping -> живые завихрения полос
    const [x0, y0, z0] = cyl(u, lat, 3.2);
    const w1 = n1(x0 * 1.8, y0 * 1.8, z0 * 1.8) * opts.turb;
    const w2 = n2(x0 * 3.6, y0 * 3.6, z0 * 3.6) * opts.turb * 0.4;
    const vv = v + w1 * 0.5 + w2 * 0.5;
    // профиль полос
    let r = 0;
    let g = 0;
    let b = 0;
    let wsum = 0;
    for (const band of cols) {
      const d = Math.abs(((vv - band.pos + 0.5) % 1 + 1) % 1 - 0.5);
      const wgt = Math.max(0, 1 - d / band.wd);
      r += band.col[0] * wgt;
      g += band.col[1] * wgt;
      b += band.col[2] * wgt;
      wsum += wgt;
    }
    r /= wsum;
    g /= wsum;
    b /= wsum;
    // тонкая турбулентная рябь вдоль полос
    const [x3, y3, z3] = cyl(u, lat, 9 * stretch);
    const ripple = n2(x3, y3 * 0.6, z3 * 2.2) * 9;
    r += ripple;
    g += ripple;
    b += ripple * 0.8;
    // вихри (eddies) между полосами
    const eddy = Math.abs(n3(x3 * 0.7, y3 * 0.7, z3 * 1.6));
    const em = smoothstep(0.42, 0.62, eddy) * 10;
    r += em;
    g += em * 0.7;
    b += em * 0.3;
    // пятно-шторм
    if (opts.spot) {
      const sc = hex(opts.spot.col);
      let du = u - opts.spot.u;
      du -= Math.round(du);
      const dv = v - opts.spot.v;
      const dd = Math.hypot(du * 2, dv) / opts.spot.r;
      if (dd < 1.6) {
        let f = smoothstep(1.05, 0.3, dd);
        if (opts.spot.swirl) {
          // завихрение: модуляция по углу
          const ang = Math.atan2(dv, du * 2);
          const [sx, sy, sz] = cyl(u, lat, 14);
          const sw = n3(sx * 2 + Math.cos(ang * 2), sy * 2 + Math.sin(ang * 2), sz * 2);
          f *= 0.75 + 0.35 * (sw * 0.5 + 0.5);
        }
        const ring = smoothstep(0.35, 0, Math.abs(dd - 1.02)) * 0.5;
        const t = clamp01(f + ring);
        r += (sc[0] - r) * t;
        g += (sc[1] - g) * t;
        b += (sc[2] - b) * t;
      }
    }
    // перистые/яркие штрихи
    if (opts.streaks) {
      const [sx2, sy2, sz2] = cyl(u, lat, 7 * stretch);
      const s = smoothstep(opts.streaks.th, opts.streaks.th + 0.14, n01(n1(sx2, sy2 * 0.5, sz2 * 2.6))) * (opts.streaks.power ?? 0.5);
      const sc2 = hex(opts.streaks.col);
      r += (sc2[0] - r) * s;
      g += (sc2[1] - g) * s;
      b += (sc2[2] - b) * s;
    }
    // полярное затемнение
    if (opts.polarDark) {
      const pd = smoothstep(0.75, 0.99, Math.abs(lat) * 2) * opts.polarDark;
      r *= 1 - pd;
      g *= 1 - pd;
      b *= 1 - pd * 0.8;
    }
    return [r, g, b];
  });
}

/* ================= УРАН / НЕПТУН (ледяные) ================= */
function iceGiant(
  seed: number,
  w: number,
  h: number,
  base: [number, number, number],
  bandAmp: number,
  opts: { spot?: { u: number; v: number; r: number; col: string }; streaks?: boolean } = {}
): TexData {
  const n1 = makeFbm(makePerlin(seed), 3, 2, 0.5);
  const n2 = makeFbm(makePerlin(seed + 7), 3, 2, 0.5);
  return bake(w, h, (u, v) => {
    const lat = 0.5 - v;
    const [x1, y1, z1] = cyl(u, lat, 2.6);
    const soft = n1(x1, y1, z1) * bandAmp;
    // очень плавные полосы
    const bands = Math.sin(v * 9 + n2(x1 * 2, y1 * 2, z1 * 2) * 1.6) * bandAmp * 0.6;
    let r = base[0] + (soft + bands) * 90;
    let g = base[1] + (soft + bands) * 96;
    let b = base[2] + (soft + bands) * 100;
    // полярный «капюшон»
    const hood = smoothstep(0.7, 0.98, Math.abs(lat) * 2);
    r += hood * 14;
    g += hood * 16;
    b += hood * 14;
    if (opts.spot) {
      const sc = hex(opts.spot.col);
      let du = u - opts.spot.u;
      du -= Math.round(du);
      const dd = Math.hypot(du * 2, v - opts.spot.v) / opts.spot.r;
      if (dd < 1.4) {
        const f = smoothstep(1.1, 0.3, dd);
        r += (sc[0] - r) * f;
        g += (sc[1] - g) * f;
        b += (sc[2] - b) * f;
      }
    }
    if (opts.streaks) {
      const [x2, y2, z2] = cyl(u, lat, 8);
      const s = smoothstep(0.7, 0.84, n01(n2(x2, y2 * 0.4, z2 * 3))) * 0.55;
      r += (240 - r) * s;
      g += (246 - g) * s;
      b += (255 - b) * s;
    }
    return [r, g, b];
  });
}

/* ---------- регистр генераторов ---------- */
const W = 768;
const H = 384;

const GENERATORS: Record<string, () => TexData> = {
  sun: () => sunGen(W, H),
  mercury: () => mercuryGen(W, H),
  venus: () => venusGen(W, H),
  earth: () => earthGen(W, H),
  mars: () => marsGen(W, H),
  jupiter: () =>
    gasGen(51, W, H, [
      { pos: 0.05, col: "#8a6f4d", wd: 0.06 },
      { pos: 0.13, col: "#e8d5ae", wd: 0.05 },
      { pos: 0.21, col: "#b98d5e", wd: 0.05 },
      { pos: 0.29, col: "#f0e3c2", wd: 0.045 },
      { pos: 0.37, col: "#a9713f", wd: 0.05 },
      { pos: 0.45, col: "#ead9b4", wd: 0.05 },
      { pos: 0.53, col: "#c09a68", wd: 0.05 },
      { pos: 0.61, col: "#f2e6c8", wd: 0.045 },
      { pos: 0.69, col: "#b3854f", wd: 0.05 },
      { pos: 0.77, col: "#e5d2ab", wd: 0.05 },
      { pos: 0.85, col: "#96774f", wd: 0.06 },
      { pos: 0.93, col: "#d9c69e", wd: 0.05 },
    ], {
      turb: 0.055,
      spot: { u: 0.68, v: 0.63, r: 0.075, col: "#c14e2e", swirl: true },
      polarDark: 0.12,
    }),
  saturn: () =>
    gasGen(61, W, H, [
      { pos: 0.04, col: "#93805a", wd: 0.06 },
      { pos: 0.14, col: "#d9c48f", wd: 0.055 },
      { pos: 0.24, col: "#c4ab74", wd: 0.05 },
      { pos: 0.34, col: "#ecdfb4", wd: 0.05 },
      { pos: 0.44, col: "#d2ba82", wd: 0.055 },
      { pos: 0.54, col: "#efe2bc", wd: 0.05 },
      { pos: 0.64, col: "#cbb27c", wd: 0.05 },
      { pos: 0.74, col: "#e6d7a8", wd: 0.055 },
      { pos: 0.84, col: "#a98f5e", wd: 0.06 },
      { pos: 0.94, col: "#d8c894", wd: 0.05 },
    ], { turb: 0.022, streaks: { col: "#f7ecc9", th: 0.78, power: 0.25 }, polarDark: 0.1 }),
  uranus: () => iceGiant(71, W, H, [142, 214, 219], 0.06, { streaks: true }),
  neptune: () =>
    iceGiant(81, W, H, [64, 96, 208], 0.16, {
      spot: { u: 0.35, v: 0.38, r: 0.055, col: "#182566" },
      streaks: true,
    }),
};

const cache = new Map<string, TexData>();

export function getTexture(id: string): TexData {
  let t = cache.get(id);
  if (!t) {
    const gen = GENERATORS[id];
    t = gen ? gen() : mercuryGen(512, 256);
    cache.set(id, t);
  }
  return t;
}
