import type { ActivitySettings } from './activitySettings';
import { HERO_IDS, heroFrame, type HeroFrame, type HeroId, type HeroScene, type Point } from './marvelHeroes';

export const VILLAIN_IDS = ['thanos', 'ultron', 'galactus'] as const;
export type VillainId = typeof VILLAIN_IDS[number];
export const BATTLE_CYCLE = 48;
export const VILLAIN_DETAILS: Record<VillainId, { name: string; color: string; mission: string }> = {
  thanos: { name: 'ТАНОС', color: '#bc83ff', mission: 'Энергетические залпы Перчатки Бесконечности' },
  ultron: { name: 'АЛЬТРОН', color: '#ff6862', mission: 'Атака лазерами и боевыми дронами' },
  galactus: { name: 'ГАЛАКТУС', color: '#ee70df', mission: 'Космический луч, направленный на планету' },
};
export type BattleStage = 'arrival' | 'assault' | 'clash' | 'repelled' | 'retreat';
export interface VillainFrame {
  id: VillainId; x: number; y: number; angle: number; facing: 1 | -1;
  scale: number; opacity: number; time: number; phase: number;
  pose: 'arrival' | 'charge' | 'attack' | 'stagger' | 'retreat';
  action: string; target: Point; effect: number;
}
export interface BattleFrame {
  time: number; local: number; cycle: number; stage: BattleStage;
  attackAngle: number;
  villain: VillainFrame;
  planet: Point & { id: string; name: string; radius: number };
  intercept: Point;
  shield: number; attack: number; counter: number; victory: number;
  villainHealth: number; attackProgress: number;
  defenders: Partial<Record<HeroId, HeroFrame>>;
}
export interface BattleTarget { cycle: number; planetId: string; attackAngle?: number }

