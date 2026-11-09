import { describe, expect, it } from 'vitest';
import { ANALYTICS } from '../src/config/analytics';
import { Tracker, fsValue, parseUA, type Batch, type Sender } from '../src/platform/analytics';
import { createMemoryStore } from '../src/platform/storage';

function setup(result: 'ok' | 'drop' | 'retry' = 'ok') {
  let now = 1_000_000;
  const sent: { id: string; batch: Batch }[] = [];
  const mode = { result };
  const sender: Sender = async (id, batch) => {
    if (mode.result === 'ok') sent.push({ id, batch: structuredClone(batch) });
    return mode.result;
  };
  const store = createMemoryStore();
  const tr = new Tracker(sender, '1.0.0', () => now, store);
  return { tr, sent, store, mode, tick: (ms: number) => (now += ms) };
}

describe('istatistik', () => {
  it('oyuncu kimliği kalıcıdır', () => {
    const store = createMemoryStore();
    const a = new Tracker(async () => 'ok', '1', () => 0, store);
    const b = new Tracker(async () => 'ok', '1', () => 0, store);
    expect(a.pid).toHaveLength(16);
    expect(b.pid).toBe(a.pid);
  });

  it('olaylar toplu gönderilir, cihaz ve konum bir kez eklenir', async () => {
    const { tr, sent, tick } = setup();
    tr.startSession();
    tr.setDevice({ os: 'iOS' });
    tr.setGeo({ city: 'İstanbul', cc: 'TR' });
    tick(5000);
    tr.track('ls', { lvl: 'w1-01' });
    await tr.flush();
    tick(30_000);
    tr.track('le', { lvl: 'w1-01', time: 12.5 });
    await tr.flush();
    expect(sent).toHaveLength(2);
    expect(sent[0].id).toBe(`${tr.sid}-0`);
    expect(sent[0].batch.events.map((e) => e.e)).toEqual(['start', 'ls']);
    expect(sent[0].batch.events[1].t).toBe(5000);
    expect(sent[0].batch.dev).toEqual({ os: 'iOS' });
    expect(sent[0].batch.geo?.city).toBe('İstanbul');
    expect(sent[1].batch.dev).toBeUndefined();
    expect(sent[1].batch.seq).toBe(1);
    expect(sent[1].batch.active).toBe(35);
  });

  it('gizli kalınan süre aktif süreye eklenmez; uzun aradan sonra yeni oturum', async () => {
    const { tr, sent, tick } = setup();
    tr.startSession();
    tick(10_000);
    tr.hidden();
    tick(60_000);
    tr.visible();
    tick(5_000);
    expect(tr.activeSeconds()).toBe(15);
    const sid = tr.sid;
    tr.hidden();
    tick(ANALYTICS.newSessionAfterMs + 1);
    let fresh = false;
    tr.visible(() => (fresh = true));
    expect(fresh).toBe(true);
    expect(tr.sid).not.toBe(sid);
    await tr.flush();
    expect(sent.at(-1)!.batch.events[0]).toMatchObject({ e: 'start', resume: true });
  });

  it('gönderilemeyen paket kuyrukta bekler ve sonra gider', async () => {
    const { tr, sent, mode, store } = setup('retry');
    tr.startSession();
    await tr.flush();
    expect(tr.pending).toBe(1);
    // Sayfa kapanıp açılsa da kuyruk korunur
    const again = new Tracker(async (id, batch) => {
      sent.push({ id, batch });
      return 'ok';
    }, '1.0.0', () => 0, store);
    expect(again.pending).toBe(1);
    mode.result = 'ok';
    again.startSession();
    await again.flush();
    expect(again.pending).toBe(0);
    expect(sent).toHaveLength(2);
  });

  it('kapatılınca hiçbir şey göndermez', async () => {
    const { tr, sent } = setup();
    tr.setEnabled(false);
    tr.startSession();
    tr.track('ls');
    await tr.flush();
    expect(sent).toHaveLength(0);
  });

  it('Firestore değer biçimi', () => {
    expect(fsValue(3)).toEqual({ integerValue: '3' });
    expect(fsValue(1.5)).toEqual({ doubleValue: 1.5 });
    expect(fsValue(NaN)).toEqual({ nullValue: null });
    expect(fsValue([{ a: true }])).toEqual({ arrayValue: { values: [{ mapValue: { fields: { a: { booleanValue: true } } } }] } });
  });

  it('tarayıcı bilgisi çözümlenir', () => {
    const iphone = parseUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1');
    expect(iphone).toMatchObject({ os: 'iOS', osv: '17.4', browser: 'Safari', kind: 'Telefon', model: 'iPhone' });
    const samsung = parseUA('Mozilla/5.0 (Linux; Android 13; SM-A525F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36');
    expect(samsung).toMatchObject({ os: 'Android', osv: '13', browser: 'Samsung Internet', model: 'SM-A525F', kind: 'Telefon' });
    const chrome = parseUA('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36');
    expect(chrome).toMatchObject({ os: 'Android', browser: 'Chrome', model: '' });
    const ipad = parseUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', 5);
    expect(ipad).toMatchObject({ os: 'iOS', kind: 'Tablet', model: 'iPad' });
    const win = parseUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0');
    expect(win).toMatchObject({ os: 'Windows', browser: 'Edge', kind: 'Bilgisayar' });
  });
});
