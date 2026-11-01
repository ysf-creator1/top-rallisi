// Küçük WebAudio sentez sesleri. Dosya indirmez; çevrimdışı çalışır.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let rollGain: GainNode | null = null;
let rollFilter: BiquadFilterNode | null = null;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  if (master && ctx) master.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.05);
}

/** İlk dokunuşta çağrılır (tarayıcılar sesi ancak kullanıcı hareketiyle açar). */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = enabled ? 0.55 : 0;
      master.connect(ctx.destination);
      startRoll();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch {
    ctx = null;
  }
}

export function suspendAudio(): void {
  if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
}

function startRoll(): void {
  if (!ctx || !master) return;
  // Yuvarlanma: filtrelenmiş gürültü, hızla açılır
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
    d[i] = last * 6;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  rollFilter = ctx.createBiquadFilter();
  rollFilter.type = 'lowpass';
  rollFilter.frequency.value = 400;
  rollGain = ctx.createGain();
  rollGain.gain.value = 0;
  src.connect(rollFilter).connect(rollGain).connect(master);
  src.start();
}

/** Topun hızına göre yuvarlanma sesi (0..1). */
export function setRoll(speed01: number): void {
  if (!ctx || !rollGain || !rollFilter) return;
  const v = Math.max(0, Math.min(1, speed01));
  rollGain.gain.setTargetAtTime(v * 0.22, ctx.currentTime, 0.06);
  rollFilter.frequency.setTargetAtTime(250 + v * 700, ctx.currentTime, 0.08);
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slideTo?: number): void {
  if (!ctx || !master || !enabled) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export type SoundName = 'star' | 'checkpoint' | 'fall' | 'finish' | 'wall' | 'tap' | 'buy' | 'grab' | 'record';

export function play(name: SoundName, strength = 1): void {
  if (!ctx || !enabled) return;
  switch (name) {
    case 'star':
      tone(880, 0.18, 'sine', 0.25);
      tone(1320, 0.26, 'sine', 0.2, 0.07);
      break;
    case 'checkpoint':
      tone(660, 0.16, 'triangle', 0.2);
      tone(990, 0.22, 'triangle', 0.16, 0.09);
      break;
    case 'fall':
      tone(420, 0.55, 'sine', 0.22, 0, 110);
      break;
    case 'finish':
      tone(523, 0.18, 'triangle', 0.22);
      tone(659, 0.18, 'triangle', 0.22, 0.12);
      tone(784, 0.4, 'triangle', 0.24, 0.24);
      break;
    case 'record':
      tone(784, 0.16, 'sine', 0.2);
      tone(988, 0.16, 'sine', 0.2, 0.1);
      tone(1175, 0.4, 'sine', 0.22, 0.2);
      break;
    case 'wall':
      tone(180 + strength * 80, 0.07, 'square', 0.05 + strength * 0.08);
      break;
    case 'tap':
      tone(740, 0.05, 'sine', 0.08);
      break;
    case 'grab':
      tone(300, 0.05, 'triangle', 0.06);
      break;
    case 'buy':
      tone(660, 0.1, 'sine', 0.2);
      tone(880, 0.1, 'sine', 0.2, 0.08);
      tone(1320, 0.25, 'sine', 0.2, 0.16);
      break;
  }
}
