// Oyunun fizik dünyası: sabit adımlı (120 Hz), deterministik.
// Three.js bu durumu sadece okur ve çizer.

import { ASSIST, BALL_TRAITS, WORLD_VACUUM, physics, type BallType } from '../../config/physics';
import type { LevelData } from '../levels/types';
import { barFrame, barPoint, equilibriumTilt, localAngle, type BarFrame } from './bar';
import { hitObstacle, obstacleTime, safeSpot, type FallCause } from './obstacles';
import { Track, type NearestResult, type Polyline } from './track';

export type SimPhase = 'playing' | 'falling' | 'finishing' | 'finished';

export type SimEvent =
  | { type: 'start' }
  | { type: 'star'; index: number }
  | { type: 'checkpoint'; index: number }
  | { type: 'fall'; cause: FallCause }
  | { type: 'respawn' }
  | { type: 'finish'; time: number }
  | { type: 'wall'; strength: number };

export interface SimOptions {
  ball: BallType;
  assist: boolean;
}

export const FALL_DURATION = 0.85;
export const FINISH_DURATION = 0.75;

/** Yardım modu için kontrol noktalarını tamamlar (en az 3, yolun tek geçtiği yüksekliklerde). */
export function effectiveCheckpoints(level: LevelData, assist: boolean): number[] {
  const base = [...(level.checkpoints ?? [])].sort((a, b) => a - b);
  if (!assist || base.length >= ASSIST.minCheckpoints) return base;
  const top = level.finishHole.y;
  const start = level.road[0].y;
  const mt = new Track({ ...level, branches: [] });
  const main = mt.main;
  const once = (y: number) =>
    crossingsOf(main, y) === 1 && crossingsOf(main, y - 60) === 1 && crossingsOf(main, y + 60) === 1 && safeSpot(level, mt.centerXAt(y), y);
  const n = ASSIST.minCheckpoints + 1;
  const out: number[] = [];
  for (let i = 1; i < n; i++) {
    const want = start + ((top - start) * i) / n;
    for (let off = 0; off < top; off += 10) {
      const y = [want + off, want - off].find((c) => c > start + 100 && c < top - 100 && once(c) && !out.includes(c));
      if (y !== undefined) {
        out.push(y);
        break;
      }
    }
  }
  return out.sort((a, b) => a - b);
}

/** Ana yol verilen yüksekliği kaç kez geçiyor? */
export function crossingsOf(line: Polyline, y: number): number {
  const { ys, count } = line;
  let n = 0;
  for (let i = 0; i < count - 1; i++) {
    const y0 = ys[i];
    const y1 = ys[i + 1];
    if ((y0 < y && y1 >= y) || (y0 > y && y1 <= y)) n++;
  }
  return n;
}

export class Simulation {
  readonly level: LevelData;
  readonly track: Track;
  readonly width: number;
  readonly opts: SimOptions;
  readonly checkpoints: number[];

  // Çubuk
  yL = 0;
  yR = 0;
  targetL = 0;
  targetR = 0;
  yMin = 0;
  yMax = 0;

  // Top (çubuk boyunca)
  u = 0;
  v = 0;
  /** Topun yuvarlandığı toplam açı (görüntü için) */
  roll = 0;
  ballX = 0;
  ballY = 0;
  /** Bu adımda topa etki eden dış ivme (görüntü/test için) */
  extAccel = 0;

  phase: SimPhase = 'playing';
  started = false;
  raceTime = 0;
  simTime = 0;
  phaseTime = 0;
  finishTime = 0;
  falls = 0;
  lastCheckpoint = -1;
  /** Son düşmenin nedeni ve yönü (görüntü için): delikte (x, y) deliğin merkezi, (dx, dy) savrulma yönü */
  fallInfo: { cause: FallCause; x: number; y: number; dx: number; dy: number } = { cause: 'edge', x: 0, y: 0, dx: 0, dy: 0 };
  private prevBallY = -Infinity;
  readonly starsCollected: boolean[];
  events: SimEvent[] = [];

  private readonly frame: BarFrame = { length: 1, theta: 0, cos: 1, sin: 0 };
  private readonly pt = { x: 0, y: 0 };
  private readonly near: NearestResult;
  private readonly respawnHeights: number[];

  constructor(level: LevelData, opts: SimOptions) {
    this.level = level;
    this.opts = opts;
    this.width = level.boardWidth;
    this.track = new Track(level);
    this.checkpoints = effectiveCheckpoints(level, opts.assist);
    this.starsCollected = (level.stars ?? []).map(() => false);
    this.near = { dist: 0, halfWidth: 0, cx: 0, cy: 0, line: this.track.main };

    const r = physics.ballRadius;
    const startY = level.road[0].y + r * 1.2;
    this.respawnHeights = [startY, ...this.checkpoints];
    this.placeBall(level.road[0].x, startY);
    this.yMin = Math.min(this.yL, this.yR) - 30;
    this.yMax = level.finishHole.y + level.finishHole.r + r * 2;
  }

