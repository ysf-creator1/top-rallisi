// Görevler: gün serisi, günün etabı, haftalık görevler ve koleksiyon girişi.

import { LEVELS } from '../../game/levels';
import {
  DAILY_REWARD,
  STREAK_GIFT_DAYS,
  STREAK_GIFT_POINTS,
  dailyLevel,
  dayKey,
  daysToNextWeek,
  giftBall,
  goalProgress,
  visibleStreak,
  weekKey,
  weeklyGoals,
} from '../../game/meta';
import { formatPoints, t } from '../../i18n';
import type { App } from '../app';
import { h, svg } from '../dom';
import { icons } from '../icons';
import { collectionCount } from './collection';
import { worldArt } from './map';

/** Serinin bu 7 günlük turunda kaç gün dolu */
export function streakCycle(count: number): number {
  return count === 0 ? 0 : ((count - 1) % STREAK_GIFT_DAYS) + 1;
}

export function streakCard(app: App): HTMLElement {
  const today = dayKey();
  const s = app.save.data.streak;
  const v = visibleStreak(s, today);
  const filled = streakCycle(v.count);
  const dots = h('div.streak-dots');
  for (let i = 1; i <= STREAK_GIFT_DAYS; i++) {
    const on = i <= filled;
    const next = !v.playedToday && i === filled + 1;
    const last = i === STREAK_GIFT_DAYS;
    dots.append(
      h(`div.sd${on ? '.on' : ''}${next ? '.next' : ''}${last ? '.gift' : ''}`, { 'aria-label': t('streak.day', { n: i }) }, [
        last ? svg(icons.gift(18)) : on ? svg(icons.check()) : h('span', String(i)),
      ]),
    );
  }
  const allBalls = giftBall(app.save.data.ownedBalls) === null;
  const status = v.atRisk ? t('streak.risk') : v.playedToday ? t('streak.today') : t('streak.todo');
  return h('div.card.streak-card', [
    h('div.streak-head', [
      h('div.streak-flame', { html: icons.flame(40, v.count > 0) }),
      h('div.grow', [h('b.streak-n', t('streak.days', { n: v.count })), h('small', allBalls ? t('streak.subPoints', { n: formatPoints(STREAK_GIFT_POINTS) }) : t('streak.sub'))]),
    ]),
    dots,
    h(`div.streak-status${v.atRisk ? '.risk' : v.playedToday ? '.ok' : ''}`, status),
    h('div.streak-meta', [
      h('span', [svg(icons.shield(16, s.shield > 0)), s.shield > 0 ? t('streak.shield') : t('streak.noShield')]),
      s.best > 1 ? h('span', t('streak.best', { n: s.best })) : null,
    ]),
  ]);
}

export function dailyCard(app: App): HTMLElement {
  const today = dayKey();
  const lvl = dailyLevel(LEVELS, today);
  const done = app.save.data.dailyDone === today;
  const locked = !app.levelUnlocked(lvl);
  return h('div.card.daily-card', [
    h('div.daily-art', { html: worldArt(lvl.world) }),
    h('div.daily-body', [
      h('div.daily-top', [h('span.daily-tag', [svg(icons.calendar(15)), t('daily.title')]), h('span.reward-chip', [svg(icons.coin(14)), t('daily.reward', { n: DAILY_REWARD })])]),
      h('b.daily-name', lvl.name),
      h('small', app.levelLabel(lvl)),
      h('small.daily-sub', locked ? t('daily.locked') : t('daily.sub')),
    ]),
    done
      ? h('div.daily-done', [svg(icons.check()), t('daily.done')])
      : h('button.btn-primary.daily-play', { onclick: () => app.playDaily() }, [svg(icons.play(20)), t('daily.play')]),
  ]);
}

export function goalsScreen(app: App): HTMLElement {
  const today = dayKey();
  const w = app.save.data.weekly;
  const left = daysToNextWeek(today);
  const rows = weeklyGoals(weekKey(today)).map((g) => {
    const p = goalProgress(w, today, g);
    return h(`div.goal-row${p.done ? '.done' : ''}`, [
      h('div.goal-ico', { html: p.done ? icons.check() : icons.target() }),
      h('div.goal-mid', [
        h('b', t(`goal.${g.id}`)),
        h('div.goal-bar', [h('i', { style: { width: `${Math.round((p.n / g.target) * 100)}%` } })]),
      ]),
      h('div.goal-right', [h('span.goal-n', `${formatPoints(p.n)}/${formatPoints(g.target)}`), h('span.reward-chip', [svg(icons.coin(13)), `+${g.reward}`])]),
    ]);
  });
  const coll = collectionCount(app);
  return h('div.screen', [
    h('div.screen-inner', [
      h('div.header', [
        h('button.round-btn.white', { 'aria-label': t('common.back'), onclick: () => app.showTitle() }, [svg(icons.back())]),
        h('div.title', t('goals.title')),
        h('div.coin-chip', [svg(icons.coin(18)), formatPoints(app.save.data.points)]),
      ]),
      streakCard(app),
      dailyCard(app),
      h('div.card.weekly-card', [
        h('div.row', [h('div.section-title', t('weekly.title')), h('small.weekly-reset', left <= 1 ? t('weekly.resetTomorrow') : t('weekly.reset', { n: left }))]),
        ...rows,
      ]),
      h('button.card.coll-link', { onclick: () => app.showCollection(() => app.showGoals()) }, [
        h('div.goal-ico', { html: icons.grid() }),
        h('div.grow', [h('b', t('collection.title')), h('small', t('collection.count', { n: coll.n, total: coll.total }))]),
        svg(icons.arrowRight(18)),
      ]),
    ]),
  ]);
}
