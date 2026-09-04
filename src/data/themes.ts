export interface BgTheme {
  id: string;
  label: string;
  note: string;
}

/** Фоны в духе «Интерстеллара» */
export const BG_THEMES: BgTheme[] = [
  { id: "deep", label: "ГЛУБОКИЙ КОСМОС", note: "Млечный Путь и туманности" },
  { id: "gargantua", label: "ГАРГАНТУА", note: "сверхмассивная чёрная дыра" },
  { id: "wormhole", label: "ЧЕРВОТОЧИНА", note: "сфера у Сатурна" },
  { id: "ice", label: "ЛЕДЯНАЯ МГЛА", note: "планета Манна" },
  { id: "nebula", label: "ТУМАННОСТЬ", note: "звёздные ясли" },
];

export const nextTheme = (id: string): string => {
  const i = BG_THEMES.findIndex((t) => t.id === id);
  return BG_THEMES[(i + 1) % BG_THEMES.length].id;
};
