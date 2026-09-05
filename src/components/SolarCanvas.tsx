import { useEffect, useRef } from "react";
import { PLANETS, SUN, SPIN_DAYS, type BodyData } from "../data/planets";
import { getTexture } from "../lib/textures";

const TAU = Math.PI * 2;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** осветлить hex-цвет, смешав с белым на долю f */
function lighten(hexStr: string, f: number): string {
  const n = parseInt(hexStr.slice(1), 16);
  const r = ((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * f;
  const g = ((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * f;
  const b = (n & 255) + (255 - (n & 255)) * f;
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

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

function distToSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

interface Star {
  x: number;
  y: number;
  r: number;
  base: number;
  amp: number;
  ph: number;
  sp: number;
}

interface Rock {
  a0: number;
  rf: number;
  period: number;
  size: number;
  alpha: number;
  warm: boolean;
}

interface Placed {
  id: string;
  x: number;
  y: number;
  r: number;
  hit: number;
}

/* -------- созвездия (нормированные координаты 0..1) -------- */
interface Constellation {
  name: string;
  pts: [number, number][];
  seg: [number, number][];
}
export const CONSTELLATIONS: Constellation[] = [
  {
    name: "БОЛЬШАЯ МЕДВЕДИЦА",
    pts: [[0, 0.62], [0.13, 0.45], [0.27, 0.4], [0.4, 0.48], [0.54, 0.53], [0.7, 0.6], [0.86, 0.5]],
    seg: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]],
  },
  {
    name: "ОРИОН",
    pts: [[0.18, 0.08], [0.6, 0.02], [0.3, 0.44], [0.42, 0.47], [0.54, 0.5], [0.24, 0.9], [0.66, 0.84]],
    seg: [[0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [5, 6]],
  },
  {
    name: "КАССИОПЕЯ",
    pts: [[0, 0.35], [0.25, 0.6], [0.5, 0.32], [0.75, 0.62], [1, 0.38]],
    seg: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  {
    name: "ЛЕБЕДЬ",
    pts: [[0.5, 0], [0.5, 0.3], [0.5, 0.62], [0.5, 0.95], [0.12, 0.38], [0.88, 0.28]],
    seg: [[0, 1], [1, 2], [2, 3], [4, 1], [1, 5]],
  },
  {
    name: "ЛИРА",
    pts: [[0.5, 0], [0.3, 0.35], [0.68, 0.3], [0.42, 0.75], [0.78, 0.7]],
    seg: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 4]],
  },
  {
    name: "СКОРПИОН",
    pts: [[0.1, 0], [0.2, 0.15], [0.28, 0.3], [0.3, 0.45], [0.26, 0.6], [0.15, 0.72], [0.05, 0.8], [0.12, 0.92], [0.26, 0.88]],
    seg: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8]],
  },
  {
    name: "ЛЕВ",
    pts: [[0.15, 0.25], [0.05, 0.4], [0.12, 0.55], [0.3, 0.5], [0.55, 0.45], [0.75, 0.6], [0.9, 0.45], [0.75, 0.3]],
    seg: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6], [6, 7], [7, 4]],
  },
  {
    name: "МАЛАЯ МЕДВЕДИЦА",
    pts: [[0.08, 0.2], [0.26, 0.26], [0.42, 0.36], [0.54, 0.5], [0.68, 0.62], [0.84, 0.56], [0.8, 0.78]],
    seg: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 4]],
  },
  {
    name: "ПЕРСЕЙ",
    pts: [[0.1, 0.05], [0.28, 0.22], [0.42, 0.4], [0.5, 0.58], [0.62, 0.75], [0.35, 0.5], [0.2, 0.62], [0.75, 0.55], [0.85, 0.72]],
    seg: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [3, 7], [7, 8]],
  },
  {
    name: "БЛИЗНЕЦЫ",
    pts: [[0.2, 0], [0.7, 0.05], [0.3, 0.28], [0.6, 0.3], [0.38, 0.55], [0.56, 0.55], [0.3, 0.88], [0.68, 0.9]],
    seg: [[0, 2], [1, 3], [2, 3], [2, 4], [3, 5], [4, 5], [4, 6], [5, 7]],
  },
  {
    name: "ДРАКОН",
    pts: [[0, 0.3], [0.14, 0.2], [0.26, 0.3], [0.34, 0.45], [0.3, 0.62], [0.42, 0.72], [0.58, 0.68], [0.72, 0.6], [0.86, 0.66], [1, 0.55]],
    seg: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9]],
  },
  {
    name: "ВОДОЛЕЙ",
    pts: [[0.1, 0.2], [0.28, 0.3], [0.4, 0.22], [0.52, 0.34], [0.62, 0.5], [0.74, 0.62], [0.88, 0.7]],
    seg: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
  },
  {
    name: "ТЕЛЕЦ",
    pts: [[0.05, 0.15], [0.25, 0.3], [0.45, 0.45], [0.7, 0.55], [0.95, 0.7], [0.5, 0.2], [0.62, 0.05]],
    seg: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6]],
  },
  {
    name: "ДЕВА",
    pts: [[0.15, 0.1], [0.35, 0.28], [0.5, 0.45], [0.35, 0.62], [0.6, 0.68], [0.78, 0.85], [0.72, 0.5]],
    seg: [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5], [2, 6], [6, 4]],
  },
  {
    name: "ПЕГАС",
    pts: [[0.15, 0.15], [0.6, 0.1], [0.65, 0.5], [0.2, 0.55], [0, 0.75], [0.85, 0.7]],
    seg: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [2, 5]],
  },
  {
    name: "АНДРОМЕДА",
    pts: [[0.05, 0.7], [0.3, 0.55], [0.55, 0.4], [0.8, 0.28], [0.6, 0.15], [0.75, 0.55]],
    seg: [[0, 1], [1, 2], [2, 3], [2, 4], [2, 5]],
  },
  {
    name: "ЮЖНЫЙ КРЕСТ",
    pts: [[0.5, 0], [0.5, 0.95], [0.08, 0.45], [0.92, 0.5], [0.62, 0.62]],
    seg: [[0, 1], [2, 3]],
  },
  {
    name: "ВОЛОПАС",
    pts: [[0.5, 0], [0.75, 0.25], [0.62, 0.55], [0.36, 0.5], [0.22, 0.25], [0.55, 0.92]],
    seg: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [2, 5]],
  },
  {
    name: "СЕВЕРНАЯ КОРОНА",
    pts: [[0, 0.55], [0.18, 0.32], [0.4, 0.2], [0.62, 0.24], [0.82, 0.42], [0.95, 0.65]],
    seg: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
  },
  {
    name: "ГЕРКУЛЕС",
    pts: [[0.3, 0.18], [0.62, 0.14], [0.68, 0.45], [0.36, 0.5], [0.1, 0.9], [0.88, 0.82]],
    seg: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [2, 5]],
  },
  {
    name: "ОРЁЛ",
    pts: [[0.5, 0], [0.34, 0.3], [0.66, 0.34], [0.5, 0.56], [0.18, 0.82], [0.82, 0.76]],
    seg: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5]],
  },
  {
    name: "СТРЕЛЕЦ",
    pts: [[0.2, 0.3], [0.44, 0.18], [0.7, 0.28], [0.76, 0.55], [0.5, 0.62], [0.24, 0.55], [0.36, 0.88]],
    seg: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [4, 6]],
  },
  {
    name: "РЫБЫ",
    pts: [[0, 0.6], [0.2, 0.45], [0.4, 0.5], [0.6, 0.4], [0.74, 0.2], [0.9, 0.05], [0.64, 0.62], [0.8, 0.78]],
    seg: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [6, 7]],
  },
  {
    name: "ЖИРАФ",
    pts: [[0.1, 0.92], [0.24, 0.72], [0.4, 0.55], [0.5, 0.36], [0.66, 0.2], [0.86, 0.04]],
    seg: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
  },
];

interface CInst {
  c: number;
  x: number;
  y: number;
  s: number;
  rot: number;
  vx: number;
  vy: number;
  ph: number;
  glow: number;
}

const COMET_COLORS = ["#8ff5e9", "#ff9ad5", "#ffd166", "#a5ff8f", "#9ecbff"];
const MILKY_ANG = -0.48;

/* ---------- настоящие кольца Сатурна (2D) ----------
   r — средний радиус в долях радиуса планеты, w — ширина, a — яркость.
   Порядок: C, B (яркое), щель Кассини (пропуск), A со щелью Энке, тонкое F. */
interface RingBand { r: number; w: number; a: number; c: string }
const SATURN_BANDS: RingBand[] = [
  { r: 1.3, w: 0.16, a: 0.3, c: "198,176,138" },   // C — тусклое внутреннее
  { r: 1.52, w: 0.13, a: 0.72, c: "232,206,152" }, // B внутреннее
  { r: 1.7, w: 0.17, a: 0.92, c: "242,218,166" },  // B главное — ярчайшее
  { r: 1.88, w: 0.1, a: 0.68, c: "228,202,150" },  // B внешнее
  // ~1.96–2.03 щель Кассини (не рисуем)
  { r: 2.1, w: 0.13, a: 0.6, c: "222,196,146" },   // A внутреннее
  { r: 2.22, w: 0.1, a: 0.78, c: "236,210,158" },  // A главное
  // ~2.29 щель Энке
  { r: 2.34, w: 0.05, a: 0.5, c: "216,190,142" },  // A внешнее
  { r: 2.46, w: 0.024, a: 0.6, c: "242,222,178" }, // F — тонкое внешнее
];
const RING_TILT = -0.42;
const RING_SQUASH = 0.3;

