// Mağaza kataloğu: top türleri ve kostüm parçaları (tarif Bölüm 7).

import type { BallType } from './physics';

export interface BallItem {
  id: BallType;
  price: number;
  /** Mağazadaki çubuklar (0..1) */
  stats: { speed: number; control: number; wind: number };
}

export const BALLS: BallItem[] = [
  { id: 'standard', price: 0, stats: { speed: 0.6, control: 0.65, wind: 0.5 } },
  { id: 'heavy', price: 900, stats: { speed: 0.4, control: 0.7, wind: 0.95 } },
  { id: 'light', price: 500, stats: { speed: 0.8, control: 0.5, wind: 0.2 } },
  { id: 'rubber', price: 1200, stats: { speed: 0.5, control: 0.9, wind: 0.55 } },
  { id: 'ice', price: 1800, stats: { speed: 0.95, control: 0.25, wind: 0.45 } },
];

export type CostumeCategory = 'color' | 'sticker' | 'hat' | 'glasses' | 'jersey' | 'number' | 'flag' | 'planet' | 'sport' | 'magic';

/** Topun yüzeyini kaplayan desen kategorileri: hepsi aynı yuvayı (skin) kullanır, biri takılır */
export const SKIN_CATEGORIES: CostumeCategory[] = ['flag', 'planet', 'sport', 'magic'];
export const isSkinCategory = (c: CostumeCategory) => SKIN_CATEGORIES.includes(c);

export interface CostumeItem {
  /** Benzersiz kimlik: "hat.cap" gibi */
  id: string;
  category: CostumeCategory;
  /** Kategori içindeki ad: "cap" */
  key: string;
  price: number;
  /** Önizleme ikonundaki renk */
  tint: string;
  /** Kilitliyse açılış koşulu (i18n anahtarı) */
  lockedText?: string;
}

const C = (category: CostumeCategory, key: string, price: number, tint: string, lockedText?: string): CostumeItem => ({
  id: `${category}.${key}`,
  category,
  key,
  price,
  tint,
  lockedText,
});

