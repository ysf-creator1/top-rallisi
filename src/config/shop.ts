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

export type CostumeCategory = 'color' | 'sticker' | 'hat' | 'glasses' | 'jersey' | 'number';

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
  C('hat', 'straw', 450, '#E9C98A'),
  C('hat', 'helmet', 600, '#F2B7A9'),
  C('hat', 'propeller', 800, '#A8CDE8'),
  C('hat', 'crown', 0, '#F2C46D', 'shop.unlockW4'),
  C('glasses', 'round', 200, '#4A4F56'),
  C('glasses', 'sun', 300, '#3B3F45'),
  C('glasses', 'star', 400, '#E8907E'),
  C('jersey', 'coral', 200, '#F2B7A9'),
  C('jersey', 'mint', 200, '#8CCFB4'),
  C('jersey', 'navy', 250, '#6F86B5'),
  C('jersey', 'rainbow', 500, '#F2C46D'),
  C('number', 'number', 150, '#E8907E'),
];

export const COSTUME_CATEGORIES: CostumeCategory[] = ['color', 'sticker', 'hat', 'glasses', 'jersey', 'number'];

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
};

export function getCostume(id: string): CostumeItem | undefined {
  return COSTUMES.find((c) => c.id === id);
}
