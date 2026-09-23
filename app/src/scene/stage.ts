import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { DeviceId, FinishId, MethodId, PackId, PlacementId } from '../data';
import { reducedMotion } from './motion';

interface FinishMaterial {
  color: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  anisotropy: number;
  /** Micro-surface: brushed metal streaks, soft-touch grain, or smooth. */
  surface: 'brushed' | 'grain' | 'smooth';
  /** Dark finishes get light markings, light finishes get dark ones. */
  dark: boolean;
}

export const FINISH_MAT: Record<FinishId, FinishMaterial> = {
  black: { color: '#1c1c1e', metalness: 0.15, roughness: 0.7, clearcoat: 0.1, clearcoatRoughness: 0.6, anisotropy: 0, surface: 'grain', dark: true },
  steel: { color: '#c3c7cb', metalness: 1, roughness: 0.36, clearcoat: 0, clearcoatRoughness: 0, anisotropy: 0.9, surface: 'brushed', dark: false },
  rose: { color: '#e6a28c', metalness: 1, roughness: 0.26, clearcoat: 0, clearcoatRoughness: 0, anisotropy: 0.5, surface: 'brushed', dark: false },
  olive: { color: '#4a5535', metalness: 0.35, roughness: 0.46, clearcoat: 0.6, clearcoatRoughness: 0.3, anisotropy: 0, surface: 'grain', dark: true },
  white: { color: '#f1ede5', metalness: 0, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06, anisotropy: 0, surface: 'smooth', dark: false },
};

export interface StageInput {
  device: DeviceId;
  finish: FinishId;
  engraving: string;
  pack: PackId;
  accent: string;
  smoke: [string, string];
  placement: PlacementId;
  method: MethodId;
  artwork: string | null;
}

export interface Stage {
  update(next: StageInput): void;
  /** Renders a fresh frame and returns it as a PNG data URL. */
  snapshot(): string;
  dispose(): void;
}

function fontsReady() {
  return document.fonts ? document.fonts.load('800 100px "Archivo"').catch(() => {}) : Promise.resolve();
}

/** Canvas text props that aren't in every browser; setting them is a no-op where unsupported. */
function setTextStyle(g: CanvasRenderingContext2D, letterSpacing: string, stretch: CanvasFontStretch) {
  try {
    g.fontStretch = stretch;
    g.letterSpacing = letterSpacing;
  } catch {
    /* unsupported */
  }
}

/** A studio "room" with coloured light panels, baked into a PMREM environment map. */
function envMap(renderer: THREE.WebGLRenderer, c1: string, c2: string) {
  const scene = new THREE.Scene();
  const disposables: { dispose(): void }[] = [];
  const room = new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: 0x0c0c0e, side: THREE.BackSide }));
  disposables.push(room.geometry, room.material);
  scene.add(room);
  const panel = (w: number, h: number, color: string, k: number, pos: [number, number, number]) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }),
    );
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    scene.add(m);
    disposables.push(m.geometry, m.material);
  };
  // Studio rig: big key softbox, narrow strip lights for crisp vertical highlights
  // on the metal, a top light, coloured rim/back panels, and a dim floor bounce.
  panel(6, 10, '#ffffff', 3.6, [-7, 3, 6]);
  panel(1.2, 12, '#ffffff', 6, [-4, 1, 8]);
  panel(4, 8, '#ffffff', 1.2, [7, 1, 6]);
  panel(14, 2, '#ffffff', 2.5, [0, 10, 0]);
  panel(1.5, 12, c1, 4, [8, 1, -3]);
  panel(10, 6, c2, 2.2, [-2, -1, -9]);
  panel(1, 10, '#ffffff', 3, [3.5, 0, 9]);
  panel(20, 20, '#d8cfc4', 0.18, [0, -8, 0]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  disposables.forEach((d) => d.dispose());
  return rt;
}

/** Fine random grain, used as a roughness/bump map for soft-touch coatings. */
function grainTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 205 + Math.random() * 50;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 6);
  return t;
}

