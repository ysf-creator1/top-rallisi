// Kayıt sürüm geçişleri. Eski kayıtlar silinmeden yeni biçime taşınır.

import { BALL_TRAITS, type BallType } from '../config/physics';
import { TRACK_COLORS } from '../config/theme';
import { CURRENT_VERSION, DEFAULT_COSTUME, DEFAULT_SETTINGS, defaultSave, type SaveData, type SaveV1 } from './schema';

function fromV1(v1: SaveV1): SaveData {
  const s = defaultSave();
  // Sürüm 1'de sadece çift halat vardı: eski oyuncu alıştığı modla devam eder
  s.settings.control = 'ropes';
  if (v1.settings) {
    if (typeof v1.settings.sensitivity === 'number') s.settings.sensitivity = v1.settings.sensitivity;
    if (v1.settings.trackColor) s.settings.trackColor = v1.settings.trackColor;
    if (typeof v1.settings.sound === 'boolean') s.settings.sound = v1.settings.sound;
    if (typeof v1.settings.vibration === 'boolean') s.settings.vibration = v1.settings.vibration;
  }
  for (const [id, time] of Object.entries(v1.bestTimes ?? {})) {
    if (typeof time !== 'number' || !isFinite(time)) continue;
    // Süre yıldızı ve puan, etap yeniden oynanınca hesaplanır
    s.levels[id] = { completed: true, best: { time, ball: 'standard', falls: 0 }, timeStars: 0, stars: [], bonus: 0 };
  }
  return s;
}

/** Bilinmeyen/bozuk alanları varsayılanla doldurur. */
function sanitize(d: SaveData): SaveData {
  const def = defaultSave();
  const out: SaveData = {
    ...def,
    ...d,
    version: 2,
    settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) },
    costume: { ...DEFAULT_COSTUME, ...(d.costume ?? {}) },
    flags: { ...def.flags, ...(d.flags ?? {}) },
    levels: d.levels && typeof d.levels === 'object' ? d.levels : {},
  };
  // Eski varsayılan (0,5) hiç değiştirilmemişse yeni varsayılana (düşük) çek; bir kez yapılır
  if (!(d.flags as { tiltLow?: boolean } | undefined)?.tiltLow) {
    if (out.settings.tiltSensitivity === 0.5) out.settings.tiltSensitivity = DEFAULT_SETTINGS.tiltSensitivity;
    out.flags.tiltLow = true;
  }
  if (!TRACK_COLORS.some((c) => c.id === out.settings.trackColor)) out.settings.trackColor = 'black';
  const balls = Object.keys(BALL_TRAITS) as BallType[];
  out.ownedBalls = (Array.isArray(d.ownedBalls) ? d.ownedBalls : []).filter((b) => balls.includes(b));
  if (!out.ownedBalls.includes('standard')) out.ownedBalls.unshift('standard');
  if (!out.ownedBalls.includes(out.ball)) out.ball = 'standard';
  out.ownedCostumes = Array.isArray(d.ownedCostumes) ? d.ownedCostumes.filter((x) => typeof x === 'string') : [];
  out.points = typeof d.points === 'number' && isFinite(d.points) ? Math.max(0, Math.round(d.points)) : 0;
  return out;
}

/** Ham JSON'u güncel kayıt biçimine çevirir. Okunamazsa varsayılan kayıt. */
export function migrate(raw: unknown): SaveData {
  if (!raw || typeof raw !== 'object') return defaultSave();
  const v = (raw as { version?: unknown }).version;
  if (v === 1) return sanitize(fromV1(raw as SaveV1));
  if (v === CURRENT_VERSION) return sanitize(raw as SaveData);
  // Gelecekteki bir sürüm ya da tanınmayan biçim: güvenli tarafta kal
  if (typeof v === 'number' && v > CURRENT_VERSION) return sanitize(raw as SaveData);
  return defaultSave();
}
