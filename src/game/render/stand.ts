// Stand: iki yan direk, tepede kiriş ve makaralar, altta koyu taban tepsisi,
// arkada destek bacakları. Çubuk: çukurlu metal ray, uçları kalkık.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { physics } from '../../config/physics';
import type { SceneTheme } from '../../config/theme';
import { sagDepth } from '../physics/bar';
import { BAR_Z, GROUND_Y, LEAN, S, matte } from './common';

export const POST_X = 5.42;
const POST_W = 0.44;

export interface StandParts {
  /** Stand düzleminde (yatık grup içinde) */
  local: THREE.Group;
  /** Dünya koordinatında (destek bacakları) */
  world: THREE.Group;
  topY: number;
  pulleyL: THREE.Vector3;
  pulleyR: THREE.Vector3;
  materials: { light: THREE.MeshStandardMaterial; dark: THREE.MeshStandardMaterial; base: THREE.MeshStandardMaterial; baseTop: THREE.MeshStandardMaterial };
}

/** İki nokta arasında silindir */
export function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material, radial = 10): THREE.Mesh {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, radial), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

export function buildStand(levelTop: number, theme: SceneTheme): StandParts {
  const local = new THREE.Group();
  const world = new THREE.Group();
  const light = matte(theme.standLight, { roughness: 0.75, emissive: theme.standLight, emissiveIntensity: 0.22 });
  const dark = matte(theme.standDark, { roughness: 0.8, emissive: theme.standDark, emissiveIntensity: 0.18 });
  const base = matte(theme.base, { roughness: 0.9 });
  const baseTop = matte(theme.baseTop, { roughness: 0.9 });

  const topY = levelTop * S + 1.7;
  const bottomY = -0.75;
  const postH = topY - bottomY;
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new RoundedBoxGeometry(POST_W, postH, POST_W, 3, 0.08), light);
    post.position.set(sx * POST_X, bottomY + postH / 2, -0.05);
    local.add(post);
  }
  const beam = new THREE.Mesh(new RoundedBoxGeometry(POST_X * 2 + 0.7, 0.52, 0.44, 3, 0.12), light);
  beam.position.set(0, topY, -0.05);
  local.add(beam);

  // Makaralar
  const pulleyMat = matte('#ECE6DE', { roughness: 0.6 });
  const rimMat = matte('#B9AFA4', { roughness: 0.6 });
  const hubMat = matte('#9E948A', { roughness: 0.5, metalness: 0.2 });
  const pulleys: THREE.Vector3[] = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.Group();
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.14, 28), pulleyMat);
    wheel.rotation.x = Math.PI / 2;
    g.add(wheel);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 32), rimMat);
    rim.position.z = 0.07;
    g.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.18, 14), hubMat);
    hub.rotation.x = Math.PI / 2;
    g.add(hub);
    g.position.set(sx * POST_X, topY, 0.26);
    local.add(g);
    pulleys.push(g.position.clone());
  }

  // Taban tepsisi (parkurun arkasında)
  const tray = new THREE.Mesh(new RoundedBoxGeometry(POST_X * 2 + 1.4, 0.5, 1.6, 3, 0.12), base);
  tray.position.set(0, -0.72, -0.86);
  local.add(tray);
  const lip = new THREE.Mesh(new RoundedBoxGeometry(POST_X * 2 + 1.3, 0.12, 1.5, 2, 0.05), baseTop);
  lip.position.set(0, -0.44, -0.86);
  local.add(lip);

  // Destek bacakları (dünya koordinatında, yere iner)
  const rot = new THREE.Matrix4().makeRotationX(-LEAN);
  for (const sx of [-1, 1]) {
    const top = new THREE.Vector3(sx * (POST_X - 0.15), topY - 0.25, -0.25).applyMatrix4(rot);
    const foot = new THREE.Vector3(sx * (POST_X - 1.1), GROUND_Y, top.z - Math.max(3, (topY + 1) * 0.36));
    const leg = rod(top, foot, 0.14, dark);
    world.add(leg);
  }

  local.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  world.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return { local, world, topY, pulleyL: pulleys[0], pulleyR: pulleys[1], materials: { light, dark, base, baseTop } };
}

