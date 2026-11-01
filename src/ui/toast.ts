// Üstte kısa bildirimler.

import type { App } from './app';
import { h } from './dom';

let container: HTMLElement | null = null;

function host(app: App): HTMLElement {
  if (!container || !container.isConnected) {
    container = h('div.toasts');
    app.root.append(container);
  }
  return container;
}

export function toast(app: App, text: string, action?: { label: string; run: () => void }, ms = 2600): HTMLElement {
  const el = h(`div.toast.glass${action ? '' : '.simple'}`, [h('span', text)]);
  if (action) {
    el.append(
      h('button', { onclick: () => { action.run(); el.remove(); } }, action.label),
    );
  }
  host(app).append(el);
  if (ms > 0) {
    setTimeout(() => {
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220 }).onfinish = () => el.remove();
    }, ms);
  }
  return el;
}
