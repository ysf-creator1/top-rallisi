// Kayıt deposu: okuma, yazma, sıfırlama. Tarayıcı erişimi platform/storage üzerinden.

import { storage as defaultStore, type KeyValueStore } from '../platform/storage';
import { migrate } from './migrate';
import { GHOST_PREFIX, SAVE_KEY, defaultSave, type SaveData } from './schema';

export class SaveStore {
  data: SaveData;
  private listeners = new Set<(d: SaveData) => void>();

  constructor(private store: KeyValueStore = defaultStore) {
    this.data = this.load();
  }

  load(): SaveData {
    const raw = this.store.get(SAVE_KEY);
    if (!raw) return defaultSave();
    try {
      return migrate(JSON.parse(raw));
    } catch {
      return defaultSave();
    }
  }

  save(): void {
    this.store.set(SAVE_KEY, JSON.stringify(this.data));
    for (const l of this.listeners) l(this.data);
  }

  update(fn: (d: SaveData) => void): void {
    fn(this.data);
    this.save();
  }

  onChange(fn: (d: SaveData) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  reset(): void {
    const settings = this.data.settings;
    this.data = defaultSave();
    // Ayarlar korunur, ilerleme silinir
    this.data.settings = settings;
    for (const k of this.store.keys()) if (k.startsWith(GHOST_PREFIX)) this.store.remove(k);
    this.save();
  }

  getGhost(levelId: string, assist: boolean): string | null {
    return this.store.get(GHOST_PREFIX + levelId + (assist ? '.a' : ''));
  }

  setGhost(levelId: string, assist: boolean, json: string): void {
    this.store.set(GHOST_PREFIX + levelId + (assist ? '.a' : ''), json);
  }
}
