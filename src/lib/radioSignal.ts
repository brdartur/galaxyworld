export interface ScreenAnchor { x: number; y: number; radius: number }

/** Terminate the beam at the near edge of Earth, not its centre. */
export function radioPath(station: ScreenAnchor | null, earth: ScreenAnchor | null) {
  if (!station || !earth) return null;
  const dx = earth.x - station.x, dy = earth.y - station.y, distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance <= earth.radius + 4) return null;
  const length = distance - earth.radius;
  return { x: station.x, y: station.y, ux: dx / distance, uy: dy / distance, length,
    endX: station.x + dx / distance * length, endY: station.y + dy / distance * length };
}

export function radioPulseEnvelope(time: number) {
  const cycle = 5.6;
  const active = 1.85;
  const phase = ((time % cycle) + cycle) % cycle;
  if (phase > active) return 0;
  const p = phase / active;
  return Math.sin(Math.PI * p);
}

export function drawRadioSignal(c: CanvasRenderingContext2D, station: ScreenAnchor | null, earth: ScreenAnchor | null, time: number) {
  const path = radioPath(station, earth); if (!path) return;
  const envelope = radioPulseEnvelope(time); if (envelope <= 0.01) return;
  const { x, y, ux, uy, length, endX, endY } = path;
  c.save(); c.strokeStyle = `rgba(105,208,242,${(.18 * envelope).toFixed(3)})`; c.lineWidth = 1;
  c.setLineDash([5, 16]); c.lineDashOffset = -time * 18;
  c.beginPath(); c.moveTo(x, y); c.lineTo(endX, endY); c.stroke(); c.setLineDash([]);
  // A short transmission packet moves antenna-to-Earth, then the link goes dark.
  const angle = Math.atan2(uy, ux);
  const packet = ((time % 5.6) + 5.6) % 5.6 / 1.85;
  for (let i = 0; i < 3; i++) {
    const progress = packet - i * 0.16;
    if (progress <= 0 || progress >= 1) continue;
    const px = x + ux * length * progress, py = y + uy * length * progress;
    const radius = 5 + 10 * progress;
    c.strokeStyle = `rgba(121,225,255,${(.85 * envelope * Math.sin(Math.PI * progress)).toFixed(3)})`;
    c.lineWidth = 1.6;
    c.beginPath(); c.arc(px - ux * radius, py - uy * radius, radius, angle - .65, angle + .65); c.stroke();
  }
  if (packet > .78) {
    const pulse = Math.min(1, Math.max(0, (packet - .78) / .22));
    c.strokeStyle = `rgba(128,244,219,${(.55 * envelope * (1 - pulse)).toFixed(3)})`; c.lineWidth = 1.3;
    c.beginPath(); c.arc(endX, endY, 3 + pulse * 9, 0, Math.PI * 2); c.stroke();
  }
  c.restore();
}
