import { HERO_DETAILS, type HeroFrame, type Point } from './marvelHeroes';

type Ctx = CanvasRenderingContext2D;
type Paint = string | CanvasGradient;
type Palette = { dark: string; base: string; light: string; edge: string };
type Joints = { elbow: Point; hand: Point; knee: Point; foot: Point };
const TAU = Math.PI * 2;
const RED: Palette = { dark: '#420e15', base: '#a92d32', light: '#f98670', edge: '#22141e' };
const GOLD: Palette = { dark: '#5d3815', base: '#c99d49', light: '#fff0b4', edge: '#202433' };
const SILVER: Palette = { dark: '#283744', base: '#8babb9', light: '#f7fdff', edge: '#122432' };
const NAVY: Palette = { dark: '#081725', base: '#244966', light: '#7295b1', edge: '#060e18' };
const SKIN: Palette = { dark: '#774f3f', base: '#c69777', light: '#f9d4a3', edge: '#3b3332' };

function stroke(c: Ctx, points: number[], color: Paint, width = 1) {
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.stroke();
}

function poly(c: Ctx, points: number[], fill: Paint, outline?: string, width = .6) {
  c.fillStyle = fill; c.beginPath(); c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath(); c.fill();
  if (outline) { c.strokeStyle = outline; c.lineWidth = width; c.lineJoin = 'round'; c.stroke(); }
}

function oval(c: Ctx, x: number, y: number, rx: number, ry: number, fill: Paint, rotation = 0) {
  c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, rx, ry, rotation, 0, TAU); c.fill();
}

function metal(c: Ctx, x: number, y: number, width: number, palette: Palette) {
  const g = c.createLinearGradient(x, y, x + width, y + width * .18);
  g.addColorStop(0, palette.dark); g.addColorStop(.27, palette.base);
  g.addColorStop(.43, palette.light); g.addColorStop(.56, palette.base); g.addColorStop(1, palette.dark);
  return g;
}

function star(c: Ctx, x: number, y: number, radius: number, fill: Paint, spikes = 8) {
  const points: number[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = -Math.PI / 2 + i * Math.PI / spikes;
    const r = i % 2 ? radius * .38 : radius;
    points.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  poly(c, points, fill);
}

/** Capsules use a perpendicular metallic gradient instead of flat stick limbs. */
function segment(c: Ctx, from: Point, to: Point, width: number, palette: Palette, armored = false) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const length = Math.max(.01, Math.hypot(dx, dy));
  c.save(); c.translate(from.x, from.y); c.rotate(Math.atan2(dy, dx));
  c.fillStyle = metal(c, 0, -width / 2, width, palette);
  // A transverse reflection describes the cylindrical surface.
  const g = c.createLinearGradient(0, -width / 2, 0, width / 2);
  g.addColorStop(0, palette.dark); g.addColorStop(.24, palette.base);
  g.addColorStop(.4, palette.light); g.addColorStop(.66, palette.base); g.addColorStop(1, palette.dark);
  c.fillStyle = g; c.strokeStyle = palette.edge; c.lineWidth = .6;
  c.beginPath(); c.roundRect(-width * .12, -width / 2, length + width * .24, width, width * .36); c.fill(); c.stroke();
  if (armored) {
    stroke(c, [length * .18, -width * .37, length * .78, -width * .37], palette.light, .5);
    stroke(c, [length * .17, width * .4, length * .79, width * .4], palette.dark, .7);
    stroke(c, [length * .78, -width * .45, length * .8, width * .45], palette.edge, .6);
  }
  c.restore();
}

function glow(c: Ctx, x: number, y: number, r: number, color: string, strength = 1) {
  if (r <= 0 || strength <= 0) return;
  c.save(); c.globalAlpha *= Math.min(1, strength);
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, '#fff6dd'); g.addColorStop(.11, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  oval(c, x, y, r, r, g); c.restore();
}

function localPoint(frame: HeroFrame, x: number, y: number): Point {
  const co = Math.cos(frame.angle), si = Math.sin(frame.angle);
  return { x: frame.x + (x * co - y * si) * frame.scale, y: frame.y + (x * si + y * co) * frame.scale };
}

