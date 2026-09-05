import { smooth, surfaceMission, type ActivitySettings } from "./activitySettings";

const TAU = Math.PI * 2;
type Ctx = CanvasRenderingContext2D;
function line(c: Ctx, pts: number[], color: string, width = 2) {
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = "round";
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.stroke();
}
function disc(c: Ctx, x: number, y: number, r: number, color: string) {
  c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
}
function caption(c: Ctx, text: string, x: number, y: number) {
  c.font = '600 10px "JetBrains Mono", monospace'; c.textAlign = "center";
  const w = c.measureText(text).width + 16;
  c.fillStyle = "rgba(4,12,24,.85)"; c.fillRect(x - w / 2, y - 11, w, 17);
  c.fillStyle = "#98f5e3"; c.fillText(text, x, y);
}

/** Feet at the origin. Articulated limbs, backpack and a large gold visor. */
export function drawSuit(c: Ctx, t: number, walking = false, working = false, sample = false) {
  const stride = walking ? Math.sin(t * 9) * 4 : 0;
  c.save(); c.lineJoin = "round";
  c.fillStyle = "#748ba4"; c.fillRect(-9, -23, 8, 14);
  line(c, [-3, -10, -4 + stride, -4, -5 + stride, 0], "#dce9f6", 5);
  line(c, [3, -10, 4 - stride, -4, 6 - stride, 0], "#eff5ff", 5);
  line(c, [-6 + stride, 0, -2 + stride, 0], "#54677c", 3);
  line(c, [4 - stride, 0, 9 - stride, 0], "#54677c", 3);
  c.fillStyle = "#eaf2fb"; c.fillRect(-5, -24, 11, 15);
  c.fillStyle = "#ee8644"; c.fillRect(-5, -16, 11, 3);
  c.fillStyle = "#193e5c"; c.fillRect(-2, -22, 6, 5);
  disc(c, 0, -30, 8, "#f2f7ff"); disc(c, 2, -30, 5.8, "#c48832");
  c.fillStyle = "#253346"; c.beginPath(); c.ellipse(2, -29, 4.8, 3.8, 0, 0, TAU); c.fill();
  line(c, [0, -33, 4, -33], "#fff1b2", 1.6);
  const handY = working ? -16 + Math.sin(t * 24) * 1.4 : -13 + stride;
  line(c, [-5, -22, -10, -16, working ? 9 : -9, working ? handY : -10 - stride], "#cdddeb", 4);
  line(c, [6, -22, 10, -18, working ? 14 : 11, handY], "#f3f7ff", 4);
  disc(c, working ? 14 : 11, handY, 2.8, "#92a8bd");
  if (sample) {
    c.fillStyle = "#94e1e9"; c.fillRect(12, -16, 6, 9);
    c.fillStyle = "#d7a56b"; c.fillRect(13, -12, 4, 4);
    line(c, [12, -17, 18, -17], "#eafaff", 2);
  }
  c.restore();
}

function drawDrill(c: Ctx, t: number, active: boolean) {
  const shake = active ? Math.sin(t * 42) * 1.1 : 0;
  c.save(); c.translate(14 + shake, 0);
  line(c, [-7, -18, 7, -18], "#a9c6de", 3);
  c.fillStyle = "#f9bd51"; c.fillRect(-4, -21, 8, 12);
  line(c, [0, -9, 0, 2 + (active ? Math.sin(t * 35) * 2 : 0)], "#d7eaff", 3);
  for (let i = 0; i < 4; i++) line(c, [-3, -8 + i * 3, 3, -6 + i * 3], "#648294", 1.3);
  line(c, [-5, -9, -10, 0, -14, 0], "#6f93a8", 2);
  line(c, [5, -9, 10, 0, 14, 0], "#6f93a8", 2);
  if (active) {
    disc(c, 0, 1, 4, "#29231e");
    for (let i = 0; i < 14; i++) {
      const p = (t * 2.1 + i / 14) % 1;
      const side = i % 2 ? 1 : -1;
      c.globalAlpha = 1 - p;
      disc(c, side * p * (12 + i % 4 * 4), -Math.sin(p * Math.PI) * (7 + i % 5 * 3), 1 + i % 3 * .4, "#e6bb80");
    }
  }
  c.restore();
}

