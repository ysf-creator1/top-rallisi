// Bütün fizik sabitleri burada. Geliştirici paneli (?dev=1) bu nesneyi canlı değiştirir.
// Birimler: etap birimi (tahta genişliği 1000 birim), saniye.

export interface PhysicsConfig {
  /** Sabit fizik adımı (Hz) */
  stepHz: number;
  /** Oyun yerçekimi (birim/sn²) */
  gravity: number;
  /** Dolu küre yuvarlanma katsayısı (5/7) */
  rollFactor: number;
  /** Hıza orantılı sürtünme (1/sn) */
  friction: number;
  /** Uç duvarlarına çarpınca sekme katsayısı */
  restitution: number;
  /** Top yarıçapı (birim) */
  ballRadius: number;
  /** Çukur derinliği, top çapına oranla */
  sagRatio: number;
  /** Uç duvarı yüksekliği, top çapına oranla */
  wallRatio: number;
  /** Çubuk en fazla eğim (derece) */
  maxTiltDeg: number;
  /** Çubuk ucu en yüksek hızı (birim/sn) */
  endSpeed: number;
  /** Hedef, gerçek uçtan en fazla bu kadar önde olabilir (birim) */
  maxLead: number;
  /** Topun en yüksek hızı (birim/sn) */
  maxBallSpeed: number;
  /** Halat hassasiyeti: 1 piksel çekme = kaç birim */
  ropeSensitivity: number;
  /** Eğim modunda telefon eğimi çarpanı */
  tiltSensitivity: number;
  /** Topun toplanabilir yıldızı alma mesafesi (birim) */
  starPickupRadius: number;
  /** Vakum bölgesi kuvvet ölçeği (birim/sn²) */
  vacuumForce: number;
  /** Rüzgâr kuvvet ölçeği (birim/sn²) */
  windForce: number;
  /** Mıknatıs kuvvet ölçeği (birim/sn²) */
  magnetForce: number;
}

export const DEFAULT_PHYSICS: PhysicsConfig = {
  stepHz: 120,
  gravity: 3200,
  rollFactor: 5 / 7,
  friction: 0.55,
  restitution: 0.35,
  ballRadius: 40,
  sagRatio: 0.6,
  wallRatio: 1.0,
  maxTiltDeg: 25,
  endSpeed: 700,
  maxLead: 90,
  maxBallSpeed: 1500,
  ropeSensitivity: 2.6,
  tiltSensitivity: 1.0,
  starPickupRadius: 70,
  vacuumForce: 900,
  windForce: 900,
  magnetForce: 1100,
};

/** Canlı değiştirilebilen tek kopya. */
export const physics: PhysicsConfig = { ...DEFAULT_PHYSICS };

export function resetPhysics(): void {
  Object.assign(physics, DEFAULT_PHYSICS);
}

/** Yardım modu çarpanları (tarif Bölüm 10) */
export const ASSIST = {
  vacuumMultiplier: 1.5,
  /** Yardım modunda vakum gücü en az bu kadar (dünya ayarı ne olursa olsun) */
  vacuumMinStrength: 0.45,
  maxSpeedMultiplier: 0.7,
  hazardMultiplier: 0.5,
  minCheckpoints: 3,
  maxTimeStars: 2,
};

/** Dünyaya göre vakum gücü çarpanı (Dünya 3'ten sonra yok) */
export const WORLD_VACUUM: Record<number, number> = { 1: 1, 2: 0.7, 3: 0.4 };

/** Top türleri: oyun hissini değiştiren katsayılar (tarif 7.1) */
export type BallType = 'standard' | 'heavy' | 'light' | 'rubber' | 'ice';

export interface BallTraits {
  /** Yerçekimi ivmesi çarpanı (hızlanma) */
  gravityScale: number;
  /** Sürtünme çarpanı */
  frictionScale: number;
  /** Sekme katsayısı çarpanı */
  restitutionScale: number;
  /** Kütle: rüzgâr ve mıknatıs etkisini böler */
  mass: number;
}

export const BALL_TRAITS: Record<BallType, BallTraits> = {
  standard: { gravityScale: 1, frictionScale: 1, restitutionScale: 1, mass: 1 },
  heavy: { gravityScale: 0.8, frictionScale: 1.1, restitutionScale: 0.6, mass: 2.2 },
  light: { gravityScale: 1.2, frictionScale: 0.9, restitutionScale: 1.3, mass: 0.55 },
  rubber: { gravityScale: 0.95, frictionScale: 2.2, restitutionScale: 1.6, mass: 1.1 },
  ice: { gravityScale: 1.1, frictionScale: 0.18, restitutionScale: 0.9, mass: 0.9 },
};
