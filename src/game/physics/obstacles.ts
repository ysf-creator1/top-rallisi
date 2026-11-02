// Engeller (Dünya 4): düşürme delikleri, dönen kollar ve fırlatıcılar.
// Zamanlı engeller fizik saatine (simTime) bağlıdır; çizim de aynı fonksiyonları kullanır.

import { ASSIST, physics } from '../../config/physics';
import type { LevelData, Popper, SpinArm } from '../levels/types';

export type HazardCause = 'hole' | 'arm' | 'pop';
export type FallCause = 'edge' | HazardCause;

/** Göbek yarıçapı ve kol kalınlığının yarısı (birim) */
export const ARM_HUB_R = 22;
export const ARM_HALF = 10;
/** Fırlatıcı yükselmeden önce bu kadar süre uyarır (sn) */
export const POPPER_WARN = 0.7;
export const POPPER_UP = 0.5;

/** Engellerin saati: yardım modunda yavaş */
export function obstacleTime(simTime: number, assist: boolean): number {
  return assist ? simTime * ASSIST.obstacleTimeScale : simTime;
}

export function armAngle(a: SpinArm, t: number): number {
  return (a.phase ?? 0) + a.speed * t;
}

export interface PopperState {
  /** 0: aşağıda, 1: tam yukarıda */
  lift: number;
  /** 0..1 uyarı (yükselmeden hemen önce) */
  warn: number;
  /** Üstündeki topu fırlatır mı */
  active: boolean;
}

export function popperState(p: Popper, t: number, out: PopperState = { lift: 0, warn: 0, active: false }): PopperState {
  const up = p.up ?? POPPER_UP;
  const P = p.period;
  const ph = (((t + (p.offset ?? 0)) % P) + P) % P;
  const upStart = P - up;
  const warnStart = upStart - POPPER_WARN;
  out.active = ph >= upStart;
  out.warn = ph >= warnStart && ph < upStart ? (ph - warnStart) / POPPER_WARN : 0;
  if (out.active) {
    const k = ph - upStart;
    // Hızla çıkar, sonunda yavaşça iner
    out.lift = Math.min(1, k / 0.08) * Math.min(1, (up - k) / 0.15 + 0.2);
  } else out.lift = 0;
  return out;
}

/** Noktanın kol parçasına (göbekten uca) uzaklığı */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let k = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  k = k < 0 ? 0 : k > 1 ? 1 : k;
  return Math.hypot(px - ax - dx * k, py - ay - dy * k);
}

/** Top (x, y) bu kola değiyor mu? */
export function armHits(a: SpinArm, x: number, y: number, t: number, margin = 0): boolean {
  const reach = physics.ballRadius * physics.armContact + margin;
  const d = Math.hypot(x - a.x, y - a.y);
  if (d > a.length + ARM_HALF + reach) return false;
  if (d < ARM_HUB_R + reach) return true;
  const n = a.blades ?? 2;
  const th = armAngle(a, t);
  for (let i = 0; i < n; i++) {
    const ang = th + (i * Math.PI * 2) / n;
    const ex = a.x + Math.cos(ang) * a.length;
    const ey = a.y + Math.sin(ang) * a.length;
    if (segDist(x, y, a.x, a.y, ex, ey) < ARM_HALF + reach) return true;
  }
  return false;
}

const tmpState: PopperState = { lift: 0, warn: 0, active: false };

/** Top bu konumda ve bu engel saatinde bir engele takılıyor mu? */
export function hitObstacle(L: LevelData, x: number, y: number, t: number): HazardCause | null {
  for (const h of L.holes ?? []) {
    if (Math.hypot(x - h.x, y - h.y) < h.r) return 'hole';
  }
  for (const p of L.poppers ?? []) {
    if (Math.hypot(x - p.x, y - p.y) < p.r && popperState(p, t, tmpState).active) return 'pop';
  }
  for (const a of L.arms ?? []) {
    if (armHits(a, x, y, t)) return 'arm';
  }
  return null;
}

/** Yeniden doğma / kontrol noktası / yıldız için engelden uzak mı? */
export function safeSpot(L: LevelData, x: number, y: number, pad = 120): boolean {
  for (const h of L.holes ?? []) if (Math.hypot(x - h.x, y - h.y) < h.r + pad) return false;
  for (const p of L.poppers ?? []) if (Math.hypot(x - p.x, y - p.y) < p.r + pad) return false;
  for (const a of L.arms ?? []) if (Math.hypot(x - a.x, y - a.y) < a.length + ARM_HALF + physics.ballRadius + pad) return false;
  return true;
}

export function hasTimedObstacles(L: LevelData): boolean {
  return !!(L.arms?.length || L.poppers?.length);
}