/** Transparent drawing over the same planet geometry used by both renderers. */
export function drawSurfaceExplorer(c: Ctx, radius: number, t: number, settings: ActivitySettings) {
  const m = surfaceMission(t);
  if (!m.visible) return;
  c.save();
  c.translate(Math.sin(m.angle) * (radius + 3), -Math.cos(m.angle) * (radius + 3));
  c.rotate(m.angle);
  const working = (m.drilling && settings.drilling) || (m.sampling && settings.research);
  drawSuit(c, t, m.walking, working, m.sampling && settings.research);
  if (settings.drilling && t >= 8 && t < 22) drawDrill(c, t, m.drilling);
  if (settings.research && m.sampling) {
    line(c, [13, -14, 18, -5, 21, -2], "#dae8f3", 2);
    disc(c, 21, -2, 2.5, "#b7864e");
  }
  if (settings.research && m.scanning) {
    c.fillStyle = "#4ddbc2"; c.fillRect(10, -17, 8, 5);
    c.strokeStyle = "rgba(73,243,218,.6)"; c.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const r = 6 + ((t * 12 + i * 9) % 28);
      c.beginPath(); c.arc(18, -14, r, -.35, .9); c.stroke();
    }
  }
  c.restore();
  let label = m.label;
  if ((m.drilling && !settings.drilling) || ((m.sampling || m.scanning) && !settings.research)) label = "ОСМОТР ПОВЕРХНОСТИ";
  caption(c, label, 0, radius + 24);
}

export function drawRover(c: Ctx, radius: number, time: number) {
  const phase = time % 18;
  if (phase > 16) return;
  c.save(); c.globalAlpha = smooth(phase) * (1 - smooth(phase - 15));
  const angle = -.9 + 1.8 * smooth(phase / 15);
  c.translate(Math.sin(angle) * (radius + 3), -Math.cos(angle) * (radius + 3));
  c.rotate(angle); c.scale(1.15, 1.15);
  line(c, [-15, -8, 15, -8], "#849cb1", 3);
  for (let i = -1; i <= 1; i++) {
    const x = i * 12;
    disc(c, x, -3, 5, "#182738"); disc(c, x, -3, 3.4, "#718b9c");
    const spin = time * 6;
    line(c, [x - Math.cos(spin) * 3, -3 - Math.sin(spin) * 3, x + Math.cos(spin) * 3, -3 + Math.sin(spin) * 3], "#dce8f1", 1.2);
  }
  c.fillStyle = "#e4e9ed"; c.fillRect(-15, -17, 30, 10);
  c.fillStyle = "#1c699d"; c.fillRect(-12, -21, 20, 5);
  for (let i = 0; i < 5; i++) line(c, [-11 + i * 4, -21, -11 + i * 4, -16], "#66b8ec", .6);
  line(c, [4, -20, 4, -30], "#bfced9", 2);
  c.fillStyle = "#dfb166"; c.fillRect(0, -33, 12, 6);
  disc(c, 10, -30, 2.5, "#78e7fa");
  const arm = Math.sin(time * 1.5) * 4;
  line(c, [15, -14, 23, -21 + arm, 29, -10], "#cadde8", 2.3);
  line(c, [28, -10, 27, -5, 31, -5], "#ffc576", 1.5);
  for (let i = 0; i < 7; i++) {
    c.globalAlpha *= .9;
    disc(c, -20 - i * 4, -1 - Math.sin(time * 5 + i) * 2, 1.1, "#b4a888");
  }
  c.restore();
}

