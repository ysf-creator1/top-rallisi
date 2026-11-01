// Mağaza (hedef: docs/tasarim/03-gunduz-magaza-kostumler.png, 06-aksam-magaza-toplar.png)

import type { BallType } from '../../config/physics';
import { BALLS, COSTUMES, COSTUME_CATEGORIES, type CostumeCategory, type CostumeItem } from '../../config/shop';
import { formatPoints, t } from '../../i18n';
import { play } from '../../platform/audio';
import type { Costume } from '../../save/schema';
import type { App } from '../app';
import { clear, h, svg } from '../dom';
import { costumeIcon, icons } from '../icons';
import { ShopPreview } from '../shopPreview';
import { toast } from '../toast';
import { ballGradient } from './settings';

const ICON_BG: Record<string, string> = {
  '#8CCFB4': '#E6F3EC',
  '#B3A3E0': '#EEEAF7',
  '#E9C98A': '#FCF1DA',
  '#F2B7A9': '#FBE5DF',
  '#A8CDE8': '#E4EFF8',
  '#F2C46D': '#FCF1DA',
  '#E8907E': '#FBE5DF',
  '#4A4F56': '#EEF0F2',
  '#3B3F45': '#EEF0F2',
  '#6F86B5': '#E6ECF6',
  '#BFDDF0': '#E9F3FA',
  '#D6CCF2': '#F0ECFA',
  '#F8E2A6': '#FCF4DD',
};

const PARK_BG = `<svg viewBox="0 0 358 240" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;width:100%;height:100%" aria-hidden="true">
<circle cx="60" cy="182" r="46" fill="#A9CAA7"/><circle cx="110" cy="200" r="40" fill="#A9CAA7"/><circle cx="34" cy="210" r="34" fill="#8DB99A"/>
<circle cx="300" cy="180" r="48" fill="#A9CAA7"/><circle cx="250" cy="200" r="36" fill="#A9CAA7"/><circle cx="330" cy="214" r="34" fill="#8DB99A"/>
<rect y="196" width="358" height="44" fill="#C2E2AC"/><rect y="220" width="358" height="20" fill="#B5DA9D"/></svg>`;

type Tab = 'balls' | 'costumes';

