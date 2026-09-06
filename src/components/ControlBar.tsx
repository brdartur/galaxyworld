import { ACTIVITY_LABELS, type ActivitySettings, type ActivityKey } from "../lib/activitySettings";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

interface Props {
  activities: ActivitySettings;
  onToggleActivity: (key: ActivityKey) => void;
  playing: boolean;
  onTogglePlay: () => void;
  speed: number; // 1..365 симуляционных суток в секунду
  onSpeed: (v: number) => void;
  showOrbits: boolean;
  showLabels: boolean;
  onToggleOrbits: () => void;
  onToggleLabels: () => void;
  onReset: () => void;
  view3d: boolean;
  onToggleView: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  bgLabel: string;
  onCycleBg: () => void;
  showUfo: boolean;
  onToggleUfo: () => void;
  showAstro: boolean;
  onToggleAstro: () => void;
  onOpenMessages: () => void;
}

const LOG365 = Math.log(365);

export default function ControlBar({
  activities,
  onToggleActivity,
  playing,
  onTogglePlay,
  speed,
  onSpeed,
  showOrbits,
  showLabels,
  onToggleOrbits,
  onToggleLabels,
  onReset,
  view3d,
  onToggleView,
  isFullscreen,
  onToggleFullscreen,
  bgLabel,
  onCycleBg,
  showUfo,
  onToggleUfo,
  showAstro,
  onToggleAstro,
  onOpenMessages,
}: Props) {
  const pos = Math.round((Math.log(Math.max(1, speed)) / LOG365) * 1000);

  return (
    <div aria-label="Панель управления" className="map-control-panel pointer-events-auto flex max-w-[94vw] flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-lg border border-line bg-space-900/85 px-3.5 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-md">
      {/* play / pause + reset */}
      <div className="flex items-center gap-2">
        <button
          onClick={onTogglePlay}
          aria-label={playing ? "Пауза" : "Воспроизведение"}
          title={playing ? "Пауза (Space)" : "Пуск (Space)"}
          className="group grid h-11 w-11 place-items-center rounded-full bg-amber text-space-950 transition-all duration-200 hover:scale-105 hover:bg-[#ffc670] hover:shadow-[0_0_24px_rgba(255,181,71,0.45)] active:scale-95"
        >
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2.5" y="1.5" width="4" height="13" rx="1" />
              <rect x="9.5" y="1.5" width="4" height="13" rx="1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2.1a1 1 0 0 1 1.52-.86l9.1 5.9a1 1 0 0 1 0 1.7l-9.1 5.9A1 1 0 0 1 4 13.9V2.1Z" />
            </svg>
          )}
        </button>
        <button
          onClick={onReset}
          aria-label="Сброс времени"
          title="Сброс времени к нулю"
          className="grid h-9 w-9 place-items-center rounded-full border border-line text-dim transition-all duration-200 hover:rotate-[-40deg] hover:border-amber/60 hover:text-amber active:scale-90"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
          </svg>
        </button>
        <button
          onClick={onToggleFullscreen}
          aria-label={isFullscreen ? "Выйти из полноэкранного режима" : "Полноэкранный режим"}
          title={isFullscreen ? "Выйти из полноэкранного режима (Esc)" : "Полноэкранный режим"}
          className="grid h-9 w-9 place-items-center rounded-full border border-line text-dim transition-all duration-200 hover:scale-110 hover:border-teal/60 hover:text-teal active:scale-90"
        >
          {isFullscreen ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v4a1 1 0 0 1-1 1H3M16 3v4a1 1 0 0 0 1 1h4M8 21v-4a1 1 0 0 0-1-1H3M16 21v-4a1 1 0 0 1 1-1h4" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8V4a1 1 0 0 1 1-1h4M21 8V4a1 1 0 0 0-1-1h-4M3 16v4a1 1 0 0 0 1 1h4M21 16v4a1 1 0 0 1-1 1h-4" />
            </svg>
          )}
        </button>
      </div>

      <div className="h-8 w-px bg-line" />

      {/* ползунок скорости */}
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-[10px] tracking-[0.18em] text-faint">СКОРОСТЬ</span>
        <span className="font-mono text-[10px] text-faint">×1</span>
        <input
          type="range"
          min={0}
          max={1000}
          step={1}
          value={pos}
          onChange={(e) => {
            const v = Number(e.target.value);
            onSpeed(clamp(Math.round(Math.pow(365, v / 1000)), 1, 365));
          }}
          aria-label="Скорость симуляции (суток в секунду)"
          title="Скорость симуляции"
          className="speed-slider w-32 sm:w-48 lg:w-56"
        />
        <span className="font-mono text-[10px] text-faint">×365</span>
        <span className="min-w-[86px] rounded-md border border-line bg-space-850 px-2 py-1 text-center font-mono text-[11px]">
          <span className="font-semibold text-amber">×{speed}</span>
          <span className="text-dim"> сут/с</span>
        </span>
      </div>

      <div className="hidden h-8 w-px bg-line sm:block" />

      {/* переключатели */}
      <div className="flex items-center gap-1.5">
        <Toggle active={showOrbits} onClick={onToggleOrbits} label="ОРБИТЫ" />
        <Toggle active={showLabels} onClick={onToggleLabels} label="ИМЕНА" />
        <Toggle active={showUfo} onClick={onToggleUfo} label="НЛО" />
        <Toggle active={showAstro} onClick={onToggleAstro} label="АСТРОНАВТ" />
      </div>

      <div className="h-8 w-px bg-line" />

      {/* режим 2D / 3D */}
      <div className="flex items-center rounded-md border border-line bg-space-850 p-0.5" role="group" aria-label="Режим отображения">
        <button
          onClick={() => view3d && onToggleView()}
          aria-pressed={!view3d}
          title="Плоская карта (V)"
          className={`rounded px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wide transition-all duration-150 ${
            !view3d ? "bg-amber text-space-950 shadow-[0_0_12px_rgba(255,181,71,0.35)]" : "text-dim hover:text-ink"
          }`}
        >
          2D
        </button>
        <button
          onClick={() => !view3d && onToggleView()}
          aria-pressed={view3d}
          title="Объёмная модель (V)"
          className={`rounded px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wide transition-all duration-150 ${
            view3d ? "bg-amber text-space-950 shadow-[0_0_12px_rgba(255,181,71,0.35)]" : "text-dim hover:text-ink"
          }`}
        >
          3D
        </button>
      </div>

      <div className="hidden h-8 w-px bg-line sm:block" />

      {/* тема фона */}
      <button
        onClick={onCycleBg}
        title="Сменить фон (B)"
        className="group flex items-center gap-2 rounded-md border border-line bg-space-850 px-2.5 py-1.5 transition-all duration-150 hover:border-teal/50 hover:bg-space-800 active:scale-95"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="text-teal transition-transform duration-300 group-hover:rotate-90"
        >
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 3v3M21 12h-3" />
        </svg>
        <span className="font-mono text-[10px] tracking-[0.16em] text-faint">ФОН</span>
        <span className="font-mono text-[11px] font-semibold tracking-wide text-teal">{bgLabel}</span>
      </button>

      {/* редактор сообщений */}
      <button
        onClick={onOpenMessages}
        title="Изменить сообщения корабля и марсианина"
        className="group flex items-center gap-2 rounded-md border border-line bg-space-850 px-2.5 py-1.5 transition-all duration-150 hover:border-amber/50 hover:bg-space-800 active:scale-95"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-amber transition-transform duration-300 group-hover:-translate-y-0.5"
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
        </svg>
        <span className="font-mono text-[11px] font-semibold tracking-wide text-amber">СООБЩЕНИЯ</span>
      </button>
      <div className="flex w-full max-w-[88vw] gap-1.5 overflow-x-auto border-t border-line pt-2 pb-1" role="group" aria-label="Сценарии и эффекты">
        {(Object.keys(ACTIVITY_LABELS) as ActivityKey[]).map(key => (
          <Toggle key={key} active={activities[key]} onClick={() => onToggleActivity(key)} label={ACTIVITY_LABELS[key]} />
        ))}
      </div>
    </div>
  );
}

function Toggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] tracking-wide transition-all duration-150 active:scale-90 ${
        active ? "border-teal/50 bg-teal/10 text-teal" : "border-line text-faint hover:text-dim"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full transition-colors ${active ? "bg-teal shadow-[0_0_8px_rgba(67,217,201,0.8)]" : "bg-faint"}`}
      />
      {label}
    </button>
  );
}
