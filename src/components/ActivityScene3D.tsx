import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { PLANETS } from "../data/planets";
import { SUN_RADIUS_3D } from "../lib/orbitLayout";
import { SURFACE_ACTOR_SCALE, ROVER_PLANETS, type ActivitySettings } from "../lib/activitySettings";
import { drawMartianShip, drawRover, drawSolarActivity, drawSurfaceExplorer } from "../lib/activityDrawing";

interface Mission { mode: string; planetIdx: number; t: number }
interface Props {
  settings: ActivitySettings;
  showAstro: boolean;
  mission: MutableRefObject<Mission>;
  planets: MutableRefObject<Record<string, THREE.Group | null>>;
  time: MutableRefObject<number>;
}

// Reusable transparent illustration planes face the camera so tools, limbs and
// tethers remain legible when the user rotates the 3D system.
function ActivitySprite({ draw, place, size = 320 }: {
  draw: (ctx: CanvasRenderingContext2D) => void;
  place: (sprite: THREE.Sprite) => boolean;
  size?: number;
}) {
  const ref = useRef<THREE.Sprite>(null);
  const elapsed = useRef(1);
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = size * 2;
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [size]);
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.visible = place(ref.current);
    if (!ref.current.visible) return;
    elapsed.current += dt;
    if (elapsed.current < 1 / 30) return;
    elapsed.current = 0;
    const c = (texture.image as HTMLCanvasElement).getContext("2d")!;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, size * 2, size * 2);
    c.setTransform(2, 0, 0, 2, size, size);
    draw(c); texture.needsUpdate = true;
  });
  return <sprite ref={ref} renderOrder={12}>
    <spriteMaterial map={texture} transparent depthWrite={false} depthTest={false} toneMapped={false} />
  </sprite>;
}

export default function ActivityScene3D({ settings, showAstro, mission, planets, time }: Props) {
  const camera = useThree(s => s.camera);
  const viewportSize = useThree(s => s.size);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const explorerRadius = useRef(64);
  const roverRadius = useRef(64);
  const radius = (id: string) => {
    const p = PLANETS.find(p => p.id === id)!;
    return (0.24 + Math.sqrt(p.diameterKm / 142984) * 1.5) * 2 * .75 * (planets.current[id]?.scale.x ?? 1);
  };
  const onPlanet = (sprite: THREE.Sprite, id: string, drawingRadius: MutableRefObject<number>, minPixelScale: number) => {
    const planet = planets.current[id]; if (!planet) return false;
    const r = radius(id);
    const perspective = camera as THREE.PerspectiveCamera;
    const unitsPerPixel = 2 * camera.position.distanceTo(planet.position) * Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2)) / viewportSize.height;
    // Keep the explorer readable on Mercury as well as on the giant planets.
    const drawingUnit = Math.max(r / 64, unitsPerPixel * minPixelScale);
    drawingRadius.current = r / drawingUnit;
    sprite.position.copy(planet.position);
    direction.copy(camera.position).sub(sprite.position).normalize();
    sprite.position.addScaledVector(direction, r + .1);
    sprite.scale.setScalar(drawingUnit * 320);
    return true;
  };
  const roverId = () => ROVER_PLANETS[Math.floor(time.current / 18) % ROVER_PLANETS.length];
  return <>
    <ActivitySprite draw={c => drawSurfaceExplorer(c, explorerRadius.current, mission.current.t, settings, SURFACE_ACTOR_SCALE)} place={s =>
      showAstro && mission.current.mode === "explore" && onPlanet(s, PLANETS[mission.current.planetIdx].id, explorerRadius, viewportSize.width < 640 ? .45 : .65)} />
    <ActivitySprite draw={c => drawRover(c, roverRadius.current, time.current, SURFACE_ACTOR_SCALE)} place={s =>
      settings.rovers && time.current % 18 < 16 && onPlanet(s, roverId(), roverRadius, viewportSize.width < 640 ? .4 : .55)} />
    <ActivitySprite draw={c => drawSolarActivity(c, 72, time.current)} place={s => {
      if (!settings.solar) return false;
      direction.copy(camera.position).normalize(); s.position.copy(direction).multiplyScalar(SUN_RADIUS_3D + .1);
      s.scale.setScalar(SUN_RADIUS_3D / 72 * 320); return true;
    }} />
    <ActivitySprite draw={c => { c.scale(2, 2); drawMartianShip(c, time.current); }} place={s => {
      if (!settings.martian) return false;
      const phase = time.current % 34;
      if (phase > 28) return false;
      const distance = camera.position.length();
      s.position.set((- .52 + phase / 28 * 1.04) * distance, distance * .23, -distance).applyQuaternion(camera.quaternion).add(camera.position);
      s.scale.setScalar(distance * .34); return true;
    }} />
  </>;
}