/** Streaks running around the circumference, like lathe-brushed metal. */
function brushedTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgb(215,215,215)';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 3000; i++) {
    const v = 140 + Math.random() * 115;
    g.fillStyle = `rgba(${v},${v},${v},0.18)`;
    g.fillRect(Math.random() * 512 - 100, Math.random() * 512, 60 + Math.random() * 400, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 3);
  return t;
}

/** Lathe profile for a cylinder with rounded bottom (rb) and top (rt) edges. */
function roundedCyl(r: number, h: number, rb: number, rt: number, segs = 96) {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - rb + rb * Math.cos(a), rb + rb * Math.sin(a)));
  }
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - rt + rt * Math.cos(a), h - rt + rt * Math.sin(a)));
  }
  pts.push(new THREE.Vector2(0, h));
  return new THREE.LatheGeometry(pts, segs);
}

const lathe = (pts: [number, number][], segs = 96) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segs);

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  s.moveTo(-w + r, -h);
  s.lineTo(w - r, -h);
  s.absarc(w - r, -h + r, r, -Math.PI / 2, 0, false);
  s.lineTo(w, h - r);
  s.absarc(w - r, h - r, r, 0, Math.PI / 2, false);
  s.lineTo(-w + r, h);
  s.absarc(-w + r, h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-w, -h + r);
  s.absarc(-w + r, -h + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/**
 * Rounded-rectangle prism standing upright (Y up), with bevelled top and bottom
 * edges and smooth normals. `taper` narrows the top: [x, z] scale at the top.
 */
function pod(halfW: number, halfD: number, r: number, height: number, bevel: number, taper: [number, number] = [1, 1]) {
  const body = new THREE.ExtrudeGeometry(roundedRect(halfW - bevel * 0.6, halfD - bevel * 0.6, r), {
    depth: height - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.6, bevelSegments: 8, curveSegments: 32,
  });
  body.rotateX(-Math.PI / 2);
  body.translate(0, bevel, 0);
  body.deleteAttribute('normal');
  body.deleteAttribute('uv');
  const geo = mergeVertices(body, 1e-4);
  body.dispose();
  geo.clearGroups();
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / height;
    pos.setX(i, pos.getX(i) * (1 + (taper[0] - 1) * t));
    pos.setZ(i, pos.getZ(i) * (1 + (taper[1] - 1) * t));
    uv[i * 2] = Math.atan2(pos.getX(i), pos.getZ(i)) / (Math.PI * 2) + 0.5;
    uv[i * 2 + 1] = t;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

/** Helical thread, as a tube wound around the Y axis. */
class Helix extends THREE.Curve<THREE.Vector3> {
  r: number;
  h: number;
  turns: number;
  constructor(r: number, h: number, turns: number) {
    super();
    this.r = r;
    this.h = h;
    this.turns = turns;
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    const a = t * this.turns * Math.PI * 2;
    return target.set(Math.cos(a) * this.r, t * this.h, Math.sin(a) * this.r);
  }
}

function radialTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,0.85)');
  grd.addColorStop(0.45, 'rgba(0,0,0,0.35)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(-4, 6, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 1.6);
  rim.position.set(5, 2, -4);
  scene.add(rim);

  const finishMat = new THREE.MeshPhysicalMaterial();
  const grain = grainTex();
  const brushed = brushedTex();
  const plastic = new THREE.MeshPhysicalMaterial({ color: 0x0f0f11, roughness: 0.26, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12 });
  const silver = new THREE.MeshPhysicalMaterial({ color: 0xd8d8d8, metalness: 1, roughness: 0.2, roughnessMap: brushed, anisotropy: 0.6 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe2b561, metalness: 1, roughness: 0.22 });
  const gap = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.7 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.02, transmission: 1, thickness: 0.12, ior: 1.5, specularIntensity: 1 });
  // Oil is opaque-with-glow rather than transmissive: transmissive surfaces can't see
  // each other, so a transmissive oil would vanish behind the glass.
  const oil = new THREE.MeshPhysicalMaterial({ color: 0xd98a1c, emissive: 0x5a2600, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  const bubble = new THREE.MeshPhysicalMaterial({ color: 0xffe9b8, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.75 });
  const led = new THREE.MeshBasicMaterial({ color: 0xffffff });
  led.toneMapped = false;

  // Brand marking: white text on a tall canvas used as an alpha map (and bump map when embossed).
  const eCanvas = document.createElement('canvas');
  eCanvas.width = 256;
  eCanvas.height = 1024;
  const eTex = new THREE.CanvasTexture(eCanvas);
  eTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const engraveMat = new THREE.MeshPhysicalMaterial({
    alphaMap: eTex, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, roughness: 0.55, metalness: 0.3,
  });
  const fronts: THREE.Mesh[] = [], backs: THREE.Mesh[] = [];
  const decal = (grp: THREE.Group, m: THREE.Mesh) => {
    fronts.push(m);
    grp.add(m);
    const b = m.clone();
    b.rotation.y = Math.PI;
    backs.push(b);
    grp.add(b);
  };

  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    return m;
  };

  // All-in-one: flat-fronted rounded pod with a tapered mouthpiece.
  const aio = new THREE.Group();
  aio.add(mesh(pod(0.6, 0.3, 0.2, 3.7, 0.07), finishMat, 0, -2.2, 0));
  aio.add(mesh(pod(0.36, 0.17, 0.12, 0.05, 0.01), gap, 0, 1.48, 0));
  aio.add(mesh(pod(0.36, 0.17, 0.13, 0.62, 0.06, [0.78, 0.8]), plastic, 0, 1.52, 0));
  aio.add(mesh(new RoundedBoxGeometry(0.2, 0.02, 0.05, 2, 0.009), gap, 0, 2.135, 0));
  aio.add(mesh(new RoundedBoxGeometry(0.22, 0.022, 0.02, 2, 0.008), led, 0, -1.8, 0.3));
  aio.add(mesh(new RoundedBoxGeometry(0.16, 0.055, 0.02, 3, 0.026), gap, 0, -2.2, 0).rotateX(Math.PI / 2));
  decal(aio, mesh(new THREE.PlaneGeometry(0.4, 1.6), engraveMat, 0, -0.35, 0.302));

  // 510 cartridge: threaded base, finished sleeve, thick glass tank with oil, mouthpiece.
  const cart = new THREE.Group();
  cart.add(mesh(lathe([[0, 0], [0.15, 0], [0.17, 0.02], [0.17, 0.27], [0.21, 0.29], [0.21, 0.33], [0, 0.33]]), silver, 0, -2.26, 0));
  cart.add(mesh(new THREE.TubeGeometry(new Helix(0.172, 0.2, 5), 240, 0.014, 6), silver, 0, -2.21, 0));
  cart.add(mesh(roundedCyl(0.42, 1.5, 0.05, 0.03), finishMat, 0, -1.95, 0));
  cart.add(mesh(roundedCyl(0.41, 0.05, 0.01, 0.01), silver, 0, -0.45, 0));
  cart.add(mesh(lathe([[0.355, 0], [0.398, 0], [0.4, 0.004], [0.4, 1.546], [0.398, 1.55], [0.357, 1.55], [0.355, 1.546], [0.355, 0.004], [0.355, 0]]), glass, 0, -0.4, 0));
  cart.add(mesh(lathe([[0, 0], [0.35, 0], [0.35, 1.12], [0.3, 1.095], [0.18, 1.083], [0, 1.08]], 64), oil, 0, -0.4, 0));
  cart.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.55, 32), silver, 0, 0.375, 0));
  cart.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.125, 16).rotateZ(Math.PI / 2), gap, 0, -0.22, 0));
  cart.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.125, 16).rotateX(Math.PI / 2), gap, 0, -0.22, 0));
  cart.add(mesh(new THREE.SphereGeometry(0.03, 16, 12), bubble, 0.25, 0.1, 0.25));
  cart.add(mesh(new THREE.SphereGeometry(0.018, 16, 12), bubble, -0.2, 0.4, 0.29));
  cart.add(mesh(new THREE.SphereGeometry(0.024, 16, 12), bubble, 0.06, -0.12, 0.345));
  cart.add(mesh(roundedCyl(0.42, 0.12, 0.02, 0.03), finishMat, 0, 1.15, 0));
  cart.add(mesh(lathe([[0, 0], [0.36, 0], [0.36, 0.08], [0.33, 0.35], [0.27, 0.7], [0.2, 0.86], [0.12, 0.9], [0, 0.9]]), finishMat, 0, 1.27, 0));
  cart.add(mesh(new THREE.CircleGeometry(0.06, 32).rotateX(-Math.PI / 2), gap, 0, 2.172, 0));
  {
    const L = 0.325 / 0.425;
    decal(cart, mesh(new THREE.CylinderGeometry(0.4245, 0.4245, 1.3, 48, 1, true, -L / 2, L), engraveMat, 0, -1.2, 0));
  }

  // Rechargeable battery: rounded tube, 510 connector with gold pin, fire button, USB-C.
  const batt = new THREE.Group();
  batt.add(mesh(roundedCyl(0.34, 3.62, 0.07, 0.02), finishMat, 0, -2.22, 0));
  batt.add(mesh(lathe([[0, 0], [0.335, 0], [0.335, 0.03], [0.32, 0.05], [0.21, 0.06], [0.2, 0.08], [0.2, 0.26], [0.19, 0.27], [0.15, 0.27], [0.15, 0.2], [0, 0.2]]), silver, 0, 1.4, 0));
  for (let i = 0; i < 3; i++) batt.add(mesh(new THREE.TorusGeometry(0.2, 0.006, 8, 64).rotateX(Math.PI / 2), gap, 0, 1.52 + i * 0.05, 0));
  batt.add(mesh(new THREE.CircleGeometry(0.15, 48).rotateX(-Math.PI / 2), gap, 0, 1.601, 0));
  batt.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 24), gold, 0, 1.625, 0));
  batt.add(mesh(new THREE.TorusGeometry(0.125, 0.018, 16, 48), silver, 0, 0.8, 0.335));
  batt.add(mesh(new THREE.CylinderGeometry(0.1, 0.105, 0.05, 40).rotateX(Math.PI / 2), silver, 0, 0.8, 0.34));
  batt.add(mesh(new THREE.TorusGeometry(0.148, 0.008, 12, 48), led, 0, 0.8, 0.33));
  batt.add(mesh(new RoundedBoxGeometry(0.17, 0.06, 0.04, 4, 0.028), gap, 0, -1.95, 0.33));
  batt.add(mesh(new RoundedBoxGeometry(0.11, 0.015, 0.02, 2, 0.007), silver, 0, -1.95, 0.342));
  {
    const L = 0.45 / 0.345;
    decal(batt, mesh(new THREE.CylinderGeometry(0.3445, 0.3445, 1.8, 48, 1, true, -L / 2, L), engraveMat, 0, -0.7, 0));
  }

  const devices: Record<DeviceId, THREE.Group> = { aio, cart, batt };
  const deviceRoot = new THREE.Group();
  deviceRoot.position.set(-0.75, 0, 0);
  Object.values(devices).forEach((g) => {
    g.visible = false;
    deviceRoot.add(g);
  });
  scene.add(deviceRoot);

  // Packaging
  const pCanvas = document.createElement('canvas');
  pCanvas.width = 600;
  pCanvas.height = 880;
  const pTex = new THREE.CanvasTexture(pCanvas);
  pTex.colorSpace = THREE.SRGBColorSpace;
  pTex.anisotropy = eTex.anisotropy;
  const sCanvas = document.createElement('canvas');
  sCanvas.width = sCanvas.height = 256;
  const sTex = new THREE.CanvasTexture(sCanvas);
  sTex.colorSpace = THREE.SRGBColorSpace;
  const boxFront = new THREE.MeshPhysicalMaterial({ map: pTex, roughness: 0.8 });
  const boxSide = new THREE.MeshPhysicalMaterial({ map: sTex, roughness: 0.8 });
  const box = new THREE.Mesh(new RoundedBoxGeometry(1.5, 2.2, 0.8, 4, 0.025), [boxSide, boxSide, boxSide, boxSide, boxFront, boxSide]);
  box.position.set(1.55, -1.15, -0.9);
  box.rotation.y = -0.42;
  scene.add(box);

  // Cast shadows from everything solid onto an invisible floor.
  const noShadow = new Set<THREE.Material>([engraveMat, led, glass, bubble]);
  [deviceRoot, box].forEach((root) => root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = !noShadow.has(o.material as THREE.Material);
  }));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.3 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.272;
  floor.receiveShadow = true;
  scene.add(floor);

  const shadowTex = radialTex();
  const shadow = (w: number, d: number, x: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.8 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, -2.27, z);
    scene.add(m);
    return m;
  };
  const devShadow = shadow(2.2, 1.2, -0.75, 0);
  shadow(2.8, 1.8, 1.55, -0.9);

  const state: {
    device: DeviceId | null; finish: FinishId | null; engraving: string; pack: PackId | null; accent: string;
    placement: PlacementId | null; method: MethodId | null; artwork: string | null; artImg: HTMLImageElement | null;
  } = { device: null, finish: null, engraving: '', pack: null, accent: '#ffffff', placement: null, method: null, artwork: null, artImg: null };
  let started = false;

  const applyPlacement = () => {
    const p = state.placement || 'front';
    fronts.forEach((m) => { m.visible = p !== 'back'; });
    backs.forEach((m) => { m.visible = p !== 'front'; });
  };

  const applyMethod = () => {
    if (!state.finish) return;
    const f = FINISH_MAT[state.finish];
    const m = state.method || 'engraved';
    engraveMat.bumpMap = null;
    engraveMat.clearcoat = 0;
    if (m === 'engraved') {
      // Contrasting etched tone.
      engraveMat.color.set(f.dark ? '#e6e0d4' : '#2a2724');
      engraveMat.metalness = f.dark ? 0.1 : 0.5;
      engraveMat.roughness = 0.62;
      engraveMat.opacity = 0.9;
    } else if (m === 'printed') {
      // Solid white or black ink.
      engraveMat.color.set(f.dark ? '#f7f5f0' : '#111113');
      engraveMat.metalness = 0;
      engraveMat.roughness = 0.35;
      engraveMat.opacity = 1;
      engraveMat.clearcoat = 0.4;
    } else {
      // Embossed: body colour with raised edges from the bump map.
      engraveMat.color.set(f.color).offsetHSL(0, 0, f.dark ? 0.06 : -0.04);
      engraveMat.metalness = f.metalness;
      engraveMat.roughness = Math.max(0.12, f.roughness * 0.7);
      engraveMat.opacity = 1;
      engraveMat.clearcoat = f.clearcoat;
      engraveMat.bumpMap = eTex;
      engraveMat.bumpScale = 4;
    }
    engraveMat.needsUpdate = true;
  };

  const drawEngraving = () => {
    const g = eCanvas.getContext('2d')!;
    g.clearRect(0, 0, 256, 1024);
    g.save();
    g.translate(128, 512);
    g.rotate(-Math.PI / 2);
    let size = 150;
    const set = () => {
      g.font = `800 ${size}px "Archivo", sans-serif`;
      setTextStyle(g, `${size * 0.14}px`, 'expanded');
    };
    set();
    const w = g.measureText(state.engraving).width;
    if (w > 860) {
      size = Math.floor((size * 860) / w);
      set();
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffffff';
    if (state.method === 'embossed') {
      g.shadowColor = 'rgba(255,255,255,0.9)';
      g.shadowBlur = 6;
    }
    g.fillText(state.engraving, 0, 0);
    g.restore();
    eTex.needsUpdate = true;
    applyMethod();
  };

  const drawPack = () => {
    const g = pCanvas.getContext('2d')!;
    const s = sCanvas.getContext('2d')!;
    const W = 600, H = 880;
    const text = state.engraving;
    const speckle = (ctx: CanvasRenderingContext2D, w: number, h: number, base: string, n: number, a: number) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '60,40,20' : '255,240,220'},${Math.random() * a})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
      }
    };
    const brand = (color: string, y: number, max = 440) => {
      let size = 72;
      const set = () => {
        g.font = `800 ${size}px "Archivo", sans-serif`;
        setTextStyle(g, `${size * 0.12}px`, 'expanded');
      };
      set();
      const w = g.measureText(text).width;
      if (w > max) {
        size = Math.floor((size * max) / w);
        set();
      }
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = color;
      g.fillText(text, W / 2, y);
    };
    const small = (color: string, y: number, str: string) => {
      g.font = '500 20px "Geist Mono", monospace';
      setTextStyle(g, '4px', 'normal');
      g.textAlign = 'center';
      g.fillStyle = color;
      g.fillText(str, W / 2, y);
    };

    if (state.pack === 'kraft') {
      speckle(g, W, H, '#b68a5c', 9000, 0.35);
      speckle(s, 256, 256, '#b68a5c', 1400, 0.35);
      g.fillStyle = '#18181a';
      g.fillRect(0, 0, W, 230);
      g.fillRect(0, H - 230, W, 230);
      s.fillStyle = '#18181a';
      s.fillRect(0, 0, 256, 67);
      s.fillRect(0, 189, 256, 67);
      brand('#2e1f12', H / 2 - 10);
      g.fillStyle = '#2e1f12';
      g.fillRect(W / 2 - 40, H / 2 + 50, 80, 3);
      boxFront.roughness = boxSide.roughness = 0.92;
      boxFront.clearcoat = boxSide.clearcoat = 0;
    } else if (state.pack === 'black') {
      g.fillStyle = '#121214';
      g.fillRect(0, 0, W, H);
      s.fillStyle = '#121214';
      s.fillRect(0, 0, 256, 256);
      g.strokeStyle = 'rgba(214,183,122,0.55)';
      g.lineWidth = 2;
      g.strokeRect(40, 40, W - 80, H - 80);
      brand('#d8b87c', H / 2);
      small('rgba(216,184,124,0.7)', H - 90, 'HARDWARE');
      boxFront.roughness = boxSide.roughness = 0.62;
      boxFront.clearcoat = boxSide.clearcoat = 0.3;
    } else {
      // Window box: light card with a dark window showing a silhouette of the device in its finish.
      g.fillStyle = '#eeeae3';
      g.fillRect(0, 0, W, H);
      s.fillStyle = '#eeeae3';
      s.fillRect(0, 0, 256, 256);
      const x = 110, y = 90, w = W - 220, h = 470, r = 28;
      const grd = g.createLinearGradient(x, y, x + w, y + h);
      grd.addColorStop(0, '#26262b');
      grd.addColorStop(1, '#101013');
      g.fillStyle = grd;
      g.beginPath();
      g.roundRect(x, y, w, h, r);
      g.fill();
      g.save();
      g.clip();
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.beginPath();
      g.moveTo(x + w * 0.55, y);
      g.lineTo(x + w * 0.8, y);
      g.lineTo(x + w * 0.3, y + h);
      g.lineTo(x + w * 0.05, y + h);
      g.fill();
      g.restore();
      g.fillStyle = state.finish ? FINISH_MAT[state.finish].color : '#888';
      g.beginPath();
      g.roundRect(W / 2 - 34, y + 60, 68, h - 120, 30);
      g.fill();
      brand('#1c1b1a', 680, 400);
      small('rgba(28,27,26,0.6)', 760, 'HARDWARE');
      boxFront.roughness = boxSide.roughness = 0.5;
      boxFront.clearcoat = boxSide.clearcoat = 0.4;
    }
    if (state.artImg) {
      // Uploaded artwork covers the whole front face.
      const img = state.artImg;
      const k = Math.max(W / img.width, H / img.height);
      const w = img.width * k, h = img.height * k;
      g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    }
    pTex.needsUpdate = true;
    sTex.needsUpdate = true;
  };

  let env: THREE.WebGLRenderTarget | null = null;
  let swapT = 1;
  let disposed = false;

  fontsReady().then(() => {
    if (!disposed && started) {
      drawEngraving();
      drawPack();
    }
  });

  // Interaction: drag to spin, with inertia and a slow idle turn.
  let rotY = -0.35, vel = 0, dragging = false, lastX = 0, idleAt = 0;
  canvas.style.touchAction = 'pan-y';
  canvas.style.cursor = 'grab';
  const onDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    vel = 0;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    rotY += dx * 0.012;
    vel = dx * 0.012;
  };
  const onEnd = () => {
    dragging = false;
    idleAt = performance.now();
    canvas.style.cursor = 'grab';
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onEnd);
  canvas.addEventListener('pointercancel', onEnd);

  const fit = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(5.4 / 2 / tanV, 5.2 / 2 / (tanV * camera.aspect)) * 1.08;
    camera.position.set(0.3, 0.9, dist);
    camera.lookAt(0.3, 0.05, 0);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(fit);
  ro.observe(canvas);
  fit();

  let visible = true;
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; });
  io.observe(canvas);

  let raf = 0, last = performance.now(), t = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible) return;
    t += dt;
    if (!dragging) {
      rotY += vel;
      vel *= Math.pow(0.04, dt);
      if (!reducedMotion.matches && now - idleAt > 2500) rotY += dt * 0.35;
    }
    // Device swap: a short twist, scale-up and settle.
    if (swapT < 1) swapT = Math.min(1, swapT + dt / 0.45);
    const e = 1 - Math.pow(1 - swapT, 3);
    deviceRoot.rotation.y = rotY - (1 - e) * 1.2;
    deviceRoot.scale.setScalar(0.88 + 0.12 * e);
    const bob = reducedMotion.matches ? 0 : Math.sin(t * 1.1) * 0.05;
    deviceRoot.position.y = bob + (1 - e) * 0.25;
    devShadow.material.opacity = 0.8 - bob * 2;
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);

  return {
    update(next) {
      const s = state;
      started = true;
      if (next.accent !== s.accent) {
        s.accent = next.accent;
        led.color.set(next.accent);
        rim.color.set(next.accent);
      }
      if (next.finish !== s.finish) {
        s.finish = next.finish;
        const f = FINISH_MAT[next.finish];
        finishMat.color.set(f.color);
        finishMat.metalness = f.metalness;
        finishMat.roughness = f.roughness;
        finishMat.clearcoat = f.clearcoat;
        finishMat.clearcoatRoughness = f.clearcoatRoughness;
        finishMat.anisotropy = f.anisotropy;
        finishMat.roughnessMap = f.surface === 'brushed' ? brushed : f.surface === 'grain' ? grain : null;
        finishMat.bumpMap = f.surface === 'grain' ? grain : null;
        finishMat.bumpScale = 0.5;
        finishMat.needsUpdate = true;
        env?.dispose();
        env = envMap(renderer, next.smoke[0], next.smoke[1]);
        scene.environment = env.texture;
        drawEngraving();
        drawPack();
      }
      if (next.engraving !== s.engraving) {
        s.engraving = next.engraving;
        drawEngraving();
        drawPack();
      }
      if (next.pack !== s.pack) {
        s.pack = next.pack;
        drawPack();
      }
      if (next.placement !== s.placement) {
        s.placement = next.placement;
        applyPlacement();
      }
      if (next.method !== s.method) {
        s.method = next.method;
        drawEngraving();
      }
      if (next.artwork !== s.artwork) {
        s.artwork = next.artwork;
        if (!s.artwork) {
          s.artImg = null;
          drawPack();
        } else {
          const img = new Image();
          const src = s.artwork;
          img.onload = () => {
            if (!disposed && s.artwork === src) {
              s.artImg = img;
              drawPack();
            }
          };
          img.src = src;
        }
      }
      if (next.device !== s.device) {
        s.device = next.device;
        (Object.keys(devices) as DeviceId[]).forEach((k) => { devices[k].visible = k === next.device; });
        swapT = reducedMotion.matches ? 1 : 0;
      }
    },
    snapshot() {
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/png');
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onEnd);
      canvas.removeEventListener('pointercancel', onEnd);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      [finishMat, plastic, silver, gold, gap, glass, oil, bubble, led, engraveMat, boxFront, boxSide, floor.material].forEach((m) => m.dispose());
      [eTex, pTex, sTex, shadowTex, grain, brushed].forEach((tx) => tx.dispose());
      env?.dispose();
      renderer.dispose();
    },
  };
}
