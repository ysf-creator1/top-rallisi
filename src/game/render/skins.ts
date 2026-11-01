// Topun yüzeyini kaplayan desenler (mağaza: Bayrak, Spor, Gezegen) ve
// içinde bir şeylerin döndüğü hareketli cam toplar (mağaza: Hareketli).
// Desenler küreye sarılan eşdikdörtgen bir canvas'a piksel piksel çizilir.
// Top z ekseni etrafında yuvarlandığı için ön yüz (+z) hep kameraya bakar;
// bayrağın ana işareti bu yüze gelir.

import * as THREE from 'three';
import { canvasTexture, makeCanvas, matte } from './common';

type RGB = [number, number, number];
const W = 512;
const H = 256;

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// ---------- Gürültü (tohumlu, tekrarlanabilir) ----------

function hash3(x: number, y: number, z: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const f = (t: number) => t * t * (3 - 2 * t);
  const u = f(x - xi);
  const v = f(y - yi);
  const w = f(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

function fbm(x: number, y: number, z: number, oct = 4): number {
  let s = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * noise3(x * f, y * f, z * f);
    f *= 2;
    a *= 0.5;
  }
  return s / (1 - Math.pow(0.5, oct));
}

// ---------- Yardımcı şekiller ----------

function inStar(px: number, py: number, cx: number, cy: number, R: number, r: number, rot: number, n = 5): boolean {
  const dx = px - cx;
  const dy = py - cy;
  const d = Math.hypot(dx, dy);
  if (d > R) return false;
  if (d < r) return true;
  let a = Math.atan2(dy, dx) - rot;
  const seg = Math.PI / n;
  a = ((a % (2 * seg)) + 2 * seg) % (2 * seg);
  const t = Math.abs(a - seg) / seg; // 0: iç köşe, 1: uç
  // İki köşe arasında doğrusal kenar (yaklaşık)
  const edge = r + (R - r) * t;
  return d <= edge * (0.75 + 0.25 * t);
}

const circ = (px: number, py: number, cx: number, cy: number, r: number) => (px - cx) ** 2 + (py - cy) ** 2 <= r * r;

/** Bayrak: ön yüzde (fx, fy) ∈ [-1, 1]², arka yüzde ayna görüntüsü */
type FlagFn = (fx: number, fy: number) => RGB;

const RED = hex('#E30A17');
const WHITE = hex('#FBF7F0');

const hStripes = (cols: string[]): FlagFn => {
  const c = cols.map(hex);
  return (_fx, fy) => c[Math.min(c.length - 1, Math.floor(((1 - fy) / 2) * c.length))];
};
const vStripes = (cols: string[]): FlagFn => {
  const c = cols.map(hex);
  return (fx) => c[Math.min(c.length - 1, Math.floor(((fx + 1) / 2) * c.length))];
};

const FLAGS: Record<string, FlagFn> = {
  tr: (fx, fy) => {
    if (circ(fx, fy, -0.22, 0, 0.5) && !circ(fx, fy, -0.09, 0, 0.4)) return WHITE;
    if (inStar(fx, fy, 0.38, 0, 0.24, 0.1, Math.PI)) return WHITE;
    return RED;
  },
  az: (fx, fy) => {
    if (circ(fx, fy, -0.08, 0, 0.3) && !circ(fx, fy, 0.0, 0, 0.24)) return WHITE;
    if (inStar(fx, fy, 0.26, 0, 0.14, 0.07, 0, 8)) return WHITE;
    return hStripes(['#00B5E2', '#EF3340', '#509E2F'])(fx, fy);
  },
  de: hStripes(['#2B2B2B', '#DD0000', '#FFCE00']),
  fr: vStripes(['#0055A4', '#FBF7F0', '#EF4135']),
  it: vStripes(['#009246', '#FBF7F0', '#CE2B37']),
  nl: hStripes(['#AE1C28', '#FBF7F0', '#21468B']),
  es: (_fx, fy) => (Math.abs(fy) < 0.5 ? hex('#F1BF00') : hex('#AA151B')),
  jp: (fx, fy) => (circ(fx, fy, 0, 0, 0.5) ? hex('#BC002D') : WHITE),
  br: (fx, fy) => {
    if (circ(fx, fy, 0, 0, 0.36)) return Math.abs(fy + fx * 0.25 - 0.02) < 0.05 ? WHITE : hex('#002776');
    if (Math.abs(fx) / 0.92 + Math.abs(fy) / 0.66 < 1) return hex('#FFDF00');
    return hex('#009C3B');
  },
  ar: (fx, fy) => {
    if (circ(fx, fy, 0, 0, 0.2)) return hex('#F6B40E');
    return Math.abs(fy) < 0.34 ? WHITE : hex('#74ACDF');
  },
  gb: (fx, fy) => {
    const blue = hex('#012169');
    const red = hex('#C8102E');
    if (Math.abs(fx) < 0.12 || Math.abs(fy) < 0.12) return red;
    if (Math.abs(fx) < 0.2 || Math.abs(fy) < 0.2) return WHITE;
    const d1 = Math.abs(fx - fy);
    const d2 = Math.abs(fx + fy);
    if (Math.min(d1, d2) < 0.08) return red;
    if (Math.min(d1, d2) < 0.2) return WHITE;
    return blue;
  },
  us: (fx, fy) => {
    if (fx < 0.05 && fy > 0) {
      const gx = ((fx + 1) / 1.05) * 6;
      const gy = fy * 5;
      const ox = gx - Math.floor(gx) - 0.5;
      const oy = gy - Math.floor(gy) - 0.5;
      return ox * ox + oy * oy < 0.07 ? WHITE : hex('#3C3B6E');
    }
    return Math.floor(((1 - fy) / 2) * 13) % 2 === 0 ? hex('#B22234') : WHITE;
  },
};

// ---------- Desen fonksiyonları: yön (x, y, z) → renk ----------

type DirFn = (x: number, y: number, z: number) => RGB;

const ICO: [number, number, number][] = (() => {
  const t = (1 + Math.sqrt(5)) / 2;
  const v: [number, number, number][] = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];
  return v.map(([a, b, c]) => {
    const l = Math.hypot(a, b, c);
    return [a / l, b / l, c / l];
  });
})();

