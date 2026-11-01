// Açılış ekranı: logo, Oyna, mağaza ve ayarlar. Arkada otopilot birinci etabı oynar.

import { formatPoints, t } from '../../i18n';
import type { App } from '../app';
import { h, svg } from '../dom';
import { icons } from '../icons';

export function titleScreen(app: App): HTMLElement {
  const pts = h('div.coin-chip.glass', [svg(icons.coin(18)), formatPoints(app.save.data.points)]);
  const stars = h('div.chip.glass', { style: { height: '40px', fontSize: '17px' } }, [svg(icons.star(18)), String(app.totalStars())]);
  return h('div.title-screen', [
    h('div.title-top', [stars, pts]),
    h('div.logo.glass', [h('h1', t('app.title')), h('p', t('app.tagline'))]),
    h('div.title-bottom', [
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
        h('div.two', [
          h('button.btn-secondary', { onclick: () => app.showShop() }, [svg(icons.bag()), t('title.shop')]),
          h('button.btn-secondary', { onclick: () => app.showSettings() }, [svg(icons.gear()), t('title.settings')]),
        ]),
      ]),
    ]),
  ]);
}
