import { VILLAIN_DETAILS, type BattleFrame, type VillainFrame } from './marvelBattle';
import { HERO_IDS, type HeroFrame, type Point } from './marvelHeroes';

type Ctx = CanvasRenderingContext2D;
type Paint = string | CanvasGradient;
type Palette = { shade: string; mid: string; light: string; edge: string };
const TAU = Math.PI * 2;
const GOLD: Palette = { shade: '#69401b', mid: '#c1994e', light: '#ffe9b0', edge: '#292533' };
const CHROME: Palette = { shade: '#20313f', mid: '#89a1ae', light: '#edfaff', edge: '#101924' };
const BLACK: Palette = { shade: '#08121d', mid: '#263a50', light: '#60758b', edge: '#090d19' };
const PURPLE: Palette = { shade: '#372141', mid: '#9467a7', light: '#d6a3c8', edge: '#251729' };
const MAGENTA: Palette = { shade: '#3b173b', mid: '#a24493', light: '#efacd9', edge: '#201026' };

function line(c: Ctx, points: number[], color: Paint, width = 1) {
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.stroke();
}

function polygon(c: Ctx, points: number[], fill: Paint, edge?: string, width = .65) {
  c.fillStyle = fill; c.beginPath(); c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath(); c.fill();
  if (edge) { c.strokeStyle = edge; c.lineWidth = width; c.lineJoin = 'round'; c.stroke(); }
}

function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, paint: Paint, angle = 0) {
  c.fillStyle = paint; c.beginPath(); c.ellipse(x, y, rx, ry, angle, 0, TAU); c.fill();
}

function metal(c: Ctx, x: number, width: number, palette: Palette, y = 0) {
  const g = c.createLinearGradient(x, y, x + width, y + width * .1);
  g.addColorStop(0, palette.shade); g.addColorStop(.29, palette.mid);
  g.addColorStop(.42, palette.light); g.addColorStop(.59, palette.mid); g.addColorStop(1, palette.shade);
  return g;
}

function segment(c: Ctx, from: Point, to: Point, width: number, palette: Palette) {
  const length = Math.max(.01, Math.hypot(to.x - from.x, to.y - from.y));
  c.save(); c.translate(from.x, from.y); c.rotate(Math.atan2(to.y - from.y, to.x - from.x));
  const g = c.createLinearGradient(0, -width / 2, 0, width / 2);
  g.addColorStop(0, palette.shade); g.addColorStop(.32, palette.light); g.addColorStop(.58, palette.mid); g.addColorStop(1, palette.shade);
  c.fillStyle = g; c.strokeStyle = palette.edge; c.lineWidth = .65;
  c.beginPath(); c.roundRect(-width * .1, -width / 2, length + width * .2, width, width * .28); c.fill(); c.stroke();
  line(c, [length * .13, -width * .3, length * .84, -width * .3], palette.light, .45);
  line(c, [length * .84, -width * .45, length * .84, width * .45], palette.edge, .65);
  c.restore();
}

function glow(c: Ctx, p: Point, radius: number, color: string, opacity = 1) {
  if (radius <= 0 || opacity <= 0) return;
  c.save(); c.globalAlpha *= Math.min(1, opacity); c.globalCompositeOperation = 'screen';
  const gradient = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
  gradient.addColorStop(0, '#fff5e5'); gradient.addColorStop(.13, color); gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ellipse(c, p.x, p.y, radius, radius, gradient); c.restore();
}

function world(frame: Pick<VillainFrame, 'x' | 'y' | 'angle' | 'scale' | 'facing'> | HeroFrame, x: number, y: number): Point {
  const mirrored = x * (frame.facing ?? 1), co = Math.cos(frame.angle), si = Math.sin(frame.angle);
  return { x: frame.x + (mirrored * co - y * si) * frame.scale,
    y: frame.y + (mirrored * si + y * co) * frame.scale };
}

function weapon(frame: VillainFrame) {
  return world(frame, frame.id === 'galactus' ? 28 : 29, frame.id === 'galactus' ? -15 : -11);
}

function hand(frame: VillainFrame, side: number): Point {
  if (side > 0 && (frame.pose === 'charge' || frame.pose === 'attack')) return { x: frame.id === 'galactus' ? 27 : 28, y: frame.id === 'galactus' ? -15 : -11 };
  const stagger = frame.pose === 'stagger';
  return { x: side * (stagger ? 23 : 17), y: stagger ? -1 : 6 + Math.sin(frame.time * 2 + side) };
}

