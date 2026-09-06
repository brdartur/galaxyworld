import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { drawStation } from "../lib/activityDrawing";
import type { ActivitySettings } from "../lib/activitySettings";

import type { ScreenAnchor } from '../lib/radioSignal';

const KEY = "solarsys.stationPosition.v1";
const clamp = (v: number) => Math.max(0, Math.min(1, v));
function initialPosition() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return { x: clamp(p.x), y: clamp(p.y) };
  } catch { /* Storage may be unavailable in private browsing. */ }
  return { x: .92, y: .32 };
}

/** Screen-space station stays draggable in either map mode, including touch and keyboard. */
export default function DraggableStation({ settings, antenna }: { settings: ActivitySettings; antenna: MutableRefObject<ScreenAnchor | null> }) {
  const [position, setPosition] = useState(initialPosition);
  const [dragging, setDragging] = useState(false);
  const [bounds, setBounds] = useState({ width: 1, height: 1, scale: 1 });
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const flags = useRef(settings); flags.current = settings;
  const drag = useRef<{ id: number; x: number; y: number; px: number; py: number } | null>(null);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(position)); } catch { /* Optional persistence. */ }
  }, [position]);
  useEffect(() => {
    const parent = host.current!.parentElement!;
    const controls = parent.querySelector<HTMLElement>("[data-map-controls]");
    const resize = () => {
      const { width, height } = parent.getBoundingClientRect();
      const reserve = (controls?.getBoundingClientRect().height ?? 120) + 28;
      setBounds({ width, height: Math.max(180, height - reserve), scale: Math.max(.5, Math.min(1.2, width / 1350, (height - reserve) / 300)) });
    };
    const observer = new ResizeObserver(resize); observer.observe(parent); resize();
    if (controls) observer.observe(controls);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const c = canvas.current!.getContext("2d")!;
    let raf = 0, last = performance.now(), time = 0, accumulated = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(.1, (now - last) / 1000); last = now; time += dt; accumulated += dt;
      if (!flags.current.station || accumulated < 1 / 30) return;
      accumulated = 0;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 760, 560);
      c.setTransform(2, 0, 0, 2, 380, 310); drawStation(c, time, flags.current);
    };
    raf = requestAnimationFrame(frame); return () => cancelAnimationFrame(raf);
  }, []);
  const width = 380 * bounds.scale * .7, height = 280 * bounds.scale * .7;
  const rangeX = Math.max(0, bounds.width - width), rangeY = Math.max(0, bounds.height - height);
  useEffect(() => {
    // Antenna tip is at (-51,-51) relative to the drawing origin (190,155).
    antenna.current = settings.station ? { x: position.x * rangeX + width * 139 / 380,
      y: position.y * rangeY + height * 104 / 280, radius: 0 } : null;
    return () => { antenna.current = null; };
  }, [antenna, settings.station, position, rangeX, rangeY, width, height]);
  const endDrag = (id: number) => {
    if (drag.current?.id !== id) return;
    drag.current = null; setDragging(false);
    if (host.current?.hasPointerCapture(id)) host.current.releasePointerCapture(id);
  };
  return <div ref={host} role="button" tabIndex={settings.station ? 0 : -1}
    aria-label="Переместить орбитальную станцию" aria-describedby="station-drag-help"
    aria-hidden={!settings.station}
    title="Перетащите станцию мышью или перемещайте стрелками клавиатуры"
    className="absolute z-10 rounded-xl outline-none focus-visible:ring-1 focus-visible:ring-teal/70"
    style={{ left: position.x * rangeX, top: position.y * rangeY, width, height,
      display: settings.station ? undefined : "none", cursor: dragging ? "grabbing" : "grab", touchAction: "none", userSelect: "none" }}
    onPointerDown={e => {
      if (e.button !== 0 || !e.isPrimary) return;
      e.preventDefault(); e.stopPropagation(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, px: position.x * rangeX, py: position.y * rangeY };
      setDragging(true);
    }}
    onPointerMove={e => {
      const d = drag.current; if (!d || d.id !== e.pointerId) return;
      setPosition({ x: rangeX ? clamp((d.px + e.clientX - d.x) / rangeX) : 0,
        y: rangeY ? clamp((d.py + e.clientY - d.y) / rangeY) : 0 });
    }}
    onPointerUp={e => endDrag(e.pointerId)} onPointerCancel={e => endDrag(e.pointerId)}
    onLostPointerCapture={() => { drag.current = null; setDragging(false); }}
    onKeyDown={e => {
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!direction) return; e.preventDefault(); e.stopPropagation();
      const step = e.shiftKey ? 30 : 10;
      setPosition(p => ({ x: clamp(p.x + direction[0] * step / Math.max(1, rangeX)), y: clamp(p.y + direction[1] * step / Math.max(1, rangeY)) }));
    }}>
    <canvas ref={canvas} width={760} height={560} className="pointer-events-none h-full w-full" />
    <span id="station-drag-help" className="sr-only">Перетащите мышью или используйте стрелки. Положение сохраняется.</span>
  </div>;
}
