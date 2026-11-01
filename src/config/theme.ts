// Sahne ve arayüz renkleri (docs/TASARIM_REHBERI.md). Sahne renkleri temadan okunur.

export type ThemeId = 'gunduz' | 'aksam';

export interface SceneTheme {
  id: ThemeId;
  sky: [string, string, string];
  sunGlow: string;
  sunDisc: string;
  hills: string;
  hillsFar: string;
  treesFar: string;
  treesNear: string;
  treesNearShade: string;
  treesHighlight: string;
  trunk: string;
  grass: [string, string];
  path: string;
  standLight: string;
  standDark: string;
  base: string;
  baseTop: string;
  fog: string;
  hemiSky: string;
  hemiGround: string;
  sunColor: string;
  sunIntensity: number;
  hemiIntensity: number;
  exposure: number;
  lampGlow: string;
  lampOn: boolean;
  /** Arayüz vurgu rengi */
  accent: string;
  accentText: string;
  flag: string;
}

export const THEMES: Record<ThemeId, SceneTheme> = {
  gunduz: {
    id: 'gunduz',
    sky: ['#C7E2EE', '#E4EEEA', '#F4EEE1'],
    sunGlow: '#FFF8E4',
    sunDisc: '#FFF9EC',
    hills: '#CADFC6',
    hillsFar: '#D3E5D4',
    treesFar: '#A9CAA7',
    treesNear: '#8DB99A',
    treesNearShade: '#7FAE8D',
    treesHighlight: '#A3C9AC',
    trunk: '#9C8676',
    grass: ['#BFE0A8', '#B5DA9D'],
    path: '#EFE6D3',
    standLight: '#F2B7A9',
    standDark: '#D88E7E',
    base: '#3A3D42',
    baseTop: '#565A61',
    fog: '#E8EFE8',
    hemiSky: '#C7E2EE',
    hemiGround: '#BFE0A8',
    sunColor: '#FFF4E2',
    sunIntensity: 2.1,
    hemiIntensity: 1.55,
    exposure: 1.0,
    lampGlow: '#F7EFD9',
    lampOn: false,
    accent: '#8CCFB4',
    accentText: '#23302A',
    flag: '#E8907E',
  },
  aksam: {
    id: 'aksam',
    sky: ['#C9C1E8', '#EBCFD6', '#F8E0CC'],
    sunGlow: '#FFE3C8',
    sunDisc: '#FFEBD6',
    hills: '#BDB6D6',
    hillsFar: '#CBC3DF',
    treesFar: '#9FB9BA',
    treesNear: '#86A7A6',
    treesNearShade: '#7A9B9A',
    treesHighlight: '#A3BFBF',
    trunk: '#8E7B78',
    grass: ['#BCD3AE', '#B2CBA3'],
    path: '#EEDFD3',
    standLight: '#F0E2C9',
    standDark: '#D2BC98',
    base: '#3A3946',
    baseTop: '#585669',
    fog: '#E9D6DC',
    hemiSky: '#C9C1E8',
    hemiGround: '#BCD3AE',
    sunColor: '#FFD9BC',
    sunIntensity: 1.7,
    hemiIntensity: 1.5,
    exposure: 0.98,
    lampGlow: '#FFE8BE',
    lampOn: true,
    accent: '#B3A3E0',
    accentText: '#36334A',
    flag: '#B3A3E0',
  },
};

/** Dünyaya göre tema (Dünya 4 akşam). */
export function themeForWorld(world: number): ThemeId {
  return world >= 4 ? 'aksam' : 'gunduz';
}

export type TrackColorId = 'black' | 'anthracite' | 'navy' | 'forest' | 'burgundy' | 'walnut' | 'lavender' | 'mint';

export const TRACK_COLORS: { id: TrackColorId; hex: string }[] = [
  { id: 'black', hex: '#2E3136' },
  { id: 'anthracite', hex: '#4A4F57' },
  { id: 'navy', hex: '#2F3E5C' },
  { id: 'forest', hex: '#33503F' },
  { id: 'burgundy', hex: '#5C2E36' },
  { id: 'walnut', hex: '#5A4334' },
  { id: 'lavender', hex: '#A99AD6' },
  { id: 'mint', hex: '#9FD3C0' },
];

export function trackHex(id: TrackColorId): string {
  return (TRACK_COLORS.find((c) => c.id === id) ?? TRACK_COLORS[0]).hex;
}

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** Rengi beyaza doğru açar (amount: 0..1). */
export function lighten(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  return toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/** Rengi siyaha doğru koyulaştırır. */
export function darken(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  return toHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

/** Göreli parlaklık (0..1) */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export interface TrackPalette {
  fill: string;
  edge: string;
  shadow: string;
  /** Top çevresine kontur gerekir mi (açık parkur) */
  needsContour: boolean;
}

/** Parkur renginden kenar ve gölge tonlarını türetir (rehber 2.4). */
export function trackPalette(hex: string): TrackPalette {
  const lum = luminance(hex);
  // Beyaz topun parlaklığı ~0.9; kontrast oranı düşükse kontur ekle
  const contrast = (0.9 + 0.05) / (lum + 0.05);
  return {
    fill: hex,
    edge: lum > 0.3 ? darken(hex, 0.12) : lighten(hex, 0.15),
    shadow: 'rgba(44, 58, 42, 0.32)',
    needsContour: contrast < 3,
  };
}

export const UI = {
  bg: '#F6F1E8',
  text: '#3B3F45',
  muted: '#6A7078',
  mint: '#8CCFB4',
  coral: '#E8907E',
  gold: '#F2C46D',
};
