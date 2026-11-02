import { beforeEach, describe, expect, test } from 'vitest';
import { physics, resetPhysics } from '../src/config/physics';
import { ballCenter, barFrame, equilibriumTilt, localAngle, sagDepth } from '../src/game/physics/bar';
import { Simulation, effectiveCheckpoints } from '../src/game/physics/sim';
import type { LevelData } from '../src/game/levels/types';
import { LEVELS } from '../src/game/levels';

const straight = (over: Partial<LevelData> = {}): LevelData => ({
  id: 't', name: 't', world: 1, height: 3000, boardWidth: 1000,
  road: [{ x: 500, y: 0, w: 300 }, { x: 500, y: 2900, w: 300 }],
  finishHole: { x: 500, y: 2800, r: 46 },
  checkpoints: [1000, 2000],
  stars: [{ x: 500, y: 600 }, { x: 500, y: 1200 }, { x: 900, y: 1500 }],
  timeTargets: { bronze: 60, silver: 40, gold: 20 },
  ...over,
});

function run(sim: Simulation, seconds: number, each?: () => void) {
  const n = Math.round(seconds * physics.stepHz);
  for (let i = 0; i < n; i++) {
    each?.();
    sim.step();
  }
}

beforeEach(() => resetPhysics());

describe('çukur (sag)', () => {
  test('derinlik ortada en büyük, uçlarda sıfır', () => {
    expect(sagDepth(0, 48)).toBe(0);
    expect(sagDepth(1, 48)).toBe(0);
    expect(sagDepth(0.5, 48)).toBeCloseTo(48);
  });

  test('düz çubukta top ortaya yuvarlanır ve orada durur', () => {
    const sim = new Simulation(straight(), { ball: 'standard', assist: false });
    sim.yL = sim.yR = sim.targetL = sim.targetR = 200;
    sim.u = 250;
    sim.v = 0;
    run(sim, 20);
    const L = barFrame(sim.yL, sim.yR, 1000).length;
    expect(Math.abs(sim.u - L / 2)).toBeLessThan(15);
    expect(Math.abs(sim.v)).toBeLessThan(15);
  });

  test('yerel açı: çukurun sol yarısında eğim aşağı doğru ortaya', () => {
    const f = barFrame(0, 0, 1000);
    expect(localAngle(f, 0.25, 48)).toBeLessThan(0);
    expect(localAngle(f, 0.75, 48)).toBeGreaterThan(0);
  });

  test('denge eğimi topu yerinde tutar', () => {
    const sim = new Simulation(straight({ road: [{ x: 500, y: 0, w: 1000 }, { x: 500, y: 2900, w: 1000 }] }), { ball: 'standard', assist: false });
    const s = 0.3;
    const th = equilibriumTilt(s, sim.depth, 1000);
    const half = 500 * Math.tan(th);
    sim.yL = sim.targetL = 300 - half;
    sim.yR = sim.targetR = 300 + half;
    sim.u = s * barFrame(sim.yL, sim.yR, 1000).length;
    sim.v = 0;
    const u0 = sim.u;
    run(sim, 1);
    expect(Math.abs(sim.u - u0)).toBeLessThan(2);
  });
});

describe('uç duvarları', () => {
  test('top uçtan dışarı çıkamaz ve geri seker', () => {
    const sim = new Simulation(straight({ road: [{ x: 500, y: 0, w: 1000 }, { x: 500, y: 2900, w: 1000 }] }), { ball: 'standard', assist: false });
    // Sert sağa eğim: sağ uç aşağıda
    sim.yL = sim.targetL = 500;
    sim.yR = sim.targetR = 500 - sim.maxDiff;
    let sawWall = false;
    let maxU = 0;
    for (let i = 0; i < 240; i++) {
      sim.step();
      maxU = Math.max(maxU, sim.u);
      if (sim.drainEvents().some((e) => e.type === 'wall')) sawWall = true;
    }
    const L = barFrame(sim.yL, sim.yR, 1000).length;
    expect(maxU).toBeLessThanOrEqual(L - physics.ballRadius + 1e-6);
    expect(sawWall).toBe(true);
  });

  test('çubuk eğimi en fazla ~25°', () => {
    const sim = new Simulation(straight(), { ball: 'standard', assist: false });
    for (let i = 0; i < 200; i++) {
      sim.nudge(40, -40);
      sim.step();
    }
    const deg = (Math.atan2(sim.yR - sim.yL, 1000) * 180) / Math.PI;
    expect(Math.abs(deg)).toBeLessThanOrEqual(physics.maxTiltDeg + 0.01);
  });

  test('uç hızı sınırlı (ışınlanma yok)', () => {
    const sim = new Simulation(straight(), { ball: 'standard', assist: false });
    const y0 = sim.yL;
    sim.nudge(5000, 5000);
    sim.step();
    expect(sim.yL - y0).toBeLessThanOrEqual(physics.endSpeed / physics.stepHz + 1e-9);
  });
});

