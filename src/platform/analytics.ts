// Anonim oyun istatistikleri: oturumlar, etaplar, cihaz ve yaklaşık konum (şehir).
// Ad, e-posta ya da IP adresi saklanmaz. Oyuncu, tarayıcıya özel rastgele bir kimlikle (pid) tanınır.
// Olaylar bellekte birikir ve toplu halde Firestore'a tek belge olarak yazılır (REST, SDK yok).
// Gönderilemeyenler kuyrukta bekler ve sonra tekrar denenir.

import { ANALYTICS } from '../config/analytics';
import { storage, type KeyValueStore } from './storage';

const PREFS_KEY = 'top-rallisi.analytics';
const QUEUE_KEY = 'top-rallisi.analytics.q';
const MAX_QUEUE = 40;
const GEO_TTL = 60 * 60_000;

export type EventData = Record<string, string | number | boolean | null | undefined>;

export interface LogEvent extends EventData {
  /** Olay türü */
  e: string;
  /** Oturum başından beri geçen süre (ms) */
  t: number;
}

export interface Geo {
  country?: string;
  cc?: string;
  region?: string;
  city?: string;
  isp?: string;
  lat?: number;
  lon?: number;
}

export interface Batch {
  v: number;
  pid: string;
  sid: string;
  seq: number;
  /** Gönderim anı (istemci saati, ms) */
  ts: number;
  /** Oturum başlangıcı (ms) */
  start: number;
  /** Oturumda ekranın açık olduğu toplam süre (sn) */
  active: number;
  app: string;
  dev?: Record<string, unknown>;
  geo?: Geo;
  events: LogEvent[];
}

interface Prefs {
  pid: string;
  off?: boolean;
  geo?: { at: number; data: Geo };
}

export type Sender = (id: string, batch: Batch, keepalive: boolean) => Promise<'ok' | 'drop' | 'retry'>;

export function randomId(n = 12): string {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  const buf = new Uint8Array(n);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(buf);
  else for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 256);
  for (let i = 0; i < n; i++) s += abc[buf[i] % abc.length];
  return s;
}

/** JS değerini Firestore REST biçimine çevirir */
export function fsValue(v: unknown): Record<string, unknown> {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { nullValue: null };
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsValue) } };
  if (typeof v === 'object') return { mapValue: { fields: fsFields(v as Record<string, unknown>) } };
  return { nullValue: null };
}

export function fsFields(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = fsValue(v);
  return out;
}

/** Olay toplayıcı. Tarayıcıdan bağımsız: gönderici, saat ve kayıt dışarıdan verilir (test için). */
export class Tracker {
  readonly pid: string;
  sid = '';
  private seq = 0;
  private start = 0;
  private events: LogEvent[] = [];
  private queue: { id: string; batch: Batch }[] = [];
  private activeMs = 0;
  private visibleSince: number | null = null;
  private hiddenAt: number | null = null;
  private dev: Record<string, unknown> | null = null;
  private geo: Geo | null = null;
  private devSent = false;
  private geoSent = false;
  private sending = false;
  private prefs: Prefs;

  constructor(
    private send: Sender,
    private app: string,
    private now: () => number = () => Date.now(),
    private store: KeyValueStore = storage,
  ) {
    this.prefs = this.loadPrefs();
    this.pid = this.prefs.pid;
    try {
      const q = JSON.parse(this.store.get(QUEUE_KEY) ?? '[]');
      if (Array.isArray(q)) this.queue = q.slice(-MAX_QUEUE);
    } catch {
      this.queue = [];
    }
  }

  get enabled(): boolean {
    return !this.prefs.off;
  }

  setEnabled(on: boolean): void {
    this.prefs.off = !on;
    this.savePrefs();
    if (!on) {
      this.events = [];
      this.queue = [];
      this.store.remove(QUEUE_KEY);
    }
  }

  get cachedGeo(): Geo | null {
    const g = this.prefs.geo;
    return g && this.now() - g.at < GEO_TTL ? g.data : null;
  }

  setDevice(dev: Record<string, unknown>): void {
    this.dev = dev;
    this.devSent = false;
  }

  setGeo(geo: Geo): void {
    this.geo = geo;
    this.geoSent = false;
    this.prefs.geo = { at: this.now(), data: geo };
    this.savePrefs();
  }