export function applyStandTheme(p: StandParts, theme: SceneTheme): void {
  p.materials.light.color.set(theme.standLight);
  p.materials.light.emissive.set(theme.standLight);
  p.materials.dark.color.set(theme.standDark);
  p.materials.dark.emissive.set(theme.standDark);
  p.materials.base.color.set(theme.base);
  p.materials.baseTop.color.set(theme.baseTop);
}

/** Metal çubuk. Geometri tahta genişliği için üretilir, eğim ile x yönünde ölçeklenir. */
export class BarView {
  readonly group = new THREE.Group();
  private mesh: THREE.Mesh;
  private strings: THREE.Mesh[] = [];
  private stringMat = matte('#C9AE84', { roughness: 0.9 });
  readonly wallH: number;

  constructor(
    private width: number,
    envMap: THREE.Texture | null,
    ghost = false,
    private pulleys?: [THREE.Vector3, THREE.Vector3],
  ) {
    const Wl = width * S;
    const t = 0.085;
    const D = physics.sagRatio * physics.ballRadius * 2 * S;
    const H = physics.ballRadius * 2 * 0.62 * S;
    const pts: THREE.Vector3[] = [];
    pts.push(new THREE.Vector3(-t, H, 0), new THREE.Vector3(-t, H * 0.45, 0), new THREE.Vector3(-t * 0.85, 0.02, 0));
    for (let i = 1; i < 40; i++) {
      const s = i / 40;
      pts.push(new THREE.Vector3(s * Wl, -sagDepth(s, D) - t, 0));
    }
    pts.push(new THREE.Vector3(Wl + t * 0.85, 0.02, 0), new THREE.Vector3(Wl + t, H * 0.45, 0), new THREE.Vector3(Wl + t, H, 0));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const geo = new THREE.TubeGeometry(curve, 220, t, 10, false);
    const mat = ghost
      ? new THREE.MeshStandardMaterial({ color: '#C9C2E6', transparent: true, opacity: 0.35, depthWrite: false, roughness: 0.5 })
      : new THREE.MeshStandardMaterial({ color: '#B9C1C8', roughness: 0.3, metalness: 0.65, envMap, envMapIntensity: 0.55 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = !ghost;
    this.group.add(this.mesh);
    // Uç kapakları
    if (!ghost) {
      for (const x of [-t, Wl + t]) {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(t * 1.05, 12, 8), mat);
        cap.position.set(x, H, 0);
        cap.castShadow = true;
        this.mesh.add(cap);
      }
    }
    this.wallH = H;
    if (pulleys && !ghost) {
      for (let i = 0; i < 4; i++) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 6), this.stringMat);
        m.castShadow = true;
        this.strings.push(m);
      }
    }
  }

  /** Çubuk ipleri stand grubuna eklenmeli */
  get stringMeshes(): THREE.Mesh[] {
    return this.strings;
  }

  update(yL: number, yR: number): void {
    const W = this.width;
    const dy = yR - yL;
    const len = Math.hypot(W, dy);
    this.group.position.set(-W * S * 0.5, yL * S, BAR_Z);
    this.group.rotation.z = Math.atan2(dy, W);
    this.mesh.scale.x = len / W;
    // Makaradan çubuk ucuna inen ince ipler
    if (this.pulleys && this.strings.length) {
      const ends = [yL, yR];
      for (let i = 0; i < 2; i++) {
        const p = this.pulleys[i];
        const sx = i === 0 ? -1 : 1;
        const endY = ends[i] * S + this.wallH;
        const a = new THREE.Vector3(p.x + sx * 0.05, p.y - 0.3, 0.3);
        const b = new THREE.Vector3(p.x + sx * 0.05, endY + 0.12, 0.3);
        const c = new THREE.Vector3(sx * (W * S * 0.5 + 0.08), endY, BAR_Z);
        this.placeRod(this.strings[i * 2], a, b);
        this.placeRod(this.strings[i * 2 + 1], b, c);
      }
    }
  }

  private placeRod(m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3): void {
    const len = Math.max(0.001, a.distanceTo(b));
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.scale.set(1, len, 1);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  }
}
