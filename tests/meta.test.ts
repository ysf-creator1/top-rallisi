import { describe, expect, test } from 'vitest';
import { Autopilot, DEFAULT_AUTOPILOT } from '../src/game/autopilot';
import { challengeFromHash, challengeUrl, decodeChallenge, encodeChallenge, packFrames, shortChallengeUrl, shortIdFromHash, unpackFrames } from '../src/game/challenge';
import { GhostRecorder, decodeFrames } from '../src/game/ghost';
import { LEVELS } from '../src/game/levels';
import {
  dailyLevel,
  dailySale,
  dayKey,
  dayNumber,
  defaultStreak,
  defaultWeekly,
  giftBall,
  priceToday,
  salePrice,
  streakAfterPlay,
  visibleStreak,
  weekKey,
  weeklyAfterRun,
  weeklyGoals,
  type RunFacts,
} from '../src/game/meta';
import { Simulation } from '../src/game/physics/sim';
import { migrate } from '../src/save/migrate';
import { defaultSave } from '../src/save/schema';
import tr from '../src/i18n/tr.json';
import { getLevel } from './helpers';

const run = (o: Partial<RunFacts> = {}): RunFacts => ({
  levelId: 'w1-04',
  timeStars: 1,
  falls: 2,
  beatRecord: false,
  firstClear: false,
  earned: 0,
  daily: false,
  ghostWin: false,
  ...o,
});

describe('tarih', () => {
  test('gün anahtarı ve hafta (pazartesi)', () => {
    expect(dayKey(new Date(2026, 10, 10))).toBe('2026-11-10');
    expect(dayNumber('2026-11-11') - dayNumber('2026-11-10')).toBe(1);
    // 10 Kasım 2026 salı: hafta 9 Kasım pazartesi
    expect(weekKey('2026-11-10')).toBe('2026-11-09');
    expect(weekKey('2026-11-09')).toBe('2026-11-09');
    expect(weekKey('2026-11-15')).toBe('2026-11-09');
    expect(weekKey('2026-11-16')).toBe('2026-11-16');
  });
});

describe('günün etabı', () => {
  test('herkes için aynı, Dünya 1–2 içinden, koç etapları hariç, ardışık günler farklı', () => {
    const first3 = LEVELS.filter((l) => l.world === 1).slice(0, 3).map((l) => l.id);
    let prev = '';
    for (let d = 0; d < 60; d++) {
      const day = `2026-12-${String((d % 28) + 1).padStart(2, '0')}`;
      const l = dailyLevel(LEVELS, day);
      expect(l.world).toBeLessThanOrEqual(2);
      expect(first3).not.toContain(l.id);
      expect(dailyLevel(LEVELS, day).id).toBe(l.id);
      if (d < 28) expect(l.id).not.toBe(prev);
      prev = l.id;
    }
  });
});

describe('gün serisi', () => {
  test('ardışık günler artar, aynı gün bir kez sayılır', () => {
    let s = streakAfterPlay(defaultStreak(), '2026-11-10').streak;
    expect(s.count).toBe(1);
    expect(streakAfterPlay(s, '2026-11-10').advanced).toBe(false);
    s = streakAfterPlay(s, '2026-11-11').streak;
    expect(s.count).toBe(2);
  });

  test('bir gün kaçınca koruma kurtarır, ikinci kez kurtarmaz', () => {
    let s = streakAfterPlay(defaultStreak(), '2026-11-01').streak;
    s = streakAfterPlay(s, '2026-11-02').streak;
    expect(visibleStreak(s, '2026-11-04')).toEqual({ count: 2, playedToday: false, atRisk: true });
    const r = streakAfterPlay(s, '2026-11-04');
    expect(r.usedShield).toBe(true);
    expect(r.streak.count).toBe(3);
    expect(r.streak.shield).toBe(0);
    expect(visibleStreak(r.streak, '2026-11-06').count).toBe(0);
    const r2 = streakAfterPlay(r.streak, '2026-11-06');
    expect(r2.reset).toBe(true);
    expect(r2.streak.count).toBe(1);
    expect(r2.streak.best).toBe(3);
  });

  test('7. günde hediye ve koruma yenilenir', () => {
    let s = { ...defaultStreak(), shield: 0 };
    let gifts = 0;
    for (let d = 1; d <= 14; d++) {
      const r = streakAfterPlay(s, `2026-11-${String(d).padStart(2, '0')}`);
      if (r.gift) gifts++;
      s = r.streak;
      if (d === 7) expect(s.shield).toBe(1);
    }
    expect(gifts).toBe(2);
    expect(giftBall(['standard'])).toBe('light');
    expect(giftBall(['standard', 'light', 'heavy', 'rubber', 'ice'])).toBeNull();
  });
});

describe('haftalık görevler', () => {
  test('her hafta 3 farklı görev, metinleri var', () => {
    const texts = tr as Record<string, string>;
    for (const w of ['2026-11-09', '2026-11-16', '2026-11-23']) {
      const g = weeklyGoals(w);
      expect(g.length).toBe(3);
      expect(new Set(g.map((x) => x.id)).size).toBe(3);
      for (const x of g) expect(texts[`goal.${x.id}`], x.id).toBeTruthy();
    }
  });

  test('ilerleme sayılır, aynı etabın 3 yıldızı bir kez, tamamlanan görev bir kez ödenir', () => {
    const day = '2026-11-10';
    const goals = weeklyGoals(weekKey(day));
    let w = defaultWeekly();
    const paid: string[] = [];
    // Bütün görevleri bitirecek kadar çeşitli deneme
    for (let i = 0; i < 12; i++) {
      const r = weeklyAfterRun(w, day, run({ levelId: `w1-0${(i % 9) + 1}`, timeStars: 3, falls: 0, beatRecord: true, firstClear: true, earned: 60, daily: true, ghostWin: true }));
      w = r.weekly;
      paid.push(...r.completed.map((g) => g.id));
    }
    expect(paid.sort()).toEqual(goals.map((g) => g.id).sort());
    // Aynı etap tekrar sayılmaz
    const once = weeklyAfterRun(defaultWeekly(), day, run({ timeStars: 3 }));
    expect(weeklyAfterRun(once.weekly, day, run({ timeStars: 3 })).weekly.progress.stars3).toBe(1);
    // Yeni hafta sıfırdan başlar
    expect(weeklyAfterRun(w, '2026-11-17', run()).weekly.progress.finish).toBe(1);
  });
});

