// Etap listesi: src/levels/*.json dosyaları derleme sırasında pakete gömülür.

import type { LevelData } from './types';
import { orderKey } from './order';

const modules = import.meta.glob<LevelData>('../../levels/*.json', { eager: true, import: 'default' });

export const LEVELS: LevelData[] = Object.values(modules).sort((a, b) =>
  a.world !== b.world ? a.world - b.world : orderKey(a.id, a.world) - orderKey(b.id, b.world),
);

export function getLevel(id: string): LevelData | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function levelsOfWorld(world: number): LevelData[] {
  return LEVELS.filter((l) => l.world === world);
}

/** Etabın dünyadaki sırası (1'den başlar). */
export function levelNumber(level: LevelData): number {
  return levelsOfWorld(level.world).findIndex((l) => l.id === level.id) + 1;
}

export function nextLevel(level: LevelData): LevelData | undefined {
  const i = LEVELS.findIndex((l) => l.id === level.id);
  return i >= 0 ? LEVELS[i + 1] : undefined;
}
