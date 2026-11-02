// Otopilot: etapları kendi kendine oynayan denetleyici.
// Testlerde her etabın bitirilebildiğini doğrulamak ve süre hedeflerini
// tahmin etmek için kullanılır. Geliştirici panelinden de açılabilir.
//
// Yöntem: yolu baştan sona tek bir rota (yay uzunluğuyla) olarak izler; yol aşağı
// dönse bile çalışır. Rotada ilerleyen bir referans noktası seçer:
//  - yatay: topun gitmesi gereken ivmeyi (referansın ivmesi + konum ve hız hatası)
//    hesaplar ve çubuk eğimini buna göre seçer,
//  - dikey: çubuğu referansın yüksekliğine doğru kaldırır ya da indirir.
// Virajın sertliğine göre rotadaki hızı ayarlar.

import { BALL_TRAITS, physics } from '../config/physics';
import type { LevelData } from './levels/types';
import { sagSlope } from './physics/bar';
import { ARM_HALF, ARM_HUB_R, armHits, obstacleTime, popperState } from './physics/obstacles';
import type { Simulation } from './physics/sim';
import type { Polyline } from './physics/track';

export interface AutopilotTuning {
  /** Konum kazancı (1/sn²) */
  kp: number;
  /** Hız kazancı (1/sn) */
  kd: number;
  /** Virajda kullanılabilecek en büyük yanal ivme (birim/sn²) */
  lateralBudget: number;
  /** En yüksek dikey hız, uç hızına oranla */
  liftScale: number;
  /** Botun kullandığı en büyük eğim (radyan) */
  maxTilt: number;
  /** Kısa yolu tercih et */
  preferShort: boolean;
}

export const DEFAULT_AUTOPILOT: AutopilotTuning = {
  kp: 6,
  kd: 4,
  lateralBudget: 200,
  liftScale: 0.55,
  maxTilt: 0.22,
  preferShort: false,
};

/** Baştan sona izlenecek rota (ana yol, istenirse kısa yol kolları eklenmiş). */
export interface Route {
  xs: number[];
  ys: number[];
  ws: number[];
  len: number[];
  total: number;
}

function nearestIndex(line: Polyline, x: number, y: number): number {
  let best = Infinity;
  let bi = 0;
  for (let i = 0; i < line.count; i++) {
    const d = (line.xs[i] - x) ** 2 + (line.ys[i] - y) ** 2;
    if (d < best) {
      best = d;
      bi = i;
    }
  }
  return bi;
}

