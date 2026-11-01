// Parkur üstündeki nesneler: bitiş deliği halkası ve bayrağı, kontrol noktası bayrakları,
// toplanabilir yıldızlar, vakum halkaları, rüzgâr çizgileri, mıknatıslar ve tabelalar.

import * as THREE from 'three';
import { t } from '../../i18n';
import { magnetActive } from '../physics/sim';
import type { LevelData } from '../levels/types';
import type { Track } from '../physics/track';
import { S, canvasTexture, makeCanvas, matte, starShape } from './common';

const W2 = 500;
const lx = (x: number) => (x - W2) * S;

function flag(color: string, h: number): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, h, 8), matte('#EDE6DC'));
  pole.position.y = h / 2;
  g.add(pole);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.42, -0.12);
  shape.lineTo(0, -0.24);
  shape.closePath();
  const cloth = new THREE.Mesh(new THREE.ShapeGeometry(shape), matte(color, { side: THREE.DoubleSide }));
  cloth.position.set(0.025, h - 0.02, 0);
  cloth.name = 'cloth';
  g.add(cloth);
  g.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
  return g;
}

interface StarProp {
  group: THREE.Group;
  star: THREE.Mesh;
  disc: THREE.Mesh;
  collectedAt: number;
  baseY: number;
}

interface Anim {
  update(time: number): void;
}

export class Props {
  readonly group = new THREE.Group();
  private stars: StarProp[] = [];
  private anims: Anim[] = [];
  private holeFlag: THREE.Group;
  private cpFlags: THREE.Group[] = [];
  readonly windLabels: { x: number; y: number; dir: number }[] = [];

  constructor(
    level: LevelData,
    track: Track,
    checkpoints: number[],
    envMap: THREE.Texture | null,
    flagColor: string,
  ) {
    const L = level;
    // Bitiş deliği: ince metal halka
    const hole = L.finishHole;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(hole.r * S, 0.045, 12, 48),
      new THREE.MeshStandardMaterial({ color: '#A9B0B7', metalness: 0.8, roughness: 0.3, envMap, envMapIntensity: 1 }),
    );
    ring.position.set(lx(hole.x), hole.y * S, 0.02);
    ring.castShadow = true;
    this.group.add(ring);
    this.holeFlag = flag(flagColor, 0.75);
    const side = hole.x > 500 ? -1 : 1;
    this.holeFlag.position.set(lx(hole.x) + side * (hole.r * S + 0.35) - (side < 0 ? 0 : 0), hole.y * S + 0.05, 0.08);
    this.group.add(this.holeFlag);

    // Kontrol noktası bayrakları
    for (const cy of checkpoints) {
      const cx = track.centerXAt(cy);
      const hw = track.widthAt(cy) / 2;
      const f = flag('#8CCFB4', 0.55);
      f.position.set(lx(cx + hw - 8), cy * S, 0.08);
      this.group.add(f);
      this.cpFlags.push(f);
    }

