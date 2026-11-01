import { describe, expect, test } from 'vitest';
import { Track, samplePolyline } from '../src/game/physics/track';
import type { LevelData } from '../src/game/levels/types';

const lvl: LevelData = {
  id: 't', name: 't', world: 3, height: 3000, boardWidth: 1000,
  road: [{ x: 500, y: 0, w: 200 }, { x: 300, y: 1000, w: 200 }, { x: 500, y: 2000, w: 120 }],
  branches: [{ type: 'short', points: [{ x: 500, y: 0, w: 100 }, { x: 700, y: 1000, w: 100 }, { x: 500, y: 2000, w: 100 }] }],
  finishHole: { x: 500, y: 2000, r: 40 },
  timeTargets: { bronze: 3, silver: 2, gold: 1 },
};

describe('pist', () => {
  test('örnekleme uçlardan geçer', () => {
    const p = samplePolyline(lvl.road, 'main');
    expect(p.xs[0]).toBe(500);
    expect(p.ys[p.count - 1]).toBe(2000);
    expect(p.totalLength).toBeGreaterThan(2000);
  });

  test('merkez pistte, yarı genişlikten uzak nokta dışarıda', () => {
    const t = new Track(lvl);
    expect(t.isOnTrack(300, 1000)).toBe(true);
    expect(t.isOnTrack(300 + 99, 1000)).toBe(true);
    expect(t.isOnTrack(300 - 101, 1000)).toBe(false);
  });

  test('kol (kısa yol) da pist sayılır', () => {
    const t = new Track(lvl);
    expect(t.isOnTrack(700, 1000)).toBe(true);
    expect(t.isOnTrack(500, 1000)).toBe(false);
  });

  test('daralan yol: genişlik noktalar arasında yumuşak değişir', () => {
    const t = new Track(lvl);
    const w = t.widthAt(1500);
    expect(w).toBeLessThan(200);
    expect(w).toBeGreaterThan(120);
    expect(t.widthAt(2000)).toBeCloseTo(120, 0);
  });

  test('centerXAt yükseklikteki merkez çizgisini verir', () => {
    const t = new Track(lvl);
    expect(t.centerXAt(1000)).toBeCloseTo(300, 0);
    expect(t.centerXAt(1000, t.lines[1])).toBeCloseTo(700, 0);
  });
});
