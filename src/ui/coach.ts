// Halat koçu: ilk etaplarda, oyuncu halata dokunana kadar halatların üstünde bir el belirir
// ve halatı aşağı çekip yukarı kaldırır. Çubuğun nereye gideceği hayalet çubukla gösterilir.
// Oyuncu halatı tutunca ya da çubuk oynayınca kaybolur.

import { t } from '../i18n';
import { h } from './dom';

/** both: iki halat birlikte; left/right: tek halat (çubuk eğilir); lift: eğim modundaki tek halat */
export type CoachStep = 'both' | 'left' | 'right' | 'lift';

/** Bir adımın süresi (sn) */
export const COACH_SEG = 2.7;
/** Etap açılınca el gelmeden önceki bekleme (sn) */
const COACH_DELAY = 0.4;

export interface CoachPose {
  step: CoachStep;
  /** Elin görünürlüğü 0..1 */
  show: number;
  /** Parmak halatı tutuyor mu 0..1 */
  press: number;
  /** Halat ne kadar aşağı çekildi 0..1 */
  pull: number;
  dir: 'down' | 'up' | null;
}

const smooth = (x: number): number => {
  const k = Math.max(0, Math.min(1, x));
  return k * k * (3 - 2 * k);
};

/** Zaman çizelgesi: belir → tut → aşağı çek → bekle → yukarı kaldır → bırak → kaybol */
export function coachPose(time: number, steps: CoachStep[]): CoachPose {
  const tt = Math.max(0, time);
  const step = steps[Math.floor(tt / COACH_SEG) % steps.length];
  const u = tt % COACH_SEG;
  const show = u < 0.25 ? u / 0.25 : u < 2.2 ? 1 : u < 2.45 ? 1 - (u - 2.2) / 0.25 : 0;
  const press = u < 0.25 ? 0 : u < 2.05 ? smooth((u - 0.25) / 0.12) : 1 - smooth((u - 2.05) / 0.12);
  let pull = 0;
  if (u >= 0.4 && u < 1.1) pull = smooth((u - 0.4) / 0.7);
  else if (u >= 1.1 && u < 1.45) pull = 1;
  else if (u >= 1.45 && u < 2.15) pull = 1 - smooth((u - 1.45) / 0.7);
  const dir = u >= 0.3 && u < 1.45 ? 'down' : u >= 1.45 && u < 2.3 ? 'up' : null;
  return { step, show, press, pull, dir };
}

/** Oturuma giden gösteri: halat düğümünün kayması (px), uçların hayalet yükselişi (birim), topun kayması */
export interface CoachDemo {
  pull: [number, number];
  lift: [number, number];
  /** Hayalet topun çubuk üstünde kayması (birim, sağa artı) */
  slide: number;
  /** Hayalet çubuk görünsün mü */
  ghost: boolean;
}

export interface CoachInput {
  /** Gösteri ilerleyebilir mi (duraklatma, kamera turu yok) */
  running: boolean;
  enabled: [boolean, boolean];
  tilt: boolean;
  ropeX: [number, number];
  /** Halat düğümlerinin dinlenme yeri (ekran y, px) */
  knotY: [number, number];
  height: number;
  /** Halat 1 px çekilince uç kaç birim yükselir */
  unitsPerPx: number;
}

const HAND_SIZE = 58;
/** SVG içinde parmak ucunun yeri (viewBox 64) */
const TIP_X = 24.5;
const TIP_Y = 3;

