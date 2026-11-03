// Dünya 1–4 için 40 etap üretir: npm run levels (sadece bir dünya: npm run levels w4)
// Tohumlu rastgelelik: aynı tohum hep aynı etabı verir.
// Her etap otopilotla oynatılır; bitirilemiyorsa tohum değiştirilip yeniden denenir.
// Süre hedefleri bot süresinden türetilir (oyun testinde ayarlanabilir).

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRoute, runAutopilot, DEFAULT_AUTOPILOT } from '../src/game/autopilot';
import { Simulation } from '../src/game/physics/sim';
import { Track } from '../src/game/physics/track';
import { crossings, validateLevel } from '../src/game/levels/validate';
import type { Branch, LevelData, Popper, RoadPoint, SpinArm, TrapHole, VacuumZone, WindZone } from '../src/game/levels/types';
import { hasTimedObstacles, safeSpot } from '../src/game/physics/obstacles';
import { timeTargetsFromBot } from '../src/config/scoring';
import { sketchRoad, type SketchName } from './sketch-templates';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'levels');
const W = 1000;


/**
 * Yeni başlayanlar için yol genişliği çarpanı (oyun testinden sonra eklendi):
 * Dünya 1'in 1–3. etapları %50, 4–6. etapları %30, 7–9. etapları %10 daha geniş.
 */
const WIDTH_BOOST: Record<number, number[]> = {
  1: [1.5, 1.5, 1.5, 1.3, 1.3, 1.3, 1.1, 1.1, 1.1, 1],
  // Orman'a geçiş yumuşak olsun: ilk etaplar %20, %15, %10 geniş
  2: [1.2, 1.15, 1.1, 1, 1, 1, 1, 1, 1, 1],
};

const NAMES: Record<number, string[]> = {
  1: ['İlk Adım', 'Çayır Yolu', 'Papatya Virajı', 'Salıncak', 'Kelebek', 'Yonca', 'Rüzgârgülü', 'Gölgelik', 'Çimen Dansı', 'Büyük Çayır'],
  2: ['Orman Girişi', 'Çam Yolu', 'Dar Patika', 'Mantar', 'Sincap', 'Yosunlu Taş', 'Baykuş', 'İğne Deliği', 'Kızılçam', 'Orman Kalbi'],
  3: ['Labirent Kapısı', 'Çit Arası', 'Gül Bahçesi', 'İki Yol', 'Sarmaşık', 'Fıskiye', 'Şimşek Yolu', 'Düğüm', 'Gizli Geçit', 'Bahçe Zirvesi'],
  4: ['Göl Kıyısı', 'Sazlık', 'Kayık İskelesi', 'Nilüfer', 'Ördek Yolu', 'Deniz Feneri', 'Dalgakıran', 'Gün Batımı', 'Ay Işığı', 'Göl Zirvesi'],
};

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const r10 = (x: number) => Math.round(x / 10) * 10;

interface Plan {
  world: number;
  /** Zorluk sırası (özellikler buna göre seçilir) */
  index: number;
  /** Etap numarası (dosya adı); yoksa index + 1 */
  num?: number;
  /** Etap adı; yoksa NAMES tablosundan */
  name?: string;
  /** Yol genişliği çarpanı; yoksa WIDTH_BOOST tablosundan */
  boost?: number;
  /** Dünya 4–6: engel sayıları [delik, fırlatıcı, dönen kol] */
  obst?: [number, number, number];
  /** Dünya 5–6: rüzgâr bölgesi sayısı ve gücü (0..1 arası güç) */
  wind?: { n: number; force: number; pulse?: boolean };
  /** Hedef bot süresi (sn); yoksa ilerlemeden hesaplanır */
  want?: number;
  /** 'varied': kenardan kenara zikzak yerine karışık desenli yol; 'sketch': kara kalem taslaktan el çizimi yol */
  shape?: 'varied' | 'sketch';
  /** shape 'sketch': hangi taslak, ayna mı, dikey uzatma */
  sketch?: SketchName;
  mirror?: boolean;
  stretch?: number;
  /** 0..1 dünya içindeki zorluk */
  d: number;
  /** 0..1 bütün etaplar boyunca ilerleme (uzunluk buna göre artar) */
  prog: number;
}

/** Hedef bot süresi (sn): ilk etap ~15, son etap ~60 (dikkatli oyuncu için ~2 dk) */
export const targetTime = (prog: number) => 15 + 45 * Math.pow(prog, 1.1);
/** Kenar boşluğu: yolun kenarı tahtanın ucuna bu kadar yaklaşır */
const MARGIN = 28;

