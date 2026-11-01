// Arayüz metinleri. Bütün metinler tr.json içinde; ileride başka diller eklenebilir.

import tr from './tr.json';

type Dict = Record<string, string>;
const dict: Dict = tr as Dict;

/** Metni anahtarla getirir; {ad} yer tutucularını doldurur. */
export function t(key: string, params?: Record<string, string | number>): string {
  let s = dict[key];
  if (s === undefined) {
    if (import.meta.env?.DEV) console.warn('Eksik metin:', key);
    return key;
  }
  if (params) {
    for (const k in params) s = s.split(`{${k}}`).join(String(params[k]));
  }
  return s;
}

export function hasText(key: string): boolean {
  return key in dict;
}

/** Saniyeyi "00:21.6" biçimine çevirir. */
export function formatTime(sec: number): string {
  const s = Math.max(0, sec);
  const tenths = Math.floor(s * 10 + 1e-6);
  const m = Math.floor(tenths / 600);
  const rest = tenths - m * 600;
  const ss = Math.floor(rest / 10);
  const d = rest % 10;
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${d}`;
}

/** Saniye farkını "0,4" biçimine çevirir (Türkçe ondalık virgül). */
export function formatDelta(sec: number): string {
  return Math.abs(sec).toFixed(1).replace('.', ',');
}

/** Puanı "2.450" biçimine çevirir. */
export function formatPoints(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
