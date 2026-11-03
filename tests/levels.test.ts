import { describe, expect, test } from 'vitest';
import { runAutopilot } from '../src/game/autopilot';
import { validateLevel } from '../src/game/levels/validate';
import { Simulation } from '../src/game/physics/sim';
import { Track } from '../src/game/physics/track';
import { LEVELS, levelsOfWorld } from '../src/game/levels';
import { WORLD_ORDER } from '../src/game/levels/order';
import { allLevels } from './helpers';

const levels = allLevels();

describe('etap JSON doğrulaması', () => {
  test('6 dünya, her dünyada 15 etap; sıra listesi bütün etapları kapsar', () => {
    expect(levels.length).toBe(90);
    for (const w of [1, 2, 3, 4, 5, 6]) expect(levels.filter((l) => l.world === w).length).toBe(15);
    for (const [w, ids] of Object.entries(WORLD_ORDER)) {
      expect(new Set(ids).size).toBe(15);
      for (const id of ids) expect(levels.find((l) => l.id === id)?.world).toBe(Number(w));
    }
  });

  test('oyundaki sıra: ilk etap w1-01, eklenen kolay etaplar zor etapların önünde', () => {
    expect(LEVELS[0].id).toBe('w1-01');
    const w1 = levelsOfWorld(1).map((l) => l.id);
    expect(w1.indexOf('w1-11')).toBeLessThan(w1.indexOf('w1-03'));
    expect(w1[w1.length - 1]).toBe('w1-10');
    expect(levelsOfWorld(5).map((l) => l.id)[0]).toBe('w5-01');
  });

  test('yoldan toplanan yıldız yok; yıldız süreleri 5 sn katı ve sıralı', () => {
    for (const l of levels) {
      expect(l.stars ?? []).toEqual([]);
      expect(l.timeTargets.gold % 5).toBe(0);
      expect(l.timeTargets.silver).toBeGreaterThan(l.timeTargets.gold);
    }
  });

  test('Dünya 5–6 etaplarında rüzgâr var', () => {
    for (const l of levels.filter((x) => x.world >= 5)) expect(l.wind?.length).toBeGreaterThan(0);
    for (const l of levels.filter((x) => x.world < 5)) expect(l.wind).toBeUndefined();
  });

  test('Dünya 4 etaplarında engeller var; ilk etapta sadece delik', () => {
    const w4 = levelsOfWorld(4);
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
    expect(validateLevel({ ...base, stars: [{ x: 5, y: 5 }] }).ok).toBe(false);
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
  test.each(levels.map((l) => [l.id, l] as const))('%s otopilotla biter, 3 yıldız süresine yetişir', (_id, level) => {
    const r = runAutopilot(new Simulation(level, { ball: 'standard', assist: false }), undefined, 200);
    expect(r.finished).toBe(true);
    expect(r.falls).toBe(0);
    expect(r.time).toBeLessThanOrEqual(level.timeTargets.gold);
  });
});