/** Uniform Catmull-Rom (track.ts ile aynı) */
function cr(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** j ile j+1 arasındaki eğrinin tahtanın ortasından en uzak kenarı */
function reach(road: RoadPoint[], j: number): number {
  const n = road.length;
  const p0 = road[Math.max(0, j - 1)];
  const p1 = road[j];
  const p2 = road[j + 1];
  const p3 = road[Math.min(n - 1, j + 2)];
  let m = 0;
  for (let k = 0; k <= 20; k++) {
    const x = cr(p0.x, p1.x, p2.x, p3.x, k / 20);
    m = Math.max(m, Math.abs(x - 500) + Math.max(p1.w, p2.w) / 2);
  }
  return m;
}

type TravKind = 'steep' | 'flat' | 'down';

const idOf = (p: Plan) => `w${p.world}-${String(p.num ?? p.index + 1).padStart(2, '0')}`;
const nameOf = (p: Plan) => p.name ?? NAMES[p.world][p.index];

function buildLevel(p: Plan, seed: number, lenScale: number): LevelData {
  const R = rng(seed);
  const { world, index, d, prog } = p;
  const id = idOf(p);
  const boost = p.boost ?? WIDTH_BOOST[world]?.[index] ?? 1;

  // Dünya ve zorluğa göre ölçüler
  const baseW = (world === 1 ? lerp(250, 190, d) : world === 2 ? lerp(210, 175, d) : lerp(200, 175, d)) * boost;
  const narrowW = (world === 2 ? lerp(150, 115, d) : world === 3 ? lerp(140, 115, d) : baseW / boost) * boost;
  // Yolun hedef uzunluğu (bot hızı ~150 birim/sn varsayımıyla; süre tutmazsa ölçek düzeltilir)
  const wantLen = (p.want ?? targetTime(prog)) * 150 * lenScale;
  // Yatık çıkış ve iniş olasılıkları
  const pFlat = world === 1 && index < 3 ? 0.4 : lerp(0.5, 0.65, prog);
  const pDown = world === 1 ? (index < 3 ? 0 : index < 6 ? 0.18 : 0.25) : 0.25;
  const maxDown = world === 1 ? (index < 3 ? 0 : index < 6 ? 1 : 2) : world === 2 ? 3 : 3;

  const pick = (prev: TravKind | null, downs: number): TravKind => {
    if (prev !== null && prev !== 'down' && downs < maxDown && R() < pDown) return 'down';
    return R() < pFlat ? 'flat' : 'steep';
  };
  const rise = (k: TravKind) => (k === 'steep' ? lerp(300, 400, R()) : k === 'flat' ? lerp(170, 260, R()) : -lerp(110, 190, R()));

  const road: RoadPoint[] = [{ x: 500, y: 0, w: r10(baseW + 30) }, { x: 500, y: 260, w: r10(baseW + 20) }];
  /** Kenardaki U dönüşleri: alt ve üst nokta indeksleri */
  const turns: { bot: number; top: number; side: number }[] = [];
  /** Her geçişin türü (turns[i]'ye varan geçiş) */
  const travKinds: TravKind[] = [];
  const narrowSpots: number[] = [];
  let side = R() < 0.5 ? -1 : 1;
  let y = 260;
  let kind: TravKind = 'steep';
  let r = lerp(260, 340, R());
  let downs = 0;
  let len = 260;
  let px = 500;
  let k = 0;
  while (len + 1000 < wantLen || turns.length < 2) {
    const w = baseW;
    const X = 500 + side * (500 - MARGIN - w / 2);
    // Geçişin ortası (dar geçit olabilir)
    let mw = baseW * lerp(0.92, 1.05, R());
    if (world >= 2 && k % 2 === 1 && R() < lerp(0.5, 0.8, d)) {
      mw = narrowW;
      narrowSpots.push(road.length);
    }
    road.push({ x: r10((px + X) / 2), y: r10(y + r / 2), w: r10(mw) });
    const yb = y + r;
    len += Math.hypot(X - px, r);
    // Bir sonraki geçişi şimdiden seç: U'nun yüksekliği iki geçişe göre ayarlanır
    const next = pick(kind, downs + (kind === 'down' ? 1 : 0));
    const rn = rise(next);
    const Emin = w + 90;
    let E = Emin + lerp(0, 70, R());
    // Karşı kenarda iki geçiş arasında yer kalsın
    E = Math.max(E, Emin + 60 - r - rn);
    road.push({ x: r10(X), y: r10(yb), w: r10(w) });
    road.push({ x: r10(X), y: r10(yb + E), w: r10(w) });
    turns.push({ bot: road.length - 2, top: road.length - 1, side });
    travKinds.push(kind);
    if (kind === 'down') downs++;
    len += E;
    y = yb + E;
    px = X;
    side = -side;
    kind = next;
    r = rn;
    k++;
    if (k > 60) break;
  }
  // Bitiş: son U'dan karşıya doğru, kalan uzunluk kadar giden yatık bir yol
  const remain = Math.max(250, wantLen - len);
  const dir = Math.sign(500 - px);
  const dx = clamp(remain * 0.8, 220, 700);
  const fRise = clamp(remain * 0.35, 220, 400);
  road.push({ x: r10(px + dir * dx * 0.5), y: r10(y + fRise * 0.55), w: r10(baseW) });
  road.push({ x: r10(px + dir * dx), y: r10(y + fRise), w: r10(baseW * 0.95) });
  // U dönüşlerini kenara tam oturt (eğri dışarı taşmasın, içeride de kalmasın)
  for (let it = 0; it < 6; it++) {
    for (const tn of turns) {
      const ex = reach(road, tn.bot) - (500 - MARGIN);
      for (const j of [tn.bot, tn.top]) road[j].x = r10(road[j].x - Math.sign(road[j].x - 500) * ex);
    }
  }
  for (const tn of turns) {
    for (const j of [tn.bot, tn.top]) road[j].x = clamp(road[j].x, road[j].w / 2 + 10, W - road[j].w / 2 - 10);
  }
  const last = road[road.length - 1];
  const height = r10(last.y + 140);
  const topY = last.y;
  const finishHole = { x: last.x, y: last.y, r: 46 };

  // Dünya 3: kısa yol. Ana yol karşı kenara gidip geri döner; kısa yol aynı kenardan
  // dar bir şeritle dosdoğru çıkar. Uzun yolun karşı kenarında bir kontrol noktası olur.
  const branches: Branch[] = [];
  const forkCps: number[] = [];
  const forkRanges: [number, number][] = [];
  const nBranch = world === 3 ? (d > 0.5 ? 2 : 1) : 0;
  if (world === 3) {
    const used: number[] = [];
    for (let b = 0; b < nBranch; b++) {
      const cands: number[] = [];
      for (let t = 0; t + 2 < turns.length - 1; t++) {
        // Ayrımın içindeki iki geçiş yukarı çıkmalı
        if (travKinds[t + 1] === 'down' || travKinds[t + 2] === 'down') continue;
        if (used.some((u) => Math.abs(u - t) < 3)) continue;
        cands.push(t);
      }
      if (!cands.length) break;
      const t = cands[Math.floor(R() * cands.length)];
      used.push(t);
      const A = road[turns[t].top];
      const B = road[turns[t + 2].bot];
      const inward = -Math.sign(A.x - 500);
      const bw = r10(narrowW);
      branches.push({
        type: 'short',
        points: [
          { x: A.x, y: A.y, w: bw },
          { x: r10(A.x + inward * 30), y: r10(lerp(A.y, B.y, 0.33)), w: bw },
          { x: r10(A.x + inward * 30), y: r10(lerp(A.y, B.y, 0.67)), w: bw },
          { x: B.x, y: B.y, w: bw },
        ],
      });
      forkRanges.push([A.y, B.y]);
      // Uzun yolun karşı kenardaki U dönüşünün ortası
      const U = turns[t + 1];
      forkCps.push(r10((road[U.bot].y + road[U.top].y) / 2));
    }
  }

  // Kontrol noktaları: uzunluğa göre 1–3 (çatalların dışında) + her çatalda bir tane
  const nCp = Math.min(4 - forkCps.length, wantLen < 3600 ? 1 : wantLen < 6500 ? 2 : 3);
  const checkpoints: number[] = [];
  const mainLine = new Track({ id, name: '', world, height, boardWidth: W, road, finishHole, stars: [], timeTargets: { bronze: 3, silver: 2, gold: 1 } }).main;
  const once = (cy: number) => crossings(mainLine, cy) === 1 && crossings(mainLine, cy - 60) === 1 && crossings(mainLine, cy + 60) === 1;
  const inFork = (cy: number) => forkRanges.some(([a, b]) => cy > a - 80 && cy < b + 80);
  for (const fc of forkCps) {
    for (let off = 0; off < 200; off += 10) {
      const cand = [fc + off, fc - off].find((cy) => once(cy));
      if (cand !== undefined) {
        checkpoints.push(cand);
        break;
      }
    }
  }
  for (let c = 1; c <= nCp; c++) {
    const want = r10((topY * c) / (nCp + 1));
    for (let off = 0; off < topY; off += 10) {
      const cand = [want + off, want - off].find((cy) => cy > 300 && cy < topY - 200 && once(cy) && !inFork(cy) && !checkpoints.some((q) => Math.abs(q - cy) < 400));
      if (cand !== undefined) {
        checkpoints.push(cand);
        break;
      }
    }
  }
  checkpoints.sort((a, b) => a - b);

  // Vakum: U dönüşlerinin üstünde (Dünya 1'de her dönüşte, sonra azalır)
  const vacuum: VacuumZone[] = [];
  turns.forEach((tn, i) => {
    const pt = road[tn.top];
    if (world === 1 || (world === 2 && i % 2 === 0) || (world === 3 && i % 3 === 0)) {
      vacuum.push({ x: pt.x, y: pt.y, radius: r10(pt.w * 0.9 + 60), strength: world === 1 ? 0.6 : 0.55 });
    }
  });
  for (const i of narrowSpots) {
    const pt = road[i];
    vacuum.push({ x: pt.x, y: pt.y, radius: r10(pt.w * 0.9 + 60), strength: 0.55 });
  }

  const level: LevelData = {
    id,
    name: nameOf(p),
    world,
    height,
    boardWidth: W,
    road,
    ...(branches.length ? { branches } : {}),
    finishHole,
    checkpoints,
    stars: [],
    vacuum,
    timeTargets: { bronze: 3, silver: 2, gold: 1 },
  };

  // Yıldızlar: yolun kenarına yakın, riskli yerlere (kısa yol varsa biri orada)
  const track = new Track(level);
  const stars: { x: number; y: number }[] = [];
  const fr = [0.3, 0.58, 0.84];
  for (let s = 0; s < 3; s++) {
    if (world === 3 && s === 1 && branches.length) {
      const bp = branches[0].points;
      stars.push({ x: r10((bp[1].x + bp[2].x) / 2), y: r10((bp[1].y + bp[2].y) / 2) });
      continue;
    }
    // Yolun tek geçtiği bir yüksekliğe koy
    let sy = r10(topY * fr[s] + lerp(-120, 120, R()));
    for (let off = 0; off < 600; off += 10) {
      const c = [sy + off, sy - off].find((q) => crossings(mainLine, q) === 1);
      if (c !== undefined) {
        sy = c;
        break;
      }
    }
    const cx = track.centerXAt(sy);
    const hw = track.widthAt(sy) / 2;
    const off = (R() < 0.5 ? -1 : 1) * hw * lerp(0.25, 0.45, d);
    stars.push({ x: r10(clamp(cx + off, 40, W - 40)), y: sy });
  }
  level.stars = stars;
  return level;
}

/** Dünya 4 hedef bot süresi (engellerde bekleme dahil, sn) */
const targetTime4 = (d: number) => lerp(52, 78, d);
/** Dünya 4'te yol tahtanın kenarına daha çok yaklaşır */
const MARGIN4 = 16;
/** Dünya 4 etaplarındaki engel sayıları: [delik, fırlatıcı, dönen kol] */
const OBSTACLES4: [number, number, number][] = [
  [3, 0, 0],
  [2, 2, 0],
  [2, 3, 0],
  [2, 1, 2],
  [2, 2, 2],
  [3, 2, 2],
  [2, 3, 3],
  [3, 2, 3],
  [3, 3, 3],
  [4, 3, 4],
];

/**
 * Dünya 4 (Göl Kenarı): uzun, kenardan kenara giden, sık sık inip yeniden çıkan yollar
 * ve engeller (düşürme deliği, fırlatıcı, dönen kol). Her geçişte iki engel yeri var
 * (1/3 ve 2/3); dönen kol bir geçişte tek başına durur.
 */
function buildWorld4(p: Plan, seed: number, lenScale: number): LevelData {
  const R = rng(seed);
  const { world, index, d } = p;
  const id = idOf(p);
  const baseW = lerp(205, 185, d) * (p.boost ?? 1);
  const wantLen = (p.want !== undefined ? p.want * 0.88 : lerp(46, 64, d)) * 150 * lenScale;
  const rise = (k: TravKind) => (k === 'steep' ? lerp(300, 400, R()) : k === 'flat' ? lerp(170, 260, R()) : -lerp(140, 240, R()));
  // Çıkış, iniş, çıkış, iniş...: iniş ardışık olmaz ama sık gelir
  const pick = (prev: TravKind): TravKind => (prev !== 'down' && R() < 0.6 ? 'down' : R() < 0.55 ? 'flat' : 'steep');

  const road: RoadPoint[] = [{ x: 500, y: 0, w: r10(baseW + 30) }, { x: 500, y: 260, w: r10(baseW + 20) }];
  const turns: { bot: number; top: number }[] = [];
  /** Engel yerleri: yol noktası indeksi ve geçiş numarası */
  const slots: { i: number; k: number }[] = [];
  /** Her geçişin baş ve son yol noktası (rüzgâr bölgeleri için) */
  const segs: { a: number; b: number }[] = [];
  let side = R() < 0.5 ? -1 : 1;
  let y = 260;
  let kind: TravKind = 'steep';
  let r = lerp(260, 340, R());
  let len = 260;
  let px = 500;
  let k = 0;
  if (p.shape === 'sketch') {
    // Taslak yol: köşeler viraj, köşe arası parçalar geçiş (engel ve rüzgâr yerleri)
    const sk = sketchRoad(p.sketch!, { mirror: p.mirror, stretch: (p.stretch ?? 1) * lenScale });
    // Yan yana yollar 250 aralıklı: genişlik en çok 195 (doğrulayıcı genişlik + 40 boşluk ister)
    const sw = Math.round(Math.min(baseW, 195));
    road.length = 0;
    const cs = new Set(sk.corners);
    // Engel yeri: yol orada 290'a kadar genişler; yan yana yollar (asansör sütunları) ve bitiş deliği uzak olmalı
    const end = sk.pts[sk.pts.length - 1];
    const roomy = (i: number) => {
      const q = sk.pts[i];
      if (Math.hypot(q.x - end.x, q.y - end.y) < 320) return false;
      return sk.pts.every((o, j) => Math.abs(i - j) * 55 < 450 || Math.hypot(o.x - q.x, o.y - q.y) > 300);
    };
    let segA = 0;
    sk.pts.forEach((q, i) => {
      road.push({ x: Math.round(q.x), y: Math.round(q.y), w: i < 4 ? sw + 30 - i * 8 : sw });
      if (i > 0 && i < sk.pts.length - 1 && cs.has(i)) {
        turns.push({ bot: i, top: i });
        if (i - segA > 2) segs.push({ a: segA, b: i });
        segA = i;
        k++;
      } else if (i > 4 && i < sk.pts.length - 3 && roomy(i)) slots.push({ i, k });
    });
    segs.push({ a: segA, b: road.length - 1 });
    const lp = road[road.length - 1];
    px = lp.x;
    y = lp.y;
  } else if (p.shape === 'varied') {
    // Farklı desen: parçalar karışık (dalga, dik tırmanış, merdiven, yatık ya da dik geçiş, iniş).
    // Kıvrımlar kenara oturtulmaz; "turns" burada sadece engelleri virajlardan uzak tutmak için.
    const lo = MARGIN4 + baseW / 2 + 10;
    const hi = W - lo;
    const add = (nx: number, ny: number, slot = false) => {
      const cx = clamp(nx, lo, hi);
      if (slot) slots.push({ i: road.length, k });
      len += Math.hypot(cx - px, ny - y);
      road.push({ x: r10(cx), y: r10(ny), w: r10(baseW) });
      px = cx;
      y = ny;
    };
    const bend = () => turns.push({ bot: road.length - 1, top: road.length - 1 });
    const climbE = () => lerp(baseW + 90, baseW + 150, R());
    let prev = '';
    while (len + 900 < wantLen) {
      const a = road.length - 1;
      const opts = ['cross', 'wave', 'climb', 'stairs', 'diag', 'down'].filter((m) => m !== prev);
      let m = opts[Math.floor(R() * opts.length)];
      const atEdge = Math.abs(px - 500) > 280;
      if (m === 'down' && (!atEdge || road.length < 5)) m = 'diag';
      const far = px < 500 ? hi : lo;
      const x0 = px;
      const y0 = y;
      if (m === 'cross' || m === 'diag') {
        const rr = m === 'cross' ? lerp(240, 380, R()) : R() < 0.5 ? lerp(110, 160, R()) : lerp(520, 680, R());
        const tx = m === 'cross' ? far : lerp(x0, far, lerp(0.65, 1, R()));
        add(lerp(x0, tx, 1 / 3), y0 + rr / 3, true);
        add(lerp(x0, tx, 2 / 3), y0 + (rr * 2) / 3, true);
        add(tx, y0 + rr);
        bend();
        add(tx + lerp(-30, 30, R()), y + climbE());
        bend();
      } else if (m === 'wave') {
        // Ortada sık kıvrımlar
        const A = lerp(110, 165, R());
        const cx = clamp(x0 + lerp(-120, 120, R()), lo + A, hi - A);
        const n = R() < 0.5 ? 3 : 4;
        const s0 = x0 < cx ? 1 : -1;
        for (let j = 0; j < n; j++) {
          add(cx + (j % 2 ? -s0 : s0) * A, y + lerp(200, 250, R()));
          bend();
        }
      } else if (m === 'climb') {
        // Uzun, neredeyse dik tırmanış (hafif yalpalayarak)
        add(x0 + lerp(-50, 50, R()), y0 + lerp(280, 360, R()), true);
        add(x0 + lerp(-50, 50, R()), y + lerp(260, 340, R()));
        bend();
      } else if (m === 'stairs') {
        // Merdiven: kısa yatık basamaklar, hep aynı yöne
        const dir = far > x0 ? 1 : -1;
        const steps = R() < 0.5 ? 2 : 3;
        for (let j = 0; j < steps; j++) {
          add(px + dir * lerp(190, 250, R()), y + lerp(70, 100, R()), j === 0);
          bend();
          add(px + dir * 15, y + lerp(170, 210, R()));
          bend();
        }
      } else {
        // İniş: önce kenarda yüksel, sonra karşıya doğru inerek geç, sonra yine yüksel
        const drop = lerp(140, 220, R());
        add(x0, y0 + baseW + 120 + drop);
        bend();
        const ys = y;
        add(lerp(x0, far, 1 / 3), ys - drop / 3, true);
        add(lerp(x0, far, 2 / 3), ys - (drop * 2) / 3, true);
        add(far, ys - drop);
        bend();
        add(far, y + baseW + 120 + drop * 0.5);
        bend();
      }
      segs.push({ a, b: road.length - 1 });
      prev = m;
      k++;
      if (k > 60) break;
    }
  } else
  while (len + 1000 < wantLen || turns.length < 3) {
    const segA = road.length - 1;
    const X = 500 + side * (500 - MARGIN4 - baseW / 2);
    for (const f of [1 / 3, 2 / 3]) {
      slots.push({ i: road.length, k });
      road.push({ x: r10(lerp(px, X, f) + lerp(-20, 20, R())), y: r10(y + r * f), w: r10(baseW) });
    }
    const yb = y + r;
    len += Math.hypot(X - px, r);
    const next = pick(kind);
    const rn = rise(next);
    const Emin = baseW + 90;
    let E = Emin + lerp(0, 60, R());
    E = Math.max(E, Emin + 90 - r - rn);
    road.push({ x: r10(X), y: r10(yb), w: r10(baseW) });
    road.push({ x: r10(X), y: r10(yb + E), w: r10(baseW) });
    turns.push({ bot: road.length - 2, top: road.length - 1 });
    segs.push({ a: segA, b: road.length - 2 });
    len += E;
    y = yb + E;
    px = X;
    side = -side;
    kind = next;
    r = rn;
    k++;
    if (k > 60) break;
  }
  if (p.shape !== 'sketch') {
    const remain = Math.max(250, wantLen - len);
    const dir = Math.sign(500 - px);
    const dx = clamp(remain * 0.8, 220, 700);
    const fRise = clamp(remain * 0.35, 220, 400);
    road.push({ x: r10(px + dir * dx * 0.5), y: r10(y + fRise * 0.55), w: r10(baseW) });
    road.push({ x: r10(px + dir * dx), y: r10(y + fRise), w: r10(baseW * 0.95) });
  }

  // Engelleri yerlere dağıt: önce kollar (geçişte tek), sonra fırlatıcı ve delikler
  // Dünya 1–3'ün farklı desenli etaplarında engel yok
  const [nH, nP, nA] = p.obst ?? (world >= 4 ? OBSTACLES4[index] : [0, 0, 0]);
  // Kol geçişin ortasına (iki yerin arasına) konur ve geçişi tek başına kullanır
  type Kind = 'hole' | 'pop' | 'arm' | 'armB';
  const midOf = (i: number) => ({ x: (road[i].x + road[i + 1].x) / 2, y: (road[i].y + road[i + 1].y) / 2 });
  const chosen = new Map<number, Kind>();
  const usedK = new Map<number, Kind[]>();
  const free = () => slots.filter((s) => !chosen.has(s.i));
  const place = (kd: Kind, n: number) => {
    for (let c = 0; c < n; c++) {
      const cands = free().filter((s) => {
        const ks = usedK.get(s.k) ?? [];
        if (kd !== 'hole' && s.k === 0) return false;
        // Kol, U dönüşlerinden uzak olmalı (oyuncu virajdayken kola girmesin)
        if (kd === 'arm') {
          if (ks.length || slots.find((q) => q.i === s.i + 1)?.k !== s.k) return false;
          const m = midOf(s.i);
          // Taslak yollarda köşeler sık: biraz daha yakın olabilir
          const gapT = p.shape === 'sketch' ? 220 : 320;
          return turns.every((tn) => [tn.bot, tn.top].every((j) => Math.hypot(road[j].x - m.x, road[j].y - m.y) > gapT));
        }
        // Delik ve fırlatıcı da virajın dibinde olmasın
        const far = turns.every((tn) => [tn.bot, tn.top].every((j) => Math.hypot(road[j].x - road[s.i].x, road[j].y - road[s.i].y) > 240));
        return far && ks.length < 2 && !ks.includes('arm') && !ks.includes(kd);
      });
      if (!cands.length) return;
      const s = cands[Math.floor(R() * cands.length)];
      chosen.set(s.i, kd);
      if (kd === 'arm') chosen.set(s.i + 1, 'armB');
      usedK.set(s.k, [...(usedK.get(s.k) ?? []), kd]);
    }
  };
  place('arm', nA);
  place('pop', nP);
  place('hole', nH);
  // Engel yerinde yolu genişlet
  const holeVariant = new Map<number, 'center' | 'side' | 'pair'>();
  for (const [i, kd] of chosen) {
    if (kd === 'arm' || kd === 'armB') road[i].w = 250;
    else if (kd === 'pop') road[i].w = r10(baseW);
    else {
      const v = index < 2 || (p.obst && d < 0.15) ? (R() < 0.5 ? 'center' : 'side') : (['center', 'side', 'pair'] as const)[Math.floor(R() * 3)];
      holeVariant.set(i, v);
      road[i].w = v === 'center' ? 270 : v === 'side' ? 230 : 290;
    }
  }

  // U dönüşlerini kenara tam oturt (farklı desenli yollarda yok)
  for (let it = 0; it < (p.shape ? 0 : 6); it++) {
    for (const tn of turns) {
      const ex = reach(road, tn.bot) - (500 - MARGIN4);
      for (const j of [tn.bot, tn.top]) road[j].x = r10(road[j].x - Math.sign(road[j].x - 500) * ex);
    }
  }
  for (const tn of turns) {
    for (const j of [tn.bot, tn.top]) road[j].x = clamp(road[j].x, road[j].w / 2 + 10, W - road[j].w / 2 - 10);
  }
  const last = road[road.length - 1];
  // Taslak yollar bitişten önce daha yükseğe çıkabilir (asansör tepesi): çubuk oraya da ulaşmalı
  const height = r10(Math.max(...road.map((q) => q.y)) + 140);
  const topY = last.y;
  const finishHole = { x: last.x, y: last.y, r: 46 };
  const base: LevelData = { id, name: nameOf(p), world, height, boardWidth: W, road, finishHole, stars: [], timeTargets: { bronze: 3, silver: 2, gold: 1 } };
  const mainLine = new Track(base).main;

  // Engeller: yolun o noktadaki dik yönüne göre yerleştirilir
  const holes: TrapHole[] = [];
  const poppers: Popper[] = [];
  const arms: SpinArm[] = [];
  for (const [i, kd] of [...chosen].sort((a, b) => a[0] - b[0])) {
    const pt = road[i];
    const prev = road[i - 1];
    const next = road[i + 1];
    const tl = Math.hypot(next.x - prev.x, next.y - prev.y) || 1;
    const nx = -(next.y - prev.y) / tl;
    const ny = (next.x - prev.x) / tl;
    const hw = pt.w / 2;
    if (kd === 'armB') continue;
    if (kd === 'arm') {
      const m = midOf(i);
      arms.push({
        x: Math.round(m.x),
        y: Math.round(m.y),
        length: r10(hw + 6),
        speed: Math.round((R() < 0.5 ? -1 : 1) * lerp(0.85, 1.25, d) * 100) / 100,
        phase: Math.round(R() * 628) / 100,
        // Tek kanatlı: iki kanatlıda geçecek boşluk çok kısa kalıyor
        blades: 1,
      });
    } else if (kd === 'pop') {
      poppers.push({ x: pt.x, y: pt.y, r: Math.round(lerp(62, 72, d)), period: Math.round(lerp(3.6, 3.0, d) * 10) / 10, up: 0.45, offset: Math.round(R() * 30) / 10 });
    } else {
      const v = holeVariant.get(i)!;
      if (v === 'center') holes.push({ x: pt.x, y: pt.y, r: 44 });
      else if (v === 'side') {
        const sd = R() < 0.5 ? -1 : 1;
        const o = sd * (hw - 44 - 10);
        holes.push({ x: Math.round(pt.x + nx * o), y: Math.round(pt.y + ny * o), r: 44 });
      } else {
        const o = hw - 40 - 12;
        for (const sd of [-1, 1]) holes.push({ x: Math.round(pt.x + nx * o * sd), y: Math.round(pt.y + ny * o * sd), r: 40 });
      }
    }
  }
  // Rüzgâr: engelsiz geçişlerin ortasında, yolu yana iten bölgeler
  const wind: WindZone[] = [];
  if (p.wind) {
    const kTotal = segs.length;
    const freeK: number[] = [];
    for (let kk = 1; kk < kTotal; kk++) if (!usedK.has(kk)) freeK.push(kk);
    // Yer yetmezse sadece delik olan geçişler de kullanılır (zamanlı engelle aynı yerde olmaz)
    const holeK: number[] = [];
    for (let kk = 1; kk < kTotal; kk++) if (usedK.get(kk)?.every((x) => x === 'hole')) holeK.push(kk);
    for (let c = 0; c < p.wind.n && (freeK.length || holeK.length); c++) {
      const pool = freeK.length ? freeK : holeK;
      const kk = pool.splice(Math.floor(R() * pool.length), 1)[0];
      const a = road[segs[kk].a];
      const b = road[segs[kk].b];
      // Taslak yollarda yatay parçalar kısa: kenar payı az, dik parçada yolu ortalayan bölge
      const pad = p.shape === 'sketch' ? 60 : 120;
      let x0 = Math.min(a.x, b.x) + pad;
      let x1 = Math.max(a.x, b.x) - pad;
      const y0 = Math.min(a.y, b.y);
      const y1 = Math.max(a.y, b.y);
      const hgt = Math.max(160, (y1 - y0) * 0.6);
      const ym = (y0 + y1) / 2;
      if (p.shape === 'sketch' && x1 - x0 < 200 && y1 - y0 > 260) {
        const cx = (a.x + b.x) / 2;
        x0 = cx - 130;
        x1 = cx + 130;
      }
      if (x1 - x0 < 200) continue;
      const f = Math.round(p.wind.force * lerp(0.85, 1.1, R()) * 100) / 100;
      wind.push({
        x: r10(x0),
        y: r10(ym - hgt / 2),
        w: r10(x1 - x0),
        h: r10(hgt),
        force: R() < 0.5 ? -f : f,
        ...(p.wind.pulse ? { pulse: Math.round(lerp(2.6, 3.4, R()) * 10) / 10 } : {}),
      });
    }
  }
  const obst = { ...base, holes, poppers, arms, ...(wind.length ? { wind } : {}) };

  // Kontrol noktaları: yolun tek geçtiği, engelden uzak yükseklikler
  const once = (cy: number) => {
    if (!(crossings(mainLine, cy) === 1 && crossings(mainLine, cy - 60) === 1 && crossings(mainLine, cy + 60) === 1)) return false;
    const t = new Track(base);
    return safeSpot(obst, t.centerXAt(cy), cy, 160);
  };
  const nCp = 3;
  const checkpoints: number[] = [];
  for (let c = 1; c <= nCp; c++) {
    const want = r10((topY * c) / (nCp + 1));
    for (let off = 0; off < topY; off += 10) {
      const cand = [want + off, want - off].find((cy) => cy > 300 && cy < topY - 200 && once(cy) && !checkpoints.some((q) => Math.abs(q - cy) < 400));
      if (cand !== undefined) {
        checkpoints.push(cand);
        break;
      }
    }
  }
  checkpoints.sort((a, b) => a - b);

  const level: LevelData = { ...obst, checkpoints, vacuum: [] };
  if (!holes.length) delete level.holes;
  if (!poppers.length) delete level.poppers;
  if (!arms.length) delete level.arms;

  // Yıldızlar: tek geçilen yüksekliklerde, yolun kenarına yakın, engelin üstünde değil
  const track = new Track(level);
  const stars: { x: number; y: number }[] = [];
  const fr = [0.3, 0.58, 0.84];
  for (let s = 0; s < 3; s++) {
    let sy = r10(topY * fr[s] + lerp(-120, 120, R()));
    let sx = 0;
    for (let off = 0; off < 1500; off += 10) {
      const c = [sy + off, sy - off].find((q) => {
        if (q < 200 || q > topY - 100 || crossings(mainLine, q) !== 1) return false;
        const cx = track.centerXAt(q);
        const hw = track.widthAt(q) / 2;
        const x = clamp(cx + (s % 2 ? -1 : 1) * hw * lerp(0.25, 0.45, d), 40, W - 40);
        if (!safeSpot(level, x, q, 30)) return false;
        sx = x;
        return true;
      });
      if (c !== undefined) {
        sy = c;
        break;
      }
    }
    stars.push({ x: r10(sx), y: sy });
  }
  level.stars = stars;
  return level;
}

function evaluate(level: LevelData, plan: Plan): { ok: boolean; time: number; falls: number; reason?: string } {
  const wantBranches = plan.world === 3 && plan.shape !== 'sketch' ? (plan.d > 0.5 ? 2 : 1) : 0;
  if ((level.branches?.length ?? 0) < wantBranches) return { ok: false, time: 0, falls: 0, reason: 'kısa yola yer yok' };
  // Dünya 4: istenen sayıda dönen kol yerleşmeli (bot kolsuz denemeleri seçmesin)
  const wantArms = plan.world >= 4 ? (plan.obst ?? OBSTACLES4[plan.index])[2] : 0;
  if ((level.arms?.length ?? 0) < wantArms) return { ok: false, time: 0, falls: 0, reason: 'kola yer yok' };
  if (plan.wind && (level.wind?.length ?? 0) < plan.wind.n) return { ok: false, time: 0, falls: 0, reason: 'rüzgâra yer yok' };
  const res = runAutopilot(new Simulation(level, { ball: 'standard', assist: false }), DEFAULT_AUTOPILOT, 200);
  if (!res.finished) return { ok: false, time: 0, falls: res.falls, reason: 'bitmedi' };
  if (res.falls > 0) return { ok: false, time: res.time, falls: res.falls, reason: 'düştü' };
  // Bot bir yerde sürünüyorsa etap fazla sıkışık demektir
  // Yolun gerçek uzunluğuna göre hız (kıvrımlı ve aşağı dönen yollar daha uzun)
  const routeLen = buildRoute(new Track(level).lines, false, level).total;
  if (routeLen / res.time < (hasTimedObstacles(level) ? 75 : 120)) return { ok: false, time: res.time, falls: 0, reason: `yavaş (${res.time.toFixed(1)} sn)` };
  // Ağır ve buz top da bitirebilmeli (düşmeye izin var)
  for (const ball of ['ice', 'light'] as const) {
    const r = runAutopilot(new Simulation(level, { ball, assist: false }), DEFAULT_AUTOPILOT, 240);
    if (!r.finished) return { ok: false, time: 0, falls: r.falls, reason: `${ball} bitmedi` };
  }
  if (level.branches?.length) {
    const r = runAutopilot(new Simulation(level, { ball: 'standard', assist: false }), { ...DEFAULT_AUTOPILOT, preferShort: true }, 200);
    if (!r.finished) return { ok: false, time: 0, falls: r.falls, reason: 'kısa yol bitmedi' };
    process.stdout.write(`    kısa yol ${r.time.toFixed(1)} sn (düşme ${r.falls}) / uzun yol ${res.time.toFixed(1)} sn\n`);
  }
  return { ok: true, time: res.time, falls: 0 };
}

// ---------- Etap listesi ----------
// Eski 40 etap (w1-01..w4-10) bu listeyle üretilmişti; yeniden üretilmezler
// (oyuncu kayıtları ve rekorlar onlara bağlı). Yeni etaplar NEW_PLANS içinde.
const OLD_PLANS: Plan[] = [];
for (const world of [1, 2, 3, 4]) {
  for (let index = 0; index < 10; index++) {
    OLD_PLANS.push({ world, index, d: index / 9, prog: Math.min(1, ((world - 1) * 10 + index) / 29) });
  }
}
const oldProg = (world: number, index: number) => Math.min(1, ((world - 1) * 10 + index) / 29);

/** Dünya 1–4'e eklenen kolay etaplar: zor etapların önüne konur (sıra: src/game/levels/order.ts) */
const NEW_PLANS: Plan[] = [
  // Dünya 1: geniş, kısa yollar; ilk aşağı dönüşü tanıtan yumuşak bir etap
  { world: 1, num: 11, name: 'Lale Bahçesi', index: 2, d: 2 / 9, prog: 0.03, boost: 1.5 },
  { world: 1, num: 12, name: 'Uçurtma', index: 3, d: 3 / 9, prog: 0.07, boost: 1.4 },
  { world: 1, num: 13, name: 'Arı Yolu', index: 6, d: 5 / 9, prog: 0.1, boost: 1.35, shape: 'varied', want: targetTime(0.1) },
  { world: 1, num: 14, name: 'Gökkuşağı', index: 7, d: 6 / 9, prog: 0.14, boost: 1.25 },
  { world: 1, num: 15, name: 'Kır Çiçeği', index: 8, d: 7 / 9, prog: 0.19, boost: 1.2, shape: 'varied', want: targetTime(0.19) },
  // Dünya 2: daha geniş, daha kısa orman yolları
  { world: 2, num: 11, name: 'Kozalak', index: 0, d: 0, prog: oldProg(1, 9), boost: 1.2 },
  { world: 2, num: 12, name: 'Geyik Patikası', index: 1, d: 1 / 9, prog: oldProg(2, 1), boost: 1.15 },
  { world: 2, num: 13, name: 'Eğreltiotu', index: 3, d: 2 / 9, prog: oldProg(2, 3), boost: 1.1, shape: 'varied', want: targetTime(oldProg(2, 3)) },
  { world: 2, num: 14, name: 'Ağaçkakan', index: 5, d: 4 / 9, prog: oldProg(2, 5), boost: 1.1 },
  { world: 2, num: 15, name: 'Dere Kenarı', index: 7, d: 6 / 9, prog: oldProg(2, 7), boost: 1.0, shape: 'varied', want: targetTime(oldProg(2, 7)) },
  // Dünya 3: kısa yollu, biraz daha geniş bahçe etapları
  { world: 3, num: 11, name: 'Taş Köprü', index: 0, d: 0, prog: oldProg(2, 9), boost: 1.15 },
  { world: 3, num: 12, name: 'Lavanta', index: 1, d: 1 / 9, prog: oldProg(3, 1), boost: 1.12 },
  { world: 3, num: 13, name: 'Çardak', index: 3, d: 3 / 9, prog: oldProg(3, 3), boost: 1.1 },
  { world: 3, num: 14, name: 'Gizemli Kapı', index: 5, d: 5 / 9, prog: oldProg(3, 5), boost: 1.08 },
  { world: 3, num: 15, name: 'Sarı Gül', index: 7, d: 7 / 9, prog: oldProg(3, 7), boost: 1.05 },
  // Dünya 4: daha az engelli, daha kısa göl etapları
  { world: 4, num: 11, name: 'Kamışlık', index: 0, d: 0, prog: 1, boost: 1.05, obst: [2, 0, 0], want: 40 },
  { world: 4, num: 12, name: 'Balıkçı', index: 1, d: 0.05, prog: 1, boost: 1.05, obst: [2, 1, 0], want: 46, shape: 'varied' },
  { world: 4, num: 13, name: 'Martı', index: 3, d: 0.15, prog: 1, obst: [1, 1, 1], want: 52 },
  { world: 4, num: 14, name: 'Su Kuşu', index: 5, d: 0.4, prog: 1, obst: [2, 1, 2], want: 58, shape: 'varied' },
  { world: 4, num: 15, name: 'Yakamoz', index: 7, d: 0.6, prog: 1, obst: [2, 2, 2], want: 64 },
];

/** Dünya 5 (Rüzgârlı Tepe): rüzgâr bölgeleri; ikinci yarıda delik ve fırlatıcı da var */
const W5_NAMES = ['Esinti', 'Yaprak Dökümü', 'Rüzgâr Kapısı', 'Uçan Yaprak', 'Kestane', 'Değirmen', 'Kızıl Akçaağaç', 'Poyraz', 'Bal Kabağı', 'Hasat', 'Savrulan Yaprak', 'Fırtına Öncesi', 'Kuzey Rüzgârı', 'Sonbahar Yolu', 'Tepe Zirvesi'];
const W5: { obst: [number, number, number]; wind: Plan['wind'] }[] = [
  { obst: [0, 0, 0], wind: { n: 1, force: 0.18 } },
  { obst: [0, 0, 0], wind: { n: 2, force: 0.2 } },
  { obst: [0, 0, 0], wind: { n: 2, force: 0.24 } },
  { obst: [0, 0, 0], wind: { n: 3, force: 0.24 } },
  { obst: [0, 0, 0], wind: { n: 2, force: 0.28, pulse: true } },
  { obst: [0, 0, 0], wind: { n: 3, force: 0.28, pulse: true } },
  { obst: [1, 0, 0], wind: { n: 2, force: 0.26 } },
  { obst: [2, 0, 0], wind: { n: 3, force: 0.28, pulse: true } },
  { obst: [2, 1, 0], wind: { n: 2, force: 0.3 } },
  { obst: [2, 1, 0], wind: { n: 3, force: 0.3, pulse: true } },
  { obst: [2, 2, 0], wind: { n: 3, force: 0.3 } },
  { obst: [2, 1, 1], wind: { n: 2, force: 0.3, pulse: true } },
  { obst: [3, 2, 1], wind: { n: 3, force: 0.32 } },
  { obst: [3, 2, 1], wind: { n: 3, force: 0.32, pulse: true } },
  { obst: [3, 2, 2], wind: { n: 4, force: 0.34, pulse: true } },
];
/** Farklı desenli (zikzak olmayan) etaplar: dünyadaki sıra (0'dan) */
const VARIED_IDX = [2, 5, 8, 11, 13];
// Rüzgâr ilerledikçe güçlenir (oyun testi: etkisi azdı): 0,2 → 0,5
W5.forEach((c, i) =>
  NEW_PLANS.push({
    world: 5, num: i + 1, name: W5_NAMES[i], index: i, d: i / 14, prog: 1, boost: lerp(1.05, 0.98, i / 14), obst: c.obst,
    wind: { ...c.wind!, force: Math.round(lerp(0.2, 0.5, i / 14) * 100) / 100 }, want: lerp(48, 78, i / 14),
    ...(VARIED_IDX.includes(i) ? { shape: 'varied' as const } : {}),
  }),
);

/** Dünya 6 (Karlı Zirve): rüzgâr ve bütün engeller bir arada, en uzun yollar */
const W6_NAMES = ['İlk Kar', 'Kartopu', 'Kızak', 'Kardan Adam', 'Buz Sarkıtı', 'Kar Tanesi', 'Ayaz', 'Dağ Evi', 'Tipi', 'Kayak Yolu', 'Buzul', 'Kutup Yıldızı', 'Çığ', 'Zirve Yolu', 'Karlı Zirve'];
const W6: { obst: [number, number, number]; wind: Plan['wind'] }[] = [
  { obst: [2, 1, 0], wind: { n: 1, force: 0.24 } },
  { obst: [2, 1, 1], wind: { n: 1, force: 0.26 } },
  { obst: [2, 2, 1], wind: { n: 2, force: 0.26 } },
  { obst: [3, 1, 1], wind: { n: 2, force: 0.28, pulse: true } },
  { obst: [2, 2, 2], wind: { n: 2, force: 0.28 } },
  { obst: [3, 2, 2], wind: { n: 2, force: 0.3, pulse: true } },
  { obst: [3, 2, 2], wind: { n: 3, force: 0.3 } },
  { obst: [3, 3, 2], wind: { n: 2, force: 0.3, pulse: true } },
  { obst: [3, 2, 3], wind: { n: 3, force: 0.32 } },
  { obst: [4, 3, 2], wind: { n: 3, force: 0.32, pulse: true } },
  { obst: [3, 3, 3], wind: { n: 2, force: 0.32 } },
  { obst: [4, 3, 3], wind: { n: 3, force: 0.34, pulse: true } },
  { obst: [4, 3, 3], wind: { n: 2, force: 0.34 } },
  { obst: [4, 3, 4], wind: { n: 2, force: 0.35, pulse: true } },
  { obst: [5, 3, 4], wind: { n: 2, force: 0.35, pulse: true } },
];
W6.forEach((c, i) =>
  NEW_PLANS.push({
    world: 6, num: i + 1, name: W6_NAMES[i], index: i, d: lerp(0.3, 1, i / 14), prog: 1, boost: lerp(1.0, 0.95, i / 14), obst: c.obst,
    wind: { ...c.wind!, force: Math.round(lerp(0.3, 0.45, i / 14) * 100) / 100 }, want: lerp(60, 90, i / 14),
    // 9 ve 12'de engel çok: karışık desen sığmıyor, zikzak kalır
    ...([2, 5, 13].includes(i) ? { shape: 'varied' as const } : {}),
  }),
);

/**
 * Taslak etaplar (2026-11): Dünya 2–6'ya üçer tane; oyunda 10., 15. ve 18. sırada.
 * 16 = Kıvrım Kuyuları, 17 = Asansör (kıvrımlı), 18 = Asansör (tümsekli).
 */
const SKETCH_NAMES: Record<number, [string, string, string]> = {
  2: ['Ağaç Kovuğu', 'Sincap Asansörü', 'Kök Tümsekleri'],
  3: ['Sarmal Çit', 'Bahçe Asansörü', 'Taş Basamaklar'],
  4: ['Girdap', 'Fener Merdiveni', 'Dalga Tümseği'],
  5: ['Yaprak Kuyusu', 'Değirmen Asansörü', 'Fırtına Tümseği'],
  6: ['Buz Kuyusu', 'Teleferik', 'Çığ Tümsekleri'],
};
const SKETCH_KINDS: SketchName[] = ['kivrimKuyulari', 'asansorKivrimli', 'asansorTumsekli'];
const SKETCH_OBST: Record<number, [number, number, number][]> = {
  4: [[1, 1, 0], [2, 1, 1], [2, 2, 1]],
  5: [[1, 0, 0], [2, 1, 0], [2, 1, 1]],
  6: [[2, 1, 1], [3, 2, 1], [3, 2, 2]],
};
const SKETCH_WIND: Record<number, Plan['wind'][]> = {
  5: [{ n: 2, force: 0.35 }, { n: 2, force: 0.4, pulse: true }, { n: 3, force: 0.45, pulse: true }],
  6: [{ n: 2, force: 0.4 }, { n: 2, force: 0.42, pulse: true }, { n: 2, force: 0.45, pulse: true }],
};
for (const world of [2, 3, 4, 5, 6]) {
  SKETCH_KINDS.forEach((sketch, j) => {
    NEW_PLANS.push({
      world, num: 16 + j, name: SKETCH_NAMES[world][j], index: 15 + j, d: [0.55, 0.75, 0.95][j], prog: 1,
      boost: world <= 3 ? 1.05 : 1, shape: 'sketch', sketch, mirror: (world + j) % 2 === 1, stretch: lerp(1, 1.15, (world - 2) / 4),
      obst: SKETCH_OBST[world]?.[j] ?? [0, 0, 0], ...(SKETCH_WIND[world] ? { wind: SKETCH_WIND[world][j] } : {}),
    });
  });
}

mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
if (!only) {
  process.stdout.write('Hangi etaplar? Örnek: npm run levels w5   (eski etaplar için tam ad gerekir: npm run levels w1-03)\n');
  process.exit(1);
}
let total = 0;
const plans = [...OLD_PLANS.filter((p) => idOf(p) === only), ...NEW_PLANS.filter((p) => idOf(p).startsWith(only))];
for (const plan of plans) {
  {
    const { world, index } = plan;
    const want = plan.want ?? (world === 4 ? targetTime4(plan.d) : targetTime(plan.prog));
    const lid = idOf(plan);
    let done = false;
    let scale = 1;
    for (let attempt = 0; attempt < 150 && !done; attempt++) {
      const seed = world * 1000 + index * 37 + attempt * 7919 + (plan.num && plan.num !== index + 1 ? plan.num * 101 : 0);
      const level = world >= 4 || plan.shape ? buildWorld4(plan, seed, scale) : buildLevel(plan, seed, scale);
      const v0 = validateLevel({ ...level, timeTargets: { gold: 1, silver: 2, bronze: 3 } });
      if (!v0.ok && process.env.DUMP) writeFileSync(process.env.DUMP, JSON.stringify(level));
      if (!v0.ok) {
        process.stdout.write(`  ${level.id} tohum ${seed}: geçersiz ${v0.errors.join('; ')}\n`);
        continue;
      }
      const ev = evaluate(level, plan);
      if (!ev.ok && process.env.DUMP) writeFileSync(process.env.DUMP, JSON.stringify(level));
      if (!ev.ok) {
        process.stdout.write(`  ${level.id} tohum ${seed}: ${ev.reason}\n`);
        continue;
      }
      const t = ev.time;
      // Süre hedefin ±%6'i içinde olmalı; değilse uzunluk ölçeğini düzelt
      const tol = world >= 4 ? (attempt < 90 ? 0.1 : 0.18) : attempt < 90 ? 0.06 : 0.14;
      // Taslak yollarda uzunluk sabit: süre ne çıkarsa yıldızlar ona göre
      if (plan.shape !== 'sketch' && Math.abs(t / want - 1) > tol) {
        scale *= Math.max(0.6, Math.min(1.6, want / t));
        process.stdout.write(`  ${level.id} tohum ${seed}: süre ${t.toFixed(1)} sn, hedef ${want.toFixed(0)} → ölçek ${scale.toFixed(2)}\n`);
        continue;
      }
      level.timeTargets = timeTargetsFromBot(t);
      // Yoldan yıldız toplama kalktı: yıldızlar süreye göre verilir
      delete level.stars;
      const v = validateLevel(level);
      if (!v.ok) {
        process.stdout.write(`  ${level.id} tohum ${seed}: geçersiz ${v.errors.join('; ')}\n`);
        continue;
      }
      writeFileSync(join(OUT, `${level.id}.json`), JSON.stringify(level, null, 2) + '\n');
      process.stdout.write(`${level.id} "${level.name}" yükseklik ${level.height} bot ${t.toFixed(1)} sn (hedef ${want.toFixed(0)}) kontrol ${level.checkpoints?.length} → altın ${level.timeTargets.gold} gümüş ${level.timeTargets.silver} bronz ${level.timeTargets.bronze}\n`);
      done = true;
      total++;
    }
    if (!done) {
      process.stdout.write(`HATA: ${lid} üretilemedi\n`);
      process.exitCode = 1;
    }
  }
}
process.stdout.write(`${total} etap yazıldı → ${OUT}\n`);