export function shopScreen(app: App, onBack: () => void): { el: HTMLElement; cleanup: () => void } {
  const save = app.save;
  let tab: Tab = 'costumes';
  let ballSel: BallType = save.data.ball;
  let cat: CostumeCategory = 'hat';
  /** Denenen (satın alınmamış) kostüm parçası */
  let trying: CostumeItem | null = null;

  const coin = h('div.coin-chip', [svg(icons.coin(18)), h('span.amt', formatPoints(save.data.points))]);
  const previewBox = h('div.shop-preview', { html: app.theme === 'gunduz' ? PARK_BG : '' });
  const countEl = h('div.shop-count');
  previewBox.append(countEl);
  const body = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } });
  const bottom = h('div.shop-bottom');
  const tabs = h('div.tabs');
  let preview: ShopPreview | null = null;

  const owned = (id: string) => save.data.ownedCostumes.includes(id);

  const previewCostume = (): Costume => {
    const c: Costume = { ...save.data.costume };
    if (trying) {
      if (trying.category === 'number') c.number = c.number ?? 12;
      else c[trying.category] = trying.key;
    }
    return c;
  };

  const refreshPreview = () => {
    const ball = tab === 'balls' ? ballSel : save.data.ball;
    preview?.setBall(ball, previewCostume());
    if (tab === 'balls') {
      countEl.style.display = '';
      countEl.textContent = `${BALLS.findIndex((b) => b.id === ballSel) + 1} / ${BALLS.length}`;
    } else countEl.style.display = 'none';
    coin.querySelector('.amt')!.textContent = formatPoints(save.data.points);
  };

  const buyButton = (price: number, onBuy: () => void) => {
    const can = save.data.points >= price;
    return h('button.btn-dark', { disabled: !can, onclick: onBuy }, can
      ? [t('shop.buy'), h('span.price', [svg(icons.coin(16)), formatPoints(price)])]
      : [t('shop.notEnough'), h('span.price', [svg(icons.coin(16)), formatPoints(price)])]);
  };

  const renderTabs = () => {
    clear(tabs);
    for (const [k, label] of [['balls', t('shop.balls')], ['costumes', t('shop.costumes')]] as const) {
      tabs.append(
        h(`button${tab === k ? '.on' : ''}`, {
          onclick: () => {
            tab = k;
            trying = null;
            ballSel = save.data.ball;
            render();
          },
        }, label),
      );
    }
  };

  const renderBalls = () => {
    const item = BALLS.find((b) => b.id === ballSel)!;
    const stat = (label: string, v: number) => h('div.stat-row', [h('span', label), h('div.stat-bar', [h('i', { style: { width: `${Math.round(v * 100)}%` } })])]);
    const row = h('div.ball-row');
    for (const b of BALLS) {
      const has = save.data.ownedBalls.includes(b.id);
      const [g0, g1, g2] = ballGradient(b.id);
      row.append(
        h(`button${b.id === ballSel ? '.on' : ''}${has ? '' : '.locked'}`, {
          'aria-label': t(`ball.${b.id}`),
          onclick: () => {
            ballSel = b.id;
            render();
          },
        }, [
          h('span.ball-dot', { style: { background: `radial-gradient(circle at 38% 32%, ${g0}, ${g1} 50%, ${g2})` } }),
          has ? null : h('span.lock', { html: icons.lock(14, '#5B4F8A') }),
        ]),
      );
    }
    body.append(
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, [h('h2.ball-title', t(`ball.${item.id}`)), h('p.ball-desc', t(`ball.desc.${item.id}`))]),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, [
        stat(t('shop.stat.speed'), item.stats.speed),
        stat(t('shop.stat.control'), item.stats.control),
        stat(t('shop.stat.wind'), item.stats.wind),
      ]),
      row,
    );
    const has = save.data.ownedBalls.includes(item.id);
    if (has && save.data.ball === item.id) bottom.append(h('button.btn-dark', { disabled: true }, t('shop.inUse')));
    else if (has)
      bottom.append(h('button.btn-dark', { onclick: () => { save.update((d) => (d.ball = item.id)); play('tap'); render(); } }, t('shop.use')));
    else
      bottom.append(
        buyButton(item.price, () => {
          save.update((d) => {
            d.points -= item.price;
            d.ownedBalls.push(item.id);
            d.ball = item.id;
          });
          play('buy');
          toast(app, t('toast.bought', { item: t(`ball.${item.id}`) }));
          render();
        }),
      );
  };

  const equip = (it: CostumeItem | null, category: CostumeCategory) => {
    save.update((d) => {
      if (category === 'number') d.costume.number = it ? d.costume.number ?? 12 : null;
      else d.costume[category] = it ? it.key : null;
    });
  };

  const renderCostumes = () => {
    const cats = h('div.cat-row');
    for (const c of COSTUME_CATEGORIES) {
      cats.append(h(`button${c === cat ? '.on' : ''}`, { onclick: () => { cat = c; trying = null; render(); } }, t(`shop.cat.${c}`)));
    }
    const grid = h('div.item-grid');
    const cur = save.data.costume;
    // "Yok / kendi rengi" kartı
    const noneOn = cat === 'number' ? cur.number === null : cur[cat] === null;
    grid.append(
      h(`button.item-card${noneOn && !trying ? '.on' : ''}`, { onclick: () => { trying = null; equip(null, cat); render(); } }, [
        h('div.ico', { style: { background: '#F4F1EC' }, html: cat === 'color' ? costumeIcon('color', 'default', '#F6F7F9') : icons.close() }),
        h('span.nm', cat === 'color' ? t('costume.color.default') : cat === 'number' ? t('shop.numberNone') : t('shop.none')),
        h(`span.st${noneOn ? '.equipped' : ''}`, noneOn ? t('shop.equipped') : t('shop.owned')),
      ]),
    );
    for (const it of COSTUMES.filter((c) => c.category === cat)) {
      const has = owned(it.id);
      const locked = !!it.lockedText;
      const on = has && (cat === 'number' ? cur.number !== null : cur[cat] === it.key);
      const name = cat === 'number' ? t('shop.number') : t(`costume.${it.category}.${it.key}`);
      let st: HTMLElement;
      if (locked) st = h('span.st', t(it.lockedText!));
      else if (on) st = h('span.st.equipped', t('shop.equipped'));
      else if (has) st = h('span.st', t('shop.owned'));
      else st = h('span.st.price', [svg(icons.coin(13)), formatPoints(it.price)]);
      grid.append(
        h(`button.item-card${on ? '.on' : ''}${trying?.id === it.id ? '.selected' : ''}${locked ? '.locked' : ''}`, {
          onclick: () => {
            if (locked) {
              toast(app, t(it.lockedText!));
              return;
            }
            if (has) {
              trying = null;
              equip(on ? null : it, cat);
            } else trying = trying?.id === it.id ? null : it;
            play('tap');
            render();
          },
        }, [
          h('div.ico', { style: { background: locked ? '#EFEBE5' : ICON_BG[it.tint] ?? '#F4F1EC' }, html: locked ? `${costumeIcon(cat, it.key, it.tint)}` : costumeIcon(cat, it.key, it.tint) }),
          h('span.nm', name),
          st,
        ]),
      );
    }
    body.append(cats, grid);
    if (cat === 'number' && cur.number !== null) {
      const num = h('b', String(cur.number));
      const set = (d: number) => {
        save.update((s) => (s.costume.number = Math.max(1, Math.min(99, (s.costume.number ?? 12) + d))));
        num.textContent = String(save.data.costume.number);
        refreshPreview();
      };
      body.append(
        h('div.card', [
          h('div.number-picker', [
            h('button.round-btn.white', { 'aria-label': '-', onclick: () => set(-1) }, [svg(icons.minus())]),
            num,
            h('button.round-btn.white', { 'aria-label': '+', onclick: () => set(1) }, [svg(icons.plus())]),
          ]),
        ]),
      );
    }
    body.append(h('p.note', t('shop.note')));
    if (trying) {
      const it = trying;
      bottom.append(
        buyButton(it.price, () => {
          save.update((d) => {
            d.points -= it.price;
            d.ownedCostumes.push(it.id);
          });
          equip(it, it.category);
          trying = null;
          play('buy');
          toast(app, t('toast.bought', { item: it.category === 'number' ? t('shop.number') : t(`costume.${it.category}.${it.key}`) }));
          render();
        }),
      );
    }
  };

  const render = () => {
    renderTabs();
    clear(body);
    clear(bottom);
    if (tab === 'balls') renderBalls();
    else renderCostumes();
    refreshPreview();
  };

  const el = h('div.screen', [
    h('div.screen-inner', { style: { flex: '1' } }, [
      h('div.header', [
        h('button.round-btn.white', { 'aria-label': t('common.back'), onclick: onBack }, [svg(icons.back())]),
        h('div.title', { style: { textAlign: 'center' } }, t('shop.title')),
        coin,
      ]),
      previewBox,
      tabs,
      body,
      bottom,
    ]),
  ]);
  requestAnimationFrame(() => {
    preview = new ShopPreview(previewBox, app.theme === 'gunduz');
    previewBox.insertBefore(preview.canvas, countEl);
    render();
  });
  render();
  const onResize = () => preview?.resize();
  window.addEventListener('resize', onResize);
  return {
    el,
    cleanup: () => {
      window.removeEventListener('resize', onResize);
      preview?.dispose();
    },
  };
}