    // Yıldızlar
    const starGeo = new THREE.ExtrudeGeometry(starShape(0.26, 0.115), {
      depth: 0.07,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.025,
      bevelSegments: 2,
    });
    starGeo.center();
    const starMat = new THREE.MeshStandardMaterial({ color: '#F2C46D', roughness: 0.42, metalness: 0.1, emissive: '#5A3F10', emissiveIntensity: 0.25 });
    const discGeo = new THREE.CircleGeometry(0.42, 40);
    for (const s of L.stars ?? []) {
      const g = new THREE.Group();
      g.position.set(lx(s.x), s.y * S, 0.05);
      const disc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: '#FFF1C9', transparent: true, opacity: 0.4, depthWrite: false }));
      g.add(disc);
      const star = new THREE.Mesh(starGeo, starMat.clone());
      star.position.z = 0.22;
      star.castShadow = true;
      g.add(star);
      this.group.add(g);
      this.stars.push({ group: g, star, disc, collectedAt: -1, baseY: s.y * S });
    }

    // Vakum: içe doğru akan parıltılı halkalar
    for (const v of L.vacuum ?? []) {
      const g = new THREE.Group();
      g.position.set(lx(v.x), v.y * S, 0.015);
      const R = v.radius * S * 0.6;
      const rings: THREE.Mesh[] = [];
      for (let i = 0; i < 3; i++) {
        const m = new THREE.Mesh(
          new THREE.RingGeometry(0.965, 1, 48),
          new THREE.MeshBasicMaterial({ color: '#D9F5EA', transparent: true, opacity: 0, depthWrite: false }),
        );
        g.add(m);
        rings.push(m);
      }
      this.group.add(g);
      this.anims.push({
        update: (time) => {
          rings.forEach((m, i) => {
            const p = (time * 0.55 + i / 3) % 1;
            const r = R * (1 - p * 0.8);
            m.scale.setScalar(r);
            (m.material as THREE.MeshBasicMaterial).opacity = Math.pow(p, 1.5) * (1 - p) * 1.1;
          });
        },
      });
    }

    // Rüzgâr: akan beyaz çizgiler ve yapraklar
    for (const w of L.wind ?? []) {
      const dir = Math.sign(w.force) || 1;
      const g = new THREE.Group();
      g.position.set(lx(w.x), w.y * S, 0.6);
      const streaks: { m: THREE.Mesh; y: number; speed: number; phase: number; len: number }[] = [];
      const n = Math.max(3, Math.round(w.h / 140));
      for (let i = 0; i < n; i++) {
        const len = 1.2 + ((i * 37) % 10) / 10;
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(len, 0.035),
          new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, depthWrite: false }),
        );
        const y = ((i + 0.5) / n) * w.h * S;
        m.position.y = y;
        g.add(m);
        streaks.push({ m, y, speed: 2.4 + (i % 3) * 0.6, phase: (i * 0.37) % 1, len });
      }
      const leafMat = matte('#B3A3E0', { side: THREE.DoubleSide });
      const leaves: THREE.Mesh[] = [];
      for (let i = 0; i < 2; i++) {
        const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.09, 10), leafMat);
        leaf.scale.set(1.6, 0.7, 1);
        g.add(leaf);
        leaves.push(leaf);
      }
      this.group.add(g);
      const wW = w.w * S;
      this.windLabels.push({ x: w.x + w.w * 0.85, y: w.y + w.h * 0.75, dir });
      this.anims.push({
        update: (time) => {
          const pulse = w.pulse ? 0.5 + 0.5 * Math.sin((2 * Math.PI * time) / w.pulse) : 1;
          for (const s of streaks) {
            const p = (time * s.speed * 0.25 + s.phase) % 1;
            const x = dir > 0 ? p * wW : (1 - p) * wW;
            s.m.position.x = x;
            s.m.position.y = s.y + Math.sin(p * Math.PI * 2 + s.phase * 6) * 0.08;
            (s.m.material as THREE.MeshBasicMaterial).opacity = Math.sin(p * Math.PI) * 0.7 * (0.35 + 0.65 * pulse);
          }
          leaves.forEach((leaf, i) => {
            const p = (time * 0.32 + i * 0.5) % 1;
            leaf.position.set(dir > 0 ? p * wW : (1 - p) * wW, w.h * S * (0.3 + i * 0.4) + Math.sin(p * 9) * 0.2, 0);
            leaf.rotation.z = time * 3 + i;
          });
        },
      });
    }

    // Mıknatıslar: at nalı + çekim halkası
    for (const m of L.magnets ?? []) {
      const g = new THREE.Group();
      g.position.set(lx(m.x), m.y * S, 0.25);
      const body = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.1, 12, 24, Math.PI), matte('#E8907E', { roughness: 0.5 }));
      body.rotation.z = Math.PI;
      g.add(body);
      for (const sx of [-1, 1]) {
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 12), matte('#C9CED3', { roughness: 0.35, metalness: 0.6 }));
        tip.position.set(sx * 0.28, 0.08, 0);
        g.add(tip);
      }
      // Topa doğru dönsün diye pistin ortasına bakar
      g.rotation.z = m.x > 500 ? -Math.PI / 2 : Math.PI / 2;
      g.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
      this.group.add(g);
      const ringG = new THREE.Group();
      ringG.position.set(lx(m.x), m.y * S, 0.02);
      const rings: THREE.Mesh[] = [];
      for (let i = 0; i < 2; i++) {
        const r = new THREE.Mesh(
          new THREE.RingGeometry(0.95, 1, 48),
          new THREE.MeshBasicMaterial({ color: '#F6C3B7', transparent: true, opacity: 0, depthWrite: false }),
        );
        ringG.add(r);
        rings.push(r);
      }
      this.group.add(ringG);
      const R = m.radius * S;
      this.anims.push({
        update: (time) => {
          const on = magnetActive(m.onOff, time);
          rings.forEach((r, i) => {
            const p = (time * 0.7 + i / 2) % 1;
            r.scale.setScalar(R * (1 - p * 0.85));
            (r.material as THREE.MeshBasicMaterial).opacity = on ? Math.sin(p * Math.PI) * 0.35 : 0;
          });
          body.scale.setScalar(on ? 1 + Math.sin(time * 10) * 0.03 : 1);
        },
      });
    }

    // Tabelalar (kısa yol / güvenli yol)
    for (const s of L.signs ?? []) this.group.add(sign(t(s.text), s.text === 'sign.short', lx(s.x), s.y * S));
  }

  /** Yıldız toplandı animasyonu başlatır */
  collectStar(i: number, time: number): void {
    const s = this.stars[i];
    if (s && s.collectedAt < 0) s.collectedAt = time;
  }

  /** Yeniden başlarken */
  resetStars(collected: boolean[]): void {
    this.stars.forEach((s, i) => {
      s.collectedAt = collected[i] ? -2 : -1;
      s.group.visible = !collected[i];
      s.group.scale.setScalar(1);
    });
  }

  update(time: number): void {
    for (const a of this.anims) a.update(time);
    for (const s of this.stars) {
      if (s.collectedAt === -2) continue;
      if (s.collectedAt >= 0) {
        const p = (time - s.collectedAt) / 0.45;
        if (p >= 1) {
          s.group.visible = false;
          s.collectedAt = -2;
          continue;
        }
        s.group.scale.setScalar(1 + p * 0.8);
        s.group.position.z = 0.05 + p * 0.6;
        (s.star.material as THREE.MeshStandardMaterial).transparent = true;
        (s.star.material as THREE.MeshStandardMaterial).opacity = 1 - p;
        (s.disc.material as THREE.MeshBasicMaterial).opacity = 0.4 * (1 - p);
      } else {
        s.star.rotation.y = Math.sin(time * 1.6 + s.baseY) * 0.5;
        s.group.position.y = s.baseY + Math.sin(time * 2 + s.baseY) * 0.03;
      }
    }
    const sway = Math.sin(time * 2.2) * 0.12;
    const cloth = this.holeFlag.getObjectByName('cloth');
    if (cloth) cloth.rotation.y = sway;
    for (const f of this.cpFlags) {
      const c = f.getObjectByName('cloth');
      if (c) c.rotation.y = -sway;
    }
  }
}

