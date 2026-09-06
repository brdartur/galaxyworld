type Point = readonly [number, number];
interface Shape { name: string; pts: readonly Point[]; seg: readonly Point[] }
interface Placement { x: number; y: number; s: number; rot: number }

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
