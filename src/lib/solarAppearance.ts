// One warm plasma palette for the photosphere, corona and prominences.
export const SOLAR_PLASMA_RGB = [244, 129, 50] as const;
export const solarPlasma = (alpha: number) => `rgba(${SOLAR_PLASMA_RGB.join(',')},${alpha})`;
