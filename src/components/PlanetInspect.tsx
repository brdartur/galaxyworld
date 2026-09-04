import { useEffect, useMemo, useRef, useState } from "react";
import type { BodyData } from "../data/planets";
import { fmtDecimal, fmtInt, fmtPeriod, getCompareBars } from "../data/planets";
import { getTexture } from "../lib/textures";

interface Props {
  body: BodyData;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

interface Star {
  top: number;
  left: number;
  size: number;
  o: number;
  tw: number;
}

const TAU = Math.PI * 2;
const S = 520; // разрешение сферы
const OUT = 1040; // разрешение канваса (ретина)

/* ================= ПОПИКСЕЛЬНАЯ СФЕРА ================= */

interface Tables {
  pos: Int32Array; // индекс пикселя в канвасе S×S
  col: Int32Array; // колонка текстуры
  rowOff: Int32Array; // row * texW
  shade: Float32Array;
  n: number;
}

function buildTables(texW: number, texH: number, isSun: boolean, specK: number): Tables {
  // свет слева-сверху, чуть на зрителя
  const lx = -0.45;
  const ly = -0.5;
  const lz = 0.74;
  const ll = Math.hypot(lx, ly, lz);
  const Lx = lx / ll;
  const Ly = ly / ll;
  const Lz = lz / ll;

  const pos = new Int32Array(S * S);
  const col = new Int32Array(S * S);
  const rowOff = new Int32Array(S * S);
  const shade = new Float32Array(S * S);
  let n = 0;
  for (let y = 0; y < S; y++) {
    const dy = ((y + 0.5) / S) * 2 - 1;
    for (let x = 0; x < S; x++) {
      const dx = ((x + 0.5) / S) * 2 - 1;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      const ny = -dy; // вверх
      const lon = Math.atan2(dx, nz); // −π..π
      const u = lon / TAU + 0.5;
      const lat = Math.asin(Math.max(-1, Math.min(1, ny)));
      const v = 0.5 - lat / Math.PI;
      pos[n] = y * S + x;
      col[n] = Math.min(texW - 1, Math.floor(u * texW));
      rowOff[n] = Math.min(texH - 1, Math.floor(v * texH)) * texW;
      if (isSun) {
        // потемнение к лимбу
        shade[n] = 0.74 + 0.3 * Math.pow(nz, 0.8);
      } else {
        const diff = Math.max(0, dx * Lx + ny * Ly + nz * Lz);
        shade[n] = 0.07 + 1.0 * Math.pow(diff, 0.85) + Math.pow(diff, 30) * specK;
      }
      n++;
    }
  }
  return { pos: pos.slice(0, n), col: col.slice(0, n), rowOff: rowOff.slice(0, n), shade: shade.slice(0, n), n };
}

function SphereView({ body, spinning }: { body: BodyData; spinning: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spinRef = useRef(spinning);
  spinRef.current = spinning;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let cancelled = false;
    // генерацию фактуры откладываем на кадр позже, чтобы entrance-анимация не дёргалась
    requestAnimationFrame(() => {
      if (cancelled) return;
      const tex = getTexture(body.id);
      const isSun = body.id === "sun";
      const specK = isSun ? 0 : body.type.includes("гигант") ? 0.14 : 0.5;
      const tab = buildTables(tex.w, tex.h, isSun, specK);

      const buf = document.createElement("canvas");
      buf.width = S;
      buf.height = S;
      const bctx = buf.getContext("2d");
      if (!bctx) return;
      const img = bctx.createImageData(S, S);

      let rot = 0;
      let lastT = performance.now();
      let needDraw = true;
      const speed = (TAU / Math.max(4, body.spinDur)) * (body.spinReverse ? -1 : 1);

      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.1, (now - lastT) / 1000);
        lastT = now;
        if (spinRef.current) {
          rot += speed * dt;
          needDraw = true;
        }
        if (!needDraw) return;
        needDraw = false;

        const shift = (((Math.floor((rot / TAU) * tex.w) % tex.w) + tex.w) % tex.w) | 0;
        const out = img.data;
        const src = tex.data;
        const { pos, col, rowOff, shade, n } = tab;
        const w = tex.w;
        for (let i = 0; i < n; i++) {
          const j = (rowOff[i] + ((col[i] + shift) % w)) * 4;
          const o = pos[i] * 4;
          const sh = shade[i];
          out[o] = src[j] * sh;
          out[o + 1] = src[j + 1] * sh;
          out[o + 2] = src[j + 2] * sh;
          out[o + 3] = 255;
        }
        bctx.putImageData(img, 0, 0);
        ctx.clearRect(0, 0, OUT, OUT);
        ctx.drawImage(buf, 0, 0, OUT, OUT);
      };
      raf = requestAnimationFrame(loop);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [body.id, body.spinDur, body.spinReverse, body.type]);

  return <canvas ref={canvasRef} width={OUT} height={OUT} className="absolute inset-0 h-full w-full" />;
}

/* ================= КОМПОНЕНТ ================= */

/** Полноэкранный режим «исследования»: всплывающая вращающаяся сфера + данные среды */
export default function PlanetInspect({ body, onClose, onPrev, onNext }: Props) {
  const [spinning, setSpinning] = useState(true);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const isSun = body.id === "sun";
  const bars = useMemo(() => getCompareBars(body), [body]);

  const stars = useMemo<Star[]>(
    () =>
      Array.from({ length: 110 }, () => ({
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: Math.random() < 0.85 ? 1 : 2,
        o: 0.25 + Math.random() * 0.65,
        tw: 2.2 + Math.random() * 4,
      })),
    []
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") onClose();
      else if (e.code === "ArrowRight") onNext();
      else if (e.code === "ArrowLeft") onPrev();
      else if (e.code === "Space") {
        e.preventDefault();
        setSpinning((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNext, onPrev]);

  const onPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTilt({
      x: ((e.clientX - r.left) / r.width - 0.5) * 2,
      y: ((e.clientY - r.top) / r.height - 0.5) * 2,
    });
  };

  return (
    <div className="backdrop-in fixed inset-0 z-50 bg-space-950" onPointerMove={onPointer}>
      {/* фоновая среда */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(1100px 700px at 22% 42%, ${body.color}14, transparent 62%), radial-gradient(900px 600px at 82% 18%, rgba(67,217,201,0.05), transparent 60%)`,
          }}
        />
        {stars.map((s, i) => (
          <span
            key={i}
            className="inspect-star absolute rounded-full bg-white"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: s.size,
              height: s.size,
              opacity: s.o,
              ["--o" as string]: s.o,
              ["--tw" as string]: `${s.tw}s`,
            }}
          />
        ))}
      </div>

      {/* шапка режима */}
      <div className="absolute top-0 right-0 left-0 z-20 flex items-center justify-between px-4 py-3 md:px-6">
        <button
          onClick={onClose}
          className="group flex items-center gap-2 rounded-md border border-line bg-space-900/70 px-3 py-2 font-mono text-[10.5px] tracking-[0.18em] text-dim backdrop-blur-sm transition-all hover:border-amber/60 hover:text-amber"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:-translate-x-0.5">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          К КАРТЕ
        </button>
        <span className="hidden font-mono text-[10px] tracking-[0.26em] text-faint sm:block">
          РЕЖИМ ИССЛЕДОВАНИЯ · ПОВЕРХНОСТЬ
        </span>
        <span className="rounded-md border border-line bg-space-900/70 px-3 py-2 font-mono text-[10.5px] tracking-[0.18em] text-dim backdrop-blur-sm">
          ESC — выход · ←→ — листать
        </span>
      </div>

      {/* стрелки листания */}
      <button
        onClick={onPrev}
        aria-label="Предыдущий объект"
        className="group absolute top-1/2 left-3 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-line bg-space-900/70 text-dim backdrop-blur-sm transition-all hover:scale-110 hover:border-teal/60 hover:text-teal active:scale-95"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <button
        onClick={onNext}
        aria-label="Следующий объект"
        className="group absolute top-1/2 right-3 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-line bg-space-900/70 text-dim backdrop-blur-sm transition-all hover:scale-110 hover:border-teal/60 hover:text-teal active:scale-95"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>

      {/* контент */}
      <div key={body.id} className="scroll-y relative z-10 grid h-full overflow-y-auto lg:grid-cols-[minmax(0,1fr)_460px] lg:overflow-visible">
        {/* ================= СФЕРА ================= */}
        <section className="relative flex items-center justify-center lg:h-svh">
          <div
            className="floaty inspect-in relative"
            style={{
              width: "min(60vmin, 560px)",
              aspectRatio: "1 / 1",
              transform: `perspective(1300px) rotateX(${tilt.y * -5}deg) rotateY(${tilt.x * 5}deg)`,
              transition: "transform 0.25s ease-out",
            }}
          >
            {/* внешнее свечение */}
            <div
              className={`absolute -inset-8 rounded-full ${isSun ? "corona-breathe" : ""}`}
              style={{
                background: `radial-gradient(circle, ${body.color}${isSun ? "59" : "30"} 38%, transparent 68%)`,
                filter: "blur(6px)",
              }}
            />
            {isSun && (
              <div
                className="corona-breathe absolute -inset-16 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(255,181,71,0.22) 30%, transparent 66%)", filter: "blur(10px)", animationDelay: "0.8s" }}
              />
            )}

            {/* сфера с процедурной фактурой */}
            <div
              className="absolute inset-0 overflow-hidden rounded-full"
              style={{
                boxShadow: `inset -18px -22px 60px rgba(0,0,0,0.55), 0 30px 80px rgba(0,0,0,0.6)`,
                background: `radial-gradient(circle at 34% 30%, ${body.colorLight}, ${body.color} 52%, ${body.colorDeep})`,
              }}
            >
              <SphereView key={body.id} body={body} spinning={spinning} />
              {/* тонкий атмосферный ободок */}
              {!isSun && (
                <div className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: `inset 0 0 26px ${body.color}4d` }} />
              )}
            </div>
          </div>

          {/* пульт вращения */}
          <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-space-900/80 py-1.5 pr-4 pl-1.5 backdrop-blur-sm">
            <button
              onClick={() => setSpinning((v) => !v)}
              aria-label={spinning ? "Остановить вращение" : "Запустить вращение"}
              className="grid h-8 w-8 place-items-center rounded-full bg-space-800 text-amber transition-all hover:scale-110 hover:bg-space-850 active:scale-90"
            >
              {spinning ? (
                <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="2.5" y="1.5" width="4" height="13" rx="1" />
                  <rect x="9.5" y="1.5" width="4" height="13" rx="1" />
                </svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 2.1a1 1 0 0 1 1.52-.86l9.1 5.9a1 1 0 0 1 0 1.7l-9.1 5.9A1 1 0 0 1 4 13.9V2.1Z" />
                </svg>
              )}
            </button>
            <span className="font-mono text-[10.5px] tracking-[0.14em] whitespace-nowrap text-dim">
              ВРАЩЕНИЕ · {body.rotationText.toUpperCase()}
              {body.spinReverse ? " · РЕВЕРС" : ""}
            </span>
          </div>
        </section>

        {/* ================= ДАННЫЕ ================= */}
        <section className="scroll-y border-line bg-[rgba(8,12,24,0.88)] px-6 py-8 backdrop-blur-md lg:h-svh lg:overflow-y-auto lg:border-l md:px-8">
          <div className="panel-in flex items-center justify-between font-mono text-[10px] tracking-[0.24em] text-faint" style={{ animationDelay: "80ms" }}>
            <span>ОБЪЕКТ {String(body.index).padStart(2, "0")} / 08</span>
            <span style={{ color: body.color }}>{body.type.toUpperCase()}</span>
          </div>

          <h2 className="panel-in mt-3 font-display text-4xl leading-tight font-bold text-ink md:text-[44px]" style={{ animationDelay: "130ms" }}>
            {body.name}
          </h2>

          {/* температура — главный показатель */}
          <div className="panel-in mt-6 rounded-lg border border-line bg-space-900/70 p-4" style={{ animationDelay: "190ms", borderColor: `${body.color}40` }}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[12px] tracking-[0.14em] text-dim uppercase">Температура</span>
              {body.tempNote && <span className="text-right font-mono text-[10px] text-faint">{body.tempNote}</span>}
            </div>
            <div className="mt-1.5 font-mono text-[30px] leading-none font-semibold" style={{ color: body.colorLight }}>
              {body.temp}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2">
              <div className="flex items-baseline justify-between gap-3 border-t border-line/70 pt-2">
                <span className="text-[12px] text-dim">Давление</span>
                <span className="text-right font-mono text-[11.5px] text-ink/90">{body.pressure}</span>
              </div>
              {body.wind && (
                <div className="flex items-baseline justify-between gap-3 border-t border-line/70 pt-2">
                  <span className="text-[12px] text-dim">Ветры</span>
                  <span className="text-right font-mono text-[11.5px] text-ink/90">{body.wind}</span>
                </div>
              )}
            </div>
          </div>

          {/* характеристики */}
          <div className="panel-in mt-6" style={{ animationDelay: "250ms" }}>
            <h3 className="font-mono text-[10px] tracking-[0.24em] text-faint">ХАРАКТЕРИСТИКИ</h3>
            <div className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line/40">
              {(
                [
                  { l: "Диаметр", v: `${fmtInt(body.diameterKm)} км` },
                  ...(isSun
                    ? []
                    : [
                        { l: "До Солнца", v: `${fmtDecimal(body.distMkm, 1)} млн км · ${fmtDecimal(body.distAU, 2)} а.е.` },
                        { l: "Год", v: fmtPeriod(body.periodDays) },
                        { l: "Орбит. скорость", v: `${fmtDecimal(body.velocityKmS, 1)} км/с` },
                        { l: "Спутники", v: `${body.moons}` },
                      ]),
                  { l: "Сутки", v: body.rotationText },
                ] as { l: string; v: string }[]
              ).map((r) => (
                <div key={r.l} className="bg-space-900/85 px-3.5 py-3">
                  <div className="text-[10.5px] tracking-[0.08em] text-dim uppercase">{r.l}</div>
                  <div className="mt-1 font-mono text-[12.5px] font-medium text-ink">{r.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* состав атмосферы */}
          <div className="panel-in mt-6" style={{ animationDelay: "320ms" }}>
            <h3 className="font-mono text-[10px] tracking-[0.24em] text-faint">{isSun ? "СОСТАВ" : "АТМОСФЕРА"}</h3>
            {body.atm.length > 0 ? (
              <div className="mt-3 space-y-2.5">
                {body.atm.map((g, i) => (
                  <div key={g.gas}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[12.5px] text-ink/90">{g.gas}</span>
                      <span className="font-mono text-[11.5px] text-dim">
                        {g.pct < 1 ? `< ${fmtDecimal(g.pct, 2)} %` : `${fmtDecimal(g.pct, 1)} %`}
                      </span>
                    </div>
                    <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-space-800">
                      <div
                        className="bar-grow h-full rounded-full"
                        style={{
                          width: `${Math.max(2.5, g.pct)}%`,
                          background: `linear-gradient(90deg, ${body.colorDeep}, ${body.color})`,
                          animationDelay: `${420 + i * 110}ms`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 rounded-md border border-dashed border-line px-3 py-2.5 font-mono text-[11px] leading-relaxed text-dim">
                {body.atmNote}
              </p>
            )}
          </div>

          {/* среда и поверхность */}
          <div className="panel-in mt-6" style={{ animationDelay: "390ms" }}>
            <h3 className="font-mono text-[10px] tracking-[0.24em] text-faint">СРЕДА</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink/85">{body.environment}</p>
          </div>
          <div className="panel-in mt-5" style={{ animationDelay: "450ms" }}>
            <h3 className="font-mono text-[10px] tracking-[0.24em] text-faint">ПОВЕРХНОСТЬ · ФАКТУРА</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink/85">{body.surface}</p>
          </div>

          {/* сравнение */}
          {bars.length > 0 && (
            <div className="panel-in mt-6" style={{ animationDelay: "510ms" }}>
              <h3 className="font-mono text-[10px] tracking-[0.24em] text-faint">МАСШТАБ</h3>
              <div className="mt-3 space-y-3">
                {bars.map((b, i) => (
                  <div key={b.label}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[12px] text-dim">
                        {b.label}
                        <span className="ml-1.5 font-mono text-[9px] text-faint">{b.ref}</span>
                      </span>
                      <span className="font-mono text-[12px] text-ink">{b.display}</span>
                    </div>
                    <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-space-800">
                      <div
                        className="bar-grow h-full rounded-full"
                        style={{
                          width: `${Math.min(100, b.pct)}%`,
                          background: `linear-gradient(90deg, ${body.colorDeep}, ${body.color})`,
                          animationDelay: `${560 + i * 130}ms`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* факт */}
          <div className="panel-in mt-6 border-l-2 py-0.5 pl-4" style={{ borderColor: body.color, animationDelay: "580ms" }}>
            <h3 className="font-mono text-[10px] tracking-[0.24em] text-faint">ЗНАЕТЕ ЛИ ВЫ?</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink/85">{body.fact}</p>
          </div>

          <div className="mt-8 flex gap-2.5 pb-4">
            <button
              onClick={onPrev}
              className="flex-1 rounded-md border border-line bg-space-850 px-3 py-2.5 text-[12.5px] font-medium text-dim transition-all hover:border-line hover:bg-space-800 hover:text-ink active:scale-95"
            >
              ← Предыдущий
            </button>
            <button
              onClick={onNext}
              className="flex-1 rounded-md border border-line bg-space-850 px-3 py-2.5 text-[12.5px] font-medium text-dim transition-all hover:border-amber/50 hover:bg-space-800 hover:text-ink active:scale-95"
            >
              Следующий →
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
