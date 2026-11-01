// Dünya 1–3 için 30 etap üretir: npm run levels
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
import type { Branch, LevelData, RoadPoint, VacuumZone } from '../src/game/levels/types';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'levels');
const W = 1000;

/** Bot süresinden hedefler: altın ×1,2, gümüş ×1,7, bronz ×2,6 */
const GOLD = 1.2;
const SILVER = 1.7;
const BRONZE = 2.6;

/**
 * Yeni başlayanlar için yol genişliği çarpanı (oyun testinden sonra eklendi):
 * Dünya 1'in 1–3. etapları %50, 4–6. etapları %30, 7–9. etapları %10 daha geniş.
 */
const WIDTH_BOOST: Record<number, number[]> = { 1: [1.5, 1.5, 1.5, 1.3, 1.3, 1.3, 1.1, 1.1, 1.1, 1] };

const NAMES: Record<number, string[]> = {
  1: ['İlk Adım', 'Çayır Yolu', 'Papatya Virajı', 'Salıncak', 'Kelebek', 'Yonca', 'Rüzgârgülü', 'Gölgelik', 'Çimen Dansı', 'Büyük Çayır'],
  2: ['Orman Girişi', 'Çam Yolu', 'Dar Patika', 'Mantar', 'Sincap', 'Yosunlu Taş', 'Baykuş', 'İğne Deliği', 'Kızılçam', 'Orman Kalbi'],
  3: ['Labirent Kapısı', 'Çit Arası', 'Gül Bahçesi', 'İki Yol', 'Sarmaşık', 'Fıskiye', 'Şimşek Yolu', 'Düğüm', 'Gizli Geçit', 'Bahçe Zirvesi'],
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
  index: number;
  /** 0..1 dünya içindeki zorluk */
  d: number;
}

