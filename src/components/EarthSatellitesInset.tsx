export default function EarthSatellitesInset({ onClose }: { onClose: () => void }) {
  return (
    <aside
      aria-label="Оригинальная модель спутников Земли"
      className="pointer-events-auto absolute inset-3 z-30 flex flex-col rounded-2xl border border-line bg-space-950/94 p-3 shadow-[0_18px_80px_rgba(0,0,0,.7)] backdrop-blur-xl md:inset-5"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-[13px] font-bold tracking-[0.1em] text-ink">СПУТНИКИ ЗЕМЛИ</h2>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-faint">
            оригинальная модель ЗемляГПТ.html · без изменения содержимого
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/earth-satellites-original.html"
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-line px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-dim transition-colors hover:border-teal/60 hover:text-teal"
          >
            открыть отдельно
          </a>
          <button
            onClick={onClose}
            className="rounded-md border border-line px-2 py-1 font-mono text-[12px] text-dim transition-colors hover:border-amber/60 hover:text-amber"
            aria-label="Закрыть оригинальную модель спутников Земли"
            title="Закрыть"
          >
            ×
          </button>
        </div>
      </div>

      <iframe
        title="Оригинальная модель спутников Земли"
        src="/earth-satellites-original.html"
        className="min-h-0 flex-1 rounded-xl border border-line bg-space-950"
      />
    </aside>
  );
}
