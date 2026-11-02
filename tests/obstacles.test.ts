import { beforeEach, describe, expect, test } from 'vitest';
import { resetPhysics } from '../src/config/physics';
import { armHits, hitObstacle, obstacleTime, popperState, safeSpot } from '../src/game/physics/obstacles';
import { Simulation, effectiveCheckpoints } from '../src/game/physics/sim';
import type { LevelData } from '../src/game/levels/types';

const level = (over: Partial<LevelData> = {}): LevelData => ({
  id: 't', name: 't', world: 4, height: 3000, boardWidth: 1000,
  road: [{ x: 500, y: 0, w: 300 }, { x: 500, y: 2900, w: 300 }],
  finishHole: { x: 500, y: 2800, r: 46 },
  checkpoints: [],
  stars: [{ x: 500, y: 600 }, { x: 500, y: 1200 }, { x: 500, y: 1500 }],
  timeTargets: { bronze: 60, silver: 40, gold: 20 },
  ...over,
});

beforeEach(() => resetPhysics());

describe('engeller', () => {
  test('düşürme deliği: merkez içerideyse düşer', () => {
    const L = level({ holes: [{ x: 500, y: 1000, r: 44 }] });
    expect(hitObstacle(L, 500, 1030, 0)).toBe('hole');
    expect(hitObstacle(L, 560, 1000, 0)).toBeNull();
  });

  test('fırlatıcı sadece yukarıdayken atar, önce uyarır', () => {
    const p = { x: 500, y: 1000, r: 60, period: 3, up: 0.5 };
    const L = level({ poppers: [p] });
    expect(hitObstacle(L, 500, 1000, 1.0)).toBeNull();
    expect(popperState(p, 2.1).warn).toBeGreaterThan(0);
    expect(popperState(p, 2.1).active).toBe(false);
    expect(hitObstacle(L, 500, 1000, 2.7)).toBe('pop');
    // Tabladan uzaktaysa yukarıdayken de bir şey olmaz
    expect(hitObstacle(L, 580, 1000, 2.7)).toBeNull();
  });

  test('dönen kol: kolun üstündeki nokta çarpar, karşı taraftaki kolsuz yer çarpmaz', () => {
    const a = { x: 500, y: 1000, length: 120, speed: 1, phase: 0, blades: 1 };
    expect(armHits(a, 600, 1000, 0)).toBe(true);
    expect(armHits(a, 400, 1000, 0)).toBe(false);
    // Çeyrek tur sonra kol yukarıyı gösterir
    expect(armHits(a, 500, 1100, Math.PI / 2)).toBe(true);
    expect(armHits(a, 600, 1000, Math.PI / 2)).toBe(false);
    // Göbek her zaman çarpar
    expect(armHits(a, 510, 1000, 1.3)).toBe(true);
  });

  test('dönen kol düşürmez; topu döndüğü yöne iter, göbek bir şey yapmaz', () => {
    // Top çubuğun ortasında durur; kol yukarıdan aşağı (saat yönünde) iner ve topu sağa iter
    const run = (arm: NonNullable<LevelData['arms']>[number]) => {
      const wide = { road: [{ x: 500, y: 0, w: 900 }, { x: 500, y: 2900, w: 900 }] };
      const sim = new Simulation(level({ ...wide, arms: [arm] }), { ball: 'standard', assist: false });
      const x0 = sim.ballX;
      let fell = false;
      let maxV = 0;
      for (let i = 0; i < 100; i++) {
        sim.step();
        maxV = Math.max(maxV, sim.v);
        for (const e of sim.drainEvents()) if (e.type === 'fall') fell = true;
      }
      return { fell, dx: sim.ballX - x0, maxV };
    };
    const probe = new Simulation(level(), { ball: 'standard', assist: false });
    const bx = probe.ballX;
    const by = probe.ballY;
    // Göbek topun solunda, kol yukarıdan saat yönünde (-) iner: topa değince sağa iter
    const pushed = run({ x: bx - 90, y: by, length: 160, speed: -2, phase: Math.PI / 2, blades: 1 });
    expect(pushed.fell).toBe(false);
    expect(pushed.maxV).toBeGreaterThan(100);
    expect(pushed.dx).toBeGreaterThan(20);
    // Göbek tam topun altında: kol topa değmeden döner, top yerinde kalır
    const hub = run({ x: bx, y: by, length: 160, speed: 2, phase: 0, blades: 0 });
    expect(hub.fell).toBe(false);
    expect(Math.abs(hub.dx)).toBeLessThan(5);
    expect(hitObstacle(level({ arms: [{ x: bx, y: by, length: 160, speed: 2 }] }), bx, by, 0)).toBeNull();
  });

  test('yardım modunda engeller yavaş', () => {
    expect(obstacleTime(10, true)).toBeLessThan(10);
    expect(obstacleTime(10, false)).toBe(10);
  });

  test('deliğe giren top düşer, neden "hole" olur ve kontrol noktasında yeniden doğar', () => {
    const sim = new Simulation(level({ holes: [{ x: 500, y: 120, r: 60 }], checkpoints: [] }), { ball: 'standard', assist: false });
    const causes: string[] = [];
    for (let i = 0; i < 600 && !causes.length; i++) {
      sim.setTiltLift(0, 4);
      sim.step();
      for (const e of sim.drainEvents()) if (e.type === 'fall') causes.push(e.cause);
    }
    expect(causes).toEqual(['hole']);
    expect(sim.fallInfo.x).toBe(500);
    expect(sim.fallInfo.y).toBe(120);
  });

  test('yardım modunun ek kontrol noktaları engelin dibine konmaz', () => {
    const L = level({ arms: [{ x: 500, y: 1450, length: 140, speed: 1 }] });
    for (const cy of effectiveCheckpoints(L, true)) expect(safeSpot(L, 500, cy)).toBe(true);
  });
});
