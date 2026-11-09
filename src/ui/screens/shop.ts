// Mağaza (hedef: docs/tasarim/03-gunduz-magaza-kostumler.png, 06-aksam-magaza-toplar.png)

import { track } from '../../platform/analytics';
import type { BallType } from '../../config/physics';
import { BALLS, COSTUMES, COSTUME_CATEGORIES, CROWN_LEVELS, isSkinCategory, type CostumeCategory, type CostumeItem } from '../../config/shop';
import { formatPoints, t } from '../../i18n';
import { play } from '../../platform/audio';
import { dailySale, dayKey, priceToday } from '../../game/meta';
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
type SimpleSlot = 'color' | 'sticker' | 'hat' | 'glasses' | 'jersey';

/** Kostümü kendi yuvasına yazar (it null ise o yuvayı boşaltır) */
function applyItem(c: Costume, category: CostumeCategory, it: CostumeItem | null): void {
  if (category === 'number') {
    c.number = it ? c.number ?? 7 : null;
    c.numberStyle = it ? it.key : null;
  } else if (isSkinCategory(category)) c.skin = it ? it.key : null;
  else c[category as SimpleSlot] = it ? it.key : null;
}

/** Bu kategoride hiçbir şey takılı değil mi? */
function slotEmpty(c: Costume, category: CostumeCategory): boolean {
  if (category === 'number') return c.number === null;
  if (isSkinCategory(category)) return c.skin === null;
  return c[category as SimpleSlot] === null;
}

function isWorn(c: Costume, it: CostumeItem): boolean {
  if (it.category === 'number') return c.number !== null && (c.numberStyle ?? 'number') === it.key;
  if (isSkinCategory(it.category)) return c.skin === it.key;
  return c[it.category as SimpleSlot] === it.key;
}

/** Mağaza en son bakılan bölümde açılır (ilk seferde Toplar) */
let lastTab: Tab = 'balls';
let lastCat: CostumeCategory = 'hat';

