// Hayalet: en iyi denemenin kaydı ve oynatılması (tarif 8.2).
// Saniyede 30 örnek: çubuk uçları (yL, yR), top konumu (u) ve görünür top ölçeği.

import type { BallType } from '../config/physics';
import { ballCenter } from './physics/bar';
import type { Simulation } from './physics/sim';
import { FALL_DURATION, FINISH_DURATION } from './physics/sim';

export const GHOST_HZ = 30;
const CH = 4;

export interface GhostData {
  v: 1;
  levelId: string;
  ball: BallType;
  time: number;
  /** Int16 × 4 kanal, base64 */
  data: string;
}

export interface GhostFrame {
  yL: number;
  yR: number;
  u: number;
  scale: number;
}

export function encodeFrames(frames: Int16Array): string {
  const bytes = new Uint8Array(frames.buffer, frames.byteOffset, frames.byteLength);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function decodeFrames(b64: string): Int16Array {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
}

function clamp16(x: number): number {
  return Math.max(-32768, Math.min(32767, Math.round(x)));
}

/** Görünür top ölçeği: düşerken ve deliğe girerken küçülür. */
export function ballScale(sim: Simulation): number {
  if (sim.phase === 'falling') return Math.max(0, 1 - sim.phaseTime / (FALL_DURATION * 0.8));
  if (sim.phase === 'finishing' || sim.phase === 'finished') return Math.max(0, 1 - sim.phaseTime / (FINISH_DURATION * 0.7));
  return 1;
}

export class GhostRecorder {
  private buf: number[] = [];
  private nextT = 0;

  /** Her fizik adımından sonra çağrılır. */
  sample(sim: Simulation): void {
    if (!sim.started) return;
    while (sim.raceTime + 1e-9 >= this.nextT) {
      this.buf.push(clamp16(sim.yL), clamp16(sim.yR), clamp16(sim.u), clamp16(ballScale(sim) * 1000));
      this.nextT += 1 / GHOST_HZ;
    }
  }

  /** Son kareyi ekleyip kaydı üretir. */
  finish(sim: Simulation, levelId: string, ball: BallType): GhostData {
    this.buf.push(clamp16(sim.yL), clamp16(sim.yR), clamp16(sim.u), 0);
    return { v: 1, levelId, ball, time: sim.finishTime, data: encodeFrames(Int16Array.from(this.buf)) };
  }

  get frameCount(): number {
    return this.buf.length / CH;
  }
}

export class GhostPlayer {
  readonly frames: Int16Array;
  readonly count: number;
  /** Her karede hayaletin o ana kadar ulaştığı en yüksek top yüksekliği */
  private readonly maxHeight: Float32Array;
  private readonly tmp = { x: 0, y: 0 };

  constructor(
    readonly ghost: GhostData,
    private width: number,
    private depth: number,
    private radius: number,
  ) {
    this.frames = decodeFrames(ghost.data);
    this.count = Math.floor(this.frames.length / CH);
    this.maxHeight = new Float32Array(this.count);
    let m = -Infinity;
    for (let i = 0; i < this.count; i++) {
      const f = this.frameAt(i);
      const c = ballCenter(f.yL, f.yR, f.u, width, depth, radius, this.tmp);
      if (f.scale > 0.5) m = Math.max(m, c.y);
      this.maxHeight[i] = m;
    }
  }

  private frameAt(i: number): GhostFrame {
    const o = i * CH;
    const f = this.frames;
    return { yL: f[o], yR: f[o + 1], u: f[o + 2], scale: f[o + 3] / 1000 };
  }

  /** Verilen yarış zamanındaki hayalet durumu (kareler arası doğrusal). */
  sample(time: number, out: GhostFrame): GhostFrame {
    const ft = Math.max(0, time * GHOST_HZ);
    const i = Math.min(this.count - 1, Math.floor(ft));
    const j = Math.min(this.count - 1, i + 1);
    const k = Math.min(1, ft - i);
    const a = i * CH;
    const b = j * CH;
    const f = this.frames;
    // Yeniden doğma sıçramalarında karıştırma yapma
    const jump = Math.abs(f[b] - f[a]) > 300 || Math.abs(f[b + 1] - f[a + 1]) > 300;
    const kk = jump ? 0 : k;
    out.yL = f[a] + (f[b] - f[a]) * kk;
    out.yR = f[a + 1] + (f[b + 1] - f[a + 1]) * kk;
    out.u = f[a + 2] + (f[b + 2] - f[a + 2]) * kk;
    out.scale = (f[a + 3] + (f[b + 3] - f[a + 3]) * kk) / 1000;
    return out;
  }

  /** Top merkezi (görüntü için). */
  ballAt(fr: GhostFrame): { x: number; y: number } {
    return ballCenter(fr.yL, fr.yR, fr.u, this.width, this.depth, this.radius, this.tmp);
  }

  /** Hayaletin bu yüksekliğe ilk ulaştığı zaman (sn). Ulaşmadıysa null. */
  timeToReach(height: number): number | null {
    // İkili arama: maxHeight artan bir dizi
    let lo = 0;
    let hi = this.count - 1;
    if (this.count === 0 || this.maxHeight[hi] < height) return null;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.maxHeight[mid] >= height) hi = mid;
      else lo = mid + 1;
    }
    return lo / GHOST_HZ;
  }

  /**
   * Anlık fark: oyuncu bu yüksekliğe şimdi ulaştı; hayalet ne zaman ulaşmıştı?
   * Artı = oyuncu geride, eksi = önde.
   */
  delta(playerTime: number, playerMaxHeight: number): number | null {
    const gt = this.timeToReach(playerMaxHeight);
    if (gt === null) return null;
    return playerTime - gt;
  }
}

export function parseGhost(json: string | null): GhostData | null {
  if (!json) return null;
  try {
    const g = JSON.parse(json) as GhostData;
    if (g && g.v === 1 && typeof g.data === 'string' && typeof g.time === 'number') return g;
  } catch {
    /* bozuk kayıt */
  }
  return null;
}
