import { JERSEY_COLORS } from '../config/shop';
import { skinIconUrl } from '../game/render/skins';
// Yumuşak köşeli, tek kalınlıkta çizgi ikonlar (emoji yok).

const line = (d: string, size = 22, color = 'currentColor', w = 2.2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const STAR_PATH = 'M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z';

export const icons = {
  pause: () =>
    '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.6" height="12" rx="1.8" fill="currentColor"/><rect x="9.4" y="2" width="3.6" height="12" rx="1.8" fill="currentColor"/></svg>',
  back: () => line('<path d="M14.5 6l-6 6 6 6"/>', 22),
  star: (size = 18, filled = true) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}" fill="${filled ? '#F2C46D' : '#ECE7DF'}" stroke="${filled ? '#DDA94B' : '#D6CFC4'}" stroke-width="${size > 30 ? 0.8 : 1}" stroke-linejoin="round"/></svg>`,
  /** Süre madalyası: 0 yok, 1 bronz, 2 gümüş, 3 altın */
  medal: (size = 18, tier = 3) => {
    const c = ['#ECE7DF', '#D9A27A', '#CBD3DA', '#F2C46D'][tier] ?? '#ECE7DF';
    const e = ['#D6CFC4', '#B97F55', '#A3AEB8', '#DDA94B'][tier] ?? '#D6CFC4';
    const rib = tier ? '#8CCFB4' : '#E2DDD4';
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><g><path d="M7.5 1.5h4l1.6 6.5h-4zM16.5 1.5h-4l-1.6 6.5h4z" fill="${rib}"/><circle cx="12" cy="14.5" r="7.6" fill="${c}" stroke="${e}" stroke-width="1.2"/><circle cx="12" cy="14.5" r="4.6" fill="none" stroke="${e}" stroke-width="1" opacity=".7"/></g></svg>`;
  },
  coin: (size = 18) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#F2C46D" stroke="#DDA94B" stroke-width="1.4"/><circle cx="12" cy="12" r="5.2" fill="none" stroke="#DDA94B" stroke-width="1.4"/></svg>`,
  lock: (size = 16, color = '#6A7078') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="3" fill="${color}"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  gear: () =>
    line(
      '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5"/>',
    ),
  bag: () => line('<path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>'),
  play: (size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>`,
  restart: () => line('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>'),
  home: () => line('<path d="M4 11.5L12 4.5l8 7"/><path d="M6.5 9.8V19.5h11V9.8"/><path d="M10 19.5v-5h4v5"/>'),
  map: () => line('<path d="M9 4.5L3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2z"/><path d="M9 4.5v13M15 6.5v13"/>'),
  ghost: () => line('<path d="M6 20V11a6 6 0 0 1 12 0v9l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5z"/><circle cx="9.8" cy="11" r=".6" fill="currentColor"/><circle cx="14.2" cy="11" r=".6" fill="currentColor"/>'),
  swap: () => line('<path d="M4 8h14l-3-3M20 16H6l3 3"/>'),
  phone: () =>
    `<svg width="44" height="36" viewBox="0 0 44 36" aria-hidden="true"><path d="M6 24 Q22 34 38 24" fill="none" stroke="#B3A3E0" stroke-width="2.2" stroke-linecap="round"/><g transform="rotate(14 22 17)"><rect x="15" y="4" width="14" height="24" rx="3.5" fill="#FBF7F0" stroke="#3B3F45" stroke-width="2.2"/></g><circle cx="33" cy="12" r="3" fill="#B3A3E0"/></svg>`,
  rope: () =>
    `<svg width="28" height="36" viewBox="0 0 28 36" aria-hidden="true"><rect x="11" y="1" width="6" height="24" rx="3" fill="#DCC29A"/><path d="M11 6l6 -3M11 11l6-3M11 16l6-3M11 21l6-3" stroke="#BC9C6E" stroke-width="1.6"/><ellipse cx="14" cy="28" rx="6.5" ry="6" fill="#DCC29A" stroke="#A98B5F"/><path d="M14 18v-8" stroke="#3B3F45" stroke-width="2" stroke-linecap="round"/><path d="M11 13l3 3 3-3" fill="none" stroke="#3B3F45" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 2)"/></svg>`,
  keys: () =>
    line('<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7 14h10"/>'),
  rings: () => line('<circle cx="12" cy="12" r="8.5" opacity=".45"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>'),
  info: () => line('<path d="M12 10.8v7"/><circle cx="12" cy="6.6" r="1.6" fill="currentColor" stroke="none"/>', 24, 'currentColor', 3),
  flag: () => line('<path d="M6 21V4"/><path d="M6 4.5h11l-2.5 3.5L17 11.5H6"/>'),
  check: () => line('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  minus: () => line('<path d="M6 12h12"/>'),
  plus: () => line('<path d="M12 6v12M6 12h12"/>'),
  close: () => line('<path d="M7 7l10 10M17 7L7 17"/>'),
  share: () => line('<path d="M12 15V4M8 7.5L12 3.5l4 4"/><path d="M6 11v8.5h12V11"/>'),
  assist: (size = 12) => line('<path d="M12 3.5l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9v-5z"/>', size),
  arrowLeft: (size = 14) => line('<path d="M19 12H5M10 7l-5 5 5 5"/>', size),
  arrowRight: (size = 14) => line('<path d="M5 12h14M14 7l5 5-5 5"/>', size),
};

/** Mağaza kostüm ikonları (küçük renkli çizimler) */
const MAGIC_ICONS: Record<string, string> = {
  snow: `<path d="M22 9l6 12H16z" fill="#3FA36B"/><path d="M11 24a11 6 0 0 0 22 0z" fill="#F7F9FB"/><g fill="#fff"><circle cx="14" cy="12" r="1.3"/><circle cx="30" cy="10" r="1.3"/><circle cx="27" cy="18" r="1.2"/><circle cx="16" cy="19" r="1.2"/></g>`,
  heart: `<path d="M22 26C12 19 14 9 22 13 30 9 32 19 22 26z" fill="#E5484D"/>`,
  aquarium: `<circle cx="22" cy="17" r="11" fill="#7FC4E8" opacity=".6"/><ellipse cx="21" cy="17" rx="5" ry="3.2" fill="#F2994A"/><path d="M16 17l-4-3v6z" fill="#F2994A"/><circle cx="24" cy="16" r=".9" fill="#22252A"/><circle cx="27" cy="11" r="1.2" fill="#fff"/>`,
  atom: `<g fill="none" stroke="#9C8AD0" stroke-width="1.4"><ellipse cx="22" cy="17" rx="10" ry="4"/><ellipse cx="22" cy="17" rx="10" ry="4" transform="rotate(60 22 17)"/><ellipse cx="22" cy="17" rx="10" ry="4" transform="rotate(-60 22 17)"/></g><circle cx="22" cy="17" r="3" fill="#E8907E"/><circle cx="31" cy="15" r="1.6" fill="#4FC9D9"/>`,
  galaxy: `<circle cx="22" cy="17" r="12" fill="#2B2350"/><path d="M22 17c3-2 6 1 4 4s-8 2-9-3 4-9 10-7" fill="none" stroke="#C9B8FF" stroke-width="2" stroke-linecap="round"/><g fill="#fff"><circle cx="15" cy="10" r=".9"/><circle cx="29" cy="24" r=".9"/><circle cx="30" cy="11" r=".7"/></g>`,
  solar: `<circle cx="22" cy="17" r="12" fill="#1E2448"/><g fill="none" stroke="#fff" stroke-opacity=".35"><ellipse cx="22" cy="17" rx="7" ry="3"/><ellipse cx="22" cy="17" rx="10.5" ry="4.5"/></g><circle cx="22" cy="17" r="3" fill="#FFC23D"/><circle cx="29" cy="17" r="1.4" fill="#3D8ED0"/><circle cx="14" cy="15" r="1.5" fill="#C1502E"/>`,
};

const NUMBER_ICON: Record<string, [string, string, string]> = {
  number: ['#FBF7F0', '#E8907E', '#3B3F45'],
  race: ['#FBFBFB', '#22252A', '#22252A'],
  neon: ['#24283A', '#4FE3F0', '#7FF6FF'],
  gold: ['#F4CF6A', '#C99A2E', '#5A3F10'],
};

export function costumeIcon(category: string, key: string, tint: string, num = 7): string {
  if (category === 'flag' || category === 'planet' || category === 'sport') {
    const url = skinIconUrl(key);
    const ring = key === 'saturn' ? `<ellipse cx="22" cy="17" rx="20" ry="5" fill="none" stroke="#D9BE84" stroke-width="2.4" transform="rotate(-14 22 17)"/>` : '';
    return `<svg width="44" height="34" viewBox="0 0 44 34" aria-hidden="true"><image href="${url ?? ''}" x="7" y="2" width="30" height="30"/>${ring}</svg>`;
  }
  if (category === 'magic') {
    return `<svg width="44" height="34" viewBox="0 0 44 34" aria-hidden="true"><circle cx="22" cy="17" r="13" fill="#EAF4FA" stroke="#C9DCE8"/>${MAGIC_ICONS[key] ?? ''}<path d="M14 10a10 10 0 0 1 6-4" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
  }
  const s = (inner: string) => `<svg width="44" height="34" viewBox="0 0 44 34" aria-hidden="true">${inner}</svg>`;
  switch (category) {
    case 'color':
      return s(`<circle cx="22" cy="17" r="13" fill="${tint}"/><circle cx="17" cy="12" r="3.5" fill="#fff" opacity=".7"/>`);
    case 'sticker': {
      const paths: Record<string, string> = {
        star: `<path d="${STAR_PATH}" transform="translate(10 5)" fill="${tint}" stroke="#DDA94B"/>`,
        heart: `<path d="M22 28C10 20 12 9 22 13 32 9 34 20 22 28z" fill="${tint}"/>`,
        bolt: `<path d="M25 4L14 19h7l-3 11 12-16h-7z" fill="${tint}"/>`,
        leaf: `<path d="M12 28C10 14 22 6 34 6 34 20 26 28 12 28z" fill="${tint}"/><path d="M13 27L28 12" stroke="#fff" stroke-width="1.6"/>`,
      };
      return s(paths[key] ?? '');
    }
    case 'hat': {
      const p: Record<string, string> = {
        cap: `<circle cx="16" cy="8" r="2.5" fill="${tint}"/><path d="M6 24 Q16 10 27 22 Z" fill="${tint}"/><path d="M24 20h12a3 3 0 0 1-3 4H24z" fill="#6FBF9E"/>`,
        beanie: `<path d="M10 26a12 12 0 0 1 24 0z" fill="${tint}"/><rect x="9" y="24" width="26" height="6" rx="3" fill="#9C8AD0"/><circle cx="22" cy="8" r="4" fill="#F6F1E8"/>`,
        straw: `<ellipse cx="22" cy="24" rx="19" ry="5" fill="#E2BC77"/><path d="M14 23a8 9 0 0 1 16 0z" fill="${tint}"/><rect x="14" y="20" width="16" height="3" fill="#E8907E"/>`,
        helmet: `<path d="M8 26a14 14 0 0 1 28 0z" fill="${tint}"/><rect x="20" y="10" width="4" height="16" rx="2" fill="#FBF7F0"/><rect x="6" y="24" width="32" height="4" rx="2" fill="#D88E7E"/>`,
        propeller: `<path d="M12 28a10 10 0 0 1 20 0z" fill="${tint}"/><rect x="21" y="9" width="2" height="10" fill="#9AA2AA"/><ellipse cx="15" cy="8" rx="7" ry="2.2" fill="#E8907E"/><ellipse cx="29" cy="8" rx="7" ry="2.2" fill="#F2C46D"/>`,
        crown: `<path d="M8 26V12l7 6 7-9 7 9 7-6v14z" fill="#E4DED3"/>`,
        party: `<path d="M22 4L13 28h18z" fill="#F2C46D"/><path d="M19 12l6 2M17 18l9 3M15 24l12 3" stroke="#E8907E" stroke-width="2.4"/><circle cx="22" cy="4" r="3" fill="#8CCFB4"/>`,
        catears: `<path d="M8 28a14 14 0 0 1 28 0" fill="none" stroke="${tint}" stroke-width="3"/><path d="M9 20l3-14 8 9z" fill="${tint}"/><path d="M35 20l-3-14-8 9z" fill="${tint}"/><path d="M12 16l1-6 4 4z" fill="#E8907E"/><path d="M32 16l-1-6-4 4z" fill="#E8907E"/>`,
        chef: `<rect x="14" y="18" width="16" height="10" rx="2" fill="#FBFBFB" stroke="#DCE1E5"/><circle cx="15" cy="13" r="6" fill="#fff" stroke="#DCE1E5"/><circle cx="29" cy="13" r="6" fill="#fff" stroke="#DCE1E5"/><circle cx="22" cy="10" r="7" fill="#fff" stroke="#DCE1E5"/>`,
        cowboy: `<path d="M3 22q4 6 19 6t19-6q-4 2-8 1l-1-13q-4-3-10 0-6-3-10 0l-1 13q-4 1-8-1z" fill="#B07A4A"/><rect x="13" y="20" width="18" height="3" fill="#5A3E28"/>`,
        santa: `<path d="M9 26q2-18 18-18 6 0 6 10-3-5-6-4l3 12z" fill="#D9423B"/><rect x="7" y="24" width="28" height="6" rx="3" fill="#fff" stroke="#E6E6E6"/><circle cx="33" cy="19" r="3" fill="#fff" stroke="#E6E6E6"/>`,
        grad: `<path d="M3 14l19-8 19 8-19 8z" fill="#2B2D31"/><path d="M12 18v7q10 5 20 0v-7l-10 4z" fill="#3B3F45"/><path d="M36 15v9" stroke="#F2C46D" stroke-width="2"/><circle cx="36" cy="25" r="2" fill="#F2C46D"/>`,
        tophat: `<rect x="13" y="4" width="18" height="20" rx="2" fill="#26282C"/><rect x="13" y="19" width="18" height="4" fill="#C9423B"/><rect x="5" y="24" width="34" height="4" rx="2" fill="#26282C"/>`,
        pirate: `<path d="M3 24q19-22 38 0q-19-6-38 0z" fill="#26282C"/><path d="M5 23q17-5 34 0" stroke="#E9C46A" stroke-width="1.6" fill="none"/><circle cx="22" cy="15" r="3" fill="#fff"/>`,
        wizard: `<path d="M24 2L13 26h20z" fill="#4B5BA8"/><ellipse cx="22" cy="27" rx="18" ry="4" fill="#4B5BA8"/><circle cx="21" cy="14" r="1.6" fill="#F2C46D"/><circle cx="26" cy="20" r="1.3" fill="#F2C46D"/>`,
        viking: `<path d="M10 26a12 12 0 0 1 24 0z" fill="#9AA2AA"/><rect x="9" y="24" width="26" height="4" rx="2" fill="#B5884E"/><path d="M11 22Q3 20 5 8q2 8 8 10z" fill="#F3E9D6"/><path d="M33 22q8-2 6-14-2 8-8 10z" fill="#F3E9D6"/>`,
      };
      return s(p[key] ?? '');
    }
    case 'glasses': {
      if (key === 'star')
        return s(
          `<path d="${STAR_PATH}" transform="translate(2 5) scale(.75)" fill="${tint}"/><path d="${STAR_PATH}" transform="translate(24 5) scale(.75)" fill="${tint}"/><path d="M19 14h6" stroke="${tint}" stroke-width="2"/>`,
        );
      const fill = key === 'sun' ? '#3B3F45' : 'none';
      return s(`<circle cx="13" cy="17" r="7" fill="${fill}" stroke="${tint}" stroke-width="2.6"/><circle cx="31" cy="17" r="7" fill="${fill}" stroke="${tint}" stroke-width="2.6"/><path d="M20 16q2-2 4 0" fill="none" stroke="${tint}" stroke-width="2.4"/>`);
    }
    case 'jersey': {
      const cols = JERSEY_COLORS[key] && JERSEY_COLORS[key].length >= 3 ? JERSEY_COLORS[key] : [tint];
      const bands = cols.map((c, i) => `<rect x="9" y="${cols.length > 1 ? 13 + i * 2.4 : 15}" width="26" height="${cols.length > 1 ? 2.4 : 3.2}" fill="${c}"/>`).join('');
      const second = cols.length > 1 ? '' : `<rect x="10" y="21" width="24" height="2.6" fill="${tint}"/>`;
      return s(`<circle cx="22" cy="17" r="13" fill="#FBFBFC" stroke="#DCE1E5"/><clipPath id="jc${key}"><circle cx="22" cy="17" r="13"/></clipPath><g clip-path="url(#jc${key})">${bands}${second}</g>`);
    }
    case 'number': {
      const [bg, ring, ink] = NUMBER_ICON[key] ?? NUMBER_ICON.number;
      const shape = key === 'race' ? `<rect x="10" y="5" width="24" height="24" rx="4" fill="${bg}" stroke="${ring}" stroke-width="2.4"/>` : `<circle cx="22" cy="17" r="12" fill="${bg}" stroke="${ring}" stroke-width="2.4"/>`;
      return s(`${shape}<text x="22" y="22" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="600" font-size="13" fill="${ink}">${num}</text>`);
    }
  }
  return s('');
}
