// Kayıt biçimi. Sürüm değişince migrate.ts içine geçiş eklenir.

import type { BallType } from '../config/physics';
import type { TrackColorId } from '../config/theme';
import { defaultStreak, defaultWeekly, type StreakState, type WeeklyState } from '../game/meta';

export const CURRENT_VERSION = 2;
export const SAVE_KEY = 'top-rallisi.save';
export const GHOST_PREFIX = 'top-rallisi.ghost.';

export type ControlMode = 'ropes' | 'tilt';

export interface Settings {
  control: ControlMode;
  ropeSide: 'left' | 'right';
  /** Halat hassasiyeti 0..1 (0,5 = orta) */
  sensitivity: number;
  /** Eğim duyarlılığı 0..1 */
  tiltSensitivity: number;
  /** Eğim kalibrasyonu (derece) */
  tiltOffset: number;
  trackColor: TrackColorId;
  assist: boolean;
  vibration: boolean;
  sound: boolean;
}

export interface RunRecord {
  time: number;
  ball: BallType;
  falls: number;
}

export interface LevelRecord {
  completed: boolean;
  /** Normal moddaki en iyi süre */
  best?: RunRecord;
  /** Yardım modundaki en iyi süre (ayrı tutulur) */
  bestAssist?: RunRecord;
  /** Puan için: en iyi süre yıldızı, toplanan yıldızlar, en iyi bonus */
  timeStars: number;
  stars: boolean[];
  bonus: number;
}

export interface Costume {
  color: string | null;
  sticker: string | null;
  hat: string | null;
  glasses: string | null;
  jersey: string | null;
  /** Ralli numarası (null = yok) */
  number: number | null;
  /** Numara stili: number (klasik), race, neon, gold */
  numberStyle: string | null;
  /** Yüzeyi kaplayan desen: bayrak, gezegen, spor topu ya da hareketli cam top */
  skin: string | null;
}

export interface SaveData {
  version: 2;
  settings: Settings;
  points: number;
  levels: Record<string, LevelRecord>;
  ownedBalls: BallType[];
  ball: BallType;
  ownedCostumes: string[];
  costume: Costume;
  /** Gün serisi (etap bitirilen ardışık günler) */
  streak: StreakState;
  /** Bu haftanın görev ilerlemesi */
  weekly: WeeklyState;
  /** Günün etabı ödülünün alındığı son gün */
  dailyDone: string | null;
  /** Gizli yıldızı bulunan etaplar */
  secrets: string[];
  flags: { a2hsShown: boolean; hintRopes: boolean; hintTilt: boolean; /** Eğim duyarlılığı varsayılanı düşüğe çekildi */ tiltLow: boolean; /** İlk açılışta kontrol seçimi (eğim / çift halat) yapıldı */ controlChosen: boolean };
}

export const DEFAULT_SETTINGS: Settings = {
  // Telefonu eğmek daha kolay: yeni oyuncular bununla başlar (ilk açılışta seçim kartı da çıkar)
  control: 'tilt',
  ropeSide: 'right',
  sensitivity: 0.5,
  tiltSensitivity: 0.2,
  tiltOffset: 0,
  trackColor: 'black',
  assist: false,
  vibration: true,
  sound: true,
};

export const DEFAULT_COSTUME: Costume = {
  color: null,
  sticker: null,
  hat: null,
  glasses: null,
  jersey: null,
  number: null,
  numberStyle: null,
  skin: null,
};

export function defaultSave(): SaveData {
  return {
    version: 2,
    settings: { ...DEFAULT_SETTINGS },
    points: 0,
    levels: {},
    ownedBalls: ['standard'],
    ball: 'standard',
    ownedCostumes: [],
    costume: { ...DEFAULT_COSTUME },
    streak: defaultStreak(),
    weekly: defaultWeekly(),
    dailyDone: null,
    secrets: [],
    flags: { a2hsShown: false, hintRopes: false, hintTilt: false, tiltLow: true, controlChosen: false },
  };
}

/** Faz 1 kayıt biçimi (sürüm 1) */
export interface SaveV1 {
  version: 1;
  settings?: { sensitivity?: number; trackColor?: TrackColorId; sound?: boolean; vibration?: boolean };
  bestTimes?: Record<string, number>;
}