/** половина колец: back — за планетой (тусклее), front — перед ней */
function drawSaturnRingHalf(ctx: CanvasRenderingContext2D, x: number, y: number, pr: number, back: boolean) {
  ctx.save();
  ctx.lineCap = "butt";
  for (const b of SATURN_BANDS) {
    const alpha = b.a * (back ? 0.5 : 1);
    ctx.strokeStyle = `rgba(${b.c},${alpha.toFixed(3)})`;
    ctx.lineWidth = Math.max(0.6, b.w * pr);
    ctx.beginPath();
    ctx.ellipse(x, y, b.r * pr, b.r * pr * RING_SQUASH, RING_TILT, back ? Math.PI : 0, back ? TAU : Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------- вращающиеся сферы: N кадров поворота на тело ----------
   Геометрия сферы (u/v/освещённость) не зависит от текстуры и от фазы
   поворота, поэтому считается один раз в таблицу; каждый кадр — лишь
   выборка текстуры со сдвигом по долготе. Рендер прогрессивный,
   по 2–3 кадра за rAF, чтобы не дёргать карту. */
const SPR = 128;
const ROT_FRAMES = 16;

interface SphereTable {
  pos: Uint32Array; // индекс пикселя
  col: Uint16Array; // колонка текстуры
  rowOff: Uint32Array; // row * texW
  shade: Float32Array;
  n: number;
}

let TABLE: SphereTable | null = null;

function getSphereTable(texW: number, texH: number, isSun: boolean): SphereTable {
  if (TABLE) return TABLE;
  const lx = -0.5, ly = -0.45, lz = 0.74;
  const ll = Math.hypot(lx, ly, lz);
  const Lx = lx / ll, Ly = ly / ll, Lz = lz / ll;
  const pos = new Uint32Array(SPR * SPR);
  const col = new Uint16Array(SPR * SPR);
  const rowOff = new Uint32Array(SPR * SPR);
  const shade = new Float32Array(SPR * SPR);
  let n = 0;
  for (let y = 0; y < SPR; y++) {
    const dy = ((y + 0.5) / SPR) * 2 - 1;
    for (let x = 0; x < SPR; x++) {
      const dx = ((x + 0.5) / SPR) * 2 - 1;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      const ny = -dy;
      const u = Math.atan2(dx, nz) / TAU + 0.5;
      const v = 0.5 - Math.asin(clamp(ny, -1, 1)) / Math.PI;
      pos[n] = y * SPR + x;
      col[n] = Math.min(texW - 1, Math.floor(u * texW));
      rowOff[n] = Math.min(texH - 1, Math.floor(v * texH)) * texW;
      if (isSun) {
        shade[n] = 0.72 + 0.34 * Math.pow(nz, 0.8);
      } else {
        const diff = Math.max(0, dx * Lx + ny * Ly + nz * Lz);
        shade[n] = 0.07 + 1.02 * Math.pow(diff, 0.82) + Math.pow(diff, 26) * 0.35;
      }
      n++;
    }
  }
  TABLE = {
    pos: pos.slice(0, n),
    col: col.slice(0, n),
    rowOff: rowOff.slice(0, n),
    shade: shade.slice(0, n),
    n,
  };
  return TABLE;
}

/** кадр сферы с фазой поворота k (0..ROT_FRAMES-1) */
function buildFrame(body: BodyData, k: number): HTMLCanvasElement {
  const tex = getTexture(body.id);
  const tab = getSphereTable(tex.w, tex.h, body.id === "sun");
  const cv = document.createElement("canvas");
  cv.width = SPR;
  cv.height = SPR;
  const c2 = cv.getContext("2d")!;
  const img = c2.createImageData(SPR, SPR);
  const out = img.data;
  const src = tex.data;
  const shift = Math.floor((k / ROT_FRAMES) * tex.w);
  const w = tex.w;
  const { pos, col, rowOff, shade, n } = tab;
  for (let i = 0; i < n; i++) {
    const j = (rowOff[i] + ((col[i] + shift) % w)) * 4;
    const o = pos[i] * 4;
    const sh = shade[i];
    out[o] = src[j] * sh;
    out[o + 1] = src[j + 1] * sh;
    out[o + 2] = src[j + 2] * sh;
    out[o + 3] = 255;
  }
  c2.putImageData(img, 0, 0);
  return cv;
}

interface Props {
  playing: boolean;
  speed: number;
  showOrbits: boolean;
  showLabels: boolean;
  selectedId: string | null;
  hoverId: string | null;
  resetToken: number;
  initialDays: number;
  bgTheme: string;
  showUfo: boolean;
  showAstro: boolean;
  earthMsg: string;
  marsMsgs: string[];
  onSelect: (id: string | null) => void;
  onOrbitSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onTick: (days: number) => void;
}

export default function SolarCanvas(props: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef({ simDays: 0 });
  const propsRef = useRef(props);
  propsRef.current = props;

  const firstReset = useRef(true);
  useEffect(() => {
    simRef.current.simDays = props.initialDays;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (firstReset.current) {
      firstReset.current = false;
      return;
    }
    simRef.current.simDays = 0;
  }, [props.resetToken]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let stars: Star[] = [];
    let rocks: Rock[] = [];
    let milky: HTMLCanvasElement | null = null;
    let curBgTheme = "";
    let cInsts: CInst[] = [];
    let cx = 0;
    let cy = 0;
    let hoverId: string | null = null;
    const hoverScales = new Map<string, number>();
    const mouse = { x: -9999, y: -9999 };

    /* ---- вращение тел вокруг оси ---- */
    const ALLBODIES: BodyData[] = [SUN, ...PLANETS];
    const frameCache = new Map<string, HTMLCanvasElement[]>();
    const buildQueue: { body: BodyData; k: number }[] = [];
    const rotPhase = new Map<string, number>(); // обороты
    for (const b of ALLBODIES) {
      frameCache.set(b.id, [buildFrame(b, 0)]);
      rotPhase.set(b.id, Math.random()); // разная начальная фаза
      for (let k = 1; k < ROT_FRAMES; k++) buildQueue.push({ body: b, k });
    }
    const drawSpinFrame = (id: string, x: number, y: number, r: number) => {
      const frames = frameCache.get(id);
      if (!frames || !frames.length) return;
      const ph = rotPhase.get(id) ?? 0;
      let idx = Math.floor(ph * ROT_FRAMES) % frames.length;
      if (idx < 0) idx += frames.length;
      ctx.drawImage(frames[idx], x - r, y - r, r * 2, r * 2);
    };
    const advanceSpin = (dtS: number) => {
      const rate0 = propsRef.current.playing ? propsRef.current.speed : 0;
      for (const b of ALLBODIES) {
        const sd = SPIN_DAYS[b.id] ?? 1;
        // пропорционально реальным суткам, но очень сдержанно:
        // не быстрее одного оборота за ~17 секунд — едва заметное вращение
        const rate = clamp((rate0 / sd) * 0.0012, -0.06, 0.06);
        rotPhase.set(b.id, (rotPhase.get(b.id) ?? 0) + rate * dtS);
      }
    };
    let placed: Placed[] = [];
    let raf = 0;
    let last = performance.now();
    let lastTick = 0;

    /* ---- космические события ---- */
    interface CometT {
      x: number; y: number; vx: number; vy: number;
      age: number; life: number; color: string; size: number; tail: number;
    }
    interface BHole {
      x: number; y: number; age: number; life: number; r: number;
      seeds: { a: number; sp: number; ph: number }[];
      stars: { a: number; dist: number; sp: number; size: number }[];
    }
    interface RocketT { t: number; dir: number; by: number }
    /* постоянное НЛО: парит над Землёй (канат), летит к Марсу (лестница + марсианин) */
    type UfoMode = "earth" | "toMars" | "mars" | "toEarth";
    interface UfoSM {
      mode: UfoMode;
      t: number;        // секунды в фазе удержания
      hold: number;     // длительность контакта 10..25 с
      rope: number;     // 0..1 выпуск каната
      ladder: number;   // 0..1 выпуск лестницы
      martian: number;  // 0..1 спуск марсианина
      wave: number;     // накопленное время махания
      flyT: number;     // 0..1 прогресс перелёта
      fromX: number; fromY: number;
      leaving: boolean;
      x: number; y: number;
      greetIdx: number;
    }
    interface FlashT { x: number; y: number; age: number; life: number; size: number; color: string }
    interface NovaT { x: number; y: number; age: number; life: number }
    interface DiskT { x: number; y: number; age: number; life: number; tilt: number; seed: number }
    interface ShowerT { x: number; y: number; dx: number; dy: number; sp: number; remaining: number; acc: number }

    let comets: CometT[] = [];
    let meteors: { x: number; y: number; vx: number; vy: number; age: number }[] = [];
    let ripples: { x: number; y: number; age: number }[] = [];
    let flashes: FlashT[] = [];
    let novas: NovaT[] = [];
    let disks: DiskT[] = [];
    let showers: ShowerT[] = [];
    let bh: BHole | null = null;
    let rocket: RocketT | null = null;

    /* ---- комета, летящая в Млечный Путь и сталкивающаяся со звездой ---- */
    interface BandCometT { x: number; y: number; vx: number; vy: number; starIdx: number }
    let bandComet: BandCometT | null = null;
    let impacts: { x: number; y: number; age: number; life: number }[] = [];
    const deadStars = new Map<number, number>(); // индекс звезды -> момент гибели
    let nextBandComet = 5;

    /* постоянное НЛО + позиции Земли/Марса */
    let earthPos: { x: number; y: number; r: number } | null = null;
    let marsPos: { x: number; y: number; r: number } | null = null;
    let ufo: UfoSM = {
      mode: "earth",
      t: 0,
      hold: 10 + Math.random() * 15,
      rope: 0,
      ladder: 0,
      martian: 0,
      wave: 0,
      flyT: 0,
      fromX: 0,
      fromY: 0,
      leaving: false,
      x: -9999,
      y: -9999,
      greetIdx: 0,
    };
    /* астронавт с кораблём: летает между планетами, приземляется, бурит, улетает */
    type AstroMode = "idle" | "toPlanet" | "landing" | "surface" | "takeoff";
    interface AstronautSM {
      mode: AstroMode;
      targetIdx: number; // индекс цели в PLANETS
      t: number;         // время в текущей фазе
      hold: number;      // длительность пребывания на поверхности (20-40 с)
      drill: number;     // 0..1 прогресс бурения
      flyT: number;      // 0..1 прогресс перелёта
      fromX: number;
      fromY: number;
      x: number;
      y: number;
      angle: number;     // угол наклона ракеты
      leaveT: number;    // время до взлёта
    }
    let astronaut: AstronautSM = {
      mode: "idle",
      targetIdx: 0,
      t: 0,
      hold: 20,
      drill: 0,
      flyT: 0,
      fromX: 0,
      fromY: 0,
      x: -9999,
      y: -9999,
      angle: 0,
      leaveT: 0,
    };
    let sunFlares: { a: number; t0: number; dur: number }[] = [];
    let sunPulses: { t0: number }[] = [];
    let worldT = 0;
    let nextComet = 2;
    let nextMeteor = 0.8;
    let nextShower = 12;
    let nextUfo = 7;
    let nextRocket = 15;
    let nextBH = 24;
    let nextNova = 18;
    let nextDisk = 6;
    let nextFlare = 1;
    let nextPulse = 2;

    const spawnComet = () => {
      let x: number, y: number;
      const side = Math.floor(Math.random() * 4);
      if (side === 0) { x = -40; y = Math.random() * H; }
      else if (side === 1) { x = W + 40; y = Math.random() * H; }
      else if (side === 2) { x = Math.random() * W; y = -40; }
      else { x = Math.random() * W; y = H + 40; }
      const sp = 55 + Math.random() * 40;
      const tx = W - x + (Math.random() - 0.5) * W * 0.8;
      const ty = H - y + (Math.random() - 0.5) * H * 0.8;
      const l = Math.hypot(tx, ty) || 1;
      comets.push({
        x, y, vx: (tx / l) * sp, vy: (ty / l) * sp, age: 0, life: 14,
        color: COMET_COLORS[Math.floor(Math.random() * COMET_COLORS.length)],
        size: 2.4 + Math.random() * 1.8, tail: 70 + Math.random() * 50,
      });
    };

    /* ================= постоянное НЛО: Земля ↔ Марс ================= */
    const UFO_GREETINGS = [
      "Привет, Дамир и Алия!",
      "Салют с Марса, Дамир и Алия!",
      "Дамир и Алия, вы лучшие!",
      "Марсианин шлёт привет Дамиру и Алие!",
    ];
    const approach = (v: number, target: number, rate: number, d: number) =>
      v < target ? Math.min(target, v + rate * d) : Math.max(target, v - rate * d);
    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    const stepUfo = (d: number) => {
      const ep = earthPos;
      const mp = marsPos;
      if (!ep || !mp) return;
      const ehx = ep.x;
      const ehy = ep.y - ep.r - 46;
      const mhx = mp.x;
      const mhy = mp.y - mp.r - 46;
      const bob = Math.sin(worldT * 2) * 4;
      const u = ufo;

      if (u.mode === "earth") {
        u.x = ehx;
        u.y = ehy + bob;
        if (!u.leaving) {
          u.rope = approach(u.rope, 1, 0.55, d);
          if (u.rope >= 1) {
            u.t += d;
            if (u.t >= u.hold) u.leaving = true;
          }
        } else {
          u.rope = approach(u.rope, 0, 0.7, d);
          if (u.rope <= 0) {
            u.mode = "toMars";
            u.flyT = 0;
            u.fromX = u.x;
            u.fromY = u.y;
            u.t = 0;
            u.leaving = false;
          }
        }
      } else if (u.mode === "toMars") {
        u.flyT = Math.min(1, u.flyT + d / 4);
        const e = easeInOut(u.flyT);
        const arc = -80 * Math.sin(Math.PI * e);
        u.x = u.fromX + (mhx - u.fromX) * e;
        u.y = u.fromY + (mhy - u.fromY) * e + arc;
        if (u.flyT >= 1) {
          u.mode = "mars";
          u.t = 0;
          u.hold = 10 + Math.random() * 15;
          u.greetIdx = (u.greetIdx + 1) % UFO_GREETINGS.length;
        }
      } else if (u.mode === "mars") {
        u.x = mhx;
        u.y = mhy + bob;
        if (!u.leaving) {
          u.ladder = approach(u.ladder, 1, 0.55, d);
          if (u.ladder >= 1) {
            u.martian = approach(u.martian, 1, 0.5, d);
            if (u.martian >= 1) {
              u.t += d;
              u.wave += d;
              if (u.t >= u.hold) u.leaving = true;
            }
          }
        } else {
          u.martian = approach(u.martian, 0, 0.7, d);
          if (u.martian <= 0) {
            u.ladder = approach(u.ladder, 0, 0.7, d);
            if (u.ladder <= 0) {
              u.mode = "toEarth";
              u.flyT = 0;
              u.fromX = u.x;
              u.fromY = u.y;
              u.t = 0;
              u.wave = 0;
              u.leaving = false;
            }
          }
        }
      } else {
        // toEarth
        u.flyT = Math.min(1, u.flyT + d / 4);
        const e = easeInOut(u.flyT);
        const arc = -80 * Math.sin(Math.PI * e);
        u.x = u.fromX + (ehx - u.fromX) * e;
        u.y = u.fromY + (ehy - u.fromY) * e + arc;
        if (u.flyT >= 1) {
          u.mode = "earth";
          u.t = 0;
          u.rope = 0;
          u.hold = 10 + Math.random() * 15;
        }
      }
    };

    /* ================= астронавт: выбор цели, полёт, посадка, бурение ================= */
    const stepAstronaut = (d: number) => {
      const a = astronaut;

      // Первый полёт начинается сразу, чтобы включённый астронавт был виден.
      if (a.mode === "idle") {
        a.mode = "toPlanet";
        a.targetIdx = Math.floor(Math.random() * PLANETS.length);
        a.flyT = 0;
        a.fromX = cx;
        a.fromY = cy - (placed.find((body) => body.id === SUN.id)?.r ?? 20) - 40;
        a.t = 0;
      }

      // Используем те же экранные координаты и радиус, что и при отрисовке планеты.
      const target = placed.find((body) => body.id === PLANETS[a.targetIdx].id);
      if (!target) return;
      const hoverY = target.y - target.r - 35;
      const landY = target.y - target.r - 9;

      if (a.mode === "toPlanet") {
        a.flyT = Math.min(1, a.flyT + d / 3);
        const e = easeInOut(a.flyT);
        const arc = -50 * Math.sin(Math.PI * e);
        a.x = a.fromX + (target.x - a.fromX) * e;
        a.y = a.fromY + (hoverY - a.fromY) * e + arc;
        a.angle = Math.atan2(hoverY - a.fromY, target.x - a.fromX) * 0.3;

        if (a.flyT >= 1) {
          a.mode = "landing";
          a.t = 0;
        }
      } else if (a.mode === "landing") {
        a.t += d;
        const progress = Math.min(1, a.t / 2);
        a.x = target.x + Math.sin(progress * Math.PI) * 8;
        a.y = hoverY + (landY - hoverY) * progress;
        a.angle = 0;
        if (progress >= 1) {
          a.mode = "surface";
          a.t = 0;
          a.hold = 20 + Math.random() * 20;
          a.drill = 0;
        }
      } else if (a.mode === "surface") {
        // После посадки следуем за планетой, пока она движется по орбите.
        a.x = target.x;
        a.y = landY;
        a.t += d;
        a.drill = Math.min(1, a.t / a.hold);
        if (a.t >= a.hold) {
          a.mode = "takeoff";
          a.t = 0;
          a.leaveT = 3;
          a.fromX = a.x;
          a.fromY = a.y;
        }
      } else if (a.mode === "takeoff") {
        a.t += d;
        const progress = Math.min(1, a.t / a.leaveT);
        // Отсчёт от точки взлёта, а не прибавление смещения каждый кадр.
        a.x = a.fromX + Math.sin(progress * Math.PI) * 15;
        a.y = a.fromY - progress * 50;
        a.angle = -0.2;
        if (progress >= 1) {
          a.mode = "toPlanet";
          a.flyT = 0;
          a.fromX = a.x;
          a.fromY = a.y;
          a.targetIdx = (a.targetIdx + 1 + Math.floor(Math.random() * (PLANETS.length - 1))) % PLANETS.length;
          a.t = 0;
        }
      }
    };

    /** пузырь с автопереносом строк; якорь — точка, к которой ведёт хвостик */
    const drawShipBubble = (
      ax: number,
      ay: number,
      text: string,
      opt: { border: string; color: string; bg: string; tailDx: number }
    ) => {
      const msg = text.trim();
      if (!msg) return;
      ctx.save();
      ctx.font = '600 24px "IBM Plex Sans", sans-serif';
      const maxW = Math.min(400, W * 0.62);
      // перенос по словам
      const words = msg.split(/\s+/);
      const lines: string[] = [];
      let cur = "";
      for (const w of words) {
        const test = cur ? cur + " " + w : w;
        if (ctx.measureText(test).width > maxW && cur) {
          lines.push(cur);
          cur = w;
        } else cur = test;
      }
      if (cur) lines.push(cur);
      const lh = 31;
      const padX = 20;
      let wMax = 0;
      for (const l of lines) wMax = Math.max(wMax, ctx.measureText(l).width);
      const bw = wMax + padX * 2;
      const bh = lines.length * lh + 26;
      // сторона — от края экрана, чтобы не налезть на корабль
      const toRight = ax < W / 2;
      const gapX = 42;
      let bx = toRight ? ax + gapX : ax - gapX - bw;
      bx = clamp(bx, 10, W - bw - 10);
      let by = ay - bh / 2 - 14;
      by = clamp(by, 10, H - bh - 10);
      ctx.fillStyle = opt.bg;
      ctx.strokeStyle = opt.border;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      const rr2 = Math.min(12, bw / 2, bh / 2);
      ctx.moveTo(bx + rr2, by);
      ctx.arcTo(bx + bw, by, bx + bw, by + bh, rr2);
      ctx.arcTo(bx + bw, by + bh, bx, by + bh, rr2);
      ctx.arcTo(bx, by + bh, bx, by, rr2);
      ctx.arcTo(bx, by, bx + bw, by, rr2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // хвостик к якорю
      const tailX = toRight ? bx : bx + bw;
      const ty = clamp(ay, by + 14, by + bh - 14);
      ctx.beginPath();
      ctx.moveTo(tailX, ty - 8);
      ctx.lineTo(ax + opt.tailDx, ay);
      ctx.lineTo(tailX, ty + 8);
      ctx.closePath();
      ctx.fill();
      // текст
      ctx.fillStyle = opt.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      lines.forEach((l, i) => ctx.fillText(l, bx + bw / 2, by + 14 + lh / 2 + i * lh));
      ctx.restore();
    };

    const drawUfo = () => {
      const ep = earthPos;
      const mp = marsPos;
      if (!ep || !mp) return;
      const u = ufo;
      const p = propsRef.current;

      // канат к Земле
      if (u.mode === "earth" && u.rope > 0.02) {
        const topY = u.y + 8;
        const endY = topY + (ep.y - ep.r - topY) * u.rope;
        ctx.save();
        ctx.strokeStyle = "rgba(223,231,245,0.75)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(u.x, topY);
        ctx.lineTo(u.x, endY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#ffb547";
        ctx.beginPath();
        ctx.arc(u.x, endY, 2.4, 0, TAU);
        ctx.fill();
        ctx.restore();

        // приветствие корабля, пока канат спущен и идёт контакт (марсианин не виден)
        if (u.rope >= 0.98 && !u.leaving) {
          drawShipBubble(u.x, u.y, p.earthMsg, {
            border: "rgba(255,181,71,0.65)",
            color: "#ffd98f",
            bg: "rgba(24,16,4,0.92)",
            tailDx: 6,
          });
        }
      }

      // лестница к Марсу + марсианин
      if (u.mode === "mars" && u.ladder > 0.02) {
        const topY = u.y + 8;
        const groundY = mp.y - mp.r;
        const endY = topY + (groundY - topY) * u.ladder;
        const rungs = Math.floor((endY - topY) / 9);
        ctx.save();
        ctx.strokeStyle = "rgba(200,214,235,0.8)";
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(u.x - 4, topY);
        ctx.lineTo(u.x - 4, endY);
        ctx.moveTo(u.x + 4, topY);
        ctx.lineTo(u.x + 4, endY);
        ctx.stroke();
        for (let i = 1; i <= rungs; i++) {
          const ry = topY + i * 9;
          ctx.beginPath();
          ctx.moveTo(u.x - 4, ry);
          ctx.lineTo(u.x + 4, ry);
          ctx.stroke();
        }
        ctx.restore();

        // марсианин-мальчик спускается и машет
        if (u.martian > 0.02) {
          const my = topY + (groundY - 14 - topY) * u.martian;
          const onGround = u.martian >= 0.98;
          const wave = onGround ? Math.sin(u.wave * 7) * 0.9 : 0;
          drawMartian(u.x + 12, my, wave, onGround);
          if (onGround) {
            const msgs = p.marsMsgs.length ? p.marsMsgs : UFO_GREETINGS;
            const msg = msgs[u.greetIdx % msgs.length];
            drawShipBubble(u.x + 12, my - 10, msg, {
              border: "rgba(111,224,138,0.65)",
              color: "#9fe8b0",
              bg: "rgba(10,16,32,0.92)",
              tailDx: 8,
            });
          }
        }
      }

      // сам корабль
      drawDish(u.x, u.y);
    };

    const drawMartian = (x: number, y: number, wave: number, onGround: boolean) => {
      ctx.save();
      ctx.translate(x, y);
      // тело
      ctx.fillStyle = "#6fe08a";
      ctx.beginPath();
      ctx.ellipse(0, 6, 5, 7, 0, 0, TAU);
      ctx.fill();
      // ноги
      ctx.strokeStyle = "#4fae66";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-2.5, 12);
      ctx.lineTo(-3.5, 17);
      ctx.moveTo(2.5, 12);
      ctx.lineTo(3.5, 17);
      ctx.stroke();
      // левая рука
      ctx.beginPath();
      ctx.moveTo(-5, 5);
      ctx.lineTo(-9, 9);
      ctx.stroke();
      // правая рука — машет
      ctx.save();
      ctx.translate(5, 4);
      ctx.rotate(-1.1 + wave);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(7, 0);
      ctx.stroke();
      // ладонь
      ctx.fillStyle = "#8ff0a8";
      ctx.beginPath();
      ctx.arc(7, 0, 1.8, 0, TAU);
      ctx.fill();
      ctx.restore();
      // голова
      ctx.fillStyle = "#6fe08a";
      ctx.beginPath();
      ctx.arc(0, -4, 6, 0, TAU);
      ctx.fill();
      // глаза
      ctx.fillStyle = "#0a2812";
      const blink = onGround && Math.sin(worldT * 3) > 0.96 ? 0.3 : 1.6;
      ctx.beginPath();
      ctx.ellipse(-2.4, -5, 1.5, blink, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(2.4, -5, 1.5, blink, 0, 0, TAU);
      ctx.fill();
      // блики в глазах
      ctx.fillStyle = "#c9ffe0";
      ctx.beginPath();
      ctx.arc(-2, -5.6, 0.5, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(2.8, -5.6, 0.5, 0, TAU);
      ctx.fill();
      // улыбка
      ctx.strokeStyle = "#0a2812";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, -2.4, 2.4, 0.2, Math.PI - 0.2);
      ctx.stroke();
      // антеннки
      ctx.strokeStyle = "#4fae66";
      ctx.beginPath();
      ctx.moveTo(-2, -9.5);
      ctx.lineTo(-3.5, -13);
      ctx.moveTo(2, -9.5);
      ctx.lineTo(3.5, -13);
      ctx.stroke();
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.arc(-3.5, -13, 1.3, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(3.5, -13, 1.3, 0, TAU);
      ctx.fill();
      ctx.restore();
    };

    const drawDish = (x: number, y: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(worldT * 1.6) * 0.05);
      // двигательное свечение
      const eng = ctx.createRadialGradient(0, 9, 1, 0, 9, 20);
      eng.addColorStop(0, "rgba(140,255,230,0.32)");
      eng.addColorStop(1, "rgba(140,255,230,0)");
      ctx.fillStyle = eng;
      ctx.beginPath();
      ctx.ellipse(0, 9, 20, 8, 0, 0, TAU);
      ctx.fill();
      // нижний обтекатель
      const under = ctx.createLinearGradient(0, 0, 0, 9);
      under.addColorStop(0, "#48536e");
      under.addColorStop(1, "#232b40");
      ctx.fillStyle = under;
      ctx.beginPath();
      ctx.ellipse(0, 3.5, 17, 5.5, 0, 0, Math.PI);
      ctx.fill();
      // основной диск
      const bodyG = ctx.createLinearGradient(0, -8, 0, 6);
      bodyG.addColorStop(0, "#c6d3ea");
      bodyG.addColorStop(0.45, "#8f9fc0");
      bodyG.addColorStop(1, "#3f4b68");
      ctx.fillStyle = bodyG;
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 7.5, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(18,26,44,0.85)";
      ctx.lineWidth = 1;
      ctx.stroke();
      // швы
      ctx.strokeStyle = "rgba(30,40,62,0.5)";
      ctx.lineWidth = 0.6;
      for (let i = 0; i < 5; i++) {
        const sx = -18 + i * 9;
        ctx.beginPath();
        ctx.moveTo(sx, -5.6);
        ctx.lineTo(sx * 0.92, 5.2);
        ctx.stroke();
      }
      // блик
      ctx.strokeStyle = "rgba(235,245,255,0.55)";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.ellipse(0, -0.6, 24.5, 6.4, 0, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
      // верхняя палуба
      const deck = ctx.createLinearGradient(0, -9, 0, -2);
      deck.addColorStop(0, "#aebdd8");
      deck.addColorStop(1, "#6f7f9f");
      ctx.fillStyle = deck;
      ctx.beginPath();
      ctx.ellipse(0, -3.5, 14, 4.5, 0, Math.PI, TAU);
      ctx.fill();
      // купол
      const dgd = ctx.createRadialGradient(-3, -9, 1, 0, -6, 11);
      dgd.addColorStop(0, "rgba(220,250,255,0.95)");
      dgd.addColorStop(0.6, "rgba(150,225,235,0.55)");
      dgd.addColorStop(1, "rgba(90,200,210,0.2)");
      ctx.fillStyle = dgd;
      ctx.beginPath();
      ctx.arc(0, -4.5, 8, Math.PI, 0);
      ctx.fill();
      // антенна
      ctx.strokeStyle = "#c0cbe0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(0, -17);
      ctx.stroke();
      ctx.fillStyle = Math.sin(worldT * 7) > 0 ? "#ff5d5d" : "#7a2a2a";
      ctx.beginPath();
      ctx.arc(0, -18, 1.4, 0, TAU);
      ctx.fill();
      // огни по ободу
      const lcols = ["#ffd166", "#8ff5e9", "#ff9ad5", "#9ecbff"];
      for (let i = 0; i < 7; i++) {
        const on = Math.sin(worldT * 6 + i * 1.5) > 0;
        const lx = -21 + i * 7;
        ctx.fillStyle = on ? lcols[i % 4] : "rgba(90,110,150,0.5)";
        ctx.beginPath();
        ctx.arc(lx, 3.4, on ? 1.9 : 1.2, 0, TAU);
        ctx.fill();
        if (on) {
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.arc(lx, 3.4, 4, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
    };

    /* ================= отрисовка астронавта с ракетой ================= */
    const drawAstronaut = () => {
      const a = astronaut;
      if (!propsRef.current.showAstro) return;
      
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.angle);
      
      // пламя двигателя (при полёте и взлёте)
      if (a.mode === "toPlanet" || a.mode === "takeoff") {
        const flicker = Math.sin(worldT * 20) * 3 + Math.cos(worldT * 13) * 2;
        const flameGrad = ctx.createLinearGradient(-12, 0, -28 - flicker, 0);
        flameGrad.addColorStop(0, "#fff7d0");
        flameGrad.addColorStop(0.3, "#ffb547");
        flameGrad.addColorStop(0.7, "#ff6b35");
        flameGrad.addColorStop(1, "rgba(255,100,50,0)");
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.moveTo(-10, -4);
        ctx.lineTo(-28 - flicker, 0);
        ctx.lineTo(-10, 4);
        ctx.closePath();
        ctx.fill();
        
        // внутреннее яркое ядро пламени
        const coreFlicker = Math.sin(worldT * 25) * 2;
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.beginPath();
        ctx.moveTo(-10, -2);
        ctx.lineTo(-18 - coreFlicker, 0);
        ctx.lineTo(-10, 2);
        ctx.closePath();
        ctx.fill();
      }
      
      // корпус ракеты
      const rocketBody = ctx.createLinearGradient(-12, -5, -12, 5);
      rocketBody.addColorStop(0, "#e8ecf5");
      rocketBody.addColorStop(0.5, "#b8c5d8");
      rocketBody.addColorStop(1, "#8a9ab0");
      ctx.fillStyle = rocketBody;
      ctx.beginPath();
      ctx.moveTo(-12, -5);
      ctx.lineTo(8, -5);
      // носовой обтекатель
      ctx.quadraticCurveTo(14, -5, 14, 0);
      ctx.quadraticCurveTo(14, 5, 8, 5);
      ctx.lineTo(-12, 5);
      ctx.closePath();
      ctx.fill();
      
      // тёмная полоса вдоль корпуса
      ctx.strokeStyle = "rgba(60,70,90,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(6, 0);
      ctx.stroke();
      
      // иллюминатор с астронавтом внутри
      const windowGrad = ctx.createRadialGradient(2, 0, 1, 2, 0, 4);
      windowGrad.addColorStop(0, "rgba(180,220,255,0.9)");
      windowGrad.addColorStop(0.7, "rgba(100,160,220,0.6)");
      windowGrad.addColorStop(1, "rgba(60,100,160,0.3)");
      ctx.fillStyle = windowGrad;
      ctx.beginPath();
      ctx.arc(2, 0, 3.5, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(50,70,100,0.6)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      
      // силуэт астронавта в иллюминаторе
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(2, -0.5, 1.8, 0, TAU); // шлем
      ctx.fill();
      ctx.fillStyle = "rgba(200,220,240,0.7)";
      ctx.beginPath();
      ctx.arc(2, 1.5, 1.2, 0, TAU); // скафандр
      ctx.fill();
      
      // стабилизаторы
      ctx.fillStyle = "#7a8898";
      ctx.beginPath();
      ctx.moveTo(-8, -5);
      ctx.lineTo(-4, -7);
      ctx.lineTo(0, -5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-8, 5);
      ctx.lineTo(-4, 7);
      ctx.lineTo(0, 5);
      ctx.closePath();
      ctx.fill();
      
      // антенна
      ctx.strokeStyle = "#9aa8b8";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(-6, -4);
      ctx.lineTo(-8, -9);
      ctx.stroke();
      ctx.fillStyle = "#ff6b6b";
      ctx.beginPath();
      ctx.arc(-8, -9, 1, 0, TAU);
      ctx.fill();
      
      // блик на корпусе
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-8, -3);
      ctx.lineTo(4, -3);
      ctx.stroke();
      
      ctx.restore();
      
      // подпись статуса (опционально)
      if (a.mode === "surface" && a.drill > 0.3) {
        ctx.font = '500 9px "JetBrains Mono", monospace';
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(140,255,230,0.9)";
        const drillText = a.drill >= 1 ? "ГОТОВО" : `БУРЕНИЕ ${Math.round(a.drill * 100)}%`;
        ctx.fillText(drillText, a.x, a.y - 25);
      }
    };

    /* ---- тематический фон (пререндер) ---- */
    const renderBg = (theme: string) => {
      const diag = Math.hypot(W, H);
      const mw = document.createElement("canvas");
      const dprM = Math.min(window.devicePixelRatio || 1, 2);
      mw.width = Math.round(W * dprM);
      mw.height = Math.round(H * dprM);
      const mctx = mw.getContext("2d");
      if (!mctx) return;
      mctx.setTransform(dprM, 0, 0, dprM, 0, 0);
      const cr = mulberry32(90210);
      const m = Math.min(W, H);

      const milkyBand = (alphaMul: number) => {
        mctx.save();
        mctx.translate(W / 2, H / 2);
        mctx.rotate(MILKY_ANG);
        const bandW = diag * 0.34;
        const lg = mctx.createLinearGradient(0, -bandW, 0, bandW);
        lg.addColorStop(0, "rgba(160,185,235,0)");
        lg.addColorStop(0.3, `rgba(160,185,235,${(0.05 * alphaMul).toFixed(3)})`);
        lg.addColorStop(0.5, `rgba(190,205,240,${(0.1 * alphaMul).toFixed(3)})`);
        lg.addColorStop(0.7, `rgba(160,185,235,${(0.05 * alphaMul).toFixed(3)})`);
        lg.addColorStop(1, "rgba(160,185,235,0)");
        mctx.fillStyle = lg;
        mctx.fillRect(-diag, -bandW, diag * 2, bandW * 2);
        for (let i = 0; i < 70; i++) {
          const bx = (cr() - 0.5) * diag * 1.8;
          const by = (cr() - 0.5) * bandW * 1.15;
          const br2 = 30 + cr() * 95;
          const warm = cr() > 0.75;
          const g = mctx.createRadialGradient(bx, by, 0, bx, by, br2);
          g.addColorStop(0, warm ? `rgba(235,205,170,${(0.06 * alphaMul).toFixed(3)})` : `rgba(175,195,240,${(0.055 * alphaMul).toFixed(3)})`);
          g.addColorStop(1, "rgba(175,195,240,0)");
          mctx.fillStyle = g;
          mctx.beginPath();
          mctx.arc(bx, by, br2, 0, TAU);
          mctx.fill();
        }
        mctx.globalCompositeOperation = "multiply";
        for (let i = 0; i < 26; i++) {
          const bx = (cr() - 0.5) * diag * 1.7;
          const by = (cr() - 0.5) * bandW * 0.7;
          const br2 = 18 + cr() * 55;
          const g = mctx.createRadialGradient(bx, by, 0, bx, by, br2);
          g.addColorStop(0, "rgba(6,9,18,0.5)");
          g.addColorStop(1, "rgba(6,9,18,0)");
          mctx.fillStyle = g;
          mctx.beginPath();
          mctx.arc(bx, by, br2, 0, TAU);
          mctx.fill();
        }
        mctx.globalCompositeOperation = "source-over";
        for (let i = 0; i < 240; i++) {
          const bx = (cr() - 0.5) * diag * 1.9;
          const by = (cr() - 0.5) * bandW * 1.2 * Math.pow(cr(), 0.6) * (cr() > 0.5 ? 1 : -1);
          mctx.globalAlpha = (0.12 + cr() * 0.4) * alphaMul;
          mctx.fillStyle = cr() > 0.8 ? "#ffe9c8" : "#dfe8ff";
          mctx.beginPath();
          mctx.arc(bx, by, 0.4 + cr() * 1.1, 0, TAU);
          mctx.fill();
        }
        mctx.globalAlpha = 1;
        mctx.restore();
      };

      if (theme === "gargantua") {
        /* Гаргантуа: чёрная дыра с раскалённым аккреционным диском */
        milkyBand(0.35);
        const gx = W * 0.68;
        const gy = H * 0.4;
        const R = m * 0.21;
        // тёплое зарево
        const glow = mctx.createRadialGradient(gx, gy, R * 0.4, gx, gy, R * 3.6);
        glow.addColorStop(0, "rgba(255,170,80,0.32)");
        glow.addColorStop(0.35, "rgba(255,130,50,0.14)");
        glow.addColorStop(1, "rgba(255,120,40,0)");
        mctx.fillStyle = glow;
        mctx.fillRect(0, 0, W, H);
        mctx.save();
        mctx.translate(gx, gy);
        mctx.rotate(-0.12);
        // диск: слои от белого ядра к красному краю
        const layers: [number, number, string, number][] = [
          [2.05, 0.34, "rgba(120,40,20,0.5)", 0.55],
          [1.8, 0.3, "rgba(210,90,30,0.65)", 0.7],
          [1.55, 0.26, "rgba(255,150,60,0.8)", 0.85],
          [1.32, 0.2, "rgba(255,200,120,0.9)", 1],
          [1.14, 0.13, "rgba(255,240,210,0.95)", 1],
        ];
        for (const [rx, ry, col, al] of layers) {
          mctx.globalAlpha = al;
          mctx.strokeStyle = col;
          mctx.lineWidth = R * 0.09;
          mctx.beginPath();
          mctx.ellipse(0, 0, R * rx, R * ry, 0, 0, TAU);
          mctx.stroke();
        }
        mctx.globalAlpha = 1;
        // линзированный «козырёк» над дырой
        mctx.strokeStyle = "rgba(255,225,180,0.85)";
        mctx.lineWidth = R * 0.07;
        mctx.beginPath();
        mctx.ellipse(0, -R * 0.18, R * 1.42, R * 0.62, 0, Math.PI * 1.06, Math.PI * 1.94);
        mctx.stroke();
        mctx.strokeStyle = "rgba(255,170,90,0.4)";
        mctx.lineWidth = R * 0.16;
        mctx.beginPath();
        mctx.ellipse(0, -R * 0.18, R * 1.42, R * 0.62, 0, Math.PI * 1.1, Math.PI * 1.9);
        mctx.stroke();
        // фотонное кольцо
        mctx.strokeStyle = "rgba(255,235,200,0.9)";
        mctx.lineWidth = R * 0.035;
        mctx.beginPath();
        mctx.ellipse(0, 0, R * 1.03, R * 0.98, 0, 0, TAU);
        mctx.stroke();
        mctx.restore();
        // чёрное ядро (поверх диска)
        const core = mctx.createRadialGradient(gx, gy, R * 0.6, gx, gy, R * 1.06);
        core.addColorStop(0, "rgba(0,0,0,1)");
        core.addColorStop(0.85, "rgba(0,0,0,1)");
        core.addColorStop(1, "rgba(0,0,0,0)");
        mctx.fillStyle = core;
        mctx.beginPath();
        mctx.arc(gx, gy, R * 1.06, 0, TAU);
        mctx.fill();
      } else if (theme === "wormhole") {
        /* Червоточина: сферическая «линза» с кольцами искажения */
        milkyBand(0.55);
        const wx = W * 0.68;
        const wy = H * 0.42;
        const R = m * 0.17;
        const glow = mctx.createRadialGradient(wx, wy, R * 0.3, wx, wy, R * 3);
        glow.addColorStop(0, "rgba(120,235,225,0.22)");
        glow.addColorStop(0.5, "rgba(110,150,235,0.1)");
        glow.addColorStop(1, "rgba(110,150,235,0)");
        mctx.fillStyle = glow;
        mctx.fillRect(0, 0, W, H);
        // искажённые звёзды вокруг сферы — радиальные штрихи
        for (let i = 0; i < 130; i++) {
          const a = cr() * TAU;
          const rr2 = R * (1.08 + Math.pow(cr(), 1.6) * 1.5);
          const len = 3 + cr() * 14;
          const x1 = wx + Math.cos(a) * rr2;
          const y1 = wy + Math.sin(a) * rr2;
          mctx.strokeStyle = `rgba(200,225,255,${(0.1 + cr() * 0.3).toFixed(2)})`;
          mctx.lineWidth = 0.7;
          mctx.beginPath();
          mctx.moveTo(x1, y1);
          mctx.lineTo(x1 + Math.cos(a) * len, y1 + Math.sin(a) * len);
          mctx.stroke();
        }
        // кольца линзы
        for (let i = 0; i < 9; i++) {
          const t = i / 9;
          const rr3 = R * (1 - t * 0.86);
          const hue = t < 0.5 ? "140,235,225" : "150,160,240";
          mctx.strokeStyle = `rgba(${hue},${(0.12 + 0.2 * Math.sin(t * 9 + 1)).toFixed(2)})`;
          mctx.lineWidth = 1 + t * 1.6;
          mctx.beginPath();
          mctx.arc(wx, wy, rr3, 0, TAU);
          mctx.stroke();
        }
        // стеклянное ядро
        const sph = mctx.createRadialGradient(wx - R * 0.3, wy - R * 0.35, R * 0.05, wx, wy, R);
        sph.addColorStop(0, "rgba(235,255,252,0.85)");
        sph.addColorStop(0.25, "rgba(150,230,225,0.35)");
        sph.addColorStop(0.7, "rgba(70,110,190,0.16)");
        sph.addColorStop(1, "rgba(40,60,130,0.05)");
        mctx.fillStyle = sph;
        mctx.beginPath();
        mctx.arc(wx, wy, R, 0, TAU);
        mctx.fill();
      } else if (theme === "ice") {
        /* Ледяная мгла: бледный горизонт, облака, тёмное небо */
        milkyBand(0.25);
        const hz = mctx.createLinearGradient(0, H * 0.5, 0, H);
        hz.addColorStop(0, "rgba(190,215,238,0)");
        hz.addColorStop(0.55, "rgba(205,226,244,0.1)");
        hz.addColorStop(1, "rgba(228,240,250,0.3)");
        mctx.fillStyle = hz;
        mctx.fillRect(0, H * 0.5, W, H * 0.5);
        // мягкие облачные гряды
        for (let i = 0; i < 26; i++) {
          const bx = cr() * W;
          const by = H * (0.62 + cr() * 0.36);
          const bw = 60 + cr() * 190;
          const bh = 12 + cr() * 26;
          const g = mctx.createRadialGradient(bx, by, 0, bx, by, bw);
          g.addColorStop(0, `rgba(235,244,252,${(0.05 + cr() * 0.08).toFixed(3)})`);
          g.addColorStop(1, "rgba(235,244,252,0)");
          mctx.fillStyle = g;
          mctx.save();
          mctx.translate(bx, by);
          mctx.scale(1, bh / bw);
          mctx.beginPath();
          mctx.arc(0, 0, bw, 0, TAU);
          mctx.fill();
          mctx.restore();
        }
        // холодное сияние сверху
        const au = mctx.createLinearGradient(0, 0, 0, H * 0.5);
        au.addColorStop(0, "rgba(90,140,190,0.12)");
        au.addColorStop(1, "rgba(90,140,190,0)");
        mctx.fillStyle = au;
        mctx.fillRect(0, 0, W, H * 0.5);
      } else if (theme === "nebula") {
        /* Туманность: богатые цветные облака */
        milkyBand(0.8);
        const cols = ["255,150,210", "110,225,215", "255,190,120", "130,160,255", "255,120,140"];
        for (let i = 0; i < 34; i++) {
          const bx = cr() * W;
          const by = cr() * H;
          const br2 = 60 + cr() * 220;
          const col = cols[Math.floor(cr() * cols.length)];
          const g = mctx.createRadialGradient(bx, by, 0, bx, by, br2);
          g.addColorStop(0, `rgba(${col},${(0.05 + cr() * 0.08).toFixed(3)})`);
          g.addColorStop(1, `rgba(${col},0)`);
          mctx.fillStyle = g;
          mctx.beginPath();
          mctx.arc(bx, by, br2, 0, TAU);
          mctx.fill();
        }
        mctx.globalCompositeOperation = "multiply";
        for (let i = 0; i < 18; i++) {
          const bx = cr() * W;
          const by = cr() * H;
          const br2 = 30 + cr() * 110;
          const g = mctx.createRadialGradient(bx, by, 0, bx, by, br2);
          g.addColorStop(0, "rgba(8,10,22,0.42)");
          g.addColorStop(1, "rgba(8,10,22,0)");
          mctx.fillStyle = g;
          mctx.beginPath();
          mctx.arc(bx, by, br2, 0, TAU);
          mctx.fill();
        }
        mctx.globalCompositeOperation = "source-over";
        for (let i = 0; i < 320; i++) {
          mctx.globalAlpha = 0.1 + cr() * 0.5;
          mctx.fillStyle = cr() > 0.75 ? "#ffe9c8" : "#dfe8ff";
          mctx.beginPath();
          mctx.arc(cr() * W, cr() * H, 0.3 + cr() * 1.1, 0, TAU);
          mctx.fill();
        }
        mctx.globalAlpha = 1;
      } else {
        /* глубокий космос */
        milkyBand(1);
      }
      milky = mw;
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(320, rect.width);
      H = Math.max(300, rect.height);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const rnd = mulberry32(20260101);
      const count = clamp(Math.round((W * H) / 3200), 190, 520);
      stars = Array.from({ length: count }, () => ({
        x: rnd() * W,
        y: rnd() * H,
        r: 0.5 + rnd() * 1.7,
        base: 0.22 + rnd() * 0.45,
        amp: 0.08 + rnd() * 0.3,
        ph: rnd() * TAU,
        sp: 0.4 + rnd() * 1.5,
      }));

      const rr = mulberry32(777);
      rocks = Array.from({ length: 320 }, () => ({
        a0: rr() * TAU,
        rf: 0.16 + rr() * 0.68,
        period: 1300 + rr() * 1600,
        size: 0.7 + rr() * 1.3,
        alpha: 0.16 + rr() * 0.4,
        warm: rr() > 0.72,
      }));

      // центр приподнят: снизу — пульт управления, орбиты не закрываются
      const topRes = H < 720 ? 46 : 20;
      const bottomRes = clamp(H * 0.17, 94, 152);
      cx = W / 2;
      cy = topRes + (H - topRes - bottomRes) / 2;

      /* фон под текущую тему — prerender */
      const diag = Math.hypot(W, H);
      curBgTheme = propsRef.current.bgTheme;
      renderBg(curBgTheme);

      /* дрейфующие созвездия */
      const nC = clamp(Math.round((W * H) / 110000), 5, 9);
      const cr2 = mulberry32(5150);
      cInsts = Array.from({ length: nC }, () => ({
        c: Math.floor(cr2() * CONSTELLATIONS.length),
        x: cr2() * W,
        y: cr2() * H,
        s: clamp(Math.min(W, H) * (0.16 + cr2() * 0.13), 90, 240),
        rot: (cr2() - 0.5) * 0.6,
        vx: (cr2() - 0.5) * 3.2,
        vy: (cr2() - 0.5) * 2.4,
        ph: cr2() * TAU,
        glow: 0,
      }));
      // несколько дополнительных — справа, в свободной зоне за орбитами
      for (let ic = 0; ic < 6; ic++) {
        cInsts.push({
          c: Math.floor(cr2() * CONSTELLATIONS.length),
          x: W * (0.62 + cr2() * 0.36),
          y: H * (0.04 + cr2() * 0.88),
          s: clamp(Math.min(W, H) * (0.15 + cr2() * 0.12), 84, 220),
          rot: (cr2() - 0.5) * 0.6,
          vx: (cr2() - 0.5) * 3.2,
          vy: (cr2() - 0.5) * 2.4,
          ph: cr2() * TAU,
          glow: 0,
        });
      }

      /* часть мерцающих звёзд — вдоль полосы Млечного Пути */
      const cs = Math.cos(MILKY_ANG);
      const sn = Math.sin(MILKY_ANG);
      const bandHalf = diag * 0.16;
      for (let i = 0; i < stars.length; i++) {
        if (rnd() < 0.45) {
          const along = (rnd() - 0.5) * diag;
          const off = (rnd() + rnd() + rnd() - 1.5) * bandHalf;
          stars[i].x = clamp(W / 2 + along * cs - off * sn, 0, W);
          stars[i].y = clamp(H / 2 + along * sn + off * cs, 0, H);
        }
      }
    };

    const layout = () => {
      // та же геометрия, что и в resize(): снизу зарезервировано место под пульт
      const topRes = H < 720 ? 46 : 20;
      const bottomRes = clamp(H * 0.17, 94, 152);
      const usableH = H - topRes - bottomRes;
      const maxR = Math.min(W / 2 - 24, usableH / 2 - 4);
      const sunR = clamp(Math.min(W, usableH) * 0.135, 45, 81);
      const inner0 = sunR + 16;
      const k = (maxR - inner0) / Math.sqrt(30.05);
      const scale = clamp(Math.min(W, H) / 720, 0.7, 1.12);
      const gap = clamp(k * 0.7, 14, 29);
      let prev = inner0;
      let radii = PLANETS.map((d) => {
        const r = Math.max(inner0 + k * Math.sqrt(d.distAU), prev + gap);
        prev = r;
        return r;
      });
      const lastR = radii[radii.length - 1];
      if (lastR > maxR) {
        const f = (maxR - inner0) / (lastR - inner0);
        radii = radii.map((r) => inner0 + (r - inner0) * f);
      }
      return { sunR, radii, scale };
    };

    const pick = (mx: number, my: number): string | null => {
      for (let i = placed.length - 1; i >= 0; i--) {
        const b = placed[i];
        const dx = mx - b.x;
        const dy = my - b.y;
        if (dx * dx + dy * dy <= b.hit * b.hit) return b.id;
      }
      return null;
    };

    /** попадание по кольцу орбиты */
    const pickOrbit = (mx: number, my: number): string | null => {
      const { radii } = layout();
      const dist = Math.hypot(mx - cx, my - cy);
      for (let i = 0; i < PLANETS.length; i++) {
        if (Math.abs(dist - radii[i]) < 9) return PLANETS[i].id;
      }
      return null;
    };

    /** позиция вдалеке от Солнечной системы */
    const farPos = (minD: number) => {
      for (let i = 0; i < 26; i++) {
        const x = Math.random() * W;
        const y = Math.random() * H;
        if (Math.hypot(x - cx, y - cy) > minD) return { x, y };
      }
      return { x: W * 0.06, y: H * 0.08 };
    };

    /* ---- захват созвездий курсором ---- */
    let dragIdx = -1;
    const dragOff = { x: 0, y: 0 };

    const hitConstellation = (mx: number, my: number): number => {
      for (let i = cInsts.length - 1; i >= 0; i--) {
        const inst = cInsts[i];
        const c = CONSTELLATIONS[inst.c];
        const cr = Math.cos(inst.rot);
        const sr = Math.sin(inst.rot);
        for (const pt of c.pts) {
          // те же преобразования, что и при отрисовке
          const lx = (pt[0] - 0.5) * inst.s * 1.7;
          const ly = (pt[1] - 0.5) * inst.s;
          const wx = inst.x + lx * cr - ly * sr;
          const wy = inst.y + lx * sr + ly * cr;
          const dx = mx - wx;
          const dy = my - wy;
          if (dx * dx + dy * dy < 26 * 26) return i;
        }
      }
      return -1;
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      if (dragIdx >= 0) {
        const inst = cInsts[dragIdx];
        inst.x = mouse.x + dragOff.x;
        inst.y = mouse.y + dragOff.y;
        inst.glow = 1;
        return;
      }
      const id = pick(mouse.x, mouse.y) ?? pickOrbit(mouse.x, mouse.y);
      if (id !== hoverId) {
        hoverId = id;
        propsRef.current.onHover(id);
      }
      canvas.style.cursor = id ? "pointer" : hitConstellation(mouse.x, mouse.y) >= 0 ? "grab" : "default";
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
      dragIdx = -1;
      if (hoverId) {
        hoverId = null;
        propsRef.current.onHover(null);
      }
      canvas.style.cursor = "default";
    };
    const onDown = () => {
      const id = pick(mouse.x, mouse.y);
      if (id) {
        propsRef.current.onSelect(id);
        return;
      }
      if (mouse.x < -999) return;
      // клик по орбите — зафиксировать/снять оранжевое выделение
      const orb = pickOrbit(mouse.x, mouse.y);
      if (orb) {
        propsRef.current.onOrbitSelect(orb);
        return;
      }
      const ci = hitConstellation(mouse.x, mouse.y);
      if (ci >= 0) {
        dragIdx = ci;
        const inst = cInsts[ci];
        dragOff.x = inst.x - mouse.x;
        dragOff.y = inst.y - mouse.y;
        inst.glow = 1;
        canvas.style.cursor = "grabbing";
      } else {
        ripples.push({ x: mouse.x, y: mouse.y, age: 0 });
      }
    };
    const onUp = () => {
      if (dragIdx >= 0) {
        dragIdx = -1;
        canvas.style.cursor = hoverId ? "pointer" : "default";
      }
    };

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = clamp((now - last) / 1000, 0, 0.1);
      // наведение: внутренний (курсор над картой) ИЛИ внешний (панель объектов)
      const effHov = hoverId ?? propsRef.current.hoverId;

      // прогрессивный рендер кадров вращения (по 2 за кадр)
      for (let qi = 0; qi < 2 && buildQueue.length; qi++) {
        const job = buildQueue.shift()!;
        frameCache.get(job.body.id)!.push(buildFrame(job.body, job.k));
      }
      advanceSpin(dt);
      last = now;
      const p = propsRef.current;
      // смена темы фона — перерисовать пререндер
      if (p.bgTheme !== curBgTheme) {
        curBgTheme = p.bgTheme;
        renderBg(curBgTheme);
      }
      if (p.playing) simRef.current.simDays += dt * p.speed;
      const simDays = simRef.current.simDays;
      const t = now / 1000;
      worldT += dt;

      const { sunR, radii, scale } = layout();
      const m = Math.min(W, H);
      const lastOrbit = radii[radii.length - 1];

      /* ---- таймеры событий ---- */
      nextComet -= dt;
      if (nextComet <= 0) {
        spawnComet();
        nextComet = 3.5 + Math.random() * 5;
      }

      /* ---- комета в Млечный Путь: выбор цели, полёт, столкновение ---- */
      const diag = Math.hypot(W, H);
      nextBandComet -= dt;
      if (nextBandComet <= 0 && !bandComet) {
        const csB = Math.cos(MILKY_ANG);
        const snB = Math.sin(MILKY_ANG);
        const cands: number[] = [];
        for (let si = 0; si < stars.length; si++) {
          if (deadStars.has(si)) continue;
          const s0 = stars[si];
          const ddx = s0.x - W / 2;
          const ddy = s0.y - H / 2;
          const off = Math.abs(-ddx * snB + ddy * csB); // расстояние до оси полосы
          if (off < diag * 0.15 && s0.x > 50 && s0.x < W - 50 && s0.y > 70 && s0.y < H - 60) cands.push(si);
        }
        if (cands.length) {
          const idx = cands[Math.floor(Math.random() * cands.length)];
          const st0 = stars[idx];
          const side = Math.random() > 0.5 ? 1 : -1;
          const startD = diag * 0.62;
          const sp0 = 130 + Math.random() * 80;
          bandComet = {
            x: st0.x - csB * startD * side,
            y: st0.y - snB * startD * side,
            vx: csB * side * sp0,
            vy: snB * side * sp0,
            starIdx: idx,
          };
        }
        nextBandComet = 15 + Math.random() * 16;
      }
      if (bandComet) {
        bandComet.x += bandComet.vx * dt;
        bandComet.y += bandComet.vy * dt;
        const tgt = stars[bandComet.starIdx];
        if (tgt) {
          const dd2 = Math.hypot(bandComet.x - tgt.x, bandComet.y - tgt.y);
          if (dd2 < 9) {
            // столкновение: вспышка + звезда гаснет, комета гибнет
            impacts.push({ x: tgt.x, y: tgt.y, age: 0, life: 1.3 });
            deadStars.set(bandComet.starIdx, worldT);
            bandComet = null;
          } else if (bandComet.x < -120 || bandComet.x > W + 120 || bandComet.y < -120 || bandComet.y > H + 120) {
            bandComet = null;
          }
        } else {
          bandComet = null;
        }
      }
      for (let ii = impacts.length - 1; ii >= 0; ii--) {
        impacts[ii].age += dt;
        if (impacts[ii].age > impacts[ii].life) impacts.splice(ii, 1);
      }
      for (const [idx2, t0] of deadStars) {
        if (worldT - t0 > 4.6) deadStars.delete(idx2); // звезда восстановилась
      }

      nextMeteor -= dt;
      if (nextMeteor <= 0) {
        const a = Math.random() * TAU;
        const sp = 400 + Math.random() * 280;
        meteors.push({
          x: Math.random() * W,
          y: Math.random() * H * 0.55,
          vx: Math.cos(a) * sp,
          vy: Math.abs(Math.sin(a)) * sp * 0.9 + 130,
          age: 0,
        });
        nextMeteor = 1.1 + Math.random() * 1.9;
      }
      nextShower -= dt;
      if (nextShower <= 0) {
        const ang = (55 + Math.random() * 30) * (Math.PI / 180);
        showers.push({
          x: W * (0.15 + Math.random() * 0.7),
          y: -30,
          dx: Math.cos(ang) * (Math.random() > 0.5 ? 1 : -1),
          dy: Math.sin(ang),
          sp: 470 + Math.random() * 180,
          remaining: 10 + Math.floor(Math.random() * 8),
          acc: 0,
        });
        nextShower = 26 + Math.random() * 28;
      }
      nextRocket -= dt;
      if (nextRocket <= 0 && !rocket) {
        const dir = Math.random() > 0.5 ? 1 : -1;
        rocket = { t: 0, dir, by: H * (0.15 + Math.random() * 0.6) };
        nextRocket = 26 + Math.random() * 26;
      }
      nextBH -= dt;
      if (nextBH <= 0 && !bh) {
        const pos = farPos(lastOrbit + sunR * 0.6 + 60);
        bh = {
          x: pos.x, y: pos.y, age: 0, life: 17,
          r: clamp(m * 0.05, 26, 40),
          seeds: Array.from({ length: 22 }, () => ({
            a: Math.random() * TAU,
            sp: 1.1 + Math.random() * 2.3,
            ph: 0.6 + Math.random() * 1.9,
          })),
          stars: Array.from({ length: 4 }, () => ({
            a: Math.random() * TAU,
            dist: (2.4 + Math.random() * 2) * clamp(m * 0.05, 26, 40),
            sp: 1.2 + Math.random() * 1.6,
            size: 1.4 + Math.random() * 1.4,
          })),
        };
        nextBH = 42 + Math.random() * 26;
      }
      nextNova -= dt;
      if (nextNova <= 0) {
        const pos = farPos(lastOrbit * 0.85 + 40);
        novas.push({ x: pos.x, y: pos.y, age: 0, life: 2.6 });
        flashes.push({ x: pos.x, y: pos.y, age: 0, life: 0.7, size: 26, color: "#bcd4ff" });
        nextNova = 30 + Math.random() * 30;
      }
      nextDisk -= dt;
      if (nextDisk <= 0 && disks.length < 2) {
        const pos = farPos(lastOrbit * 0.8 + 30);
        disks.push({ x: pos.x, y: pos.y, age: 0, life: 30, tilt: Math.random() * TAU, seed: Math.random() * TAU });
        nextDisk = 18 + Math.random() * 16;
      }

      /* ---- фон ---- */
      ctx.fillStyle = "#05070f";
      ctx.fillRect(0, 0, W, H);

      const neb = (nx: number, ny: number, nr: number, c1: string, c2: string, ph: number) => {
        const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
        g.addColorStop(0, c1);
        g.addColorStop(1, c2);
        ctx.globalAlpha = 0.65 + Math.sin(t * 0.11 + ph) * 0.18;
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      };
      neb(W * 0.14, H * 0.2, m * 0.55, "rgba(38,160,150,0.10)", "rgba(38,160,150,0)", 0);
      neb(W * 0.88, H * 0.84, m * 0.62, "rgba(255,122,50,0.08)", "rgba(255,122,50,0)", 2.1);
      neb(W * 0.74, H * 0.1, m * 0.5, "rgba(70,110,220,0.08)", "rgba(70,110,220,0)", 4.2);

      /* ---- Млечный Путь ---- */
      if (milky) {
        ctx.globalAlpha = 0.8 + Math.sin(t * 0.07) * 0.12;
        ctx.drawImage(milky, 0, 0, W, H);
        ctx.globalAlpha = 1;
      }

      /* ---- звёзды (с учётом погибших от кометы и их восстановления) ---- */
      for (let si2 = 0; si2 < stars.length; si2++) {
        const s = stars[si2];
        let a = clamp(s.base + Math.sin(t * s.sp + s.ph) * s.amp, 0.05, 1);
        const dt2 = deadStars.has(si2) ? worldT - deadStars.get(si2)! : -1;
        if (dt2 >= 0) {
          if (dt2 < 0.25) a *= 1 - dt2 / 0.25;       // быстрое угасание
          else if (dt2 < 3.0) a = 0;                  // звезда погасла
          else if (dt2 < 4.5) a *= (dt2 - 3.0) / 1.5; // возрождение
        }
        if (a <= 0.01) continue;
        ctx.globalAlpha = a;
        ctx.fillStyle = s.r > 1.1 ? "#cfe0ff" : "#ffffff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, TAU);
        ctx.fill();
        // искорка при возрождении
        if (dt2 >= 3.0 && dt2 < 4.5) {
          const k = (dt2 - 3.0) / 1.5;
          ctx.globalAlpha = 0.5 * Math.sin(k * Math.PI);
          ctx.strokeStyle = "#aee8ff";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(s.x - 4, s.y);
          ctx.lineTo(s.x + 4, s.y);
          ctx.moveTo(s.x, s.y - 4);
          ctx.lineTo(s.x, s.y + 4);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      /* ---- комета, летящая в Млечный Путь ---- */
      if (bandComet) {
        const bc = bandComet;
        const vl = Math.hypot(bc.vx, bc.vy) || 1;
        const ux = -bc.vx / vl;
        const uy = -bc.vy / vl;
        const tg = ctx.createLinearGradient(bc.x, bc.y, bc.x + ux * 95, bc.y + uy * 95);
        tg.addColorStop(0, "#dff3ff");
        tg.addColorStop(0.3, "rgba(158,203,255,0.8)");
        tg.addColorStop(1, "rgba(158,203,255,0)");
        ctx.strokeStyle = tg;
        ctx.lineWidth = 2.4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(bc.x, bc.y);
        ctx.lineTo(bc.x + ux * 95, bc.y + uy * 95);
        ctx.stroke();
        const hg = ctx.createRadialGradient(bc.x, bc.y, 0, bc.x, bc.y, 9);
        hg.addColorStop(0, "#ffffff");
        hg.addColorStop(0.4, "#cfe6ff");
        hg.addColorStop(1, "rgba(207,230,255,0)");
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(bc.x, bc.y, 9, 0, TAU);
        ctx.fill();
      }

      /* ---- вспышки от столкновений кометы со звёздами ---- */
      for (const im of impacts) {
        const k = im.age / im.life;
        const env = 1 - k;
        const rr3 = 4 + k * 46;
        const fg = ctx.createRadialGradient(im.x, im.y, 0, im.x, im.y, rr3);
        fg.addColorStop(0, `rgba(255,255,255,${(0.95 * env).toFixed(3)})`);
        fg.addColorStop(0.35, `rgba(190,225,255,${(0.7 * env).toFixed(3)})`);
        fg.addColorStop(0.7, `rgba(120,170,255,${(0.3 * env).toFixed(3)})`);
        fg.addColorStop(1, "rgba(120,170,255,0)");
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(im.x, im.y, rr3, 0, TAU);
        ctx.fill();
        // расходящееся кольцо
        ctx.strokeStyle = `rgba(190,225,255,${(0.6 * env).toFixed(3)})`;
        ctx.lineWidth = 1.6 * env + 0.3;
        ctx.beginPath();
        ctx.arc(im.x, im.y, 6 + k * 60, 0, TAU);
        ctx.stroke();
      }

      /* ---- созвездия ---- */
      for (let ci = 0; ci < cInsts.length; ci++) {
        const inst = cInsts[ci];
        if (ci !== dragIdx) {
          inst.x += inst.vx * dt;
          inst.y += inst.vy * dt;
        }
        if (ci !== dragIdx) {
          const pad = inst.s;
          if (inst.x < -pad) inst.x = W + pad;
          if (inst.x > W + pad) inst.x = -pad;
          if (inst.y < -pad) inst.y = H + pad;
          if (inst.y > H + pad) inst.y = -pad;
        }

        const con = CONSTELLATIONS[inst.c];
        const cosR = Math.cos(inst.rot);
        const sinR = Math.sin(inst.rot);
        const breath = 0.5 + 0.5 * Math.sin(t * 0.35 + inst.ph);

        const spts = con.pts.map((pt) => {
          const dx = (pt[0] - 0.5) * inst.s * 1.7;
          const dy = (pt[1] - 0.5) * inst.s;
          return [inst.x + dx * cosR - dy * sinR, inst.y + dx * sinR + dy * cosR] as const;
        });

        let near = ci === dragIdx;
        if (!near && mouse.x > -999) {
          for (const [sx, sy] of spts) {
            if ((mouse.x - sx) * (mouse.x - sx) + (mouse.y - sy) * (mouse.y - sy) < 46 * 46) {
              near = true;
              break;
            }
          }
          if (!near) {
            for (const [ia, ib] of con.seg) {
              if (distToSeg(mouse.x, mouse.y, spts[ia][0], spts[ia][1], spts[ib][0], spts[ib][1]) < 22) {
                near = true;
                break;
              }
            }
          }
        }
        inst.glow += ((near ? 1 : 0) - inst.glow) * 0.09;
        const glow = inst.glow;

        ctx.strokeStyle = `rgba(170,215,255,${(0.17 + 0.1 * breath + 0.58 * glow).toFixed(3)})`;
        ctx.lineWidth = 1 + glow * 0.5;
        ctx.beginPath();
        for (const [ia, ib] of con.seg) {
          ctx.moveTo(spts[ia][0], spts[ia][1]);
          ctx.lineTo(spts[ib][0], spts[ib][1]);
        }
        ctx.stroke();

        for (const [sx, sy] of spts) {
          const ra = 1.35 + glow * 1.15 + breath * 0.25;
          ctx.globalAlpha = clamp(0.62 + 0.16 * breath + 0.3 * glow, 0, 1);
          ctx.fillStyle = "#e6f2ff";
          ctx.beginPath();
          ctx.arc(sx, sy, ra, 0, TAU);
          ctx.fill();
          if (glow > 0.05) {
            ctx.globalAlpha = glow * 0.3;
            ctx.beginPath();
            ctx.arc(sx, sy, ra * 3, 0, TAU);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;

        let mx2 = 0;
        let my2 = 0;
        for (const [sx, sy] of spts) {
          mx2 += sx;
          my2 += sy;
        }
        mx2 /= spts.length;
        my2 /= spts.length;
        ctx.font = `500 ${10 + glow * 2}px "JetBrains Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = 0.26 + 0.14 * breath + 0.6 * glow;
        ctx.fillStyle = glow > 0.4 ? "#bcd9ff" : "rgba(160,190,235,1)";
        ctx.fillText(con.name, mx2, my2);
        ctx.globalAlpha = 1;
      }

      /* ---- чёрная дыра (за пределами системы, мягкие края) ---- */
      if (bh) {
        bh.age += dt;
        const env = Math.min(1, bh.age / 1.6, (bh.life - bh.age) / 1.8);
        if (bh.age >= bh.life) {
          bh = null;
        } else if (env > 0) {
          const bx = bh.x;
          const by = bh.y;
          const r = bh.r;

          // затягивание пролетающих комет
          for (let i = comets.length - 1; i >= 0; i--) {
            const c = comets[i];
            const dxh = bx - c.x;
            const dyh = by - c.y;
            const dh = Math.hypot(dxh, dyh);
            if (dh < r * 0.55) {
              flashes.push({ x: bx, y: by, age: 0, life: 0.6, size: 20, color: c.color });
              comets.splice(i, 1);
              continue;
            }
            if (dh < 300) {
              const pull = 26000 / (dh * dh) + 30;
              c.vx += (dxh / dh) * pull * dt * 60;
              c.vy += (dyh / dh) * pull * dt * 60;
            }
          }

          ctx.save();
          try {
            ctx.filter = "blur(3px)";
          } catch {
            /* старые браузеры — рисуем без blur */
          }

          // внешнее гало
          const halo = ctx.createRadialGradient(bx, by, r * 0.4, bx, by, r * 3.6);
          halo.addColorStop(0, `rgba(126,92,210,${(0.14 * env).toFixed(3)})`);
          halo.addColorStop(0.5, `rgba(90,70,170,${(0.07 * env).toFixed(3)})`);
          halo.addColorStop(1, "rgba(90,70,170,0)");
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(bx, by, r * 3.6, 0, TAU);
          ctx.fill();

          // мягкое фотонное кольцо (без чёткого контура)
          const ring = ctx.createRadialGradient(bx, by, r * 0.62, bx, by, r * 1.5);
          ring.addColorStop(0, "rgba(255,190,110,0)");
          ring.addColorStop(0.42, `rgba(255,200,130,${(0.5 * env).toFixed(3)})`);
          ring.addColorStop(0.62, `rgba(255,170,90,${(0.28 * env).toFixed(3)})`);
          ring.addColorStop(1, "rgba(255,170,90,0)");
          ctx.fillStyle = ring;
          ctx.beginPath();
          ctx.arc(bx, by, r * 1.5, 0, TAU);
          ctx.fill();

          // частицы, падающие по спирали
          for (const sd of bh.seeds) {
            sd.a += sd.sp * dt;
            const dR = r * sd.ph * (0.75 + 0.22 * Math.sin(sd.a * 0.8 + sd.ph));
            const sx = bx + Math.cos(sd.a) * dR;
            const sy = by + Math.sin(sd.a) * dR * 0.42;
            ctx.globalAlpha = 0.5 * env;
            ctx.fillStyle = "#ffd9a0";
            ctx.beginPath();
            ctx.arc(sx, sy, 1.1, 0, TAU);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.restore();

          // тёмное ядро — мягкий градиент, без обводки
          const core = ctx.createRadialGradient(bx, by, 0, bx, by, r * 1.15);
          core.addColorStop(0, `rgba(2,3,8,${(0.98 * env).toFixed(3)})`);
          core.addColorStop(0.72, `rgba(2,3,8,${(0.96 * env).toFixed(3)})`);
          core.addColorStop(1, "rgba(2,3,8,0)");
          ctx.fillStyle = core;
          ctx.beginPath();
          ctx.arc(bx, by, r * 1.15, 0, TAU);
          ctx.fill();

          // звёзды, которые дыра затягивает
          for (let i = bh.stars.length - 1; i >= 0; i--) {
            const st = bh.stars[i];
            st.a += st.sp * dt * (1 + (2 * r) / st.dist);
            st.dist -= dt * (16 + (70 * r) / st.dist);
            if (st.dist < r * 0.5) {
              flashes.push({ x: bx, y: by, age: 0, life: 0.5, size: 16, color: "#cfe4ff" });
              bh.stars.splice(i, 1);
              continue;
            }
            const sx = bx + Math.cos(st.a) * st.dist;
            const sy = by + Math.sin(st.a) * st.dist;
            const tx = (bx - sx) / st.dist;
            const ty = (by - sy) / st.dist;
            ctx.strokeStyle = `rgba(220,235,255,${(0.85 * env).toFixed(3)})`;
            ctx.lineWidth = st.size * 0.8;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + tx * 11, sy + ty * 11);
            ctx.stroke();
            ctx.fillStyle = `rgba(255,255,255,${env.toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(sx, sy, st.size * 0.9, 0, TAU);
            ctx.fill();
          }

          // подпись небесного тела
          ctx.font = '600 11px "JetBrains Mono", monospace';
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = `rgba(216,200,255,${(0.85 * env).toFixed(3)})`;
          ctx.fillText("ЧЁРНАЯ ДЫРА", bx, by - r * 2.1);
          ctx.font = '400 9px "JetBrains Mono", monospace';
          ctx.fillStyle = `rgba(165,150,210,${(0.6 * env).toFixed(3)})`;
          ctx.fillText("звёздная · ~10 масс Солнца", bx, by - r * 2.1 + 14);
        }
      }

      /* ---- пояс астероидов ---- */
      for (const rk of rocks) {
        const a = rk.a0 + TAU * (simDays / rk.period);
        const rr2 = radii[3] + (radii[4] - radii[3]) * rk.rf;
        ctx.globalAlpha = rk.alpha;
        ctx.fillStyle = rk.warm ? "#9b8570" : "#7e8698";
        ctx.fillRect(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2, rk.size, rk.size);
      }
      ctx.globalAlpha = 1;

      /* ---- орбиты ---- */
      for (let i = 0; i < PLANETS.length; i++) {
        const d = PLANETS[i];
        const r = radii[i];
        const isSel = p.selectedId === d.id;
        const isHov = effHov === d.id;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        if (isSel) {
          // закреплённое выделение: мягкое свечение + янтарная линия
          ctx.strokeStyle = "rgba(255,181,71,0.14)";
          ctx.lineWidth = 6;
          ctx.stroke();
          ctx.strokeStyle = "rgba(255,181,71,0.72)";
          ctx.lineWidth = 1.8;
        } else if (isHov) {
          ctx.strokeStyle = "rgba(67,217,201,0.45)";
          ctx.lineWidth = 1.4;
        } else {
          ctx.strokeStyle = p.showOrbits ? "rgba(148,166,205,0.17)" : "rgba(148,166,205,0.05)";
          ctx.lineWidth = 1;
        }
        ctx.stroke();
      }

      /* ---- планеты (текстурированные спрайты) ---- */
      placed = [{ id: SUN.id, x: cx, y: cy, r: sunR, hit: sunR + 12 }];

      for (let i = 0; i < PLANETS.length; i++) {
        const d = PLANETS[i];
        const r = radii[i];
        const ang = d.angle0 + TAU * (simDays / d.periodDays);
        const x = cx + Math.cos(ang) * r;
        const y = cy + Math.sin(ang) * r;
        // плавное увеличение при наведении
        const hsTarget = effHov === d.id ? 1.24 : 1;
        const hsPrev = hoverScales.get(d.id) ?? 1;
        const hsCur = hsPrev + (hsTarget - hsPrev) * 0.16;
        hoverScales.set(d.id, hsCur);
        const pr = clamp(3.1 + 6.4 * Math.sqrt(d.diameterKm / 142984), 3.4, 11) * 3 * scale * hsCur;

        // короткий малозаметный шлейф
        ctx.lineCap = "round";
        for (let sIdx = 1; sIdx <= 8; sIdx++) {
          const a1 = ang - sIdx * 0.016;
          ctx.beginPath();
          ctx.arc(cx, cy, r, a1 - 0.017, a1);
          ctx.strokeStyle = d.color;
          ctx.globalAlpha = 0.13 * (1 - sIdx / 9);
          ctx.lineWidth = Math.max(0.5, pr * 0.85 * (1 - sIdx / 9));
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // кольца Сатурна — задняя половина (за планетой)
        if (d.ring) {
          drawSaturnRingHalf(ctx, x, y, pr, true);
        }

        // запоминаем позиции Земли и Марса для постоянного НЛО
        if (d.id === "earth") earthPos = { x, y, r: pr };
        if (d.id === "mars") marsPos = { x, y, r: pr };

        // цветовое свечение-подложка (планеты ярче и заметнее)
        const ug = ctx.createRadialGradient(x, y, pr * 0.4, x, y, pr * 1.9);
        ug.addColorStop(0, `${d.color}3d`);
        ug.addColorStop(1, `${d.color}00`);
        ctx.fillStyle = ug;
        ctx.beginPath();
        ctx.arc(x, y, pr * 1.9, 0, TAU);
        ctx.fill();

        // сфера с фактурой (вращается вокруг оси)
        drawSpinFrame(d.id, x, y, pr);

        // направленный свет от Солнца + тень с ночной стороны
        const dxs = cx - x;
        const dys = cy - y;
        const dl = Math.hypot(dxs, dys) || 1;
        const gx = x + (dxs / dl) * pr * 0.5;
        const gy = y + (dys / dl) * pr * 0.5;
        const lit = ctx.createRadialGradient(gx, gy, pr * 0.05, x, y, pr * 1.02);
        lit.addColorStop(0, "rgba(255,255,255,0.26)");
        lit.addColorStop(0.5, "rgba(255,255,255,0.04)");
        lit.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = lit;
        ctx.beginPath();
        ctx.arc(x, y, pr, 0, TAU);
        ctx.fill();
        const ox = x - (dxs / dl) * pr * 0.6;
        const oy = y - (dys / dl) * pr * 0.6;
        const shd = ctx.createRadialGradient(ox, oy, pr * 0.2, ox, oy, pr * 1.7);
        shd.addColorStop(0, "rgba(0,0,10,0.4)");
        shd.addColorStop(0.55, "rgba(0,0,10,0.17)");
        shd.addColorStop(1, "rgba(0,0,10,0)");
        ctx.fillStyle = shd;
        ctx.beginPath();
        ctx.arc(x, y, pr, 0, TAU);
        ctx.fill();

        // Луна у Земли
        if (d.hasMoon) {
          const ma = 1.2 + TAU * (simDays / 27.3);
          const mr = pr * 2.4;
          ctx.beginPath();
          ctx.arc(x + Math.cos(ma) * mr, y + Math.sin(ma) * mr * 0.9, Math.max(1.1, pr * 0.24), 0, TAU);
          ctx.fillStyle = "#c9cedb";
          ctx.fill();

          // искусственный спутник (МКС): корпус + солнечные панели
          const sa = 2.2 + worldT * 1.5;
          const sr = pr * 1.8;
          const sx = x + Math.cos(sa) * sr;
          const sy = y + Math.sin(sa) * sr * 0.8;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(sa * 0.6);
          ctx.fillStyle = "#3f74e0";
          ctx.fillRect(-4.6, -0.9, 2.8, 1.8);
          ctx.fillRect(1.8, -0.9, 2.8, 1.8);
          ctx.fillStyle = "#dfe8f6";
          ctx.fillRect(-1.2, -1.2, 2.4, 2.4);
          ctx.fillStyle = "rgba(140,225,255,0.9)";
          ctx.fillRect(-0.55, -0.55, 1.1, 1.1);
          ctx.restore();
        }

        // кольца Сатурна — передняя половина (перед планетой)
        if (d.ring) {
          drawSaturnRingHalf(ctx, x, y, pr, false);
        }

        // индикатор наведения / выбора
        if (effHov === d.id || p.selectedId === d.id) {
          const sel = p.selectedId === d.id;
          ctx.beginPath();
          ctx.setLineDash([4, 5]);
          ctx.lineDashOffset = sel ? -t * 26 : -t * 10;
          ctx.arc(x, y, pr + 6.5, 0, TAU);
          ctx.strokeStyle = sel ? "rgba(255,181,71,0.95)" : "rgba(67,217,201,0.85)";
          ctx.lineWidth = 1.3;
          ctx.stroke();
          ctx.setLineDash([]);
        }

        placed.push({ id: d.id, x, y, r: pr, hit: Math.max(pr + 9, 13) });
      }

      /* ---- Солнце: статичное, постоянный диаметр ---- */
      // белая корона в три слоя — как на настоящих снимках
      const glowR = sunR * 3.4;
      const gg = ctx.createRadialGradient(cx, cy, sunR * 0.5, cx, cy, glowR);
      gg.addColorStop(0, "rgba(255,246,228,0.42)");
      gg.addColorStop(0.3, "rgba(255,222,168,0.18)");
      gg.addColorStop(0.62, "rgba(255,190,120,0.06)");
      gg.addColorStop(1, "rgba(255,180,110,0)");
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, TAU);
      ctx.fill();

      // диск с грануляцией (вращается)
      const sRad = sunR;
      drawSpinFrame(SUN.id, cx, cy, sRad);

      // затемнение к лимбу (фотосфера) и горячее ядро
      const limb = ctx.createRadialGradient(cx, cy, sRad * 0.55, cx, cy, sRad);
      limb.addColorStop(0, "rgba(120,40,0,0)");
      limb.addColorStop(1, "rgba(150,50,0,0.45)");
      ctx.fillStyle = limb;
      ctx.beginPath();
      ctx.arc(cx, cy, sRad, 0, TAU);
      ctx.fill();
      // тонкая хромосфера по краю диска
      ctx.strokeStyle = "rgba(255,124,62,0.5)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, sRad + 0.6, 0, TAU);
      ctx.stroke();
      const coreG = ctx.createRadialGradient(cx, cy, 0, cx, cy, sRad * 0.55);
      coreG.addColorStop(0, "rgba(255,255,240,0.3)");
      coreG.addColorStop(1, "rgba(255,255,240,0)");
      ctx.fillStyle = coreG;
      ctx.beginPath();
      ctx.arc(cx, cy, sRad * 0.55, 0, TAU);
      ctx.fill();

      if (hoverId === SUN.id || p.selectedId === SUN.id) {
        ctx.beginPath();
        ctx.setLineDash([5, 6]);
        ctx.lineDashOffset = -t * 26;
        ctx.arc(cx, cy, sunR + 10, 0, TAU);
        ctx.strokeStyle = p.selectedId === SUN.id ? "rgba(255,181,71,0.95)" : "rgba(67,217,201,0.85)";
        ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      /* ---- подписи ---- */
      ctx.font = '500 10px "JetBrains Mono", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = (name: string, x: number, y: number, r: number, active: boolean) => {
        const ly = y - r - 12;
        const w = ctx.measureText(name).width + 10;
        ctx.fillStyle = "rgba(4,7,15,0.62)";
        ctx.fillRect(x - w / 2, ly - 8, w, 15);
        ctx.fillStyle = active ? "#ffb547" : "rgba(214,226,248,0.82)";
        ctx.fillText(name, x, ly);
      };
      for (const d of PLANETS) {
        const b = placed.find((q) => q.id === d.id);
        if (!b) continue;
        const active = hoverId === d.id || p.selectedId === d.id;
        if (p.showLabels || active) label(d.name.toUpperCase(), b.x, b.y, b.r, active);
      }
      if (p.showLabels || hoverId === SUN.id || p.selectedId === SUN.id) {
        label("СОЛНЦЕ", cx, cy, sunR, hoverId === SUN.id || p.selectedId === SUN.id);
      }

      /* ---- кометы ---- */
      for (let i = comets.length - 1; i >= 0; i--) {
        const c = comets[i];
        c.age += dt;
        c.vx += (cx - c.x) * 0.018 * dt;
        c.vy += (cy - c.y) * 0.018 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (c.age > c.life || c.x < -280 || c.x > W + 280 || c.y < -280 || c.y > H + 280) {
          comets.splice(i, 1);
          continue;
        }
        const fade = 1 - c.age / c.life;
        const vl = Math.hypot(c.vx, c.vy) || 1;
        const ux = -c.vx / vl;
        const uy = -c.vy / vl;
        const tg = ctx.createLinearGradient(c.x, c.y, c.x + ux * c.tail, c.y + uy * c.tail);
        tg.addColorStop(0, c.color);
        tg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.strokeStyle = tg;
        ctx.globalAlpha = 0.85 * fade;
        ctx.lineWidth = c.size * 1.1;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x + ux * c.tail, c.y + uy * c.tail);
        ctx.stroke();
        const ca = Math.atan2(uy, ux) + 0.28;
        ctx.globalAlpha = 0.32 * fade;
        ctx.lineWidth = c.size * 0.7;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x + Math.cos(ca) * c.tail * 0.6, c.y + Math.sin(ca) * c.tail * 0.6);
        ctx.stroke();
        const hg2 = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.size * 6);
        hg2.addColorStop(0, "#ffffff");
        hg2.addColorStop(0.28, c.color);
        hg2.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = fade;
        ctx.fillStyle = hg2;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.size * 6, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      /* ---- метеоры (в т.ч. звездопад) ---- */
      for (const sh of showers) {
        sh.acc += dt;
        while (sh.acc > 0.13 && sh.remaining > 0) {
          sh.acc -= 0.13;
          sh.remaining--;
          const jit = () => (Math.random() - 0.5) * 60;
          meteors.push({
            x: sh.x + jit(),
            y: sh.y + jit() * 0.4,
            vx: sh.dx * sh.sp + jit(),
            vy: sh.dy * sh.sp + jit() * 0.5,
            age: 0,
          });
        }
      }
      showers = showers.filter((s) => s.remaining > 0);
      for (let i = meteors.length - 1; i >= 0; i--) {
        const mt = meteors[i];
        mt.age += dt;
        mt.x += mt.vx * dt;
        mt.y += mt.vy * dt;
        if (mt.age > 0.7) {
          meteors.splice(i, 1);
          continue;
        }
        const fade = 1 - mt.age / 0.7;
        const vl = Math.hypot(mt.vx, mt.vy) || 1;
        const ux = -mt.vx / vl;
        const uy = -mt.vy / vl;
        const mg = ctx.createLinearGradient(mt.x, mt.y, mt.x + ux * 46, mt.y + uy * 46);
        mg.addColorStop(0, `rgba(255,255,255,${(0.9 * fade).toFixed(3)})`);
        mg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = mg;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(mt.x, mt.y);
        ctx.lineTo(mt.x + ux * 46, mt.y + uy * 46);
        ctx.stroke();
      }

      /* ---- рябь от клика ---- */
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.age += dt;
        if (rp.age > 0.9) {
          ripples.splice(i, 1);
          continue;
        }
        const k = rp.age / 0.9;
        ctx.strokeStyle = `rgba(143,245,233,${((1 - k) * 0.5).toFixed(3)})`;
        ctx.lineWidth = 1.4 * (1 - k) + 0.4;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, 6 + k * 90, 0, TAU);
        ctx.stroke();
      }

      /* ---- вспышки (поглощение чёрной дырой, сверхновые) ---- */
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        f.age += dt;
        const k = f.age / f.life;
        if (k >= 1) {
          flashes.splice(i, 1);
          continue;
        }
        const e = 1 - k;
        const fg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.size * (0.4 + k * 2));
        fg.addColorStop(0, `rgba(255,255,255,${(0.9 * e).toFixed(3)})`);
        fg.addColorStop(0.35, f.color + Math.round(200 * e).toString(16).padStart(2, "0"));
        fg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size * (0.4 + k * 2), 0, TAU);
        ctx.fill();
      }

      /* ---- сверхновые вдалеке ---- */
      for (let i = novas.length - 1; i >= 0; i--) {
        const nv = novas[i];
        nv.age += dt;
        const k = nv.age / nv.life;
        if (k >= 1) {
          novas.splice(i, 1);
          continue;
        }
        const e = 1 - k;
        ctx.strokeStyle = `rgba(165,200,255,${(0.5 * e).toFixed(3)})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(nv.x, nv.y, k * 130, 0, TAU);
        ctx.stroke();
        for (let q = 0; q < 4; q++) {
          const a = (q / 4) * TAU + 0.5;
          const len = (0.2 + k) * 85 * e;
          ctx.strokeStyle = `rgba(210,228,255,${(0.5 * e).toFixed(3)})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(nv.x - Math.cos(a) * len, nv.y - Math.sin(a) * len);
          ctx.lineTo(nv.x + Math.cos(a) * len, nv.y + Math.sin(a) * len);
          ctx.stroke();
        }
        const cg = ctx.createRadialGradient(nv.x, nv.y, 0, nv.x, nv.y, 12);
        cg.addColorStop(0, `rgba(255,255,255,${(0.95 * e * e).toFixed(3)})`);
        cg.addColorStop(1, "rgba(165,200,255,0)");
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(nv.x, nv.y, 12, 0, TAU);
        ctx.fill();
      }

      /* ---- протопланетные диски (зарождение планет) ---- */
      const dscale = clamp(m / 800, 0.7, 1.2);
      for (let i = disks.length - 1; i >= 0; i--) {
        const dk = disks[i];
        dk.age += dt;
        if (dk.age >= dk.life) {
          disks.splice(i, 1);
          continue;
        }
        const env = Math.min(1, dk.age / 2.5, (dk.life - dk.age) / 3.5);
        if (env <= 0) continue;
        // мягкое свечение
        const ng = ctx.createRadialGradient(dk.x, dk.y, 0, dk.x, dk.y, 46 * dscale);
        ng.addColorStop(0, `rgba(120,220,210,${(0.1 * env).toFixed(3)})`);
        ng.addColorStop(1, "rgba(120,220,210,0)");
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.arc(dk.x, dk.y, 46 * dscale, 0, TAU);
        ctx.fill();
        // кольца диска
        const rot = dk.tilt + t * 0.05;
        for (let q = 1; q <= 3; q++) {
          const rx = (8 + q * 7) * dscale;
          ctx.strokeStyle = q === 2 ? `rgba(255,196,120,${(0.5 * env).toFixed(3)})` : `rgba(140,225,215,${((0.55 - q * 0.12) * env).toFixed(3)})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(dk.x, dk.y, rx, rx * 0.32, rot, 0, TAU);
          ctx.stroke();
        }
        // сгустки вещества на орбитах
        for (let q = 0; q < 2; q++) {
          const a = t * (0.5 - q * 0.18) + dk.seed + q * 2.4;
          const rx = (15 + q * 7) * dscale;
          const px = dk.x + Math.cos(a + rot) * rx;
          const py = dk.y + Math.sin(a + rot) * rx * 0.32;
          ctx.fillStyle = `rgba(255,220,160,${(0.8 * env).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(px, py, 1.6, 0, TAU);
          ctx.fill();
        }
        // ядро
        const cg2 = ctx.createRadialGradient(dk.x, dk.y, 0, dk.x, dk.y, 7 * dscale);
        cg2.addColorStop(0, `rgba(255,250,235,${(0.95 * env).toFixed(3)})`);
        cg2.addColorStop(0.5, `rgba(255,210,150,${(0.5 * env).toFixed(3)})`);
        cg2.addColorStop(1, "rgba(255,210,150,0)");
        ctx.fillStyle = cg2;
        ctx.beginPath();
        ctx.arc(dk.x, dk.y, 7 * dscale, 0, TAU);
        ctx.fill();
        ctx.font = '400 8.5px "JetBrains Mono", monospace';
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(150,215,205,${(0.45 * env).toFixed(3)})`;
        ctx.fillText("ПРОТОПЛАНЕТНЫЙ ДИСК", dk.x, dk.y + 34 * dscale);
      }

      /* ---- постоянное НЛО (Земля ↔ Марс) ---- */
      if (p.showUfo) {
        stepUfo(dt);
        drawUfo();
      }

      /* ---- астронавт с ракетой: полёты между планетами ---- */
      stepAstronaut(dt);
      drawAstronaut();

      /* ---- ракета с марсианином ---- */
      if (rocket) {
        rocket.t += dt / 30;
        if (rocket.t >= 1) rocket = null;
        else {
          const rk = rocket;
          const rx = rk.dir > 0 ? -60 + rk.t * (W + 120) : W + 60 - rk.t * (W + 120);
          const ry = rk.by + Math.sin(rk.t * Math.PI * 2) * 20;
          ctx.save();
          ctx.translate(rx, ry);
          ctx.scale(rk.dir, 1);
          ctx.rotate(-0.08);
          /* свечение выхлопа */
          const exh = ctx.createRadialGradient(-24, 0, 1, -24, 0, 14);
          exh.addColorStop(0, "rgba(255,181,71,0.4)");
          exh.addColorStop(1, "rgba(255,181,71,0)");
          ctx.fillStyle = exh;
          ctx.beginPath();
          ctx.arc(-24, 0, 14, 0, TAU);
          ctx.fill();
          /* внешний слой пламени */
          const fl = 10 + Math.abs(Math.sin(worldT * 26)) * 9;
          const fgr = ctx.createLinearGradient(-16, 0, -26 - fl, 0);
          fgr.addColorStop(0, "#fff3c4");
          fgr.addColorStop(0.4, "#ffb547");
          fgr.addColorStop(1, "rgba(255,90,40,0)");
          ctx.fillStyle = fgr;
          ctx.beginPath();
          ctx.moveTo(-16, -3.4);
          ctx.lineTo(-26 - fl, 0);
          ctx.lineTo(-16, 3.4);
          ctx.closePath();
          ctx.fill();
          /* внутренний слой пламени */
          const fl2 = 5 + Math.abs(Math.sin(worldT * 31)) * 5;
          const fgr2 = ctx.createLinearGradient(-16, 0, -22 - fl2, 0);
          fgr2.addColorStop(0, "#ffffff");
          fgr2.addColorStop(1, "rgba(255,243,196,0)");
          ctx.fillStyle = fgr2;
          ctx.beginPath();
          ctx.moveTo(-16, -1.8);
          ctx.lineTo(-22 - fl2, 0);
          ctx.lineTo(-16, 1.8);
          ctx.closePath();
          ctx.fill();
          /* ударные ромбы в струе */
          ctx.fillStyle = "rgba(255,250,230,0.75)";
          for (let q = 0; q < 3; q++) {
            const dx = -18.5 - q * 3.4;
            const s2 = 1.15 - q * 0.28;
            ctx.beginPath();
            ctx.moveTo(dx - s2, 0);
            ctx.lineTo(dx, -s2 * 0.8);
            ctx.lineTo(dx + s2, 0);
            ctx.lineTo(dx, s2 * 0.8);
            ctx.closePath();
            ctx.fill();
          }
          const rb = ctx.createLinearGradient(0, -6, 0, 6);
          rb.addColorStop(0, "#e8eef8");
          rb.addColorStop(1, "#8fa0bd");
          ctx.fillStyle = rb;
          ctx.beginPath();
          ctx.moveTo(-16, -5);
          ctx.lineTo(10, -5);
          ctx.quadraticCurveTo(19, 0, 10, 5);
          ctx.lineTo(-16, 5);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "rgba(30,40,64,0.7)";
          ctx.lineWidth = 1;
          ctx.stroke();
          /* цилиндрическое затенение корпуса */
          const cyl = ctx.createLinearGradient(0, -5, 0, 5);
          cyl.addColorStop(0, "rgba(255,255,255,0.35)");
          cyl.addColorStop(0.4, "rgba(255,255,255,0)");
          cyl.addColorStop(0.75, "rgba(20,30,50,0.16)");
          cyl.addColorStop(1, "rgba(20,30,50,0.4)");
          ctx.fillStyle = cyl;
          ctx.beginPath();
          ctx.moveTo(-16, -5);
          ctx.lineTo(10, -5);
          ctx.quadraticCurveTo(19, 0, 10, 5);
          ctx.lineTo(-16, 5);
          ctx.closePath();
          ctx.fill();
          /* технологические швы */
          ctx.strokeStyle = "rgba(60,74,100,0.55)";
          ctx.lineWidth = 0.6;
          for (const sx of [-11, -3, 5]) {
            ctx.beginPath();
            ctx.moveTo(sx, -5);
            ctx.lineTo(sx, 5);
            ctx.stroke();
          }
          ctx.fillStyle = "#ff5d5d";
          ctx.beginPath();
          ctx.moveTo(10, -5);
          ctx.quadraticCurveTo(19, 0, 10, 5);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(-16, -5);
          ctx.lineTo(-22, -9);
          ctx.lineTo(-16, -1.5);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(-16, 5);
          ctx.lineTo(-22, 9);
          ctx.lineTo(-16, 1.5);
          ctx.closePath();
          ctx.fill();
          /* красные полосы и нижняя ступень */
          ctx.fillStyle = "#e04a3f";
          ctx.fillRect(-6, -5, 2.4, 10);
          ctx.fillRect(3, -5, 1.6, 10);
          ctx.fillStyle = "#a8b4ca";
          ctx.fillRect(-16, -5, 4, 10);
          ctx.fillStyle = "#3c4250";
          ctx.beginPath();
          ctx.moveTo(-16, -3);
          ctx.lineTo(-19, -2.2);
          ctx.lineTo(-19, 2.2);
          ctx.lineTo(-16, 3);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#0e2233";
          ctx.beginPath();
          ctx.arc(-2, 0, 4.6, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = "#cfe0ff";
          ctx.stroke();
          ctx.fillStyle = "#6fe08a";
          ctx.beginPath();
          ctx.arc(-2, 0.4, 3, 0, TAU);
          ctx.fill();
          ctx.fillStyle = "#08220f";
          ctx.beginPath();
          ctx.arc(-3.1, -0.2, 0.7, 0, TAU);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(-0.9, -0.2, 0.7, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      }

      /* ---- виньетка ---- */
      const vg = ctx.createRadialGradient(W / 2, H / 2, m * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
      vg.addColorStop(0, "rgba(3,5,12,0)");
      vg.addColorStop(1, "rgba(3,5,12,0.5)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      if (now - lastTick > 120) {
        lastTick = now;
        p.onTick(simDays);
      }
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="block" aria-label="Карта Солнечной системы" />
    </div>
  );
}