function limbs(c: Ctx, frame: VillainFrame, palette: Palette, accent: Palette, bulky: boolean) {
  for (const side of [-1, 1]) {
    const h = hand(frame, side), raised = h.y < -8;
    const elbow = { x: side * (raised ? 20 : 15), y: raised ? -15 : -5 };
    const knee = { x: side * 7.4, y: 20 + Math.sin(frame.time * 1.9 + side) * .6 };
    const foot = { x: side * 10, y: 38 };
    segment(c, { x: side * 4.8, y: 6 }, knee, bulky ? 8 : 6.3, palette);
    ellipse(c, knee.x, knee.y, bulky ? 4.6 : 3.6, 3.5, metal(c, knee.x - 4, 8, accent));
    segment(c, knee, foot, bulky ? 7 : 5.7, accent);
    polygon(c, [foot.x - 4.2, 34, foot.x + 3.1, 34, foot.x + 5, 41, foot.x - 4.7, 41.5, foot.x - 5, 39], metal(c, foot.x - 5, 10, accent), accent.edge);
    line(c, [foot.x - 3.7, 40.5, foot.x + 3.8, 40.5], accent.light, .55);
    segment(c, { x: side * 10.5, y: -20 }, elbow, bulky ? 8 : 6.1, palette);
    ellipse(c, elbow.x, elbow.y, bulky ? 3.8 : 3, 3, palette.shade);
    segment(c, elbow, h, bulky ? 7 : 5.6, accent);
    ellipse(c, h.x, h.y, bulky ? 3.4 : 2.7, bulky ? 3.8 : 3.1, metal(c, h.x - 4, 8, accent));
    line(c, [h.x - 1.8, h.y, h.x + 1.5, h.y], accent.shade, .55);
  }
}

function torso(c: Ctx, palette: Palette, width = 12) {
  polygon(c, [-width, -23, -5, -26, 5, -26, width, -23, width + .8, -14, 7, 1, 6, 8, -6, 8, -7, 1, -width - .8, -14], metal(c, -width, width * 2, palette), palette.edge, .85);
  polygon(c, [-6.5, 5, 6.5, 5, 7, 11, 0, 13, -7, 11], metal(c, -7, 14, palette), palette.edge);
  line(c, [-6, 5, 6, 5], palette.light, .8);
  segment(c, { x: 0, y: -29 }, { x: 0, y: -23 }, 6, palette);
}

function thanos(c: Ctx, frame: VillainFrame, effects: boolean) {
  limbs(c, frame, BLACK, GOLD, true); torso(c, BLACK, 14);
  // Wide shoulder plates and layered collar establish the Titan's heavy build.
  for (const side of [-1, 1]) {
    polygon(c, [side * 6, -26, side * 16, -25, side * 17, -18, side * 11, -16, side * 8, -22], metal(c, side > 0 ? 6 : -17, 11, GOLD), '#554124');
    line(c, [side * 9, -23.5, side * 14, -21.8], '#ffe2a1', .65);
  }
  polygon(c, [-6, -25, 0, -21, 6, -25, 8, -19, 2.5, -16, -2.5, -16, -8, -19], metal(c, -8, 16, GOLD), GOLD.edge);
  polygon(c, [-11, -18, -5, -16, -5, -9, -8, -6], metal(c, -11, 7, GOLD), GOLD.shade, .45);
  polygon(c, [11, -18, 5, -16, 5, -9, 8, -6], metal(c, 5, 7, GOLD), GOLD.shade, .45);
  line(c, [-5.5, -10, 0, -8, 5.5, -10], '#8899a9', .7);
  for (let i = 0; i < 3; i++) line(c, [-5 + i, -4 + i * 2, 5 - i, -4 + i * 2], '#746350', .75);
  ellipse(c, 0, -34.3, 6.7, 7.5, metal(c, -7, 14, PURPLE));
  polygon(c, [-6.5, -34, -5.2, -27.8, -2.6, -25.4, 2.6, -25.4, 5.2, -27.8, 6.5, -34], metal(c, -7, 14, PURPLE), PURPLE.edge, .6);
  ellipse(c, -6.3, -33.3, 1.2, 2, '#8e5f99'); ellipse(c, 6.3, -33.3, 1.2, 2, '#684770');
  line(c, [-4.4, -35.6, -1.7, -35.1], '#3e284c', .9); line(c, [1.7, -35.1, 4.4, -35.6], '#3e284c', .9);
  line(c, [-4.1, -34.8, -2, -34.5], '#d1b9de', .6); line(c, [2, -34.5, 4.1, -34.8], '#d1b9de', .6);
  line(c, [.4, -34, .8, -31.3, -.5, -30.9], '#593b62', .55);
  line(c, [-3, -29.9, 3, -29.9], '#382339', .7);
  for (let i = 0; i < 5; i++) line(c, [-3.1 + i * 1.55, -28.8, -2.8 + i * 1.4, -26.4], '#5c3b63', .45);
  line(c, [-3, -39.2, 1, -40, 3.3, -39.4], '#c291be', .6);
  const h = hand(frame, 1);
  c.save(); c.translate(h.x, h.y); c.rotate(-.2);
  polygon(c, [-5, -8, 4, -8, 5.4, -1.2, 4, 6, -3, 6, -5.4, -1], metal(c, -6, 12, GOLD), GOLD.edge);
  for (let i = 0; i < 4; i++) segment(c, { x: -3.6 + i * 2, y: -5 }, { x: -3.9 + i * 2.1, y: -9.2 - Math.sin(i) * .7 }, 1.8, GOLD);
  const gems = ['#ed414d', '#79b8ff', '#ffc960', '#bc6aff', '#75dc95', '#ffa253'];
  for (let i = 0; i < 4; i++) ellipse(c, -3.5 + i * 2.05, -5.7, .8, 1, gems[i]);
  ellipse(c, 0, -.1, 1.55, 1.8, gems[4]); ellipse(c, 4.7, 1.8, .9, 1.1, gems[5]);
  line(c, [-3, 3.4, 2.6, 3.4], '#fff0b6', .55);
  if (effects) glow(c, { x: 0, y: -1 }, 7, '#bc83ff', frame.effect * .52);
  c.restore();
}

