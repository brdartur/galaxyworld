import { PLANETS, SUN, type BodyData } from "../data/planets";

interface Props {
  selectedId: string | null;
  hoverId: string | null;
  onSelect: (id: string) => void;
  onHover?: (id: string | null) => void;
}

const ALL: BodyData[] = [SUN, ...PLANETS];

/** Вертикальный список объектов — левый край карты (md+) */
export function PlanetRail({ selectedId, hoverId, onSelect, onHover }: Props) {
  return (
    <nav className="pointer-events-auto absolute top-16 bottom-44 left-4 hidden max-w-[212px] flex-col gap-1 overflow-y-auto md:flex" aria-label="Объекты системы">
      <span className="mb-2 pl-3 font-mono text-[11px] tracking-[0.24em] text-faint">ОБЪЕКТЫ</span>
      {ALL.map((b) => {
        const sel = selectedId === b.id;
        const hov = hoverId === b.id;
        return (
          <button
            key={b.id}
            onClick={() => onSelect(b.id)}
            onMouseEnter={() => onHover?.(b.id)}
            onMouseLeave={() => onHover?.(null)}
            className={`group flex items-center gap-3 rounded-md border-l-2 py-2 pr-5 pl-3 text-left transition-all duration-200 ${
              sel
                ? "border-amber bg-space-850/80"
                : hov
                  ? "border-teal/70 bg-space-900/60"
                  : "border-transparent hover:translate-x-1 hover:border-line hover:bg-space-900/50"
            }`}
          >
            <span
              className="h-4 w-4 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-125"
              style={{ background: b.color, boxShadow: sel || hov ? `0 0 12px ${b.color}` : "none" }}
            />
            <span className={`w-[82px] text-[16px] leading-none font-semibold transition-colors ${sel ? "text-amber" : hov ? "text-teal" : "text-dim group-hover:text-ink"}`}>
              {b.name}
            </span>
            <span className="whitespace-nowrap font-mono text-[10px] text-faint">
              {b.id === "sun" ? "★" : `${b.distAU.toLocaleString("ru-RU")} а.е.`}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/** Компактные чипы для мобильных — под шапкой */
export function MobileChips({ selectedId, onSelect }: Props) {
  return (
    <div className="scroll-x pointer-events-auto absolute top-2 right-2 left-2 flex gap-1.5 overflow-x-auto pb-1 md:hidden">
      {ALL.map((b) => {
        const sel = selectedId === b.id;
        return (
          <button
            key={b.id}
            onClick={() => onSelect(b.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium whitespace-nowrap transition-all active:scale-95 ${
              sel ? "border-amber/70 bg-amber/15 text-amber" : "border-line bg-space-900/80 text-dim"
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />
            {b.name}
          </button>
        );
      })}
    </div>
  );
}
