// Gizli yollar: her dünyada bir etaba çalıların altına saklı dar bir kısayol ve içine gizli yıldız ekler.
// Ana yolun dolambaçlı bir kısmını düz bir çizgiyle kesen, ana yola sadece iki uçta değen ve
// engellerden uzak bir yer aranır. Kullanım: npx tsx scripts/add-secrets.ts [--write]

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORLD_ORDER } from '../src/game/levels/order';
import type { LevelData } from '../src/game/levels/types';
import { validateLevel } from '../src/game/levels/validate';
import { Track } from '../src/game/physics/track';
import { Autopilot, DEFAULT_AUTOPILOT } from '../src/game/autopilot';
import { Simulation } from '../src/game/physics/sim';

/** Bot kısayoldan gidip etabı bitirebiliyor ve gizli yıldızı alabiliyor mu? */
function botPasses(L: LevelData): boolean {
  const sim = new Simulation(L, { ball: 'standard', assist: false });
  const ap = new Autopilot({ ...DEFAULT_AUTOPILOT, preferShort: true });
  for (let i = 0; i < 120 * 240 && sim.phase !== 'finished'; i++) {
    ap.control(sim);
    sim.step();
    sim.drainEvents();
    if (sim.falls > 3) return false;
  }
  return sim.phase === 'finished' && sim.secretFound;
}

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'levels');
const WIDTH = 130;
const write = process.argv.includes('--write');

/** Her dünyada aranan etaplar (oyundaki sıra, 0'dan): önce ortalardakiler; taslak etaplar (16–18) en sona */
const SLOTS = [5, 6, 7, 4, 8, 10, 11, 3, 12, 13, 9, 14, 15, 16];

/** Adayın çimen içindeki kısmının ortası (segment üzerindeki mesafe) */
const hidden = new Map<string, number>();

interface Cand {
  i: number;
  j: number;
  saving: number;
  d: number;
}

function findShortcut(L: LevelData, slope: number): Cand | null {
  const t = new Track({ ...L, branches: [] });
  const m = t.main;
  const near = { dist: 0, halfWidth: 0, cx: 0, cy: 0, line: m };
  const obstacles = [...(L.holes ?? []), ...(L.poppers ?? []), ...(L.arms ?? []).map((a) => ({ x: a.x, y: a.y, r: a.length }))];
  let best: Cand | null = null;
  hidden.clear();
  for (let i = 0; i < m.count; i += 3) {
    if (m.ys[i] < L.road[0].y + 300) continue;
    for (let j = i + 6; j < m.count; j += 3) {
      if (m.ys[j] > L.finishHole.y - 250) break;
      const x0 = m.xs[i], y0 = m.ys[i], x1 = m.xs[j], y1 = m.ys[j];
      const d = Math.hypot(x1 - x0, y1 - y0);
      if (d < 220 || d > 640) continue;
      const arc = m.len[j] - m.len[i];
      if (arc < d * 1.45) continue;
      // Dar yol dike yakın olmalı: yatık dar yolda top yana kayıp düşer
      if (y1 - y0 < slope * Math.abs(x1 - x0)) continue;
      // Uçlar ana yolda; aradaki kısım çimenin içinden geçmeli (en az 160 birim, çalıyla örtülür)
      let ok = true;
      let offLen = 0;
      let offStart = -1;
      let offEnd = -1;
      for (let s = 0; s <= d && ok; s += 10) {
        const px = x0 + ((x1 - x0) * s) / d;
        const py = y0 + ((y1 - y0) * s) / d;
        if (px < WIDTH || px > L.boardWidth - WIDTH) ok = false;
        t.nearest(px, py, near);
        const clear = near.dist >= near.halfWidth + WIDTH / 2 + 30;
        if (clear) {
          if (offEnd >= 0 && s - offEnd > 10) ok = false; // çimene çıkıp yola girip yine çıkıyor
          if (offStart < 0) offStart = s;
          offLen += 10;
        } else if (offStart >= 0 && offEnd < 0) offEnd = s;
        for (const o of obstacles) if (Math.hypot(px - o.x, py - o.y) < o.r + 140) ok = false;
      }
      if (offLen < 160) ok = false;
      if (ok) hidden.set(`${i}-${j}`, offStart + offLen / 2);
      if (!ok) continue;
      // Orta büyüklükte kısayol: çok büyük kazanç etabı bozar
      const saving = arc - d;
      const score = -Math.abs(saving - 450);
      if (!best || score > -Math.abs(best.saving - 450)) best = { i, j, saving, d };
    }
  }
  return best;
}

for (const w of [1, 2, 3, 4, 5, 6]) {
  const ids = WORLD_ORDER[w];
  let done = false;
  for (const slope of [1.0, 0.7, 0.4, 0]) {
  if (done) break;
  const order = [...SLOTS.filter((k) => !/-1[678]$/.test(ids[k] ?? '')), ...SLOTS.filter((k) => /-1[678]$/.test(ids[k] ?? ''))];
  for (const slot of order) {
    const id = ids[slot];
    if (!id) continue;
    const path = join(DIR, `${id}.json`);
    const L = JSON.parse(readFileSync(path, 'utf8')) as LevelData;
    if (L.branches?.length) continue;
    const c = findShortcut(L, slope);
    if (!c) continue;
    const m = new Track(L).main;
    const a = { x: Math.round(m.xs[c.i]), y: Math.round(m.ys[c.i]) };
    const b = { x: Math.round(m.xs[c.j]), y: Math.round(m.ys[c.j]) };
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const sm = hidden.get(`${c.i}-${c.j}`) ?? d / 2;
    const mid = { x: Math.round(a.x + ((b.x - a.x) * sm) / d), y: Math.round(a.y + ((b.y - a.y) * sm) / d) };
    const next: LevelData = {
      ...L,
      branches: [{ type: 'short', hidden: true, points: [{ ...a, w: WIDTH }, { ...mid, w: WIDTH }, { ...b, w: WIDTH }] }],
      secret: mid,
    };
    const v = validateLevel(next);
    if (!v.ok) {
      process.stdout.write(`${id}: geçersiz ${v.errors.join('; ')}\n`);
      continue;
    }
    if (!botPasses(next)) {
      process.stdout.write(`${id}: bot kısayoldan geçemedi\n`);
      continue;
    }
    process.stdout.write(`Dünya ${w}: ${id} (${slot + 1}. etap) kısayol ${Math.round(c.d)} birim, ${Math.round(c.saving)} birim kazandırır\n`);
    if (write) writeFileSync(path, JSON.stringify(next, null, 2) + '\n');
    done = true;
    break;
  }
  }
  if (!done) process.stdout.write(`Dünya ${w}: uygun yer bulunamadı\n`);
}