  get depth(): number {
    return physics.sagRatio * physics.ballRadius * 2;
  }

  get maxDiff(): number {
    return this.width * Math.tan((physics.maxTiltDeg * Math.PI) / 180);
  }

  /** Çubuğu, top (x, y) noktasında kendiliğinden duracak şekilde yerleştirir. */
  placeBall(x: number, y: number): void {
    const W = this.width;
    const D = this.depth;
    const r = physics.ballRadius;
    let s = Math.min(0.85, Math.max(0.15, x / W));
    const maxT = (physics.maxTiltDeg * Math.PI) / 180;
    const theta = Math.max(-maxT, Math.min(maxT, equilibriumTilt(s, D, W)));
    const half = (W / 2) * Math.tan(theta);
    let mean = y;
    for (let i = 0; i < 4; i++) {
      this.yL = mean - half;
      this.yR = mean + half;
      barFrame(this.yL, this.yR, W, this.frame);
      this.u = s * this.frame.length;
      barPoint(this.yL, this.frame, this.u, D, r, this.pt);
      // x ve y hatasını düzelt
      s = Math.min(0.85, Math.max(0.15, s + (x - this.pt.x) / this.frame.length));
      mean += y - this.pt.y;
    }
    this.yL = mean - half;
    this.yR = mean + half;
    barFrame(this.yL, this.yR, W, this.frame);
    this.u = s * this.frame.length;
    this.v = 0;
    this.targetL = this.yL;
    this.targetR = this.yR;
    this.updateBallPosition();
  }

  /** Halat girdisi: uç hedeflerini kaydırır (birim). */
  nudge(dL: number, dR: number): void {
    if (this.phase === 'finishing' || this.phase === 'finished') return;
    if (dL === 0 && dR === 0) return;
    this.markStarted();
    this.targetL += dL;
    this.targetR += dR;
    this.clampTargets(Math.abs(dL) >= Math.abs(dR) ? 'L' : 'R');
  }

  /** Eğim modu: istenen eğim açısı (radyan) ve yükseltme miktarı. */
  setTiltLift(tilt: number, lift: number): void {
    if (this.phase === 'finishing' || this.phase === 'finished') return;
    const maxT = (physics.maxTiltDeg * Math.PI) / 180;
    const t = Math.max(-maxT, Math.min(maxT, tilt));
    const mean = (this.targetL + this.targetR) / 2 + lift;
    const half = (this.width / 2) * Math.tan(t);
    const nL = mean - half;
    const nR = mean + half;
    // Kronometre, çubuk gerçekten oynatılınca başlar
    if (lift !== 0 || Math.abs(nL - this.targetL) > 2 || Math.abs(nR - this.targetR) > 2) this.markStarted();
    this.targetL = nL;
    this.targetR = nR;
    this.clampTargets('both');
  }

  private markStarted(): void {
    if (!this.started && this.phase === 'playing') {
      this.started = true;
      this.events.push({ type: 'start' });
    }
  }

  private clampTargets(moved: 'L' | 'R' | 'both'): void {
    const lead = physics.maxLead;
    const lo = this.yMin;
    const hi = this.yMax;
    this.targetL = Math.max(lo, Math.min(hi, this.targetL));
    this.targetR = Math.max(lo, Math.min(hi, this.targetR));
    this.targetL = Math.max(this.yL - lead, Math.min(this.yL + lead, this.targetL));
    this.targetR = Math.max(this.yR - lead, Math.min(this.yR + lead, this.targetR));
    const md = this.maxDiff;
    const diff = this.targetR - this.targetL;
    if (Math.abs(diff) > md) {
      const excess = diff - Math.sign(diff) * md;
      if (moved === 'L') this.targetL += excess;
      else if (moved === 'R') this.targetR -= excess;
      else {
        this.targetL += excess / 2;
        this.targetR -= excess / 2;
      }
    }
  }

  /** Bir sabit adım ilerletir. */
  step(): void {
    const dt = 1 / physics.stepHz;
    this.simTime += dt;
    this.phaseTime += dt;
    if (this.started && (this.phase === 'playing' || this.phase === 'falling')) {
      this.raceTime += dt;
    }

    if (this.phase === 'finished') return;

    if (this.phase === 'finishing') {
      if (this.phaseTime >= FINISH_DURATION) this.setPhase('finished');
      return;
    }

    if (this.phase === 'falling') {
      if (this.phaseTime >= FALL_DURATION) this.respawn();
      return;
    }

    this.moveEnds(dt);
    this.moveBall(dt);
    this.updateBallPosition();
    this.checkRules();
  }

