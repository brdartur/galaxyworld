import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { CONSTELLATIONS } from "./SolarCanvas";
import { getTexture } from "../lib/textures";

import { orbitRadius3D } from '../lib/orbitLayout';
import { boxIntersectsPolygon, type ScreenPoint } from '../lib/screenGeometry';

const TAU = Math.PI * 2;

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

const COMET_COLORS = ["#8ff5e9", "#ff9ad5", "#ffd166", "#a5ff8f", "#9ecbff"];

/* ---------- радиальная текстура свечения ---------- */
function glowTex(color: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function FarLabel({ text, sub }: { text: string; sub?: string }) {
  return (
    <Html center zIndexRange={[20, 0]}>
      <div className="pointer-events-none rounded border border-line bg-space-900/85 px-2.5 py-1 text-center font-mono whitespace-nowrap backdrop-blur-sm">
        <div className="text-[10px] font-semibold tracking-[0.2em] text-ink/90">{text}</div>
        {sub && <div className="mt-0.5 text-[8px] tracking-[0.12em] text-faint">{sub}</div>}
      </div>
    </Html>
  );
}

/* ================= СОЗВЕЗДИЯ на небесной сфере ================= */
function Constellations() {
  const instances = useMemo(() => {
    const rnd = mulberry32(9090);
    return Array.from({ length: 48 }, (_, i) => {
      const c = CONSTELLATIONS[i % CONSTELLATIONS.length];
      const th = rnd() * TAU, ph = Math.acos(2 * rnd() - 1);
      const d = new THREE.Vector3(Math.sin(ph)*Math.cos(th),Math.cos(ph),Math.sin(ph)*Math.sin(th));
      const right = new THREE.Vector3().crossVectors(d,new THREE.Vector3(0,1,0));
      if(right.lengthSq()<.01)right.set(1,0,0); right.normalize();
      const up = new THREE.Vector3().crossVectors(right,d).normalize();
      const world = c.pts.map(([x,y])=>d.clone().multiplyScalar(640).addScaledVector(right,(x-.5)*170).addScaledVector(up,(.5-y)*170));
      const pts = new THREE.BufferGeometry().setFromPoints(world);
      const seg = new THREE.BufferGeometry().setFromPoints(c.seg.flatMap(([a,b])=>[world[a],world[b]]));
      return { world, pts, seg };
    });
  }, []);
  const pointMaterial = useMemo(()=>new THREE.PointsMaterial({color:'#d6e4ff',size:2.4,sizeAttenuation:false,transparent:true,opacity:.8,depthWrite:false,fog:false}),[]);
  const lineMaterial = useMemo(()=>new THREE.LineBasicMaterial({color:'#8fb0e8',transparent:true,opacity:.3,depthWrite:false,fog:false}),[]);
  const sky=useRef<THREE.Group>(null), groups=useRef<(THREE.Group|null)[]>([]);
  const temp=useMemo(()=>new THREE.Vector3(),[]);
  useEffect(()=>()=>{
    instances.forEach(i=>{i.pts.dispose();i.seg.dispose();});pointMaterial.dispose();lineMaterial.dispose();
  },[instances,pointMaterial,lineMaterial]);
  useFrame(({clock,camera,size},dt)=>{
    if(!sky.current)return;
    const t=clock.elapsedTime;
    pointMaterial.opacity=.72+.22*Math.sin(t*.6);lineMaterial.opacity=.3+.12*Math.sin(t*.45+1);
    sky.current.rotation.y+=dt*.0042;sky.current.rotation.x=Math.sin(t*.05)*.02;
    sky.current.updateMatrixWorld(true);
    const polygon: ScreenPoint[]=[];
    const r=orbitRadius3D(30.05)+4;
    for(let j=0;j<64;j++){
      const a=j*TAU/64;temp.set(Math.cos(a)*r,0,Math.sin(a)*r).project(camera);
      polygon.push([(temp.x+1)*size.width/2,(1-temp.y)*size.height/2]);
    }
    instances.forEach((inst,i)=>{
      let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity,visible=true;
      for(const p of inst.world){
        temp.copy(p).applyMatrix4(sky.current!.matrixWorld).project(camera);
        if(Math.abs(temp.z)>1){visible=false;break;}
        const x=(temp.x+1)*size.width/2,y=(1-temp.y)*size.height/2;
        left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      }
      // Hide the entire distant figure while its projection crosses the orbital disk.
      // It reappears as the sky rotates into open space; no severed lines inside the system.
      if(groups.current[i])groups.current[i]!.visible=visible&&!boxIntersectsPolygon({left:left-18,right:right+18,top:top-18,bottom:bottom+18},polygon);
    });
  });
  return <group ref={sky}>{instances.map((inst,i)=><group key={i} ref={g=>{groups.current[i]=g;}}>
    <points geometry={inst.pts} material={pointMaterial}/><lineSegments geometry={inst.seg} material={lineMaterial}/>
  </group>)}</group>;
}

/* ================= МЕТЕОРЫ + ЗВЕЗДОПАД ================= */
const N_METEORS = 30;
interface MeteorD { active: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number }
function Meteors() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const data = useRef<MeteorD[]>(Array.from({ length: N_METEORS }, () => ({ active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 0.8 })));
  const next = useRef(0.4);
  const nextShower = useRef(14);

  const spawn = (ox?: number, oy?: number, oz?: number) => {
    const m = data.current.find((q) => !q.active);
    if (!m) return;
    const rndDir = () => {
      const a = Math.random() * TAU;
      const r = 260 + Math.random() * 380;
      return [Math.cos(a) * r, (Math.random() - 0.25) * 240, Math.sin(a) * r] as const;
    };
    if (ox !== undefined && oy !== undefined && oz !== undefined) {
      m.x = ox; m.y = oy; m.z = oz;
    } else {
      const [x, y, z] = rndDir();
      m.x = x; m.y = y; m.z = z;
    }
    const a = Math.random() * TAU;
    const el = (Math.random() - 0.5) * 1.2;
    const sp = 200 + Math.random() * 220;
    m.vx = Math.cos(a) * Math.cos(el) * sp;
    m.vy = Math.sin(el) * sp * 0.6;
    m.vz = Math.sin(a) * Math.cos(el) * sp;
    m.age = 0;
    m.life = 0.65 + Math.random() * 0.45;
    m.active = true;
  };

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    next.current -= dt;
    if (next.current <= 0) {
      spawn();
      if (Math.random() < 0.3) spawn();
      next.current = 0.22 + Math.random() * 0.55;
    }
    nextShower.current -= dt;
    if (nextShower.current <= 0) {
      const a = Math.random() * TAU;
      const r = 320 + Math.random() * 260;
      const ox = Math.cos(a) * r, oy = (Math.random() - 0.3) * 200, oz = Math.sin(a) * r;
      for (let i = 0; i < 15; i++) spawn(ox + (Math.random() - 0.5) * 30, oy + (Math.random() - 0.5) * 16, oz + (Math.random() - 0.5) * 30);
      nextShower.current = 30 + Math.random() * 22;
    }
    const v = new THREE.Vector3();
    for (let i = 0; i < N_METEORS; i++) {
      const m = data.current[i];
      const mesh = refs.current[i];
      if (!mesh) continue;
      if (!m.active) {
        mesh.visible = false;
        continue;
      }
      m.age += dt;
      if (m.age > m.life) {
        m.active = false;
        mesh.visible = false;
        continue;
      }
      m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
      mesh.visible = true;
      mesh.position.set(m.x, m.y, m.z);
      v.set(m.x + m.vx, m.y + m.vy, m.z + m.vz);
      mesh.lookAt(v);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - m.age / m.life) * 0.9;
    }
  });

  return (
    <group>
      {Array.from({ length: N_METEORS }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          visible={false}
        >
          <boxGeometry args={[0.28, 0.28, 11]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
        </mesh>
      ))}
    </group>
  );
}

