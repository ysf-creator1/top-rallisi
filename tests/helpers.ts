import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { LevelData } from '../src/game/levels/types';

const DIR = join(import.meta.dirname, '..', 'src', 'levels');

export function allLevels(): LevelData[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as LevelData);
}

export function getLevel(id: string): LevelData {
  const l = allLevels().find((x) => x.id === id);
  if (!l) throw new Error('etap yok: ' + id);
  return l;
}
