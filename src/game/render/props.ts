// Parkur üstündeki nesneler: bitiş deliği halkası ve bayrağı, kontrol noktası bayrakları,
// toplanabilir yıldızlar, vakum halkaları, rüzgâr çizgileri, mıknatıslar ve tabelalar.

import * as THREE from 'three';
import { t } from '../../i18n';
import { magnetActive } from '../physics/sim';
import { ARM_HALF, ARM_HUB_R, POPPER_VIS, armAngle, popperState, type PopperState } from '../physics/obstacles';
import type { LevelData } from '../levels/types';
import { Track } from '../physics/track';
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
  /** time: görüntü saati, obs: engel saati (fizikle aynı) */
  update(time: number, obs: number): void;
}

const HAZARD = '#EE8A4E';

/** Fırlatıcının üst yüzü: turuncu-krem uyarı şeritleri */
function popperTexture(): THREE.CanvasTexture {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#FBF1E4';
  ctx.fillRect(0, 0, 256, 256);
  ctx.save();
  ctx.translate(128, 128);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = HAZARD;
  for (let x = -200; x < 200; x += 56) ctx.fillRect(x, -200, 28, 400);
  ctx.restore();
  ctx.fillStyle = '#3B3F45';
  ctx.beginPath();
  ctx.arc(128, 128, 22, 0, Math.PI * 2);
  ctx.fill();
  return canvasTexture(c);
}

/** Gizli yol: üstünü örten çalılar, girişte parıltı ve içinde gizli yıldız */
interface SecretProp {
  bushes: { mesh: THREE.Group; home: THREE.Vector3; away: THREE.Vector3 }[];
  sparkle: THREE.Mesh;
  star: StarProp;
  /** Çalıların açıldığı an (-1: kapalı) */
  openedAt: number;
  /** Açılma mesafesi için gizli yolun örnek noktaları (etap birimi) */
  path: { x: number; y: number }[];
}

export class Props {
  readonly group = new THREE.Group();
  private stars: StarProp[] = [];
  private secret: SecretProp | null = null;
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
      const right = track.spanAt(cy)[1];
      const f = flag('#8CCFB4', 0.55);
      f.position.set(lx(right - 8), cy * S, 0.08);
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

    // Gizli yol ve gizli yıldız
    const hb = (L.branches ?? []).find((b) => b.hidden);
    if (hb && L.secret) this.secret = this.buildSecret(L, track, hb.points, starGeo, starMat, discGeo);

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
      const leafMat = matte('#F2C46D', { side: THREE.DoubleSide });
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

    // Düşürme delikleri: turuncu ağız ve dışa doğru yavaşça yayılan uyarı halkası
    for (const th of L.holes ?? []) {
      const g = new THREE.Group();
      g.position.set(lx(th.x), th.y * S, 0.02);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(th.r * S + 0.02, 0.04, 10, 48), matte(HAZARD, { roughness: 0.55, emissive: '#5A2A10', emissiveIntensity: 0.3 }));
      rim.castShadow = true;
      g.add(rim);
      const pulse = new THREE.Mesh(
        new THREE.RingGeometry(0.94, 1, 48),
        new THREE.MeshBasicMaterial({ color: '#F6B48A', transparent: true, opacity: 0, depthWrite: false }),
      );
      g.add(pulse);
      this.group.add(g);
      const R0 = th.r * S + 0.05;
      this.anims.push({
        update: (time) => {
          const p = (time * 0.6 + th.x * 0.001) % 1;
          pulse.scale.setScalar(R0 + p * 0.45);
          (pulse.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.45;
        },
      });
    }

