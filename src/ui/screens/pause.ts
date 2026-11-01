// Duraklatma: Devam, Yeniden başlat, Ayarlar, Haritaya dön.

import { t } from '../../i18n';
import type { App } from '../app';
import { h, svg } from '../dom';
import { icons } from '../icons';

export function pauseOverlay(app: App): HTMLElement {
  return h('div.overlay', [
    h('div.sheet', [
      h('h2', t('pause.title')),
      app.currentLevel ? h('div.end-sub', app.levelLabel(app.currentLevel)) : null,
      h('div.btns.pause-list', [
        h('button.primary', { onclick: () => app.resumeGame() }, [svg(icons.play(20)), t('pause.resume')]),
        h('button', { onclick: () => app.restartLevel(false) }, [svg(icons.restart()), t('pause.restart')]),
        h('button', { onclick: () => app.showSettings(true) }, [svg(icons.gear()), t('pause.settings')]),
        h('button', { onclick: () => app.currentLevel && app.showLevels(app.currentLevel.world) }, [svg(icons.map()), t('pause.map')]),
      ]),
    ]),
  ]);
}