function joints(frame: HeroFrame, side: number): Joints {
  const wave = Math.sin(frame.time * 3.1 + side) * 1.1;
  const flight = frame.pose === 'flight';
  let elbow = { x: side * (12 + wave * .2), y: flight ? -7 : -6 + wave };
  let hand = { x: side * (15 + wave * .45), y: flight ? 4 : 5 + wave };
  let knee = { x: side * (5.5 + wave * .35), y: 16 + (side < 0 ? 1 : -1) };
  let foot = { x: side * (7 + wave * .3), y: 30 };
  if (frame.pose === 'surf') {
    elbow = { x: side * 17, y: -11 + wave };
    hand = { x: side * 26, y: -8 + wave };
    knee = { x: side * 11, y: 14 };
    foot = { x: side * 17, y: 27 };
  } else if ((frame.pose === 'repair' || frame.pose === 'blast' || frame.pose === 'hammer') && side > 0) {
    elbow = { x: 15, y: -10 + wave * .2 }; hand = { x: 24, y: -8 + wave * .15 };
  } else if (frame.pose === 'scan') {
    elbow = { x: side * 15, y: -12 }; hand = { x: side * 23, y: -16 + wave * .3 };
  }
  if (frame.id === 'thor' && flight && side > 0) {
    elbow = { x: 13, y: -24 }; hand = { x: 18, y: -37 };
  }
  return { elbow, hand, knee, foot };
}

function limbSet(c: Ctx, frame: HeroFrame, palette: Palette, accents: Palette, armor: boolean) {
  for (const side of [-1, 1]) {
    const j = joints(frame, side);
    oval(c, side * 3.5, 3, 3.6, 3.3, palette.dark);
    segment(c, { x: side * 3.4, y: 3 }, j.knee, 5.5, palette, armor);
    oval(c, j.knee.x, j.knee.y, 2.9, 2.7, metal(c, j.knee.x - 3, j.knee.y, 6, accents));
    segment(c, j.knee, j.foot, 4.6, armor ? accents : palette, armor);
    c.save(); c.translate(j.foot.x, j.foot.y);
    poly(c, [-2.5, -4, 2.2, -4, 3.4, 1.8, -3.4, 2.3, -3.9, .5], metal(c, -4, 0, 8, accents), accents.edge);
    stroke(c, [-3.4, 1.7, 2.8, 1.4], accents.light, .5); c.restore();
    oval(c, side * 8, -17, 3.2, 3.2, metal(c, side * 8 - 3, -17, 6, accents));
    segment(c, { x: side * 8, y: -17 }, j.elbow, 4.6, palette, armor);
    oval(c, j.elbow.x, j.elbow.y, 2.3, 2.3, palette.dark);
    segment(c, j.elbow, j.hand, 4.2, accents, armor);
    oval(c, j.hand.x, j.hand.y, 2.4, 2.7, metal(c, j.hand.x - 2.4, j.hand.y, 4.8, accents), -.2 * side);
    stroke(c, [j.hand.x - 1, j.hand.y - .7, j.hand.x + 1, j.hand.y - .7], accents.dark, .5);
  }
}

function torso(c: Ctx, palette: Palette, athletic = false) {
  poly(c, [-8, -20, -3.4, -22, 3.4, -22, 8, -20, 8.8, -12, 5.1, -2, 4.3, 3, -4.3, 3, -5.1, -2, -8.8, -12], metal(c, -9, -19, 18, palette), palette.edge, .8);
  stroke(c, [-6.7, -16.4, -1.5, -15.2, 0, -17.2, 1.5, -15.2, 6.7, -16.4], palette.light, .7);
  stroke(c, [-5.6, -9, -2.5, -8, 0, -9, 2.5, -8, 5.6, -9], palette.dark, .65);
  if (athletic) {
    stroke(c, [0, -13.5, 0, -.5], palette.dark, .65);
    for (const y of [-6, -2]) stroke(c, [-3.1, y, -.5, y + .5, .5, y + .5, 3.1, y], palette.dark, .55);
  } else {
    poly(c, [-4.8, -7, 4.8, -7, 4, 1, -4, 1], metal(c, -5, -7, 10, palette), palette.dark, .45);
    stroke(c, [-3.7, -5, 3.7, -5], palette.dark, .7);
  }
  poly(c, [-4.8, 2, 4.8, 2, 5.4, 6, 0, 8, -5.4, 6], metal(c, -6, 2, 12, palette), palette.edge);
  segment(c, { x: 0, y: -23 }, { x: 0, y: -20 }, 4.1, palette);
}

