// Kara kalem taslaklardan gelen el çizimi yollar (Kıvrımlı asansör taslakları, 2026-11).
// Her nokta [x, y, köşe yarıçapı?]; köşeler yarıçapla yuvarlanır, sonra yol eşit aralıkla örneklenir.
// Taslaklarda yol genişliği en çok 195; yan yana iki yol arası en az 250 (doğrulayıcı: genişlik + 40).

export type SketchName = 'kivrimKuyulari' | 'asansorKivrimli' | 'asansorTumsekli';

interface Template {
  /** Varsayılan köşe yarıçapı */
  r: number;
  pts: [number, number, number?][];
}

const C1_TOP: [number, number, number?][] = [
  [830, 3350], [540, 3350], [540, 3060], [180, 3060], [180, 3500, 110], [340, 3700, 110], [180, 3900, 110], [340, 4100, 110],
  [260, 4250, 60], [260, 4450], [880, 4450], [880, 3700], [620, 3700], [620, 4180],
];

export const SKETCHES: Record<SketchName, Template> = {
  // A2 · Kıvrım Kuyuları, dolu
  kivrimKuyulari: {
    r: 165,
    pts: [
      [500, 0], [860, 150, 110], [860, 600, 140], [700, 780, 140], [860, 960, 140], [860, 1150], [500, 1150], [500, 550], [170, 550],
      [170, 1450, 160], [820, 1720, 160], [580, 1980, 160], [180, 2230, 160], [420, 2480, 160], [830, 2750, 160],
      [830, 3850], [500, 3850], [500, 3150], [170, 3150], [170, 4150, 140], [400, 4400, 140], [650, 4150, 140], [850, 4400, 140], [620, 4650],
    ],
  },
  // C1 · Asansör, kıvrımlı
  asansorKivrimli: {
    r: 28,
    pts: [
      [500, 0], [875, 0], [875, 780], [625, 780], [625, 350], [375, 350], [375, 1080], [125, 1080],
      [125, 1400, 200], [830, 1850, 220], [170, 2350, 220], [830, 2850, 120], ...C1_TOP,
    ],
  },
  // C2 · Asansör, tümsekli
  asansorTumsekli: {
    r: 28,
    pts: [
      [500, 0], [530, 0, 70], [610, 110, 70], [690, 0, 70], [875, 0], [875, 780], [625, 780], [625, 350], [375, 350], [375, 1080], [125, 1080],
      [125, 1400, 140], [400, 1650, 120], [560, 1540, 120], [830, 1850, 180], [600, 2050, 120], [480, 1960, 120], [170, 2350, 180],
      [400, 2580, 120], [540, 2480, 120], [830, 2850, 120], ...C1_TOP,
    ],
  },
};

export interface SketchRoad {
  /** Eşit aralıklı yol noktaları */
  pts: { x: number; y: number }[];
  /** Taslaktaki her köşenin en yakın örnek indeksi (virajlar) */
  corners: number[];
}

/**
 * Taslağı oyun yoluna çevirir. mirror: soldan sağa ayna; stretch: dikey uzatma;
 * lift: başlangıçtan önce düz çıkış (yolun ilk yatay kısmı tahtanın dibine değmesin).
 */
export function sketchRoad(name: SketchName, opts: { mirror?: boolean; stretch?: number; lift?: number; step?: number } = {}): SketchRoad {
  const { mirror = false, stretch = 1, lift = 200, step = 55 } = opts;
  const t = SKETCHES[name];
  const P = [
    { x: 500, y: 0, r: 0 },
    ...t.pts.map(([x, y, r]) => ({ x: mirror ? 1000 - x : x, y: y * stretch + lift, r: r ?? t.r })),
  ];
  // köşeleri ikinci dereceden eğriyle yuvarla
  const key: { x: number; y: number; corner?: boolean }[] = [P[0]];
  for (let i = 1; i < P.length - 1; i++) {
    const A = P[i - 1];
    const C = P[i];
    const B = P[i + 1];
    const dA = Math.hypot(A.x - C.x, A.y - C.y);
    const dB = Math.hypot(B.x - C.x, B.y - C.y);
    const tA = Math.min(C.r, dA / 2) / dA;
    const tB = Math.min(C.r, dB / 2) / dB;
    const p1 = { x: C.x + (A.x - C.x) * tA, y: C.y + (A.y - C.y) * tA };
    const p2 = { x: C.x + (B.x - C.x) * tB, y: C.y + (B.y - C.y) * tB };
    key.push(p1);
    for (let k = 1; k <= 14; k++) {
      const s = k / 14;
      const u = 1 - s;
      key.push({ x: u * u * p1.x + 2 * u * s * C.x + s * s * p2.x, y: u * u * p1.y + 2 * u * s * C.y + s * s * p2.y, corner: k === 7 });
    }
  }
  key.push(P[P.length - 1]);
  // yay uzunluğuna göre eşit aralıkla örnekle
  const cum = [0];
  for (let i = 1; i < key.length; i++) cum.push(cum[i - 1] + Math.hypot(key[i].x - key[i - 1].x, key[i].y - key[i - 1].y));
  const total = cum[cum.length - 1];
  const n = Math.max(2, Math.round(total / step));
  const pts: { x: number; y: number }[] = [];
  let j = 0;
  for (let i = 0; i <= n; i++) {
    const s = (total * i) / n;
    while (j < key.length - 2 && cum[j + 1] < s) j++;
    const f = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
    pts.push({ x: key[j].x + (key[j + 1].x - key[j].x) * f, y: key[j].y + (key[j + 1].y - key[j].y) * f });
  }
  const corners: number[] = [];
  key.forEach((k, i) => {
    if (!k.corner) return;
    corners.push(Math.min(n, Math.round((cum[i] / total) * n)));
  });
  return { pts, corners };
}
