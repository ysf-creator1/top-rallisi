// İlk açılışta kontrol seçimi: "Telefonu eğ" (önerilen) ya da "Çift halat".
// Kartların içinde kısa, kendi kendine dönen animasyonlar var.

import { t } from '../../i18n';
import type { ControlMode } from '../../save/schema';
import { h } from '../dom';

// Telefon sağa sola eğilir; içindeki çubukta top alçalan tarafa yuvarlanır
const TILT_SVG = `<svg viewBox="0 0 120 96" aria-hidden="true">
<ellipse cx="60" cy="90" rx="30" ry="3.5" fill="rgba(59,63,69,0.10)"/>
<g class="cp-phone">
  <rect x="34" y="8" width="52" height="78" rx="10" fill="#3B3F45"/>
  <rect x="38" y="15" width="44" height="64" rx="5" fill="#E4EEEA"/>
  <path d="M43 22 C50 32 70 30 74 40 C77 48 62 50 58 58" fill="none" stroke="#2E3136" stroke-width="8" stroke-linecap="round"/>
  <path d="M41 66 Q60 71 79 66" fill="none" stroke="#9AA4AE" stroke-width="2.2" stroke-linecap="round"/>
  <g class="cp-tilt-ball"><circle cx="60" cy="64.6" r="3.6" fill="#FFFFFF" stroke="#B8C0C8" stroke-width="0.9"/></g>
</g>
</svg>`;

// İki halat birlikte aşağı çekilir, çubuk yükselir; bırakılınca iner
const ROPES_SVG = `<svg viewBox="0 0 120 96" aria-hidden="true">
<rect x="20" y="10" width="80" height="4" rx="2" fill="#D8B9A4"/>
<rect x="22" y="12" width="3" height="78" rx="1.5" fill="#E2C8B6"/>
<rect x="95" y="12" width="3" height="78" rx="1.5" fill="#E2C8B6"/>
<path d="M36 18 C46 30 74 26 80 40 C84 50 64 54 60 66" fill="none" stroke="#2E3136" stroke-width="8" stroke-linecap="round" opacity="0.9"/>
<g class="cp-rope-l"><line x1="12" y1="12" x2="12" y2="70" stroke="#C9A877" stroke-width="3.4" stroke-linecap="round"/><circle cx="12" cy="72" r="4.2" fill="#B8955F"/><circle class="cp-touch" cx="12" cy="56" r="6.5" fill="rgba(255,253,248,0.85)" stroke="#3B3F45" stroke-width="1.6"/></g>
<g class="cp-rope-r"><line x1="108" y1="12" x2="108" y2="76" stroke="#C9A877" stroke-width="3.4" stroke-linecap="round"/><circle cx="108" cy="78" r="4.2" fill="#B8955F"/><circle class="cp-touch" cx="108" cy="62" r="6.5" fill="rgba(255,253,248,0.85)" stroke="#3B3F45" stroke-width="1.6"/></g>
<g class="cp-bar">
  <path d="M26 76 Q60 82 94 76" fill="none" stroke="#9AA4AE" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="60" cy="75.2" r="4" fill="#FFFFFF" stroke="#B8C0C8" stroke-width="0.9"/>
</g>
</svg>`;

export function controlPickOverlay(onPick: (c: ControlMode) => void): HTMLElement {
  const card = (c: ControlMode, art: string, title: string, sub: string, badge?: string) =>
    h(`button.cp-card${c === 'tilt' ? '.rec' : ''}`, { onclick: () => onPick(c) }, [
      badge ? h('span.cp-badge', badge) : null,
      h('div.cp-art', { html: art }),
      h('b', title),
      h('span.cp-sub', sub),
    ]);
  return h('div.overlay.cp', [
    h('div.sheet', [
      h('h2', t('pick.title')),
      h('div.cp-cards', [
        card('tilt', TILT_SVG, t('pick.tilt.title'), t('pick.tilt.sub'), t('pick.tilt.badge')),
        card('ropes', ROPES_SVG, t('pick.ropes.title'), t('pick.ropes.sub')),
      ]),
      h('p.cp-note', t('pick.note')),
    ]),
  ]);
}
