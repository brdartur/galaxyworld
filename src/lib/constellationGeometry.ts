type Point = readonly [number, number];
interface Shape { name: string; pts: readonly Point[]; seg: readonly Point[] }
interface Placement { x: number; y: number; s: number; rot: number }

export interface OrbitExclusion { x: number; y: number; rx: number; ry: number }

/** Move the entire drawing (including lines and label) outside the outer orbit. */
export function keepConstellationOutside(shape: Shape, inst: Placement, orbit: OrbitExclusion, width: number, height: number) {
  const pts = constellationPoints(shape.pts, { ...inst, x: 0, y: 0 });
  if (!pts.length) return;
  const labelX = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
  const labelY = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
  const halfLabel = shape.name.length * 3.7 + 6;
  const left = Math.min(...pts.map(p => p[0] - 10), labelX - halfLabel);
  const right = Math.max(...pts.map(p => p[0] + 10), labelX + halfLabel);
  const top = Math.min(...pts.map(p => p[1] - 10), labelY - 12);
  const bottom = Math.max(...pts.map(p => p[1] + 10), labelY + 12);
  const clear = (x: number, y: number) => {
    const dx = Math.max(x + left - orbit.x, orbit.x - x - right, 0);
    const dy = Math.max(y + top - orbit.y, orbit.y - y - bottom, 0);
    return (dx / orbit.rx) ** 2 + (dy / orbit.ry) ** 2 >= 1;
  };
  if (clear(inst.x, inst.y)) return;
  const minX = 8 - left, maxX = width - 8 - right, minY = 8 - top, maxY = height - 8 - bottom;
  let best: { x: number; y: number; cost: number } | null = null;
  const consider = (x: number, y: number) => {
    if (!clear(x, y)) return;
    const cost = (x - inst.x) ** 2 + (y - inst.y) ** 2;
    if (!best || cost < best.cost) best = { x, y, cost };
  };
  // Prefer the nearest visible margin; preserve size and rotation while dragging.
  if (maxX >= minX && maxY >= minY) {
    for (let i = 0; i <= 32; i++) {
      const x = minX + (maxX - minX) * i / 32, y = minY + (maxY - minY) * i / 32;
      consider(x, minY); consider(x, maxY); consider(minX, y); consider(maxX, y);
    }
  }
  if (best) { const target = best as { x: number; y: number }; inst.x = target.x; inst.y = target.y; return; }
  // At very high zoom there may be no on-screen margin. Keep the sky outside anyway.
  let dx = inst.x - orbit.x, dy = inst.y - orbit.y;
  if (Math.hypot(dx, dy) < 1) dy = -1;
  let hi = 1;
  while (!clear(orbit.x + dx * hi, orbit.y + dy * hi)) hi *= 2;
  let lo = 0;
  for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (clear(orbit.x + dx * mid, orbit.y + dy * mid)) hi = mid; else lo = mid; }
  inst.x = orbit.x + dx * hi; inst.y = orbit.y + dy * hi;
}

export function constellationPoints(points: readonly Point[], inst: Placement) {
  const cos = Math.cos(inst.rot), sin = Math.sin(inst.rot);
  return points.map(([u, v]) => {
    const x = (u - .5) * inst.s * 1.7, y = (v - .5) * inst.s;
    return [inst.x + x * cos - y * sin, inst.y + x * sin + y * cos] as const;
  });
}

/** Match the drawn stars, connecting lines and name, rather than an invisible bounding box. */
export function hitsConstellation(x: number, y: number, shape: Shape, inst: Placement) {
  const points = constellationPoints(shape.pts, inst);
  if (points.some(p => Math.hypot(x - p[0], y - p[1]) <= 20)) return true;
  for (const [a, b] of shape.seg) {
    const [ax, ay] = points[a], [bx, by] = points[b];
    const dx = bx - ax, dy = by - ay, length2 = dx * dx + dy * dy;
    const t = length2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length2)) : 0;
    if (Math.hypot(x - ax - t * dx, y - ay - t * dy) <= 12) return true;
  }
  if (!points.length) return false;
  const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  return Math.abs(x - cx) <= shape.name.length * 3.7 + 6 && Math.abs(y - cy) <= 12;
}