export function drawStation(c: Ctx, time: number, settings: ActivitySettings) {
  c.save();
  // Solar arrays, truss, pressure modules, docking port and antenna.
  line(c, [-112, 0, 112, 0], "#a4bacf", 5);
  for (const side of [-1, 1]) {
    c.fillStyle = "#173e73"; c.fillRect(side < 0 ? -120 : 60, -30, 60, 58);
    c.strokeStyle = "#72b8f0"; c.lineWidth = 1;
    c.strokeRect(side < 0 ? -120 : 60, -30, 60, 58);
    for (let i = 1; i < 6; i++) line(c, [side < 0 ? -120 + i * 10 : 60 + i * 10, -30, side < 0 ? -120 + i * 10 : 60 + i * 10, 28], "#3879af", .8);
    for (let i = 0; i < 4; i++) line(c, [side < 0 ? -120 : 60, -20 + i * 13, side < 0 ? -60 : 120, -20 + i * 13], "#73a9d2", .6);
  }
  const grad = c.createLinearGradient(0, -20, 0, 20);
  grad.addColorStop(0, "#edf5fc"); grad.addColorStop(.4, "#b6c9da"); grad.addColorStop(1, "#516780");
  c.fillStyle = grad; c.beginPath(); c.roundRect(-56, -19, 112, 38, 13); c.fill();
  for (const x of [-33, 0, 33]) {
    line(c, [x, -18, x, 18], "#617b91", 2);
    disc(c, x + 10, -3, 6, "#142e45"); disc(c, x + 10, -4, 3.7, "#64c0dd");
  }
  c.fillStyle = "#de9147"; c.fillRect(-22, -19, 5, 38);
  c.fillStyle = "#c0d3e5"; c.fillRect(42, -29, 13, 13);
  line(c, [-37, -18, -45, -40, -54, -43], "#c2d9e7", 2);
  c.strokeStyle = "#9dc8e1"; c.beginPath(); c.arc(-50, -43, 10, .2, 2.8); c.stroke();
  disc(c, 54, 12, 2, Math.sin(time * 4) > 0 ? "#f57765" : "#4c3542");
  caption(c, "ОРБИТАЛЬНАЯ СТАНЦИЯ", 0, 64);
  if (settings.stationCrew) {
    const t = time % 56;
    let x = 49 - smooth((t - 2) / 8) * 81, y = -20;
    let label = "ОСМОТР КОРПУСА", walking = t > 2 && t < 10, work = t >= 10 && t < 20 && settings.stationRepair;
    if (t >= 20 && t < 26) { x = -32 + smooth((t - 20) / 6) * 81; walking = true; }
    if (t >= 26 && t < 48 && settings.spacewalk) {
      const progress = t < 37 ? smooth((t - 26) / 11) : 1 - smooth((t - 37) / 11);
      x = 49 + progress * 55; y = -20 - progress * 66;
      label = t < 37 ? "ВЫХОД НА ТРОСЕ / СКАНИРОВАНИЕ" : "ВОЗВРАЩЕНИЕ НА БОРТ";
      c.strokeStyle = "#d0e9f5"; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(49, -24); c.quadraticCurveTo(x - 30, y + 23, x, y - 13); c.stroke();
      if (t > 31 && t < 38) {
        c.strokeStyle = "rgba(102,239,221,.55)";
        for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x + 12, y - 15, 10 + ((t * 8 + i * 10) % 30), -.5, .5); c.stroke(); }
      }
    } else if (t >= 26 && t < 48) {
      x = 49 - Math.sin((t - 26) / 22 * Math.PI) * 25;
      walking = true;
    } else if (t >= 48) {
      x = 49; y = -20 + smooth((t - 48) / 6) * 18;
      label = "ВОЗВРАЩЕНИЕ В ШЛЮЗ";
    }
    if (work) label = "РЕМОНТ АНТЕННЫ";
    c.save(); c.translate(x, y); c.scale(work ? -.9 : .9, .9);
    c.globalAlpha *= smooth(t / 2) * (1 - smooth((t - 53) / 3));
    drawSuit(c, time, walking, work);
    if (work) {
      line(c, [12, -16, 23, -11 + Math.sin(time * 8) * 4], "#ffcd76", 2.6);
      for (let i = 0; i < 5; i++) {
        const p = (time * 2 + i / 5) % 1;
        line(c, [24, -10, 24 + Math.cos(i * 2) * p * 12, -10 + Math.sin(i * 2) * p * 12], "#ffd983", 1);
      }
    }
    c.restore(); caption(c, label, 0, 83);
  }
  c.restore();
}