function drone(c: Ctx, frame: VillainFrame, index: number, effects: boolean) {
  const a = frame.time * .8 + index * TAU / 3;
  const x = Math.cos(a) * 43, y = -4 + Math.sin(a) * 23;
  c.save(); c.translate(x, y); c.rotate(Math.sin(a) * .22);
  polygon(c, [-6, -2, -11, -5, -10, 1, -5, 3], metal(c, -11, 7, CHROME), '#243342');
  polygon(c, [6, -2, 11, -5, 10, 1, 5, 3], metal(c, 5, 7, CHROME), '#243342');
  ellipse(c, 0, 0, 6, 3.8, metal(c, -6, 12, CHROME));
  line(c, [-4.1, -.1, 4.1, -.1], '#461921', 2); line(c, [-3.2, -.3, 3.2, -.3], '#ff7772', .85);
  ellipse(c, 0, 3.2, 1.2, .8, '#546e80');
  if (effects) glow(c, { x: 0, y: -.3 }, 6, '#ff5c63', .27 + frame.effect * .2);
  c.restore();
}

function ultron(c: Ctx, frame: VillainFrame, effects: boolean) {
  for (let i = 0; i < 3; i++) drone(c, frame, i, effects);
  limbs(c, frame, CHROME, CHROME, false); torso(c, BLACK, 10.5);
  for (const side of [-1, 1]) {
    polygon(c, [side * 5.5, -25, side * 11.8, -24, side * 13.3, -19, side * 8.6, -17], metal(c, side > 0 ? 5 : -13, 8, CHROME), CHROME.edge);
    polygon(c, [side * .9, -22, side * 8.5, -22, side * 8, -14, side * 2, -12], metal(c, side > 0 ? 0 : -9, 9, CHROME), CHROME.edge);
    for (let i = 0; i < 4; i++) {
      const y = -11 + i * 3.6;
      polygon(c, [side * 1, y, side * 6.5, y - 1, side * 5.7, y + 1.9, side * 1.3, y + 2.2], metal(c, side > 0 ? 1 : -7, 7, CHROME), '#182938', .5);
    }
    const elbow = { x: side * 15, y: -5 };
    line(c, [side * 11, -16, elbow.x + side * 1.5, elbow.y - 2], '#aec8d3', .9);
    line(c, [side * 6, 12, side * 9, 29], '#e0eef0', .8);
  }
  line(c, [0, -20, 0, 2], '#9db0b7', 1.1);
  ellipse(c, 0, -15.5, 2.7, 2.7, '#391d28'); ellipse(c, 0, -15.5, 1.75, 1.75, '#fc6c60');
  if (effects) glow(c, { x: 0, y: -15.5 }, 7, '#ff7668', .35);
  polygon(c, [-5.8, -38.4, -2.8, -42, 2.8, -42, 5.8, -38.4, 6.2, -31, 3.3, -26.7, -3.3, -26.7, -6.2, -31], metal(c, -7, 14, CHROME), '#172535', .85);
  polygon(c, [-5, -35.4, -1, -34.2, 0, -35.2, 1, -34.2, 5, -35.4, 3.6, -32.5, 1.2, -33, -1.2, -33, -3.6, -32.5], '#171821');
  line(c, [-4.2, -34.5, -1.5, -33.5], '#ff746e', 1); line(c, [1.5, -33.5, 4.2, -34.5], '#ff746e', 1);
  polygon(c, [-3.8, -30.9, -1, -31.7, 1, -31.7, 3.8, -30.9, 2.5, -28.2, -2.5, -28.2], '#281b24');
  for (let i = 0; i < 5; i++) line(c, [-2.5 + i * 1.2, -30.4, -2.3 + i * 1.1, -28.8], '#d98076', .45);
  line(c, [0, -38.9, 0, -36.7], '#ebf5f1', .8);
  polygon(c, [-6, -38, -7.3, -36.2, -7, -30, -5, -31], metal(c, -8, 4, CHROME));
  polygon(c, [6, -38, 7.3, -36.2, 7, -30, 5, -31], metal(c, 5, 4, CHROME));
  const h = hand(frame, 1); ellipse(c, h.x, h.y, 1.4, 1.4, '#ed605b');
}

