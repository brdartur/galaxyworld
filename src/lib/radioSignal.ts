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

export function drawRadioSignal(c: CanvasRenderingContext2D, station: ScreenAnchor | null, earth: ScreenAnchor | null, time: number) {
  const path = radioPath(station, earth); if (!path) return;
  const { x, y, ux, uy, length, endX, endY } = path;
  c.save(); c.strokeStyle = 'rgba(105,208,242,.16)'; c.lineWidth = 1;
  c.setLineDash([3, 7]); c.beginPath(); c.moveTo(x, y); c.lineTo(endX, endY); c.stroke(); c.setLineDash([]);
  // Curved wavefronts travel from the antenna to Earth in a repeating transmission.
  const angle = Math.atan2(uy, ux);
  for (let i = 0; i < 4; i++) {
    const progress = (time / 2.8 + i / 4) % 1;
    const px = x + ux * length * progress, py = y + uy * length * progress;
    const radius = 5 + 10 * progress;
    c.strokeStyle = `rgba(121,225,255,${.8 * Math.sin(Math.PI * progress)})`;
    c.lineWidth = 1.6;
    c.beginPath(); c.arc(px - ux * radius, py - uy * radius, radius, angle - .65, angle + .65); c.stroke();
  }
  const pulse = (time / .7) % 1;
  c.strokeStyle = `rgba(128,244,219,${.5 * (1 - pulse)})`; c.lineWidth = 1.3;
  c.beginPath(); c.arc(endX, endY, 3 + pulse * 9, 0, Math.PI * 2); c.stroke();
  c.restore();
}