const NAMES: Record<string, string> = { earth: 'ЗЕМЛЯ', mars: 'МАРС', jupiter: 'ЮПИТЕР', saturn: 'САТУРН', neptune: 'НЕПТУН', venus: 'ВЕНЕРА', uranus: 'УРАН', mercury: 'МЕРКУРИЙ' };
const TARGET_IDS = Object.keys(NAMES);
const clamp = (t: number) => Math.max(0, Math.min(1, t));
const ease = (t: number) => { const u = clamp(t); return u * u * (3 - 2 * u); };
const mix = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** One coordinated encounter. Victory timing never depends on the selected team size. */
export function battleFrame(time: number, scene: HeroScene, settings: ActivitySettings, chosen?: BattleTarget): BattleFrame | null {
  const heroes = HERO_IDS.filter(id => settings[id]);
  const villains = VILLAIN_IDS.filter(id => settings[id]);
  if (!settings.battles || !heroes.length || !villains.length || !Number.isFinite(time)) return null;
  const cycle = Math.max(0, Math.floor(time / BATTLE_CYCLE));
  const local = ((time % BATTLE_CYCLE) + BATTLE_CYCLE) % BATTLE_CYCLE;
  if (local >= 41) return null;
  const scale = Math.max(.55, Math.min(1.1, scene.width / 1250, scene.height / 720));
  const left = scene.width >= 900 ? 245 : 20;
  const top = scene.width < 640 ? 120 : 38;
  const bottom = Math.max(top + 90, scene.height - scene.bottom - 35);
  const available = TARGET_IDS.filter(id => {
    const p = scene.anchors[id];
    return p && [p.x, p.y, p.radius].every(Number.isFinite) && p.radius > 0 &&
      p.x > left + p.radius && p.x < scene.width - p.radius - 8 &&
      p.y > top + p.radius && p.y < bottom - p.radius;
  });
  if (!available.length) return null;
  const targetId = chosen?.cycle === cycle ? chosen.planetId : available[cycle % available.length];
  // Follow the original planet when the camera moves; never transfer an ongoing raid.
  if (!available.includes(targetId)) return null;
  const anchor = scene.anchors[targetId]!;
  const planet = { ...anchor, id: targetId, name: NAMES[targetId] };
  const id = villains[cycle % villains.length];
  const safe = (p: Point, margin = 32 * scale): Point => ({
    x: Math.max(Math.min(left + margin, scene.width * .4), Math.min(scene.width - margin, p.x)),
    y: Math.max(Math.min(top + margin, bottom * .6), Math.min(bottom - margin, p.y)),
  });
  const avoidSun = (p: Point): Point => {
    const sun = scene.anchors.sun;
    if (!sun) return safe(p);
    const dx = p.x - sun.x, dy = p.y - sun.y, distance = Math.hypot(dx, dy);
    const clear = sun.radius + 42 * scale;
    return distance >= clear ? safe(p) : safe({ x: sun.x + (distance > .01 ? dx / distance : 1) * clear,
      y: sun.y + (distance > .01 ? dy / distance : 0) * clear });
  };
  const reach = planet.radius + (id === 'galactus' ? 200 : 165) * scale;
  const positionAt = (angle: number) => safe({
    x: planet.x + Math.cos(angle) * reach, y: planet.y + Math.sin(angle) * reach,
  }, 55 * scale);
  const score = (p: Point) => {
    const sun = scene.anchors.sun;
    return Math.hypot(p.x - planet.x, p.y - planet.y) -
      (sun ? Math.max(0, sun.radius + 75 * scale - Math.hypot(p.x - sun.x, p.y - sun.y)) * 2 : 0) -
      (scene.station ? Math.max(0, 85 * scale - Math.hypot(p.x - scene.station.x, p.y - scene.station.y)) : 0);
  };
  // Choose a side once per encounter. Tiny score differences between equally distant
  // positions must not mirror the whole formation on consecutive animation frames.
  const attackAngle = chosen?.cycle === cycle && Number.isFinite(chosen.attackAngle)
    ? chosen.attackAngle!
    : [-.55, -2.6, .55, 2.6, -Math.PI / 2, Math.PI / 2].reduce((best, angle) =>
      score(positionAt(angle)) > score(positionAt(best)) + .5 ? angle : best);
  const attackSide: 1 | -1 = Math.cos(attackAngle) < -1e-6 ? -1 : 1;
  let enemy = positionAt(attackAngle);
  const approach = ease(local / 6), retreat = ease((local - 36) / 5);
  const enemyEntry = safe({ x: enemy.x + attackSide * 45 * scale, y: enemy.y - 35 * scale }, 50 * scale);
  enemy = mix(enemyEntry, enemy, approach * (1 - retreat));
  const dx = enemy.x - planet.x, dy = enemy.y - planet.y, distance = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / distance, uy = dy / distance;
  const intercept = { x: planet.x + ux * (planet.radius + 19 * scale), y: planet.y + uy * (planet.radius + 19 * scale) };
  const stage: BattleStage = local < 6 ? 'arrival' : local < 15 ? 'assault' : local < 30 ? 'clash' : local < 36 ? 'repelled' : 'retreat';
  const shield = ease((local - 8) / 6) * (1 - ease((local - 36) / 5));
  const attack = local >= 6 && local < 30 ? ease((local - 6) / 3) * (.72 + Math.sin(local * 2.3) * .12) : 0;
  const counter = local >= 15 && local < 36 ? ease((local - 15) / 2) * (1 - ease((local - 33) / 3)) : 0;
  const victory = local >= 30 ? Math.sin(Math.PI * clamp((local - 30) / 6)) : 0;
  const villainHealth = 1 - ease((local - 15) / 20);
  const villain: VillainFrame = { id, ...enemy, angle: Math.sin(time * 1.5) * .03,
    facing: attackSide === 1 ? -1 : 1, scale: scale * (id === 'galactus' ? 1.55 : 1.1),
    opacity: ease(local / 2) * (1 - ease((local - 38) / 3)), time, phase: local / BATTLE_CYCLE,
    pose: stage === 'arrival' ? 'arrival' : stage === 'assault' ? 'charge' : stage === 'clash' ? 'attack' : stage === 'repelled' ? 'stagger' : 'retreat',
    action: stage === 'arrival' ? 'ПРИБЛИЖЕНИЕ' : stage === 'assault' ? 'АТАКА ПЛАНЕТЫ' : stage === 'clash' ? 'АТАКА ПЕРЕХВАЧЕНА' : stage === 'repelled' ? 'НАПАДЕНИЕ ОТРАЖЕНО' : 'ОТСТУПЛЕНИЕ',
    target: intercept, effect: attack };
  const battle: BattleFrame = { time, local, cycle, stage, attackAngle, villain, planet, intercept, shield, attack, counter, victory,
    villainHealth, attackProgress: (local * .55) % 1, defenders: {} };
  const enemyAngle = Math.atan2(uy, ux);
  const engage = ease((local - 6) / 8) * (1 - ease((local - 36) / 5));
  heroes.forEach((hero, i) => {
    const patrol = heroFrame(hero, time, scene);
    const spread = heroes.length === 1 ? 0 : (i / (heroes.length - 1) - .5) * 2.3;
    const radius = planet.radius + (54 + heroes.length * 3) * scale;
    const guard = avoidSun({ x: planet.x + Math.cos(enemyAngle + spread) * radius,
      y: planet.y + Math.sin(enemyAngle + spread) * radius + Math.sin(time * 1.7 + i) * 2 * scale });
    const point = mix(patrol, guard, engage);
    const defending = local >= 14 && local < 36;
    // Facing comes from the fixed formation, not subpixel screen-coordinate noise.
    const guardDx = Math.cos(attackAngle) * reach - Math.cos(attackAngle + spread) * radius;
    const combatFacing: 1 | -1 = Math.abs(guardDx) < 2 * scale ? attackSide : guardDx > 0 ? 1 : -1;
    const guardAngle = Math.sin(time * .9 + i) * .06;
    const turn = Math.atan2(Math.sin(guardAngle - patrol.angle), Math.cos(guardAngle - patrol.angle));
    const frame: HeroFrame = { ...patrol, ...point, combat: local >= 6,
      facing: defending ? combatFacing : 1,
      angle: patrol.angle + turn * engage,
      pose: defending ? (hero === 'thor' ? 'hammer' : hero === 'silverSurfer' ? 'surf' : 'blast') : patrol.pose,
      thrust: defending ? .22 : patrol.thrust,
      target: defending ? { x: enemy.x, y: enemy.y } : patrol.target,
      phase: clamp((local - 14) / 22), effect: counter, trail: defending ? [] : patrol.trail,
      action: local < 6 ? patrol.action : local < 14 ? 'ПЕРЕХВАТ АТАКИ' : local < 30 ? `ЗАЩИТА: ${planet.name}` : local < 36 ? 'КОНТРАТАКА' : 'ПЛАНЕТА ЗАЩИЩЕНА',
      hammer: undefined, meteor: undefined };
    if (hero === 'thor' && defending) {
      const hand = { x: frame.x + 24 * frame.scale * (frame.facing ?? 1), y: frame.y - 8 * frame.scale };
      const phase = ((local - 14) % 3.6) / 3.6;
      frame.hammer = { ...mix(hand, enemy, Math.sin(Math.PI * phase)), angle: time * 13, returning: phase > .5 };
    }
    if (local < 6) battle.defenders[hero] = patrol;
    else battle.defenders[hero] = frame;
  });
  return battle;
}