/** Photospheric spots and magnetic plasma loops; fusion itself is inside the Sun. */
export function drawSolarActivity(c: Ctx, radius: number, t: number) {
  c.save();
  for (let i = 0; i < 6; i++) {
    const a = t * .018 + i * 2.4;
    const x = Math.sin(a) * radius * .7, y = Math.cos(i * 2.1) * radius * .46;
    const pulse = .75 + Math.sin(t * .5 + i) * .2;
    c.fillStyle = "rgba(118,45,13,.48)"; c.beginPath(); c.ellipse(x, y, radius * .095 * pulse, radius * .065, .4, 0, TAU); c.fill();
    disc(c, x, y, radius * .04, "#502713");
    const p = (t / 7 + i * .31) % 1;
    const g = c.createRadialGradient(x + 7, y - 5, 0, x + 7, y - 5, radius * .23);
    g.addColorStop(0, `rgba(255,255,222,${Math.sin(p * Math.PI) * .7})`); g.addColorStop(1, "rgba(255,133,35,0)");
    c.fillStyle = g; c.fillRect(x - radius * .3, y - radius * .3, radius * .6, radius * .6);
  }
  for (let i = 0; i < 5; i++) {
    const a = i * 2.39 + .18;
    const phase = (t / (8 + i * 1.7) + i * .17) % 1;
    const strength = Math.pow(Math.max(0, Math.sin(phase * Math.PI)), 3);
    c.save(); c.rotate(a); c.translate(radius * .94, 0);
    c.globalCompositeOperation = "lighter";
    for (let pass = 0; pass < 3; pass++) {
      c.strokeStyle = pass === 2 ? `rgba(255,242,163,${strength})` : `rgba(255,95,22,${strength * .36})`;
      c.lineWidth = pass === 0 ? 9 : pass === 1 ? 4 : 1.5;
      c.beginPath(); c.moveTo(0, -radius * .17);
      c.bezierCurveTo(radius * strength * .75, -radius * .48, radius * strength * .75, radius * .48, 0, radius * .17); c.stroke();
    }
    for (let j = 0; j < 9; j++) {
      const p = (phase + j / 12) % 1;
      c.globalAlpha = (1 - p) * strength;
      disc(c, p * radius * .85, Math.sin(j * 7) * radius * .22 * p, 1.1 + (j % 3), "#ffcc78");
    }
    c.restore();
  }
  c.restore();
}

export function drawMartianShip(c: Ctx, time: number) {
  c.save();
  const flame = 20 + Math.sin(time * 24) * 6;
  const g = c.createLinearGradient(-18, 0, -18 - flame, 0);
  g.addColorStop(0, "#fff2a8"); g.addColorStop(.35, "#ffae4d"); g.addColorStop(1, "rgba(255,83,30,0)");
  c.fillStyle = g; c.beginPath(); c.moveTo(-17, -4); c.lineTo(-18 - flame, 0); c.lineTo(-17, 4); c.fill();
  const body = c.createLinearGradient(0, -6, 0, 6);
  body.addColorStop(0, "#edf6ff"); body.addColorStop(1, "#8fa9c6");
  c.fillStyle = body; c.beginPath(); c.roundRect(-17, -6, 35, 12, 5); c.fill();
  c.fillStyle = "#fa6e68"; c.beginPath(); c.moveTo(13, -6); c.lineTo(23, 0); c.lineTo(13, 6); c.fill();
  for (const side of [-1, 1]) { c.beginPath(); c.moveTo(-16, side * 4); c.lineTo(-23, side * 11); c.lineTo(-9, side * 6); c.fill(); }
  disc(c, 1, 0, 5.5, "#21354c");
  disc(c, 0, -.3, 3.2, "#7cea95");
  disc(c, -1.1, -1, .65, "#122d25"); disc(c, 1, -1, .65, "#122d25");
  line(c, [-.6, 1, .7, 1], "#1b5736", .65);
  line(c, [2, 2, 3.4, 0, 4 + Math.sin(time * 8) * 1.6, -3], "#a0ffab", 1.4);
  c.strokeStyle = "#bce9fa"; c.lineWidth = .8; c.beginPath(); c.arc(1, 0, 5.5, 0, TAU); c.stroke();
  c.restore();
}