  private moveEnds(dt: number): void {
    const maxStep = physics.endSpeed * dt;
    const pL = this.yL;
    const pR = this.yR;
    this.yL += Math.max(-maxStep, Math.min(maxStep, this.targetL - this.yL));
    this.yR += Math.max(-maxStep, Math.min(maxStep, this.targetR - this.yR));
    // Uçlar hedefe farklı hızla yaklaşırken eğim sınırı aşılmasın
    const md = this.maxDiff;
    const diff = this.yR - this.yL;
    if (Math.abs(diff) > md) {
      const excess = diff - Math.sign(diff) * md;
      if (Math.abs(this.yL - pL) >= Math.abs(this.yR - pR)) this.yL += excess;
      else this.yR -= excess;
    }
    this.yL = Math.max(this.yMin, Math.min(this.yMax, this.yL));
    this.yR = Math.max(this.yMin, Math.min(this.yMax, this.yR));
  }

  private moveBall(dt: number): void {
    const traits = BALL_TRAITS[this.opts.ball];
    const assist = this.opts.assist;
    const f = barFrame(this.yL, this.yR, this.width, this.frame);
    const D = this.depth;
    const r = physics.ballRadius;
    const s = Math.min(1, Math.max(0, this.u / f.length));
    const ang = localAngle(f, s, D);

    let a = -physics.gravity * traits.gravityScale * physics.rollFactor * Math.sin(ang);
    a -= physics.friction * traits.frictionScale * this.v;

    // Dış kuvvetler: dünya ivmesi (ax, ay) çubuk doğrultusuna izdüşürülür
    const ext = this.externalAccel(traits.mass, assist);
    const along = ext.ax * f.cos + ext.ay * f.sin;
    this.extAccel = along;
    a += along;

    this.v += a * dt;
    const vmax = physics.maxBallSpeed * (assist ? ASSIST.maxSpeedMultiplier : 1);
    if (this.v > vmax) this.v = vmax;
    if (this.v < -vmax) this.v = -vmax;
    const du = this.v * dt;
    this.u += du;
    this.roll += du / r;

    // Uç duvarları
    const uMin = r;
    const uMax = f.length - r;
    const rest = Math.min(0.95, physics.restitution * traits.restitutionScale);
    if (this.u < uMin) {
      this.u = uMin + (uMin - this.u) * rest;
      if (this.v < 0) {
        if (this.v < -60) this.events.push({ type: 'wall', strength: Math.min(1, -this.v / 900) });
        this.v = -this.v * rest;
      }
    } else if (this.u > uMax) {
      this.u = uMax - (this.u - uMax) * rest;
      if (this.v > 0) {
        if (this.v > 60) this.events.push({ type: 'wall', strength: Math.min(1, this.v / 900) });
        this.v = -this.v * rest;
      }
    }
  }

  private readonly extOut = { ax: 0, ay: 0 };

  /** Vakum, rüzgâr ve mıknatısın topa uyguladığı dünya ivmesi. */
  externalAccel(mass: number, assist: boolean): { ax: number; ay: number } {
    const out = this.extOut;
    out.ax = 0;
    out.ay = 0;
    const L = this.level;
    const bx = this.ballX;
    const by = this.ballY;
    const hazard = assist ? ASSIST.hazardMultiplier : 1;

    // Vakum: pistin ortasına doğru hafif çekim (tarif 5.1)
    if (L.vacuum && L.vacuum.length) {
      let worldF = WORLD_VACUUM[L.world] ?? 0;
      for (const z of L.vacuum) {
        const dz = Math.hypot(bx - z.x, by - z.y);
        if (dz > z.radius) continue;
        let strength = z.strength * worldF;
        if (assist) strength = Math.max(strength * ASSIST.vacuumMultiplier, ASSIST.vacuumMinStrength);
        if (strength <= 0) continue;
        this.track.nearest(bx, by, this.near);
        const off = this.near.dist;
        if (off < 1) continue;
        const k = (strength * physics.vacuumForce * Math.min(1.5, off / Math.max(1, this.near.halfWidth))) / off;
        // Bölge kenarına doğru yumuşakça azalır
        const fade = Math.min(1, (z.radius - dz) / (z.radius * 0.25));
        out.ax += (this.near.cx - bx) * k * fade;
        out.ay += (this.near.cy - by) * k * fade;
      }
    }

    // Rüzgâr (tarif 5.4)
    for (const w of L.wind ?? []) {
      if (bx < w.x || bx > w.x + w.w || by < w.y || by > w.y + w.h) continue;
      const pulse = w.pulse ? 0.5 + 0.5 * Math.sin((2 * Math.PI * this.simTime) / w.pulse) : 1;
      out.ax += (w.force * physics.windForce * pulse * hazard) / mass;
    }

    // Mıknatıs (tarif 5.5)
    for (const m of L.magnets ?? []) {
      if (!magnetActive(m.onOff, this.simTime)) continue;
      const dx = m.x - bx;
      const dy = m.y - by;
      const d = Math.hypot(dx, dy);
      if (d > m.radius || d < 1) continue;
      const fall = 1 - d / m.radius;
      const k = (m.strength * physics.magnetForce * fall * fall * hazard) / mass / d;
      out.ax += dx * k;
      out.ay += dy * k;
    }
    return out;
  }