const FIB: [number, number, number][] = (() => {
  const out: [number, number, number][] = [];
  const n = 260;
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const a = i * Math.PI * (3 - Math.sqrt(5));
    out.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  return out;
})();

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

const SPORTS: Record<string, DirFn> = {
  football: (x, y, z) => {
    let best = -2;
    let second = -2;
    for (const [a, b, c] of ICO) {
      const d = a * x + b * y + c * z;
      if (d > best) {
        second = best;
        best = d;
      } else if (d > second) second = d;
    }
    if (Math.acos(Math.min(1, best)) < 0.33) return hex('#2B2D31');
    if (best - second < 0.012) return hex('#9AA0A6');
    return hex('#F7F7F5');
  },
  basketball: (x, y, z) => {
    const line = Math.abs(y) < 0.025 || Math.abs(x) < 0.025 || Math.abs(Math.abs(x) - 0.62 - 0.25 * y * y) < 0.028;
    if (line) return hex('#2B2523');
    const n = fbm(x * 30, y * 30, z * 30, 2);
    return shade(hex('#E07B39'), 0.9 + n * 0.15);
  },
  tennis: (x, y, z) => {
    const lat = Math.asin(Math.max(-1, Math.min(1, y)));
    const lon = Math.atan2(z, x);
    const seam = 0.62 * Math.sin(2 * lon);
    if (Math.abs(lat - seam) < 0.06) return hex('#F7F7F2');
    const n = fbm(x * 18, y * 18, z * 18, 3);
    return shade(hex('#CFE04A'), 0.88 + n * 0.2);
  },
  volleyball: (x, y, z) => {
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    const az = Math.abs(z);
    let s: number;
    if (ax >= ay && ax >= az) s = y;
    else if (ay >= ax && ay >= az) s = z;
    else s = x;
    const band = s < -0.33 ? 0 : s < 0.33 ? 1 : 2;
    const cols = [hex('#2F6DB5'), hex('#F7F7F2'), hex('#F2C230')];
    return cols[band];
  },
  beach: (x, y, z) => {
    if (Math.abs(y) > 0.9) return WHITE;
    const lon = Math.atan2(z, x) + Math.PI;
    const cols = ['#E8574B', '#F7F7F2', '#2F8FD5', '#F2C230', '#F7F7F2', '#3FB37F'].map(hex);
    return cols[Math.floor((lon / (Math.PI * 2)) * 6) % 6];
  },
  golf: (x, y, z) => {
    let best = -2;
    for (const [a, b, c] of FIB) best = Math.max(best, a * x + b * y + c * z);
    const d = Math.acos(Math.min(1, best));
    if (d < 0.07) return shade(hex('#F4F4F2'), 0.86 + (d / 0.07) * 0.1);
    return hex('#F7F7F5');
  },
  billiard8: (x, y, z) => (z > 0 && Math.hypot(x, y) < 0.42 ? WHITE : hex('#1E1F22')),
  billiard9: (x, y, z) => {
    if (z > 0 && Math.hypot(x, y) < 0.36) return WHITE;
    return Math.abs(y) < 0.5 ? hex('#F2B92B') : WHITE;
  },
  bowling: (x, y, z) => {
    for (const [hx, hy, hz] of [[-0.18, 0.62, 0.76], [0.18, 0.62, 0.76], [0, 0.32, 0.95]] as const) {
      const d = Math.hypot(x - hx, y - hy, z - hz);
      if (d < 0.1) return hex('#0D0E12');
      if (d < 0.125) return hex('#4E5AA0');
    }
    const n = fbm(x * 3 + 4, y * 3, z * 3, 4);
    const sw = Math.sin((n * 6 + x * 2) * Math.PI);
    return mix(hex('#2D347A'), hex('#6A4FB0'), 0.5 + sw * 0.5);
  },
};