export function shopScreen(app: App, onBack: () => void): { el: HTMLElement; cleanup: () => void } {
  const save = app.save;
  let tab: Tab = lastTab;
  let ballSel: BallType = save.data.ball;
  let cat: CostumeCategory = lastCat;
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
  const today = dayKey();
  const sale = dailySale(today);
  const onSale = (it: CostumeItem) => sale.some((x) => x.id === it.id);
  const saleStrip = h('div.sale-strip');
  const completedLevels = Object.values(save.data.levels).filter((r) => r.completed).length;

  const previewCostume = (): Costume => {
    const c: Costume = { ...save.data.costume };
    if (trying) applyItem(c, trying.category, trying);
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

  /** Bugün indirimdeki iki parça: dokununca o parça denenir */
  const renderSale = () => {
    clear(saleStrip);
    saleStrip.append(h('div.sale-head', [h('b', t('shop.sale')), h('small', t('shop.saleNote'))]));
    const row = h('div.sale-row');
    for (const it of sale) {
      const has = owned(it.id);
      row.append(
        h(`button.sale-item${has ? '.owned' : ''}`, {
          onclick: () => {
            tab = lastTab = 'costumes';
            cat = lastCat = it.category;
            trying = has ? null : it;
            play('tap');
            render();
          },
        }, [
          h('div.ico', { style: { background: ICON_BG[it.tint] ?? '#F4F1EC' }, html: costumeIcon(it.category, it.key, it.tint, save.data.costume.number ?? 7) }),
          h('span.nm', t(`costume.${it.category}.${it.key}`)),
          has
            ? h('span.st', t('shop.owned'))
            : h('span.st.price', [h('s', formatPoints(it.price)), svg(icons.coin(13)), formatPoints(priceToday(it, today))]),
          h('span.sale-tag', t('shop.saleTag')),
        ]),
      );
    }
    saleStrip.append(row);
  };

  const renderTabs = () => {
    clear(tabs);
    for (const [k, label] of [['balls', t('shop.balls')], ['costumes', t('shop.costumes')]] as const) {
      tabs.append(
        h(`button${tab === k ? '.on' : ''}`, {
          onclick: () => {
            tab = lastTab = k;
            trying = null;
            ballSel = save.data.ball;
            render();
          },
        }, [label, k === 'costumes' && tab !== 'costumes' && sale.some((x) => !owned(x.id)) ? h('span.tab-sale', t('shop.saleTag')) : null]),
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
          has ? null : h('span.ball-price', [svg(icons.coin(12)), formatPoints(b.price)]),
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
          track('buy', { item: `ball.${item.id}`, price: item.price });
          toast(app, t('toast.bought', { item: t(`ball.${item.id}`) }));
          render();
        }),
      );
  };

  const equip = (it: CostumeItem | null, category: CostumeCategory) => {
    save.update((d) => applyItem(d.costume, category, it));
  };

  const renderCostumes = () => {
    const cats = h('div.cat-row');
    for (const c of COSTUME_CATEGORIES) {
      cats.append(h(`button${c === cat ? '.on' : ''}`, { onclick: () => { cat = lastCat = c; trying = null; render(); } }, t(`shop.cat.${c}`)));
    }
    const grid = h('div.item-grid');
    const cur = save.data.costume;
    // "Yok / kendi rengi" kartı
    const noneOn = slotEmpty(cur, cat);
    grid.append(
      h(`button.item-card${noneOn && !trying ? '.on' : ''}`, { onclick: () => { trying = null; equip(null, cat); render(); } }, [
        h('div.ico', { style: { background: '#F4F1EC' }, html: cat === 'color' ? costumeIcon('color', 'default', '#F6F7F9') : icons.close() }),
        h('span.nm', cat === 'color' ? t('costume.color.default') : cat === 'number' ? t('shop.numberNone') : t('shop.none')),
        h(`span.st${noneOn ? '.equipped' : ''}`, noneOn ? t('shop.equipped') : t('shop.owned')),
      ]),
    );
    for (const it of COSTUMES.filter((c) => c.category === cat)) {
      const crownOpen = it.id === 'hat.crown' && completedLevels >= CROWN_LEVELS;
      const locked = !!it.lockedText && !crownOpen;
      // Ücretsiz açılan parça (taç) satın almadan kullanılabilir
      const has = owned(it.id) || (crownOpen && it.price === 0);
      const on = has && isWorn(cur, it);
      const name = t(`costume.${it.category}.${it.key}`);
      let st: HTMLElement;
      if (locked) st = h('span.st', t(it.lockedText!));
      else if (on) st = h('span.st.equipped', t('shop.equipped'));
      else if (has) st = h('span.st', t('shop.owned'));
      else if (onSale(it)) st = h('span.st.price', [h('s', formatPoints(it.price)), svg(icons.coin(13)), formatPoints(priceToday(it, today))]);
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
          h('div.ico', { style: { background: locked ? '#EFEBE5' : ICON_BG[it.tint] ?? '#F4F1EC' }, html: costumeIcon(cat, it.key, it.tint, cur.number ?? 7) }),
          h('span.nm', name),
          st,
          !has && !locked && onSale(it) ? h('span.sale-tag', t('shop.saleTag')) : null,
        ]),
      );
    }
    body.append(cats, grid);
    if (cat === 'number' && cur.number !== null) {
      const num = h('b', String(cur.number));
      const set = (d: number) => {
        save.update((s) => (s.costume.number = Math.max(0, Math.min(99, (s.costume.number ?? 7) + d))));
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
      const price = priceToday(it, today);
      bottom.append(
        buyButton(price, () => {
          save.update((d) => {
            d.points -= price;
            d.ownedCostumes.push(it.id);
          });
          equip(it, it.category);
          trying = null;
          play('buy');
          track('buy', { item: it.id, price, sale: price !== it.price || undefined });
          toast(app, t('toast.bought', { item: t(`costume.${it.category}.${it.key}`) }));
          render();
        }),
      );
    }
  };

  const render = () => {
    renderTabs();
    renderSale();
    saleStrip.style.display = tab === 'costumes' ? '' : 'none';
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
      saleStrip,
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