/* ================= ЧЁРНАЯ ДЫРА ================= */
export interface BHoleD { active: boolean; x: number; y: number; z: number; age: number; life: number }
function BlackHole({ bh }: { bh: React.MutableRefObject<BHoleD | null> }) {
  const grp = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const warm = useMemo(() => glowTex("rgba(255,190,110,0.9)"), []);
  const halo = useMemo(() => glowTex("rgba(126,92,210,0.55)"), []);
  const next = useRef(16);

  useFrame(({ clock }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    next.current -= dt;
    if ((!bh.current || !bh.current.active) && next.current <= 0) {
      const a = Math.random() * TAU;
      const r = 150 + Math.random() * 130;
      bh.current = { active: true, x: Math.cos(a) * r, y: (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 60), z: Math.sin(a) * r, age: 0, life: 20 };
      next.current = 34 + Math.random() * 20;
    }
    const b = bh.current;
    const g = grp.current;
    if (!g) return;
    if (!b || !b.active) {
      g.visible = false;
      return;
    }
    b.age += dt;
    if (b.age >= b.life) {
      b.active = false;
      g.visible = false;
      return;
    }
    const env = Math.min(1, b.age / 1.8, (b.life - b.age) / 2);
    g.visible = true;
    g.position.set(b.x, b.y, b.z);
    g.scale.setScalar(0.7 + env * 0.3);
    if (ring.current) ring.current.rotation.z = clock.elapsedTime * 0.4;
    const sm = (g.userData.glowMat as THREE.SpriteMaterial | undefined) ?? null;
    if (sm) sm.opacity = 0.6 * env;
  });

  return (
    <group
      ref={grp}
      visible={false}
      onUpdate={(self) => {
        const sp = self.children.find((c) => (c as THREE.Sprite).isSprite) as THREE.Sprite | undefined;
        if (sp) self.userData.glowMat = sp.material;
      }}
    >
      <mesh>
        <sphereGeometry args={[6, 32, 32]} />
        <meshBasicMaterial color="#01020a" fog={false} />
      </mesh>
      <sprite scale={[46, 46, 1]}>
        <spriteMaterial map={halo} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
      </sprite>
      <sprite scale={[26, 26, 1]}>
        <spriteMaterial map={warm} transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
      </sprite>
      <mesh ref={ring} rotation={[Math.PI / 2.3, 0, 0]}>
        <torusGeometry args={[10.5, 1.15, 12, 64]} />
        <meshBasicMaterial color="#ffca80" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
      </mesh>
      <Html center position={[0, 16, 0]} zIndexRange={[20, 0]}>
        <div className="pointer-events-none rounded border border-line bg-space-900/85 px-2.5 py-1 text-center font-mono whitespace-nowrap backdrop-blur-sm">
          <div className="text-[10px] font-semibold tracking-[0.2em] text-ink/90">ЧЁРНАЯ ДЫРА</div>
          <div className="mt-0.5 text-[8px] tracking-[0.12em] text-faint">звёздная · ~10 масс Солнца</div>
        </div>
      </Html>
    </group>
  );
}

