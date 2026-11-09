// Açılış ekranı: logo, Oyna, mağaza ve ayarlar. Arkada otopilot birinci etabı oynar.

import { LEVELS } from '../../game/levels';
import { DAILY_REWARD, dailyLevel, dayKey, visibleStreak } from '../../game/meta';
import { formatPoints, t } from '../../i18n';
import type { App } from '../app';
import { h, svg } from '../dom';
import { icons } from '../icons';
import { tutorialOverlay } from './tutorial';

export function titleScreen(app: App): HTMLElement {
  const pts = h('div.coin-chip.glass', [svg(icons.coin(18)), formatPoints(app.save.data.points)]);
  const stars = h('div.chip.glass', { style: { height: '40px', fontSize: '17px' } }, [svg(icons.star(18)), String(app.totalStars())]);
  const today = dayKey();
  const v = visibleStreak(app.save.data.streak, today);
  // Gün serisi: dokununca Görevler açılır
  const streak = h(
    `button.chip.glass.streak-chip${v.count > 0 ? '' : '.off'}${v.playedToday ? '.lit' : ''}`,
    { 'aria-label': t('streak.title'), onclick: () => app.showGoals() },
    [svg(icons.flame(20, v.count > 0)), String(v.count)],
  );
  const dailyDone = app.save.data.dailyDone === today;
  const daily = h(
    `button.daily-pill.glass${dailyDone ? '.done' : ''}`,
    { onclick: () => (dailyDone ? app.showGoals() : app.playDaily()) },
    [
      h('span.dp-ico', { html: dailyDone ? icons.check() : icons.calendar(18) }),
      h('span.dp-txt', [h('b', dailyDone ? t('title.dailyDone') : t('title.daily')), h('small', dailyLevel(LEVELS, today).name)]),
      dailyDone ? null : h('span.reward-chip', [svg(icons.coin(14)), `+${DAILY_REWARD}`]),
    ],
  );
  return h('div.title-screen', [
    h('div.title-top', [
      h('div.title-left', [stars, streak]),
      h('div.title-right', [
        pts,
        h(
          'button.round-btn.glass.info-btn',
          { 'aria-label': t('title.info'), onclick: () => app.openOverlay(tutorialOverlay(app, () => app.closeOverlay())) },
          [svg(icons.info())],
        ),
      ]),
    ]),
    h('div.logo.glass', [h('h1', t('app.title')), h('p', t('app.tagline'))]),
    h('div.title-bottom', [
      daily,
      h(
        'button.btn-primary',
        {
          onclick: () => {
            app.maybeShowA2hs();
            app.showMap();
          },
        },
        [svg(icons.play(22)), t('title.play')],
      ),
      h('div.end-actions', [
        h('div.three', [
          h('button.btn-secondary', { onclick: () => app.showShop() }, [svg(icons.bag()), t('title.shop')]),
          h('button.btn-secondary', { onclick: () => app.showGoals() }, [svg(icons.target()), t('title.goals')]),
          h('button.btn-secondary', { onclick: () => app.showSettings() }, [svg(icons.gear()), t('title.settings')]),
        ]),
      ]),
    ]),
  ]);
}
