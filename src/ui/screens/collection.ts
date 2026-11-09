// Koleksiyon: toplanan toplar ve kostümler ("12 / 30 toplandı").

import { BALLS, COSTUMES, COSTUME_CATEGORIES, CROWN_LEVELS, type CostumeItem } from '../../config/shop';
import { t } from '../../i18n';
import type { App } from '../app';
import { h, svg } from '../dom';
import { costumeIcon, icons } from '../icons';
import { ballGradient } from './settings';

function hasCostume(app: App, it: CostumeItem): boolean {
  if (app.save.data.ownedCostumes.includes(it.id)) return true;
  // Taç belli sayıda etap bitirince ücretsiz açılır
  if (it.id === 'hat.crown') return Object.values(app.save.data.levels).filter((r) => r.completed).length >= CROWN_LEVELS;
  return false;
}

export function collectionCount(app: App): { n: number; total: number; balls: number; costumes: number } {
  const balls = BALLS.filter((b) => app.save.data.ownedBalls.includes(b.id)).length;
  const costumes = COSTUMES.filter((c) => hasCostume(app, c)).length;
  return { n: balls + costumes, total: BALLS.length + COSTUMES.length, balls, costumes };
}

function progress(n: number, total: number): HTMLElement {
  return h('div.coll-progress', [
    h('div.goal-bar', [h('i', { style: { width: `${Math.round((n / Math.max(1, total)) * 100)}%` } })]),
    h('span', t('collection.count', { n, total })),
  ]);
}

export function collectionScreen(app: App, onBack: () => void): HTMLElement {
  const c = collectionCount(app);
  const balls = h(
    'div.coll-balls',
    BALLS.map((b) => {
      const has = app.save.data.ownedBalls.includes(b.id);
      const [g0, g1, g2] = ballGradient(b.id);
      return h(`div.coll-ball${has ? '' : '.missing'}`, [
        h('span.ball-dot', { style: { background: `radial-gradient(circle at 38% 32%, ${g0}, ${g1} 50%, ${g2})` } }),
        h('small', t(`ball.${b.id}`)),
        has ? null : h('span.coll-lock', { html: icons.lock(12, '#9A958D') }),
      ]);
    }),
  );
  const cats = COSTUME_CATEGORIES.map((cat) => {
    const items = COSTUMES.filter((x) => x.category === cat);
    const got = items.filter((x) => hasCostume(app, x)).length;
    return h('div.coll-cat', [
      h('div.row', [h('b', t(`shop.cat.${cat}`)), h(`span.coll-n${got === items.length ? '.full' : ''}`, `${got} / ${items.length}`)]),
      h(
        'div.coll-grid',
        items.map((it) => {
          const has = hasCostume(app, it);
          return h(`div.coll-item${has ? '' : '.missing'}`, {
            title: t(`costume.${it.category}.${it.key}`),
            'aria-label': t(`costume.${it.category}.${it.key}`),
            html: costumeIcon(cat, it.key, it.tint, app.save.data.costume.number ?? 7),
          });
        }),
      ),
    ]);
  });
  return h('div.screen', [
    h('div.screen-inner', [
      h('div.header', [
        h('button.round-btn.white', { 'aria-label': t('common.back'), onclick: onBack }, [svg(icons.back())]),
        h('div.title', t('collection.title')),
        h('div.stars-chip', `${c.n} / ${c.total}`),
      ]),
      h('div.card', [h('div.section-title', t('collection.balls')), progress(c.balls, BALLS.length), balls]),
      h('div.card', [h('div.section-title', t('collection.costumes')), progress(c.costumes, COSTUMES.length), ...cats]),
      h('p.note', t('collection.hint')),
      h('button.btn-secondary', { onclick: () => app.showShop() }, [svg(icons.bag()), t('collection.shop')]),
    ]),
  ]);
}
