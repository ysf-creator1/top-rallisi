// Top: yuvarlanan küre + üstüne giydirilen kostüm katmanları (tarif 7.2).
// Kostümler ayrı, dönmeyen bir grupta durur; böylece hepsi birlikte giyilebilir.

import * as THREE from 'three';
import type { BallType } from '../../config/physics';
import { COSTUME_COLORS, JERSEY_COLORS } from '../../config/shop';
import type { Costume } from '../../save/schema';
import { ballMaterial } from './ballSkins';
import { canvasTexture, makeCanvas, matte, starShape } from './common';

const SEG = 40;

function capGeo(r: number, thetaLen: number): THREE.SphereGeometry {
  return new THREE.SphereGeometry(r, 32, 12, 0, Math.PI * 2, 0, thetaLen);
}

function decalTexture(draw: (ctx: CanvasRenderingContext2D, s: number) => void): THREE.Texture {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d')!;
  draw(ctx, 128);
  return canvasTexture(c);
}

/** Yüzeye yapışık küçük daire (etiket, numara) */
function decal(R: number, size: number, dir: THREE.Vector3, tex: THREE.Texture): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(size, 32),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  const n = dir.clone().normalize();
  m.position.copy(n.clone().multiplyScalar(R * 1.004));
  m.lookAt(n.clone().multiplyScalar(R * 3));
  return m;
}

function iconPath(ctx: CanvasRenderingContext2D, kind: string, s: number): void {
  const c = s / 2;
  ctx.beginPath();
  if (kind === 'star') {
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? s * 0.4 : s * 0.17;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    }
    ctx.closePath();
  } else if (kind === 'heart') {
    ctx.moveTo(c, s * 0.8);
    ctx.bezierCurveTo(s * 0.1, s * 0.5, s * 0.15, s * 0.15, c, s * 0.32);
    ctx.bezierCurveTo(s * 0.85, s * 0.15, s * 0.9, s * 0.5, c, s * 0.8);
  } else if (kind === 'bolt') {
    ctx.moveTo(s * 0.56, s * 0.1);
    ctx.lineTo(s * 0.26, s * 0.55);
    ctx.lineTo(s * 0.48, s * 0.55);
    ctx.lineTo(s * 0.4, s * 0.9);
    ctx.lineTo(s * 0.74, s * 0.42);
    ctx.lineTo(s * 0.52, s * 0.42);
    ctx.closePath();
  } else if (kind === 'leaf') {
    ctx.moveTo(s * 0.2, s * 0.8);
    ctx.bezierCurveTo(s * 0.15, s * 0.3, s * 0.5, s * 0.12, s * 0.85, s * 0.15);
    ctx.bezierCurveTo(s * 0.85, s * 0.55, s * 0.6, s * 0.85, s * 0.2, s * 0.8);
  }
}

const STICKER_COLORS: Record<string, [string, string]> = {
  star: ['#F2C46D', '#DDA94B'],
  heart: ['#E8907E', '#C9685A'],
  bolt: ['#B3A3E0', '#8C7BC4'],
  leaf: ['#8CCFB4', '#5FA98A'],
};

function stickerMesh(R: number, kind: string): THREE.Mesh {
  const [fill, stroke] = STICKER_COLORS[kind] ?? STICKER_COLORS.star;
  const tex = decalTexture((ctx, s) => {
    ctx.fillStyle = '#FBF7F0';
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.48, 0, Math.PI * 2);
    ctx.fill();
    iconPath(ctx, kind, s);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = 'round';
    ctx.stroke();
  });
  return decal(R, R * 0.3, new THREE.Vector3(-0.5, 0.42, 0.76), tex);
}

