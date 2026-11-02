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
