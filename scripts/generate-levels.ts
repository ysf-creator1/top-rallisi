// Dünya 1–3 için 30 etap üretir: npm run levels
// Tohumlu rastgelelik: aynı tohum hep aynı etabı verir.
// Her etap otopilotla oynatılır; bitirilemiyorsa tohum değiştirilip yeniden denenir.
// Süre hedefleri bot süresinden türetilir (oyun testinde ayarlanabilir).

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAutopilot, DEFAULT_AUTOPILOT } from '../src/game/autopilot';
import { Simulation } from '../src/game/physics/sim';
import { Track } from '../src/game/physics/track';
import { validateLevel } from '../src/game/levels/validate';
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
  const amp = world === 1 ? lerp(120, 240, d) : lerp(180, 270, d);
  const stepY = world === 1 ? lerp(620, 520, d) : lerp(560, 480, d);

  const road: RoadPoint[] = [{ x: 500, y: 0, w: r10(baseW + 30) }, { x: 500, y: 260, w: r10(baseW + 20) }];
  let y = 260;
  let side = R() < 0.5 ? -1 : 1;
  const topY = height - 140;
  const narrowSpots: number[] = [];
  let k = 0;
  while (y + stepY * 0.7 < topY - 300) {
    y += stepY * lerp(0.8, 1.15, R());
    const a = amp * lerp(0.6, 1, R());
    let w = baseW * lerp(0.92, 1.05, R());
    // Dünya 2: bazı noktalarda yol daralır
    if (world >= 2 && k % 2 === 1 && R() < lerp(0.5, 0.8, d)) {
      w = narrowW;
      narrowSpots.push(road.length);
    }
    const x = clamp(500 + side * a, w / 2 + 60, W - w / 2 - 60);
    road.push({ x: r10(x), y: r10(y), w: r10(w) });
    side = -side;
    k++;
  }
  // Bitişe yumuşak yaklaşma
  road.push({ x: r10(500 + side * amp * 0.35), y: r10(topY - 160), w: r10(baseW) });
  road.push({ x: r10(500 + side * amp * 0.2), y: r10(topY), w: r10(baseW * 0.95) });
  const boost = WIDTH_BOOST[world]?.[index] ?? 1;
  if (boost !== 1) for (const pt of road) pt.w = r10(pt.w * boost);
  const last = road[road.length - 1];
  const finishHole = { x: last.x, y: last.y, r: 46 };

  // Dünya 3: kısa yol / uzun yol ayrımları. Ana yol (güvenli) geniş kıvrım yapar,
  // kısa yol dar ve dosdoğru gider.
  const branches: Branch[] = [];
  const signs: { x: number; y: number; text: string }[] = [];
  if (world === 3) {
    const nBranch = d > 0.5 ? 2 : 1;
    const used = new Set<number>();
    for (let b = 0; b < nBranch; b++) {
      // Ayrım: art arda iki köşe (i → i+3) arasında
      const candidates: number[] = [];
      for (let i = 2; i + 3 < road.length - 2; i++) {
        if (![...used].some((u) => Math.abs(u - i) < 4)) candidates.push(i);
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
        m.x = r10(clamp(500 + dir * (amp + 70), m.w / 2 + 50, W - m.w / 2 - 50));
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
  for (let c = 1; c <= nCp; c++) checkpoints.push(r10((topY * c) / (nCp + 1)));

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

function evaluate(level: LevelData): { ok: boolean; time: number; falls: number; reason?: string } {
  const res = runAutopilot(new Simulation(level, { ball: 'standard', assist: false }), DEFAULT_AUTOPILOT, 200);
  if (!res.finished) return { ok: false, time: 0, falls: res.falls, reason: 'bitmedi' };
  if (res.falls > 0) return { ok: false, time: res.time, falls: res.falls, reason: 'düştü' };
  // Bot bir yerde sürünüyorsa etap fazla sıkışık demektir
  if (level.height / res.time < 115) return { ok: false, time: res.time, falls: 0, reason: `yavaş (${res.time.toFixed(1)} sn)` };
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
      const ev = evaluate(level);
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
