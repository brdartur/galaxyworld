export interface AtmGas {
  gas: string;
  pct: number;
}

export interface BodyData {
  id: string;
  index: number; // 0 = Солнце
  name: string;
  type: string;
  color: string;
  colorLight: string;
  colorDeep: string;
  diameterKm: number;
  distMkm: number; // млн км (для Солнца = 0)
  distAU: number;
  periodDays: number;
  velocityKmS: number;
  moons: number;
  angle0: number; // начальная фаза на карте
  ecc?: number; // эксцентриситет орбиты
  periDeg?: number; // аргумент перигелия, градусы
  ring?: boolean;
  hasMoon?: boolean;
  fact: string;
  sunStats?: { label: string; value: string }[];

  /* ---- данные для режима исследования поверхности ---- */
  temp: string; // температура (главный показатель)
  tempNote?: string;
  pressure: string;
  environment: string; // среда
  surface: string; // поверхность / фактура
  atm: AtmGas[]; // состав атмосферы
  atmNote?: string; // если атмосферы фактически нет
  wind?: string;
  rotationText: string; // длина суток
  spinDur: number; // секунд на оборот в режиме исследования
  spinReverse?: boolean; // ретроградное вращение
}

export const SUN: BodyData = {
  id: "sun",
  index: 0,
  name: "Солнце",
  type: "Жёлтый карлик · спектр G2V",
  color: "#ffb547",
  colorLight: "#fff3d6",
  colorDeep: "#c96a1e",
  diameterKm: 1392700,
  distMkm: 0,
  distAU: 0,
  periodDays: 0,
  velocityKmS: 0,
  moons: 0,
  angle0: 0,
  fact: "Внутри Солнца поместилось бы 1,3 миллиона планет размером с Землю, а его свет добирается до нас за 8 минут 20 секунд.",
  sunStats: [
    { label: "Температура поверхности", value: "5 500 °C" },
    { label: "Температура ядра", value: "≈ 15 000 000 °C" },
    { label: "Доля массы системы", value: "99,86 %" },
    { label: "Возраст", value: "≈ 4,6 млрд лет" },
  ],
  temp: "+5 500 °C",
  tempNote: "фотосфера · в ядре ≈ 15 000 000 °C",
  pressure: "плазма · твёрдой поверхности нет",
  environment:
    "Раскалённый шар плазмы, удерживаемый собственной гравитацией. Каждую секунду Солнце превращает 4 млн тонн вещества в чистую энергию; вспышки и корональные выбросы отправляют в пространство потоки заряженных частиц — солнечный ветер.",
  surface:
    "Зернистая фотосфера из конвективных ячеек, тёмные пятна с мощными магнитными полями, протуберанцы и хромосферные вспышки. Поверхности в привычном смысле нет — газ просто становится всё плотнее с глубиной.",
  atm: [
    { gas: "Водород", pct: 73.5 },
    { gas: "Гелий", pct: 24.9 },
    { gas: "Тяжёлые элементы", pct: 1.6 },
  ],
  rotationText: "≈ 27 земных суток",
  spinDur: 27,
};