describe('düşme ve kontrol noktası', () => {
  test('pist dışına çıkan top düşer ve son kontrol noktasından devam eder', () => {
    const sim = new Simulation(straight(), { ball: 'standard', assist: false });
    // Ortadan yukarı çık, ilk kontrol noktasını geç
    run(sim, 3, () => sim.setTiltLift(equilibriumTilt(sim.u / 1000, sim.depth, 1000), 5));
    expect(sim.lastCheckpoint).toBeGreaterThanOrEqual(0);
    // Sert eğ: top yol dışına
    const events: string[] = [];
    for (let i = 0; i < 600 && sim.phase === 'playing'; i++) {
      sim.setTiltLift(-0.4, 0);
      sim.step();
      events.push(...sim.drainEvents().map((e) => e.type));
    }
    expect(events).toContain('fall');
    expect(sim.falls).toBe(1);
    const t = sim.raceTime;
    run(sim, 1.2);
    expect(sim.drainEvents().map((e) => e.type)).toContain('respawn');
    expect(sim.phase).toBe('playing');
    expect(sim.ballY).toBeGreaterThanOrEqual(sim.checkpoints[sim.lastCheckpoint] - 1);
    // Süre durmaz
    expect(sim.raceTime).toBeGreaterThan(t + 1);
    expect(sim.track.isOnTrack(sim.ballX, sim.ballY)).toBe(true);
  });

  test('yardım modunda en az 3 kontrol noktası', () => {
    const lvl = straight({ checkpoints: [1500] });
    expect(effectiveCheckpoints(lvl, false)).toEqual([1500]);
    expect(effectiveCheckpoints(lvl, true).length).toBeGreaterThanOrEqual(3);
  });
});

describe('bitiş deliği', () => {
  test('top deliğe girince etap biter ve süre durur', () => {
    const sim = new Simulation(straight(), { ball: 'standard', assist: false });
    let finished = false;
    for (let i = 0; i < 120 * 30 && !finished; i++) {
      sim.setTiltLift(equilibriumTilt(sim.u / barFrame(sim.yL, sim.yR, 1000).length, sim.depth, 1000), 4);
      sim.step();
      if (sim.drainEvents().some((e) => e.type === 'finish')) finished = true;
    }
    expect(finished).toBe(true);
    const t = sim.finishTime;
    run(sim, 2);
    expect(sim.phase).toBe('finished');
    expect(sim.finishTime).toBe(t);
    const c = ballCenter(sim.yL, sim.yR, sim.u, 1000, sim.depth, physics.ballRadius);
    expect(Math.hypot(c.x - 500, c.y - 2800)).toBeLessThanOrEqual(46 + 1);
  });

  test('kronometre ilk harekette başlar', () => {
    const sim = new Simulation(straight(), { ball: 'standard', assist: false });
    run(sim, 1);
    expect(sim.raceTime).toBe(0);
    sim.nudge(10, 10);
    run(sim, 1);
    expect(sim.raceTime).toBeGreaterThan(0.9);
  });

  test('yıldız toplanır', () => {
    const sim = new Simulation(straight(), { ball: 'standard', assist: false });
    run(sim, 3, () => sim.setTiltLift(equilibriumTilt(0.5, sim.depth, 1000), 4));
    expect(sim.starsCollected[0]).toBe(true);
    expect(sim.starsCollected[2]).toBe(false);
  });
});

