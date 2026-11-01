// Etap JSON doğrulaması (tarif Bölüm 9). Hem testlerde hem önizleyicide kullanılır.

import { physics } from '../../config/physics';
import { Track, type Polyline } from '../physics/track';
import type { LevelData, RoadPoint } from './types';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const isNum = (x: unknown): x is number => typeof x === 'number' && isFinite(x);

function checkPoints(pts: unknown, label: string, errors: string[], W: number): pts is RoadPoint[] {
  if (!Array.isArray(pts) || pts.length < 2) {
    errors.push(`${label}: en az 2 nokta olmalı`);
    return false;
  }
  pts.forEach((p, i) => {
    if (!p || !isNum(p.x) || !isNum(p.y) || !isNum(p.w)) errors.push(`${label}[${i}]: x, y, w sayı olmalı`);
    else {
      if (p.w < 60 || p.w > 500) errors.push(`${label}[${i}]: genişlik 60–500 arası olmalı`);
      if (p.x < 0 || p.x > W) errors.push(`${label}[${i}]: x tahtanın dışında`);
    }
  });
  return errors.length === 0;
}

/** Ana yolun birbirinden uzak iki kısmı birbirine değiyor mu? */
export function selfOverlaps(line: Polyline, gap = 40): boolean {
  const { xs, ys, ws, len, count } = line;
  for (let i = 0; i < count; i += 2) {
    for (let j = i + 2; j < count; j += 2) {
      const need = (ws[i] + ws[j]) / 2 + gap;
      if (len[j] - len[i] < need * 1.6) continue;
      const dx = xs[i] - xs[j];
      const dy = ys[i] - ys[j];
      if (dx * dx + dy * dy < need * need) return true;
    }
  }
  return false;
}

/** Ana yol verilen yüksekliği kaç kez geçiyor? (Kontrol noktası tek geçişte olmalı) */
export function crossings(line: Polyline, y: number): number {
  const { ys, count } = line;
  let n = 0;
  for (let i = 0; i < count - 1; i++) {
    const y0 = ys[i];
    const y1 = ys[i + 1];
    if ((y0 < y && y1 >= y) || (y0 > y && y1 <= y)) n++;
  }
  return n;
}

export function validateLevel(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const L = raw as LevelData;
  if (!L || typeof L !== 'object') return { ok: false, errors: ['JSON nesnesi değil'] };
  if (typeof L.id !== 'string' || !L.id) errors.push('id eksik');
  if (typeof L.name !== 'string') errors.push('name eksik');
  if (!Number.isInteger(L.world) || L.world < 1) errors.push('world pozitif tam sayı olmalı');
  if (!isNum(L.height) || L.height < 500) errors.push('height en az 500 olmalı');
  if (!isNum(L.boardWidth) || L.boardWidth < 400) errors.push('boardWidth en az 400 olmalı');
  if (errors.length) return { ok: false, errors };
  const W = L.boardWidth;

  if (!checkPoints(L.road, 'road', errors, W)) return { ok: false, errors };
  // Yol aşağı dönebilir ama başlangıcın altına inemez (çubuk oraya inemez)
  for (let i = 1; i < L.road.length; i++) {
    const p = L.road[i];
    const q = L.road[i - 1];
    if (Math.hypot(p.x - q.x, p.y - q.y) < 40) errors.push(`road[${i}]: önceki noktaya çok yakın`);
    if (p.y < L.road[0].y) errors.push(`road[${i}]: başlangıcın altına inemez`);
  }
  for (const [bi, b] of (L.branches ?? []).entries()) {
    if (b.type !== 'short' && b.type !== 'long') errors.push(`branches[${bi}]: type 'short' ya da 'long' olmalı`);
    checkPoints(b.points, `branches[${bi}].points`, errors, W);
  }

  const h = L.finishHole;
  if (!h || !isNum(h.x) || !isNum(h.y) || !isNum(h.r) || h.r < 20) errors.push('finishHole: x, y, r (en az 20) olmalı');
  const tt = L.timeTargets;
  if (!tt || !isNum(tt.bronze) || !isNum(tt.silver) || !isNum(tt.gold)) errors.push('timeTargets: bronze, silver, gold olmalı');
  else if (!(tt.gold > 0 && tt.gold < tt.silver && tt.silver < tt.bronze)) errors.push('timeTargets: 0 < gold < silver < bronze olmalı');
  if (errors.length) return { ok: false, errors };

  const track = new Track(L);
  const start = L.road[0];
  if (selfOverlaps(track.main)) errors.push('road: yol kendi üstüne biniyor (iki kısım çok yakın)');
  const top = L.road[L.road.length - 1];
  if (!track.isOnTrack(h.x, h.y)) errors.push('finishHole pistin üzerinde olmalı');
  if (h.y > top.y + 1) errors.push('finishHole yolun sonunu geçmemeli');
  if (h.y > L.height) errors.push('finishHole etap yüksekliğini geçmemeli');

  for (const [bi, b] of (L.branches ?? []).entries()) {
    const main = new Track({ ...L, branches: [] });
    const a = b.points[0];
    const z = b.points[b.points.length - 1];
    if (!main.isOnTrack(a.x, a.y)) errors.push(`branches[${bi}]: ilk nokta ana yolun üzerinde olmalı`);
    if (!main.isOnTrack(z.x, z.y)) errors.push(`branches[${bi}]: son nokta ana yolun üzerinde olmalı`);
  }

  const cps = L.checkpoints ?? [];
  cps.forEach((c, i) => {
    if (!isNum(c) || c <= start.y || c >= h.y) errors.push(`checkpoints[${i}]: başlangıç ile bitiş arasında olmalı`);
    if (i > 0 && c <= cps[i - 1]) errors.push('checkpoints artan sırada olmalı');
    if (isNum(c) && crossings(track.main, c) !== 1) errors.push(`checkpoints[${i}]: yol bu yüksekliği bir kez geçmeli`);
  });
  if (cps.length > 4) errors.push('en fazla 4 kontrol noktası');

  const stars = L.stars ?? [];
  if (stars.length !== 3) errors.push('3 yıldız olmalı');
  const near = { dist: 0, halfWidth: 0, cx: 0, cy: 0, line: track.main };
  stars.forEach((s, i) => {
    if (!isNum(s.x) || !isNum(s.y)) {
      errors.push(`stars[${i}]: x, y olmalı`);
      return;
    }
    track.nearest(s.x, s.y, near);
    if (near.dist > near.halfWidth + physics.starPickupRadius * 0.4) errors.push(`stars[${i}]: pistten erişilemiyor`);
  });

  for (const [i, v] of (L.vacuum ?? []).entries()) {
    if (!isNum(v.x) || !isNum(v.y) || !isNum(v.radius) || v.radius <= 0) errors.push(`vacuum[${i}]: x, y, radius olmalı`);
    if (!isNum(v.strength) || v.strength < 0 || v.strength > 1.5) errors.push(`vacuum[${i}]: strength 0–1,5 arası`);
  }
  for (const [i, w] of (L.wind ?? []).entries()) {
    if (![w.x, w.y, w.w, w.h, w.force].every(isNum) || w.w <= 0 || w.h <= 0) errors.push(`wind[${i}]: x, y, w, h, force olmalı`);
  }
  for (const [i, m] of (L.magnets ?? []).entries()) {
    if (![m.x, m.y, m.radius, m.strength].every(isNum) || m.radius <= 0) errors.push(`magnets[${i}]: x, y, radius, strength olmalı`);
  }
  return { ok: errors.length === 0, errors };
}
