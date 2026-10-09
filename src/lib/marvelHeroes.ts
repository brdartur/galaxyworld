import type { ScreenAnchor } from './radioSignal';

export const HERO_IDS = ['ironMan', 'thor', 'silverSurfer', 'captainMarvel', 'nova'] as const;
export type HeroId = typeof HERO_IDS[number];
export interface Point { x: number; y: number }
export type HeroAnchors = Record<string, ScreenAnchor | null>;
export type HeroPose = 'flight' | 'hover' | 'repair' | 'hammer' | 'surf' | 'blast' | 'scan';
export interface HeroFrame {
  id: HeroId; x: number; y: number; angle: number; scale: number; opacity: number;
  time: number; phase: number; pose: HeroPose; thrust: number; effect: number;
  action: string; target: Point | null; trail: Point[];
  hammer?: Point & { angle: number; returning: boolean };
  meteor?: Point & { radius: number };
}
export interface HeroScene {
  width: number; height: number; bottom: number;
  anchors: HeroAnchors; station: ScreenAnchor | null;
}
export const HERO_DETAILS: Record<HeroId, { name: string; color: string; mission: string }> = {
  ironMan: { name: 'ЖЕЛЕЗНЫЙ ЧЕЛОВЕК', color: '#7edfff', mission: 'Патруль, сканирование и ремонт антенны станции' },
  thor: { name: 'ТОР', color: '#a3bdff', mission: 'Полёт с Мьёльниром, бросок молота, молнии и возвращение молота' },
  silverSurfer: { name: 'СЕРЕБРЯНЫЙ СЁРФЕР', color: '#d8f3ff', mission: 'Манёвры на доске и исследование внешних планет' },
  captainMarvel: { name: 'КАПИТАН МАРВЕЛ', color: '#ffc36e', mission: 'Ускорение, перехват метеора и фотонный импульс' },
  nova: { name: 'НОВА', color: '#80beff', mission: 'Космический патруль и импульсное сканирование' },
};

