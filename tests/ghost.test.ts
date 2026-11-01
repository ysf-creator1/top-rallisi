import { describe, expect, test } from 'vitest';
import { physics } from '../src/config/physics';
import { Autopilot } from '../src/game/autopilot';
import { GHOST_HZ, GhostPlayer, GhostRecorder, decodeFrames, encodeFrames, parseGhost } from '../src/game/ghost';
import { Simulation } from '../src/game/physics/sim';
import { getLevel } from './helpers';

describe('hayalet kaydı', () => {
  test('kodlama/çözme kayıpsız', () => {
    const a = Int16Array.from([0, 1, -1, 32767, -32768, 1234, 5000, 6200]);
    expect(Array.from(decodeFrames(encodeFrames(a)))).toEqual(Array.from(a));
  });

  test('kayıt saniyede 30 örnek alır ve oynatma aynı yolu izler', () => {
    const level = getLevel('w1-01');
    const sim = new Simulation(level, { ball: 'standard', assist: false });
    const ap = new Autopilot();
    const rec = new GhostRecorder();
    const trail: { t: number; yL: number; yR: number }[] = [];
    for (let i = 0; i < 120 * 60; i++) {
      ap.control(sim);
      sim.step();
      sim.drainEvents();
      rec.sample(sim);
      if (i % 37 === 0 && sim.started) trail.push({ t: sim.raceTime, yL: sim.yL, yR: sim.yR });
      if (sim.phase === 'finishing') break;
    }
    expect(sim.phase).toBe('finishing');
    const ghost = rec.finish(sim, level.id, 'standard');
    const expected = Math.floor(sim.finishTime * GHOST_HZ) + 2;
    expect(Math.abs(rec.frameCount - expected)).toBeLessThanOrEqual(2);

    const g = parseGhost(JSON.stringify(ghost))!;
    expect(g.time).toBeCloseTo(sim.finishTime);
    const player = new GhostPlayer(g, 1000, sim.depth, physics.ballRadius);
    const fr = { yL: 0, yR: 0, u: 0, scale: 1 };
    for (const p of trail) {
      player.sample(p.t, fr);
      expect(Math.abs(fr.yL - p.yL)).toBeLessThan(12);
      expect(Math.abs(fr.yR - p.yR)).toBeLessThan(12);
    }
  });

  test('anlık fark: aynı hızda 0, yavaşsan artı, hızlıysan eksi', () => {
    const level = getLevel('w1-01');
    const sim = new Simulation(level, { ball: 'standard', assist: false });
    const ap = new Autopilot();
    const rec = new GhostRecorder();
    const heights: { t: number; h: number }[] = [];
    let maxH = -Infinity;
    for (let i = 0; i < 120 * 60 && sim.phase === 'playing'; i++) {
      ap.control(sim);
      sim.step();
      sim.drainEvents();
      rec.sample(sim);
      maxH = Math.max(maxH, sim.ballY);
      if (i % 60 === 0 && sim.started) heights.push({ t: sim.raceTime, h: maxH });
    }
    const player = new GhostPlayer(rec.finish(sim, level.id, 'standard'), 1000, sim.depth, physics.ballRadius);
    const mid = heights[Math.floor(heights.length / 2)];
    expect(Math.abs(player.delta(mid.t, mid.h)!)).toBeLessThan(0.2);
    expect(player.delta(mid.t + 1.5, mid.h)!).toBeGreaterThan(1.2);
    expect(player.delta(mid.t - 1.5, mid.h)!).toBeLessThan(-1.2);
  });

  test('bozuk hayalet reddedilir', () => {
    expect(parseGhost('{"v":2}')).toBeNull();
    expect(parseGhost('bozuk')).toBeNull();
    expect(parseGhost(null)).toBeNull();
  });
});