/* ================= СВЕРХНОВЫЕ ================= */
function Novae() {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const data = useRef(Array.from({ length: 3 }, () => ({ active: false, age: 0 })));
  const next = useRef(10);
  const flash = useMemo(() => glowTex("rgba(255,240,220,1)"), []);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    next.current -= dt;
    if (next.current <= 0) {
      const n = data.current.find((q) => !q.active);
      const i = data.current.indexOf(n as (typeof data.current)[number]);
      if (n && i >= 0) {
        const a = Math.random() * TAU;
        const r = 300 + Math.random() * 280;
        const g = refs.current[i];
        if (g) g.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 260, Math.sin(a) * r);
        n.active = true;
        n.age = 0;
      }
      next.current = 22 + Math.random() * 18;
    }
    for (let i = 0; i < 3; i++) {
      const n = data.current[i];
      const g = refs.current[i];
      if (!g) continue;
      if (!n.active) {
        g.visible = false;
        continue;
      }
      n.age += dt;
      const k = n.age / 1.6;
      if (k > 1) {
        n.active = false;
        g.visible = false;
        continue;
      }
      g.visible = true;
      const core = g.children[0] as THREE.Sprite;
      const ringMesh = g.children[1] as THREE.Mesh;
      core.material.opacity = (1 - k) * 0.9;
      core.scale.setScalar(10 + k * 26);
      ringMesh.scale.setScalar(1 + k * 22);
      (ringMesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.6;
    }
  });

  return (
    <group>
      {Array.from({ length: 3 }, (_, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          visible={false}
        >
          <sprite scale={[10, 10, 1]}>
            <spriteMaterial map={flash} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
          </sprite>
          <mesh rotation={[Math.PI / 2.5, 0, 0]}>
            <ringGeometry args={[1.6, 2.1, 48]} />
            <meshBasicMaterial color="#ffe9c8" transparent opacity={0.6} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} fog={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ================= ПРОТОПЛАНЕТНЫЙ ДИСК ================= */
function ProtoDisk({ enabled }: { enabled: boolean }) {
  const grp = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const state = useRef({ active: false, age: 0, life: 26 });
  const next = useRef(8);
  const geo = useMemo(() => {
    const rnd = mulberry32(4242);
    const n = 260;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU;
      const r = 6 + rnd() * 11;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (rnd() - 0.5) * 0.8;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    next.current -= dt;
    if (!state.current.active && next.current <= 0) {
      const a = Math.random() * TAU;
      const r = 170 + Math.random() * 120;
      if (grp.current) grp.current.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 90, Math.sin(a) * r);
      state.current.active = true;
      state.current.age = 0;
      next.current = 46 + Math.random() * 20;
    }
    const g = grp.current;
    if (!g) return;
    if (!state.current.active) {
      g.visible = false;
      return;
    }
    state.current.age += dt;
    if (state.current.age > state.current.life) {
      state.current.active = false;
      g.visible = false;
      return;
    }
    g.visible = enabled;
    if (inner.current) inner.current.rotation.y += dt * 0.25;
  });

  return (
    <group ref={grp} visible={false} scale={2}>
      <group ref={inner}>
        <points geometry={geo}>
          <pointsMaterial color="#ffd9a0" size={0.5} sizeAttenuation transparent opacity={0.75} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
        </points>
      </group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5.6, 17.5, 64]} />
        <meshBasicMaterial color="#8a6f4d" transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} fog={false} />
      </mesh>
      <FarLabel text="ПРОТОПЛАНЕТНЫЙ ДИСК" sub="здесь рождаются планеты" />
    </group>
  );
}