function galactus(c: Ctx, frame: VillainFrame, effects: boolean) {
  limbs(c, frame, BLACK, MAGENTA, false); torso(c, MAGENTA, 12);
  for (const side of [-1, 1]) {
    polygon(c, [side * 4.5, -25, side * 12, -25, side * 14, -18, side * 8.4, -14, side * 5, -18], metal(c, side > 0 ? 4 : -14, 10, MAGENTA), '#34233e');
    line(c, [side * 7, -22, side * 11, -21, side * 10, -18], '#e7a0d1', .65);
    polygon(c, [side * 1.4, -19, side * 7.7, -17.7, side * 6, -9, side * 1.6, -11], metal(c, side > 0 ? 1 : -8, 8, BLACK), '#28283e');
    line(c, [side * 2.8, -16, side * 5.5, -15, side * 4.8, -11], '#d9a2d4', .5);
  }
  ellipse(c, 0, -17, 2.4, 2.4, '#dfb5e3');
  ellipse(c, 0, -17, 1.5, 1.5, '#7e82dc');
  if (effects) glow(c, { x: 0, y: -17 }, 8, '#eda2ef', frame.effect * .4);
  for (let i = 0; i < 3; i++) polygon(c, [-5.7, -7 + i * 4, 5.7, -7 + i * 4, 4.5, -4.1 + i * 4, -4.5, -4.1 + i * 4], metal(c, -6, 12, BLACK), '#8d558d', .55);
  // Helmet horns are angular structural plates, not oversized cartoon ears.
  for (const side of [-1, 1]) {
    polygon(c, [side * 5, -40, side * 10.5, -43, side * 18.5, -54.5, side * 20, -48.5, side * 13.2, -32.5, side * 6.4, -30], metal(c, side > 0 ? 5 : -20, 15, MAGENTA), '#492647', .75);
    line(c, [side * 8, -38, side * 13.3, -41, side * 18.8, -50], '#f0aed5', .75);
    line(c, [side * 10, -33, side * 13.5, -39, side * 17, -43], '#56234e', .85);
  }
  polygon(c, [-6.8, -41, -4.8, -46, 4.8, -46, 6.8, -41, 7.2, -29.2, 3.9, -25.6, -3.9, -25.6, -7.2, -29.2], metal(c, -8, 16, MAGENTA), '#2f1c35', .85);
  polygon(c, [-4, -34.3, 4, -34.3, 4.2, -28.2, 1.7, -25.9, -1.7, -25.9, -4.2, -28.2], metal(c, -5, 10, PURPLE), '#4a304b', .5);
  polygon(c, [-4.7, -39, -2.2, -36, 2.2, -36, 4.7, -39, 3.9, -34.7, -3.9, -34.7], '#231b39');
  line(c, [-3.7, -33.4, -1.6, -33.2], '#ffb7ce', .85); line(c, [1.6, -33.2, 3.7, -33.4], '#ffb7ce', .85);
  line(c, [.3, -32.2, .7, -29.7, -.3, -29.2], '#582e58', .5);
  line(c, [-1.8, -27.6, 1.8, -27.6], '#502d4c', .6);
  for (let i = 0; i < 3; i++) line(c, [-4.2, -44 + i * 2.2, 4.2, -44 + i * 2.2], i % 2 ? '#5c2f62' : '#cc83c0', .6);
}

function drawVillain(c: Ctx, frame: VillainFrame, effects: boolean) {
  c.save(); c.globalAlpha *= frame.opacity;
  c.translate(frame.x, frame.y); c.rotate(frame.angle); c.scale(frame.scale * frame.facing, frame.scale);
  if (frame.pose === 'stagger') c.rotate(Math.sin(frame.time * 7) * .025);
  if (frame.id === 'thanos') thanos(c, frame, effects);
  else if (frame.id === 'ultron') ultron(c, frame, effects);
  else galactus(c, frame, effects);
  c.restore();
}

