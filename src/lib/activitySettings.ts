export const ACTIVITY_LABELS = {
  drilling: "БУРЕНИЕ",
  research: "ИССЛЕДОВАНИЕ",
  rovers: "ЛУНОХОДЫ",
  solar: "АКТИВНОСТЬ СОЛНЦА",
  station: "СТАНЦИЯ",
  radio: "РАДИОСИГНАЛ",
  stationCrew: "ЭКИПАЖ СТАНЦИИ",
  stationRepair: "РЕМОНТ СТАНЦИИ",
  spacewalk: "ВЫХОД В КОСМОС",
  martian: "РАКЕТА МАРСИАНИНА",
  disks: "ПРОТОДИСКИ",
} as const;

export type ActivityKey = keyof typeof ACTIVITY_LABELS;
export type ActivitySettings = Record<ActivityKey, boolean>;
export const DEFAULT_ACTIVITIES: ActivitySettings = {
  drilling: true, research: true, rovers: true, solar: true,
  radio: true, station: true, stationCrew: true, stationRepair: true, spacewalk: true, martian: true, disks: true,
};
export const SURFACE_ACTOR_SCALE = .7;
export const SURFACE_DURATION = 40;
export const ROVER_PLANETS = ["jupiter", "saturn", "uranus", "neptune"];
export const smooth = (t: number) => {
  const v = Math.max(0, Math.min(1, t));
  return v * v * (3 - 2 * v);
};

export function surfaceMission(t: number) {
  const walkOut = smooth(t / 8);
  const walkBack = smooth((t - 33) / 7);
  return {
    angle: 0.68 * walkOut * (1 - walkBack),
    visible: t > 0.5 && t < 39.5,
    walking: t < 8 || t > 33,
    drilling: t >= 10 && t < 22,
    sampling: t >= 22 && t < 28,
    scanning: t >= 28 && t < 33,
    label: t < 8 ? "ВЫХОД / ПЕРЕХОД" : t < 10 ? "УСТАНОВКА БУРА" : t < 22 ? "БУРЕНИЕ" : t < 28 ? "СБОР ОБРАЗЦА" : t < 33 ? "СКАНИРОВАНИЕ" : "ВОЗВРАЩЕНИЕ",
  };
}