const PLANETS: Record<string, DirFn> = {
  earth: (x, y, z) => {
    const n = fbm(x * 1.8 + 7, y * 1.8, z * 1.8, 5);
    const cloud = fbm(x * 3 + 20, y * 6, z * 3, 3);
    let c: RGB;
    if (Math.abs(y) > 0.88) c = hex('#F3F6F8');
    else if (n > 0.55) c = mix(hex('#5FA34E'), hex('#B59A5E'), Math.min(1, (n - 0.55) * 4));
    else c = mix(hex('#1E5FA8'), hex('#3D8ED0'), n / 0.55);
    if (cloud > 0.62) c = mix(c, hex('#FFFFFF'), Math.min(0.8, (cloud - 0.62) * 4));
    return c;
  },
  moon: (x, y, z) => {
    const n = fbm(x * 3, y * 3, z * 3, 5);
    let c = shade(hex('#C9C9C6'), 0.75 + n * 0.35);
    const m = fbm(x * 1.2 + 3, y * 1.2, z * 1.2, 3);
    if (m > 0.58) c = shade(c, 0.78);
    let best = -2;
    let idx = 0;
    for (let i = 0; i < FIB.length; i += 7) {
      const [a, b, cc] = FIB[i];
      const d = a * x + b * y + cc * z;
      if (d > best) {
        best = d;
        idx = i;
      }
    }
    const r = 0.06 + hash3(idx, 1, 2) * 0.1;
    const dd = Math.acos(Math.min(1, best));
    if (dd < r) c = shade(c, dd > r * 0.75 ? 1.12 : 0.82);
    return c;
  },
  mars: (x, y, z) => {
    if (y > 0.9) return hex('#F2EEE9');
    const n = fbm(x * 2.5 + 11, y * 2.5, z * 2.5, 5);
    return mix(hex('#C1502E'), hex('#7A3220'), n > 0.55 ? (n - 0.55) * 3 : 0);
  },
  jupiter: (x, y, z) => {
    const t = fbm(x * 2, y * 2, z * 2, 3) * 0.35;
    const b = Math.sin((y + t * 0.3) * 18);
    let c = mix(hex('#E9D7B8'), hex('#B98A5E'), 0.5 + b * 0.5);
    if (Math.hypot(x - 0.45, (y + 0.35) * 1.8, z - 0.8) < 0.22) c = hex('#C2563B');
    return c;
  },
  saturn: (x, y, z) => {
    const t = fbm(x * 2, y * 2, z * 2, 3) * 0.2;
    const b = Math.sin((y + t * 0.3) * 14);
    return mix(hex('#F0DDAA'), hex('#C9A66B'), 0.5 + b * 0.5);
  },
  neptune: (x, y, z) => {
    const t = fbm(x * 2 + 5, y * 2, z * 2, 3) * 0.3;
    const b = Math.sin((y + t * 0.4) * 10);
    return mix(hex('#3D66D6'), hex('#2A44A8'), 0.5 + b * 0.5);
  },
  sun: (x, y, z) => {
    const n = fbm(x * 4, y * 4, z * 4, 5);
    return mix(hex('#FFB429'), hex('#FFE680'), n);
  },
};