function portal(c: Ctx, battle: BattleFrame) {
  if (battle.stage !== 'arrival' && battle.stage !== 'retreat') return;
  const frame = battle.villain;
  const progress = battle.stage === 'arrival' ? Math.min(1, battle.local / 2) * (1 - Math.max(0, (battle.local - 3) / 3)) : Math.max(0, 1 - (battle.local - 36) / 5);
  if (progress <= 0) return;
  const color = VILLAIN_DETAILS[frame.id].color, radius = 48 * frame.scale;
  c.save(); c.globalAlpha *= progress * .75;
  const p = { x: frame.x - 9 * frame.scale * frame.facing, y: frame.y - 2 * frame.scale };
  glow(c, p, radius * 1.3, color, .12);
  c.translate(p.x, p.y); c.scale(.66, 1);
  for (let i = 0; i < 3; i++) {
    c.strokeStyle = i === 1 ? '#ebe3ff' : color; c.lineWidth = (i === 1 ? .65 : 1.15) * frame.scale;
    c.beginPath(); c.arc(0, 0, radius - i * 3 * frame.scale, battle.time * .6 + i * .8, battle.time * .6 + i * .8 + Math.PI * 1.6); c.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const a = i * TAU / 12 + battle.time * .4, r = radius * (1 + .035 * Math.sin(battle.time * 4 + i));
    line(c, [Math.cos(a) * r, Math.sin(a) * r, Math.cos(a + .06) * r, Math.sin(a + .06) * r], color, 1.1 * frame.scale);
  }
  c.restore();
}

function beam(c: Ctx, from: Point, to: Point, color: string, width: number, strength: number) {
  if (strength <= 0 || Math.hypot(to.x - from.x, to.y - from.y) < .1) return;
  c.save(); c.globalAlpha *= strength;
  c.save(); c.globalAlpha *= .15; line(c, [from.x, from.y, to.x, to.y], color, width * 3.7); c.restore();
  c.save(); c.globalAlpha *= .42; line(c, [from.x, from.y, to.x, to.y], color, width * 1.75); c.restore();
  line(c, [from.x, from.y, to.x, to.y], '#f9f4e8', Math.max(.65, width * .28));
  glow(c, from, width * 4.5, color, .5); c.restore();
}

function attack(c: Ctx, battle: BattleFrame) {
  if (battle.attack <= .01) return;
  const frame = battle.villain, start = weapon(frame), end = battle.intercept;
  const color = VILLAIN_DETAILS[frame.id].color;
  const pulse = .7 + Math.sin(battle.time * (frame.id === 'galactus' ? 5 : 11)) * .2;
  if (frame.id === 'galactus') {
    beam(c, start, end, color, 5.3 * frame.scale, battle.attack * pulse);
    for (let i = 0; i < 2; i++) {
      const p = (battle.time * .6 + i * .5) % 1;
      const x = start.x + (end.x - start.x) * p, y = start.y + (end.y - start.y) * p;
      c.save(); c.globalAlpha *= (1 - p) * battle.attack * .62;
      c.strokeStyle = '#e9adee'; c.lineWidth = .85 * frame.scale;
      c.beginPath(); c.ellipse(x, y, 7 * frame.scale, 3.5 * frame.scale, Math.atan2(end.y - start.y, end.x - start.x) + Math.PI / 2, 0, TAU); c.stroke(); c.restore();
    }
  } else if (frame.id === 'ultron') {
    beam(c, start, end, '#ff6d69', 2 * frame.scale, battle.attack * pulse);
    for (let i = 0; i < 3; i++) {
      const a = frame.time * .8 + i * TAU / 3;
      const d = world(frame, Math.cos(a) * 43, -4 + Math.sin(a) * 23);
      c.save(); c.globalAlpha *= .65;
      beam(c, d, end, '#ed5b5f', .85 * frame.scale, battle.attack * Math.max(0, Math.sin(battle.time * 2.2 + i * 1.7)));
      c.restore();
    }
  } else {
    c.save(); c.globalAlpha *= .35;
    beam(c, start, end, color, 2.1 * frame.scale, battle.attack * pulse); c.restore();
  }
  // A fixed four-projectile pool makes the attack's direction unambiguous.
  for (let i = 0; i < 4; i++) {
    const p = (battle.attackProgress + i / 4) % 1;
    const x = start.x + (end.x - start.x) * p, y = start.y + (end.y - start.y) * p;
    const dx = end.x - start.x, dy = end.y - start.y, length = Math.max(1, Math.hypot(dx, dy));
    c.save(); c.globalAlpha *= battle.attack * (.5 + .5 * Math.sin(Math.PI * p));
    glow(c, { x, y }, (frame.id === 'thanos' ? 8 : 5) * frame.scale, color, .75);
    line(c, [x - dx / length * 7 * frame.scale, y - dy / length * 7 * frame.scale, x, y], color, 1.7 * frame.scale);
    ellipse(c, x, y, 1.4 * frame.scale, 1.4 * frame.scale, '#f8e7ff'); c.restore();
  }
}