const TAU = Math.PI * 2;
const CYCLE = 64;
const OFFSETS: Record<HeroId, number> = { ironMan: 16, thor: 34, silverSurfer: 3, captainMarvel: 48, nova: 58 };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const ease = (v: number) => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t); };
const mix = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Screen-space illustration paths follow the same projected bodies in both map modes. */
export function heroFrame(id: HeroId, time: number, scene: HeroScene): HeroFrame {
  const index = HERO_IDS.indexOf(id);
  const scale = clamp(Math.min(scene.width / 1250, scene.height / 720), .55, 1.1);
  const left = scene.width >= 900 ? 255 : 30;
  const right = Math.max(left + 40, scene.width - 40);
  const top = scene.width < 640 ? 125 : 45;
  const bottom = Math.max(top + 50, scene.height - scene.bottom - 55);
  const bounded = (p: Point): Point => ({ x: clamp(p.x, Math.min(left, scene.width * .35), right), y: clamp(p.y, Math.min(top, scene.height * .25), bottom) });
  const sun = scene.anchors.sun;
  const center = bounded(sun ?? { x: scene.width * .55, y: (top + bottom) / 2 });
  const rx = Math.max(45, Math.min((right - left) * .44, scene.width * .33));
  const ry = Math.max(35, (bottom - top) * .36);
  const route = (t: number): Point => {
    const a = t * TAU + index * 1.13;
    return bounded({ x: center.x + Math.cos(a) * rx * (.83 + index * .035), y: center.y + Math.sin(a) * ry + Math.sin(a * 2 + index) * 17 });
  };
  const body = (name: string, dx: number, dy: number, fallback: Point): Point => {
    const a = scene.anchors[name];
    if (!a || a.x < -a.radius || a.x > scene.width + a.radius || a.y < -a.radius || a.y > scene.height + a.radius) return bounded(fallback);
    return bounded({ x: a.x + dx * (a.radius + 45 * scale), y: a.y + dy * (a.radius + 45 * scale) });
  };
  const targetBody = (name: string, fallback: Point) => body(name, 0, 0, fallback);
  const safePosition = (p: Point): Point => {
    if (!sun) return p;
    const dx = p.x - sun.x, dy = p.y - sun.y;
    const distance = Math.hypot(dx, dy), clearance = sun.radius + 40 * scale;
    if (distance >= clearance) return p;
    return bounded({ x: sun.x + (distance > .01 ? dx / distance : 1) * clearance,
      y: sun.y + (distance > .01 ? dy / distance : 0) * clearance });
  };
  const local = ((time + OFFSETS[id]) % CYCLE + CYCLE) % CYCLE;
  const phase = local / CYCLE;
  const p = route(phase);
  const frame: HeroFrame = { id, ...p, angle: 0, scale, opacity: 1, time, phase,
    pose: id === 'silverSurfer' ? 'surf' : 'flight', thrust: .8, effect: 0,
    action: 'КОСМИЧЕСКИЙ ПАТРУЛЬ', target: null, trail: [] };
  let actionPoint: Point;
  if (id === 'ironMan') {
    actionPoint = scene.station ? bounded({ x: scene.station.x - 22 * scale, y: scene.station.y - 35 * scale }) : body('earth', 1.1, -.6, route(.27));
  } else if (id === 'thor') {
    actionPoint = body('jupiter', -.7, -1, route(.27));
  } else if (id === 'silverSurfer') {
    actionPoint = body('saturn', 1.5, -.8, route(.27));
  } else if (id === 'captainMarvel') {
    actionPoint = body('mars', .7, -.8, route(.27));
  } else {
    actionPoint = body('neptune', -.9, -.8, route(.27));
  }
  const hold = { x: actionPoint.x, y: actionPoint.y + Math.sin(time * 1.8 + index) * 2 * scale };
  const positionAt = (t: number): Point => {
    const u = ((t % CYCLE) + CYCLE) % CYCLE;
    if (u < 12) return safePosition(route(u / CYCLE));
    if (u < 19) return safePosition(mix(route(12 / CYCLE), actionPoint, ease((u - 12) / 7)));
    if (u < 35) return safePosition(hold);
    if (u < 43) return safePosition(mix(actionPoint, route(43 / CYCLE), ease((u - 35) / 8)));
    return safePosition(route(u / CYCLE));
  };
  const pos = positionAt(local);
  frame.x = pos.x; frame.y = pos.y;
  const before = positionAt(local - .06), after = positionAt(local + .06);
  const moving = local < 19 || local >= 35;
  frame.angle = moving ? Math.atan2(after.y - before.y, after.x - before.x) + Math.PI / 2 : Math.sin(time * .9) * .04;
  frame.thrust = moving ? .75 + Math.sin(time * 13) * .12 : .15;
  if (moving) {
    for (let i = 1; i <= 10; i++) frame.trail.push(positionAt(local - i * .16));
  }
  if (local >= 19 && local < 35) {
    frame.phase = (local - 19) / 16;
    frame.thrust = .18;
    frame.effect = Math.sin(Math.PI * clamp((local - 19) / 16, 0, 1));
    if (id === 'ironMan') {
      frame.pose = scene.station ? 'repair' : 'scan';
      frame.action = scene.station ? 'РЕМОНТ АНТЕННЫ' : 'СКАНИРОВАНИЕ ЗЕМЛИ';
      frame.target = scene.station ?? targetBody('earth', center);
    } else if (id === 'thor') {
      frame.pose = 'hammer'; frame.action = frame.phase < .5 ? 'БРОСОК МЬЁЛЬНИРА' : 'ВОЗВРАЩЕНИЕ МОЛОТА';
      const flight = Math.sin(Math.PI * frame.phase);
      const target = bounded({ x: pos.x + 140 * scale, y: pos.y - 40 * scale });
      frame.target = target;
      const hand = { x: pos.x + 24 * scale, y: pos.y - 7 * scale };
      frame.hammer = { ...mix(hand, target, flight), angle: time * 11, returning: frame.phase > .5 };
    } else if (id === 'silverSurfer') {
      frame.pose = 'surf'; frame.action = 'ИССЛЕДОВАНИЕ КОЛЕЦ';
      frame.x += Math.sin(frame.phase * TAU) * 36 * scale;
      frame.y -= Math.sin(frame.phase * Math.PI) * 24 * scale;
      frame.angle = Math.sin(frame.phase * TAU) * .28;
      frame.target = targetBody('saturn', center);
    } else if (id === 'captainMarvel') {
      frame.pose = 'blast'; frame.action = frame.phase < .55 ? 'ПЕРЕХВАТ МЕТЕОРА' : 'ФОТОННЫЙ ИМПУЛЬС';
      const target = bounded({ x: pos.x + 125 * scale, y: pos.y - 13 * scale });
      frame.target = target;
      frame.meteor = { ...target, radius: 9 * scale * (frame.phase > .68 ? 1 - ease((frame.phase - .68) / .32) : 1) };
    } else {
      frame.pose = 'scan'; frame.action = 'СКАНИРОВАНИЕ ПРОСТРАНСТВА';
      frame.target = targetBody('neptune', center);
    }
  } else if (id === 'silverSurfer') {
    frame.action = 'МАНЁВР НА ДОСКЕ';
  } else if (id === 'captainMarvel') {
    frame.action = 'ФОТОННЫЙ ПОЛЁТ';
  } else if (id === 'thor') {
    frame.action = 'ПОЛЁТ С МЬЁЛЬНИРОМ';
  }
  return frame;
}