function face(c: Ctx, palette = SKIN) {
  oval(c, 0, -27.6, 4.2, 5.3, metal(c, -4.2, -29, 8.4, palette));
  poly(c, [-3.8, -27.5, -3.1, -23.3, 0, -22.2, 3.1, -23.3, 3.8, -27.5], metal(c, -4, -27, 8, palette));
  stroke(c, [-2.5, -28, -1, -28.1], palette.dark, .48);
  stroke(c, [1, -28.1, 2.5, -28], palette.dark, .48);
  stroke(c, [.3, -27.5, .6, -25.5, -.3, -25.3], palette.dark, .36);
  stroke(c, [-1.4, -24.1, 1.5, -24.1], palette.dark, .45);
  stroke(c, [-2.6, -29.2, -1.3, -29.4], palette.light, .42);
}

function hair(c: Ctx, frame: HeroFrame, long: boolean) {
  const drift = Math.sin(frame.time * 3) * 2;
  const g = c.createLinearGradient(-5, -32, 8, -18);
  g.addColorStop(0, '#594624'); g.addColorStop(.35, '#e7c478'); g.addColorStop(.6, '#fff2c3'); g.addColorStop(1, '#8f6939');
  c.fillStyle = g; c.beginPath(); c.moveTo(-5, -29);
  c.bezierCurveTo(-5.2, -36, 4, -36, 5, -29);
  c.bezierCurveTo(8 + drift, -23, 8 + drift, long ? -10 : -21, 4, long ? -12 : -21);
  c.lineTo(2.5, -29.4); c.lineTo(-2.7, -29.3);
  c.bezierCurveTo(-4 + drift, -22, -6 + drift, long ? -13 : -22, -7, long ? -13 : -24);
  c.closePath(); c.fill();
  stroke(c, [-4.6, -30.4, -4.4, -24, -4 + drift, long ? -15 : -23], '#f1d999', .55);
  stroke(c, [3.5, -30.5, 5, -24, 5.4 + drift, long ? -15 : -23], '#76582d', .65);
}

function cape(c: Ctx, frame: HeroFrame) {
  const wave = Math.sin(frame.time * 3.3) * 3;
  const wind = frame.thrust * 9;
  const g = c.createLinearGradient(-12, -17, 14, 30);
  g.addColorStop(0, '#bc3239'); g.addColorStop(.38, '#601820'); g.addColorStop(.68, '#ad3036'); g.addColorStop(1, '#2d111c');
  c.fillStyle = g; c.beginPath(); c.moveTo(-8, -20); c.lineTo(8, -20);
  c.bezierCurveTo(12 + wave, -4, 14 + wave, 15, 17 + wave, 28 + wind);
  c.bezierCurveTo(6, 26 + wind, 1, 33 + wind, -17 + wave, 27 + wind);
  c.bezierCurveTo(-11 + wave, 11, -14, -6, -8, -20); c.fill();
  stroke(c, [-6, -18, -8 + wave * .6, 5, -11 + wave, 26 + wind], '#df5650', .7);
  stroke(c, [1, -16, 3 + wave * .4, 7, 5 + wave, 27 + wind], '#42131d', 1.2);
  stroke(c, [7, -16, 9 + wave * .4, 10, 13 + wave, 28 + wind], '#e05d54', .65);
}

