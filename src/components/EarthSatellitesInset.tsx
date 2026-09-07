import { useEffect, useMemo, useRef, useState } from "react";
import {
  EARTH_SATELLITES,
  SATELLITE_COLORS,
  orbitSamples,
  satellitePosition,
  type EarthSatellite,
  type SatelliteClass,
} from "../lib/satelliteOrbits";

const CLASS_LABELS: Record<SatelliteClass, string> = {
  LEO: "низкая",
  MEO: "средняя",
  GEO: "гео",
  HEO: "высокая",
};

function drawGlobe(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, t: number) {
  const g = ctx.createRadialGradient(cx - r * .35, cy - r * .42, r * .08, cx, cy, r);
  g.addColorStop(0, "#9dd8ff");
  g.addColorStop(.32, "#2874c9");
  g.addColorStop(.72, "#163d7c");
  g.addColorStop(1, "#081733");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = .58;
  const drift = (t * 8) % (r * .9);
  for (let i = -2; i < 7; i++) {
    const x = cx - r * 1.2 + i * r * .45 + drift;
    ctx.fillStyle = i % 2 ? "#46a26d" : "#2f8c5e";
    ctx.beginPath();
    ctx.ellipse(x, cy - r * .24 + Math.sin(i) * r * .12, r * .24, r * .08, .35, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + r * .18, cy + r * .25 + Math.cos(i) * r * .1, r * .18, r * .07, -.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = .28;
  ctx.strokeStyle = "#d8f3ff";
  ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * Math.cos(i * .26), r * .24, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * .18, r, i * Math.PI / 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  const atmo = ctx.createRadialGradient(cx, cy, r * .92, cx, cy, r * 1.34);
  atmo.addColorStop(0, "rgba(96,165,250,.3)");
  atmo.addColorStop(1, "rgba(96,165,250,0)");
  ctx.fillStyle = atmo;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.34, 0, Math.PI * 2);
  ctx.fill();
}

function drawOrbitPath(ctx: CanvasRenderingContext2D, sat: EarthSatellite, elapsed: number, earthR: number, cx: number, cy: number, selected: boolean) {
  const color = SATELLITE_COLORS[sat.cls];
  const pts = orbitSamples(sat, elapsed, earthR, selected ? 180 : 84);
  ctx.save();
  ctx.strokeStyle = selected ? color : `${color}44`;
  ctx.lineWidth = selected ? 2.1 : .8;
  ctx.setLineDash(selected ? [] : [3, 5]);
  ctx.beginPath();
  pts.forEach((p, i) => {
    if (i === 0) ctx.moveTo(cx + p.x, cy + p.y);
    else ctx.lineTo(cx + p.x, cy + p.y);
  });
  ctx.closePath();
  ctx.stroke();
  if (selected) {
    ctx.strokeStyle = "rgba(255,255,255,.32)";
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  ctx.restore();
}

function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, elapsed: number, selected: EarthSatellite | null) {
  ctx.clearRect(0, 0, w, h);
  const cx = w * .5;
  const cy = h * .53;
  const earthR = Math.min(w, h) * .145;

  const bg = ctx.createRadialGradient(cx, cy, earthR, cx, cy, Math.max(w, h) * .62);
  bg.addColorStop(0, "rgba(30,64,175,.2)");
  bg.addColorStop(.48, "rgba(14,21,40,.65)");
  bg.addColorStop(1, "rgba(2,6,23,.12)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = .22;
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = .7;
  for (let x = 22; x < w; x += 34) {
    ctx.beginPath(); ctx.moveTo(x, 48); ctx.lineTo(x, h - 22); ctx.stroke();
  }
  for (let y = 52; y < h; y += 30) {
    ctx.beginPath(); ctx.moveTo(18, y); ctx.lineTo(w - 18, y); ctx.stroke();
  }
  ctx.restore();

  for (const sat of EARTH_SATELLITES) drawOrbitPath(ctx, sat, elapsed, earthR, cx, cy, selected?.id === sat.id);
  drawGlobe(ctx, cx, cy, earthR, elapsed);

  const plotted = EARTH_SATELLITES.map((sat) => ({ sat, p: satellitePosition(sat, elapsed, earthR) }))
    .sort((a, b) => a.p.depth - b.p.depth);
  for (const { sat, p } of plotted) {
    const selectedSat = selected?.id === sat.id;
    const x = cx + p.x;
    const y = cy + p.y;
    const color = SATELLITE_COLORS[sat.cls];
    ctx.save();
    ctx.globalAlpha = p.depth < 0 ? .58 : 1;
    if (selectedSat) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = color;
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, selectedSat ? 5.2 : 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = selectedSat ? "#fff7d6" : "rgba(255,255,255,.45)";
    ctx.lineWidth = selectedSat ? 1.4 : .6;
    ctx.stroke();
    if (selectedSat) {
      ctx.setLineDash([2, 5]);
      ctx.strokeStyle = `${color}bb`;
      ctx.beginPath();
      ctx.arc(x, y, 13 + Math.sin(elapsed * 4) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export default function EarthSatellitesInset({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedRef = useRef<EarthSatellite | null>(EARTH_SATELLITES[0]);
  const [selected, setSelected] = useState<EarthSatellite | null>(EARTH_SATELLITES[0]);
  const start = useMemo(() => performance.now(), []);

  useEffect(() => { selectedRef.current = selected; }, [selected]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    let stopped = false;
    const render = () => {
      if (stopped) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(280, Math.round(rect.width));
      const h = Math.max(260, Math.round(rect.height));
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawScene(ctx, w, h, (performance.now() - start) / 1000, selectedRef.current);
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => { stopped = true; cancelAnimationFrame(frame); };
  }, [start]);

  const pickSatellite = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    const cx = w * .5;
    const cy = h * .53;
    const earthR = Math.min(w, h) * .145;
    const elapsed = (performance.now() - start) / 1000;
    let best: { sat: EarthSatellite; d: number } | null = null;
    for (const sat of EARTH_SATELLITES) {
      const p = satellitePosition(sat, elapsed, earthR);
      const d = Math.hypot(x - (cx + p.x), y - (cy + p.y));
      if (d < 15 && (!best || d < best.d)) best = { sat, d };
    }
    if (best) setSelected(best.sat);
  };

  const counts = EARTH_SATELLITES.reduce<Record<SatelliteClass, number>>((acc, sat) => {
    acc[sat.cls]++;
    return acc;
  }, { LEO: 0, MEO: 0, GEO: 0, HEO: 0 });

  return (
    <aside
      aria-label="Увеличенный инсет Земли со спутниками"
      className="pointer-events-auto absolute right-3 top-16 z-30 w-[min(420px,calc(100vw-24px))] rounded-2xl border border-line bg-space-950/88 p-3 shadow-[0_18px_70px_rgba(0,0,0,.6)] backdrop-blur-xl md:right-5 md:top-20"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[13px] font-bold tracking-[0.1em] text-ink">СПУТНИКИ ЗЕМЛИ</h2>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-faint">увеличенный инсет · клик по точке выделяет орбиту</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md border border-line px-2 py-1 font-mono text-[12px] text-dim transition-colors hover:border-amber/60 hover:text-amber"
          aria-label="Закрыть инсет спутников Земли"
          title="Закрыть"
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1.5 pb-2">
        {(Object.keys(SATELLITE_COLORS) as SatelliteClass[]).map((cls) => (
          <button
            key={cls}
            onClick={() => {
              const next = EARTH_SATELLITES.find((sat) => sat.cls === cls);
              if (next) setSelected(next);
            }}
            className="rounded-lg border border-line bg-space-900/75 px-1.5 py-1 text-left font-mono text-[9px] uppercase tracking-[0.09em] text-faint transition-colors hover:border-teal/50 hover:text-ink"
          >
            <span className="mb-1 block h-1.5 w-1.5 rounded-full" style={{ background: SATELLITE_COLORS[cls], boxShadow: `0 0 10px ${SATELLITE_COLORS[cls]}` }} />
            <b className="block text-[10px]" style={{ color: SATELLITE_COLORS[cls] }}>{cls}</b>
            <span>{counts[cls]} · {CLASS_LABELS[cls]}</span>
          </button>
        ))}
      </div>

      <canvas
        ref={canvasRef}
        width={760}
        height={560}
        className="h-[310px] w-full cursor-crosshair rounded-xl border border-line bg-space-900/65"
        onPointerDown={(e) => pickSatellite(e.clientX, e.clientY)}
      />

      <div className="mt-2 rounded-xl border border-line bg-space-900/75 px-3 py-2">
        {selected ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10px] leading-relaxed text-dim">
            <div className="col-span-2 flex items-center justify-between gap-2">
              <span className="font-semibold tracking-[0.12em] text-ink">{selected.name}</span>
              <span className="rounded border border-line px-1.5 py-0.5 font-semibold" style={{ color: SATELLITE_COLORS[selected.cls] }}>{selected.cls}</span>
            </div>
            <span>Высота: <b className="text-ink">≈ {selected.altKm.toLocaleString("ru-RU")} км</b></span>
            <span>Период: <b className="text-ink">{selected.periodMin >= 120 ? `${(selected.periodMin / 60).toFixed(1)} ч` : `${selected.periodMin.toFixed(1)} мин`}</b></span>
            <span>Наклонение: <b className="text-ink">{selected.incDeg.toFixed(1)}°</b></span>
            <span>Эксцентриситет: <b className="text-ink">{selected.ecc.toFixed(4)}</b></span>
          </div>
        ) : (
          <p className="font-mono text-[10px] text-dim">Нажмите на спутник, чтобы подсветить его орбиту.</p>
        )}
      </div>
    </aside>
  );
}