/* ================= ГЛУБОКИЙ КОСМОС ================= */
/** процедурная спиральная галактика (балдж + два рукава) */
function galaxyTexture(seed: number): THREE.CanvasTexture {
  const S = 256;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  g.translate(S / 2, S / 2);
  const halo = g.createRadialGradient(0, 0, 0, 0, 0, S * 0.48);
  halo.addColorStop(0, "rgba(205,218,255,0.5)");
  halo.addColorStop(0.45, "rgba(150,172,235,0.16)");
  halo.addColorStop(1, "rgba(120,140,210,0)");
  g.fillStyle = halo;
  g.fillRect(-S / 2, -S / 2, S, S);
  const bulge = g.createRadialGradient(0, 0, 0, 0, 0, S * 0.15);
  bulge.addColorStop(0, "rgba(255,246,220,0.95)");
  bulge.addColorStop(1, "rgba(255,224,176,0)");
  g.fillStyle = bulge;
  g.fillRect(-S / 2, -S / 2, S, S);
  const rnd = mulberry32(seed);
  const tilt = 0.5 + rnd() * 0.28;
  for (let arm = 0; arm < 2; arm++) {
    for (let i = 0; i < 950; i++) {
      const t = i / 950;
      const ang = arm * Math.PI + t * 5.4 + (rnd() - 0.5) * 0.4;
      const r = Math.pow(t, 0.8) * S * 0.46;
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r * tilt;
      const a = (1 - t) * 0.5 + 0.05;
      const warm = rnd() < 0.28;
      g.fillStyle = warm ? `rgba(255,224,190,${(a * 0.8).toFixed(3)})` : `rgba(172,202,255,${a.toFixed(3)})`;
      const sz = 0.5 + rnd() * 1.4;
      g.fillRect(x, y, sz, sz);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** тонированная текстура для «планет-странников» */
function rogueTexture(id: string, tint: string): THREE.CanvasTexture {
  const t = getTexture(id);
  const cv = document.createElement("canvas");
  cv.width = t.w;
  cv.height = t.h;
  const g = cv.getContext("2d")!;
  const img = g.createImageData(t.w, t.h);
  const tr = parseInt(tint.slice(1, 3), 16);
  const tg = parseInt(tint.slice(3, 5), 16);
  const tb = parseInt(tint.slice(5, 7), 16);
  for (let i = 0; i < t.data.length; i += 4) {
    const l = (t.data[i] + t.data[i + 1] + t.data[i + 2]) / 3 / 255;
    img.data[i] = 18 + l * tr * 0.92;
    img.data[i + 1] = 20 + l * tg * 0.92;
    img.data[i + 2] = 26 + l * tb * 0.92;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** далёкий космос: галактики, скопления, облако Оорта, пояс обломков, планеты-странники, далёкая чёрная дыра */
export function DeepSpace() {
  const galaxyTexs = useMemo(() => Array.from({ length: 18 }, (_, i) => galaxyTexture(310 + i * 53)), []);
  const glowWarm = useMemo(() => glowTex("rgba(255,170,90,0.8)"), []);
  const dotTex = useMemo(() => glowTex("rgba(255,255,255,0.9)"), []);

  const galaxies = useMemo(() => {
    const rnd = mulberry32(9001);
    return Array.from({ length: 18 }, (_, i) => {
      const u = rnd() * 2 - 1;
      const ph = rnd() * TAU;
      const rr = 880 + rnd() * 560;
      const s = Math.sqrt(1 - u * u);
      return {
        pos: new THREE.Vector3(Math.cos(ph) * s * rr, u * rr * 0.65, Math.sin(ph) * s * rr),
        scale: 190 + rnd() * 330,
        rot: rnd() * TAU,
        op: 0.5 + rnd() * 0.35,
        tint: ["#cfe0ff", "#ffe9c9", "#d8e8ff", "#ffd9b0"][i % 4],
        spin: (rnd() - 0.5) * 0.05, // собственное вращение
        angVel: (rnd() - 0.5) * 0.006, // дрейф по небесной сфере
      };
    });
  }, []);
  const galRefs = useRef<(THREE.Sprite | null)[]>([]);
  const galState = useRef(galaxies.map(() => ({ ang: 0, rot: 0 })));

  const clustersGeo = useMemo(() => {
    const rnd = mulberry32(777001);
    const centers: [number, number, number][] = [
      [-640, 230, -560],
      [500, -280, -640],
      [160, 430, -720],
    ];
    const per = 340;
    const pos = new Float32Array(centers.length * per * 3);
    for (let c = 0; c < centers.length; c++) {
      for (let i = 0; i < per; i++) {
        const i3 = (c * per + i) * 3;
        const g3 = () => (rnd() + rnd() + rnd() - 1.5) * 1.9;
        pos[i3] = centers[c][0] + g3() * 30;
        pos[i3 + 1] = centers[c][1] + g3() * 24;
        pos[i3 + 2] = centers[c][2] + g3() * 30;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  const oortGeo = useMemo(() => {
    const rnd = mulberry32(555002);
    const n = 1500;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1;
      const ph = rnd() * TAU;
      const rr = 620 + rnd() * 170;
      const s = Math.sqrt(1 - u * u);
      pos[i * 3] = Math.cos(ph) * s * rr;
      pos[i * 3 + 1] = u * rr;
      pos[i * 3 + 2] = Math.sin(ph) * s * rr;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  const debrisGeo = useMemo(() => {
    const rnd = mulberry32(818181);
    const n = 300;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU;
      const rr = 340 + rnd() * 100;
      pos[i * 3] = Math.cos(a) * rr;
      pos[i * 3 + 1] = (rnd() - 0.5) * 16;
      pos[i * 3 + 2] = Math.sin(a) * rr;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  const rogueTexs = useMemo(() => {
    const ids = ["mars", "neptune", "mercury", "uranus", "venus", "jupiter"];
    const tints = ["#c96a4a", "#5478e8", "#9c8f7d", "#7fd4d9", "#e6c07a", "#d9a066"];
    return ids.map((id, i) => rogueTexture(id, tints[i]));
  }, []);
  const rogues = useMemo(() => {
    const rnd = mulberry32(424242);
    return rogueTexs.map(() => {
      const u = rnd() * 2 - 1;
      const ph = rnd() * TAU;
      const rr = 330 + rnd() * 420;
      const s = Math.sqrt(1 - u * u);
      return {
        pos: [Math.cos(ph) * s * rr, u * rr * 0.5, Math.sin(ph) * s * rr] as [number, number, number],
        r: 2.4 + rnd() * 3.2,
        spin: 0.05 + rnd() * 0.15,
      };
    });
  }, [rogueTexs]);

  const debrisRef = useRef<THREE.Points>(null);
  const rogueGroup = useRef<THREE.Group>(null);
  const rogueMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const tmpV = useRef(new THREE.Vector3());
  useFrame((_, dtRaw) => {
    const d = Math.min(dtRaw, 0.1);
    if (debrisRef.current) debrisRef.current.rotation.y += d * 0.004;
    if (rogueGroup.current) rogueGroup.current.rotation.y += d * 0.0018;
    for (let i = 0; i < rogueMeshes.current.length; i++) {
      const m2 = rogueMeshes.current[i];
      if (m2) m2.rotation.y += d * rogues[i].spin;
    }
    /* галактики: вращение + медленный дрейф */
    for (let i = 0; i < galaxies.length; i++) {
      const sp = galRefs.current[i];
      if (!sp) continue;
      const st = galState.current[i];
      const gl = galaxies[i];
      st.ang += gl.angVel * d;
      st.rot += gl.spin * d;
      tmpV.current.copy(gl.pos);
      const ca = Math.cos(st.ang);
      const sa = Math.sin(st.ang);
      sp.position.set(tmpV.current.x * ca + tmpV.current.z * sa, tmpV.current.y, -tmpV.current.x * sa + tmpV.current.z * ca);
      (sp.material as THREE.SpriteMaterial).rotation = gl.rot + st.rot;
    }
  });

  return (
    <group>
      {galaxies.map((gl, i) => (
        <sprite key={`gal${i}`} position={gl.pos} scale={[gl.scale, gl.scale, 1]}>
          <spriteMaterial
            map={galaxyTexs[i]}
            color={gl.tint}
            rotation={gl.rot}
            transparent
            opacity={gl.op}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            fog={false}
          />
        </sprite>
      ))}
      <points geometry={clustersGeo}>
        <pointsMaterial map={dotTex} color="#bcd4ff" size={3.4} sizeAttenuation={false} transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
      </points>
      <points geometry={oortGeo}>
        <pointsMaterial color="#93a7c9" size={1.15} sizeAttenuation={false} transparent opacity={0.28} depthWrite={false} fog={false} />
      </points>
      <points ref={debrisRef} geometry={debrisGeo} rotation={[0.32, 0, 0.18]}>
        <pointsMaterial color="#97a2b8" size={1.7} sizeAttenuation={false} transparent opacity={0.4} depthWrite={false} fog={false} />
      </points>
      <group ref={rogueGroup}>
        {rogues.map((rp, i) => (
          <mesh
            key={`rg${i}`}
            ref={(el) => {
              rogueMeshes.current[i] = el;
            }}
            position={rp.pos}
          >
            <sphereGeometry args={[rp.r, 28, 28]} />
            <meshStandardMaterial map={rogueTexs[i]} roughness={0.95} metalness={0} fog={false} />
          </mesh>
        ))}
      </group>
      {/* далёкая чёрная дыра */}
      <group position={[560, 150, -780]}>
        <mesh>
          <sphereGeometry args={[7, 32, 32]} />
          <meshBasicMaterial color="#04050c" fog={false} />
        </mesh>
        <mesh rotation={[1.25, 0, 0.35]}>
          <torusGeometry args={[12, 0.8, 12, 72]} />
          <meshBasicMaterial color="#ff9a4d" transparent opacity={0.45} blending={THREE.AdditiveBlending} fog={false} />
        </mesh>
        <mesh rotation={[1.25, 0, 0.35]}>
          <torusGeometry args={[15.5, 0.35, 10, 72]} />
          <meshBasicMaterial color="#9d7bff" transparent opacity={0.3} blending={THREE.AdditiveBlending} fog={false} />
        </mesh>
        <sprite scale={[70, 70, 1]}>
          <spriteMaterial map={glowWarm} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
        </sprite>
      </group>
    </group>
  );
}

/* ================= СБОРКА ================= */
export default function CosmicEvents3D({ showDisks }: { showDisks: boolean }) {
  const bh = useRef<BHoleD | null>(null);
  return (
    <group>
      <Constellations />
      <Meteors />
      <BlackHole bh={bh} />
      <Novae />
      <ProtoDisk enabled={showDisks} />
    </group>
  );
}
