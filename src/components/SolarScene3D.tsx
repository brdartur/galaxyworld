import { orbitRadius3D } from "../lib/orbitLayout";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import { PLANETS, SUN, SPIN_DAYS, type BodyData } from "../data/planets";
import { getTexture } from "../lib/textures";
import CosmicEvents3D, { DeepSpace } from "./CosmicEvents3D";

import ActivityScene3D from "./ActivityScene3D";
import { SURFACE_DURATION, type ActivitySettings } from "../lib/activitySettings";

const TAU = Math.PI * 2;

const clamp3 = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface SceneProps {
  activities: ActivitySettings;
  playing: boolean;
  speed: number;
  showOrbits: boolean;
  showLabels: boolean;
  selectedId: string | null;
  hoverId: string | null;
  resetToken: number;
  initialDays: number;
  bgTheme: string;
  showUfo: boolean;
  showAstro: boolean;
  earthMsg: string;
  marsMsgs: string[];
  onSelect: (id: string | null) => void;
  onOrbitSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onTick: (days: number) => void;
}

/* ---------- текстуры из процедурных данных ---------- */
function bodyTexture(id: string): THREE.CanvasTexture {
  const t = getTexture(id);
  const c = document.createElement("canvas");
  c.width = t.w;
  c.height = t.h;
  const ctx = c.getContext("2d")!;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(t.data), t.w, t.h), 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Кольца Сатурна как настоящие: C, B, щель Кассини, A со щелью Энке, F.
    u∈[0,1] → радиус 1.24..2.55 радиусов планеты. */
