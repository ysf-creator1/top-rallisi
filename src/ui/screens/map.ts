// Dünya haritası: dünyalar, kilitler ve toplam yıldız.

import { LEVELS_PER_WORLD, PLAYABLE_WORLDS, SOON_WORLDS, WORLD_UNLOCK } from '../../config/scoring';
import { THEMES, themeForWorld } from '../../config/theme';
import { levelsOfWorld } from '../../game/levels';
import { t } from '../../i18n';
import type { App } from '../app';
import { h, svg } from '../dom';
import { icons } from '../icons';

/** Küçük park çizimi: gökyüzü, tepeler, ağaçlar ve kıvrımlı parkur */
export function worldArt(world: number): string {
  const th = THEMES[themeForWorld(world)];
  const trees: Record<number, number> = { 1: 5, 2: 11, 3: 7, 4: 6 };
  const n = trees[world] ?? 6;
  let tr = '';
  for (let i = 0; i < n; i++) {
    const x = 20 + (i * 340) / n + ((i * 37) % 17);
    const r = 14 + ((i * 13) % 9);
    tr += `<circle cx="${x}" cy="${78 - r * 0.4}" r="${r}" fill="${i % 2 ? th.treesNear : th.treesFar}"/>`;
  }
  const hedge = world === 3 ? `<rect x="0" y="84" width="360" height="10" rx="5" fill="${th.treesNearShade}"/>` : '';
  const lamp = world === 4 ? `<rect x="318" y="40" width="3" height="50" fill="#8C939A"/><circle cx="319.5" cy="38" r="6" fill="${th.lampGlow}"/><circle cx="319.5" cy="38" r="16" fill="${th.lampGlow}" opacity=".35"/>` : '';
  return `<svg viewBox="0 0 360 112" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<defs><linearGradient id="wa${world}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${th.sky[0]}"/><stop offset=".6" stop-color="${th.sky[1]}"/><stop offset="1" stop-color="${th.sky[2]}"/></linearGradient></defs>
<rect width="360" height="112" fill="url(#wa${world})"/>
<circle cx="300" cy="26" r="26" fill="${th.sunGlow}" opacity=".8"/><circle cx="300" cy="26" r="9" fill="${th.sunDisc}"/>
<path d="M0 72 Q60 46 130 64 T260 56 T360 62 V112 H0Z" fill="${th.hills}"/>
${tr}${lamp}
<rect y="84" width="360" height="28" fill="${th.grass[0]}"/><rect y="94" width="360" height="8" fill="${th.grass[1]}"/>${hedge}
<path d="M150 112 C150 96 110 92 116 80 C122 68 210 70 204 56 C198 44 160 46 166 30" fill="none" stroke="#2E3136" stroke-width="13" stroke-linecap="round"/>
<circle cx="166" cy="30" r="4.5" fill="#0B0C0D" stroke="#A9B0B7" stroke-width="1.5"/>
<path d="M174 14v16" stroke="#EDE6DC" stroke-width="1.6"/><path d="M175 14l9 3-9 3z" fill="${th.flag}"/>
</svg>`;
}

export function mapScreen(app: App): HTMLElement {
  const total = app.totalStars();
  const cards: HTMLElement[] = [];
  for (const w of [...PLAYABLE_WORLDS, ...SOON_WORLDS]) {
    const soon = SOON_WORLDS.includes(w);
    const unlocked = !soon && app.worldUnlocked(w);
    const levels = levelsOfWorld(w);
    const done = levels.filter((l) => app.record(l.id)?.completed).length;
    let worldStars = 0;
    for (const l of levels) {
      const r = app.record(l.id);
      if (r) worldStars += r.stars.filter(Boolean).length;
    }
    const right = soon
      ? h('div.lock-chip', t('map.soon'))
      : unlocked
        ? h('div.stars-chip', [svg(icons.star(16)), `${worldStars}/${LEVELS_PER_WORLD * 3}`])
        : h('div.lock-chip', [svg(icons.lock(14)), t('map.locked', { n: WORLD_UNLOCK[w] })]);
    const card = h(
      `button.world-card${unlocked ? '' : '.locked'}`,
      {
        disabled: !unlocked,
        onclick: () => unlocked && app.showLevels(w),
        'aria-label': t(`world.${w}`),
      },
      [
        h('div.world-art', { html: worldArt(w) }),
        h('div.world-badge', `${w} · ${t(`world.short.${w}`)}`),
        h('div.world-info', [
          h('div.grow', [h('b', t(`world.${w}`)), h('small', soon ? t(`world.feature.${w}`) : `${t(`world.feature.${w}`)} · ${t('map.levels', { done, total: levels.length })}`)]),
          right,
        ]),
      ],
    );
    cards.push(card);
  }
  return h('div.screen', [
    h('div.screen-inner', [
      h('div.header', [
        h('button.round-btn.white', { 'aria-label': t('common.back'), onclick: () => app.showTitle() }, [svg(icons.back())]),
        h('div.title', t('map.title')),
        h('div.stars-chip', { title: t('map.totalStars') }, [svg(icons.star(18)), String(total)]),
      ]),
      ...cards,
    ]),
  ]);
}
