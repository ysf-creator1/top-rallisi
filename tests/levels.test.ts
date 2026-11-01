import { describe, expect, test } from 'vitest';
import { runAutopilot } from '../src/game/autopilot';
import { validateLevel } from '../src/game/levels/validate';
import { Simulation } from '../src/game/physics/sim';
import { allLevels } from './helpers';

const levels = allLevels();

describe('etap JSON doğrulaması', () => {
  test('Dünya 1–3: 30 etap, her dünyada 10', () => {
    expect(levels.length).toBe(30);
    for (const w of [1, 2, 3]) expect(levels.filter((l) => l.world === w).length).toBe(10);
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

  test('Dünya 3 etaplarında kısa yol ve tabela var', () => {
    for (const l of levels.filter((x) => x.world === 3)) {
      expect(l.branches?.length).toBeGreaterThan(0);
      expect(l.signs?.length).toBeGreaterThan(0);
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
