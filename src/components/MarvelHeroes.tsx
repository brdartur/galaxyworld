import { useEffect, useRef, type MutableRefObject } from 'react';
import type { ActivitySettings } from '../lib/activitySettings';
import { HERO_DETAILS, HERO_IDS, heroFrame, type HeroAnchors } from '../lib/marvelHeroes';
import { drawMarvelHero } from '../lib/marvelDrawing';
import type { ScreenAnchor } from '../lib/radioSignal';

interface MarvelHeroesProps {
  settings: ActivitySettings;
  anchors: MutableRefObject<HeroAnchors>;
  station: MutableRefObject<ScreenAnchor | null>;
  showLabels: boolean;
}

/** One passive overlay follows projected bodies in either map mode. */
export default function MarvelHeroes({ settings, anchors, station, showLabels }: MarvelHeroesProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const flags = useRef({ settings, showLabels });
  flags.current = { settings, showLabels };
  const time = useRef(0);
  const synchronize = useRef<(() => void) | null>(null);
  const enabledHeroes = HERO_IDS.filter(id => settings[id]);

  useEffect(() => {
    const el = canvas.current;
    const parent = el?.parentElement;
    const ctx = el?.getContext('2d');
    if (!el || !parent || !ctx) return;

    let width = 0, height = 0, bottom = 0, dpr = 1;
    let raf = 0, lastTime = 0, lastDraw = 0, disposed = false;
    let pointer: { x: number; y: number } | null = null;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const controls = parent.querySelector<HTMLElement>('[data-map-controls]');

    const clear = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
    };
    const resize = () => {
      const rect = parent.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      bottom = (controls?.getBoundingClientRect().height ?? 0) + 28;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const pixelWidth = Math.max(1, Math.round(width * dpr));
      const pixelHeight = Math.max(1, Math.round(height * dpr));
      if (el.width !== pixelWidth || el.height !== pixelHeight) {
        el.width = pixelWidth;
        el.height = pixelHeight;
      }
    };
    const active = () => HERO_IDS.some(id => flags.current.settings[id]);
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      lastTime = 0;
      lastDraw = 0;
    };
    const frame = (now: number) => {
      raf = 0;
      if (disposed || document.hidden || !active()) return;
      const delta = lastTime ? Math.min(.1, (now - lastTime) / 1000) : 0;
      lastTime = now;
      // Reduced motion keeps each mission posed, while camera and drag anchors still update.
      if (!reducedMotion.matches) time.current += delta;
      if (!lastDraw || now - lastDraw >= 1000 / 30) {
        lastDraw = now;
        clear();
        if (width > 0 && height > 0) {
          const current = flags.current;
          const scene = {
            width, height, bottom,
            anchors: anchors.current,
            station: current.settings.station ? station.current : null,
          };
          const effects = current.settings.heroEffects && !reducedMotion.matches;
          for (const id of HERO_IDS) {
            if (!current.settings[id]) continue;
            const pose = heroFrame(id, time.current, scene);
            const hovered = pointer !== null &&
              Math.abs(pointer.x - pose.x) <= 42 * pose.scale + 8 &&
              Math.abs(pointer.y - pose.y) <= 53 * pose.scale + 8;
            drawMarvelHero(ctx, pose, { effects, showLabel: current.showLabels || hovered });
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    const sync = () => {
      if (disposed) return;
      if (document.hidden || !active()) {
        stop();
        if (document.hidden) pointer = null;
        if (!active()) clear();
      } else if (!raf) {
        lastTime = 0;
        raf = requestAnimationFrame(frame);
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      const rect = parent.getBoundingClientRect();
      pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const onPointerLeave = () => { pointer = null; };

    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    if (controls) observer.observe(controls);
    // Capture observes station dragging too; these listeners never cancel or capture gestures.
    parent.addEventListener('pointermove', onPointerMove, { passive: true, capture: true });
    parent.addEventListener('pointerleave', onPointerLeave, { passive: true });
    document.addEventListener('visibilitychange', sync);
    reducedMotion.addEventListener('change', sync);
    synchronize.current = sync;
    resize();
    sync();

    return () => {
      disposed = true;
      stop();
      synchronize.current = null;
      observer.disconnect();
      parent.removeEventListener('pointermove', onPointerMove, true);
      parent.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', sync);
      reducedMotion.removeEventListener('change', sync);
    };
  }, [anchors, station]);

  useEffect(() => { synchronize.current?.(); }, [settings, showLabels]);

  return <>
    <canvas
      ref={canvas}
      aria-hidden
      data-marvel-heroes
      data-enabled-heroes={enabledHeroes.join(',')}
      className="pointer-events-none absolute inset-0 z-[11] h-full w-full"
    />
    {enabledHeroes.length > 0 && <ul className="pointer-events-none sr-only" aria-label="Космические герои и их задания">
      {enabledHeroes.map(id => <li key={id}>{HERO_DETAILS[id].name}: {HERO_DETAILS[id].mission}</li>)}
    </ul>}
  </>;
}
