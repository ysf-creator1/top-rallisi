// Onay, eğim izni ve "Ana ekrana ekle" diyalogları.

import type { BallType } from '../../config/physics';
import { formatPoints, formatTime, t } from '../../i18n';
import { tiltNeedsPermission } from '../../platform/tilt';
import type { App } from '../app';
import { h, svg } from '../dom';
import { icons } from '../icons';
import { ballGradient } from './settings';

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

/** Yukarıdan dökülen konfeti katmanı (hareket azaltma açıksa boş) */
export function confettiLayer(count = 36, delay = 0): HTMLElement {
  const confetti = h('div.confetti');
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return confetti;
  for (let i = 0; i < count; i++) {
    const c = h('i');
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = CONFETTI[i % CONFETTI.length];
    c.style.animationDelay = `${delay + Math.random() * 0.6}s`;
    c.style.animationDuration = `${1.6 + Math.random() * 1.2}s`;
    c.style.transform = `rotate(${Math.random() * 360}deg)`;
    confetti.append(c);
  }
  return confetti;
}

/** Arkadaşın gönderdiği meydan okuma linki açılınca */
export function showChallenge(app: App, levelName: string, label: string, time: number, onGo: () => void): void {
  const el = modal(
    app,
    [
      h('div.unlock-badge.ghosty', [svg(icons.ghost())]),
      h('h2', t('challenge.title')),
      h('div.end-sub', label),
      h('p', t('challenge.body', { level: levelName, t: formatTime(time) })),
      h('div.btns', [
        h('button.btn-primary', { onclick: () => { el.remove(); onGo(); } }, [svg(icons.play(20)), t('challenge.go')]),
        h('button.btn-secondary', { onclick: () => el.remove() }, t('challenge.later')),
      ]),
    ],
    () => el.remove(),
  );
}

/** 7 günlük seri hediyesi: yeni top ya da puan */
export function showStreakGift(app: App, days: number, ball: BallType | null, points: number, onUse: () => void): void {
  const prize = ball
    ? h('div.gift-prize', [h('span.ball-dot.big', { style: { background: ballSwatch(ball) } }), h('b', t(`ball.${ball}`))])
    : h('div.gift-prize', [svg(icons.coin(30)), h('b', t('gift.points', { n: formatPoints(points) }))]);
  const el = modal(app, [
    h('div.unlock-badge.flame', { html: icons.flame(42) }),
    h('h2', t('gift.title', { n: days })),
    h('p', t('gift.body')),
    prize,
    h('div.btns', [
      ball ? h('button.btn-primary', { onclick: () => { el.remove(); onUse(); } }, t('gift.use')) : null,
      h(ball ? 'button.btn-secondary' : 'button.btn-primary', { onclick: () => el.remove() }, t('gift.ok')),
    ]),
  ]);
  el.classList.add('unlock');
  el.prepend(confettiLayer());
}

/** Hediye kartındaki top rengi (mağazadaki renkler) */
function ballSwatch(ball: BallType): string {
  const [a, b, c] = ballGradient(ball);
  return `radial-gradient(circle at 38% 32%, ${a}, ${b} 50%, ${c})`;
}

/** Yeni dünya açılınca büyük kutlama kartı ve konfeti */
export function showWorldUnlocked(app: App, world: number, onGo: () => void): void {
  const confetti = confettiLayer();
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
