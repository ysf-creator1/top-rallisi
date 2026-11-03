// Etapların yolunu değiştirmeden yıldız sürelerini yeniden hesaplar:
// her etap botla oynatılır, süreler timeTargetsFromBot() ile yazılır.
// Yoldaki eski yıldızlar da silinir (yıldızlar artık süreye göre).
// Kullanım: npx tsx scripts/retarget-levels.ts [w1]

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_AUTOPILOT, runAutopilot } from '../src/game/autopilot';
import { Simulation } from '../src/game/physics/sim';
import { timeTargetsFromBot } from '../src/config/scoring';
import type { LevelData } from '../src/game/levels/types';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'levels');
const only = process.argv[2] ?? '';

for (const f of readdirSync(DIR).filter((x) => x.endsWith('.json') && x.startsWith(only)).sort()) {
  const path = join(DIR, f);
  const level = JSON.parse(readFileSync(path, 'utf8')) as LevelData;
  const r = runAutopilot(new Simulation(level, { ball: 'standard', assist: false }), DEFAULT_AUTOPILOT, 240);
  if (!r.finished) {
    process.stdout.write(`HATA: ${level.id} bot bitiremedi\n`);
    process.exitCode = 1;
    continue;
  }
  const old = level.timeTargets;
  level.timeTargets = timeTargetsFromBot(r.time);
  delete level.stars;
  writeFileSync(path, JSON.stringify(level, null, 2) + '\n');
  process.stdout.write(`${level.id} bot ${r.time.toFixed(1)} sn  3★ ${old.gold}→${level.timeTargets.gold}  2★ ${old.silver}→${level.timeTargets.silver}\n`);
}
