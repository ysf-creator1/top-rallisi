// Süre yıldızları, puan ve kilit kuralları (tarif Bölüm 6, 8.1, 10).

import { ASSIST } from './physics';

export interface TimeTargets {
  bronze: number;
  silver: number;
  gold: number;
}

/** Taban puan: süre yıldızı sayısına göre [0, 1, 2, 3] */
export const BASE_POINTS = [0, 50, 80, 120];
/** Toplanan her yıldız için ek puan */
export const STAR_POINTS = 20;
/** Bronz süreden kazanılan her saniye için bonus */
export const TIME_BONUS_PER_SEC = 2;

/** Dünya kilidi: o dünyayı açmak için gereken toplam yıldız */
/** Dünya kilidi: yoldan toplanan yıldız sayısı (süre madalyaları sayılmaz) */
export const WORLD_UNLOCK: Record<number, number> = { 1: 0, 2: 10, 3: 25, 4: 40 };
/** Oynanabilir dünyalar (ilk sürüm) */
export const PLAYABLE_WORLDS = [1, 2, 3, 4];
/** Haritada "Yakında" olarak görünen dünyalar */
export const SOON_WORLDS: number[] = [];
/** Bu dünyalar, yıldız yetmese de önceki dünyanın bütün etapları bitince de açılır */
export const UNLOCK_BY_COMPLETION = [4];
export const LEVELS_PER_WORLD = 10;

/** Süre yıldızı: bitirmek 1, gümüş 2, altın 3 (yardım modunda en fazla 2). */
export function timeStars(time: number, targets: TimeTargets, assist: boolean): number {
  let s = 1;
  if (time <= targets.silver) s = 2;
  if (time <= targets.gold) s = 3;
  if (assist) s = Math.min(s, ASSIST.maxTimeStars);
  return s;
}

export function timeBonus(time: number, targets: TimeTargets): number {
  return Math.round(Math.max(0, targets.bronze - time) * TIME_BONUS_PER_SEC);
}

/** Bir sonucun toplam puan değeri (ödeme farkla yapılır). */
export function scoreValue(tStars: number, collected: number, bonus: number): number {
  return BASE_POINTS[tStars] + collected * STAR_POINTS + bonus;
}

export interface LevelBest {
  /** En iyi süre yıldızı */
  timeStars: number;
  /** Toplanan yıldızlar (etap boyunca hangileri) */
  stars: boolean[];
  /** En iyi zaman bonusu (puan) */
  bonus: number;
}

/**
 * Yeni sonuçla kazanılan puan: sadece ilk kez kazanılan yıldızlar ve
 * rekor kırıldığında bonus farkı ödenir (tarif 6.2).
 */
export function pointsEarned(prev: LevelBest | undefined, tStars: number, starsNow: boolean[], bonus: number): number {
  const prevT = prev?.timeStars ?? 0;
  const prevStars = prev?.stars ?? [];
  const prevBonus = prev?.bonus ?? 0;
  let pts = 0;
  if (tStars > prevT) pts += BASE_POINTS[tStars] - BASE_POINTS[prevT];
  for (let i = 0; i < starsNow.length; i++) {
    if (starsNow[i] && !prevStars[i]) pts += STAR_POINTS;
  }
  if (bonus > prevBonus) pts += bonus - prevBonus;
  return pts;
}

/** Bir sonraki süre yıldızı için gereken iyileşme (sn). Yoksa null. */
export function nextTimeStarGap(
  time: number,
  targets: TimeTargets,
  assist: boolean,
): { star: 'silver' | 'gold'; gap: number } | null {
  const s = timeStars(time, targets, assist);
  const cap = assist ? ASSIST.maxTimeStars : 3;
  if (s >= cap) return null;
  if (s === 1) return { star: 'silver', gap: time - targets.silver };
  return { star: 'gold', gap: time - targets.gold };
}