  updateBallPosition(): void {
    const f = barFrame(this.yL, this.yR, this.width, this.frame);
    barPoint(this.yL, f, this.u, this.depth, physics.ballRadius, this.pt);
    this.ballX = this.pt.x;
    this.ballY = this.pt.y;
  }

  private checkRules(): void {
    const bx = this.ballX;
    const by = this.ballY;
    const L = this.level;

    // Toplanabilir yıldızlar
    const stars = L.stars ?? [];
    const pr = physics.starPickupRadius;
    for (let i = 0; i < stars.length; i++) {
      if (this.starsCollected[i]) continue;
      if (Math.hypot(bx - stars[i].x, by - stars[i].y) < pr) {
        this.starsCollected[i] = true;
        this.events.push({ type: 'star', index: i });
      }
    }

    // Bitiş deliği (tarif 3.4)
    const h = L.finishHole;
    if (Math.hypot(bx - h.x, by - h.y) <= h.r) {
      this.finishTime = this.raceTime;
      this.setPhase('finishing');
      this.events.push({ type: 'finish', time: this.finishTime });
      return;
    }

    // Engeller: delik, fırlatıcı, dönen kol
    const hazard = hitObstacle(L, bx, by, obstacleTime(this.simTime, this.opts.assist));
    if (hazard) {
      this.fall(hazard);
      return;
    }

    // Düşme kuralı (tarif 3.3)
    if (!this.track.isOnTrack(bx, by)) {
      this.fall('edge');
      return;
    }

    // Kontrol noktaları
    // Sayılması için top çizgiyi ana yolun üzerinden geçmeli: çatalda öbür yoldan
    // giden oyuncu bu noktayı atlar ve düşerse daha aşağıdaki noktadan başlar.
    const prevY = this.prevBallY;
    this.prevBallY = by;
    for (let i = this.checkpoints.length - 1; i > this.lastCheckpoint; i--) {
      const cy = this.checkpoints[i];
      if (prevY < cy && by >= cy && Math.abs(bx - this.track.centerXAt(cy)) <= this.track.widthAt(cy) / 2 + physics.ballRadius) {
        this.lastCheckpoint = i;
        this.events.push({ type: 'checkpoint', index: i });
        break;
      }
    }
  }

  private fall(cause: FallCause): void {
    const fi = this.fallInfo;
    const bx = this.ballX;
    const by = this.ballY;
    fi.cause = cause;
    fi.x = bx;
    fi.y = by;
    fi.dx = this.v < 0 ? -1 : 1;
    fi.dy = 0;
    const L = this.level;
    if (cause === 'hole') {
      for (const h of L.holes ?? []) if (Math.hypot(bx - h.x, by - h.y) < h.r) ((fi.x = h.x), (fi.y = h.y));
    } else if (cause === 'arm') {
      // Kolun o noktadaki hareket yönü: göbek etrafında teğet
      let best = Infinity;
      for (const a of L.arms ?? []) {
        const d = Math.hypot(bx - a.x, by - a.y);
        if (d >= best) continue;
        best = d;
        const s = Math.sign(a.speed) || 1;
        const rx = (bx - a.x) / Math.max(1, d);
        const ry = (by - a.y) / Math.max(1, d);
        fi.dx = -ry * s;
        fi.dy = rx * s;
      }
    } else if (cause === 'pop') {
      fi.dx = bx < 500 ? 1 : -1;
    }
    this.falls++;
    this.setPhase('falling');
    this.events.push({ type: 'fall', cause });
  }

  private respawn(): void {
    const y = this.respawnHeights[this.lastCheckpoint + 1];
    const x = this.track.centerXAt(y);
    this.placeBall(x, y);
    this.prevBallY = this.ballY;
    this.setPhase('playing');
    this.events.push({ type: 'respawn' });
  }

  private setPhase(p: SimPhase): void {
    this.phase = p;
    this.phaseTime = 0;
  }

  /** Olayları alır ve listeyi boşaltır. */
  drainEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  /** İlerleme ölçüsü (hayalet farkı için): topun ulaştığı yükseklik. */
  get progress(): number {
    return this.ballY;
  }
}

export function magnetActive(onOff: [number, number] | undefined, t: number): boolean {
  if (!onOff) return true;
  const [on, off] = onOff;
  const period = on + off;
  if (period <= 0) return true;
  return t % period < on;
}
