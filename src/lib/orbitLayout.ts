import { PLANETS } from "../data/planets";

export const PLANET_RADIUS_2D = (km: number) => Math.min(11, Math.max(3.4, 3.1 + 6.4 * Math.sqrt(km / 142984))) * 6;
export const SUN_RADIUS_2D = 74;
/** Maintain clearance even when neighbours align and Saturn's rings face the gap. */
export function spacedOrbits(aspect = 1) {
  let previousOrbit = 0, previousExtent = SUN_RADIUS_2D;
  return PLANETS.map(p => {
    const extent = PLANET_RADIUS_2D(p.diameterKm) * 1.24 * (p.ring ? 2.6 : 1);
    const orbit = previousOrbit + (previousExtent + extent + 24) / aspect;
    previousOrbit = orbit; previousExtent = extent;
    return orbit;
  });
}

const radii3D = (() => {
  let previous = 0, previousExtent = 2.6;
  return PLANETS.map(p => {
    const extent = (.24 + Math.sqrt(p.diameterKm / 142984) * 1.5) * 2 * 1.28 * (p.ring ? 2.6 : 1);
    // At least twice the former distance, with additional clearance for large neighbours.
    const r = Math.max(2 * (7 + Math.sqrt(p.distAU) * 4.1), previous + previousExtent + extent + 2);
    previous = r; previousExtent = extent;
    return r;
  });
})();

/** AU interpolation also places the asteroid belt consistently between Mars and Jupiter. */
export function orbitRadius3D(au: number) {
  const radii = radii3D;
  const upper = PLANETS.findIndex(p => p.distAU >= au);
  if (upper < 0) return radii[radii.length - 1] + (au - PLANETS[7].distAU);
  if (upper === 0) return radii[0] * au / PLANETS[0].distAU;
  const f = (au - PLANETS[upper - 1].distAU) / (PLANETS[upper].distAU - PLANETS[upper - 1].distAU);
  return radii[upper - 1] + (radii[upper] - radii[upper - 1]) * f;
}
