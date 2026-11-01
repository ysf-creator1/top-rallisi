import { describe, expect, test } from 'vitest';
import { COSTUMES, COSTUME_CATEGORIES } from '../src/config/shop';
import tr from '../src/i18n/tr.json';
import { Autopilot, DEFAULT_AUTOPILOT } from '../src/game/autopilot';
import { Simulation } from '../src/game/physics/sim';
import { getLevel } from '../src/game/levels';

const texts = tr as Record<string, string>;

describe('mağaza kataloğu', () => {
  test('her kostümün Türkçe adı ve her kategorinin başlığı var', () => {
    for (const c of COSTUMES) expect(texts[`costume.${c.category}.${c.key}`], c.id).toBeTruthy();
    for (const cat of COSTUME_CATEGORIES) expect(texts[`shop.cat.${cat}`], cat).toBeTruthy();
  });
  test('kimlikler benzersiz, her kategoride parça var, pahalı parçalar da var', () => {
    expect(new Set(COSTUMES.map((c) => c.id)).size).toBe(COSTUMES.length);
    for (const cat of COSTUME_CATEGORIES) expect(COSTUMES.some((c) => c.category === cat)).toBe(true);
    expect(COSTUMES.filter((c) => c.price >= 3000).length).toBeGreaterThanOrEqual(4);
  });
});

/** Etabı botla oynatır, sayılan kontrol noktalarını döndürür */
function playCheckpoints(id: string, preferShort: boolean): Set<number> {
  const sim = new Simulation(getLevel(id)!, { ball: 'standard', assist: false });
  const ap = new Autopilot({ ...DEFAULT_AUTOPILOT, preferShort });
  const hit = new Set<number>();
  for (let i = 0; i < 120 * 240 && sim.phase !== 'finished'; i++) {
    ap.control(sim);
    sim.step();
    for (const e of sim.drainEvents()) if (e.type === 'checkpoint') hit.add(e.index);
  }
  expect(sim.phase).toBe('finished');
  return hit;
}

describe('çataldaki kontrol noktası', () => {
  test('uzun yoldan giden hepsini, kısa yoldan giden çataldakini atlar', () => {
    const L = getLevel('w3-02')!;
    const all = playCheckpoints('w3-02', false);
    expect(all.size).toBe(L.checkpoints!.length);
    const short = playCheckpoints('w3-02', true);
    expect(short.size).toBeLessThan(all.size);
  });
});
