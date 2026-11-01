// Halat: makaradan ekran kenarına kıvrılıp dikey inen, bükülmüş lif dokulu tüp;
// ucunda topak düğüm ve açılmış lif uçları. Geometri her karede yerinde güncellenir.
// Tutulan nokta parmağın altında kalır, orada halat hafifçe sıkışır.

import * as THREE from 'three';
import { canvasTexture, makeCanvas } from './common';

const RADIAL = 10;
const MAX_PTS = 64;
/** Halat yarıçapı (oyun testinden sonra ~2 kat kalınlaştırıldı) */
export const ROPE_R = 0.19;

let ropeTex: THREE.CanvasTexture | null = null;

export function ropeTexture(): THREE.CanvasTexture {
  if (ropeTex) return ropeTex;
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#D2B486';
  ctx.fillRect(0, 0, 64, 64);
  // Çapraz bükülmüş lifler: köşegen şeritler (sarmal görünüm)
  ctx.save();
  ctx.translate(32, 32);
  ctx.rotate(-Math.PI / 4.2);
  for (let i = -6; i < 6; i++) {
    const y = i * 16;
    ctx.fillStyle = '#A9885A';
    ctx.fillRect(-64, y, 128, 6);
    ctx.fillStyle = '#F0E2C6';
    ctx.fillRect(-64, y + 9, 128, 2.4);
    ctx.fillStyle = 'rgba(160,130,90,0.35)';
    ctx.fillRect(-64, y + 12.5, 128, 1);
  }
  ctx.restore();
  ropeTex = canvasTexture(c);
  ropeTex.wrapS = ropeTex.wrapT = THREE.RepeatWrapping;
  return ropeTex;
}

export interface RopeState {
  /** Makara merkezi (stand yerel) */
  pulley: THREE.Vector3;
  /** Dikey kısmın x'i */
  x: number;
  /** Düğümün y'si */
  knotY: number;
  /** Tutulan nokta (yoksa null) */
  gripY: number | null;
  /** Liflerin kayması */
  scroll: number;
  /** -1 sol, +1 sağ */
  side: number;
  z: number;
}

export class RopeView {
  readonly group = new THREE.Group();
  private geo: THREE.BufferGeometry;
  private pos: Float32Array;
  private nor: Float32Array;
  private uv: Float32Array;
  private mat: THREE.MeshStandardMaterial;
  private knot: THREE.Group;
  private pts: THREE.Vector3[] = [];
  private grip = 0;

