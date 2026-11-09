// Meydan okuma linki: bitirilen denemenin hayaleti linkin içine sığdırılır (sunucu yok).
// Biçim: #c=<sürüm>.<etap>.<süre cs>.<top>.<bayrak>.<veri>
//  veri: her kanalın kareden kareye farkı (zigzag + varint), destekleniyorsa deflate ile sıkıştırılmış, base64url.
//  Kayıt linkte saniyede 15 kare (her ikinci kare) tutulur; açılırken ara kareler hesaplanır.
//  bayrak: 1 = yardım modu, 2 = çift halat, 4 = son kare tek adım sonra (kare sayısı çift).

import { BALL_TRAITS, type BallType } from '../config/physics';
import { decodeFrames, encodeFrames, GHOST_HZ, type GhostData } from './ghost';

export const CHALLENGE_PARAM = 'c';
const CH = 4;
/** En fazla 10 dakikalık kayıt */
const MAX_FRAMES = GHOST_HZ * 600;

export interface Challenge {
  ghost: GhostData;
  levelId: string;
  time: number;
  ball: BallType;
  assist: boolean;
  control: 'ropes' | 'tilt';
}

// ---------- Bayt yardımcıları ----------

function toB64url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const buf = await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(buf);
}

const canCompress = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

/** Kareleri kanal kanal fark + zigzag + varint olarak yazar */
export function packFrames(frames: Int16Array): Uint8Array {
  const out: number[] = [];
  const prev = [0, 0, 0, 0];
  for (let i = 0; i < frames.length; i++) {
    const c = i % CH;
    const d = frames[i] - prev[c];
    prev[c] = frames[i];
    let z = d >= 0 ? d * 2 : -d * 2 - 1;
    while (z >= 0x80) {
      out.push((z & 0x7f) | 0x80);
      z >>>= 7;
    }
    out.push(z);
  }
  return Uint8Array.from(out);
}

export function unpackFrames(bytes: Uint8Array): Int16Array {
  const vals: number[] = [];
  const prev = [0, 0, 0, 0];
  let i = 0;
  while (i < bytes.length) {
    let z = 0;
    let shift = 0;
    let b: number;
    do {
      if (i >= bytes.length || shift > 21) throw new Error('bozuk veri');
      b = bytes[i++];
      z |= (b & 0x7f) << shift;
      shift += 7;
    } while (b & 0x80);
    const d = z & 1 ? -((z + 1) >> 1) : z >> 1;
    const c = vals.length % CH;
    prev[c] += d;
    vals.push(prev[c]);
    if (vals.length > MAX_FRAMES * CH) throw new Error('çok uzun');
  }
  if (vals.length % CH !== 0) throw new Error('eksik kare');
  return Int16Array.from(vals);
}

// ---------- Seyreltme ----------

/** Her ikinci kareyi alır; son kare her zaman kalır. tail: son kare bir adım sonra mı */
export function halveFrames(frames: Int16Array): { frames: Int16Array; tail: boolean } {
  const n = frames.length / CH;
  const idx: number[] = [];
  for (let i = 0; i < n; i += 2) idx.push(i);
  const tail = idx[idx.length - 1] !== n - 1;
  if (tail) idx.push(n - 1);
  const out = new Int16Array(idx.length * CH);
  idx.forEach((k, j) => out.set(frames.subarray(k * CH, k * CH + CH), j * CH));
  return { frames: out, tail };
}

/** Ara kareleri doğrusal doldurur (düşüp yeniden doğmada sıçramayı karıştırmaz) */
export function doubleFrames(frames: Int16Array, tail: boolean): Int16Array {
  const n = frames.length / CH;
  const out: number[] = [];
  for (let j = 0; j < n; j++) {
    const a = j * CH;
    for (let c = 0; c < CH; c++) out.push(frames[a + c]);
    if (j === n - 1 || (tail && j === n - 2)) continue;
    const b = a + CH;
    const jump = Math.abs(frames[b] - frames[a]) > 300 || Math.abs(frames[b + 1] - frames[a + 1]) > 300;
    for (let c = 0; c < CH; c++) out.push(jump ? frames[a + c] : Math.round((frames[a + c] + frames[b + c]) / 2));
  }
  return Int16Array.from(out);
}

// ---------- Link ----------

export async function encodeChallenge(c: Omit<Challenge, 'levelId' | 'time' | 'ball'> & { ghost: GhostData }): Promise<string> {
  const g = c.ghost;
  const half = halveFrames(decodeFrames(g.data));
  let data = packFrames(half.frames);
  let v = '1';
  if (canCompress()) {
    try {
      data = await pipe(data, new CompressionStream('deflate-raw'));
      v = '2';
    } catch {
      /* sıkıştırmasız gönder */
    }
  }
  const flags = (c.assist ? 1 : 0) | (c.control === 'ropes' ? 2 : 0) | (half.tail ? 4 : 0);
  return [v, g.levelId, Math.round(g.time * 100), g.ball, flags, toB64url(data)].join('.');
}

/** Linkteki meydan okumayı çözer. Geçersizse null. */
export async function decodeChallenge(payload: string, levelExists: (id: string) => boolean): Promise<Challenge | null> {
  try {
    const parts = payload.split('.');
    if (parts.length !== 6) return null;
    const [v, levelId, cs, ball, fl, b64] = parts;
    if (v !== '1' && v !== '2') return null;
    if (!levelExists(levelId)) return null;
    if (!(ball in BALL_TRAITS)) return null;
    const time = Number(cs) / 100;
    if (!isFinite(time) || time <= 0 || time > 600) return null;
    let bytes = fromB64url(b64);
    if (v === '2') {
      if (!canCompress()) return null;
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    }
    const flags = Number(fl) | 0;
    const packed = unpackFrames(bytes);
    if (packed.length < CH * 2) return null;
    const frames = doubleFrames(packed, !!(flags & 4));
    const ghost: GhostData = { v: 1, levelId, ball: ball as BallType, time, data: encodeFrames(frames) };
    return { ghost, levelId, time, ball: ball as BallType, assist: !!(flags & 1), control: flags & 2 ? 'ropes' : 'tilt' };
  } catch {
    return null;
  }
}

/** Paylaşılacak tam adres */
export function challengeUrl(base: string, payload: string): string {
  return `${base.replace(/#.*$/, '')}#${CHALLENGE_PARAM}=${payload}`;
}

/** Kısa link: #m=<kod> (kayıt Firestore'da) */
export const SHORT_PARAM = 'm';

export function shortChallengeUrl(base: string, id: string): string {
  return `${base.replace(/#.*$/, '')}#${SHORT_PARAM}=${id}`;
}

/** Kısa linkin kodu; yoksa null */
export function shortIdFromHash(hash: string): string | null {
  const m = /^#?m=([a-z0-9]{6,12})$/.exec(hash);
  return m ? m[1] : null;
}

/** Adres çubuğundaki karma kısmından meydan okuma verisini alır */
export function challengeFromHash(hash: string): string | null {
  const m = /^#?c=([A-Za-z0-9._-]+)$/.exec(hash);
  return m ? m[1] : null;
}
