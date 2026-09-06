import Reveal from "./Reveal";
import { PLANETS, SUN, fmtDecimal, fmtInt, fmtPeriod, type BodyData } from "../data/planets";

interface Props {
  onSelect: (id: string) => void;
}

const MAX_D = 142984; // Юпитер

function DCard({ b, onSelect, delay }: { b: BodyData; onSelect: (id: string) => void; delay: number }) {
  return (
    <Reveal delay={delay} className="flex-1 snap-start">
      <article
        onClick={() => onSelect(b.id)}
        className="group h-full cursor-pointer rounded-lg border border-line bg-space-900/60 p-5 transition-all duration-300 hover:-translate-y-1.5 hover:bg-space-900 hover:shadow-[0_16px_44px_rgba(0,0,0,0.5)]"
        style={{ borderColor: undefined }}
      >
        <div className="flex items-center justify-between">
          <span
            className="h-11 w-11 rounded-full transition-transform duration-300 group-hover:scale-110"
            style={{
              background: `radial-gradient(circle at 32% 30%, ${b.colorLight}, ${b.color} 50%, ${b.colorDeep})`,
              boxShadow: `0 0 18px ${b.color}44`,
            }}
          />
          <span className="font-mono text-[10px] tracking-[0.22em] text-faint">{String(b.index).padStart(2, "0")}</span>
        </div>
        <h3 className="mt-4 font-display text-[19px] font-700 text-ink transition-colors group-hover:text-amber">{b.name}</h3>
        <p className="mt-0.5 font-mono text-[9.5px] tracking-[0.16em] text-faint uppercase">{b.type}</p>
        <dl className="mt-4 space-y-1.5 border-t border-line pt-3">
          <Row k="Диаметр" v={`${fmtInt(b.diameterKm)} км`} />
          <Row k="До Солнца" v={b.distAU ? `${fmtDecimal(b.distMkm, 1)} млн км` : "—"} />
          <Row k="Год" v={b.periodDays ? fmtPeriod(b.periodDays) : "—"} />
          <Row k="Скорость" v={b.velocityKmS ? `${fmtDecimal(b.velocityKmS, 1)} км/с` : "—"} />
        </dl>
        <div className="mt-3 h-[5px] overflow-hidden rounded-full bg-space-800">
          <div
            className="bar-grow h-full rounded-full"
            style={{
              width: `${Math.max(3, (b.diameterKm / MAX_D) * 100)}%`,
              background: `linear-gradient(90deg, ${b.colorDeep}, ${b.color})`,
            }}
          />
        </div>
        <span className="mt-4 inline-flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.14em] text-dim transition-colors group-hover:text-amber">
          ОТКРЫТЬ
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-1">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </article>
    </Reveal>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[12px] text-dim">{k}</dt>
      <dd className="text-right font-mono text-[12px] text-ink/90">{v}</dd>
    </div>
  );
}

export default function DossierSection({ onSelect }: Props) {
  return (
    <section id="dossier" className="relative border-t border-line bg-space-950 py-16 md:py-20">
      <div className="mx-auto max-w-[1440px] px-4 md:px-8">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10.5px] tracking-[0.3em] text-teal">ДОСЬЕ ОБЪЕКТОВ</p>
              <h2 className="mt-3 font-display text-[26px] leading-tight font-bold text-ink md:text-[34px]">
                Восемь миров <span className="text-amber">+ Солнце</span>
              </h2>
            </div>
            <p className="max-w-[380px] text-[13px] leading-relaxed text-dim">
              Нажмите на карточку — планета всплывёт над картой, покажет свою фактуру и расскажет о среде, температуре и атмосфере.
            </p>
          </div>
        </Reveal>

        <div className="scroll-x mt-10 flex snap-x gap-4 overflow-x-auto pb-4 lg:grid lg:grid-cols-3 lg:overflow-visible">
          <DCard b={SUN} onSelect={onSelect} delay={0} />
          {PLANETS.map((b, i) => (
            <DCard key={b.id} b={b} onSelect={onSelect} delay={Math.min(i * 70, 420)} />
          ))}
        </div>

        <Reveal delay={120}>
          <p className="mt-6 font-mono text-[10px] tracking-[0.14em] text-faint">
            ИСТОЧНИК: NASA PLANETARY FACT SHEET · ЗНАЧЕНИЯ ОКРУГЛЕНЫ · МАСШТАБ ОРБИТ УСЛОВНЫЙ, С УЧЁТОМ РАЗМЕРОВ ПЛАНЕТ
          </p>
        </Reveal>
      </div>
    </section>
  );
}