describe('günün indirimi', () => {
  test('her gün 2 farklı parça, %30 indirim', () => {
    const s = dailySale('2026-11-10');
    expect(s.length).toBe(2);
    expect(s[0].id).not.toBe(s[1].id);
    expect(salePrice(1000)).toBe(700);
    expect(priceToday(s[0], '2026-11-10')).toBe(salePrice(s[0].price));
    expect(dailySale('2026-11-11').map((x) => x.id)).not.toEqual(s.map((x) => x.id));
  });
});

describe('kayıt', () => {
  test('eski kayıtta seri ve görev alanları varsayılanla dolar, bozuk alan düzelir', () => {
    const old = { ...defaultSave() } as Record<string, unknown>;
    delete old.streak;
    delete old.weekly;
    delete old.dailyDone;
    const m = migrate(old);
    expect(m.streak.count).toBe(0);
    expect(m.streak.shield).toBe(1);
    expect(m.weekly.done).toEqual([]);
    expect(m.dailyDone).toBeNull();
    expect(migrate({ ...defaultSave(), streak: 'x' }).streak.count).toBe(0);
  });
});

describe('meydan okuma linki', () => {
  test('fark kodlaması kayıpsız', () => {
    const a = Int16Array.from([0, 100, -5, 1000, 3, 98, -7, 990, 32767, -32768, 0, 0]);
    expect(Array.from(unpackFrames(packFrames(a)))).toEqual(Array.from(a));
  });

  test('gerçek bir deneme linke girer, kısa kalır ve aynen geri çıkar', async () => {
    const level = getLevel('w1-04');
    const sim = new Simulation(level, { ball: 'standard', assist: false });
    const ap = new Autopilot();
    const rec = new GhostRecorder();
    for (let i = 0; i < 120 * 120 && sim.phase === 'playing'; i++) {
      ap.control(sim);
      sim.step();
      sim.drainEvents();
      rec.sample(sim);
    }
    const ghost = rec.finish(sim, level.id, 'standard');
    const payload = await encodeChallenge({ ghost, assist: false, control: 'ropes' });
    expect(payload.length).toBeLessThan(4000);
    const url = challengeUrl('https://x.github.io/top-rallisi/#eski', payload);
    expect(url.startsWith('https://x.github.io/top-rallisi/#c=')).toBe(true);
    const back = await decodeChallenge(challengeFromHash(new URL(url).hash)!, (id) => id === level.id);
    expect(back).not.toBeNull();
    expect(back!.control).toBe('ropes');
    expect(back!.time).toBeCloseTo(ghost.time, 2);
    // Saniyede 15 kareden geri açılınca aynı uzunluk, çift kareler aynı, aradakiler çok yakın
    const a = decodeFrames(ghost.data);
    const b = decodeFrames(back!.ghost.data);
    expect(b.length).toBe(a.length);
    for (let i = 0; i < a.length; i++) expect(Math.abs(a[i] - b[i])).toBeLessThanOrEqual(i % 8 < 4 ? 0 : 40);
    expect(b[b.length - 1]).toBe(0);
  });

  test('bozuk ya da bilinmeyen etaplı link reddedilir', async () => {
    expect(await decodeChallenge('2.w1-04.100.standard.0.@@@', () => true)).toBeNull();
    expect(await decodeChallenge('1.yok.100.standard.0.AAAA', () => false)).toBeNull();
    expect(await decodeChallenge('1.w1-04.100.altin.0.AAAA', () => true)).toBeNull();
    expect(challengeFromHash('#baska')).toBeNull();
    expect(shortIdFromHash('#m=ab23cd9k')).toBe('ab23cd9k');
    expect(shortIdFromHash('#m=AB')).toBeNull();
    expect(shortChallengeUrl('https://x.github.io/top-rallisi/#eski', 'ab23cd9k')).toBe('https://x.github.io/top-rallisi/#m=ab23cd9k');
  });
});

describe('gizli yollar', () => {
  const secretLevels = LEVELS.filter((l) => l.secret);
  test('her dünyada bir gizli yol var', () => {
    expect(secretLevels.map((l) => l.world).sort()).toEqual([1, 2, 3, 4, 5, 6]);
    for (const l of secretLevels) expect(l.branches?.some((b) => b.hidden)).toBe(true);
  });

  test.each(secretLevels.map((l) => [l.id, l] as const))('%s: kısayoldan giden gizli yıldızı bulur, ana yoldan giden bulmaz', (_id, level) => {
    const run = (preferShort: boolean) => {
      const sim = new Simulation(level, { ball: 'standard', assist: false });
      const ap = new Autopilot({ ...DEFAULT_AUTOPILOT, preferShort });
      for (let i = 0; i < 120 * 240 && sim.phase !== 'finished'; i++) {
        ap.control(sim);
        sim.step();
        sim.drainEvents();
      }
      return sim;
    };
    const short = run(true);
    expect(short.phase).toBe('finished');
    expect(short.secretFound).toBe(true);
    expect(run(false).secretFound).toBe(false);
  });
});