  /** Yeni oturum başlatır */
  startSession(data: EventData = {}): void {
    this.sid = randomId();
    this.seq = 0;
    this.start = this.now();
    this.activeMs = 0;
    this.visibleSince = this.start;
    this.hiddenAt = null;
    this.devSent = false;
    this.geoSent = false;
    this.events = [];
    this.track('start', data);
  }

  track(e: string, data: EventData = {}): void {
    if (!this.enabled || !this.sid) return;
    const ev: LogEvent = { e, t: this.now() - this.start };
    for (const [k, v] of Object.entries(data)) if (v !== undefined) ev[k] = v;
    this.events.push(ev);
    if (this.events.length > 300) this.events.splice(0, this.events.length - 300);
  }

  /** Ekran kapandı / sekme gizlendi */
  hidden(): void {
    if (this.visibleSince === null) return;
    this.activeMs += this.now() - this.visibleSince;
    this.visibleSince = null;
    this.hiddenAt = this.now();
    this.track('hide');
    void this.flush(true);
  }

  /** Ekran yeniden açıldı. Uzun aradan sonra yeni oturum sayılır. */
  visible(onNewSession?: () => void): void {
    if (this.visibleSince !== null) return;
    const away = this.hiddenAt === null ? 0 : this.now() - this.hiddenAt;
    if (away >= ANALYTICS.newSessionAfterMs) {
      this.startSession({ resume: true });
      onNewSession?.();
      return;
    }
    this.visibleSince = this.now();
    this.hiddenAt = null;
    this.track('show', { away: Math.round(away / 1000) });
  }

  activeSeconds(): number {
    const live = this.visibleSince === null ? 0 : this.now() - this.visibleSince;
    return Math.round((this.activeMs + live) / 1000);
  }

  /** Biriken olayları tek belge olarak kuyruğa koyar ve kuyruğu gönderir */
  async flush(keepalive = false): Promise<void> {
    if (!this.enabled || !this.sid) return;
    const needDev = !!this.dev && !this.devSent;
    const needGeo = !!this.geo && !this.geoSent;
    if (this.events.length > 0 || needDev || needGeo) {
      const batch: Batch = {
        v: 1,
        pid: this.pid,
        sid: this.sid,
        seq: this.seq,
        ts: this.now(),
        start: this.start,
        active: this.activeSeconds(),
        app: this.app,
        events: this.events,
      };
      if (needDev) batch.dev = this.dev!;
      if (needGeo) batch.geo = this.geo!;
      this.devSent ||= needDev;
      this.geoSent ||= needGeo;
      this.queue.push({ id: `${this.sid}-${this.seq}`, batch });
      if (this.queue.length > MAX_QUEUE) this.queue.splice(0, this.queue.length - MAX_QUEUE);
      this.seq++;
      this.events = [];
      this.saveQueue();
    }
    await this.drain(keepalive);
  }

  private async drain(keepalive: boolean): Promise<void> {
    if (this.sending && !keepalive) return;
    this.sending = true;
    try {
      while (this.queue.length > 0) {
        const item = this.queue[0];
        let res: 'ok' | 'drop' | 'retry';
        try {
          res = await this.send(item.id, item.batch, keepalive);
        } catch {
          res = 'retry';
        }
        if (res === 'retry') break;
        // Paralel gönderim aynı paketi zaten çıkarmış olabilir
        const i = this.queue.indexOf(item);
        if (i >= 0) this.queue.splice(i, 1);
        this.saveQueue();
      }
    } finally {
      this.sending = false;
    }
  }

  get pending(): number {
    return this.queue.length;
  }

  private loadPrefs(): Prefs {
    try {
      const p = JSON.parse(this.store.get(PREFS_KEY) ?? 'null');
      if (p && typeof p.pid === 'string' && p.pid.length >= 8) return p;
    } catch {
      /* bozuk kayıt: yenisi oluşur */
    }
    const p: Prefs = { pid: randomId(16) };
    this.store.set(PREFS_KEY, JSON.stringify(p));
    return p;
  }

  private savePrefs(): void {
    this.store.set(PREFS_KEY, JSON.stringify(this.prefs));
  }

  private saveQueue(): void {
    if (this.queue.length === 0) this.store.remove(QUEUE_KEY);
    else this.store.set(QUEUE_KEY, JSON.stringify(this.queue));
  }
}

// ---------- Tarayıcı tarafı ----------

/**
 * Firestore REST ile belge oluşturur. `at` alanına sunucu saati yazılır (telefon saati yanlış olsa da
 * rapor doğru sıralar ve sadece yeni kayıtları indirebilir). Aynı kimlik ikinci kez yazılamaz.
 */