function buildLevel(p: Plan, seed: number): LevelData {
  const R = rng(seed);
  const { world, index, d } = p;
  const id = `w${world}-${String(index + 1).padStart(2, '0')}`;

  // Dünya ve zorluğa göre ölçüler
  const height = r10(world === 1 ? lerp(2800, 4800, d) : world === 2 ? lerp(3800, 5600, d) : lerp(4400, 6200, d));
  const baseW = world === 1 ? lerp(250, 190, d) : world === 2 ? lerp(210, 175, d) : lerp(200, 175, d);
  const narrowW = world === 2 ? lerp(150, 115, d) : world === 3 ? lerp(140, 115, d) : baseW;
  const stepY = world === 1 ? lerp(620, 520, d) : lerp(560, 480, d);
  const boost = WIDTH_BOOST[world]?.[index] ?? 1;
  // Virajlar tahtanın kenarına kadar gider (ilk etaplarda biraz daha az)
  const ampFrac = world === 1 ? lerp(0.6, 1, d) : lerp(0.85, 1, d);
  const maxAmp = (w: number) => 500 - (w * boost) / 2 - 45;
  // Aşağı dönen kıvrım sayısı
  const wantSwitchbacks = world === 1 ? (index >= 6 ? 1 : 0) : world === 2 ? (d < 0.5 ? 1 : 2) : 1;

  const road: RoadPoint[] = [{ x: 500, y: 0, w: r10(baseW + 30) }, { x: 500, y: 260, w: r10(baseW + 20) }];
  /** Her noktanın türü: düz viraj ya da aşağı dönen kıvrım */
  const kinds: ('start' | 'swing' | 'switch')[] = ['start', 'start'];
  let y = 260;
  let side = R() < 0.5 ? -1 : 1;
  const topY = height - 140;
  const narrowSpots: number[] = [];
  let k = 0;
  let switchbacks = 0;
  const totalSwings = Math.max(1, Math.floor((topY - 560) / stepY));
  // Kıvrımlar etabın içine dağılsın
  // Dünya 3'te kıvrım başta olur ki geri kalan düz virajlarda kısa yola yer kalsın
  const sbAt = world === 3 ? [1] : Array.from({ length: wantSwitchbacks }, (_, i) => Math.floor(((i + 1) * totalSwings) / (wantSwitchbacks + 1)));
  while (y + stepY * 0.7 < topY - 300) {
    const prev = road[road.length - 1];
    const sbW = baseW;
    const A = maxAmp(sbW);
    const canSwitch = switchbacks < wantSwitchbacks && sbAt.includes(k) && kinds[kinds.length - 1] === 'swing' && y + 760 < topY - 300 && A >= sbW * boost + 60;
    if (canSwitch) {
      // Kemer: yukarı çık, karşıya doğru aşağı in, en uçta tekrar yukarı kıvrıl
      const sp = Math.sign(prev.x - 500) || 1;
      const x1 = 500 + sp * A;
      const x2 = 500;
      const x3 = 500 - sp * A;
      const y0 = prev.y;
      prev.x = r10(x1);
      const pts: [number, number][] = [
        [x1 - sp * 40, y0 + 260],
        [(x1 + x2) / 2, y0 + 430],
        [x2, y0 + 270],
        [(x2 + x3) / 2, y0 + 110],
        [x3 + sp * 30, y0 + 320],
        [x3 + sp * 60, y0 + 620],
      ];
      for (const [px, py] of pts) {
        road.push({ x: r10(px), y: r10(py), w: r10(sbW) });
        kinds.push('switch');
      }
      y = y0 + 620;
      side = sp;
      switchbacks++;
      k++;
      continue;
    }
    y += stepY * lerp(0.8, 1.15, R());
    let w = baseW * lerp(0.92, 1.05, R());
    // Dünya 2: bazı noktalarda yol daralır
    if (world >= 2 && k % 2 === 1 && R() < lerp(0.5, 0.8, d)) {
      w = narrowW;
      narrowSpots.push(road.length);
    }
    const a = maxAmp(w) * ampFrac * lerp(0.8, 1, R());
    const x = clamp(500 + side * a, (w * boost) / 2 + 45, W - (w * boost) / 2 - 45);
    road.push({ x: r10(x), y: r10(y), w: r10(w) });
    kinds.push('swing');
    side = -side;
    k++;
  }
  const amp = maxAmp(baseW) * ampFrac;
  // Bitişe yumuşak yaklaşma
  road.push({ x: r10(500 + side * amp * 0.35), y: r10(topY - 160), w: r10(baseW) });
  road.push({ x: r10(500 + side * amp * 0.2), y: r10(topY), w: r10(baseW * 0.95) });
  if (boost !== 1) for (const pt of road) pt.w = r10(pt.w * boost);
  const last = road[road.length - 1];
  const finishHole = { x: last.x, y: last.y, r: 46 };

  // Dünya 3: kısa yol / uzun yol ayrımları. Ana yol (güvenli) geniş kıvrım yapar,
  // kısa yol dar ve dosdoğru gider.
  const branches: Branch[] = [];
  const signs: { x: number; y: number; text: string }[] = [];
  const nBranch = world === 3 ? (d > 0.5 ? 2 : 1) : 0;
  if (world === 3) {
    const used = new Set<number>();
    for (let b = 0; b < nBranch; b++) {
      // Ayrım: art arda iki köşe (i → i+3) arasında
      const candidates: number[] = [];
      for (let i = 2; i + 3 < road.length - 2; i++) {
        const plain = [0, 1, 2, 3].every((o) => kinds[i + o] === 'swing');
        if (plain && ![...used].some((u) => Math.abs(u - i) < 3)) candidates.push(i);
      }
      if (!candidates.length) break;
      const i = candidates[Math.floor(R() * candidates.length)];
      used.add(i);
      const A = road[i];
      const B = road[i + 3];
      // Ana yolu genişlet ve kıvrımı büyüt (uzun yol)
      for (let j = i + 1; j <= i + 2; j++) {
        const m = road[j];
        const dir = m.x >= 500 ? 1 : -1;
        m.w = r10(Math.max(m.w, baseW + 10));
        m.x = r10(clamp(500 + dir * (amp + 40), m.w / 2 + 45, W - m.w / 2 - 45));
      }
      const bw = r10(narrowW);
      const midX = (A.x + B.x) / 2;
      const pts: RoadPoint[] = [
        { x: A.x, y: A.y, w: bw },
        { x: r10(lerp(A.x, midX, 0.6)), y: r10(lerp(A.y, B.y, 0.3)), w: bw },
        { x: r10(lerp(B.x, midX, 0.6)), y: r10(lerp(A.y, B.y, 0.7)), w: bw },
        { x: B.x, y: B.y, w: bw },
      ];
      branches.push({ type: 'short', points: pts });
      signs.push({ x: r10(pts[1].x), y: r10(lerp(A.y, B.y, 0.18)), text: 'sign.short' });
      const m1 = road[i + 1];
      signs.push({ x: r10(lerp(A.x, m1.x, 0.5)), y: r10(lerp(A.y, m1.y, 0.4)), text: 'sign.safe' });
    }
  }

  // Kontrol noktaları: 1–3
  const nCp = height < 3600 ? 1 : height < 5000 ? 2 : 3;
  const checkpoints: number[] = [];
  // Yolun bir kez geçtiği bir yüksekliğe kaydır (aşağı dönen kıvrımlardan uzak)
  const mainLine = new Track({ id, name: '', world, height, boardWidth: W, road, finishHole, stars: [], timeTargets: { bronze: 3, silver: 2, gold: 1 } }).main;
  for (let c = 1; c <= nCp; c++) {
    const want = r10((topY * c) / (nCp + 1));
    for (let off = 0; off < topY; off += 10) {
      const cand = [want + off, want - off].find((cy) => cy > 100 && cy < topY - 100 && crossings(mainLine, cy) === 1 && crossings(mainLine, cy - 60) === 1 && crossings(mainLine, cy + 60) === 1 && !checkpoints.includes(cy));
      if (cand !== undefined) {
        checkpoints.push(cand);
        break;
      }
    }
  }
  checkpoints.sort((a, b) => a - b);

  // Vakum: virajların yanında (Dünya 1'de çok, sonra azalır)
  const vacuum: VacuumZone[] = [];
  const vacEvery = world === 1 ? 1 : world === 2 ? 2 : 3;
  for (let i = 2; i < road.length - 1; i += vacEvery) {
    const pt = road[i];
    if (world === 1 || narrowSpots.includes(i) || i % 3 === 0) {
      vacuum.push({ x: pt.x, y: pt.y, radius: r10(pt.w * 0.9 + 60), strength: world === 1 ? 0.6 : 0.55 });
    }
  }

  const level: LevelData = {
    id,
    name: NAMES[world][index],
    world,
    height,
    boardWidth: W,
    road,
    ...(branches.length ? { branches } : {}),
    finishHole,
    checkpoints,
    stars: [],
    vacuum,
    ...(signs.length ? { signs } : {}),
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
    const sy = r10(topY * fr[s] + lerp(-120, 120, R()));
    const cx = track.centerXAt(sy);
    const hw = track.widthAt(sy) / 2;
    const off = (R() < 0.5 ? -1 : 1) * hw * lerp(0.25, 0.45, d);
    stars.push({ x: r10(cx + off), y: sy });
  }
  level.stars = stars;
  return level;
}