function label(c: Ctx, battle: BattleFrame) {
  const frame = battle.villain, details = VILLAIN_DETAILS[frame.id];
  const y = frame.y + 51 * frame.scale;
  const text = `${details.name} · ${battle.planet.name}`;
  c.save(); c.globalAlpha *= frame.opacity;
  c.font = '600 9px "JetBrains Mono", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const width = Math.max(c.measureText(text).width, c.measureText(frame.action).width) + 16;
  c.fillStyle = 'rgba(10,10,24,.8)'; c.beginPath(); c.roundRect(frame.x - width / 2, y - 7, width, 29, 3); c.fill();
  c.fillStyle = details.color; c.fillText(text, frame.x, y);
  c.font = '400 8px "JetBrains Mono", monospace'; c.fillStyle = '#d4bacf'; c.fillText(frame.action, frame.x, y + 12);
  c.fillStyle = '#362334'; c.fillRect(frame.x - width / 2 + 6, y + 19, width - 12, 1.8);
  c.fillStyle = details.color; c.fillRect(frame.x - width / 2 + 6, y + 19, (width - 12) * Math.max(0, battle.villainHealth), 1.8);
  c.restore();
}

function shield(c: Ctx, battle: BattleFrame) {
  if (battle.shield <= .01) return;
  const p = battle.planet, enemy = battle.villain;
  const radius = p.radius + Math.hypot(battle.intercept.x - p.x, battle.intercept.y - p.y) - p.radius;
  const angle = Math.atan2(enemy.y - p.y, enemy.x - p.x);
  c.save(); c.globalAlpha *= battle.shield;
  const g = c.createRadialGradient(p.x, p.y, p.radius * .8, p.x, p.y, radius + 5);
  g.addColorStop(0, 'rgba(70,180,255,0)'); g.addColorStop(.73, 'rgba(78,159,221,.015)');
  g.addColorStop(.96, 'rgba(137,220,255,.2)'); g.addColorStop(1, 'rgba(192,239,255,0)');
  c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, radius + 5, angle - 1.5, angle + 1.5);
  c.arc(p.x, p.y, p.radius * .8, angle + 1.5, angle - 1.5, true); c.closePath(); c.fill();
  for (let i = 0; i < 3; i++) {
    c.save(); c.globalAlpha *= i === 0 ? .85 : .22;
    c.strokeStyle = i === 0 ? '#b7efff' : '#79bceb'; c.lineWidth = i === 0 ? 1.1 : .55;
    c.beginPath(); c.arc(p.x, p.y, radius - i * 3, angle - 1.45, angle + 1.45); c.stroke(); c.restore();
  }
  // A curved grid suggests an energy membrane without obscuring the planet.
  for (let i = 0; i < 9; i++) {
    const a = angle - 1.25 + i * .31, inner = radius - 7;
    line(c, [p.x + Math.cos(a - .025) * inner, p.y + Math.sin(a - .025) * inner,
      p.x + Math.cos(a) * (radius + 1), p.y + Math.sin(a) * (radius + 1),
      p.x + Math.cos(a + .025) * inner, p.y + Math.sin(a + .025) * inner], 'rgba(117,195,232,.34)', .5);
  }
  glow(c, battle.intercept, 13 * Math.min(1.1, enemy.scale), '#b0e9ff', battle.attack * .48);
  c.restore();
}

function sparks(c: Ctx, origin: Point, time: number, scale: number, color: string, strength: number, count: number) {
  if (strength <= .01) return;
  for (let i = 0; i < count; i++) {
    const age = (time * (1.1 + i % 3 * .09) + i / count) % 1;
    const a = i * 2.399 + Math.sin(i * 4) * .15, radius = (2 + age * (14 + i % 4 * 3)) * scale;
    const x = origin.x + Math.cos(a) * radius, y = origin.y + Math.sin(a) * radius;
    c.save(); c.globalAlpha *= strength * (1 - age) * .85;
    line(c, [x, y, x + Math.cos(a) * (1.8 + age * 3) * scale, y + Math.sin(a) * (1.8 + age * 3) * scale], i % 3 ? color : '#fff3df', (.7 + i % 2 * .3) * scale);
    c.restore();
  }
}

