// Etap sonu (tarif 6.3, hedef: docs/tasarim/02-gunduz-etap-sonu.png)

import type { BallType } from '../../config/physics';
import type { TimeTargets } from '../../config/scoring';
import type { LevelData } from '../../game/levels/types';
import { formatDelta, formatTime, t } from '../../i18n';
import type { RunRecord } from '../../save/schema';
import type { App } from '../app';
import { h, svg } from '../dom';
import { icons } from '../icons';

export interface EndInfo {
  level: LevelData;
  time: number;
  falls: number;
  timeStars: number;
  earned: number;
  prevBest: RunRecord | null;
  isRecord: boolean;
  assist: boolean;
  ball: BallType;
  maxTimeStars: number;
  /** Bu denemenin yıldız süreleri (moda göre) */
  targets: TimeTargets;
  control: 'ropes' | 'tilt';
}

const HOLE_SVG = `<svg width="140" height="104" viewBox="0 0 140 104" aria-hidden="true">
<defs><radialGradient id="eb" cx="0.38" cy="0.32" r="0.78"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.5" stop-color="#F2F4F6"/><stop offset="1" stop-color="#C9D1D8"/></radialGradient></defs>
<ellipse cx="62" cy="58" rx="58" ry="20" fill="#2E3136"/>
<ellipse cx="62" cy="60" rx="30" ry="9" fill="#0B0C0D" stroke="#A9B0B7" stroke-width="2"/>
<rect x="38" y="66" width="58" height="16" fill="#2E3136"/>
<circle cx="62" cy="42" r="20" fill="url(#eb)"/><circle cx="56" cy="35" r="5" fill="#fff" opacity=".9"/>
<rect x="97" y="0" width="3" height="58" rx="1.5" fill="#EDE6DC"/><path d="M100 4l26 8-26 8z" fill="var(--coral)"/>
</svg>`;

export function levelEndScreen(app: App, info: EndInfo): HTMLElement {
  const L = info.level;
  const stars = h('div.end-stars');
  // Yıldızlar süreye göre: bitiren 1, iyi süre 2, çok iyi süre 3
  for (let i = 0; i < 3; i++) {
    const size = [50, 58, 66][i];
    const el = svg(icons.star(size, i < info.timeStars));
    el.style.animationDelay = `${150 + i * 140}ms`;
    stars.append(el);
  }

  // Rekora yakınlık
  const recordRow = h('div.end-record');
  const prev = info.prevBest;
  if (info.isRecord) {
    if (prev) recordRow.append(h('span.pill.ok', t('end.newRecord', { t: formatDelta(prev.time - info.time) })));
    else recordRow.append(h('span.pill.ok', t('end.firstRecord')));
  } else if (prev) {
    recordRow.append(h('span', t('end.record', { t: formatTime(prev.time) })));
    const gap = info.time - prev.time;
    recordRow.append(gap < 0.05 ? h('span.pill.ok', t('end.equalRecord')) : h('span.pill.warn', t('end.toRecord', { t: formatDelta(gap) })));
  }
  // Standart top dışındaki toplarda hangi topla oynandığı yazılır
  if (info.ball !== 'standard') recordRow.append(h('span.pill.info', t('end.ballUsed', { ball: t(`ball.${info.ball}`) })));
  if (info.assist) recordRow.append(h('span.pill.info', [svg(icons.assist(12)), t('levels.assisted')]));
  if (info.control === 'ropes') recordRow.append(h('span.pill.info', t('end.ropesTimes')));

  // 2 ve 3 yıldız için gereken süreler (kazanılanlar yeşil)
  const tt = info.targets;
  const goal = (n: number, limit: number) =>
    h(`div.star-goal${info.timeStars >= n ? '.got' : ''}${info.assist && n === 3 ? '.capped' : ''}`, [
      h('span.sg-stars', { html: icons.star(15).repeat(n) }),
      h('b', formatGoal(limit)),
    ]);
  const goals = h('div.star-goals', [goal(2, tt.silver), goal(3, tt.gold)]);
  const capLine = info.assist ? h('div.end-next', t('end.assistCap')) : null;

  const next = app.nextLevelOf(L);
  const hasGhost = !!app.ghostFor(L.id, info.assist);
  return h('div.overlay.end', [
    h('div.sheet', [
      h('div.end-hole', { html: HOLE_SVG }),
      h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } }, [h('h2', t('end.title')), h('div.end-sub', app.levelLabel(L))]),
      stars,
      h('div.end-time', formatTime(info.time)),
      recordRow,
      goals,
      capLine,
      info.falls > 0 ? h('div.end-sub', { style: { letterSpacing: '0' } }, t('end.falls', { n: info.falls })) : null,
      h('div.end-boxes', [h('div.end-box.gold', [h('span', t('end.points').toLocaleUpperCase('tr')), h('span', `+${info.earned}`)])]),
    ]),
    h('div.end-actions', [
      next
        ? h('button.btn-primary', { onclick: () => app.startLevel(next) }, t('end.next'))
        : h('button.btn-primary', { onclick: () => app.showMap() }, t('end.map')),
      h('div.two', [
        h('button.btn-secondary', { onclick: () => app.restartLevel(false) }, [svg(icons.restart()), t('end.retry')]),
        h('button.btn-secondary', { disabled: !hasGhost, onclick: () => app.restartLevel(true) }, [svg(icons.ghost()), t('end.ghost')]),
      ]),
      h('div.end-nav', [
        h('button.round-btn.glass', { 'aria-label': t('end.home'), onclick: () => app.showTitle() }, [svg(icons.home())]),
        next ? h('button.round-btn.glass', { 'aria-label': t('end.map'), onclick: () => app.showMap() }, [svg(icons.map())]) : null,
      ]),
    ]),
  ]);
}

/** Yıldız süresi: 45 → "45 sn", 65 → "1:05" */
function formatGoal(sec: number): string {
  if (sec < 60) return t('end.goalSec', { t: sec });
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