export const PLANETS: BodyData[] = [
  {
    id: "mercury",
    index: 1,
    name: "Меркурий",
    type: "Планета земной группы",
    color: "#b5a48f",
    colorLight: "#e8dcc8",
    colorDeep: "#57493c",
    diameterKm: 4879,
    distMkm: 57.9,
    distAU: 0.39,
    periodDays: 88,
    velocityKmS: 47.4,
    moons: 0,
    angle0: 0.8,
    ecc: 0.2056,
    periDeg: 77.5,
    fact: "Перепад температур на поверхности — от −173 °C ночью до +427 °C днём: самый резкий контраст среди всех планет.",
    temp: "−173…+427 °C",
    tempNote: "ночь / день",
    pressure: "практически вакуум · ~10⁻¹⁵ бар",
    environment:
      "Мир без защитной атмосферы: космос начинается прямо у поверхности. Днём грунт раскаляется до плавления свинца, ночью мгновенно вымораживается. Небо всегда чёрное, а Солнце в 2,8 раза больше, чем видимое с Земли.",
    surface:
      "Серо-коричневый реголит, усыпанный кратерами всех возрастов: от микровпадин до бассейна Калорис диаметром 1550 км. Встречаются светлые лучи молодых кратеров и длинные уступы — следы остывания и сжатия планеты.",
    atm: [],
    atmNote: "Атмосферы фактически нет — лишь следовая экзосфера из атомов, выбитых солнечным ветром с поверхности.",
    rotationText: "58,6 земных суток",
    spinDur: 59,
  },
  {
    id: "venus",
    index: 2,
    name: "Венера",
    type: "Планета земной группы",
    color: "#e6c07a",
    colorLight: "#ffedbe",
    colorDeep: "#8a6430",
    diameterKm: 12104,
    distMkm: 108.2,
    distAU: 0.72,
    periodDays: 224.7,
    velocityKmS: 35.0,
    moons: 0,
    angle0: 2.4,
    ecc: 0.0068,
    periDeg: 131.5,
    fact: "Венера вращается в обратную сторону: Солнце там восходит на западе, а одни сутки длятся дольше года — 243 земных дня.",
    temp: "+464 °C",
    tempNote: "у поверхности · везде одинаково",
    pressure: "92 бара · как на глубине 900 м в океане",
    environment:
      "Парниковый ад: плотная углекислотная атмосфера запирает тепло, а облака из серной кислоты отражают большую часть света. У поверхности ветра медленные, но на высоте облаков разгоняются до 360 км/ч — атмосфера облетает планету за 4 дня.",
    surface:
      "Скрыта вечной облачной пеленой. Под ней — базальтовые равнины, щитовые вулканы и «тессеры» — смятые древние материки. Жёлто-оранжевая дымка сернокислотных облаков закручивается в шевроны вокруг полюсов.",
    atm: [
      { gas: "Углекислый газ", pct: 96.5 },
      { gas: "Азот", pct: 3.5 },
      { gas: "Сернистый газ, аргон", pct: 0.04 },
    ],
    wind: "до 360 км/ч в облачном слое",
    rotationText: "243 суток · ретроградно",
    spinDur: 61,
    spinReverse: true,
  },
  {
    id: "earth",
    index: 3,
    name: "Земля",
    type: "Планета земной группы",
    color: "#45a5f2",
    colorLight: "#c6eaff",
    colorDeep: "#123f8e",
    diameterKm: 12756,
    distMkm: 149.6,
    distAU: 1.0,
    periodDays: 365.25,
    velocityKmS: 29.8,
    moons: 1,
    angle0: 4.2,
    ecc: 0.0167,
    periDeg: 102.9,
    hasMoon: true,
    fact: "Единственное известное место во Вселенной, где есть жизнь. Океаны покрывают 71 % поверхности планеты.",
    temp: "+15 °C",
    tempNote: "средняя · от −89 до +57 °C",
    pressure: "1,01 бара · 1 атмосфера",
    environment:
      "Единственная обитаемая среда: жидкая вода на поверхности, кислородная атмосфера и магнитное поле, отклоняющее солнечный ветер. Погода живёт за счёт перепада нагрева экватора и полюсов, порождая циклоны, дожди и течения.",
    surface:
      "Голубые океаны, зелёно-охристые материки с горными хребтами и пустынями, белые полярные шапки. С орбиты планета укрыта кружевом постоянно меняющихся облачных фронтов.",
    atm: [
      { gas: "Азот", pct: 78.1 },
      { gas: "Кислород", pct: 20.9 },
      { gas: "Аргон", pct: 0.93 },
      { gas: "Углекислый газ", pct: 0.04 },
    ],
    wind: "в среднем 20–60 км/ч",
    rotationText: "23 ч 56 мин",
    spinDur: 24,
  },
  {
    id: "mars",
    index: 4,
    name: "Марс",
    type: "Планета земной группы",
    color: "#e0714a",
    colorLight: "#ffb08c",
    colorDeep: "#7c2f18",
    diameterKm: 6792,
    distMkm: 227.9,
    distAU: 1.52,
    periodDays: 687,
    velocityKmS: 24.1,
    moons: 2,
    angle0: 5.6,
    ecc: 0.0934,
    periDeg: 336.0,
    fact: "На Марсе находится вулкан Олимп — самая высокая гора Солнечной системы: 21,9 км, почти три Эвереста, поставленных друг на друга.",
    temp: "−63 °C",
    tempNote: "средняя · летом до +20 °C",
    pressure: "0,006 бара · почти вакуум",
    environment:
      "Холодная ржавая пустыня с тонкой углекислотной атмосферой. Глобальные пылевые бури могут неделями закрывать всю планету, а зимой на полюсах вымерзает углекислый снег. Небо днём рыжевато-бурое, на закате — голубое.",
    surface:
      "Окисленная железом пыль и песок, тёмные базальтовые равнины, гигантский каньон Маринер длиной 4000 км и шапки из водяного льда с сухим льдом. Повсюду следы древних рек и озёр.",
    atm: [
      { gas: "Углекислый газ", pct: 95.3 },
      { gas: "Азот", pct: 2.7 },
      { gas: "Аргон", pct: 1.6 },
    ],
    wind: "до 100 км/ч в пылевых бурях",
    rotationText: "24 ч 37 мин",
    spinDur: 24.6,
  },
  {
    id: "jupiter",
    index: 5,
    name: "Юпитер",
    type: "Газовый гигант",
    color: "#d9a066",
    colorLight: "#ffe2b4",
    colorDeep: "#74481f",
    diameterKm: 142984,
    distMkm: 778.6,
    distAU: 5.2,
    periodDays: 4331,
    velocityKmS: 13.1,
    moons: 95,
    angle0: 1.4,
    ecc: 0.0489,
    periDeg: 14.8,
    fact: "Большое Красное Пятно — ураган размером с две Земли, который бушует в атмосфере Юпитера уже более 350 лет.",
    temp: "−108 °C",
    tempNote: "верхний слой облаков",
    pressure: "нет поверхности · растёт до металлического водорода",
    environment:
      "Бурлящий мир полос и штормов: струйные течения несут облака со скоростью до 620 км/ч, молнии в тысячи раз мощнее земных. Планета — мощный источник радиоизлучения и радиационных поясов.",
    surface:
      "Поверхности нет — только облака. Кремовые, ржавые и белые полосы аммиачных кристаллов чередуются с вихрями, а Большое Красное Пятно — антициклон размером с две Земли — живёт уже более 350 лет.",
    atm: [
      { gas: "Водород", pct: 89.8 },
      { gas: "Гелий", pct: 10.2 },
      { gas: "Метан, аммиак", pct: 0.3 },
    ],
    wind: "до 620 км/ч",
    rotationText: "9 ч 56 мин · самые быстрые сутки",
    spinDur: 10,
  },
  {
    id: "saturn",
    index: 6,
    name: "Сатурн",
    type: "Газовый гигант",
    color: "#e3c98f",
    colorLight: "#fff0c4",
    colorDeep: "#84662f",
    diameterKm: 120536,
    distMkm: 1433.5,
    distAU: 9.58,
    periodDays: 10747,
    velocityKmS: 9.7,
    moons: 146,
    angle0: 3.2,
    ecc: 0.0565,
    periDeg: 92.4,
    ring: true,
    fact: "Средняя плотность Сатурна — 0,69 г/см³, меньше плотности воды: в гигантском океане эта планета не утонула бы.",
    temp: "−139 °C",
    tempNote: "верхний слой облаков",
    pressure: "нет поверхности · газообразный водород → металлический",
    environment:
      "Царство колец из льда и камня — от пылинок до глыб размером с дом. В полярных облаках закручен правильный шестиугольник из струйного течения, а в центре — гигантский ураган.",
    surface:
      "Палевые облачные полосы спокойнее юпитерианских. Главный «пейзаж» — кольца шириной 280 000 км при толщине всего около 10 метров: лёд, отражающий солнечный свет, отсюда жемчужное сияние планеты.",
    atm: [
      { gas: "Водород", pct: 96.3 },
      { gas: "Гелий", pct: 3.25 },
      { gas: "Метан, аммиак", pct: 0.45 },
    ],
    wind: "до 1 800 км/ч на экваторе",
    rotationText: "10 ч 42 мин",
    spinDur: 11,
  },
  {
    id: "uranus",
    index: 7,
    name: "Уран",
    type: "Ледяной гигант",
    color: "#7fd4d9",
    colorLight: "#cdf5f7",
    colorDeep: "#2b7278",
    diameterKm: 51118,
    distMkm: 2872.5,
    distAU: 19.2,
    periodDays: 30589,
    velocityKmS: 6.8,
    moons: 28,
    angle0: 0.3,
    ecc: 0.0457,
    periDeg: 171.0,
    fact: "Уран «лежит на боку»: его ось наклонена на 98°, поэтому каждый полюс по 42 земных года смотрит то на Солнце, то в темноту.",
    temp: "−197 °C",
    tempNote: "самая холодная атмосфера планет",
    pressure: "нет поверхности · ледяная мантия из воды, метана и аммиака",
    environment:
      "Планета, лежащая на боку: ось наклонена на 98°, поэтому сезоны длятся по 42 года, а полюса по очереди погружаются в десятилетия ночи. В глубине «идут дожди» из жидких алмазов.",
    surface:
      "Гладкий бирюзовый диск — метан в атмосфере поглощает красный свет. Лишь в мощный телескоп видны тонкие полосы облаков, яркие метановые перья и едва заметные кольца, ориентированные вертикально.",
    atm: [
      { gas: "Водород", pct: 82.5 },
      { gas: "Гелий", pct: 15.2 },
      { gas: "Метан", pct: 2.3 },
    ],
    wind: "до 900 км/ч",
    rotationText: "17 ч 14 мин · ретроградно",
    spinDur: 17,
    spinReverse: true,
  },
  {
    id: "neptune",
    index: 8,
    name: "Нептун",
    type: "Ледяной гигант",
    color: "#5478e8",
    colorLight: "#aec4ff",
    colorDeep: "#1d2c74",
    diameterKm: 49528,
    distMkm: 4495.1,
    distAU: 30.05,
    periodDays: 59800,
    velocityKmS: 5.4,
    moons: 16,
    angle0: 4.9,
    ecc: 0.0113,
    periDeg: 45.0,
    fact: "На Нептуне дуют самые быстрые ветры в Солнечной системе — до 2 100 км/ч, вдвое быстрее скорости звука на Земле.",
    temp: "−201 °C",
    tempNote: "верхний слой облаков",
    pressure: "нет поверхности · мантия из «горячего льда»",
    environment:
      "Самая ветреная планета: сверхзвуковые потоки несут облака со скоростью 2 100 км/ч, хотя Солнце здесь светит в 900 раз слабее, чем на Земле. Планета открыта «на кончике пера» — по расчётам небесной механики.",
    surface:
      "Насыщенно-синяя атмосфера с белыми перистыми облаками, взлетающими на 50 км за считанные часы, и периодически возникающими тёмными штормовыми пятнами размером с Землю.",
    atm: [
      { gas: "Водород", pct: 80 },
      { gas: "Гелий", pct: 19 },
      { gas: "Метан", pct: 1.5 },
    ],
    wind: "до 2 100 км/ч · рекорд системы",
    rotationText: "16 ч 06 мин",
    spinDur: 16,
  },
];

