// Geri dönme sebepleri: günün etabı, gün serisi, haftalık görevler ve günün indirimi.
// Sunucu yok: hepsi tarihten hesaplanır, herkes aynı gün aynı etabı ve indirimi görür.

import type { BallType } from '../config/physics';
import { BALLS, COSTUMES, type CostumeItem } from '../config/shop';
import type { LevelData } from './levels/types';

// ---------- Tarih ----------

/** Yerel tarih anahtarı: "2026-11-10" */
export function dayKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Anahtardan gün numarası (1970'ten beri gün; saat dilimi ve yaz saati etkilemez) */
export function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export function keyFromNumber(n: number): string {
  const d = new Date(n * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Haftanın pazartesi günü (hafta anahtarı) */
export function weekKey(day: string): string {
  const n = dayNumber(day);
  // 1970-01-01 perşembe: pazartesi = 0 olacak şekilde kaydır
  const dow = (((n + 3) % 7) + 7) % 7;
  return keyFromNumber(n - dow);
}

/** Küçük karıştırıcı: ardışık sayılar birbirinden uzak sonuç verir */
function mix(n: number): number {
  let x = (n * 0x9e3779b1) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

// ---------- Günün etabı ----------

/** Günün etabı ödülü (günde bir kez) */
export const DAILY_REWARD = 100;

/**
 * Günün etabı havuzu: Dünya 1–2 (halat koçunun çıktığı ilk üç etap hariç), yeni oyuncu da bitirebilsin.
 * Herkes oynayabilsin diye kilitli olsa da günün etabı açılır.
 */
export function dailyPool(levels: LevelData[]): LevelData[] {
  const w1 = levels.filter((l) => l.world === 1).slice(3);
  return [...w1, ...levels.filter((l) => l.world === 2)];
}

export function dailyLevel(levels: LevelData[], day: string): LevelData {
  const pool = dailyPool(levels);
  const n = dayNumber(day);
  let i = mix(n) % pool.length;
  // Dün ile aynı etap çıkmasın
  if (pool.length > 1 && i === mix(n - 1) % pool.length) i = (i + 1) % pool.length;
  return pool[i];
}

// ---------- Gün serisi ----------

export interface StreakState {
  /** Son oynanan gün (etap bitirilen) */
  last: string | null;
  count: number;
  best: number;
  /** Kaçırılan bir günü kurtaran koruma (en fazla 1) */
  shield: number;
}

export const STREAK_GIFT_DAYS = 7;
/** Bütün toplar alınmışsa hediye yerine verilen puan */
export const STREAK_GIFT_POINTS = 500;

export function defaultStreak(): StreakState {
  return { last: null, count: 0, best: 0, shield: 1 };
}

export interface StreakResult {
  streak: StreakState;
  /** Bugün seri ilk kez arttı */
  advanced: boolean;
  /** 7. gün (ve katları): hediye */
  gift: boolean;
  usedShield: boolean;
  /** Seri bozulup yeniden başladı */
  reset: boolean;
}

/** Bugün bir etap bitirildi: seriyi günceller */
export function streakAfterPlay(prev: StreakState, today: string): StreakResult {
  const s = { ...prev };
  if (s.last === today) return { streak: s, advanced: false, gift: false, usedShield: false, reset: false };
  const gap = s.last ? dayNumber(today) - dayNumber(s.last) : Infinity;
  let usedShield = false;
  let reset = false;
  if (gap === 1) s.count += 1;
  else if (gap === 2 && s.shield > 0) {
    s.shield -= 1;
    s.count += 1;
    usedShield = true;
  } else {
    reset = s.count > 0;
    s.count = 1;
  }
  s.last = today;
  s.best = Math.max(s.best, s.count);
  const gift = s.count % STREAK_GIFT_DAYS === 0;
  // Her 7 günde koruma yenilenir
  if (gift) s.shield = 1;
  return { streak: s, advanced: true, gift, usedShield, reset };
}

/** Ekranda görünen seri: kaçırılan gün koruma ile kurtarılamıyorsa 0 */
export function visibleStreak(s: StreakState, today: string): { count: number; playedToday: boolean; atRisk: boolean } {
  if (!s.last) return { count: 0, playedToday: false, atRisk: false };
  const gap = dayNumber(today) - dayNumber(s.last);
  if (gap <= 0) return { count: s.count, playedToday: true, atRisk: false };
  if (gap === 1) return { count: s.count, playedToday: false, atRisk: false };
  if (gap === 2 && s.shield > 0) return { count: s.count, playedToday: false, atRisk: true };
  return { count: 0, playedToday: false, atRisk: false };
}

/** Seri hediyesi: en ucuz, henüz alınmamış top. Hepsi varsa null (puan verilir). */
export function giftBall(owned: BallType[]): BallType | null {
  const list = BALLS.filter((b) => b.price > 0 && !owned.includes(b.id)).sort((a, b) => a.price - b.price);
  return list[0]?.id ?? null;
}

// ---------- Haftalık görevler ----------

export type GoalKind = 'stars3' | 'nofall' | 'finish' | 'record' | 'daily' | 'ghost' | 'points' | 'newlevel';

export interface GoalDef {
  id: GoalKind;
  target: number;
  reward: number;
}

export const GOAL_POOL: GoalDef[] = [
  { id: 'stars3', target: 3, reward: 200 },
  { id: 'nofall', target: 3, reward: 150 },
  { id: 'finish', target: 8, reward: 150 },
  { id: 'record', target: 3, reward: 200 },
  { id: 'daily', target: 3, reward: 200 },
  { id: 'ghost', target: 2, reward: 150 },
  { id: 'points', target: 400, reward: 150 },
  { id: 'newlevel', target: 3, reward: 200 },
];

export const GOALS_PER_WEEK = 3;

/** Bu haftanın görevleri (herkes için aynı) */
export function weeklyGoals(week: string): GoalDef[] {
  const n = dayNumber(week);
  const pool = [...GOAL_POOL];
  const out: GoalDef[] = [];
  let seed = mix(n);
  while (out.length < GOALS_PER_WEEK && pool.length) {
    const i = seed % pool.length;
    out.push(pool.splice(i, 1)[0]);
    seed = mix(seed + 1);
  }
  return out;
}

export interface WeeklyState {
  week: string | null;
  progress: Partial<Record<GoalKind, number>>;
  /** Sayılan etaplar / günler (aynısı iki kez sayılmasın) */
  seen: Partial<Record<GoalKind, string[]>>;
  /** Ödülü verilmiş görevler */
  done: GoalKind[];
}

export function defaultWeekly(): WeeklyState {
  return { week: null, progress: {}, seen: {}, done: [] };
}

/** Bitirilen bir etabın görevlere etkisi */
export interface RunFacts {
  levelId: string;
  timeStars: number;
  falls: number;
  /** Önceki rekor vardı ve kırıldı */
  beatRecord: boolean;
  /** Etap ilk kez bitirildi */
  firstClear: boolean;
  earned: number;
  daily: boolean;
  /** Hayaletle yarışta hayaletten hızlı bitirildi */
  ghostWin: boolean;
}

export interface WeeklyResult {
  weekly: WeeklyState;
  /** Bu etapla tamamlanan görevler (ödülü verilecek) */
  completed: GoalDef[];
}

export function weeklyAfterRun(prev: WeeklyState, today: string, run: RunFacts): WeeklyResult {
  const week = weekKey(today);
  const w: WeeklyState =
    prev.week === week
      ? { week, progress: { ...prev.progress }, seen: Object.fromEntries(Object.entries(prev.seen).map(([k, v]) => [k, [...(v ?? [])]])), done: [...prev.done] }
      : { ...defaultWeekly(), week };
  const add = (k: GoalKind, n = 1) => (w.progress[k] = (w.progress[k] ?? 0) + n);
  const addOnce = (k: GoalKind, key: string) => {
    const list = (w.seen[k] ??= []);
    if (list.includes(key)) return;
    list.push(key);
    add(k);
  };
  if (run.timeStars >= 3) addOnce('stars3', run.levelId);
  if (run.falls === 0) add('nofall');
  add('finish');
  if (run.beatRecord) add('record');
  if (run.daily) addOnce('daily', today);
  if (run.ghostWin) add('ghost');
  if (run.earned > 0) add('points', run.earned);
  if (run.firstClear) add('newlevel');
  const completed: GoalDef[] = [];
  for (const g of weeklyGoals(week)) {
    if (w.done.includes(g.id)) continue;
    if ((w.progress[g.id] ?? 0) >= g.target) {
      w.done.push(g.id);
      completed.push(g);
    }
  }
  return { weekly: w, completed };
}

/** Görev ilerlemesi (hafta değiştiyse sıfır) */
export function goalProgress(w: WeeklyState, today: string, g: GoalDef): { n: number; done: boolean } {
  if (w.week !== weekKey(today)) return { n: 0, done: false };
  return { n: Math.min(g.target, w.progress[g.id] ?? 0), done: w.done.includes(g.id) };
}

/** Yeni görevlere kalan gün (pazartesi) */
export function daysToNextWeek(today: string): number {
  return dayNumber(weekKey(today)) + 7 - dayNumber(today);
}

// ---------- Günün indirimi ----------

export const SALE_COUNT = 2;
export const SALE_DISCOUNT = 0.3;

/** Bugün indirimdeki kostümler (herkes için aynı) */
export function dailySale(day: string): CostumeItem[] {
  const pool = COSTUMES.filter((c) => c.price >= 200 && !c.lockedText);
  const n = dayNumber(day);
  const out: CostumeItem[] = [];
  let seed = mix(n * 7 + 3);
  while (out.length < SALE_COUNT) {
    const it = pool[seed % pool.length];
    if (!out.includes(it)) out.push(it);
    seed = mix(seed + 11);
  }
  return out;
}

/** İndirimli fiyat (10'a yuvarlanır) */
export function salePrice(price: number): number {
  return Math.round((price * (1 - SALE_DISCOUNT)) / 10) * 10;
}

/** Kostümün bugünkü fiyatı */
export function priceToday(it: CostumeItem, day: string): number {
  return dailySale(day).some((s) => s.id === it.id) ? salePrice(it.price) : it.price;
}
