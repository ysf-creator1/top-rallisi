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

const CONFETTI = ['#8CCFB4', '#F2C46D', '#E8907E', '#B3A3E0', '#A8CDE8'];

/** Yeni dünya açılınca büyük kutlama kartı ve konfeti */
export function showWorldUnlocked(app: App, world: number, onGo: () => void): void {
  const confetti = h('div.confetti');
  for (let i = 0; i < 36; i++) {
    const c = h('i');
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = CONFETTI[i % CONFETTI.length];
    c.style.animationDelay = `${Math.random() * 0.6}s`;
    c.style.animationDuration = `${1.6 + Math.random() * 1.2}s`;
    c.style.transform = `rotate(${Math.random() * 360}deg)`;
    confetti.append(c);
  }
  const el = modal(app, [
    h('div.unlock-badge', [svg(icons.map())]),
    h('h2', t('unlock.title', { world: t(`world.${world}`) })),
    h('p', t('unlock.body')),
    h('div.btns', [
      h('button.btn-primary', { onclick: () => { el.remove(); onGo(); } }, [svg(icons.play(20)), t('unlock.go')]),
      h('button.btn-secondary', { onclick: () => el.remove() }, t('unlock.later')),
    ]),
  ]);
  el.classList.add('unlock');
  el.prepend(confetti);
}