    // Dönen kollar: zeminde süpürdüğü alan (soluk turuncu daire + kesikli sınır),
    // kalın şeritli kol, arkasında hareket izi, krem kapaklı göbek
    const bladeMat = matte(HAZARD, { roughness: 0.45, emissive: '#7A3410', emissiveIntensity: 0.35 });
    const capMat = matte('#FBF1E4', { roughness: 0.6 });
    const hubMat = new THREE.MeshStandardMaterial({ color: '#4A4F57', metalness: 0.6, roughness: 0.35, envMap, envMapIntensity: 0.8 });
    for (const a of L.arms ?? []) {
      const g = new THREE.Group();
      g.position.set(lx(a.x), a.y * S, 0);
      const n = a.blades ?? 2;
      const len = a.length * S;
      const thick = ARM_HALF * 2 * S;
      const reachR = len + thick / 2;
      // Süpürülen alan
      const zone = new THREE.Mesh(
        new THREE.CircleGeometry(reachR, 64),
        new THREE.MeshBasicMaterial({ color: HAZARD, transparent: true, opacity: 0.1, depthWrite: false }),
      );
      zone.position.z = 0.01;
      g.add(zone);
      const dashes = new THREE.Group();
      const DN = 28;
      for (let i = 0; i < DN; i++) {
        const d = new THREE.Mesh(
          new THREE.RingGeometry(reachR - 0.035, reachR, 6, 1, (i * Math.PI * 2) / DN, (Math.PI * 2) / DN / 2),
          new THREE.MeshBasicMaterial({ color: '#F6B48A', transparent: true, opacity: 0.75, depthWrite: false }),
        );
        dashes.add(d);
      }
      dashes.position.z = 0.012;
      g.add(dashes);
      const rotor = new THREE.Group();
      rotor.position.z = 0.2;
      g.add(rotor);
      const dir = Math.sign(a.speed) || 1;
      const trailMat = new THREE.MeshBasicMaterial({ color: '#F6B48A', transparent: true, opacity: 0.28, depthWrite: false });
      for (let i = 0; i < n; i++) {
        const b = new THREE.Group();
        b.rotation.z = (i * Math.PI * 2) / n;
        // Hareket izi: kolun arkasında kalan soluk dilim
        const span = 0.55;
        const trail = new THREE.Mesh(new THREE.CircleGeometry(reachR, 24, dir > 0 ? -span : 0, span), trailMat);
        trail.position.z = -0.18;
        b.add(trail);
        const bar = new THREE.Mesh(new THREE.BoxGeometry(len, thick, 0.2), bladeMat);
        bar.position.x = len / 2;
        b.add(bar);
        // Krem uyarı bantları: dönüş daha kolay fark edilir
        for (const f of [0.4, 0.7]) {
          const band = new THREE.Mesh(new THREE.BoxGeometry(len * 0.12, thick * 1.02, 0.205), capMat);
          band.position.x = len * f;
          b.add(band);
        }
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(thick / 2, thick / 2, 0.2, 20), capMat);
        tip.rotation.x = Math.PI / 2;
        tip.position.x = len;
        b.add(tip);
        rotor.add(b);
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(ARM_HUB_R * S, ARM_HUB_R * S * 1.15, 0.5, 24), hubMat);
      hub.rotation.x = Math.PI / 2;
      hub.position.z = 0.2;
      g.add(hub);
      const cap = new THREE.Mesh(new THREE.CircleGeometry(ARM_HUB_R * S * 0.55, 24), bladeMat);
      cap.position.z = 0.452;
      g.add(cap);
      for (const o of [hub, cap, rotor]) o.traverse((m) => ((m as THREE.Mesh).isMesh && m !== zone ? (m.castShadow = true) : null));
      rotor.traverse((m) => ((m as THREE.Mesh).material === trailMat ? (m.castShadow = false) : null));
      this.group.add(g);
      this.anims.push({
        update: (time, obs) => {
          rotor.rotation.z = armAngle(a, obs);
          dashes.rotation.z = time * 0.25 * dir;
        },
      });
    }

    // Fırlatıcılar: yay üstünde şeritli tabla. Uyarıda yay sıkışır ve titrer,
    // sonra tabla yayla fırlar (biraz fazla çıkıp sallanır), inerken de yaylanır.
    const padTop = popperTexture();
    const springMat = new THREE.MeshStandardMaterial({ color: '#E6EAEF', metalness: 0.5, roughness: 0.3, envMap, envMapIntensity: 1, emissive: '#FFFFFF', emissiveIntensity: 0.18 });
    for (const p of L.poppers ?? []) {
      const g = new THREE.Group();
      g.position.set(lx(p.x), p.y * S, 0);
      const R = p.r * POPPER_VIS * S;
      const pad = new THREE.Group();
      const sideMat = matte(HAZARD, { roughness: 0.5, emissive: '#FF8A3A', emissiveIntensity: 0 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.08, 40), sideMat);
      body.rotation.x = Math.PI / 2;
      pad.add(body);
      const topMat = new THREE.MeshStandardMaterial({ map: padTop, roughness: 0.6, emissive: '#FF8A3A', emissiveIntensity: 0 });
      const top = new THREE.Mesh(new THREE.CircleGeometry(R * 0.96, 40), topMat);
      top.position.z = 0.041;
      pad.add(top);
      pad.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
      g.add(pad);
      // Yay halkaları: kamera neredeyse karşıdan baktığı için tabla çıkarken
      // ekranda biraz yukarı kayar; halkalar alttan merdiven gibi görünür.
      const coils: THREE.Mesh[] = [];
      const NC = 4;
      for (let i = 0; i < NC; i++) {
        const c = new THREE.Mesh(new THREE.TorusGeometry(R * 0.85, 0.04, 8, 36), springMat);
        c.castShadow = true;
        g.add(c);
        coils.push(c);
      }
      this.group.add(g);
      const st: PopperState = { lift: 0, warn: 0, active: false };
      let h = 0;
      let v = 0;
      let last = -1;
      this.anims.push({
        update: (time, obs) => {
          popperState(p, obs, st);
          const dt = last < 0 ? 0 : Math.min(0.05, Math.max(0, time - last));
          last = time;
          // Uyarıda yay sıkışır (hedef eksi), çıkışta yay hızla açılır
          const target = st.active ? st.lift : -0.35 * st.warn;
          const K = st.active ? 260 : 190;
          const C = st.active ? 9 : 7;
          v += (-K * (h - target) - C * v) * dt;
          h += v * dt;
          if (dt === 0) h = target;
          const shake = st.warn > 0 ? Math.sin(time * 70) * 0.012 * st.warn : 0;
          const lift = Math.max(-0.4, h);
          const up = Math.max(0, lift);
          const z = 0.06 + up * 0.7;
          // Sahte bakış açısı: yükselen tabla büyür ve ekranda yukarı kayar
          const sc = 1 + up * 0.32 + Math.min(0, lift) * 0.12;
          pad.position.set(shake, up * R * 1.3, z);
          pad.scale.setScalar(sc);
          for (let i = 0; i < NC; i++) {
            const f = (i + 1) / (NC + 1);
            const c = coils[i];
            c.position.set(shake * f, up * R * 1.3 * f, 0.03 + (z - 0.03) * f);
            c.scale.setScalar(1 + up * 0.32 * f);
            c.visible = up > 0.04;
          }
          const glow = st.active ? 0.5 : st.warn * (0.25 + 0.25 * Math.sin(time * 18));
          sideMat.emissiveIntensity = topMat.emissiveIntensity = glow;
        },
      });
    }

    // Tabelalar (kısa yol / güvenli yol)
    for (const s of L.signs ?? []) this.group.add(sign(t(s.text), s.text === 'sign.short', lx(s.x), s.y * S));
  }

  private buildSecret(
    L: LevelData,
    track: Track,
    pts: { x: number; y: number; w: number }[],
    starGeo: THREE.BufferGeometry,
    starMat: THREE.MeshStandardMaterial,
    discGeo: THREE.BufferGeometry,
  ): SecretProp {
    // Yolu eşit aralıklı noktalara böl
    const path: { x: number; y: number }[] = [];
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      const n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 20));
      for (let i = 0; i < n; i++) path.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n });
    }
    path.push(pts[pts.length - 1]);
    const main = new Track({ ...L, branches: [] });
    const near = { dist: 0, halfWidth: 0, cx: 0, cy: 0, line: main.main };
    void track;
    // Çalılar: ana yolun dışında kalan kısmı örter (ana yol kenarında küçük bir boşluk kalır: ipucu)
    const greens = ['#7FB98F', '#8CCFA0', '#76B387'];
    const leaf = greens.map((c) => matte(c, { roughness: 0.95 }));
    const ball = new THREE.SphereGeometry(1, 16, 12);
    const bushes: SecretProp['bushes'] = [];
    const w = pts[0].w;
    let k = 0;
    for (let i = 0; i < path.length; i += 3) {
      const p = path[i];
      main.nearest(p.x, p.y, near);
      if (near.dist < near.halfWidth + w * 0.35) continue;
      const g = new THREE.Group();
      const r = w * 0.62 * S;
      for (let q = 0; q < 3; q++) {
        const m = new THREE.Mesh(ball, leaf[(k + q) % 3]);
        const ang = (q / 3) * Math.PI * 2 + k;
        m.position.set(Math.cos(ang) * r * 0.45, Math.sin(ang) * r * 0.45, r * 0.35);
        m.scale.set(r * (0.75 + 0.1 * q), r * (0.75 + 0.1 * q), r * 0.62);
        m.castShadow = true;
        g.add(m);
      }
      const home = new THREE.Vector3(lx(p.x), p.y * S, 0.02);
      // Açılınca yolun iki yanına çekilir
      const prev = path[Math.max(0, i - 1)], next = path[Math.min(path.length - 1, i + 1)];
      const dx = next.x - prev.x, dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      const side = k % 2 ? 1 : -1;
      const away = home.clone().add(new THREE.Vector3((-dy / len) * side * w * 1.1 * S, (dx / len) * side * w * 1.1 * S, -0.05));
      g.position.copy(home);
      this.group.add(g);
      bushes.push({ mesh: g, home, away });
      k++;
    }
    // Gizli yıldız
    const sg = new THREE.Group();
    sg.position.set(lx(L.secret!.x), L.secret!.y * S, 0.05);
    const disc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: '#FFF1C9', transparent: true, opacity: 0.4, depthWrite: false }));
    const star = new THREE.Mesh(starGeo, starMat.clone());
    star.position.z = 0.22;
    sg.add(disc, star);
    this.group.add(sg);
    // Girişteki parıltı: ana yol kenarında, çalıların başında yanıp söner
    const first = bushes[0]?.home ?? sg.position;
    const sparkle = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.34),
      new THREE.MeshBasicMaterial({ map: sparkleTexture(), transparent: true, depthWrite: false }),
    );
    sparkle.position.set(first.x, first.y, 0.75);
    this.group.add(sparkle);
    return { bushes, sparkle, star: { group: sg, star, disc, collectedAt: -1, baseY: L.secret!.y * S }, openedAt: -1, path };
  }

  /** Top gizli yola yaklaşınca çalılar açılır (etap birimiyle top konumu) */
  revealSecret(bx: number, by: number, time: number): void {
    const s = this.secret;
    if (!s || s.openedAt >= 0) return;
    for (let i = 0; i < s.path.length; i += 2) {
      const p = s.path[i];
      if (Math.hypot(bx - p.x, by - p.y) < 230) {
        s.openedAt = time;
        return;
      }
    }
  }

  collectSecret(time: number): void {
    const s = this.secret;
    if (s && s.star.collectedAt < 0) s.star.collectedAt = time;
    if (s && s.openedAt < 0) s.openedAt = time;
  }

  /** Yeniden başlarken çalılar kapanır, yıldız geri gelir */
  resetSecret(): void {
    const s = this.secret;
    if (!s) return;
    s.openedAt = -1;
    s.star.collectedAt = -1;
    s.star.group.visible = true;
    s.star.group.scale.setScalar(1);
    s.star.group.position.z = 0.05;
    for (const b of s.bushes) {
      b.mesh.position.copy(b.home);
      b.mesh.scale.setScalar(1);
      b.mesh.visible = true;
    }
  }

  private updateSecret(time: number): void {
    const s = this.secret;
    if (!s) return;
    const p = s.openedAt < 0 ? 0 : Math.min(1, (time - s.openedAt) / 0.6);
    const e = 1 - Math.pow(1 - p, 3);
    for (const b of s.bushes) {
      b.mesh.position.lerpVectors(b.home, b.away, e);
      b.mesh.scale.setScalar(1 - 0.45 * e);
    }
    const sp = s.sparkle.material as THREE.MeshBasicMaterial;
    sp.opacity = p > 0 ? Math.max(0, 1 - p * 2) : 0.35 + 0.65 * Math.max(0, Math.sin(time * 3.2));
    s.sparkle.rotation.z = time * 0.8;
    const st = s.star;
    if (st.collectedAt === -2) return;
    if (st.collectedAt >= 0) {
      const q = (time - st.collectedAt) / 0.45;
      if (q >= 1) {
        st.group.visible = false;
        st.collectedAt = -2;
        return;
      }
      st.group.scale.setScalar(1 + q * 0.8);
      st.group.position.z = 0.05 + q * 0.6;
    } else st.star.rotation.y = Math.sin(time * 1.6) * 0.5;
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

  update(time: number, obs = time): void {
    for (const a of this.anims) a.update(time, obs);
    this.updateSecret(time);
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

/** Dört köşeli parıltı dokusu */
function sparkleTexture(): THREE.Texture {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 60);
  g.addColorStop(0, 'rgba(255,246,214,1)');
  g.addColorStop(0.35, 'rgba(255,236,170,0.55)');
  g.addColorStop(1, 'rgba(255,236,170,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#FFFBEA';
  ctx.beginPath();
  ctx.moveTo(64, 4);
  ctx.lineTo(72, 56);
  ctx.lineTo(124, 64);
  ctx.lineTo(72, 72);
  ctx.lineTo(64, 124);
  ctx.lineTo(56, 72);
  ctx.lineTo(4, 64);
  ctx.lineTo(56, 56);
  ctx.closePath();
  ctx.fill();
  return canvasTexture(c);
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
