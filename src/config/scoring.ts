// Süre yıldızları, puan ve kilit kuralları (tarif Bölüm 6, 8.1, 10).

import { ASSIST } from './physics';

export interface TimeTargets {
  bronze: number;
  silver: number;
  gold: number;
}

/** Taban puan: yıldız sayısına göre [0, 1, 2, 3] (yoldan yıldız toplama kalkınca artırıldı) */
export const BASE_POINTS = [0, 60, 120, 180];
/** Eski kayıtlardaki yoldan toplanmış yıldızlar için puan (artık yeni yıldız toplanmıyor) */
export const STAR_POINTS = 20;
/** Bronz süreden kazanılan her saniye için bonus */
export const TIME_BONUS_PER_SEC = 2;

/**
 * Dünya kilidi: o dünyayı açmak için gereken toplam yıldız (her etapta en çok 3,
 * bitiren en az 1 yıldız alır). Bir dünyada 15 etap var, yani en çok 45 yıldız.
 */
export const WORLD_UNLOCK: Record<number, number> = { 1: 0, 2: 20, 3: 50, 4: 85, 5: 125, 6: 165 };
/** Oynanabilir dünyalar */
export const PLAYABLE_WORLDS = [1, 2, 3, 4, 5, 6];
/** Haritada "Yakında" olarak görünen dünyalar */
export const SOON_WORLDS: number[] = [];
/** Bu dünyalar, yıldız yetmese de önceki dünyanın bütün etapları bitince de açılır */
export const UNLOCK_BY_COMPLETION = [2, 3, 4, 5, 6];
export const LEVELS_PER_WORLD = 15;

/**
 * Bot süresinden yıldız süreleri (5 sn'ye yukarı yuvarlanır, akılda kalsın):
 * 3 yıldız bot ×1,5, 2 yıldız bot ×2,1. "bronze" sadece zaman bonusu için (bot ×3).
 */
export function timeTargetsFromBot(bot: number): TimeTargets {
  const up5 = (x: number) => Math.ceil(x / 5 - 1e-9) * 5;
  const gold = up5(bot * 1.5);
  const silver = Math.max(gold + 5, up5(bot * 2.1));
  const bronze = Math.max(silver + 5, up5(bot * 3));
  return { gold, silver, bronze };
}

/** Yıldız: bitirmek 1, "silver" süresi 2, "gold" süresi 3 (yardım modunda en fazla 2). */
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
