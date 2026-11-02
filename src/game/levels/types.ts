// Etap JSON formatı (tarif Bölüm 9)

export interface RoadPoint {
  x: number;
  y: number;
  /** Bu noktadaki yol genişliği */
  w: number;
}

export interface Branch {
  type: 'short' | 'long';
  /** İlk ve son nokta ana yolun üzerinde olmalı (ayrılma ve birleşme yeri) */
  points: RoadPoint[];
}

export interface VacuumZone {
  x: number;
  y: number;
  radius: number;
  strength: number;
}

export interface WindZone {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Eksi: sola, artı: sağa */
  force: number;
  /** Nabız periyodu (sn). Yoksa sabit rüzgâr */
  pulse?: number;
}

export interface Magnet {
  x: number;
  y: number;
  radius: number;
  strength: number;
  /** [açık sn, kapalı sn] — yoksa hep açık */
  onOff?: [number, number];
}

/** Düşürme deliği: topun merkezi içine girerse top düşer (bitiş deliği değil) */
export interface TrapHole {
  x: number;
  y: number;
  r: number;
}

/** Dönen kol: (x, y) göbeğin yeri. Kola değen top düşer. */
export interface SpinArm {
  x: number;
  y: number;
  /** Göbekten kol ucuna uzunluk */
  length: number;
  /** Dönüş hızı (radyan/sn). Eksi: saat yönünde */
  speed: number;
  /** Başlangıç açısı (radyan) */
  phase?: number;
  /** Kol sayısı (1 ya da 2, varsayılan 2) */
  blades?: number;
}

/** Fırlatıcı: belli aralıklarla zeminden yükselir, üstündeki topu fırlatır. */
export interface Popper {
  x: number;
  y: number;
  r: number;
  /** Bir tur süresi (sn) */
  period: number;
  /** Yukarıda kalma süresi (sn, varsayılan 0,5) */
  up?: number;
  /** Tur kayması (sn) */
  offset?: number;
}

export interface Sign {
  x: number;
  y: number;
  /** i18n anahtarı: 'sign.short' | 'sign.safe' */
  text: string;
}

export interface LevelData {
  id: string;
  name: string;
  world: number;
  height: number;
  boardWidth: number;
  road: RoadPoint[];
  branches?: Branch[];
  finishHole: { x: number; y: number; r: number };
  checkpoints?: number[];
  stars?: { x: number; y: number }[];
  vacuum?: VacuumZone[];
  wind?: WindZone[];
  magnets?: Magnet[];
  signs?: Sign[];
  holes?: TrapHole[];
  arms?: SpinArm[];
  poppers?: Popper[];
  timeTargets: { bronze: number; silver: number; gold: number };
}
