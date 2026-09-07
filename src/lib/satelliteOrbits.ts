export type SatelliteClass = "LEO" | "MEO" | "GEO" | "HEO";

export interface EarthSatellite {
  id: string;
  name: string;
  cls: SatelliteClass;
  altKm: number;
  periodMin: number;
  incDeg: number;
  ecc: number;
  raanDeg: number;
  argDeg: number;
  meanDeg: number;
}

export interface SatellitePoint {
  x: number;
  y: number;
  z: number;
  depth: number;
}

export const SATELLITE_COLORS: Record<SatelliteClass, string> = {
  LEO: "#60a5fa",
  MEO: "#a78bfa",
  GEO: "#fbbf24",
  HEO: "#fb7185",
};

export const EARTH_SATELLITES: EarthSatellite[] = [
  { id: "25544", name: "ISS", cls: "LEO", altKm: 420, periodMin: 92.9, incDeg: 51.6, ecc: 0.0005, raanDeg: 72, argDeg: 80, meanDeg: 280 },
  { id: "20580", name: "Hubble", cls: "LEO", altKm: 540, periodMin: 95.4, incDeg: 28.5, ecc: 0.0003, raanDeg: 190, argDeg: 40, meanDeg: 160 },
  { id: "48274", name: "Tianhe", cls: "LEO", altKm: 390, periodMin: 92.2, incDeg: 41.5, ecc: 0.0007, raanDeg: 210, argDeg: 130, meanDeg: 70 },
  { id: "S-L1", name: "Starlink LEO-1", cls: "LEO", altKm: 550, periodMin: 95.6, incDeg: 53, ecc: 0.0002, raanDeg: 18, argDeg: 12, meanDeg: 30 },
  { id: "S-L2", name: "Starlink LEO-2", cls: "LEO", altKm: 560, periodMin: 95.8, incDeg: 53, ecc: 0.0002, raanDeg: 118, argDeg: 48, meanDeg: 210 },
  { id: "S-L3", name: "Наблюдение Земли", cls: "LEO", altKm: 710, periodMin: 99.1, incDeg: 98.2, ecc: 0.001, raanDeg: 306, argDeg: 25, meanDeg: 110 },
  { id: "GPS-1", name: "GPS MEO-1", cls: "MEO", altKm: 20200, periodMin: 718, incDeg: 55, ecc: 0.01, raanDeg: 34, argDeg: 12, meanDeg: 44 },
  { id: "GPS-2", name: "GPS MEO-2", cls: "MEO", altKm: 20200, periodMin: 718, incDeg: 55, ecc: 0.012, raanDeg: 154, argDeg: 82, meanDeg: 206 },
  { id: "GAL-1", name: "Galileo", cls: "MEO", altKm: 23222, periodMin: 845, incDeg: 56, ecc: 0.004, raanDeg: 252, argDeg: 36, meanDeg: 300 },
  { id: "GLO-1", name: "ГЛОНАСС", cls: "MEO", altKm: 19100, periodMin: 675, incDeg: 64.8, ecc: 0.002, raanDeg: 82, argDeg: 144, meanDeg: 18 },
  { id: "GEO-1", name: "Связь GEO-1", cls: "GEO", altKm: 35786, periodMin: 1436, incDeg: 0.1, ecc: 0.0002, raanDeg: 0, argDeg: 0, meanDeg: 20 },
  { id: "GEO-2", name: "Метео GEO", cls: "GEO", altKm: 35786, periodMin: 1436, incDeg: 0.2, ecc: 0.0003, raanDeg: 0, argDeg: 0, meanDeg: 142 },
  { id: "GEO-3", name: "ТВ GEO", cls: "GEO", altKm: 35786, periodMin: 1436, incDeg: 0.1, ecc: 0.0002, raanDeg: 0, argDeg: 0, meanDeg: 278 },
  { id: "HEO-1", name: "Молния HEO", cls: "HEO", altKm: 23000, periodMin: 717, incDeg: 63.4, ecc: 0.68, raanDeg: 28, argDeg: 270, meanDeg: 12 },
  { id: "HEO-2", name: "Высокая эллиптическая", cls: "HEO", altKm: 26500, periodMin: 960, incDeg: 57, ecc: 0.55, raanDeg: 216, argDeg: 248, meanDeg: 198 },
  { id: "HEO-3", name: "Научная HEO", cls: "HEO", altKm: 30000, periodMin: 1080, incDeg: 42, ecc: 0.43, raanDeg: 310, argDeg: 225, meanDeg: 96 },
];

export function classifySatellite(altKm: number, ecc: number): SatelliteClass {
  if (ecc > 0.25) return "HEO";
  if (altKm < 2000) return "LEO";
  if (altKm > 33000 && altKm < 39000) return "GEO";
  if (altKm < 33000) return "MEO";
  return "HEO";
}

export function scaledOrbitRadius(altKm: number, earthRadiusPx: number) {
  if (altKm < 2000) return earthRadiusPx + 22 + (altKm / 2000) * 18;
  if (altKm < 30000) return earthRadiusPx + 44 + ((altKm - 2000) / 28000) * 62;
  return earthRadiusPx + 112 + Math.min(28, ((altKm - 30000) / 12000) * 18);
}

function solveKepler(mean: number, ecc: number) {
  let e = mean;
  for (let i = 0; i < 5; i++) e -= (e - ecc * Math.sin(e) - mean) / (1 - ecc * Math.cos(e));
  return e;
}

export function satellitePosition(s: EarthSatellite, elapsedSeconds: number, earthRadiusPx: number): SatellitePoint {
  const mean = ((s.meanDeg * Math.PI / 180) + elapsedSeconds / (s.periodMin * 60) * Math.PI * 2) % (Math.PI * 2);
  const e = solveKepler(mean, s.ecc);
  const nu = 2 * Math.atan2(Math.sqrt(1 + s.ecc) * Math.sin(e / 2), Math.sqrt(1 - s.ecc) * Math.cos(e / 2));
  const baseR = scaledOrbitRadius(s.altKm, earthRadiusPx);
  const rr = baseR * (1 - s.ecc * Math.cos(e));
  const arg = s.argDeg * Math.PI / 180;
  const inc = s.incDeg * Math.PI / 180;
  const raan = s.raanDeg * Math.PI / 180;
  const x0 = rr * Math.cos(nu);
  const z0 = rr * Math.sin(nu);
  const x1 = x0 * Math.cos(arg) - z0 * Math.sin(arg);
  const z1 = x0 * Math.sin(arg) + z0 * Math.cos(arg);
  const y2 = -z1 * Math.sin(inc);
  const z2 = z1 * Math.cos(inc);
  const x3 = x1 * Math.cos(raan) - z2 * Math.sin(raan);
  const z3 = x1 * Math.sin(raan) + z2 * Math.cos(raan);
  const x = x3;
  const y = y2 * 0.86 - z3 * 0.34;
  return { x, y, z: z3, depth: z3 };
}

export function orbitSamples(s: EarthSatellite, elapsedSeconds: number, earthRadiusPx: number, count = 144) {
  return Array.from({ length: count + 1 }, (_, i) =>
    satellitePosition({ ...s, meanDeg: (i / count) * 360 }, elapsedSeconds, earthRadiusPx)
  );
}
