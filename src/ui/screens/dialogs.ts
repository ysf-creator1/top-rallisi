// Onay, eğim izni ve "Ana ekrana ekle" diyalogları.

import { t } from '../../i18n';
import { tiltNeedsPermission } from '../../platform/tilt';
import type { App } from '../app';
import { h, svg } from '../dom';
import { icons } from '../icons';

function modal(app: App, children: (HTMLElement | null)[], onBackdrop?: () => void): HTMLElement {
  const el = h('div.overlay', { style: { zIndex: '40' } }, [h('div.sheet', children)]);
  el.addEventListener('click', (e) => {
    if (e.target === el && onBackdrop) onBackdrop();
  });
  app.root.append(el);
  return el;
}

export function showConfirm(app: App, text: string, yes: string, onYes: () => void): void {
  const el = modal(
    app,
    [
      h('p', text),
      h('div.btns', [
        h('button.danger-btn', { onclick: () => { el.remove(); onYes(); } }, yes),
        h('button.btn-secondary', { onclick: () => el.remove() }, t('settings.cancel')),
      ]),
    ],
    () => el.remove(),
  );
}

/**
 * Eğim izni ekranı. iPhone'da izin yalnızca bir dokunuşla istenebildiği için butonlu.
 * İzin gerekmiyorsa (Android) doğrudan dener.
 */
export function showTiltPermission(app: App, onAllow: () => void, onCancel: () => void, quick: boolean): void {
  if (!tiltNeedsPermission() && quick) {
    onAllow();
    return;
  }
  const el = modal(app, [
    svg(icons.phone()),
    h('h2', t('tilt.title')),
    h('p', t('tilt.body')),
    h('div.btns', [
      h('button.btn-primary', { onclick: () => { el.remove(); onAllow(); } }, t('tilt.allow')),
      h('button.btn-secondary', { onclick: () => { el.remove(); onCancel(); } }, t('tilt.cancel')),
    ]),
  ]);
}

export function showA2hs(app: App): void {
  const el = modal(
    app,
    [
      svg(icons.share()),
      h('h2', t('a2hs.title')),
      h('p', t('a2hs.body')),
      h('div.btns', [h('button.btn-primary', { onclick: () => el.remove() }, t('a2hs.ok'))]),
    ],
    () => el.remove(),
  );
}