export const BODIES: Record<string, BodyData> = {
  sun: SUN,
  ...Object.fromEntries(PLANETS.map((p) => [p.id, p])),
};

/** Реальные периоды вращения вокруг собственной оси, земные сутки.
    Отрицательные значения — ретроградное вращение (Венера, Уран). */
export const SPIN_DAYS: Record<string, number> = {
  sun: 25.4,
  mercury: 58.65,
  venus: -243.0,
  earth: 0.997,
  mars: 1.026,
  jupiter: 0.414,
  saturn: 0.444,
  uranus: -0.718,
  neptune: 0.671,
};

/* ---------------- форматирование ---------------- */

const TAU2 = Math.PI * 2;

/** Положение планеты на эллиптической орбите (уравнение Кеплера).
    Возвращает радиус в а.е. и угол в плоскости орбиты. */
export function keplerPos(d: BodyData, simDays: number): { rAU: number; theta: number } {
  const e = d.ecc ?? 0;
  const M = d.angle0 + TAU2 * (simDays / d.periodDays);
  let E = M;
  for (let i = 0; i < 6; i++) {
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  const xv = Math.cos(E) - e;
  const yv = Math.sqrt(1 - e * e) * Math.sin(E);
  const w = ((d.periDeg ?? 0) * Math.PI) / 180;
  const x = xv * Math.cos(w) - yv * Math.sin(w);
  const y = xv * Math.sin(w) + yv * Math.cos(w);
  const rAU = d.distAU * (1 - e * Math.cos(E));
  return { rAU, theta: Math.atan2(y, x) };
}

/** Точки контура орбиты: r в а.е. + угол (для отрисовки эллипса) */
export function orbitPath(d: BodyData, steps = 110): { r: number; a: number }[] {
  const e = d.ecc ?? 0;
  const w = ((d.periDeg ?? 0) * Math.PI) / 180;
  const p = d.distAU * (1 - e * e);
  const pts: { r: number; a: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * TAU2;
    pts.push({ r: p / (1 + e * Math.cos(th - w)), a: th });
  }
  return pts;
}

export const fmtInt = (n: number): string => n.toLocaleString("ru-RU");

export const fmtDecimal = (n: number, digits = 1): string =>
  n.toLocaleString("ru-RU", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export const fmtPeriod = (days: number): string => {
  if (days <= 0) return "—";
  if (days < 1000) return `${fmtDecimal(days, 2)} сут`;
  const years = days / 365.25;
  return `${fmtDecimal(years, 1)} года (${fmtInt(Math.round(days))} сут)`;
};

export const fmtElapsed = (days: number): string => {
  const y = Math.floor(days / 365.25);
  const d = Math.floor(days - y * 365.25);
  if (y <= 0) return `${d} сут`;
  return `${y} г ${String(d).padStart(3, "0")} сут`;
};

export interface StatRow {
  label: string;
  value: string;
}

export const getStats = (b: BodyData): StatRow[] => {
  if (b.id === "sun") {
    return [{ label: "Диаметр", value: `${fmtInt(b.diameterKm)} км` }, ...(b.sunStats ?? [])];
  }
  return [
    { label: "Диаметр", value: `${fmtInt(b.diameterKm)} км` },
    { label: "Расстояние от Солнца", value: `${fmtDecimal(b.distMkm, 1)} млн км` },
    { label: "То же в а.е.", value: `${fmtDecimal(b.distAU, 2)} а.е.` },
    { label: "Орбитальный период", value: fmtPeriod(b.periodDays) },
    { label: "Орбитальная скорость", value: `${fmtDecimal(b.velocityKmS, 1)} км/с` },
    { label: "Спутники", value: `${b.moons}` },
  ];
};

export interface CompareBar {
  label: string;
  display: string;
  pct: number; // 0..100
  ref: string;
}

const LOG_MIN_P = Math.log(88);
const LOG_MAX_P = Math.log(59800);

export const getCompareBars = (b: BodyData): CompareBar[] => {
  if (b.id === "sun") return [];
  const dPct = Math.max(4, (b.diameterKm / 142984) * 100);
  const aPct = Math.max(4, (b.distAU / 30.05) * 100);
  const pPct = Math.max(4, ((Math.log(b.periodDays) - LOG_MIN_P) / (LOG_MAX_P - LOG_MIN_P)) * 100);
  return [
    { label: "Диаметр", display: `${fmtDecimal((b.diameterKm / 12756) * 100, 0)} % Земли`, pct: dPct, ref: "от Юпитера" },
    { label: "Дистанция", display: `${fmtDecimal(b.distAU, 2)} а.е.`, pct: aPct, ref: "от Нептуна" },
    { label: "Год", display: `${fmtDecimal(b.periodDays / 365.25, 2)} земн. лет`, pct: pPct, ref: "лог. шкала" },
  ];
};
