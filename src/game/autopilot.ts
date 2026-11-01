// Otopilot: etapları kendi kendine oynayan basit bir denetleyici.
// Testlerde her etabın bitirilebildiğini doğrulamak ve süre hedeflerini
// tahmin etmek için kullanılır. Geliştirici panelinden de açılabilir.
//
// Yöntem: yol merkezini referans alır, topun gitmesi gereken ivmeyi
// (referansın ivmesi + konum ve hız hatası) hesaplar ve çubuk eğimini
// buna göre seçer. Virajın sertliğine göre yükselme hızını ayarlar.

import { BALL_TRAITS, physics } from '../config/physics';
import { sagSlope } from './physics/bar';
import type { Simulation } from './physics/sim';
import type { Polyline } from './physics/track';

export interface AutopilotTuning {
  /** Konum kazancı (1/sn²) */
  kp: number;
  /** Hız kazancı (1/sn) */
  kd: number;
  /** Virajda kullanılabilecek en büyük yanal ivme (birim/sn²) */
  lateralBudget: number;
  /** En yüksek yükselme hızı, uç hızına oranla */
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

export class Autopilot {
  private vy = 0;

  constructor(private tuning: AutopilotTuning = DEFAULT_AUTOPILOT) {}

  /** Her fizik adımından önce çağrılır. */
  control(sim: Simulation): void {
    if (sim.phase !== 'playing') {
      this.vy = 0;
      return;
    }
    const t = this.tuning;
    const W = sim.width;
    const dt = 1 / physics.stepHz;
    const r = physics.ballRadius;
    const line = this.pickLine(sim);
    const tr = sim.track;
    // Eğimden bağımsız ilerleme yüksekliği: çubuk düz olsaydı top nerede olurdu
    const len0 = Math.hypot(W, sim.yR - sim.yL);
    const s0 = clamp(sim.u / len0, 0, 1);
    const by = (sim.yL + sim.yR) / 2 + r - sim.depth * 4 * s0 * (1 - s0);
    const cx = (y: number) => clamp(tr.centerXAt(y, line), r + 15, W - r - 15);

    // Önümüzdeki virajın en sert yeri: yükselme hızını sınırlar
    let maxCurv = 0;
    const h = 40;
    for (let k = 0; k <= 260; k += 40) {
      const y = by + k;
      const c = Math.abs(cx(y + h) - 2 * cx(y) + cx(y - h)) / (h * h);
      if (c > maxCurv) maxCurv = c;
    }
    let maxSlope = 0;
    for (let k = 0; k <= 160; k += 40) {
      maxSlope = Math.max(maxSlope, Math.abs(cx(by + k + 20) - cx(by + k - 20)) / 40);
    }
    const halfW = tr.widthAt(by, line) / 2;
    const err0 = cx(by) - sim.ballX;
    let vyWant = physics.endSpeed * t.liftScale;
    if (maxCurv > 1e-6) vyWant = Math.min(vyWant, Math.sqrt(t.lateralBudget / maxCurv));
    // Yol yataya yakınsa topun yana yetişmesi için yavaşla
    vyWant = Math.min(vyWant, 900 / (1 + maxSlope * maxSlope) / Math.max(1, maxSlope));
    // Hata büyükse yavaşla
    vyWant *= clamp(1 - Math.abs(err0) / Math.max(30, halfW * 0.9), 0.05, 1);
    // Yükselme hızı yumuşak değişsin
    const acc = 900 * dt;
    this.vy += clamp(vyWant - this.vy, -acc * 3, acc);

    // Referans: konum, hız ve ivme
    const vy = this.vy;
    const xRef = cx(by);
    const slope = (cx(by + 20) - cx(by - 20)) / 40;
    const curv = (cx(by + h) - 2 * xRef + cx(by - h)) / (h * h);
    const vRef = slope * vy;
    const aRef = curv * vy * vy;

    const len = Math.hypot(W, sim.yR - sim.yL);
    const vx = sim.v * (W / len);
    let aDes = aRef + t.kp * (xRef - sim.ballX) + t.kd * (vRef - vx);

    const traits = BALL_TRAITS[sim.opts.ball];
    const G = physics.gravity * traits.gravityScale * physics.rollFactor;
    // Sürtünme ve dış kuvvetleri telafi et
    aDes += physics.friction * traits.frictionScale * sim.v - sim.extAccel;
    const sn = clamp(-aDes / G, -0.95, 0.95);
    const s = sim.u / len;
    const sagAng = Math.atan(sagSlope(clamp(s, 0, 1), sim.depth, len));
    const tilt = clamp(Math.asin(sn) - sagAng, -t.maxTilt, t.maxTilt);
    sim.setTiltLift(tilt, vy * dt);
  }

  private pickLine(sim: Simulation): Polyline {
    const lines = sim.track.lines;
    if (lines.length === 1) return lines[0];
    const want = this.tuning.preferShort ? 'short' : 'long';
    for (const l of lines) {
      if (l.kind === want && sim.ballY >= l.ys[0] - 40 && sim.ballY <= l.ys[l.count - 1]) return l;
    }
    return lines[0];
  }
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
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
