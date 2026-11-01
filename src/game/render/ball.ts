// Top: yuvarlanan küre + üstüne giydirilen kostüm katmanları (tarif 7.2).
// Kostümler ayrı, dönmeyen bir grupta durur; böylece hepsi birlikte giyilebilir.

import * as THREE from 'three';
import type { BallType } from '../../config/physics';
import { COSTUME_COLORS, JERSEY_COLORS } from '../../config/shop';
import type { Costume } from '../../save/schema';
import { ballMaterial } from './ballSkins';
import { canvasTexture, makeCanvas, matte, starShape } from './common';
import { isMagicSkin, magicSkin, skinExtra, skinMaterial, type MagicSkin } from './skins';

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

const NUMBER_STYLES: Record<string, { bg: string; ring: string; ink: string; glow?: string; square?: boolean }> = {
  number: { bg: '#FBF7F0', ring: '#E8907E', ink: '#3B3F45' },
  race: { bg: '#FBFBFB', ring: '#22252A', ink: '#22252A', square: true },
  neon: { bg: '#24283A', ring: '#4FE3F0', ink: '#7FF6FF', glow: '#4FE3F0' },
  gold: { bg: '#F4CF6A', ring: '#C99A2E', ink: '#5A3F10' },
};

function numberMesh(R: number, n: number, style: string): THREE.Mesh {
  const st = NUMBER_STYLES[style] ?? NUMBER_STYLES.number;
  const tex = decalTexture((ctx, s) => {
    ctx.fillStyle = st.bg;
    ctx.beginPath();
    if (st.square) ctx.roundRect(s * 0.1, s * 0.1, s * 0.8, s * 0.8, s * 0.12);
    else ctx.arc(s / 2, s / 2, s * 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = s * 0.07;
    ctx.strokeStyle = st.ring;
    ctx.stroke();
    if (st.glow) {
      ctx.shadowColor = st.glow;
      ctx.shadowBlur = s * 0.12;
    }
    ctx.fillStyle = st.ink;
    ctx.font = `${style === 'race' ? 800 : 600} ${n >= 10 ? s * 0.46 : s * 0.56}px Fredoka, Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), s / 2, s / 2 + s * 0.03);
  });
  const m = decal(R, R * 0.3, new THREE.Vector3(0.55, -0.08, 0.83), tex);
  if (style === 'gold') (m.material as THREE.MeshStandardMaterial).metalness = 0.35;
  if (style === 'neon') {
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.emissive = new THREE.Color('#FFFFFF');
    mat.emissiveMap = tex;
    mat.emissiveIntensity = 0.5;
  }
  return m;
}

/** Çizgili koni dokusu (parti şapkası, büyücü şapkası) */
function stripeTexture(a: string, b: string, n: number, stars = false): THREE.Texture {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? b : a;
    ctx.fillRect((i * 128) / n, 0, 128 / n + 1, 128);
  }
  if (stars) {
    ctx.fillStyle = '#F2C46D';
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.arc((i * 47) % 128, (i * 31) % 128, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return canvasTexture(c);
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
  } else if (kind === 'party') {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(R * 0.5, R * 1.1, 28, 1, true), new THREE.MeshStandardMaterial({ map: stripeTexture('#F2C46D', '#E8907E', 8), roughness: 0.8, side: THREE.DoubleSide }));
    cone.position.y = R * 1.25;
    g.add(cone);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(R * 0.14, 12, 8), matte('#8CCFB4'));
    pom.position.y = R * 1.82;
    g.add(pom);
    g.rotation.x = -0.15;
  } else if (kind === 'catears') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(R * 1.02, R * 0.05, 8, 40, Math.PI), matte('#F2B7A9'));
    band.rotation.y = Math.PI / 2;
    g.add(band);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(R * 0.26, R * 0.42, 4), matte('#F2B7A9'));
      ear.position.set(sx * R * 0.55, R * 0.98, 0);
      ear.rotation.z = -sx * 0.45;
      g.add(ear);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(R * 0.14, R * 0.26, 4), matte('#E8907E'));
      inner.position.set(sx * R * 0.53, R * 0.96, R * 0.1);
      inner.rotation.z = -sx * 0.45;
      g.add(inner);
    }
  } else if (kind === 'chef') {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.62, R * 0.62, R * 0.45, 28), matte('#FBFBFB'));
    band.position.y = R * 1.0;
    g.add(band);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(R * 0.36, 14, 10), matte('#FFFFFF'));
      puff.position.set(Math.cos(a) * R * 0.38, R * 1.42, Math.sin(a) * R * 0.38);
      g.add(puff);
    }
    const top = new THREE.Mesh(new THREE.SphereGeometry(R * 0.42, 14, 10), matte('#FFFFFF'));
    top.position.y = R * 1.55;
    g.add(top);
  } else if (kind === 'cowboy') {
    const brown = matte('#B07A4A');
    const pts = [
      new THREE.Vector2(R * 1.7, R * 0.82),
      new THREE.Vector2(R * 1.45, R * 0.66),
      new THREE.Vector2(R * 0.7, R * 0.68),
      new THREE.Vector2(R * 0.66, R * 1.2),
      new THREE.Vector2(R * 0.4, R * 1.32),
      new THREE.Vector2(R * 0.001, R * 1.24),
    ];
    const hat = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), brown);
    hat.material.side = THREE.DoubleSide;
    hat.scale.z = 0.8;
    g.add(hat);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.69, R * 0.7, R * 0.1, 28, 1, true), matte('#5A3E28', { side: THREE.DoubleSide }));
    band.position.y = R * 0.76;
    band.scale.z = 0.8;
    g.add(band);
  } else if (kind === 'santa') {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(R * 0.62, R * 1.1, 24), matte('#D9423B'));
    cone.position.set(R * 0.1, R * 1.25, 0);
    cone.rotation.z = -0.35;
    g.add(cone);
    const fur = new THREE.Mesh(new THREE.TorusGeometry(R * 0.66, R * 0.14, 10, 32), matte('#FFFFFF'));
    fur.rotation.x = Math.PI / 2;
    fur.position.y = R * 0.74;
    g.add(fur);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(R * 0.16, 12, 8), matte('#FFFFFF'));
    pom.position.set(R * 0.55, R * 1.72, 0);
    g.add(pom);
  } else if (kind === 'grad') {
    const black = matte('#2B2D31');
    const dome = new THREE.Mesh(capGeo(R * 1.03, Math.PI * 0.36), black);
    g.add(dome);
    const board = new THREE.Mesh(new THREE.BoxGeometry(R * 1.7, R * 0.06, R * 1.7), black);
    board.position.y = R * 1.0;
    board.rotation.y = Math.PI / 4;
    g.add(board);
    const btn = new THREE.Mesh(new THREE.SphereGeometry(R * 0.06, 8, 6), matte('#F2C46D'));
    btn.position.y = R * 1.05;
    g.add(btn);
    const tassel = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.035, R * 0.06, R * 0.5, 8), matte('#F2C46D'));
    tassel.position.set(R * 0.75, R * 0.8, R * 0.2);
    g.add(tassel);
  } else if (kind === 'tophat') {
    const black = matte('#26282C', { roughness: 0.55 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.05, R * 1.05, R * 0.06, 32), black);
    brim.position.y = R * 0.8;
    g.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.62, R * 0.58, R * 0.95, 32), black);
    crown.position.y = R * 1.28;
    g.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.6, R * 0.6, R * 0.16, 32, 1, true), matte('#C9423B', { side: THREE.DoubleSide }));
    band.position.y = R * 0.92;
    g.add(band);
  } else if (kind === 'pirate') {
    const black = matte('#26282C');
    const dome = new THREE.Mesh(capGeo(R * 1.04, Math.PI * 0.4), black);
    g.add(dome);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.0, R * 1.0, R * 0.1, 32, 1, false, 0, Math.PI), black);
    brim.scale.set(1.25, 1, 0.55);
    brim.rotation.set(Math.PI / 2 - 0.25, 0, 0);
    brim.position.set(0, R * 0.95, R * 0.12);
    g.add(brim);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(R * 1.0, R * 0.03, 6, 32, Math.PI), matte('#E9C46A'));
    trim.scale.set(1.25, 0.55, 1);
    trim.rotation.set(-0.25, 0, 0);
    trim.position.set(0, R * 0.95, R * 0.2);
    g.add(trim);
    const skull = new THREE.Mesh(new THREE.CircleGeometry(R * 0.16, 20), matte('#FBFBFB'));
    skull.position.set(0, R * 1.22, R * 0.56);
    skull.rotation.x = -0.25;
    g.add(skull);
  } else if (kind === 'wizard') {
    const blue = new THREE.MeshStandardMaterial({ map: stripeTexture('#4B5BA8', '#5767B8', 2, true), roughness: 0.85 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.25, R * 1.25, R * 0.05, 32), matte('#4B5BA8'));
    brim.position.y = R * 0.74;
    g.add(brim);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(R * 0.68, R * 1.7, 28), blue);
    cone.position.set(R * 0.08, R * 1.55, 0);
    cone.rotation.z = -0.12;
    g.add(cone);
  } else if (kind === 'viking') {
    const metal = matte('#9AA2AA', { roughness: 0.4, metalness: 0.5 });
    const dome = new THREE.Mesh(capGeo(R * 1.07, Math.PI * 0.45), metal);
    g.add(dome);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R * 1.0, R * 0.07, 8, 40), matte('#B5884E'));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = R * 0.18;
    g.add(rim);
    for (const sx of [-1, 1]) {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(sx * R * 0.85, R * 0.55, 0),
        new THREE.Vector3(sx * R * 1.55, R * 0.7, 0),
        new THREE.Vector3(sx * R * 1.45, R * 1.45, 0),
      );
      const horn = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, R * 0.11, 10, false), matte('#F3E9D6'));
      g.add(horn);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(R * 0.11, R * 0.25, 10), matte('#F3E9D6'));
      tip.position.set(sx * R * 1.44, R * 1.56, 0);
      tip.rotation.z = sx * 0.15;
      g.add(tip);
    }
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
  if (cols.length >= 3) {
    const bw = kind === 'rainbow' ? 0.045 : 0.07;
    cols.forEach((c, i) => {
      const t0 = Math.PI * (0.58 + i * bw);
      g.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, SEG, 3, 0, Math.PI * 2, t0, Math.PI * bw), matte(c)));
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
  private magic: MagicSkin | null = null;
  readonly radius: number;

  constructor(opts: BallViewOptions) {
    const R = opts.radius;
    this.radius = R;
    const c = opts.costume;
    const tint = c?.color ? COSTUME_COLORS[c.color] ?? null : null;
    const skin = !opts.ghost && c?.skin ? c.skin : null;
    // Desen: hareketli cam top ya da yüzeyi kaplayan doku
    this.magic = skin && isMagicSkin(skin) ? magicSkin(skin, R) : null;
    const mat = this.magic ? this.magic.glass : skin ? skinMaterial(skin) : null;
    this.roller = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), mat ?? ballMaterial(opts.type, tint, opts.ghost));
    if (this.magic) {
      this.roller.renderOrder = 2;
      this.root.add(this.magic.inner);
    }
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
      if (c.number != null) this.costumeGroup.add(numberMesh(R, c.number, c.numberStyle ?? 'number'));
      const extra = skin ? skinExtra(skin, R) : null;
      if (extra) this.costumeGroup.add(extra);
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
    this.magic?.update(time);
  }
}