function numberMesh(R: number, n: number): THREE.Mesh {
  const tex = decalTexture((ctx, s) => {
    ctx.fillStyle = '#FBF7F0';
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = s * 0.07;
    ctx.strokeStyle = '#E8907E';
    ctx.stroke();
    ctx.fillStyle = '#3B3F45';
    ctx.font = `600 ${n >= 10 ? s * 0.46 : s * 0.56}px Fredoka, Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), s / 2, s / 2 + s * 0.03);
  });
  return decal(R, R * 0.3, new THREE.Vector3(0.55, -0.08, 0.83), tex);
}

function hatMesh(R: number, kind: string): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'cap') {
    const col = '#8CCFB4';
    const dome = new THREE.Mesh(capGeo(R * 1.03, Math.PI * 0.4), matte(col));
    g.add(dome);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.62, R * 0.62, R * 0.06, 28, 1, false, 0, Math.PI), matte('#6FBF9E'));
    brim.position.set(R * 0.1, R * 0.32, R * 0.62);
    brim.rotation.set(0.22, Math.PI * 0.5 + 0.35, 0);
    g.add(brim);
    const btn = new THREE.Mesh(new THREE.SphereGeometry(R * 0.08, 12, 8), matte('#6FBF9E'));
    btn.position.y = R * 1.03;
    g.add(btn);
  } else if (kind === 'beanie') {
    const dome = new THREE.Mesh(capGeo(R * 1.06, Math.PI * 0.42), matte('#B3A3E0'));
    g.add(dome);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R * 0.98, R * 0.09, 10, 36), matte('#9C8AD0'));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = R * 0.27;
    g.add(rim);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(R * 0.2, 14, 10), matte('#F6F1E8'));
    pom.position.y = R * 1.1;
    g.add(pom);
  } else if (kind === 'straw') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.55, R * 1.6, R * 0.06, 36), matte('#E9C98A'));
    brim.position.y = R * 0.62;
    g.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.6, R * 0.72, R * 0.5, 28), matte('#EBCF95'));
    crown.position.y = R * 0.9;
    g.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.7, R * 0.73, R * 0.13, 28, 1, true), matte('#E8907E', { side: THREE.DoubleSide }));
    band.position.y = R * 0.73;
    g.add(band);
  } else if (kind === 'helmet') {
    const dome = new THREE.Mesh(capGeo(R * 1.08, Math.PI * 0.5), matte('#F2B7A9', { roughness: 0.45 }));
    g.add(dome);
    const stripe = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.09, 8, 16, Math.PI * 0.46, Math.PI * 0.08, 0, Math.PI * 0.5),
      matte('#FBF7F0', { roughness: 0.45 }),
    );
    g.add(stripe);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R * 1.07, R * 0.05, 8, 40), matte('#D88E7E'));
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
  } else if (kind === 'propeller') {
    const dome = new THREE.Mesh(capGeo(R * 1.03, Math.PI * 0.38), matte('#A8CDE8'));
    g.add(dome);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.04, R * 0.04, R * 0.35, 8), matte('#9AA2AA'));
    stick.position.y = R * 1.15;
    g.add(stick);
    const prop = new THREE.Group();
    prop.name = 'propeller';
    prop.position.y = R * 1.33;
    for (const [i, col] of ['#E8907E', '#F2C46D'].entries()) {
      const blade = new THREE.Mesh(new THREE.SphereGeometry(R * 0.3, 12, 6), matte(col));
      blade.scale.set(1, 0.12, 0.35);
      blade.position.x = (i === 0 ? 1 : -1) * R * 0.3;
      prop.add(blade);
    }
    g.add(prop);
  } else if (kind === 'crown') {
    const gold = matte('#F2C46D', { roughness: 0.35, metalness: 0.4 });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.62, R * 0.62, R * 0.25, 30, 1, true), gold);
    ring.material.side = THREE.DoubleSide;
    ring.position.y = R * 0.92;
    g.add(ring);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(R * 0.12, R * 0.3, 8), gold);
      spike.position.set(Math.cos(a) * R * 0.6, R * 1.18, Math.sin(a) * R * 0.6);
      g.add(spike);
      const gem = new THREE.Mesh(new THREE.SphereGeometry(R * 0.06, 8, 6), matte(i % 2 ? '#E8907E' : '#8CCFB4'));
      gem.position.set(Math.cos(a) * R * 0.63, R * 0.92, Math.sin(a) * R * 0.63);
      g.add(gem);
    }
  }
  g.rotation.z = -0.12;
  return g;
}

function glassesMesh(R: number, kind: string): THREE.Group {
  const g = new THREE.Group();
  const frameCol = kind === 'star' ? '#E8907E' : '#4A4F56';
  const frame = matte(frameCol, { roughness: 0.5 });
  const y = R * 0.18;
  const z = R * 0.95;
  for (const sx of [-1, 1]) {
    if (kind === 'star') {
      const st = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape(R * 0.28, R * 0.13), { depth: R * 0.04, bevelEnabled: false }), frame);
      st.position.set(sx * R * 0.3, y, z);
      g.add(st);
    } else {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.22, R * 0.045, 8, 28), frame);
      ring.position.set(sx * R * 0.3, y, z - R * 0.02);
      g.add(ring);
      if (kind === 'sun') {
        const lens = new THREE.Mesh(new THREE.CircleGeometry(R * 0.21, 24), matte('#3B3F45', { roughness: 0.2 }));
        lens.position.set(sx * R * 0.3, y, z - R * 0.025);
        g.add(lens);
      }
    }
  }
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.03, R * 0.03, R * 0.18, 6), frame);
  bridge.rotation.z = Math.PI / 2;
  bridge.position.set(0, y + R * 0.03, z);
  g.add(bridge);
  return g;
}

function jerseyMesh(R: number, kind: string): THREE.Group {
  const g = new THREE.Group();
  const cols = JERSEY_COLORS[kind] ?? JERSEY_COLORS.coral;
  if (kind === 'rainbow') {
    cols.forEach((c, i) => {
      const t0 = Math.PI * (0.6 + i * 0.045);
      g.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, SEG, 3, 0, Math.PI * 2, t0, Math.PI * 0.045), matte(c)));
    });
  } else {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, SEG, 3, 0, Math.PI * 2, Math.PI * 0.6, Math.PI * 0.08), matte(cols[0])));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, SEG, 3, 0, Math.PI * 2, Math.PI * 0.72, Math.PI * 0.06), matte(cols[0])));
  }
  return g;
}

export interface BallViewOptions {
  type: BallType;
  costume?: Costume;
  ghost?: boolean;
  radius: number;
}

export class BallView {
  readonly root = new THREE.Group();
  /** Yuvarlanan kısım */
  readonly roller: THREE.Mesh;
  readonly costumeGroup = new THREE.Group();
  private contour: THREE.Mesh;
  private propeller: THREE.Object3D | null = null;
  readonly radius: number;

  constructor(opts: BallViewOptions) {
    const R = opts.radius;
    this.radius = R;
    const c = opts.costume;
    const tint = c?.color ? COSTUME_COLORS[c.color] ?? null : null;
    this.roller = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), ballMaterial(opts.type, tint, opts.ghost));
    this.roller.castShadow = !opts.ghost;
    this.roller.receiveShadow = false;
    this.root.add(this.roller);

    this.contour = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.1, 32, 20),
      new THREE.MeshBasicMaterial({ color: '#3B3F45', side: THREE.BackSide }),
    );
    this.contour.visible = false;
    this.root.add(this.contour);

    if (c && !opts.ghost) {
      if (c.jersey) this.costumeGroup.add(jerseyMesh(R, c.jersey));
      if (c.sticker) this.costumeGroup.add(stickerMesh(R, c.sticker));
      if (c.number != null) this.costumeGroup.add(numberMesh(R, c.number));
      if (c.glasses) this.costumeGroup.add(glassesMesh(R, c.glasses));
      if (c.hat) {
        const h = hatMesh(R, c.hat);
        this.costumeGroup.add(h);
        this.propeller = h.getObjectByName('propeller') ?? null;
      }
      this.costumeGroup.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = true;
      });
    }
    this.root.add(this.costumeGroup);
  }

  setContour(on: boolean): void {
    this.contour.visible = on;
  }

  /** roll: toplam dönme açısı (radyan) */
  update(x: number, y: number, z: number, roll: number, scale: number, time: number): void {
    this.root.position.set(x, y, z);
    this.roller.rotation.z = -roll;
    this.root.scale.setScalar(Math.max(0.001, scale));
    this.root.visible = scale > 0.01;
    if (this.propeller) this.propeller.rotation.y = time * 14;
  }
}