export const COSTUMES: CostumeItem[] = [
  C('color', 'coral', 100, '#F2B7A9'),
  C('color', 'sky', 100, '#BFDDF0'),
  C('color', 'lilac', 150, '#D6CCF2'),
  C('color', 'sun', 150, '#F8E2A6'),
  C('sticker', 'star', 120, '#F2C46D'),
  C('sticker', 'heart', 120, '#E8907E'),
  C('sticker', 'bolt', 180, '#B3A3E0'),
  C('sticker', 'leaf', 180, '#8CCFB4'),
  C('hat', 'cap', 250, '#8CCFB4'),
  C('hat', 'beanie', 300, '#B3A3E0'),
  C('hat', 'party', 350, '#F2C46D'),
  C('hat', 'straw', 450, '#E9C98A'),
  C('hat', 'catears', 450, '#F2B7A9'),
  C('hat', 'helmet', 600, '#F2B7A9'),
  C('hat', 'chef', 650, '#4A4F56'),
  C('hat', 'cowboy', 750, '#E9C98A'),
  C('hat', 'santa', 800, '#E8907E'),
  C('hat', 'propeller', 800, '#A8CDE8'),
  C('hat', 'grad', 900, '#3B3F45'),
  C('hat', 'tophat', 1100, '#3B3F45'),
  C('hat', 'pirate', 1300, '#3B3F45'),
  C('hat', 'wizard', 1600, '#6F86B5'),
  C('hat', 'viking', 1900, '#4A4F56'),
  C('hat', 'crown', 0, '#F2C46D', 'shop.unlockCrown'),
  C('glasses', 'round', 200, '#4A4F56'),
  C('glasses', 'sun', 300, '#3B3F45'),
  C('glasses', 'star', 400, '#E8907E'),
  C('jersey', 'coral', 200, '#F2B7A9'),
  C('jersey', 'mint', 200, '#8CCFB4'),
  C('jersey', 'navy', 250, '#6F86B5'),
  C('jersey', 'tr', 400, '#E8907E'),
  C('jersey', 'br', 450, '#8CCFB4'),
  C('jersey', 'ar', 450, '#A8CDE8'),
  C('jersey', 'de', 450, '#4A4F56'),
  C('jersey', 'fr', 450, '#6F86B5'),
  C('jersey', 'it', 450, '#8CCFB4'),
  C('jersey', 'nl', 450, '#F2C46D'),
  C('jersey', 'rainbow', 500, '#F2C46D'),
  // Numara stilleri (numara her stilde 0–99 arası seçilir)
  C('number', 'number', 150, '#E8907E'),
  C('number', 'race', 350, '#4A4F56'),
  C('number', 'neon', 800, '#3B3F45'),
  C('number', 'gold', 1500, '#F2C46D'),
  // Ülke bayrakları (topun üstünü kaplar)
  C('flag', 'tr', 600, '#E8907E'),
  C('flag', 'az', 650, '#A8CDE8'),
  C('flag', 'de', 650, '#4A4F56'),
  C('flag', 'fr', 650, '#6F86B5'),
  C('flag', 'it', 650, '#8CCFB4'),
  C('flag', 'es', 650, '#F2C46D'),
  C('flag', 'nl', 650, '#E8907E'),
  C('flag', 'jp', 700, '#E8907E'),
  C('flag', 'br', 750, '#8CCFB4'),
  C('flag', 'ar', 750, '#A8CDE8'),
  C('flag', 'gb', 800, '#6F86B5'),
  C('flag', 'us', 800, '#6F86B5'),
  // Spor topları
  C('sport', 'football', 900, '#4A4F56'),
  C('sport', 'basketball', 1000, '#E8907E'),
  C('sport', 'tennis', 1000, '#8CCFB4'),
  C('sport', 'volleyball', 1100, '#A8CDE8'),
  C('sport', 'beach', 1100, '#F2C46D'),
  C('sport', 'golf', 1200, '#4A4F56'),
  C('sport', 'billiard8', 1400, '#3B3F45'),
  C('sport', 'billiard9', 1400, '#F2C46D'),
  C('sport', 'bowling', 1800, '#6F86B5'),
  // Gezegenler
  C('planet', 'moon', 1500, '#4A4F56'),
  C('planet', 'mars', 1800, '#E8907E'),
  C('planet', 'neptune', 2000, '#6F86B5'),
  C('planet', 'earth', 2200, '#A8CDE8'),
  C('planet', 'jupiter', 2600, '#E9C98A'),
  C('planet', 'saturn', 3200, '#F2C46D'),
  C('planet', 'sun', 4000, '#F2C46D'),
  // İçinde dönen hareketli tasarımlar (cam top)
  C('magic', 'snow', 2500, '#A8CDE8'),
  C('magic', 'heart', 2800, '#E8907E'),
  C('magic', 'aquarium', 3200, '#A8CDE8'),
  C('magic', 'atom', 3800, '#B3A3E0'),
  C('magic', 'galaxy', 4800, '#B3A3E0'),
  C('magic', 'solar', 6000, '#F2C46D'),
];

export const COSTUME_CATEGORIES: CostumeCategory[] = ['hat', 'flag', 'sport', 'planet', 'magic', 'jersey', 'number', 'color', 'sticker', 'glasses'];

/** Renk kostümleri: topun renk tonu (deseni korur) */
export const COSTUME_COLORS: Record<string, string> = {
  coral: '#F6C3B7',
  sky: '#C8E2F4',
  lilac: '#DCD3F5',
  sun: '#F9E5AE',
};

export const JERSEY_COLORS: Record<string, string[]> = {
  coral: ['#F2B7A9', '#FBF7F0'],
  mint: ['#8CCFB4', '#FBF7F0'],
  navy: ['#6F86B5', '#FBF7F0'],
  rainbow: ['#E8907E', '#F2C46D', '#8CCFB4', '#A8CDE8', '#B3A3E0'],
  // Ülke formaları: üç geniş şerit
  tr: ['#E30A17', '#FBF7F0', '#E30A17'],
  br: ['#1E9E4A', '#F7D417', '#1E9E4A'],
  ar: ['#74ACDF', '#FBF7F0', '#74ACDF'],
  de: ['#2B2B2B', '#DD0000', '#FFCE00'],
  fr: ['#0055A4', '#FBF7F0', '#EF4135'],
  it: ['#009246', '#FBF7F0', '#CE2B37'],
  nl: ['#F36C21', '#FBF7F0', '#F36C21'],
};

export function getCostume(id: string): CostumeItem | undefined {
  return COSTUMES.find((c) => c.id === id);
}

/** Taç bu kadar etap bitirilince ücretsiz açılır */
export const CROWN_LEVELS = 20;