  constructor() {
    const tex = ropeTexture().clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, 1);
    this.mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 });
    const vCount = MAX_PTS * (RADIAL + 1);
    this.pos = new Float32Array(vCount * 3);
    this.nor = new Float32Array(vCount * 3);
    this.uv = new Float32Array(vCount * 2);
    const idx: number[] = [];
    for (let i = 0; i < MAX_PTS - 1; i++) {
      for (let j = 0; j < RADIAL; j++) {
        const a = i * (RADIAL + 1) + j;
        const b = a + RADIAL + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    this.geo.setIndex(idx);
    const mesh = new THREE.Mesh(this.geo, this.mat);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    this.group.add(mesh);
    this.knot = this.buildKnot();
    this.group.add(this.knot);
    for (let i = 0; i < MAX_PTS; i++) this.pts.push(new THREE.Vector3());
  }

  private buildKnot(): THREE.Group {
    const g = new THREE.Group();
    const tex = ropeTexture().clone();
    tex.needsUpdate = true;
    tex.repeat.set(2, 1);
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), m);
    body.scale.set(1, 1.15, 0.9);
    g.add(body);
    // Sarım bantları
    const bandMat = new THREE.MeshStandardMaterial({ color: '#A98B5F', roughness: 1 });
    for (const [y, s] of [[0.16, 0.86], [0, 1], [-0.16, 0.86]] as const) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.29 * s, 0.025, 6, 24), bandMat);
      band.rotation.x = Math.PI / 2 + 0.25;
      band.position.y = y;
      g.add(band);
    }
    // Kuyruk ve açılmış lif uçları
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.36, 10), m);
    tail.position.y = -0.48;
    g.add(tail);
    const fray = new THREE.MeshStandardMaterial({ color: '#C9AE84', roughness: 1 });
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.2, 5), fray);
      const a = (i - 2) * 0.22;
      f.position.set(Math.sin(a) * 0.09, -0.74, Math.cos(a * 3) * 0.02);
      f.rotation.z = -a;
      g.add(f);
    }
    g.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
    // Düğüm kalın halata uysun diye büyütülür
    g.scale.setScalar(1.75);
    return g;
  }

  update(s: RopeState, dt: number): void {
    const { pulley: P, x, knotY, side: sx, z } = s;
    const pts = this.pts;
    let n = 0;
    const push = (px: number, py: number) => {
      if (n < MAX_PTS) pts[n++].set(px, py, z);
    };
    // Makaranın üstünden dışa doğru yay
    const pr = 0.36 + ROPE_R * 0.5;
    for (let i = 0; i <= 5; i++) {
      const a = Math.PI / 2 - (i / 5) * (Math.PI / 2);
      push(P.x + sx * Math.cos(a) * pr, P.y + Math.sin(a) * pr);
    }
    // Makaradan ekran kenarına kıvrılan kısım
    const x0 = P.x + sx * pr;
    const yTop = P.y;
    const drop = Math.min(1.6, Math.max(0.6, Math.abs(x - x0) * 1.2));
    const y1 = Math.max(knotY + 0.6, yTop - drop);
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      const mt = 1 - t;
      const bx = mt * mt * mt * x0 + 3 * mt * mt * t * x0 + 3 * mt * t * t * x + t * t * t * x;
      const by = mt * mt * mt * yTop + 3 * mt * mt * t * (yTop - drop * 0.5) + 3 * mt * t * t * (y1 + drop * 0.2) + t * t * t * y1;
      push(bx, by);
    }
    // Dikey iniş: tutma noktası çevresinde sık nokta (sıkışma için)
    const ys: number[] = [];
    const span = y1 - knotY;
    for (let i = 1; i <= 8; i++) ys.push(y1 - (span * i) / 8);
    if (s.gripY !== null && s.gripY < y1 && s.gripY > knotY) {
      for (const d of [-0.35, -0.18, -0.08, 0, 0.08, 0.18, 0.35]) {
        const yy = s.gripY + d;
        if (yy < y1 && yy > knotY) ys.push(yy);
      }
    }
    ys.sort((a, b) => b - a);
    for (const yy of ys) push(x, yy);

    // Sıkışma yumuşak açılıp kapansın
    this.grip += ((s.gripY !== null ? 1 : 0) - this.grip) * Math.min(1, dt * 14);
    const gripY = s.gripY ?? 0;

    // Halka köşeleri
    let arc = 0;
    const tan = new THREE.Vector3();
    const nrm = new THREE.Vector3();
    const Z = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < MAX_PTS; i++) {
      const pi = pts[Math.min(i, n - 1)];
      if (i > 0 && i < n) arc += pi.distanceTo(pts[i - 1]);
      const a = pts[Math.max(0, Math.min(i, n - 1) - 1)];
      const b = pts[Math.min(n - 1, Math.min(i, n - 1) + 1)];
      tan.subVectors(b, a).normalize();
      nrm.crossVectors(tan, Z).normalize();
      let r = ROPE_R;
      if (this.grip > 0.01 && i < n) {
        const dd = (pi.y - gripY) / 0.22;
        r *= 1 - 0.28 * this.grip * Math.exp(-dd * dd) * (Math.abs(pi.x - x) < 0.01 ? 1 : 0);
      }
      for (let j = 0; j <= RADIAL; j++) {
        const ang = (j / RADIAL) * Math.PI * 2;
        const c = Math.cos(ang);
        const sn = Math.sin(ang);
        const k = (i * (RADIAL + 1) + j) * 3;
        const nx = nrm.x * c + Z.x * sn;
        const ny = nrm.y * c + Z.y * sn;
        const nz = nrm.z * c + Z.z * sn;
        this.pos[k] = pi.x + nx * r;
        this.pos[k + 1] = pi.y + ny * r;
        this.pos[k + 2] = pi.z + nz * r;
        this.nor[k] = nx;
        this.nor[k + 1] = ny;
        this.nor[k + 2] = nz;
        const u = (i * (RADIAL + 1) + j) * 2;
        this.uv[u] = j / RADIAL;
        this.uv[u + 1] = arc / (Math.PI * 2 * ROPE_R) + s.scroll;
      }
    }
    this.geo.setDrawRange(0, (n - 1) * RADIAL * 6);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.normal as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.uv as THREE.BufferAttribute).needsUpdate = true;
    this.knot.position.set(x, knotY - 0.2, z);
    this.knot.rotation.y = s.scroll * 2;
  }

  setVisible(v: boolean): void {
    this.group.visible = v;
  }
}
