import { describe, expect, test } from 'vitest';
import { createMemoryStore } from '../src/platform/storage';
import { migrate } from '../src/save/migrate';
import { SaveStore } from '../src/save/save';
import { CURRENT_VERSION, GHOST_PREFIX, SAVE_KEY, defaultSave } from '../src/save/schema';

describe('kayıt sürüm geçişi', () => {
  test('boş ya da bozuk kayıt varsayılana döner', () => {
    expect(migrate(null)).toEqual(defaultSave());
    expect(migrate('x')).toEqual(defaultSave());
    expect(migrate({ version: 0 })).toEqual(defaultSave());
  });

  test('sürüm 1 → 2: ayarlar ve rekorlar korunur', () => {
    const v1 = { version: 1, settings: { sensitivity: 0.8, trackColor: 'navy', sound: false }, bestTimes: { 'w1-01': 21.5, 'w1-02': 30 } };
    const s = migrate(v1);
    expect(s.version).toBe(CURRENT_VERSION);
    expect(s.settings.sensitivity).toBe(0.8);
    expect(s.settings.trackColor).toBe('navy');
    expect(s.settings.sound).toBe(false);
    expect(s.settings.control).toBe('ropes');
    expect(s.levels['w1-01'].best?.time).toBe(21.5);
    expect(s.levels['w1-01'].completed).toBe(true);
    expect(s.ownedBalls).toEqual(['standard']);
    expect(s.points).toBe(0);
  });

  test('sürüm 2: eksik alanlar tamamlanır, geçersizler düzeltilir', () => {
    const s = migrate({ version: 2, points: 120.4, settings: { trackColor: 'pembe' }, ownedBalls: ['ice', 'uçan'], ball: 'heavy' });
    expect(s.points).toBe(120);
    expect(s.settings.trackColor).toBe('black');
    expect(s.ownedBalls).toEqual(['standard', 'ice']);
    expect(s.ball).toBe('standard');
    expect(s.costume.number).toBeNull();
  });

  test('depoya yazılan kayıt geri okunur', () => {
    const store = createMemoryStore();
    const a = new SaveStore(store);
    a.update((d) => {
      d.points = 500;
      d.ownedBalls.push('rubber');
    });
    const b = new SaveStore(store);
    expect(b.data.points).toBe(500);
    expect(b.data.ownedBalls).toContain('rubber');
  });

  test('sürüm 1 kaydı depodan açılınca geçiş yapılır', () => {
    const store = createMemoryStore();
    store.set(SAVE_KEY, JSON.stringify({ version: 1, bestTimes: { 'w1-03': 40 } }));
    const s = new SaveStore(store);
    expect(s.data.version).toBe(2);
    expect(s.data.levels['w1-03'].best?.time).toBe(40);
  });

  test('sıfırlama ilerlemeyi ve hayaletleri siler, ayarları korur', () => {
    const store = createMemoryStore();
    const s = new SaveStore(store);
    s.update((d) => {
      d.points = 900;
      d.settings.trackColor = 'mint';
    });
    s.setGhost('w1-01', false, '{}');
    s.reset();
    expect(s.data.points).toBe(0);
    expect(s.data.settings.trackColor).toBe('mint');
    expect(store.keys().some((k) => k.startsWith(GHOST_PREFIX))).toBe(false);
  });
});