function lightning(c: Ctx, from: Point, to: Point, battle: BattleFrame, scale: number) {
  const dx = to.x - from.x, dy = to.y - from.y, length = Math.max(.1, Math.hypot(dx, dy));
  const points = [from.x, from.y];
  for (let i = 1; i < 11; i++) {
    const p = i / 11, offset = Math.sin(battle.time * 24 + i * 4.9) * 6 * scale * Math.sin(Math.PI * p);
    points.push(from.x + dx * p - dy / length * offset, from.y + dy * p + dx / length * offset);
  }
  points.push(to.x, to.y);
  c.save(); c.globalAlpha *= battle.counter;
  c.save(); c.globalAlpha *= .24; line(c, points, '#91aaff', 5 * scale); c.restore();
  line(c, points, '#9cbeff', 1.6 * scale); line(c, points, '#ebf5ff', .62 * scale);
  const mid = { x: from.x + dx * .63, y: from.y + dy * .63 };
  line(c, [mid.x, mid.y, mid.x - dy / length * 9 * scale, mid.y + dx / length * 9 * scale,
    mid.x + dx * .1 - dy / length * 18 * scale, mid.y + dy * .1 + dx / length * 18 * scale], '#94c4ff', .65 * scale);
  c.restore();
}

function defenders(c: Ctx, battle: BattleFrame) {
  if (battle.counter <= .01) return;
  const end = world(battle.villain, 0, -10);
  for (const id of HERO_IDS) {
    const hero = battle.defenders[id]; if (!hero?.combat) continue;
    const start = world(hero, id === 'silverSurfer' ? 26 : 24, id === 'silverSurfer' ? -8 : -8), s = hero.scale;
    const pulse = .7 + Math.sin(battle.time * 9 + HERO_IDS.indexOf(id)) * .2;
    if (id === 'ironMan') {
      beam(c, start, end, '#91e5ff', 2.9 * s, battle.counter * pulse);
      const reactor = world(hero, 0, -12.1);
      c.save(); c.globalAlpha *= .36; beam(c, reactor, end, '#bdefff', 1.7 * s, battle.counter); c.restore();
      c.save(); c.globalAlpha *= battle.counter * .65;
      c.strokeStyle = '#b9eeff'; c.lineWidth = .7 * s;
      c.beginPath(); c.arc(reactor.x, reactor.y, 4.5 * s + Math.sin(battle.time * 5) * .65, 0, TAU); c.stroke(); c.restore();
    } else if (id === 'thor') {
      lightning(c, start, end, battle, s);
      if (hero.hammer) glow(c, hero.hammer, 8 * s, '#a2c5ff', battle.counter * .35);
    } else if (id === 'silverSurfer') {
      const dx = end.x - start.x, dy = end.y - start.y, length = Math.max(1, Math.hypot(dx, dy));
      for (let band = 0; band < 2; band++) {
        const points: number[] = [];
        for (let i = 0; i <= 12; i++) {
          const p = i / 12, wave = Math.sin(p * TAU * 2 - battle.time * 7 + band * Math.PI) * 3.5 * s * Math.sin(Math.PI * p);
          points.push(start.x + dx * p - dy / length * wave, start.y + dy * p + dx / length * wave);
        }
        c.save(); c.globalAlpha *= battle.counter * (band ? .65 : .4);
        line(c, points, band ? '#d8faff' : '#7be0e5', (band ? .9 : 3.4) * s); c.restore();
      }
      glow(c, start, 9 * s, '#c3f5ff', battle.counter * .4);
    } else if (id === 'captainMarvel') {
      beam(c, start, end, '#ffc56c', 3.8 * s, battle.counter * pulse);
      const secondHand = world(hero, -15, 5);
      c.save(); c.globalAlpha *= .65; beam(c, secondHand, end, '#ffb758', 1.9 * s, battle.counter * pulse); c.restore();
    } else {
      const a = Math.atan2(end.y - start.y, end.x - start.x);
      for (let i = 0; i < 4; i++) {
        const p = (battle.time * .82 + i / 4) % 1;
        const x = start.x + (end.x - start.x) * p, y = start.y + (end.y - start.y) * p;
        c.save(); c.globalAlpha *= battle.counter * Math.sin(Math.PI * Math.max(.08, p));
        line(c, [x - Math.cos(a) * 7 * s, y - Math.sin(a) * 7 * s, x, y], i % 2 ? '#9edbff' : '#f7d37e', 1.9 * s);
        glow(c, { x, y }, 5 * s, i % 2 ? '#87c7ff' : '#eed288', .5);
        c.strokeStyle = i % 2 ? '#d6e9ff' : '#fbe1a1'; c.lineWidth = .8 * s;
        c.beginPath(); c.ellipse(x, y, 2.2 * s, 4 * s, a, 0, TAU); c.stroke(); c.restore();
      }
      glow(c, start, 7 * s, '#94cbff', battle.counter * .4);
    }
  }
}