const firestoreSender: Sender = async (id, batch, keepalive) => {
  const { projectId, apiKey, collection } = ANALYTICS;
  const root = `projects/${projectId}/databases/(default)/documents`;
  const url = `https://firestore.googleapis.com/v1/${root}:commit?key=${apiKey}`;
  const write = {
    update: { name: `${root}/${collection}/${id}`, fields: fsFields(batch as unknown as Record<string, unknown>) },
    updateTransforms: [{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }],
    currentDocument: { exists: false },
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes: [write] }),
    keepalive,
  });
  if (r.ok) return 'ok';
  // Zaten yazılmış (409) ya da kurallara uymayan belge (400/403): tekrar deneme
  if (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429) return 'drop';
  return 'retry';
};

/** Tarayıcı bilgisinden işletim sistemi, tarayıcı ve cihaz türü */
export function parseUA(ua: string, touchPoints = 0): { os: string; osv: string; browser: string; bv: string; kind: string; model: string } {
  let os = 'Diğer';
  let osv = '';
  let model = '';
  let m: RegExpMatchArray | null;
  if ((m = ua.match(/iPhone OS (\d+)[_.](\d+)/)) || (m = ua.match(/CPU OS (\d+)[_.](\d+)/))) {
    os = 'iOS';
    osv = `${m[1]}.${m[2]}`;
    model = ua.includes('iPad') ? 'iPad' : 'iPhone';
  } else if (ua.includes('Macintosh') && touchPoints > 1) {
    os = 'iOS';
    model = 'iPad';
    m = ua.match(/Version\/(\d+)\.(\d+)/);
    if (m) osv = `${m[1]}.${m[2]}`;
  } else if ((m = ua.match(/Android (\d+(?:\.\d+)?)/))) {
    os = 'Android';
    osv = m[1];
    const mm = ua.match(/Android [^;)]*;\s*([^;)]+?)(?:\s+Build\/|\))/);
    if (mm && mm[1] !== 'K' && !/^wv$/.test(mm[1])) model = mm[1].trim();
  } else if ((m = ua.match(/Windows NT (\d+\.\d+)/))) {
    os = 'Windows';
    osv = m[1] === '10.0' ? '10/11' : m[1];
  } else if ((m = ua.match(/Mac OS X (\d+)[_.](\d+)/))) {
    os = 'macOS';
    osv = `${m[1]}.${m[2]}`;
  } else if (ua.includes('CrOS')) os = 'ChromeOS';
  else if (ua.includes('Linux')) os = 'Linux';

  let browser = 'Diğer';
  let bv = '';
  const tests: [string, RegExp][] = [
    ['Samsung Internet', /SamsungBrowser\/(\d+)/],
    ['Edge', /Edg(?:A|iOS)?\/(\d+)/],
    ['Opera', /(?:OPR|OPT)\/(\d+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
    ['Yandex', /YaBrowser\/(\d+)/],
    ['Instagram', /Instagram (\d+)/],
    ['Facebook', /FBAV\/(\d+)/],
    ['Chrome', /(?:Chrome|CriOS)\/(\d+)/],
    ['Safari', /Version\/(\d+).*Safari/],
  ];
  for (const [name, re] of tests) {
    const r = ua.match(re);
    if (r) {
      browser = name;
      bv = r[1];
      break;
    }
  }
  if (browser === 'Diğer' && os === 'iOS' && /AppleWebKit/.test(ua)) browser = 'iOS WebView';

  const mobile = /Mobi|iPhone|Android/.test(ua) && !/iPad|Tablet/.test(ua);
  const tablet = model === 'iPad' || /Tablet|iPad/.test(ua) || (os === 'Android' && !/Mobi/.test(ua));
  const kind = tablet ? 'Tablet' : mobile ? 'Telefon' : 'Bilgisayar';
  return { os, osv, browser, bv, kind, model };
}

function gpuName(): string {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl') ?? c.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name.slice(0, 80);
  } catch {
    return '';
  }
}