export function buildRoute(lines: Polyline[], preferShort: boolean, level?: LevelData): Route {
  const main = lines[0];
  const xs: number[] = [];
  const ys: number[] = [];
  const ws: number[] = [];
  const take = (l: Polyline, a: number, b: number) => {
    for (let i = a; i <= b; i++) {
      xs.push(l.xs[i]);
      ys.push(l.ys[i]);
      ws.push(l.ws[i]);
    }
  };
  const branches = preferShort ? lines.slice(1).filter((l) => l.kind === 'short') : [];
  // Kolları ana yoldaki ayrılma yerine göre sırala
  const spans = branches
    .map((b) => ({ b, i0: nearestIndex(main, b.xs[0], b.ys[0]), i1: nearestIndex(main, b.xs[b.count - 1], b.ys[b.count - 1]) }))
    .filter((s) => s.i1 > s.i0)
    .sort((a, b) => a.i0 - b.i0);
  let cur = 0;
  for (const s of spans) {
    if (s.i0 < cur) continue;
    take(main, cur, s.i0);
    take(s.b, 1, s.b.count - 2);
    cur = s.i1;
  }
  take(main, cur, main.count - 1);
  const lenOf = () => {
    const len = [0];
    for (let i = 1; i < xs.length; i++) len.push(len[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
    return len;
  };
  let len = lenOf();
  if (level && (level.holes?.length || level.arms?.length)) {
    avoidSpots(xs, ys, ws, len, level);
    len = lenOf();
  }
  return { xs, ys, ws, len, total: len[len.length - 1] };
}

/**
 * Rotayı deliklerin ve dönen kol göbeklerinin yanından geçecek şekilde yana kaydırır.
 * Kayma yumuşak bir tümsek gibi açılıp kapanır; ws, o bölgede kalan şerit genişliği olur.
 */
function avoidSpots(xs: number[], ys: number[], ws: number[], len: number[], L: LevelData): void {
  const n = xs.length;
  const nxs = new Float64Array(n);
  const nys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 2);
    const b = Math.min(n - 1, i + 2);
    const tx = xs[b] - xs[a];
    const ty = ys[b] - ys[a];
    const tl = Math.hypot(tx, ty) || 1;
    nxs[i] = -ty / tl;
    nys[i] = tx / tl;
  }
  const contact = physics.ballRadius * physics.armContact;
  const spots = [
    ...(L.holes ?? []).map((h) => ({ x: h.x, y: h.y, keep: h.r + 36, narrow: true })),
    // Kolda şerit daraltılmaz: bot kolun içinde yavaşlamasın
    ...(L.arms ?? []).map((a) => ({ x: a.x, y: a.y, keep: ARM_HUB_R + contact + 30, narrow: false })),
  ];
  const off = new Float64Array(n);
  const lane = new Float64Array(n).fill(Infinity);
  for (const sp of spots) {
    let j = 0;
    let bd = Infinity;
    for (let i = 0; i < n; i++) {
      const d = (xs[i] - sp.x) ** 2 + (ys[i] - sp.y) ** 2;
      if (d < bd) {
        bd = d;
        j = i;
      }
    }
    const o = (sp.x - xs[j]) * nxs[j] + (sp.y - ys[j]) * nys[j];
    const bound = ws[j] / 2 - 26;
    let p = 0;
    if (Math.abs(o) < sp.keep) {
      const cands = [o + sp.keep, o - sp.keep].sort((u, v) => Math.abs(u) - Math.abs(v));
      p = cands.find((c) => Math.abs(c) <= bound) ?? Math.max(-bound, Math.min(bound, cands[0]));
    }
    const laneHalf = Math.max(24, Math.min(ws[j] / 2 - Math.abs(p), Math.abs(p - o) - (sp.keep - 36)));
    const plateau = sp.keep + 40;
    const ramp = 230;
    for (let i = 0; i < n; i++) {
      const ds = Math.abs(len[i] - len[j]);
      if (ds > plateau + ramp) continue;
      const k = ds <= plateau ? 1 : 1 - (ds - plateau) / ramp;
      const e = k * k * (3 - 2 * k);
      if (Math.abs(p * e) > Math.abs(off[i])) off[i] = p * e;
      if (ds <= plateau && sp.narrow) lane[i] = Math.min(lane[i], laneHalf);
    }
  }
  for (let i = 0; i < n; i++) {
    // Kayma yolun içinde kalsın (virajda normal dışarı bakabilir)
    const lim = Math.max(0, ws[i] / 2 - 30);
    off[i] = Math.max(-lim, Math.min(lim, off[i]));
    xs[i] += nxs[i] * off[i];
    ys[i] += nys[i] * off[i];
    if (lane[i] < Infinity) ws[i] = Math.min(ws[i], lane[i] * 2);
  }
}

/** Zamanlı engel kapısı: rotanın [sA, sB] aralığı bu engelin erişiminde */
interface Gate {
  sA: number;
  sB: number;
  /** Aralıktaki rota örnekleri */
  pts: { s: number; x: number; y: number }[];
  hit: (x: number, y: number, t: number) => boolean;
  /** Geçmeye karar verildi */
  go: boolean;
}

function buildGates(route: Route, L: LevelData): Gate[] {
  const gates: Gate[] = [];
  const contact = physics.ballRadius * physics.armContact;
  const tmp = { lift: 0, warn: 0, active: false };
  const make = (cx: number, cy: number, zone: number, hit: Gate['hit']) => {
    const pts: Gate['pts'] = [];
    for (let i = 0; i < route.xs.length; i++) {
      if (Math.hypot(route.xs[i] - cx, route.ys[i] - cy) < zone) pts.push({ s: route.len[i], x: route.xs[i], y: route.ys[i] });
    }
    if (pts.length) gates.push({ sA: pts[0].s, sB: pts[pts.length - 1].s, pts, hit, go: false });
  };
  for (const a of L.arms ?? []) make(a.x, a.y, a.length + ARM_HALF + contact + 25, (x, y, t) => armHits(a, x, y, t, 10));
  for (const p of L.poppers ?? []) make(p.x, p.y, p.r + 25, (x, y, t) => Math.hypot(x - p.x, y - p.y) < p.r + 18 && popperState(p, t, tmp).active);
  return gates.sort((a, b) => a.sA - b.sA);
}

interface Pt {
  x: number;
  y: number;
  w: number;
}

export class Autopilot {
  private route: Route | null = null;
  private routeSim: Simulation | null = null;
  /** Referansın rotadaki yeri */
  private s = 0;
  /** Topun rotadaki yeri */
  private sBall = 0;
  private vs = 0;
  private lastPhase = '';
  private gates: Gate[] = [];
  private idx = 0;
  private p0: Pt = { x: 0, y: 0, w: 0 };
  private p1: Pt = { x: 0, y: 0, w: 0 };
  private p2: Pt = { x: 0, y: 0, w: 0 };

