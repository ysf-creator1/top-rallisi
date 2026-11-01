// Arka plan parkı: uzak tepeler, katman katman yuvarlak tepeli ağaçlar,
// biçilmiş çizgili çim, yürüyüş yolu, bank ve sokak lambası.
// Ayrı bir sahnede durur; kamerası yavaş kayar (paralaks).

import * as THREE from 'three';
import type { SceneTheme } from '../../config/theme';
import { GROUND_Y, canvasTexture, makeCanvas, matte, type Quality } from './common';

function rnd(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

export interface ParkParts {
  group: THREE.Group;
  materials: Record<string, THREE.MeshStandardMaterial>;
  lampLight: THREE.PointLight;
  lampBulb: THREE.Mesh;
  grassTex: THREE.CanvasTexture;
}

function grassTexture(theme: SceneTheme): THREE.CanvasTexture {
  const c = makeCanvas(8, 256);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = theme.grass[0];
  ctx.fillRect(0, 0, 8, 256);
  ctx.fillStyle = theme.grass[1];
  ctx.fillRect(0, 0, 8, 128);
  const t = canvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  return t;
}

export function buildPark(theme: SceneTheme, quality: Quality): ParkParts {
  const g = new THREE.Group();
  const R = rnd(42);
  const mats: Record<string, THREE.MeshStandardMaterial> = {
    hills: matte(theme.hills, { roughness: 1 }),
    hillsFar: matte(theme.hillsFar, { roughness: 1 }),
    treesFar: matte(theme.treesFar, { roughness: 1 }),
    treesNear: matte(theme.treesNear, { roughness: 1 }),
    treesNearShade: matte(theme.treesNearShade, { roughness: 1 }),
    treesHighlight: matte(theme.treesHighlight, { roughness: 1 }),
    trunk: matte(theme.trunk, { roughness: 1 }),
    path: matte(theme.path, { roughness: 1, side: THREE.DoubleSide }),
    bench: matte('#C9A189', { roughness: 0.9 }),
    benchDark: matte('#8E7262', { roughness: 0.9 }),
    lamp: matte('#8C939A', { roughness: 0.5, metalness: 0.4 }),
  };

  // Çizgili çim: şeritler kameraya dik (derinlik boyunca)
  const grassTex = grassTexture(theme);
  grassTex.repeat.set(1, 26);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 260), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, GROUND_Y - 0.02, -90);
  ground.receiveShadow = true;
  g.add(ground);

  // Yürüyüş yolu: hafif kıvrımlı yatay şerit
  const pathShape = new THREE.Shape();
  const pz = (x: number) => -9 + Math.sin(x * 0.08) * 1.2 + Math.sin(x * 0.21) * 0.4;
  pathShape.moveTo(-90, pz(-90));
  for (let x = -90; x <= 90; x += 2) pathShape.lineTo(x, pz(x));
  for (let x = 90; x >= -90; x -= 2) pathShape.lineTo(x, pz(x) - 1.3 - Math.sin(x * 0.05) * 0.2);
  pathShape.closePath();
  const path = new THREE.Mesh(new THREE.ShapeGeometry(pathShape), mats.path);
  path.rotation.x = Math.PI / 2;
  path.position.y = GROUND_Y + 0.01;
  path.receiveShadow = true;
  g.add(path);

  // Uzak tepeler: yassı küreler
  const hillGeo = new THREE.SphereGeometry(1, 32, 16);
  const hills: [number, number, number, number, number, string][] = [
    [-60, -150, 70, 16, 40, 'hillsFar'],
    [40, -160, 90, 20, 45, 'hillsFar'],
    [-30, -110, 55, 11, 30, 'hills'],
    [35, -105, 60, 9, 28, 'hills'],
    [85, -120, 50, 12, 30, 'hills'],
    [-95, -115, 45, 10, 28, 'hills'],
  ];
  for (const [x, z, sx, sy, sz, m] of hills) {
    const h = new THREE.Mesh(hillGeo, mats[m]);
    h.position.set(x, GROUND_Y - sy * 0.35, z);
    h.scale.set(sx, sy, sz);
    g.add(h);
  }

  // Ağaçlar
  const crownGeo = new THREE.IcosahedronGeometry(1, 3);
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.16, 1, 8);
  const tree = (x: number, z: number, s: number, far: boolean) => {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, mats.trunk);
    trunk.scale.set(s, s * 1.6, s);
    trunk.position.y = s * 0.8;
    t.add(trunk);
    const main = new THREE.Mesh(crownGeo, far ? mats.treesFar : mats.treesNear);
    main.scale.setScalar(s * 1.35);
    main.position.y = s * 2.6;
    t.add(main);
    if (!far) {
      for (const sx of [-1, 1]) {
        const sh = new THREE.Mesh(crownGeo, mats.treesNearShade);
        sh.scale.setScalar(s * 0.9);
        sh.position.set(sx * s * 0.75, s * 1.9, s * 0.25);
        t.add(sh);
      }
      const hl = new THREE.Mesh(crownGeo, mats.treesHighlight);
      hl.scale.setScalar(s * 0.5);
      hl.position.set(-s * 0.45, s * 3.2, s * 0.6);
      t.add(hl);
    } else {
      for (const sx of [-1, 1]) {
        const sh = new THREE.Mesh(crownGeo, mats.treesFar);
        sh.scale.setScalar(s * (0.8 + R() * 0.3));
        sh.position.set(sx * s * (0.9 + R() * 0.3), s * (2.1 + R() * 0.4), 0);
        t.add(sh);
      }
    }
    t.position.set(x, GROUND_Y, z);
    t.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = !far;
    });
    g.add(t);
  };

  const farCount = quality === 'low' ? 14 : quality === 'medium' ? 22 : 30;
  for (let i = 0; i < farCount; i++) {
    const x = -70 + (140 * i) / farCount + (R() - 0.5) * 5;
    tree(x, -62 - R() * 16, 1.3 + R() * 0.6, true);
  }
  const nearCount = quality === 'low' ? 8 : 14;
  for (let i = 0; i < nearCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (8 + R() * 22);
    tree(x, -24 - R() * 14, 0.75 + R() * 0.35, false);
  }
  // Orta sıra: standın arkasında ağaç kümeleri
  const midCount = quality === 'low' ? 6 : 10;
  for (let i = 0; i < midCount; i++) {
    tree(-16 + (32 * i) / midCount + (R() - 0.5) * 2, -40 - R() * 8, 0.95 + R() * 0.35, false);
  }

  // Bank (solda)
  const bench = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.6), mats.bench);
  seat.position.y = 0.5;
  bench.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 0.08), mats.bench);
  back.position.set(0, 0.85, -0.28);
  bench.add(back);
  for (const sx of [-0.95, 0.95]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.5), mats.benchDark);
    leg.position.set(sx, 0.25, 0);
    bench.add(leg);
  }
  bench.position.set(-9.5, GROUND_Y, -10.5);
  bench.rotation.y = 0.15;
  bench.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
  g.add(bench);

  // Sokak lambası (sağda)
  const lamp = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 10), mats.lamp);
  pole.position.y = 2.1;
  lamp.add(pole);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 16, 12),
    new THREE.MeshStandardMaterial({ color: theme.lampGlow, emissive: theme.lampGlow, emissiveIntensity: theme.lampOn ? 1.6 : 0.2, roughness: 0.4 }),
  );
  bulb.position.y = 4.35;
  lamp.add(bulb);
  const lampLight = new THREE.PointLight(theme.lampGlow, theme.lampOn ? 6 : 0, 12, 1.6);
  lampLight.position.y = 4.3;
  lamp.add(lampLight);
  lamp.position.set(9.8, GROUND_Y, -12);
  lamp.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
  g.add(lamp);

  return { group: g, materials: mats, lampLight, lampBulb: bulb, grassTex };
}

export function applyParkTheme(p: ParkParts, theme: SceneTheme): void {
  const m = p.materials;
  m.hills.color.set(theme.hills);
  m.hillsFar.color.set(theme.hillsFar);
  m.treesFar.color.set(theme.treesFar);
  m.treesNear.color.set(theme.treesNear);
  m.treesNearShade.color.set(theme.treesNearShade);
  m.treesHighlight.color.set(theme.treesHighlight);
  m.trunk.color.set(theme.trunk);
  m.path.color.set(theme.path);
  const c = p.grassTex.image as HTMLCanvasElement;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = theme.grass[0];
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = theme.grass[1];
  ctx.fillRect(0, 0, c.width, c.height / 2);
  p.grassTex.needsUpdate = true;
  const bm = p.lampBulb.material as THREE.MeshStandardMaterial;
  bm.color.set(theme.lampGlow);
  bm.emissive.set(theme.lampGlow);
  bm.emissiveIntensity = theme.lampOn ? 1.6 : 0.2;
  p.lampLight.color.set(theme.lampGlow);
  p.lampLight.intensity = theme.lampOn ? 6 : 0;
}
