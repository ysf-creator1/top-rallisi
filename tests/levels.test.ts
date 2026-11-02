import { describe, expect, test } from 'vitest';
import { runAutopilot } from '../src/game/autopilot';
import { validateLevel } from '../src/game/levels/validate';
import { Simulation } from '../src/game/physics/sim';
import { Track } from '../src/game/physics/track';
import { allLevels } from './helpers';

const levels = allLevels();

describe('etap JSON doğrulaması', () => {
  test('Dünya 1–4: 40 etap, her dünyada 10', () => {
    expect(levels.length).toBe(40);
    for (const w of [1, 2, 3, 4]) expect(levels.filter((l) => l.world === w).length).toBe(10);
  });

  test('Dünya 4 etaplarında engeller var; ilk etapta sadece delik', () => {
    const w4 = levels.filter((x) => x.world === 4);
    expect(w4[0].holes?.length).toBeGreaterThan(0);
    expect(w4[0].arms).toBeUndefined();
    expect(w4[0].poppers).toBeUndefined();
    expect(w4.some((l) => l.arms?.length)).toBe(true);
    expect(w4.some((l) => l.poppers?.length)).toBe(true);
    // Eski dünyalarda engel yok
    for (const l of levels.filter((x) => x.world < 4)) expect(l.holes ?? l.arms ?? l.poppers).toBeUndefined();
  });

  test('engelin dibindeki kontrol noktası ve pist dışı delik yakalanır', () => {
    const l = levels.find((x) => x.world === 4 && x.checkpoints?.length)!;
    const cy = l.checkpoints![0];
    const t = new Track(l);
    expect(validateLevel({ ...l, holes: [...(l.holes ?? []), { x: t.centerXAt(cy), y: cy, r: 40 }] }).ok).toBe(false);
    expect(validateLevel({ ...l, holes: [{ x: 5, y: 5, r: 40 }] }).ok).toBe(false);
  });

  test.each(levels.map((l) => [l.id, l] as const))('%s geçerli', (_id, level) => {
    const r = validateLevel(level);
    expect(r.errors).toEqual([]);
  });

  test('geçersiz etaplar yakalanır', () => {
    const base = levels[0];
    expect(validateLevel({ ...base, road: [base.road[0]] }).ok).toBe(false);
    expect(validateLevel({ ...base, finishHole: { x: 0, y: base.finishHole.y, r: 40 } }).ok).toBe(false);
    expect(validateLevel({ ...base, timeTargets: { bronze: 10, silver: 20, gold: 30 } }).ok).toBe(false);
    expect(validateLevel({ ...base, stars: [] }).ok).toBe(false);
    expect(validateLevel({ ...base, checkpoints: [base.height * 2] }).ok).toBe(false);
    expect(validateLevel(null).ok).toBe(false);
  });

  test('Dünya 3 etaplarında kısa yol var, tabela yok', () => {
    for (const l of levels.filter((x) => x.world === 3)) {
      expect(l.branches?.length).toBeGreaterThan(0);
      expect(l.signs).toBeUndefined();
    }
  });
});

describe('etaplar bitirilebilir', () => {
  test.each(levels.map((l) => [l.id, l] as const))('%s otopilotla biter, altın süreye yetişir', (_id, level) => {
    const r = runAutopilot(new Simulation(level, { ball: 'standard', assist: false }), undefined, 200);
    expect(r.finished).toBe(true);
    expect(r.falls).toBe(0);
    expect(r.time).toBeLessThanOrEqual(level.timeTargets.gold);
  });
});