// Parmağı yukarıda, avucu altta bir el. Önce kalın kontur, sonra dolgu: tek parça çizgi gibi görünür.
const HAND_SHAPES = `
<rect x="19" y="2" width="11" height="34" rx="5.5"/>
<rect x="29" y="21" width="10" height="20" rx="5"/>
<rect x="37.5" y="24" width="9.5" height="17" rx="4.75"/>
<rect x="45.5" y="28" width="8.5" height="14" rx="4.25"/>
<path d="M19 30 H54 V45 C54 55 47 61.5 37 61.5 H31 C23 61.5 17.5 57 15 50 L8.2 38.6 C6.8 35.8 8.6 32.6 11.6 33.4 C13.6 34 15.6 36 19 40.5 Z"/>`;
const HAND_SVG = `<svg viewBox="0 0 64 64" width="${HAND_SIZE}" height="${HAND_SIZE}" aria-hidden="true">
<g fill="#3B3F45" stroke="#3B3F45" stroke-width="4.2" stroke-linejoin="round">${HAND_SHAPES}</g>
<g fill="#FFFDF8">${HAND_SHAPES}</g>
<path d="M22.5 8.5 V14" stroke="#E4DCCD" stroke-width="2" stroke-linecap="round"/>
</svg>`;
const ARROW_SVG = `<svg viewBox="0 0 24 40" width="20" height="34" aria-hidden="true"><path d="M12 4 V33 M4 25 L12 34 L20 25" fill="none" stroke="#FFFDF8" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 4 V33 M4 25 L12 34 L20 25" fill="none" stroke="#3B3F45" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

interface HandEls {
  root: HTMLElement;
  hand: HTMLElement;
  ring: HTMLElement;
  arrow: HTMLElement;
}

export class RopeCoach {
  readonly el: HTMLElement;
  private hands: [HandEls, HandEls];
  private cap: HTMLElement;
  private capKey = '';
  private time = 0;
  /** Etapta gösterilecek mi */
  private armed = false;
  /** Oyuncu dokundu: 1 → 0 sönerek kapanır */
  private fade = 1;
  private fading = false;

  constructor() {
    const hand = (i: number): HandEls => {
      const ring = h('div.coach-ring');
      const handEl = h('div.coach-hand', { html: HAND_SVG });
      const tx = TIP_X * (HAND_SIZE / 64);
      const ty = TIP_Y * (HAND_SIZE / 64);
      handEl.style.left = `${-tx}px`;
      handEl.style.top = `${-ty}px`;
      handEl.style.transformOrigin = `${tx}px ${ty}px`;
      const arrow = h('div.coach-arrow', { html: ARROW_SVG });
      const root = h(`div.coach-grip${i === 1 ? '.right' : ''}`, [ring, arrow, handEl]);
      return { root, hand: handEl, ring, arrow };
    };
    this.hands = [hand(0), hand(1)];
    this.cap = h('div.coach-cap.glass', '');
    this.el = h('div.coach.hidden', [this.hands[0].root, this.hands[1].root, this.cap]);
  }

  /** Etap başında (ve yeniden başlayınca) çağrılır */
  arm(on: boolean): void {
    this.armed = on;
    this.fading = false;
    this.fade = 1;
    this.time = -COACH_DELAY;
    this.capKey = '';
    this.el.classList.add('hidden');
  }

  /** Oyuncu halatı tuttu ya da çubuğu oynattı: el yavaşça kaybolur ve bu denemede bir daha gelmez */
  finish(): void {
    if (this.armed && !this.fading) this.fading = true;
  }

  get active(): boolean {
    return this.armed;
  }

  /** Her karede: el ve yazıyı yerleştirir, oturuma gösteri durumunu verir (yoksa null) */
  update(dt: number, inp: CoachInput): CoachDemo | null {
    if (!this.armed) return null;
    if (this.fading) {
      this.fade -= dt / 0.25;
      if (this.fade <= 0) {
        this.armed = false;
        this.el.classList.add('hidden');
        return null;
      }
    } else if (inp.running) this.time += dt;
    if (this.time < 0 || (!inp.running && !this.fading)) {
      this.el.classList.add('hidden');
      return null;
    }
    this.el.classList.remove('hidden');

    const steps: CoachStep[] = inp.tilt ? ['lift'] : ['both', 'both', 'left', 'right'];
    const p = coachPose(this.time, steps);
    const amp = Math.min(90, inp.height * 0.11);
    const pullPx = p.pull * amp * this.fade;
    const liftU = Math.min(260, amp * inp.unitsPerPx) * p.pull * this.fade;

    // Hangi halatlarda el var
    let on: [boolean, boolean];
    if (p.step === 'lift') on = inp.enabled[0] ? [true, false] : [false, true];
    else if (p.step === 'left') on = [true, false];
    else if (p.step === 'right') on = [false, true];
    else on = [true, true];
    on = [on[0] && inp.enabled[0], on[1] && inp.enabled[1]];

    const gap = Math.min(120, inp.height * 0.15);
    for (const i of [0, 1] as const) {
      const e = this.hands[i];
      if (!on[i]) {
        e.root.style.opacity = '0';
        continue;
      }
      const x = inp.ropeX[i];
      const y = inp.knotY[i] - gap + pullPx;
      e.root.style.opacity = String(p.show * this.fade);
      e.root.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      const sc = 1 - 0.1 * p.press;
      // Parmak ucu etrafında küçülür; sağ halatta el aynalanır (avuç ekranın içine düşsün)
      e.hand.style.transform = `scale(${i === 1 ? -sc : sc}, ${sc})`;
      e.ring.style.opacity = String(p.press * 0.9);
      e.ring.style.transform = `translate(-50%, -50%) scale(${0.6 + 0.4 * p.press})`;
      e.arrow.style.opacity = p.dir ? '1' : '0';
      e.arrow.classList.toggle('up', p.dir === 'up');
    }

    // Açıklama yazısı
    const key = !p.dir ? this.capKey : p.step === 'left' || p.step === 'right' ? 'coach.one' : p.dir === 'down' ? 'coach.down' : 'coach.up';
    if (key && key !== this.capKey) {
      this.capKey = key;
      this.cap.textContent = t(key);
    }
    this.cap.style.opacity = this.capKey ? String(this.fade) : '0';

    const lift: [number, number] =
      p.step === 'left' ? [liftU, 0] : p.step === 'right' ? [0, liftU] : [liftU, liftU];
    const slide = p.step === 'left' ? liftU * 0.6 : p.step === 'right' ? -liftU * 0.6 : 0;
    return {
      pull: [on[0] ? pullPx : 0, on[1] ? pullPx : 0],
      lift,
      slide,
      ghost: p.pull > 0.02,
    };
  }
}