function ringTexture(): THREE.CanvasTexture {
  const W2 = 1024;
  const c = document.createElement("canvas");
  c.width = W2;
  c.height = 1;
  const ctx = c.getContext("2d")!;
  const rnd = mulberry32(55);
  const sstep = (a: number, b: number, v: number) => {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const R0 = 1.24;
  const R1 = 2.55;
  for (let x = 0; x < W2; x++) {
    const r = R0 + (x / (W2 - 1)) * (R1 - R0);
    // базовые зоны
    let col: [number, number, number] = [226, 206, 158];
    let a = 0;
    if (r < 1.45) {
      // кольцо C — тусклое, полупрозрачное
      a = 0.22 * sstep(1.24, 1.3, r);
      col = [176, 158, 124];
    } else if (r < 1.95) {
      // кольцо B — самое яркое
      a = 0.88;
      col = [238, 220, 172];
      a *= 0.85 + 0.15 * Math.sin(r * 90);
    } else if (r < 2.03) {
      // щель Кассини
      a = 0.07;
      col = [90, 80, 66];
    } else if (r < 2.42) {
      // кольцо A
      a = 0.6;
      col = [222, 200, 152];
      a *= 0.85 + 0.15 * Math.sin(r * 70 + 2);
      if (r > 2.32 && r < 2.35) a = 0.08; // щель Энке
    } else if (r < 2.47) {
      a = 0.1;
      col = [140, 126, 100];
    } else {
      // тонкое кольцо F
      const f = 1 - Math.abs(r - 2.5) / 0.045;
      a = Math.max(0, f) * 0.4;
      col = [232, 214, 168];
    }
    // тонкая радиальная рябь + микрошум
    a *= 0.9 + 0.1 * Math.sin(r * 210) + (rnd() - 0.5) * 0.06;
    a = Math.min(1, Math.max(0, a));
    ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a.toFixed(3)})`;
    ctx.fillRect(x, 0, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function glowTexture(color: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function bandTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "rgba(160,190,255,0)");
  g.addColorStop(0.42, "rgba(190,210,255,0.5)");
  g.addColorStop(0.5, "rgba(235,242,255,0.7)");
  g.addColorStop(0.58, "rgba(190,210,255,0.5)");
  g.addColorStop(1, "rgba(160,190,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  return new THREE.CanvasTexture(c);
}

/* ---------- масштаб ---------- */
export const orbitR3 = orbitRadius3D;
const planetR3 = (km: number) => (0.24 + Math.sqrt(km / 142984) * 1.5) * 2 * .75;
const SUN_R = 2.6;

function OrbitRing({ r, tone }: { r: number; tone: "sel" | "hov" | "plain" }) {
  const pts = useMemo(() => {
    const arr: [number, number, number][] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * TAU;
      arr.push([Math.cos(a) * r, 0, Math.sin(a) * r]);
    }
    return arr;
  }, [r]);
  const color = tone === "sel" ? "#ffb547" : tone === "hov" ? "#43d9c9" : "#94a6cd";
  const opacity = tone === "sel" ? 0.8 : tone === "hov" ? 0.55 : 0.22;
  const width = tone === "sel" ? 2 : 1;
  return <Line points={pts} color={color} transparent opacity={opacity} lineWidth={width} />;
}

function SaturnRing({ pr, tex }: { pr: number; tex: THREE.CanvasTexture }) {
  const geo = useMemo(() => {
    const inner = pr * 1.24;
    const outer = pr * 2.55;
    const g = new THREE.RingGeometry(inner, outer, 192, 1);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const t = (Math.hypot(pos.getX(i), pos.getY(i)) - inner) / (outer - inner);
      uv.setXY(i, t, 0.5);
    }
    return g;
  }, [pr]);
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={geo}>
        <meshBasicMaterial map={tex} transparent side={THREE.DoubleSide} depthWrite={false} opacity={0.98} />
      </mesh>
      {/* мягкое нижнее притемнение — кольца тонкие, но объёмные на вид */}
      <mesh geometry={geo} position={[0, 0, -0.004]}>
        <meshBasicMaterial map={tex} transparent side={THREE.DoubleSide} depthWrite={false} opacity={0.4} color="#8a7a5c" />
      </mesh>
    </group>
  );
}

/* ---------- система ---------- */
function System(props: SceneProps) {
  const sim = useRef(props.initialDays);
  const playingRef = useRef(props.playing);
  playingRef.current = props.playing;
  const speedRef = useRef(props.speed);
  speedRef.current = props.speed;
  const hoverRef = useRef(props.hoverId ?? null);
  const hoverPropRef = useRef(props.hoverId ?? null);
  hoverPropRef.current = props.hoverId ?? null;
  const tickAcc = useRef(0);
  const firstReset = useRef(true);

  const groups = useRef<Record<string, THREE.Group | null>>({});
  const scales = useRef<Record<string, number>>({});
  const rotAcc = useRef<Record<string, number>>({}); // обороты вокруг оси
  const moonRef = useRef<THREE.Group | null>(null);
  const satRef = useRef<THREE.Group | null>(null);
  const beltRef = useRef<THREE.Points | null>(null);
  const sunMeshRef = useRef<THREE.Mesh | null>(null);
  /* постоянное НЛО */
  const ufoGrp = useRef<THREE.Group | null>(null);
  const ufoRope = useRef<THREE.Mesh | null>(null);
  const ufoLadder = useRef<THREE.Group | null>(null);
  const martianGrp = useRef<THREE.Group | null>(null);
  const martianArm = useRef<THREE.Group | null>(null);
  /* астронавт с ракетой */
  const activityTime = useRef(0);
  const astroGrp = useRef<THREE.Group | null>(null);
  const astroFlame = useRef<THREE.Mesh | null>(null);
  const astroSM = useRef({
    mode: "travel" as "travel" | "land" | "explore" | "drill" | "depart",
    t: 0,
    hold: 8 + Math.random() * 12,
    planetIdx: 0,
    flame: 0,
    drill: 0,
    pos: new THREE.Vector3(7, 10, 0),
    target: new THREE.Vector3(),
    flyT: 0,
    from: new THREE.Vector3(7, 10, 0),
  });
  const ufoSM = useRef({
    mode: "earth" as "earth" | "toMars" | "mars" | "toEarth",
    t: 0,
    hold: 10 + Math.random() * 15,
    rope: 0,
    ladder: 0,
    martian: 0,
    wave: 0,
    flyT: 0,
    from: new THREE.Vector3(),
    leaving: false,
    pos: new THREE.Vector3(),
    greetIdx: 0,
  });
  const ufoTmp = useRef(new THREE.Vector3());

  /* пузырь с сообщением корабля / марсианина */
  const [ufoBubble, setUfoBubble] = useState<{ text: string; kind: "earth" | "mars" } | null>(null);
  const bubbleRef = useRef<{ text: string; kind: "earth" | "mars" } | null>(null);

  const textures = useMemo(() => {
    const m: Record<string, THREE.CanvasTexture> = {};
    for (const b of [SUN as BodyData, ...PLANETS]) m[b.id] = bodyTexture(b.id);
    return m;
  }, []);
  const ringTex = useMemo(() => ringTexture(), []);
  const sunGlow = useMemo(() => glowTexture("rgba(255,240,214,0.9)"), []);
  const sunCorona = useMemo(() => glowTexture("rgba(255,205,140,0.5)"), []);

  const beltGeo = useMemo(() => {
    const rnd = mulberry32(777);
    const n = 1500;
    const pos = new Float32Array(n * 3);
    const r0 = orbitR3(2.1);
    const r1 = orbitR3(3.3);
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU;
      const r = r0 + rnd() * (r1 - r0);
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (rnd() - 0.5) * 0.55;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  useEffect(() => {
    if (firstReset.current) {
      firstReset.current = false;
      return;
    }
    sim.current = 0;
  }, [props.resetToken]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    if (playingRef.current) sim.current += dt * speedRef.current;
    const days = sim.current;
    activityTime.current += dt;

    for (let i = 0; i < PLANETS.length; i++) {
      const d = PLANETS[i];
      const g = groups.current[d.id];
      if (!g) continue;
      const a = d.angle0 + TAU * (days / d.periodDays);
      const r = orbitR3(d.distAU);
      g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      const target = hoverRef.current === d.id || hoverPropRef.current === d.id ? 1.28 : 1;
      const cur = scales.current[d.id] ?? 1;
      const next = cur + (target - cur) * 0.14;
      scales.current[d.id] = next;
      g.scale.setScalar(next);
      const mesh = g.userData.mesh as THREE.Mesh | undefined;
      if (mesh) {
        const sd = SPIN_DAYS[d.id] ?? 1;
        if (playingRef.current) {
          // пропорционально реальным суткам, но сдержанно: едва заметное вращение
          const rate = clamp3((speedRef.current / sd) * 0.0012, -0.06, 0.06);
          rotAcc.current[d.id] = (rotAcc.current[d.id] ?? 0) + rate * dt;
        }
        mesh.rotation.y = (rotAcc.current[d.id] ?? 0) * TAU;
      }
    }

    // Солнце тоже вращается (грануляция ползёт)
    if (sunMeshRef.current) {
      if (playingRef.current) {
        const rate = clamp3((speedRef.current / (SPIN_DAYS.sun ?? 25.4)) * 0.0012, -0.06, 0.06);
        rotAcc.current.sun = (rotAcc.current.sun ?? 0) + rate * dt;
      }
      sunMeshRef.current.rotation.y = (rotAcc.current.sun ?? 0) * TAU;
    }

    if (moonRef.current) {
      const a = 1.2 + TAU * (days / 27.3);
      const pr = planetR3(12756);
      moonRef.current.position.set(Math.cos(a) * pr * 2.7, pr * 0.25, Math.sin(a) * pr * 2.7);
    }
    if (satRef.current) {
      const a = 2.2 + performance.now() / 1000 * 1.4;
      const pr = planetR3(12756);
      satRef.current.position.set(Math.cos(a) * pr * 1.95, pr * 0.1, Math.sin(a) * pr * 1.95);
      satRef.current.rotation.y = -a;
    }
    if (beltRef.current) beltRef.current.rotation.y = TAU * (days / 1680);

    /* постоянное НЛО: парит над Землёй (канат), летит к Марсу (лестница + марсианин) */
    if (ufoGrp.current) {
      const u = ufoSM.current;
      const eP = PLANETS[2];
      const mP = PLANETS[3];
      const ae = eP.angle0 + TAU * (days / eP.periodDays);
      const re = orbitR3(eP.distAU);
      const pe = planetR3(eP.diameterKm);
      const am = mP.angle0 + TAU * (days / mP.periodDays);
      const rm = orbitR3(mP.distAU);
      const pm = planetR3(mP.diameterKm);
      const clock = performance.now() / 1000;
      const bob = Math.sin(clock * 2) * 0.5;
      const earthHover = ufoTmp.current.set(Math.cos(ae) * re, pe + 7 + bob, Math.sin(ae) * re).clone();
      const marsHover = new THREE.Vector3(Math.cos(am) * rm, pm + 7 + bob, Math.sin(am) * rm);
      const appr = (v: number, t: number, r: number, d: number) =>
        v < t ? Math.min(t, v + r * d) : Math.max(t, v - r * d);
      const eio = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

      if (u.mode === "earth") {
        u.pos.copy(earthHover);
        if (!u.leaving) {
          u.rope = appr(u.rope, 1, 0.55, dt);
          if (u.rope >= 1) {
            u.t += dt;
            if (u.t >= u.hold) u.leaving = true;
          }
        } else {
          u.rope = appr(u.rope, 0, 0.7, dt);
          if (u.rope <= 0) {
            u.mode = "toMars";
            u.flyT = 0;
            u.from.copy(u.pos);
            u.t = 0;
            u.leaving = false;
          }
        }
      } else if (u.mode === "toMars") {
        u.flyT = Math.min(1, u.flyT + dt / 4);
        const k = eio(u.flyT);
        u.pos.lerpVectors(u.from, marsHover, k);
        u.pos.y += 8 * Math.sin(Math.PI * k);
        if (u.flyT >= 1) {
          u.mode = "mars";
          u.t = 0;
          u.hold = 10 + Math.random() * 15;
          u.greetIdx = (u.greetIdx + 1) % Math.max(1, props.marsMsgs.length);
        }
      } else if (u.mode === "mars") {
        u.pos.copy(marsHover);
        if (!u.leaving) {
          u.ladder = appr(u.ladder, 1, 0.55, dt);
          if (u.ladder >= 1) {
            u.martian = appr(u.martian, 1, 0.5, dt);
            if (u.martian >= 1) {
              u.t += dt;
              u.wave += dt;
              if (u.t >= u.hold) u.leaving = true;
            }
          }
        } else {
          u.martian = appr(u.martian, 0, 0.7, dt);
          if (u.martian <= 0) {
            u.ladder = appr(u.ladder, 0, 0.7, dt);
            if (u.ladder <= 0) {
              u.mode = "toEarth";
              u.flyT = 0;
              u.from.copy(u.pos);
              u.t = 0;
              u.wave = 0;
              u.leaving = false;
            }
          }
        }
      } else {
        u.flyT = Math.min(1, u.flyT + dt / 4);
        const k = eio(u.flyT);
        u.pos.lerpVectors(u.from, earthHover, k);
        u.pos.y += 8 * Math.sin(Math.PI * k);
        if (u.flyT >= 1) {
          u.mode = "earth";
          u.t = 0;
          u.rope = 0;
          u.hold = 10 + Math.random() * 15;
        }
      }

      ufoGrp.current.position.copy(u.pos);
      ufoGrp.current.visible = props.showUfo;

      const surfY = u.mode === "mars" || u.mode === "toMars" ? pm : pe;
      // канат (Земля)
      if (ufoRope.current) {
        const visible = u.mode === "earth" && u.rope > 0.02;
        ufoRope.current.visible = visible && props.showUfo;
        if (visible) {
          const top = -1.4;
          const fullLen = u.pos.y - 1.4 - surfY;
          const len = Math.max(0.01, fullLen * u.rope);
          ufoRope.current.position.set(0, top - len / 2, 0);
          ufoRope.current.scale.set(1, len, 1);
        }
      }
      // лестница (Марс)
      if (ufoLadder.current) {
        const visible = u.mode === "mars" && u.ladder > 0.02;
        ufoLadder.current.visible = visible && props.showUfo;
        if (visible) {
          const fullLen = u.pos.y - 1.4 - surfY;
          const len = Math.max(0.01, fullLen * u.ladder);
          ufoLadder.current.position.set(0, -1.4 - len / 2, 0);
          ufoLadder.current.scale.set(1, len, 1);
        }
      }
      // марсианин
      if (martianGrp.current) {
        const visible = u.mode === "mars" && u.martian > 0.02;
        martianGrp.current.visible = visible && props.showUfo;
        if (visible) {
          const topY = -2;
          const groundY = -(u.pos.y - 1.4 - surfY) + 0.8;
          martianGrp.current.position.set(1.4, topY + (groundY - topY) * u.martian, 0);
          if (martianArm.current) {
            const onGround = u.martian >= 0.98;
            martianArm.current.rotation.z = onGround ? -1.2 + Math.sin(u.wave * 7) * 0.8 : -0.4;
          }
        }
      }
    }

    /* астронавт: летает между планетами, приземляется, исследует, бурит */
    if (astroGrp.current) {
      const a = astroSM.current;
      const pIdx = a.planetIdx % PLANETS.length;
      const d = PLANETS[pIdx];
      const ang = d.angle0 + TAU * (days / d.periodDays);
      const r = orbitR3(d.distAU);
      const pr = planetR3(d.diameterKm);
      const targetPos = new THREE.Vector3(Math.cos(ang) * r, pr + 5, Math.sin(ang) * r);
      if (a.mode !== "travel") {
        a.pos.x = targetPos.x;
        a.pos.z = targetPos.z;
      }
      const eio = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

      if (a.mode === "travel") {
        a.flyT = Math.min(1, a.flyT + dt / 3);
        const k = eio(a.flyT);
        a.pos.lerpVectors(a.from, targetPos, k);
        a.flame = 0.6 + 0.4 * Math.sin(performance.now() / 50);
        if (a.flyT >= 1) {
          a.mode = "land";
          a.t = 0;
        }
      } else if (a.mode === "land") {
        const curY = a.pos.y;
        const groundY = pr + 1.8;
        if (curY > groundY) {
          a.pos.y = curY - dt * 2.5;
          a.flame = 0.8;
        } else {
          a.pos.y = groundY;
          a.mode = "explore";
          a.t = 0;
          a.hold = SURFACE_DURATION;
          a.flame = 0;
        }
      } else if (a.mode === "explore") {
        a.t += dt;
        a.pos.y = pr + 1.8;
        if (a.t >= a.hold) {
          a.mode = "depart";
          a.t = 0;
        }
      } else {
        a.t += dt;
        a.flame = Math.min(1, a.t * 1.5);
        a.pos.y = pr + 1.8 + a.t * 3;
        if (a.t >= 1.2) {
          a.mode = "travel";
          a.flyT = 0;
          a.from.copy(a.pos);
          a.planetIdx = (a.planetIdx + 1) % PLANETS.length;
          a.t = 0;
        }
      }

      astroGrp.current.position.copy(a.pos);
      astroGrp.current.visible = props.showAstro;
      if (astroFlame.current) {
        const visible = a.flame > 0.02 && props.showAstro;
        astroFlame.current.visible = visible;
        if (visible) {
          astroFlame.current.scale.set(1, 0.8 + a.flame * 1.2, 1);
          (astroFlame.current.material as THREE.MeshBasicMaterial).opacity = 0.5 + a.flame * 0.4;
        }
      }
    }

    tickAcc.current += dt;
    if (tickAcc.current > 0.15) {
      tickAcc.current = 0;
      props.onTick(days);
      // пузырь сообщения (только при изменении)
      const u = ufoSM.current;
      let next: { text: string; kind: "earth" | "mars" } | null = null;
      if (props.showUfo) {
        if (u.mode === "earth" && u.rope >= 0.98 && !u.leaving) {
          next = { text: props.earthMsg, kind: "earth" };
        } else if (u.mode === "mars" && u.martian >= 0.98) {
          const msgs = props.marsMsgs.length ? props.marsMsgs : ["Привет!"];
          next = { text: msgs[u.greetIdx % msgs.length], kind: "mars" };
        }
      }
      const prev = bubbleRef.current;
      if ((prev?.text ?? "") !== (next?.text ?? "") || (prev?.kind ?? "") !== (next?.kind ?? "")) {
        bubbleRef.current = next;
        setUfoBubble(next);
      }
    }

  });

  return (
    <group>
      {/* Солнце */}
      <group>
        <mesh ref={sunMeshRef}>
          <sphereGeometry args={[SUN_R, 64, 64]} />
          <meshBasicMaterial map={textures.sun} />
        </mesh>
        {/* потемнение к лимбу — как у настоящей фотосферы */}
        <mesh scale={[1.003, 1.003, 1.003]}>
          <sphereGeometry args={[SUN_R, 48, 48]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            vertexShader={`
              varying vec3 vN; varying vec3 vV;
              void main(){
                vN = normalize(normalMatrix * normal);
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                vV = normalize(-mv.xyz);
                gl_Position = projectionMatrix * mv;
              }`}
            fragmentShader={`
              varying vec3 vN; varying vec3 vV;
              void main(){
                float f = pow(1.0 - max(dot(vN, vV), 0.0), 1.7);
                gl_FragColor = vec4(0.55, 0.22, 0.03, f * 0.6);
              }`}
          />
        </mesh>
        {/* тонкая хромосфера по краю */}
        <mesh scale={[1.012, 1.012, 1.012]}>
          <sphereGeometry args={[SUN_R, 48, 48]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            vertexShader={`
              varying vec3 vN; varying vec3 vV;
              void main(){
                vN = normalize(normalMatrix * normal);
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                vV = normalize(-mv.xyz);
                gl_Position = projectionMatrix * mv;
              }`}
            fragmentShader={`
              varying vec3 vN; varying vec3 vV;
              void main(){
                float f = pow(1.0 - max(dot(vN, vV), 0.0), 3.0);
                gl_FragColor = vec4(1.0, 0.42, 0.16, f * 0.75);
              }`}
          />
        </mesh>
        {/* белая корона */}
        <sprite scale={[SUN_R * 11, SUN_R * 11, 1]}>
          <spriteMaterial map={sunCorona} transparent opacity={0.32} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
        <sprite scale={[SUN_R * 6.5, SUN_R * 6.5, 1]}>
          <spriteMaterial map={sunGlow} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
        <sprite scale={[SUN_R * 3.2, SUN_R * 3.2, 1]}>
          <spriteMaterial map={sunGlow} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
        {(props.showLabels || props.hoverId === "sun") && (
          <Html center position={[0, SUN_R + 1.4, 0]} distanceFactor={38} zIndexRange={[30, 0]}>
            <Label name="Солнце" active={props.hoverId === "sun" || props.selectedId === "sun"} />
          </Html>
        )}
      </group>
      <pointLight intensity={2.6} decay={0} color="#fff2d8" />

      {/* планеты */}
      {PLANETS.map((d) => {
        const pr = planetR3(d.diameterKm);
        const r = orbitR3(d.distAU);
        const tilt = d.id === "uranus" ? 1.71 : d.id === "saturn" ? 0.47 : 0.1;
        return (
          <group key={d.id}>
            {props.showOrbits && (
              <OrbitRing
                r={r}
                tone={props.selectedId === d.id ? "sel" : props.hoverId === d.id ? "hov" : "plain"}
              />
            )}
            {/* невидимое кольцо для клика по орбите */}
            {props.showOrbits && (
              <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                onClick={(e) => {
                  e.stopPropagation();
                  props.onOrbitSelect(d.id);
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  hoverRef.current = d.id;
                  props.onHover(d.id);
                  document.body.style.cursor = "pointer";
                }}
                onPointerOut={() => {
                  hoverRef.current = null;
                  props.onHover(null);
                  document.body.style.cursor = "auto";
                }}
              >
                <ringGeometry args={[Math.max(0.1, r - 0.5), r + 0.5, 128]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
              </mesh>
            )}
            <group
              ref={(el) => {
                groups.current[d.id] = el;
              }}
            >
              <group rotation={[0, 0, tilt]}>
                <mesh
                  ref={(el) => {
                    const g = groups.current[d.id];
                    if (g && el) g.userData.mesh = el;
                  }}
                  onPointerOver={(e) => {
                    e.stopPropagation();
                    hoverRef.current = d.id;
                    props.onHover(d.id);
                    document.body.style.cursor = "pointer";
                  }}
                  onPointerOut={() => {
                    hoverRef.current = null;
                    props.onHover(null);
                    document.body.style.cursor = "auto";
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onSelect(d.id);
                  }}
                >
                  <sphereGeometry args={[pr, 48, 48]} />
                  <meshStandardMaterial map={textures[d.id]} roughness={1} metalness={0} />
                </mesh>
                {d.ring && <SaturnRing pr={pr} tex={ringTex} />}
              </group>

              {/* Луна + МКС у Земли */}
              {d.id === "earth" && (
                <>
                  <group ref={moonRef}>
                    <mesh>
                      <sphereGeometry args={[pr * 0.27, 24, 24]} />
                      <meshStandardMaterial color="#c9cedb" roughness={1} />
                    </mesh>
                  </group>
                  <group ref={satRef}>
                    <mesh>
                      <boxGeometry args={[0.14, 0.05, 0.05]} />
                      <meshStandardMaterial color="#dfe8f6" roughness={0.5} metalness={0.4} />
                    </mesh>
                    <mesh position={[-0.19, 0, 0]}>
                      <boxGeometry args={[0.2, 0.008, 0.09]} />
                      <meshStandardMaterial color="#2b5bd7" roughness={0.4} metalness={0.3} emissive="#122a66" />
                    </mesh>
                    <mesh position={[0.19, 0, 0]}>
                      <boxGeometry args={[0.2, 0.008, 0.09]} />
                      <meshStandardMaterial color="#2b5bd7" roughness={0.4} metalness={0.3} emissive="#122a66" />
                    </mesh>
                  </group>
                </>
              )}

              {(props.showLabels || props.hoverId === d.id) && (
                <Html center position={[0, pr + 1, 0]} distanceFactor={38} zIndexRange={[30, 0]}>
                  <Label name={d.name} active={props.hoverId === d.id || props.selectedId === d.id} />
                </Html>
              )}
            </group>
          </group>
        );
      })}

      {/* пояс астероидов */}
      <points ref={beltRef} geometry={beltGeo}>
        <pointsMaterial color="#9aa7c2" size={0.07} sizeAttenuation transparent opacity={0.65} />
      </points>

      {/* постоянное НЛО (Земля ↔ Марс) */}
      <group ref={ufoGrp}>
        {/* корпус-тарелка */}
        <mesh scale={[1, 0.32, 1]}>
          <sphereGeometry args={[1.5, 40, 24]} />
          <meshStandardMaterial color="#9fb4d8" roughness={0.3} metalness={0.75} />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <sphereGeometry args={[0.7, 24, 16, 0, TAU, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#c8f4ff" transparent opacity={0.55} roughness={0.05} metalness={0.2} emissive="#1c4a5a" emissiveIntensity={0.5} />
        </mesh>
        {/* огни по ободу */}
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * TAU;
          return (
            <mesh key={i} position={[Math.cos(a) * 1.42, 0, Math.sin(a) * 1.42]}>
              <sphereGeometry args={[0.09, 8, 8]} />
              <meshBasicMaterial color={["#ffd166", "#8ff5e9", "#ff9ad5", "#9ecbff"][i % 4]} fog={false} />
            </mesh>
          );
        })}
        {/* канат (к Земле) */}
        <mesh ref={ufoRope} visible={false}>
          <cylinderGeometry args={[0.03, 0.03, 1, 8]} />
          <meshBasicMaterial color="#dfe7f5" transparent opacity={0.75} />
        </mesh>
        {/* лестница (к Марсу) */}
        <group ref={ufoLadder} visible={false}>
          <mesh position={[-0.35, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 1, 8]} />
            <meshBasicMaterial color="#c8d6ee" transparent opacity={0.85} />
          </mesh>
          <mesh position={[0.35, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 1, 8]} />
            <meshBasicMaterial color="#c8d6ee" transparent opacity={0.85} />
          </mesh>
          {Array.from({ length: 8 }, (_, i) => (
            <mesh key={i} position={[0, -0.44 + i * 0.125, 0]}>
              <boxGeometry args={[0.7, 0.035, 0.035]} />
              <meshBasicMaterial color="#c8d6ee" transparent opacity={0.85} />
            </mesh>
          ))}
        </group>
        {/* марсианин-мальчик */}
        <group ref={martianGrp} visible={false}>
          <mesh position={[0, 0.55, 0]}>
            <sphereGeometry args={[0.42, 20, 20]} />
            <meshStandardMaterial color="#6fe08a" roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.15, 0]}>
            <capsuleGeometry args={[0.3, 0.5, 6, 14]} />
            <meshStandardMaterial color="#5cc877" roughness={0.6} />
          </mesh>
          {/* глаза */}
          <mesh position={[-0.15, 0.62, 0.36]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshBasicMaterial color="#0a2812" />
          </mesh>
          <mesh position={[0.15, 0.62, 0.36]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshBasicMaterial color="#0a2812" />
          </mesh>
          {/* антеннки */}
          <mesh position={[-0.14, 1.0, 0]}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshBasicMaterial color="#ffd166" />
          </mesh>
          <mesh position={[0.14, 1.0, 0]}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshBasicMaterial color="#ffd166" />
          </mesh>
          {/* машущая рука */}
          <group ref={martianArm} position={[0.3, 0.15, 0]}>
            <mesh position={[0.32, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <capsuleGeometry args={[0.08, 0.5, 4, 10]} />
              <meshStandardMaterial color="#6fe08a" roughness={0.6} />
            </mesh>
          </group>
        </group>

        {/* пузырь с сообщением */}
        {ufoBubble && props.showUfo && (
          <Html center position={[0, 3.4, 0]} distanceFactor={42} zIndexRange={[30, 0]}>
            <div
              className={`pointer-events-none max-w-[300px] rounded-xl border px-4 py-2.5 text-center font-semibold backdrop-blur-sm ${
                ufoBubble.kind === "earth"
                  ? "border-amber/70 bg-[rgba(24,16,4,0.92)] text-[#ffd98f]"
                  : "border-[#6fe08a]/70 bg-[rgba(10,16,32,0.92)] text-[#9fe8b0]"
              }`}
              style={{ fontSize: 15, lineHeight: 1.35 }}
            >
              {ufoBubble.text}
            </div>
          </Html>
        )}
      </group>

      {/* астронавт на ракете */}
      <group ref={astroGrp} scale={2}>
        {/* Segmented pressure hull, insulated service stage and real landing struts. */}
        <mesh position={[0,.25,0]}>
          <cylinderGeometry args={[.28,.31,1.35,32]} />
          <meshStandardMaterial color="#c7c9c0" roughness={.42} metalness={.68} />
        </mesh>
        <mesh position={[0,1,0]} scale={[1,.8,1]}>
          <sphereGeometry args={[.28,32,16,0,TAU,0,Math.PI/2]} />
          <meshStandardMaterial color="#deddd0" roughness={.38} metalness={.6} />
        </mesh>
        <mesh position={[0,-.58,0]}>
          <cylinderGeometry args={[.31,.31,.35,24]} />
          <meshStandardMaterial color="#9d8d65" roughness={.65} metalness={.65} />
        </mesh>
        {[-.75,-.4,0,.55,.88].map(y=><mesh key={y} position={[0,y,0]} rotation={[Math.PI/2,0,0]}>
          <torusGeometry args={[.306,.012,8,32]} /><meshStandardMaterial color="#59686d" metalness={.8} roughness={.4} />
        </mesh>)}
        <mesh position={[0,-.82,0]}>
          <cylinderGeometry args={[.11,.2,.2,24,1,true]} /><meshStandardMaterial color="#526168" metalness={.8} roughness={.5} side={THREE.DoubleSide} />
        </mesh>
        {[0,1,2,3].map(i=>{
          const a=i*TAU/4, ca=Math.cos(a),sa=Math.sin(a);
          return <group key={i}>
            <Line points={[[ca*.27,-.3,sa*.27],[ca*.62,-.78,sa*.62],[ca*.65,-.9,sa*.65]]} color="#c1c8c2" lineWidth={2} />
            <Line points={[[ca*.3,-.65,sa*.3],[ca*.62,-.78,sa*.62]]} color="#69797d" lineWidth={1} />
            <mesh position={[ca*.65,-.9,sa*.65]}><cylinderGeometry args={[.11,.12,.025,16]} /><meshStandardMaterial color="#848f87" metalness={.65} /></mesh>
          </group>;
        })}
        <mesh position={[0,.48,.284]}>
          <torusGeometry args={[.13,.025,8,32]} /><meshStandardMaterial color="#6d7d80" metalness={.8} roughness={.25} />
        </mesh>
        <mesh position={[0,.48,.292]}><circleGeometry args={[.117,32]} /><meshStandardMaterial color="#203541" metalness={.8} roughness={.12} /></mesh>
        {/* пламя двигателя */}
        <mesh ref={astroFlame} position={[0, -1.2, 0]} rotation={[Math.PI, 0, 0]} visible={false}>
          <coneGeometry args={[0.3, 0.9, 12]} />
          <meshBasicMaterial color="#b3d1ef" transparent opacity={0.45} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>

      <ActivityScene3D settings={props.activities} showAstro={props.showAstro} mission={astroSM} planets={groups} time={activityTime} />

      {/* космические события: созвездия, чёрные дыры, метеоры, галактики... */}
      <CosmicEvents3D showDisks={props.activities.disks} />
    </group>
  );
}

function Label({ name, active }: { name: string; active: boolean }) {
  return (
    <div
      className={`pointer-events-none rounded border px-2 py-0.5 font-mono text-[10px] tracking-[0.14em] whitespace-nowrap backdrop-blur-sm ${
        active ? "border-amber/70 bg-amber/10 text-amber" : "border-line bg-space-900/80 text-ink/85"
      }`}
    >
      {name.toUpperCase()}
    </div>
  );
}

/* ---------- мерцающие звёзды (как в 2D) ---------- */
function TwinklingStars({ count = 3800 }: { count?: number }) {
  const matRef = useRef<THREE.ShaderMaterial | null>(null);
  const geo = useMemo(() => {
    const rnd = mulberry32(20260202);
    const pos = new Float32Array(count * 3);
    const aPhase = new Float32Array(count);
    const aSize = new Float32Array(count);
    const aSpeed = new Float32Array(count);
    const aKind = new Float32Array(count); // 0 — обычные, 1 — умирающие (угасают), 2 — резко мигающие
    const aFade = new Float32Array(count); // скорость цикла угасания
    for (let i = 0; i < count; i++) {
      // равномерное направление на сфере
      const u = rnd() * 2 - 1;
      const ph = rnd() * TAU;
      const rr = 460 + rnd() * 260;
      const s = Math.sqrt(1 - u * u);
      pos[i * 3] = Math.cos(ph) * s * rr;
      pos[i * 3 + 1] = u * rr;
      pos[i * 3 + 2] = Math.sin(ph) * s * rr;
      aPhase[i] = rnd() * TAU;
      aSize[i] = 1.6 + rnd() * 3.0;
      aSpeed[i] = 0.6 + rnd() * 2.4;
      const roll = rnd();
      aKind[i] = roll < 0.14 ? 1 : roll < 0.26 ? 2 : 0;
      aFade[i] = 0.06 + rnd() * 0.16; // медленные циклы: 40–100 с
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aPhase", new THREE.BufferAttribute(aPhase, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(aSize, 1));
    g.setAttribute("aSpeed", new THREE.BufferAttribute(aSpeed, 1));
    g.setAttribute("aKind", new THREE.BufferAttribute(aKind, 1));
    g.setAttribute("aFade", new THREE.BufferAttribute(aFade, 1));
    return g;
  }, [count]);

  useFrame((state) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{ uTime: { value: 0 } }}
        vertexShader={`
          attribute float aPhase; attribute float aSize; attribute float aSpeed;
          attribute float aKind; attribute float aFade;
          uniform float uTime; varying float vA; varying float vWarm;
          void main(){
            float isDie = step(0.5, aKind) * (1.0 - step(1.5, aKind));
            float isBlink = step(1.5, aKind);
            /* мерцание */
            float tw = 0.55 + 0.45 * sin(uTime * aSpeed + aPhase);
            /* угасание: звезда медленно гаснет почти до нуля и возрождается */
            float fadeCyc = 0.5 + 0.5 * sin(uTime * aFade * 6.2831 + aPhase * 1.7);
            float dying = 0.06 + 0.94 * smoothstep(0.3, 0.72, fadeCyc);
            /* резкое мигание: короткие импульсы света */
            float fr = fract(uTime * (0.18 + aFade) + aPhase * 0.317);
            float pulse = smoothstep(0.04, 0.16, fr) * (1.0 - smoothstep(0.62, 0.78, fr));
            float blink = mix(1.0, 0.12 + 0.88 * pulse, isBlink);
            vA = tw * mix(1.0, dying, isDie) * blink;
            vWarm = step(0.82, fract(aPhase * 0.159));
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * (1400.0 / -mv.z) * mix(1.0, 0.55 + 0.9 * pulse, isBlink);
            gl_Position = projectionMatrix * mv;
          }`}
        fragmentShader={`
          varying float vA; varying float vWarm;
          void main(){
            vec2 d = gl_PointCoord - 0.5;
            float r = length(d);
            float a = smoothstep(0.5, 0.06, r) * vA;
            vec3 col = mix(vec3(0.82, 0.88, 1.0), vec3(1.0, 0.9, 0.72), vWarm);
            gl_FragColor = vec4(col, a);
          }`}
      />
    </points>
  );
}

/* ---------- фоны в духе «Интерстеллара» ---------- */
function discTex(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 64;
  const g = c.getContext("2d")!;
  const lg = g.createLinearGradient(0, 0, 1024, 0);
  lg.addColorStop(0, "rgba(0,0,0,0)");
  lg.addColorStop(0.16, "rgba(120,48,18,0.2)");
  lg.addColorStop(0.34, "rgba(228,108,38,0.7)");
  lg.addColorStop(0.5, "rgba(255,238,205,0.95)");
  lg.addColorStop(0.66, "rgba(228,108,38,0.7)");
  lg.addColorStop(0.84, "rgba(120,48,18,0.2)");
  lg.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = lg;
  g.fillRect(0, 0, 1024, 64);
  return new THREE.CanvasTexture(c);
}

function wormholeTex(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  for (let i = 10; i >= 0; i--) {
    const t = i / 10;
    const r = 250 * (1 - t * 0.85);
    g.strokeStyle = `rgba(${t < 0.5 ? "140,235,225" : "150,160,240"},${(0.1 + 0.16 * Math.sin(t * 9 + 1) + 0.1).toFixed(2)})`;
    g.lineWidth = 2 + t * 3;
    g.beginPath();
    g.arc(256, 256, Math.max(2, r), 0, TAU);
    g.stroke();
  }
  const rg = g.createRadialGradient(200, 190, 10, 256, 256, 250);
  rg.addColorStop(0, "rgba(240,255,252,0.8)");
  rg.addColorStop(0.3, "rgba(150,230,225,0.3)");
  rg.addColorStop(0.75, "rgba(70,110,190,0.12)");
  rg.addColorStop(1, "rgba(30,50,120,0.04)");
  g.fillStyle = rg;
  g.beginPath();
  g.arc(256, 256, 250, 0, TAU);
  g.fill();
  return new THREE.CanvasTexture(c);
}

const THEME_CFG: Record<string, { bg: string; fog: string; fogNear: number; fogFar: number }> = {
  deep: { bg: "#05070f", fog: "#05070f", fogNear: 220, fogFar: 1500 },
  gargantua: { bg: "#080402", fog: "#0a0503", fogNear: 240, fogFar: 1700 },
  wormhole: { bg: "#04070f", fog: "#04070f", fogNear: 220, fogFar: 1500 },
  ice: { bg: "#0a1422", fog: "#0d1a2c", fogNear: 180, fogFar: 1300 },
  nebula: { bg: "#070510", fog: "#070510", fogNear: 220, fogFar: 1500 },
};

function ThemeBackdrop({ theme }: { theme: string }) {
  const disk = useMemo(() => discTex(), []);
  const worm = useMemo(() => wormholeTex(), []);
  const warm = useMemo(() => glowTexture("rgba(255,190,110,0.85)"), []);
  const teal = useMemo(() => glowTexture("rgba(120,235,225,0.7)"), []);
  const pink = useMemo(() => glowTexture("rgba(255,150,210,0.6)"), []);
  const ice = useMemo(() => glowTexture("rgba(210,230,248,0.75)"), []);

  const diskGeo = useMemo(() => {
    const inner = 96;
    const outer = 260;
    const g = new THREE.RingGeometry(inner, outer, 128, 1);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const t = (Math.hypot(pos.getX(i), pos.getY(i)) - inner) / (outer - inner);
      uv.setXY(i, t, 0.5);
    }
    return g;
  }, []);

  if (theme === "gargantua") {
    return (
      <group position={[330, 70, -760]}>
        <sprite scale={[620, 620, 1]}>
          <spriteMaterial map={warm} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
        </sprite>
        <mesh geometry={diskGeo} rotation={[-1.32, 0, 0.18]}>
          <meshBasicMaterial map={disk} transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} fog={false} />
        </mesh>
        {/* линзированная верхняя дуга */}
        <mesh rotation={[0, 0, 0.12]}>
          <ringGeometry args={[150, 168, 96, 1, Math.PI * 0.12, Math.PI * 0.76]} />
          <meshBasicMaterial color="#ffe3b8" transparent opacity={0.75} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} fog={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[92, 48, 48]} />
          <meshBasicMaterial color="#000000" fog={false} />
        </mesh>
      </group>
    );
  }
  if (theme === "wormhole") {
    return (
      <group position={[-330, 90, -700]}>
        <sprite scale={[460, 460, 1]}>
          <spriteMaterial map={teal} transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
        </sprite>
        <mesh>
          <planeGeometry args={[260, 260]} />
          <meshBasicMaterial map={worm} transparent blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
        </mesh>
      </group>
    );
  }
  if (theme === "ice") {
    return (
      <group>
        <sprite position={[0, -140, -500]} scale={[900, 420, 1]}>
          <spriteMaterial map={ice} transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
        </sprite>
        <sprite position={[-260, -60, -420]} scale={[420, 240, 1]}>
          <spriteMaterial map={ice} transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
        </sprite>
        <sprite position={[300, -90, -460]} scale={[380, 210, 1]}>
          <spriteMaterial map={ice} transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
        </sprite>
      </group>
    );
  }
  if (theme === "nebula") {
    return (
      <group>
        <sprite position={[-240, 120, -560]} scale={[520, 520, 1]}>
          <spriteMaterial map={pink} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
        </sprite>
        <sprite position={[280, -60, -520]} scale={[460, 460, 1]}>
          <spriteMaterial map={teal} transparent opacity={0.24} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
        </sprite>
        <sprite position={[40, 180, -620]} scale={[560, 560, 1]}>
          <spriteMaterial map={warm} transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
        </sprite>
      </group>
    );
  }
  return null;
}

/* ---------- сцена ---------- */
export default function SolarScene3D(props: SceneProps) {
  const nebTeal = useMemo(() => glowTexture("rgba(38,160,150,0.6)"), []);
  const nebAmber = useMemo(() => glowTexture("rgba(255,140,60,0.5)"), []);
  const nebBlue = useMemo(() => glowTexture("rgba(70,110,220,0.5)"), []);
  const band = useMemo(() => bandTexture(), []);

  return (
    <div className="absolute inset-0">
      <Canvas dpr={[1, 2]} camera={{ position: [0, 98, 156], fov: 44, far: 2600 }}>
        <color attach="background" args={[(THEME_CFG[props.bgTheme] ?? THEME_CFG.deep).bg]} />
        <fog
          attach="fog"
          args={[
            (THEME_CFG[props.bgTheme] ?? THEME_CFG.deep).fog,
            (THEME_CFG[props.bgTheme] ?? THEME_CFG.deep).fogNear,
            (THEME_CFG[props.bgTheme] ?? THEME_CFG.deep).fogFar,
          ]}
        />
        <ambientLight intensity={0.5} />
        <TwinklingStars />
        <ThemeBackdrop theme={props.bgTheme} />

        {/* туманности и полосы Млечного Пути */}
        <sprite position={[90, 24, -170]} scale={[280, 280, 1]}>
          <spriteMaterial map={nebTeal} transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
        <sprite position={[-150, -30, -130]} scale={[230, 230, 1]}>
          <spriteMaterial map={nebAmber} transparent opacity={0.13} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
        <sprite position={[40, -70, -210]} scale={[320, 320, 1]}>
          <spriteMaterial map={nebBlue} transparent opacity={0.14} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
        <mesh position={[0, -46, -170]} rotation={[-0.4, 0, 0.55]}>
          <planeGeometry args={[640, 150]} />
          <meshBasicMaterial map={band} transparent opacity={0.12} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[30, 60, -200]} rotation={[-0.25, 0.4, -0.5]}>
          <planeGeometry args={[700, 120]} />
          <meshBasicMaterial map={band} transparent opacity={0.08} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>

        <System {...props} />
        <DeepSpace />
        <OrbitControls target={[0, -4, 0]} enablePan={true} minDistance={9} maxDistance={620} enableDamping dampingFactor={0.06} />
      </Canvas>

      <div className="pointer-events-none absolute bottom-20 left-1/2 z-10 -translate-x-1/2 rounded-md border border-line bg-space-900/75 px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] whitespace-nowrap text-faint backdrop-blur-sm lg:bottom-4">
        ЛКМ — ВРАЩЕНИЕ · КОЛЕСО — МАСШТАБ · КЛИК ПО ПЛАНЕТЕ — ИССЛЕДОВАНИЕ
      </div>
    </div>
  );
}
