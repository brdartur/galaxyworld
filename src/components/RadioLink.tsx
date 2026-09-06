import { useEffect, useRef, type MutableRefObject } from 'react';
import { drawRadioSignal, type ScreenAnchor } from '../lib/radioSignal';

export default function RadioLink({ enabled, station, earth }: {
  enabled: boolean; station: MutableRefObject<ScreenAnchor | null>; earth: MutableRefObject<ScreenAnchor | null>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!enabled) return;
    const el = canvas.current!, parent = el.parentElement!, c = el.getContext('2d')!;
    let width = 0, height = 0, dpr = 1, raf = 0, last = 0;
    const resize = () => {
      const rect = parent.getBoundingClientRect(); width = rect.width; height = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      el.width = Math.round(width * dpr); el.height = Math.round(height * dpr);
    };
    const observer = new ResizeObserver(resize); observer.observe(parent); resize();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame); if (now - last < 1000 / 30) return; last = now;
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, width, height);
      drawRadioSignal(c, station.current, earth.current, now / 1000);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); };
  }, [enabled, station, earth]);
  return enabled ? <canvas ref={canvas} aria-hidden className="pointer-events-none absolute inset-0 z-[9] h-full w-full" /> : null;
}