function evaluate(level: LevelData, plan: Plan): { ok: boolean; time: number; falls: number; reason?: string } {
  const wantBranches = plan.world === 3 ? (plan.d > 0.5 ? 2 : 1) : 0;
  if ((level.branches?.length ?? 0) < wantBranches) return { ok: false, time: 0, falls: 0, reason: 'kısa yola yer yok' };
  const res = runAutopilot(new Simulation(level, { ball: 'standard', assist: false }), DEFAULT_AUTOPILOT, 200);
  if (!res.finished) return { ok: false, time: 0, falls: res.falls, reason: 'bitmedi' };
  if (res.falls > 0) return { ok: false, time: res.time, falls: res.falls, reason: 'düştü' };
  // Bot bir yerde sürünüyorsa etap fazla sıkışık demektir
  // Yolun gerçek uzunluğuna göre hız (kıvrımlı ve aşağı dönen yollar daha uzun)
  const routeLen = buildRoute(new Track(level).lines, false).total;
  if (routeLen / res.time < 120) return { ok: false, time: res.time, falls: 0, reason: `yavaş (${res.time.toFixed(1)} sn)` };
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

mkdirSync(OUT, { recursive: true });
let total = 0;
for (const world of [1, 2, 3]) {
  for (let index = 0; index < 10; index++) {
    const plan: Plan = { world, index, d: index / 9 };
    let done = false;
    for (let attempt = 0; attempt < 40 && !done; attempt++) {
      const seed = world * 1000 + index * 37 + attempt * 7919;
      const level = buildLevel(plan, seed);
      const ev = evaluate(level, plan);
      if (!ev.ok) {
        process.stdout.write(`  ${level.id} tohum ${seed}: ${ev.reason}\n`);
        continue;
      }
      const t = ev.time;
      level.timeTargets = {
        gold: Math.ceil(t * GOLD),
        silver: Math.ceil(t * SILVER),
        bronze: Math.ceil(t * BRONZE),
      };
      const v = validateLevel(level);
      if (!v.ok) {
        process.stdout.write(`  ${level.id} tohum ${seed}: geçersiz ${v.errors.join('; ')}\n`);
        continue;
      }
      writeFileSync(join(OUT, `${level.id}.json`), JSON.stringify(level, null, 2) + '\n');
      process.stdout.write(`${level.id} "${level.name}" yükseklik ${level.height} bot ${t.toFixed(1)} sn → altın ${level.timeTargets.gold} gümüş ${level.timeTargets.silver} bronz ${level.timeTargets.bronze}\n`);
      done = true;
      total++;
    }
    if (!done) {
      process.stdout.write(`HATA: w${world}-${index + 1} üretilemedi\n`);
      process.exitCode = 1;
    }
  }
}
process.stdout.write(`${total} etap yazıldı → ${OUT}\n`);