async function deviceInfo(standalone: boolean): Promise<Record<string, unknown>> {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    userAgentData?: { mobile?: boolean; getHighEntropyValues?(h: string[]): Promise<{ model?: string; platformVersion?: string; platform?: string }> };
    connection?: { effectiveType?: string };
  };
  const ua = nav.userAgent;
  const p = parseUA(ua, nav.maxTouchPoints);
  let model = p.model;
  let osv = p.osv;
  try {
    const hi = await Promise.race([
      nav.userAgentData?.getHighEntropyValues?.(['model', 'platformVersion']),
      new Promise<undefined>((r) => setTimeout(() => r(undefined), 800)),
    ]);
    if (hi?.model) model = hi.model;
    if (hi?.platformVersion && p.os === 'Android') osv = hi.platformVersion.split('.').slice(0, 2).join('.').replace(/\.0$/, '');
  } catch {
    /* desteklenmiyor */
  }
  let tz = '';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    /* yok */
  }
  return {
    os: p.os,
    osv,
    browser: p.browser,
    bv: p.bv,
    kind: p.kind,
    model,
    sw: screen.width,
    sh: screen.height,
    dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
    touch: nav.maxTouchPoints > 0,
    lang: nav.language ?? '',
    tz,
    pwa: standalone,
    mem: nav.deviceMemory ?? null,
    cpu: nav.hardwareConcurrency ?? null,
    net: nav.connection?.effectiveType ?? '',
    gpu: gpuName(),
    ua: ua.slice(0, 300),
    ref: document.referrer ? new URL(document.referrer).hostname : '',
  };
}

/** Yaklaşık konum (şehir düzeyi). IP adresi saklanmaz. */
async function lookupGeo(): Promise<Geo | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5000);
  try {
    const r = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: ctl.signal });
    if (!r.ok) return null;
    const j = (await r.json()) as Record<string, string>;
    const num = (s: string | undefined) => (s && Number.isFinite(Number(s)) ? Math.round(Number(s) * 10) / 10 : undefined);
    return {
      country: j.country || undefined,
      cc: j.country_code || undefined,
      region: j.region || undefined,
      city: j.city || undefined,
      isp: j.organization_name ? String(j.organization_name).replace(/^AS\d+\s*/, '').slice(0, 60) : undefined,
      lat: num(j.latitude),
      lon: num(j.longitude),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let tracker: Tracker | null = null;

/** Oyun açılışında bir kez çağrılır */
export function initAnalytics(opts: { app: string; standalone: boolean; dev: boolean }): void {
  if (tracker || typeof window === 'undefined' || !ANALYTICS.projectId) return;
  const host = location.hostname;
  const local = host === 'localhost' || host === '127.0.0.1' || /^192\.168\./.test(host);
  if (local && new URLSearchParams(location.search).get('log') !== '1') return;
  const t = new Tracker(firestoreSender, opts.app);
  tracker = t;
  if (!t.enabled) return;
  const begin = () => {
    t.startSession({ dev: opts.dev || undefined, local: local || undefined });
    const cached = t.cachedGeo;
    void deviceInfo(opts.standalone).then((d) => t.setDevice(d));
    const geo = cached ? Promise.resolve(cached) : lookupGeo();
    void geo.then((g) => g && t.setGeo(g));
    // İlk gönderim: cihaz ve konum gelince ya da en geç 6 sn sonra
    setTimeout(() => void t.flush(), 6000);
  };
  begin();
  setInterval(() => {
    if (!document.hidden) void t.flush();
  }, ANALYTICS.flushMs);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) t.hidden();
    else
      t.visible(() => {
        void deviceInfo(opts.standalone).then((d) => t.setDevice(d));
        void lookupGeo().then((g) => g && t.setGeo(g));
        setTimeout(() => void t.flush(), 6000);
      });
  });
  window.addEventListener('pagehide', () => t.hidden());
}

export function track(e: string, data: EventData = {}): void {
  tracker?.track(e, data);
}

export function analyticsEnabled(): boolean {
  return tracker ? tracker.enabled : !readPrefsOff();
}

export function setAnalyticsEnabled(on: boolean): void {
  if (tracker) {
    if (on && !tracker.enabled) {
      tracker.setEnabled(true);
      tracker.startSession({ optin: true });
    } else tracker.setEnabled(on);
    return;
  }
  // İstatistik bu cihazda kapalı başlamışsa (yerel deneme) sadece tercihi yaz
  try {
    const p = JSON.parse(storage.get(PREFS_KEY) ?? 'null') ?? { pid: randomId(16) };
    p.off = !on;
    storage.set(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* yok say */
  }
}

function readPrefsOff(): boolean {
  try {
    return !!JSON.parse(storage.get(PREFS_KEY) ?? 'null')?.off;
  } catch {
    return false;
  }
}