function hammer(c: Ctx, x: number, y: number, angle: number, scale: number) {
  c.save(); c.translate(x, y); c.rotate(angle); c.scale(scale, scale);
  segment(c, { x: 0, y: 0 }, { x: 0, y: 12 }, 2.4, { dark: '#493025', base: '#896345', light: '#b18f5f', edge: '#222' });
  for (let i = 0; i < 4; i++) stroke(c, [-1, 2 + i * 2.1, 1, 3 + i * 2.1], '#2b2424', .55);
  poly(c, [-8, -6.7, -5, -9, 5, -9, 8, -6.7, 8, -.5, 5, 2, -5, 2, -8, -.5], metal(c, -8, -8, 16, SILVER), '#223342', .8);
  stroke(c, [-6, -5, 6, -5], '#f0f6f0', .7);
  stroke(c, [-5, -.5, 5, -.5], '#526874', .7);
  c.strokeStyle = '#957951'; c.lineWidth = .7; c.beginPath(); c.ellipse(0, 14, 2, 3, .2, 0, TAU); c.stroke();
  c.restore();
}

function board(c: Ctx, frame: HeroFrame, effects: boolean) {
  const banking = Math.sin(frame.time * 2.5) * .045;
  c.save(); c.translate(0, 31); c.rotate(banking);
  const g = c.createLinearGradient(-43, -4, 39, 4);
  g.addColorStop(0, '#526c83'); g.addColorStop(.2, '#d8ebf1'); g.addColorStop(.4, '#fff');
  g.addColorStop(.6, '#6b96ae'); g.addColorStop(.82, '#e9f8ff'); g.addColorStop(1, '#385b78');
  c.fillStyle = g; c.beginPath(); c.moveTo(-43, .5);
  c.bezierCurveTo(-26, -8, 28, -8, 44, -1); c.bezierCurveTo(25, 5, -20, 5, -43, .5); c.fill();
  stroke(c, [-39, .6, -22, 2.4, 20, 1.7, 39, -.5], '#192f44', .8);
  stroke(c, [-32, -.7, 24, -2.8, 38, -1.8], '#effdff', .75);
  if (effects) {
    stroke(c, [-29, 3.2, 21, 2.5], '#a4eeff', .65);
    glow(c, -35, 1, 9 * frame.thrust, '#85d9ff', .35);
  }
  c.restore();
}