const ROUGH: Record<string, number> = { billiard8: 0.15, billiard9: 0.15, bowling: 0.12, golf: 0.5 };

/** Yön fonksiyonunu eşdikdörtgen canvas'a çizer */
function paint(fn: DirFn): HTMLCanvasElement {
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let py = 0; py < H; py++) {
    const th = ((py + 0.5) / H) * Math.PI;
    const st = Math.sin(th);
    const y = Math.cos(th);
    for (let px = 0; px < W; px++) {
      const ph = ((px + 0.5) / W) * Math.PI * 2;
      const x = -Math.cos(ph) * st;
      const z = Math.sin(ph) * st;
      const [r, g, b] = fn(x, y, z);
      const i = (py * W + px) * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Bilardo topunun numarası: ön yüzün ortasına (u=0.25, v=0.5) */
function drawBilliardNumber(c: HTMLCanvasElement, n: string): void {
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#1E1F22';
  ctx.font = `700 ${H * 0.2}px Fredoka, Nunito, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(n, W / 4, H / 2 + 2);
}

function dirFor(key: string): DirFn | null {
  if (FLAGS[key]) {
    const f = FLAGS[key];
    return (x, y, z) => (z >= 0 ? f(x, y) : f(-x, y));
  }
  return SPORTS[key] ?? PLANETS[key] ?? null;
}

const canvasCache = new Map<string, HTMLCanvasElement>();

/** Desenin canvas'ı (önbellekli). Bilinmeyen desen için null. */
export function skinCanvas(key: string): HTMLCanvasElement | null {
  const hit = canvasCache.get(key);
  if (hit) return hit;
  const fn = dirFor(key);
  if (!fn) return null;
  const c = paint(fn);
  if (key === 'billiard8') drawBilliardNumber(c, '8');
  if (key === 'billiard9') drawBilliardNumber(c, '9');
  canvasCache.set(key, c);
  return c;
}

export const isMagicSkin = (key: string | null | undefined): boolean => !!key && key in MAGIC;

/** Yuvarlanan kürenin malzemesi (statik desenler için) */
export function skinMaterial(key: string): THREE.Material | null {
  const c = skinCanvas(key);
  if (!c) return null;
  const map = canvasTexture(c);
  const m = new THREE.MeshStandardMaterial({ map, roughness: ROUGH[key] ?? 0.55, metalness: 0 });
  if (key === 'sun') {
    m.emissive = new THREE.Color('#FF9A1F');
    m.emissiveMap = map;
    m.emissiveIntensity = 0.6;
  }
  return m;
}

/** Desene eşlik eden, dönmeyen ek parça (Satürn'ün halkası) */
export function skinExtra(key: string, R: number): THREE.Object3D | null {
  if (key !== 'saturn') return null;
  const c = makeCanvas(256, 8);
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, 'rgba(226,205,160,0.0)');
  g.addColorStop(0.15, 'rgba(226,205,160,0.9)');
  g.addColorStop(0.5, 'rgba(196,166,112,0.75)');
  g.addColorStop(0.62, 'rgba(196,166,112,0.15)');
  g.addColorStop(0.72, 'rgba(236,220,180,0.85)');
  g.addColorStop(1, 'rgba(236,220,180,0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 8);
  const tex = canvasTexture(c);
  const geo = new THREE.RingGeometry(R * 1.25, R * 1.9, 64, 1);
  // Halka dokusu yarıçap boyunca
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (r - R * 1.25) / (R * 0.65), 0.5);
  }
  const ring = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, roughness: 0.7, depthWrite: false }));
  ring.rotation.x = Math.PI / 2 - 0.38;
  ring.rotation.y = 0.2;
  return ring;
}

// ---------- Hareketli cam toplar ----------

export interface MagicSkin {
  /** Dış cam (yuvarlanan küre bunu kullanır) */
  glass: THREE.Material;
  /** Camın içindeki parçalar (dönmez, kendi canlandırması var) */
  inner: THREE.Group;
  update(time: number): void;
}

function glassMat(tint: string, opacity: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: tint, transparent: true, opacity, roughness: 0.06, metalness: 0.1, depthWrite: false });
}

function fishMesh(R: number, col: string): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(R * 0.16, 14, 10), matte(col));
  body.scale.set(1.4, 0.9, 0.6);
  g.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(R * 0.11, R * 0.16, 3), matte(col));
  tail.rotation.z = Math.PI / 2;
  tail.position.x = -R * 0.26;
  g.add(tail);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(R * 0.028, 8, 6), matte('#22252A'));
  eye.position.set(R * 0.13, R * 0.04, R * 0.08);
  g.add(eye);
  return g;
}

function heartShape(s: number): THREE.Shape {
  const sh = new THREE.Shape();
  sh.moveTo(0, -s * 0.9);
  sh.bezierCurveTo(-s * 1.4, -s * 0.1, -s * 0.9, s * 0.95, 0, s * 0.45);
  sh.bezierCurveTo(s * 0.9, s * 0.95, s * 1.4, -s * 0.1, 0, -s * 0.9);
  return sh;
}

const MAGIC: Record<string, (R: number) => MagicSkin> = {
  aquarium: (R) => {
    const inner = new THREE.Group();
    const water = new THREE.Mesh(new THREE.SphereGeometry(R * 0.93, 32, 20), glassMat('#7FC4E8', 0.16));
    water.renderOrder = 1;
    inner.add(water);
    const fish = ['#F2994A', '#F2C46D', '#E8907E'].map((c) => fishMesh(R, c));
    fish.forEach((f) => inner.add(f));
    const bubbles: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(R * 0.04, 8, 6), glassMat('#FFFFFF', 0.7));
      inner.add(b);
      bubbles.push(b);
    }
    return {
      glass: glassMat('#E6F4FB', 0.22),
      inner,
      update(t) {
        fish.forEach((f, i) => {
          const sp = 0.9 + i * 0.35;
          const a = t * sp + i * 2.1;
          const rr = R * (0.45 - i * 0.08);
          f.position.set(Math.cos(a) * rr, R * (-0.25 + i * 0.25) + Math.sin(t * 2 + i) * R * 0.05, Math.sin(a) * rr);
          f.rotation.y = -a - Math.PI / 2;
        });
        bubbles.forEach((b, i) => {
          const k = (t * 0.35 + i / 6) % 1;
          b.position.set(Math.sin(i * 2.3) * R * 0.3, R * (-0.7 + k * 1.4), Math.cos(i * 1.7) * R * 0.3);
          b.visible = k < 0.95;
        });
      },
    };
  },
  snow: (R) => {
    const inner = new THREE.Group();
    const tree = new THREE.Mesh(new THREE.ConeGeometry(R * 0.28, R * 0.6, 12), matte('#3FA36B'));
    tree.position.y = -R * 0.35;
    inner.add(tree);
    const ground = new THREE.Mesh(new THREE.SphereGeometry(R * 0.9, 24, 8, 0, Math.PI * 2, Math.PI * 0.72, Math.PI * 0.28), matte('#F7F9FB'));
    inner.add(ground);
    const flakes: THREE.Mesh[] = [];
    const fg = new THREE.SphereGeometry(R * 0.035, 6, 4);
    const fm = matte('#FFFFFF', { emissive: '#FFFFFF', emissiveIntensity: 0.3 });
    for (let i = 0; i < 36; i++) {
      const f = new THREE.Mesh(fg, fm);
      inner.add(f);
      flakes.push(f);
    }
    return {
      glass: glassMat('#EAF4FA', 0.2),
      inner,
      update(t) {
        flakes.forEach((f, i) => {
          const k = (t * 0.12 + hash3(i, 3, 5)) % 1;
          const a = t * 0.8 + i * 2.4;
          const rr = R * (0.15 + 0.55 * hash3(i, 7, 1));
          f.position.set(Math.cos(a) * rr, R * (0.75 - k * 1.3), Math.sin(a) * rr);
        });
      },
    };
  },
  heart: (R) => {
    const inner = new THREE.Group();
    const geo = new THREE.ExtrudeGeometry(heartShape(R * 0.42), { depth: R * 0.22, bevelEnabled: true, bevelSize: R * 0.06, bevelThickness: R * 0.06, bevelSegments: 3 });
    geo.center();
    const heart = new THREE.Mesh(geo, matte('#E5484D', { emissive: '#A0161B', emissiveIntensity: 0.35, roughness: 0.4 }));
    inner.add(heart);
    return {
      glass: glassMat('#FBE5E6', 0.24),
      inner,
      update(t) {
        const beat = Math.pow(Math.max(0, Math.sin(t * 5.5)), 6);
        heart.scale.setScalar(1 + beat * 0.16);
        heart.rotation.y = Math.sin(t * 0.8) * 0.6;
      },
    };
  },
  atom: (R) => {
    const inner = new THREE.Group();
    const nucleus = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(R * 0.11, 12, 8), matte(i % 2 ? '#E8907E' : '#8FA6E0'));
      p.position.set(Math.sin(i * 2.4) * R * 0.09, Math.cos(i * 1.7) * R * 0.09, Math.sin(i * 3.1) * R * 0.09);
      nucleus.add(p);
    }
    inner.add(nucleus);
    const orbits: THREE.Group[] = [];
    for (let i = 0; i < 3; i++) {
      const o = new THREE.Group();
      o.rotation.set((i * Math.PI) / 3, (i * Math.PI) / 5, 0);
      o.add(new THREE.Mesh(new THREE.TorusGeometry(R * 0.66, R * 0.012, 6, 48), matte('#B3A3E0', { emissive: '#B3A3E0', emissiveIntensity: 0.4 })));
      const e = new THREE.Mesh(new THREE.SphereGeometry(R * 0.07, 10, 8), matte('#7FE3F0', { emissive: '#4FC9D9', emissiveIntensity: 0.8 }));
      e.name = 'e';
      o.add(e);
      inner.add(o);
      orbits.push(o);
    }
    return {
      glass: glassMat('#EEEAF7', 0.2),
      inner,
      update(t) {
        nucleus.rotation.y = t * 0.7;
        orbits.forEach((o, i) => {
          const a = t * (2.2 + i * 0.6) + i * 2;
          o.getObjectByName('e')!.position.set(Math.cos(a) * R * 0.66, Math.sin(a) * R * 0.66, 0);
        });
      },
    };
  },
  galaxy: (R) => {
    const inner = new THREE.Group();
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(256, 256);
    for (let py = 0; py < 256; py++) {
      for (let px = 0; px < 256; px++) {
        const dx = (px - 128) / 128;
        const dy = (py - 128) / 128;
        const r = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx);
        const arm = Math.pow(Math.max(0, Math.cos(2 * (a - Math.log(r + 0.05) * 2.2))), 3);
        const core = Math.exp(-r * r * 30);
        const v = Math.max(0, (arm * (1 - r) * 0.9 + core) * (r < 1 ? 1 : 0));
        const i = (py * 256 + px) * 4;
        img.data[i] = 200 + 55 * core;
        img.data[i + 1] = 150 + 90 * core;
        img.data[i + 2] = 255;
        img.data[i + 3] = Math.min(255, v * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(R * 1.6, R * 1.6), new THREE.MeshBasicMaterial({ map: canvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    disc.rotation.x = -0.5;
    inner.add(disc);
    const stars: THREE.Mesh[] = [];
    const sg = new THREE.SphereGeometry(R * 0.022, 5, 4);
    for (let i = 0; i < 30; i++) {
      const s = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true }));
      const [x, y, z] = FIB[(i * 37) % FIB.length];
      const rr = R * (0.4 + 0.45 * hash3(i, 2, 9));
      s.position.set(x * rr, y * rr, z * rr);
      inner.add(s);
      stars.push(s);
    }
    return {
      glass: glassMat('#2B2350', 0.55),
      inner,
      update(t) {
        disc.rotation.z = -t * 0.6;
        stars.forEach((s, i) => ((s.material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i))));
      },
    };
  },
  solar: (R) => {
    const inner = new THREE.Group();
    const sun = new THREE.Mesh(new THREE.SphereGeometry(R * 0.2, 20, 14), matte('#FFC23D', { emissive: '#FF9A1F', emissiveIntensity: 0.9 }));
    inner.add(sun);
    const planets: { m: THREE.Mesh; r: number; sp: number }[] = [];
    const defs: [string, number, number, number][] = [
      ['#B9B2A8', 0.05, 0.34, 2.6],
      ['#E9B872', 0.07, 0.48, 1.8],
      ['#3D8ED0', 0.075, 0.62, 1.3],
      ['#C1502E', 0.06, 0.75, 1.0],
    ];
    for (const [col, size, r, sp] of defs) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(R * size, 14, 10), matte(col));
      inner.add(m);
      const path = new THREE.Mesh(new THREE.TorusGeometry(R * r, R * 0.006, 4, 48), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.35 }));
      path.rotation.x = Math.PI / 2;
      inner.add(path);
      planets.push({ m, r: R * r, sp });
    }
    inner.rotation.x = 0.45;
    return {
      glass: glassMat('#1E2448', 0.5),
      inner,
      update(t) {
        sun.rotation.y = t;
        planets.forEach((p, i) => {
          const a = t * p.sp + i * 1.7;
          p.m.position.set(Math.cos(a) * p.r, 0, Math.sin(a) * p.r);
        });
      },
    };
  },
};

export function magicSkin(key: string, R: number): MagicSkin | null {
  const f = MAGIC[key];
  if (!f) return null;
  const m = f(R);
  m.inner.traverse((o) => {
    o.renderOrder = Math.max(o.renderOrder, 1);
  });
  return m;
}

const iconCache = new Map<string, string>();

/** Mağaza ikonu: desenin önden görünen, ışıklandırılmış küçük top resmi (data URL) */
export function skinIconUrl(key: string, size = 72): string | null {
  const hit = iconCache.get(key);
  if (hit) return hit;
  const src = skinCanvas(key);
  if (!src) return null;
  const sd = src.getContext('2d')!.getImageData(0, 0, W, H).data;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const L = [-0.42, 0.52, 0.74];
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const nx = ((px + 0.5) / size) * 2 - 1;
      const ny = 1 - ((py + 0.5) / size) * 2;
      const r2 = nx * nx + ny * ny;
      if (r2 > 1) continue;
      const nz = Math.sqrt(1 - r2);
      const th = Math.acos(Math.max(-1, Math.min(1, ny)));
      let ph = Math.atan2(nz, -nx);
      if (ph < 0) ph += Math.PI * 2;
      const sx = Math.min(W - 1, Math.floor((ph / (Math.PI * 2)) * W));
      const sy = Math.min(H - 1, Math.floor((th / Math.PI) * H));
      const si = (sy * W + sx) * 4;
      const dif = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      const k = 0.55 + 0.5 * dif;
      const spec = Math.pow(dif, 24) * 60;
      const i = (py * size + px) * 4;
      img.data[i] = Math.min(255, sd[si] * k + spec);
      img.data[i + 1] = Math.min(255, sd[si + 1] * k + spec);
      img.data[i + 2] = Math.min(255, sd[si + 2] * k + spec);
      img.data[i + 3] = Math.min(255, (1 - Math.sqrt(r2)) * size * 0.5 * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = c.toDataURL('image/png');
  iconCache.set(key, url);
  return url;
}
