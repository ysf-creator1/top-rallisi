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
  timeTargets: { bronze: number; silver: number; gold: number };
}
