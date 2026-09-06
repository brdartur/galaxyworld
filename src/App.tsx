import { useCallback, useEffect, useRef, useState } from "react";
import DraggableStation from "./components/DraggableStation";
import SolarCanvas from "./components/SolarCanvas";
import SolarScene3D from "./components/SolarScene3D";
import ControlBar from "./components/ControlBar";
import PlanetInspect from "./components/PlanetInspect";
import DossierSection from "./components/DossierSection";
import { MobileChips, PlanetRail } from "./components/PlanetRail";
import { BODIES, PLANETS, SUN, fmtElapsed } from "./data/planets";
import { BG_THEMES, nextTheme } from "./data/themes";
import MessagesEditor, { DEFAULT_EARTH_MSG, DEFAULT_MARS_MSGS } from "./components/MessagesEditor";

import { DEFAULT_ACTIVITIES, type ActivityKey } from "./lib/activitySettings";

const ORDER = [SUN.id, ...PLANETS.map((p) => p.id)];

export default function App() {
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(15); // симуляционных суток за 1 секунду
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [showOrbits, setShowOrbits] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [resetToken, setResetToken] = useState(0);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [view3d, setView3d] = useState(false);
  const [bgTheme, setBgTheme] = useState("deep");
  const [showUfo, setShowUfo] = useState(true);
  const [showAstro, setShowAstro] = useState(true);
  const [activities, setActivities] = useState(DEFAULT_ACTIVITIES);
  const toggleActivity = (key: ActivityKey) => setActivities(v => ({ ...v, [key]: !v[key] }));
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [earthMsg, setEarthMsg] = useState(() => {
    try {
      return localStorage.getItem("solarsys.earthMsg") ?? DEFAULT_EARTH_MSG;
    } catch {
      return DEFAULT_EARTH_MSG;
    }
  });
  const [marsMsgs, setMarsMsgs] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("solarsys.marsMsgs");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) return arr;
      }
    } catch {
      /* ignore */
    }
    return DEFAULT_MARS_MSGS;
  });
  const bgLabel = BG_THEMES.find((t) => t.id === bgTheme)?.label ?? "ГЛУБОКИЙ КОСМОС";
  const [isFs, setIsFs] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  /* сохраняем сообщения между сессиями */
  useEffect(() => {
    try {
      localStorage.setItem("solarsys.earthMsg", earthMsg);
      localStorage.setItem("solarsys.marsMsgs", JSON.stringify(marsMsgs));
    } catch {
      /* приватный режим — игнорируем */
    }
  }, [earthMsg, marsMsgs]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void mapRef.current?.requestFullscreen();
    }
  }, []);
  const inspectRef = useRef(false);
  inspectRef.current = inspectOpen;

  const selectNext = useCallback(() => {
    setSelectedId((cur) => {
      const i = cur ? ORDER.indexOf(cur) : -1;
      return ORDER[(i + 1) % ORDER.length];
    });
  }, []);

  const selectPrev = useCallback(() => {
    setSelectedId((cur) => {
      const i = cur ? ORDER.indexOf(cur) : 0;
      return ORDER[(i - 1 + ORDER.length) % ORDER.length];
    });
  }, []);

  /** выбор объекта с открытием режима исследования */
  const inspect = useCallback((id: string) => {
    setSelectedId(id);
    setInspectOpen(true);
  }, []);

  /** клик по орбите: зафиксировать (или снять) оранжевое выделение на карте */
  const pinOrbit = useCallback((id: string) => {
    setSelectedId((cur) => (cur === id ? null : id));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // в режиме исследования клавиши обрабатывает PlanetInspect
      if (inspectRef.current) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((v) => !v);
      } else if (e.code === "Escape") {
        setSelectedId(null);
      } else if (e.code === "ArrowRight") {
        setSpeed((s) => Math.min(365, s + Math.max(1, Math.round(s * 0.2))));
      } else if (e.code === "ArrowLeft") {
        setSpeed((s) => Math.max(1, s - Math.max(1, Math.round(s * 0.2))));
      } else if (e.code === "Digit0" || e.code === "Numpad0") {
        inspect(SUN.id);
      } else if (/^Digit[1-8]$/.test(e.code) || /^Numpad[1-8]$/.test(e.code)) {
        const n = Number(e.code.replace(/\D/g, "")) - 1;
        if (n >= 0 && n < PLANETS.length) inspect(PLANETS[n].id);
      } else if (e.code === "KeyV") {
        setView3d((v) => !v);
      } else if (e.code === "KeyB") {
        setBgTheme((t) => nextTheme(t));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inspect]);

  const jumpToMap = useCallback(
    (id: string) => {
      inspect(id);
      mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [inspect]
  );

  const selectedBody = selectedId ? (BODIES[selectedId] ?? null) : null;

  return (
    <div className="min-h-screen bg-space-950 text-ink">
      {/* ================= ВЕРХНИЙ HUD ================= */}
      <div className="flex h-svh flex-col">
        <header className="relative z-40 flex h-14 shrink-0 items-center justify-between border-b border-line bg-space-950/85 px-4 backdrop-blur-sm md:px-6">
          <div className="flex items-center gap-3">
            <span className="spin-slow grid h-9 w-9 place-items-center rounded-md border border-line bg-space-900">
              <svg width="22" height="22" viewBox="0 0 26 26" aria-hidden>
                <circle cx="13" cy="13" r="4" fill="#ffb547" />
                <ellipse cx="13" cy="13" rx="11" ry="4.6" fill="none" stroke="#43d9c9" strokeWidth="1.2" transform="rotate(-24 13 13)" />
                <circle cx="22.4" cy="8.4" r="1.7" fill="#43d9c9" />
              </svg>
            </span>
            <div>
              <h1 className="font-display text-[13px] leading-none font-bold tracking-[0.08em] text-ink">
                СОЛНЕЧНАЯ СИСТЕМА
              </h1>
              <p className="mt-1 hidden font-mono text-[9px] tracking-[0.22em] text-faint sm:block">
                ОРБИТАЛЬНАЯ МОДЕЛЬ · 8 ПЛАНЕТ
              </p>
            </div>
          </div>

          {/* статус симуляции */}
          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 md:flex">
            <span className={`h-2 w-2 rounded-full ${playing ? "blink-dot bg-teal" : "blink-dot-amber bg-amber"}`} />
            <span className={`font-mono text-[10px] tracking-[0.26em] ${playing ? "text-teal" : "text-amber"}`}>
              {playing ? "СИМУЛЯЦИЯ ИДЁТ" : "ПАУЗА"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-md border border-line bg-space-900 px-2.5 py-1.5 font-mono text-[11px] text-dim">
              T+&nbsp;<span className="font-medium text-ink">{fmtElapsed(elapsed)}</span>
            </div>
            <div className="hidden rounded-md border border-line bg-space-900 px-2.5 py-1.5 font-mono text-[11px] text-dim sm:block">
              <span className="text-amber">×{speed}</span>&nbsp;·&nbsp;{speed}&nbsp;сут/с
            </div>
          </div>
        </header>

        {/* ================= КАРТА ================= */}
        <div ref={mapRef} className="relative min-h-0 flex-1 overflow-hidden">
          {view3d ? (
            <SolarScene3D
              playing={playing}
              speed={speed}
              showOrbits={showOrbits}
              showLabels={showLabels}
              selectedId={selectedId}
              hoverId={hoverId}
              resetToken={resetToken}
              initialDays={elapsed}
              bgTheme={bgTheme}
              showUfo={showUfo}
              activities={activities}
              showAstro={showAstro}
              earthMsg={earthMsg}
              marsMsgs={marsMsgs}
              onSelect={(id) => id && inspect(id)}
              onOrbitSelect={pinOrbit}
              onHover={setHoverId}
              onTick={setElapsed}
            />
          ) : (
            <SolarCanvas
              playing={playing}
              speed={speed}
              showOrbits={showOrbits}
              showLabels={showLabels}
              selectedId={selectedId}
              hoverId={hoverId}
              resetToken={resetToken}
              initialDays={elapsed}
              bgTheme={bgTheme}
              showUfo={showUfo}
              activities={activities}
              showAstro={showAstro}
              earthMsg={earthMsg}
              marsMsgs={marsMsgs}
              onSelect={(id) => id && inspect(id)}
              onOrbitSelect={pinOrbit}
              onHover={setHoverId}
              onTick={setElapsed}
            />
          )}

          <DraggableStation settings={activities} />

          <MobileChips selectedId={selectedId} hoverId={hoverId} onSelect={inspect} />
          <PlanetRail selectedId={selectedId} hoverId={hoverId} onSelect={inspect} onHover={setHoverId} />

          {/* пульт управления */}
          <div data-map-controls className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center">
            <ControlBar
              playing={playing}
              onTogglePlay={() => setPlaying((v) => !v)}
              speed={speed}
              onSpeed={setSpeed}
              showOrbits={showOrbits}
              showLabels={showLabels}
              onToggleOrbits={() => setShowOrbits((v) => !v)}
              onToggleLabels={() => setShowLabels((v) => !v)}
              onReset={() => setResetToken((v) => v + 1)}
              view3d={view3d}
              onToggleView={() => setView3d((v) => !v)}
              isFullscreen={isFs}
              onToggleFullscreen={toggleFullscreen}
              bgLabel={bgLabel}
              onCycleBg={() => setBgTheme((t) => nextTheme(t))}
              showUfo={showUfo}
              onToggleUfo={() => setShowUfo((v) => !v)}
              activities={activities}
              showAstro={showAstro}
              onToggleAstro={() => setShowAstro((v) => !v)}
              onToggleActivity={toggleActivity}
              onOpenMessages={() => setMessagesOpen(true)}
            />
          </div>

          {/* служебные подписи */}
          <div className="pointer-events-none absolute right-3 bottom-20 z-10 hidden text-right font-mono text-[9.5px] leading-relaxed tracking-[0.14em] text-faint lg:block xl:bottom-4">
            КЛИК ПО ОБЪЕКТУ — ИССЛЕДОВАНИЕ
            <br />
            КЛИК ПО ОРБИТЕ — ЗАКРЕПИТЬ ВЫДЕЛЕНИЕ
            <br />
            КОЛЕСО — МАСШТАБ · ПЕРЕТАСКИВАНИЕ — СДВИГ
            <br />
            SPACE — ПАУЗА · V — 2D/3D · B — ФОН · 1–8 — ПЛАНЕТЫ
          </div>
          <div className="pointer-events-none absolute bottom-4 left-4 z-10 hidden font-mono text-[9.5px] leading-relaxed tracking-[0.14em] text-faint xl:block">
            РАССТОЯНИЯ И РАЗМЕРЫ
            <br />
            СЖАТЫ ДЛЯ НАГЛЯДНОСТИ
          </div>
        </div>
      </div>

      {/* ================= ДОСЬЕ ================= */}
      <DossierSection onSelect={jumpToMap} />

      {/* ================= ПОДВАЛ ================= */}
      <footer className="border-t border-line bg-space-950 px-4 py-6 md:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 font-mono text-[10px] tracking-[0.14em] text-faint">
          <span>ДАННЫЕ: NASA PLANETARY FACT SHEET · ЗНАЧЕНИЯ ОКРУГЛЕНЫ</span>
          <span className="hidden lg:inline">
            SPACE — ПАУЗА&ensp;·&ensp;1–8 — ПЛАНЕТЫ&ensp;·&ensp;0 — СОЛНЦЕ&ensp;·&ensp;В РЕЖИМЕ: ←/→ — ЛИСТАТЬ, SPACE — ВРАЩЕНИЕ
          </span>
          <span>© 2026 · УЧЕБНАЯ МОДЕЛЬ</span>
        </div>
      </footer>

      {/* ================= РЕЖИМ ИССЛЕДОВАНИЯ ================= */}
      {inspectOpen && selectedBody && (
        <PlanetInspect
          body={selectedBody}
          onClose={() => setInspectOpen(false)}
          onPrev={selectPrev}
          onNext={selectNext}
        />
      )}

      {/* ================= РЕДАКТОР СООБЩЕНИЙ ================= */}
      {messagesOpen && (
        <MessagesEditor
          earthMsg={earthMsg}
          marsMsgs={marsMsgs}
          onEarthMsg={setEarthMsg}
          onMarsMsgs={setMarsMsgs}
          onClose={() => setMessagesOpen(false)}
          onReset={() => {
            setEarthMsg(DEFAULT_EARTH_MSG);
            setMarsMsgs(DEFAULT_MARS_MSGS);
          }}
        />
      )}
    </div>
  );
}
