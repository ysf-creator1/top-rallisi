// "Nasıl oynanır?" kartı: sadece birinci etap açılırken gösterilir.

import { t } from '../../i18n';
import type { App } from '../app';
import { h, svg } from '../dom';
import { icons } from '../icons';

const GOAL_ICON = `<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><path d="M22 38 C22 30 12 28 13 21 C14 14 28 15 27 8" fill="none" stroke="#2E3136" stroke-width="7" stroke-linecap="round"/><circle cx="27" cy="7" r="3.2" fill="#0B0C0D" stroke="#A9B0B7" stroke-width="1.2"/><circle cx="14" cy="24" r="4.6" fill="#FBFBFC" stroke="#C9D1D8"/></svg>`;

function row(icon: string, title: string, body: string, tint: string): HTMLElement {
  return h('div.tut-row', [h('div.tut-ico', { style: { background: tint }, html: icon }), h('div', [h('b', title), h('p', body)])]);
}

export function tutorialOverlay(app: App, onStart: () => void, onSettings: () => void): HTMLElement {
  void app;
  return h('div.overlay', [
    h('div.sheet.tut', [
      h('h2', t('tutorial.title')),
      row(GOAL_ICON, t('tutorial.goal.title'), t('tutorial.goal.body'), '#E6F3EC'),
      row(icons.rope(), t('tutorial.ropes.title'), t('tutorial.ropes.body'), '#FCF1DA'),
      row(icons.phone(), t('tutorial.tilt.title'), t('tutorial.tilt.body'), '#EEEAF7'),
      row(icons.gear(), t('tutorial.settings.title'), t('tutorial.settings.body'), '#F1ECE3'),
      h('p.tut-tip', [svg(icons.star(16)), t('tutorial.tip')]),
      h('div.btns', [
        h('button.btn-primary', { onclick: onStart }, [svg(icons.play(20)), t('tutorial.start')]),
        h('button.btn-secondary', { onclick: onSettings }, [svg(icons.gear()), t('tutorial.settings')]),
      ]),
    ]),
  ]);
}