function sign(text: string, short: boolean, x: number, y: number): THREE.Group {
  const g = new THREE.Group();
  const c = makeCanvas(320, 112);
  const ctx = c.getContext('2d')!;
  const r = 40;
  ctx.fillStyle = short ? '#F2C46D' : '#8CCFB4';
  ctx.beginPath();
  ctx.roundRect(6, 6, 308, 100, r);
  ctx.fill();
  ctx.fillStyle = '#FBF7F0';
  ctx.beginPath();
  ctx.roundRect(14, 14, 292, 84, r - 8);
  ctx.fill();
  // İkon: şimşek ya da kalkan
  ctx.fillStyle = short ? '#DDA94B' : '#5FA98A';
  ctx.beginPath();
  if (short) {
    ctx.moveTo(62, 26);
    ctx.lineTo(40, 60);
    ctx.lineTo(56, 60);
    ctx.lineTo(48, 88);
    ctx.lineTo(76, 50);
    ctx.lineTo(60, 50);
    ctx.closePath();
  } else {
    ctx.moveTo(56, 26);
    ctx.lineTo(78, 34);
    ctx.lineTo(76, 60);
    ctx.quadraticCurveTo(70, 80, 56, 88);
    ctx.quadraticCurveTo(42, 80, 36, 60);
    ctx.lineTo(34, 34);
    ctx.closePath();
  }
  ctx.fill();
  ctx.fillStyle = '#3B3F45';
  ctx.font = '800 38px Nunito, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 92, 58);
  const tex = canvasTexture(c);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.525), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8 }));
  board.position.set(0, 0.55, 0.06);
  board.castShadow = true;
  g.add(board);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8), matte('#9C8676'));
  pole.position.set(0, 0.15, 0.03);
  g.add(pole);
  g.position.set(x, y, 0.12);
  return g;
}