function jets(c: Ctx, frame: HeroFrame, color: string, effects: boolean) {
  if (!effects || frame.thrust <= .05) return;
  for (const side of [-1, 1]) {
    const foot = joints(frame, side).foot;
    const flameLength = 7 + frame.thrust * 17 + Math.sin(frame.time * 21 + side) * 2;
    const g = c.createLinearGradient(foot.x, foot.y, foot.x, foot.y + flameLength);
    g.addColorStop(0, '#faffff'); g.addColorStop(.25, color); g.addColorStop(1, 'rgba(30,95,200,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(foot.x - 1.6, foot.y + 2); c.lineTo(foot.x + 1.6, foot.y + 2);
    c.quadraticCurveTo(foot.x + 3, foot.y + 10, foot.x, foot.y + flameLength);
    c.quadraticCurveTo(foot.x - 3, foot.y + 10, foot.x - 1.6, foot.y + 2); c.fill();
    glow(c, foot.x, foot.y + 4, 6, color, .5);
  }
}

function heroBody(c: Ctx, frame: HeroFrame, effects: boolean) {
  const id = frame.id;
  if (id === 'thor') cape(c, frame);
  if (id === 'thor' || id === 'captainMarvel') hair(c, frame, id === 'thor');
  if (id === 'silverSurfer') board(c, frame, effects);
  if (effects && id === 'captainMarvel') {
    glow(c, 0, -6, 37, '#f5b34c', .12 + frame.thrust * .12);
    glow(c, 0, -20, 19, '#fff0ba', .07);
  }
  const palette = id === 'ironMan' ? RED : id === 'silverSurfer' ? SILVER : NAVY;
  const accents = id === 'ironMan' || id === 'nova' ? GOLD : id === 'thor' ? SILVER : id === 'captainMarvel' ? RED : SILVER;
  limbSet(c, frame, palette, accents, id !== 'silverSurfer');
  torso(c, palette, id === 'silverSurfer');
  if (id === 'ironMan') {
    poly(c, [-7.5, -18, -.9, -16.4, -1.8, -12, -6.5, -13], metal(c, -8, -18, 8, RED), RED.dark, .5);
    poly(c, [7.5, -18, .9, -16.4, 1.8, -12, 6.5, -13], metal(c, 0, -18, 8, RED), RED.dark, .5);
    oval(c, 0, -12.1, 3, 3, '#182d3a'); oval(c, 0, -12.1, 2.15, 2.15, '#dbfaff');
    stroke(c, [-3.5, -4.5, -1.8, -2.4, 1.8, -2.4, 3.5, -4.5], '#da6452', .65);
    oval(c, 0, -27.8, 4.7, 6.1, metal(c, -5, -29, 10, RED));
    poly(c, [-3.5, -32.4, 3.5, -32.4, 4, -28, 2.8, -23.2, 0, -22.4, -2.8, -23.2, -4, -28], metal(c, -4, -29, 8, GOLD), '#543224', .6);
    stroke(c, [-3.1, -28.2, -1.05, -28], '#c4f5ff', 1.05);
    stroke(c, [1.05, -28, 3.1, -28.2], '#c4f5ff', 1.05);
    stroke(c, [-2.1, -24.8, 2.1, -24.8], '#6f4b27', .65);
    for (const side of [-1, 1]) {
      const hand = joints(frame, side).hand;
      oval(c, hand.x, hand.y - .4, 1.15, 1.15, '#d2f9ff');
      if (effects) glow(c, hand.x, hand.y, 5, '#84deff', .5);
    }
    if (frame.pose === 'repair') {
      const h = joints(frame, 1).hand;
      poly(c, [h.x, h.y - 1, h.x + 4, h.y - 2, h.x + 5, h.y, h.x + 1, h.y + 1], metal(c, h.x, h.y, 5, SILVER), '#192b36');
      stroke(c, [h.x + 4, h.y - 1, h.x + 7, h.y - 1.5], '#d2e9ef', .8);
    }
    if (effects) glow(c, 0, -12.1, 6, '#89d9ff', .45);
    jets(c, frame, '#86e9ff', effects);
  } else if (id === 'thor') {
    poly(c, [-6.5, -21, 6.5, -21, 7, -7, 4.7, 1, -4.7, 1, -7, -7], metal(c, -7, -20, 14, NAVY), '#111d28');
    for (const side of [-1, 1]) for (const y of [-17, -9]) {
      oval(c, side * 4.8, y, 2.6, 2.6, metal(c, side * 4.8 - 2.6, y, 5.2, SILVER));
      stroke(c, [side * 4.8 - 1.3, y - 1.1, side * 4.8 + 1.2, y - 1.1], '#e7eae5', .5);
    }
    stroke(c, [-5.5, -1, 5.5, -1], '#aeb9bb', 2);
    face(c); // Hair, facial features and light beard retain adult proportions.
    poly(c, [-3.3, -25.1, -2.6, -22.7, 0, -21.6, 2.6, -22.7, 3.3, -25.1, 1.5, -23.6, -1.5, -23.6], '#7c5d3d');
    if (!frame.hammer) {
      const h = joints(frame, 1).hand;
      hammer(c, h.x, h.y - 8, frame.pose === 'flight' ? -.15 : -.35, 1);
    }
  } else if (id === 'silverSurfer') {
    face(c, SILVER);
    oval(c, -1, -30.3, 2.4, 1.5, 'rgba(231,250,255,.45)');
    stroke(c, [-6, -14, -4, -12, -1, -12], '#e7f8fd', .65);
    stroke(c, [2, -19, 6, -17, 6.6, -11], '#c8e8f0', .5);
    stroke(c, [-3.6, 1, 0, 2.4, 3.6, 1], '#456a7e', .6);
  } else if (id === 'captainMarvel') {
    poly(c, [-8, -20, -3, -18, 0, -14, 3, -18, 8, -20, 8.5, -16.8, 4, -14.4, 0, -11.5, -4, -14.4, -8.5, -16.8], metal(c, -9, -20, 18, RED), '#411d2b', .4);
    stroke(c, [-7.5, -18.7, -1.7, -15, 1.7, -15, 7.5, -18.7], '#edcc77', .7);
    star(c, 0, -14, 3.8, '#fce2a0');
    stroke(c, [-5, .5, 5, .5], '#d2aa5d', 2);
    c.save(); c.fillStyle = '#9c2835'; c.beginPath(); c.moveTo(4, 1); c.quadraticCurveTo(11, 11, 9 + Math.sin(frame.time * 3), 16);
    c.lineTo(6, 15); c.quadraticCurveTo(6, 6, 2.8, 2); c.fill(); c.restore();
    face(c);
    oval(c, -1, -32, 3.6, 1.8, metal(c, -5, -33, 9, GOLD), -.13);
    if (effects) for (const side of [-1, 1]) {
      const h = joints(frame, side).hand;
      glow(c, h.x, h.y, 6 + frame.effect * 3, '#ffbd56', .6);
    }
    jets(c, frame, '#ffd189', effects);
  } else {
    for (const side of [-1, 1]) {
      poly(c, [side * 6.5, -20, side * 11, -20, side * 11.8, -16, side * 8.1, -15], metal(c, side > 0 ? 6 : -12, -20, 6, GOLD), GOLD.edge);
      oval(c, side * 4.8, -14.3, 2.1, 2.1, metal(c, side * 4.8 - 2, -15, 4, GOLD));
      stroke(c, [side * 5, -18, side * 6, -3], '#c5a45e', .9);
    }
    oval(c, 0, -7.5, 2.2, 2.2, metal(c, -2, -9, 4, GOLD));
    oval(c, 0, -28, 5, 6.2, metal(c, -5, -31, 10, GOLD));
    poly(c, [-4.5, -29.3, -2.3, -28.1, 0, -28.8, 2.3, -28.1, 4.5, -29.3, 3.2, -25.6, 1.5, -26.7, 0, -26.3, -1.5, -26.7, -3.2, -25.6], '#121f30', '#d6b776', .45);
    stroke(c, [-3.7, -28.1, -1.2, -27.7], '#b8e4ff', .8);
    stroke(c, [1.2, -27.7, 3.7, -28.1], '#b8e4ff', .8);
    star(c, 0, -31.4, 2.45, '#ae3039', 5);
    poly(c, [-5.4, -30, -8, -27, -7.5, -23, -4.1, -26], metal(c, -8, -30, 4, GOLD));
    poly(c, [5.4, -30, 8, -27, 7.5, -23, 4.1, -26], metal(c, 4, -30, 4, GOLD));
    stroke(c, [-4.8, 2, 4.8, 2], '#d7b46b', 2);
    jets(c, frame, '#92cfff', effects);
  }
}

function meteor(c: Ctx, frame: HeroFrame, effects: boolean) {
  if (!frame.meteor || frame.meteor.radius <= .05) return;
  const m = frame.meteor, r = m.radius;
  const g = c.createLinearGradient(m.x - r, m.y - r, m.x + r, m.y + r);
  g.addColorStop(0, '#b2a38d'); g.addColorStop(.35, '#817364'); g.addColorStop(1, '#272931');
  const points: number[] = [];
  for (let i = 0; i < 11; i++) {
    const a = i * TAU / 11, radial = r * (.8 + Math.sin(i * 12.2 + 3) * .16);
    points.push(m.x + Math.cos(a) * radial, m.y + Math.sin(a) * radial);
  }
  poly(c, points, g, '#242a34', .6);
  oval(c, m.x - r * .3, m.y - r * .18, r * .21, r * .16, '#635e56', -.7);
  oval(c, m.x + r * .27, m.y + r * .3, r * .17, r * .11, '#353b40');
  stroke(c, [m.x - r * .6, m.y + r * .2, m.x - r * .23, m.y + r * .39], '#b2a087', .55);
  if (effects && frame.phase > .5) {
    stroke(c, [m.x - r * .85, m.y, m.x - r * .15, m.y - r * .15, m.x + r * .1, m.y + r * .15, m.x + r * .75, m.y - r * .45], '#facc88', .8);
    stroke(c, [m.x - r * .15, m.y - r * .15, m.x + r * .2, m.y - r * .7], '#ffc36c', .6);
    if (frame.phase > .67) for (let i = 0; i < 12; i++) {
      const a = i * 2.39, progress = Math.max(0, (frame.phase - .67) / .33);
      const d = (6 + progress * (15 + i % 3 * 4)) * frame.scale;
      c.save(); c.globalAlpha *= (1 - progress) * .85;
      poly(c, [m.x + Math.cos(a) * d, m.y + Math.sin(a) * d,
        m.x + Math.cos(a) * d + 1.5 * frame.scale, m.y + Math.sin(a) * d + frame.scale,
        m.x + Math.cos(a) * d - frame.scale, m.y + Math.sin(a) * d + 1.6 * frame.scale], i % 3 ? '#a19581' : '#f1c281');
      c.restore();
    }
  }
}

function lightning(c: Ctx, start: Point, end: Point, time: number, scale: number, opacity: number) {
  const dx = end.x - start.x, dy = end.y - start.y, distance = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / distance, ny = dx / distance;
  const points: number[] = [start.x, start.y];
  for (let i = 1; i < 8; i++) {
    const u = i / 8, offset = Math.sin(time * 18 + i * 5.2) * 3 * scale * Math.sin(Math.PI * u);
    points.push(start.x + dx * u + nx * offset, start.y + dy * u + ny * offset);
  }
  points.push(end.x, end.y);
  c.save(); c.globalAlpha *= opacity;
  stroke(c, points, '#6596dc', 2.1 * scale); stroke(c, points, '#d8ebff', .65 * scale); c.restore();
}

function effects(c: Ctx, frame: HeroFrame) {
  const color = HERO_DETAILS[frame.id].color;
  if (frame.trail.length > 0) {
    const points = [{ x: frame.x, y: frame.y }, ...frame.trail];
    for (let i = 1; i < points.length; i++) {
      // Prevent a wrapped route from creating a stripe across the entire system.
      if (Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y) > 85 * frame.scale) continue;
      c.save(); c.globalAlpha *= (1 - i / points.length) * .17;
      stroke(c, [points[i - 1].x, points[i - 1].y, points[i].x, points[i].y], color, 2.2 * frame.scale); c.restore();
    }
  }
  if (frame.effect <= .02 || !frame.target) return;
  const target = frame.target;
  if (frame.pose === 'repair') {
    const h = localPoint(frame, 31, -9);
    c.save(); c.globalAlpha *= frame.effect * (.72 + Math.sin(frame.time * 30) * .2);
    stroke(c, [h.x, h.y, target.x, target.y], '#88dfff', .75 * frame.scale);
    glow(c, target.x, target.y, 7 * frame.scale, '#b4f5ff', .7);
    for (let i = 0; i < 10; i++) {
      const age = (frame.time * 2 + i / 10) % 1, a = i * 2.4;
      const length = (3 + age * (8 + i % 4)) * frame.scale;
      const x = target.x + Math.cos(a) * length, y = target.y + Math.sin(a) * length + age * age * 3;
      c.save(); c.globalAlpha *= 1 - age;
      stroke(c, [x, y, x + Math.cos(a) * 2.2 * frame.scale, y + Math.sin(a) * 2.2 * frame.scale], i % 3 ? '#ffce6f' : '#eaf8ff', .75 * frame.scale);
      c.restore();
    }
    c.restore();
  } else if (frame.id === 'thor' && frame.hammer) {
    const h = frame.hammer, hand = localPoint(frame, 24, -8);
    c.save(); c.globalAlpha *= frame.effect * .28;
    c.strokeStyle = '#a4bcf4'; c.lineWidth = .85 * frame.scale; c.beginPath(); c.moveTo(hand.x, hand.y);
    c.quadraticCurveTo((hand.x + h.x) / 2, Math.min(hand.y, h.y) - 18 * frame.scale, h.x, h.y); c.stroke(); c.restore();
    lightning(c, h, { x: h.x + Math.cos(frame.time * .9) * 19 * frame.scale, y: h.y + Math.sin(frame.time * .9) * 19 * frame.scale }, frame.time, frame.scale, frame.effect * .7);
    if (Math.sin(frame.time * 4.2) > .35) lightning(c, h, target, frame.time + 3, frame.scale, frame.effect * .45);
    glow(c, h.x, h.y, 10 * frame.scale, '#9eb9ff', .27 * frame.effect);
  } else if (frame.pose === 'blast') {
    if (frame.phase < .4) return;
    const hand = localPoint(frame, 24, -8), strength = Math.min(1, (frame.phase - .4) / .14) * frame.effect;
    c.save(); c.globalAlpha *= strength;
    stroke(c, [hand.x, hand.y, target.x, target.y], 'rgba(255,162,62,.28)', 4.7 * frame.scale);
    stroke(c, [hand.x, hand.y, target.x, target.y], '#ffe8bd', 1.15 * frame.scale);
    glow(c, target.x, target.y, 12 * frame.scale, '#ffc66e', .5);
    c.restore();
  } else if (frame.pose === 'scan' || frame.id === 'silverSurfer') {
    const origin = localPoint(frame, frame.id === 'silverSurfer' ? 24 : 23, -14);
    const a = Math.atan2(target.y - origin.y, target.x - origin.x);
    const distance = Math.min(125 * frame.scale, Math.hypot(target.x - origin.x, target.y - origin.y));
    for (let i = 0; i < 3; i++) {
      const p = (frame.time * .65 + i / 3) % 1, radius = 8 * frame.scale + distance * p;
      c.save(); c.globalAlpha *= (1 - p) * frame.effect * .38;
      c.strokeStyle = color; c.lineWidth = .7 * frame.scale; c.beginPath(); c.arc(origin.x, origin.y, radius, a - .21, a + .21); c.stroke();
      c.restore();
    }
    glow(c, origin.x, origin.y, 6 * frame.scale, color, frame.effect * .25);
  }
}