function brokenMissiles(c: Ctx, battle: BattleFrame) {
  if (battle.shield < .2 || battle.attack <= .01) return;
  const p = battle.intercept, scale = Math.min(1.1, battle.villain.scale);
  const color = VILLAIN_DETAILS[battle.villain.id].color;
  for (let i = 0; i < 6; i++) {
    const age = (battle.time * 1.2 + i / 6) % 1, a = i * 2.39;
    const x = p.x + Math.cos(a) * age * 20 * scale, y = p.y + Math.sin(a) * age * 20 * scale;
    c.save(); c.globalAlpha *= battle.attack * battle.shield * (1 - age) * .67;
    c.translate(x, y); c.rotate(a + age * 5);
    polygon(c, [-1.3 * scale, -.6 * scale, 2.1 * scale, -.4 * scale, .4 * scale, 1.1 * scale], color);
    c.restore();
  }
}

function victory(c: Ctx, battle: BattleFrame) {
  if (battle.victory <= .01) return;
  const p = world(battle.villain, 0, -5), s = Math.min(1.1, battle.villain.scale);
  for (let i = 0; i < 3; i++) {
    const progress = Math.max(0, Math.min(1, (battle.local - 30 - i * .55) / 3.8));
    if (progress <= 0 || progress >= 1) continue;
    c.save(); c.globalAlpha *= (1 - progress) * battle.victory * .65;
    c.strokeStyle = i % 2 ? '#ffd68f' : '#bdeeff'; c.lineWidth = (1.3 - progress * .7) * s;
    c.beginPath(); c.ellipse(p.x, p.y, (11 + progress * 30) * s, (7 + progress * 19) * s, battle.time * .12, 0, TAU); c.stroke(); c.restore();
  }
}

function badge(c: Ctx, battle: BattleFrame) {
  if (battle.stage !== 'assault' && battle.stage !== 'repelled') return;
  const text = battle.stage === 'assault' ? 'АТАКА ПЛАНЕТЫ' : 'АТАКА ОТРАЖЕНА';
  const x = battle.planet.x, y = battle.planet.y + battle.planet.radius + 24;
  c.save(); c.globalAlpha *= battle.stage === 'repelled' ? Math.min(1, battle.victory + .35) : .75;
  c.font = '600 8px "JetBrains Mono", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const width = c.measureText(text).width + 12;
  c.fillStyle = 'rgba(6,14,25,.78)'; c.beginPath(); c.roundRect(x - width / 2, y - 7, width, 14, 3); c.fill();
  c.fillStyle = battle.stage === 'repelled' ? '#a6e5d6' : '#ffc0ac'; c.fillText(text, x, y); c.restore();
}

/** Actor and incoming attacks sit below the defenders. Disabling effects preserves each villain and its drones. */
export function drawBattleBackdrop(c: Ctx, battle: BattleFrame, options: { effects: boolean; showLabel: boolean }) {
  if (![battle.villain.x, battle.villain.y, battle.villain.scale, battle.villain.opacity].every(Number.isFinite) || battle.villain.scale <= 0) return;
  c.save();
  if (options.effects) { portal(c, battle); attack(c, battle); }
  drawVillain(c, battle.villain, options.effects);
  if (options.showLabel) label(c, battle);
  c.restore();
}

/** Coordinated impacts and distinct hero weapons share the encounter's stage and real projected planet position. */
export function drawBattleForeground(c: Ctx, battle: BattleFrame, options: { effects: boolean }) {
  c.save();
  if (options.effects) {
    shield(c, battle); defenders(c, battle); brokenMissiles(c, battle);
    const scale = Math.min(1.1, battle.villain.scale);
    sparks(c, battle.intercept, battle.time, scale, '#bfeeff', battle.attack * battle.shield, 12);
    const enemy = world(battle.villain, 0, -9);
    sparks(c, enemy, battle.time + .47, scale, '#ffcc87', battle.counter * .65 + battle.victory * .4, 12);
    if (battle.counter > .01) glow(c, enemy, 18 * scale, '#e8edff', battle.counter * (.22 + Math.sin(battle.time * 16) * .07));
    victory(c, battle);
  }
  badge(c, battle);
  c.restore();
}