  constructor(private tuning: AutopilotTuning = DEFAULT_AUTOPILOT) {}

  /** Rota üzerinde s noktası (doğrusal ara değer) */
  private at(s: number, out: Pt): Pt {
    const r = this.route!;
    const n = r.len.length;
    s = Math.max(0, Math.min(r.total, s));
    let i = Math.min(this.idx, n - 2);
    while (i > 0 && r.len[i] > s) i--;
    while (i < n - 2 && r.len[i + 1] < s) i++;
    this.idx = i;
    const seg = r.len[i + 1] - r.len[i] || 1;
    const k = (s - r.len[i]) / seg;
    out.x = r.xs[i] + (r.xs[i + 1] - r.xs[i]) * k;
    out.y = r.ys[i] + (r.ys[i + 1] - r.ys[i]) * k;
    out.w = r.ws[i] + (r.ws[i + 1] - r.ws[i]) * k;
    return out;
  }

  /** Topa rotadaki en yakın nokta (aralık içinde arar) */
  private locate(x: number, y: number, from: number, to: number, step: number): number {
    let best = Infinity;
    let bs = from;
    for (let s = Math.max(0, from); s <= Math.min(this.route!.total, to); s += step) {
      const p = this.at(s, this.p0);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < best) {
        best = d;
        bs = s;
      }
    }
    return bs;
  }

  /**
   * Şimdi yola çıkarsa kapıdan çarpmadan geçer mi? Topun şimdiki hızından
   * vCap hızına ivmelenir varsayımıyla her rota noktasına varış zamanını tahmin eder,
   * bir zaman payıyla engelin o anki durumuna bakar.
   */
  private clearAhead(sim: Simulation, g: Gate, vCap: number): boolean {
    const a = 600;
    const v0 = Math.min(vCap, Math.max(0, this.vs));
    const tAcc = (vCap - v0) / a;
    const dAcc = v0 * tAcc + 0.5 * a * tAcc * tAcc;
    const arrive = (d: number) => {
      if (d <= 0) return 0;
      if (d < dAcc) return (-v0 + Math.sqrt(v0 * v0 + 2 * a * d)) / a;
      return tAcc + (d - dAcc) / vCap;
    };
    for (const p of g.pts) {
      const t = arrive(p.s - this.sBall + 30);
      for (let k = -2; k <= 5; k++) {
        if (g.hit(p.x, p.y, obstacleTime(sim.simTime + t + k * 0.12, sim.opts.assist))) return false;
      }
    }
    return true;
  }

  /** Her fizik adımından önce çağrılır. */
  control(sim: Simulation): void {
    const t = this.tuning;
    if (this.routeSim !== sim || !this.route) {
      this.route = buildRoute(sim.track.lines, t.preferShort, sim.level);
      this.gates = buildGates(this.route, sim.level);
      this.routeSim = sim;
      this.s = this.sBall = 0;
      this.vs = 0;
    }
    if (sim.phase !== 'playing') {
      this.vs = 0;
      this.lastPhase = sim.phase;
      return;
    }
    const W = sim.width;
    const dt = 1 / physics.stepHz;
    const r = physics.ballRadius;
    const route = this.route;

    // Eğimden bağımsız top yüksekliği: çubuk düz olsaydı top nerede olurdu
    const len = Math.hypot(W, sim.yR - sim.yL);
    const sb = Math.min(1, Math.max(0, sim.u / len));
    const yLevel = (sim.yL + sim.yR) / 2 + r - sim.depth * 4 * sb * (1 - sb);

    if (this.lastPhase === 'falling') {
      // Yeniden doğunca rotadaki yeri baştan bul
      this.sBall = this.locate(sim.ballX, sim.ballY, 0, route.total, 8);
      this.s = this.sBall;
      for (const g of this.gates) if (g.sA > this.sBall) g.go = false;
    } else {
      this.sBall = this.locate(sim.ballX, yLevel, this.sBall - 200, this.sBall + 260, 6);
    }
    this.lastPhase = sim.phase;

    // Rotadaki hız: önümüzdeki virajın sertliği ve dikey hız sınırı
    const h = 40;
    let maxCurvX = 0;
    let maxSlopeY = 0;
    for (let k = 0; k <= 320; k += 40) {
      const s = this.s + k;
      const a = this.at(s - h, this.p0).x;
      const ay = this.p0.y;
      const b = this.at(s, this.p1).x;
      const c = this.at(s + h, this.p2).x;
      maxCurvX = Math.max(maxCurvX, Math.abs(a - 2 * b + c) / (h * h));
      maxSlopeY = Math.max(maxSlopeY, Math.abs(this.p2.y - ay) / (2 * h));
    }
    const here = this.at(this.sBall, this.p1);
    const halfW = Math.max(30, here.w / 2);
    const err = Math.hypot(here.x - sim.ballX, here.y - yLevel);
    let vsWant = 1200;
    if (maxCurvX > 1e-6) vsWant = Math.min(vsWant, Math.sqrt(t.lateralBudget / maxCurvX));
    if (maxSlopeY > 1e-3) vsWant = Math.min(vsWant, (physics.endSpeed * t.liftScale) / maxSlopeY);
    vsWant *= Math.max(0.05, Math.min(1, 1 - err / (halfW * 0.9)));
    // Zamanlı engel: güvenli an gelene kadar önünde bekle
    let holdS = Infinity;
    const gate = this.gates.find((g) => g.sB > this.sBall);
    if (gate && this.sBall > gate.sA) gate.go = true;
    else if (gate && gate.sA - this.sBall < 320) {
      // Kapıya girene kadar her adımda yeniden bak: top yavaş kalırsa vazgeçip bekler
      gate.go = this.clearAhead(sim, gate, Math.min(180, Math.max(100, vsWant * 0.85)));
      if (!gate.go) {
        holdS = gate.sA - 60;
        // Bekleme yerinde durabilecek hızda yaklaş
        vsWant = Math.min(vsWant, 25 + Math.sqrt(2 * 220 * Math.max(0, holdS - this.sBall)));
      }
    }
    const acc = 900 * dt;
    this.vs += Math.max(-acc * 3, Math.min(acc, vsWant - this.vs));
    // Referans topun en fazla biraz önünde koşsun
    this.s = Math.min(this.s + this.vs * dt, this.sBall + 50, route.total, holdS);
    if (this.s >= holdS - 1) this.vs = 0;
    this.s = Math.max(this.s, this.sBall - 30);

    // Referansın konumu, hızı ve ivmesi
    const vs = this.vs;
    const a0 = this.at(this.s - h, this.p0);
    const ax0 = a0.x;
    const ay0 = a0.y;
    const ref = this.at(this.s, this.p1);
    const xr = Math.max(r + 15, Math.min(W - r - 15, ref.x));
    const yr = ref.y;
    const rx = ref.x;
    const nx = this.at(this.s + h, this.p2);
    const dxds = (nx.x - ax0) / (2 * h);
    const dyds = (nx.y - ay0) / (2 * h);
    const d2x = (nx.x - 2 * rx + ax0) / (h * h);
    const vRef = dxds * vs;
    const aRef = d2x * vs * vs;

    // Yatay: eğim
    const vx = sim.v * (W / len);
    let aDes = aRef + t.kp * (xr - sim.ballX) + t.kd * (vRef - vx);
    const traits = BALL_TRAITS[sim.opts.ball];
    const G = physics.gravity * traits.gravityScale * physics.rollFactor;
    aDes += physics.friction * traits.frictionScale * sim.v - sim.extAccel;
    const sn = Math.max(-0.95, Math.min(0.95, -aDes / G));
    const sagAng = Math.atan(sagSlope(sb, sim.depth, len));
    const tilt = Math.max(-t.maxTilt, Math.min(t.maxTilt, Math.asin(sn) - sagAng));

    // Dikey: çubuğu referans yüksekliğine götür (yol aşağı dönünce indirir)
    const vyMax = physics.endSpeed * t.liftScale;
    const vy = Math.max(-vyMax, Math.min(vyMax, dyds * vs + 5 * (yr - yLevel)));
    sim.setTiltLift(tilt, vy * dt);
  }
}

/** Bir etabı baştan sona otopilotla oynatır. Süre ve düşme sayısını döndürür. */
export function runAutopilot(
  sim: Simulation,
  tuning: AutopilotTuning = DEFAULT_AUTOPILOT,
  maxSeconds = 240,
): { finished: boolean; time: number; falls: number; stars: number } {
  const ap = new Autopilot(tuning);
  const steps = maxSeconds * physics.stepHz;
  for (let i = 0; i < steps; i++) {
    ap.control(sim);
    sim.step();
    sim.drainEvents();
    if (sim.phase === 'finished' || sim.phase === 'finishing') break;
  }
  return {
    finished: sim.phase === 'finished' || sim.phase === 'finishing',
    time: sim.finishTime,
    falls: sim.falls,
    stars: sim.starsCollected.filter(Boolean).length,
  };
}