describe('determinizm', () => {
  test('aynı girdiler aynı sonucu verir', () => {
    const go = () => {
      const sim = new Simulation(straight(), { ball: 'ice', assist: false });
      for (let i = 0; i < 1200; i++) {
        sim.nudge(Math.sin(i * 0.05) * 6, Math.cos(i * 0.03) * 6);
        sim.step();
      }
      return [sim.yL, sim.yR, sim.u, sim.v];
    };
    expect(go()).toEqual(go());
  });
});

describe('dış kuvvetler', () => {
  test('rüzgâr topu iter, ağır top daha az etkilenir', () => {
    const lvl = straight({ wind: [{ x: 0, y: 0, w: 1000, h: 3000, force: 0.5 }] });
    const light = new Simulation(lvl, { ball: 'light', assist: false });
    const heavy = new Simulation(lvl, { ball: 'heavy', assist: false });
    light.step();
    heavy.step();
    expect(light.extAccel).toBeGreaterThan(0);
    expect(heavy.extAccel).toBeGreaterThan(0);
    expect(heavy.extAccel).toBeLessThan(light.extAccel);
  });

  test('yardım modu rüzgârı yarıya indirir', () => {
    const lvl = straight({ wind: [{ x: 0, y: 0, w: 1000, h: 3000, force: 0.5 }] });
    const a = new Simulation(lvl, { ball: 'standard', assist: false });
    const b = new Simulation(lvl, { ball: 'standard', assist: true });
    a.step();
    b.step();
    expect(b.extAccel).toBeCloseTo(a.extAccel / 2, 5);
  });

  test('mıknatıs açılıp kapanır', () => {
    const lvl = straight({ magnets: [{ x: 800, y: 60, radius: 600, strength: 0.6, onOff: [1, 1] }] });
    const sim = new Simulation(lvl, { ball: 'standard', assist: false });
    sim.step();
    expect(sim.extAccel).toBeGreaterThan(0);
    run(sim, 1.2);
    sim.step();
    expect(sim.extAccel).toBe(0);
  });
});

describe('kontrol noktası çizgisi', () => {
  test('çizilen kesikli çizginin her yerinden geçen top sayılır (yatık yollarda da)', () => {
    for (const L of LEVELS) {
      for (const assist of [false, true]) {
        const sim = new Simulation(L, { ball: 'standard', assist });
        sim.checkpoints.forEach((cy, i) => {
          const [l, r] = sim.track.spanAt(cy);
          for (let k = 0; k <= 10; k++) {
            const x = l + ((r - l) * k) / 10;
            expect(sim.onCheckpointLine(i, x), `${L.id} ${assist ? 'yardım ' : ''}y=${cy} x=${Math.round(x)}`).toBe(true);
          }
          // Çizginin epey dışı sayılmaz (çataldaki öbür yol gibi)
          expect(sim.onCheckpointLine(i, l - 120)).toBe(false);
          expect(sim.onCheckpointLine(i, r + 120)).toBe(false);
        });
      }
    }
  });

  test('top yatık yolda çizginin kenarından geçince kontrol noktası alınır', () => {
    // Çapraz yol: kontrol noktası yolun ortasından uzakta, çizginin kenarında geçilir
    const L = straight({
      road: [{ x: 100, y: 0, w: 260 }, { x: 900, y: 400, w: 260 }, { x: 900, y: 2900, w: 260 }],
      checkpoints: [200],
    });
    const sim = new Simulation(L, { ball: 'standard', assist: false });
    const [l] = sim.track.spanAt(200);
    const cx = sim.track.centerXAt(200);
    const hw = sim.track.widthAt(200) / 2 + physics.ballRadius;
    // Eski kural bu noktayı saymıyordu
    const x = Math.max(l + 10, cx - hw - 40);
    expect(x).toBeLessThan(cx - hw);
    expect(x).toBeGreaterThan(l);
    sim.placeBall(x, 190);
    let got = false;
    for (let i = 0; i < 30 && !got; i++) {
      sim.setTiltLift(0, 3);
      sim.step();
      for (const e of sim.drainEvents()) if (e.type === 'checkpoint') got = true;
    }
    expect(got).toBe(true);
  });
});
