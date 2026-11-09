import { describe, expect, test } from 'vitest';
import { ROPES_TIME_FACTOR, nextTimeStarGap, pointsEarned, scoreValue, targetsFor, timeBonus, timeStars, timeTargetsFromBot } from '../src/config/scoring';

const tt = { bronze: 60, silver: 40, gold: 28 };

describe('süre yıldızları', () => {
  test('bitirmek 1, gümüş 2, altın 3', () => {
    expect(timeStars(70, tt, false)).toBe(1);
    expect(timeStars(55, tt, false)).toBe(1);
    expect(timeStars(40, tt, false)).toBe(2);
    expect(timeStars(30, tt, false)).toBe(2);
    expect(timeStars(28, tt, false)).toBe(3);
  });

  test('bot süresinden yıldız süreleri: 5 sn katı, 3★ < 2★ < bonus', () => {
    expect(timeTargetsFromBot(15)).toEqual({ gold: 25, silver: 35, bronze: 45 });
    expect(timeTargetsFromBot(40)).toEqual({ gold: 60, silver: 85, bronze: 120 });
    const t = timeTargetsFromBot(10);
    expect(t.silver).toBeGreaterThan(t.gold);
  });

  test('yardım modunda en fazla 2', () => {
    expect(timeStars(10, tt, true)).toBe(2);
  });

  test('sonraki yıldız için gereken süre', () => {
    expect(nextTimeStarGap(45, tt, false)).toEqual({ star: 'silver', gap: 5 });
    expect(nextTimeStarGap(30.6, tt, false)?.star).toBe('gold');
    expect(nextTimeStarGap(30.6, tt, false)?.gap).toBeCloseTo(2.6);
    expect(nextTimeStarGap(20, tt, false)).toBeNull();
    expect(nextTimeStarGap(30, tt, true)).toBeNull();
  });
});

describe('puan', () => {
  test('taban + yıldız + süre bonusu', () => {
    expect(timeBonus(50, tt)).toBe(20);
    expect(timeBonus(70, tt)).toBe(0);
    expect(scoreValue(2, 2, 20)).toBe(120 + 40 + 20);
  });

  test('ilk oyunda tam puan', () => {
    expect(pointsEarned(undefined, 2, [true, true, false], 20)).toBe(120 + 40 + 20);
  });

  test('aynı sonucu tekrar oynamak puan vermez', () => {
    const prev = { timeStars: 2, stars: [true, true, false], bonus: 20 };
    expect(pointsEarned(prev, 2, [true, true, false], 20)).toBe(0);
    expect(pointsEarned(prev, 1, [true, false, false], 5)).toBe(0);
  });

  test('sadece yeni kazanılanlar ve rekor farkı ödenir', () => {
    const prev = { timeStars: 2, stars: [true, false, false], bonus: 20 };
    // Altın + yeni bir yıldız + 10 puanlık daha iyi bonus
    expect(pointsEarned(prev, 3, [false, true, false], 30)).toBe(180 - 120 + 20 + 10);
  });
});

describe('moda göre yıldız süreleri', () => {
  test('çift halatta süreler %25 uzun, eğimde aynı', () => {
    const tt = { gold: 20, silver: 28, bronze: 40 };
    expect(ROPES_TIME_FACTOR).toBe(1.25);
    expect(targetsFor(tt, 'tilt')).toEqual(tt);
    expect(targetsFor(tt, 'ropes')).toEqual({ gold: 25, silver: 35, bronze: 50 });
    // 24 sn: eğimde 2 yıldız, çift halatta 3 yıldız
    expect(timeStars(24, targetsFor(tt, 'tilt'), false)).toBe(2);
    expect(timeStars(24, targetsFor(tt, 'ropes'), false)).toBe(3);
  });
});
