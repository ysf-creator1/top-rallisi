import { describe, expect, test } from 'vitest';
import { COACH_SEG, coachPose } from '../src/ui/coach';

describe('halat koçu', () => {
  test('önce aşağı çeker (çubuk yükselir), sonra yukarı kaldırır (çubuk iner)', () => {
    const steps = ['both' as const];
    expect(coachPose(0, steps).pull).toBe(0);
    const down = coachPose(0.8, steps);
    expect(down.dir).toBe('down');
    expect(down.pull).toBeGreaterThan(0.3);
    expect(coachPose(1.3, steps).pull).toBe(1);
    const up = coachPose(1.8, steps);
    expect(up.dir).toBe('up');
    expect(up.pull).toBeLessThan(1);
    expect(coachPose(2.5, steps).pull).toBe(0);
    expect(coachPose(2.5, steps).show).toBe(0);
  });

  test('adımlar sırayla döner', () => {
    const steps = ['both', 'left', 'right'] as const;
    expect(coachPose(0.5, [...steps]).step).toBe('both');
    expect(coachPose(COACH_SEG + 0.5, [...steps]).step).toBe('left');
    expect(coachPose(COACH_SEG * 2 + 0.5, [...steps]).step).toBe('right');
    expect(coachPose(COACH_SEG * 3 + 0.5, [...steps]).step).toBe('both');
  });
});