function labels(c: Ctx, frame: HeroFrame) {
  const details = HERO_DETAILS[frame.id];
  c.save();
  const size = Math.max(8, 9 * frame.scale);
  c.font = `600 ${size}px "JetBrains Mono", monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
  const width = Math.max(c.measureText(details.name).width, c.measureText(frame.action).width) + 13;
  const y = frame.y + (frame.id === 'thor' ? 46 : 40) * frame.scale;
  c.fillStyle = 'rgba(5,13,23,.76)'; c.beginPath(); c.roundRect(frame.x - width / 2, y - 7, width, 26, 3); c.fill();
  c.fillStyle = details.color; c.fillText(details.name, frame.x, y);
  c.font = `400 ${Math.max(7, 8 * frame.scale)}px "JetBrains Mono", monospace`;
  c.fillStyle = '#b6c5d1'; c.fillText(frame.action, frame.x, y + 12); c.restore();
}

/** One procedural drawing serves the projected 2D and 3D views without asset downloads. */
export function drawMarvelHero(c: Ctx, frame: HeroFrame, options: { effects: boolean; showLabel: boolean }) {
  if (!Number.isFinite(frame.x) || !Number.isFinite(frame.y) || !Number.isFinite(frame.scale) || frame.scale <= 0 || frame.opacity <= 0) return;
  c.save(); c.globalAlpha *= frame.opacity;
  if (options.effects) effects(c, frame);
  meteor(c, frame, options.effects);
  if (frame.hammer) hammer(c, frame.hammer.x, frame.hammer.y, frame.hammer.angle, frame.scale);
  c.save(); c.translate(frame.x, frame.y); c.rotate(frame.angle); c.scale(frame.scale, frame.scale);
  heroBody(c, frame, options.effects); c.restore();
  if (options.showLabel) labels(c, frame);
  c.restore();
}
