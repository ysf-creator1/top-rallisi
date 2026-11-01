// Kalıcı kayıt erişimi. Şimdilik localStorage; ileride Capacitor/Supabase'e bağlanabilir.

export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): boolean;
  remove(key: string): void;
  keys(): string[];
}

class MemoryStore implements KeyValueStore {
  private m = new Map<string, string>();
  get(k: string) {
    return this.m.get(k) ?? null;
  }
  set(k: string, v: string) {
    this.m.set(k, v);
    return true;
  }
  remove(k: string) {
    this.m.delete(k);
  }
  keys() {
    return [...this.m.keys()];
  }
}

class LocalStore implements KeyValueStore {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  }
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
      return true;
    } catch {
      return false;
    }
  }
  remove(k: string) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* yok say */
    }
  }
  keys() {
    try {
      const out: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) out.push(k);
      }
      return out;
    } catch {
      return [];
    }
  }
}

function pick(): KeyValueStore {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__tr_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return new LocalStore();
    }
  } catch {
    /* gizli sekme vb. */
  }
  return new MemoryStore();
}

export const storage: KeyValueStore = pick();
export function createMemoryStore(): KeyValueStore {
  return new MemoryStore();
}
