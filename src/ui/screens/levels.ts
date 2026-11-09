// Etap seçimi: etap kartları (en iyi süre, süreye göre kazanılan yıldızlar).

import { levelsOfWorld } from '../../game/levels';
import { formatTime, t } from '../../i18n';
import type { App } from '../app';
import { h, svg } from '../dom';
import { icons } from '../icons';
import { worldArt } from './map';

export function levelsScreen(app: App, world: number): HTMLElement {
  const list = levelsOfWorld(world);
  let nextMarked = false;
  const cards = list.map((l, i) => {
    const rec = app.record(l.id);
    const unlocked = app.levelUnlocked(l);
    const isNext = unlocked && !rec?.completed && !nextMarked;
    if (isNext) nextMarked = true;
    const tStars = rec?.timeStars ?? 0;
    const best = rec?.best ?? null;
    const bestA = rec?.bestAssist ?? null;
    // Süreye göre kazanılan yıldızlar (1–3)
    const starsEl = h('div.mini-stars', { html: [0, 1, 2].map((k) => icons.star(13, k < tStars)).join('') });
    const bestEl = h('div.best');
    if (!unlocked) bestEl.append(t('levels.locked'));
    else if (best) bestEl.append(t('levels.best'), h('b', formatTime(best.time)));
    else if (bestA) bestEl.append(t('levels.best'), h('b', formatTime(bestA.time)), h('span.assist-badge', [svg(icons.assist(10)), t('levels.assisted')]));
    else bestEl.append(t('levels.notPlayed'));
    if (unlocked && best && bestA && bestA.time < best.time) bestEl.append(h('span.assist-badge', [svg(icons.assist(10)), formatTime(bestA.time)]));
    return h(
      `button.level-card${unlocked ? '' : '.locked'}${isNext ? '.next' : ''}`,
      { disabled: !unlocked, onclick: () => unlocked && app.startLevel(l) },
      [
        h('div.num', [h('b', String(i + 1)), unlocked ? starsEl : svg(icons.lock(16, '#B9B4AC'))]),
        h('div.name', [l.name, app.save.data.secrets.includes(l.id) ? h('span.secret-badge', { title: t('collection.secrets'), html: icons.star(12) }) : null]),
        bestEl,
      ],
    );
  });
  return h('div.screen', [
    h('div.screen-inner', [
      h('div.header', [
        h('button.round-btn.white', { 'aria-label': t('common.back'), onclick: () => app.showMap() }, [svg(icons.back())]),
        h('div.title', t(`world.${world}`)),
      ]),
      h('div.world-card', { style: { pointerEvents: 'none' } }, [h('div.world-art', { html: worldArt(world), style: { height: '92px' } })]),
      h('div.level-grid', cards),
    ]),
  ]);
}
