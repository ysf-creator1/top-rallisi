// Halat kontrolü (tarif 4.1): halat herhangi bir noktasından tutulur, hareket göreli.
// Ekran kenarındaki ~64 px şerit (ve halatın çevresi) dokunma alanıdır.
// Parmak şeritten çıksa da ekrandan kalkana kadar tutuş sürer. Çoklu dokunma desteklenir.

export type RopeSide = 0 | 1;

export interface RopeGrip {
  pointerId: number;
  lastY: number;
  y: number;
}

export interface RopeInputOptions {
  /** Hangi halatlar etkin: iki halat modunda ikisi, eğim modunda biri */
  enabled: () => [boolean, boolean];
  /** Halatların ekrandaki x'i */
  ropeX: () => [number, number];
  onGrab?: (side: RopeSide) => void;
}

const STRIP = 64;
const NEAR = 52;

export class RopeInput {
  readonly grips: [RopeGrip | null, RopeGrip | null] = [null, null];
  /** Son okumadan beri çekilen piksel (aşağı = artı) */
  private pending: [number, number] = [0, 0];
  /** Görsel: düğümün kayması (px) ve lif kayması */
  readonly offset: [number, number] = [0, 0];
  readonly scroll: [number, number] = [0, 0];
  private el: HTMLElement | null = null;
  active = true;

  constructor(private opts: RopeInputOptions) {}

  attach(el: HTMLElement): void {
    this.el = el;
    el.addEventListener('pointerdown', this.onDown, { passive: false });
    el.addEventListener('pointermove', this.onMove, { passive: false });
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('lostpointercapture', this.onUp);
  }

  detach(): void {
    const el = this.el;
    if (!el) return;
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointercancel', this.onUp);
    el.removeEventListener('lostpointercapture', this.onUp);
    this.el = null;
  }

  /** Dokunulan nokta hangi halata ait? */
  private pick(x: number): RopeSide | null {
    const [eL, eR] = this.opts.enabled();
    const [rx0, rx1] = this.opts.ropeX();
    const w = window.innerWidth;
    const inL = eL && (x < STRIP || Math.abs(x - rx0) < NEAR);
    const inR = eR && (x > w - STRIP || Math.abs(x - rx1) < NEAR);
    if (inL && inR) return Math.abs(x - rx0) <= Math.abs(x - rx1) ? 0 : 1;
    if (inL) return 0;
    if (inR) return 1;
    // Masaüstünde fareyle: tek halat modunda ekranın o yarısı da yeter
    return null;
  }

  private onDown = (e: PointerEvent): void => {
    if (!this.active) return;
    const side = this.pick(e.clientX);
    if (side === null) return;
    if (this.grips[side]) return;
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* yok say */
    }
    this.grips[side] = { pointerId: e.pointerId, lastY: e.clientY, y: e.clientY };
    this.opts.onGrab?.(side);
  };

  private onMove = (e: PointerEvent): void => {
    for (const side of [0, 1] as const) {
      const g = this.grips[side];
      if (!g || g.pointerId !== e.pointerId) continue;
      e.preventDefault();
      // Birleştirilmiş olaylar (yüksek hızlı dokunmatik)
      const dy = e.clientY - g.lastY;
      g.lastY = e.clientY;
      g.y = e.clientY;
      if (!this.active) continue;
      this.pending[side] += dy;
      this.offset[side] += dy;
      this.scroll[side] += dy;
    }
  };

  private onUp = (e: PointerEvent): void => {
    for (const side of [0, 1] as const) {
      const g = this.grips[side];
      if (g && g.pointerId === e.pointerId) this.grips[side] = null;
    }
  };

  /** Biriken çekme miktarını alır ve sıfırlar (px, aşağı = artı). */
  consume(): [number, number] {
    const p: [number, number] = [this.pending[0], this.pending[1]];
    this.pending[0] = this.pending[1] = 0;
    return p;
  }

  /** Bırakılan halatın düğümü yerine yaylanır */
  update(dt: number, limits: [number, number]): void {
    for (const side of [0, 1] as const) {
      if (!this.grips[side]) this.offset[side] *= Math.exp(-dt * 7);
      this.offset[side] = Math.max(limits[0], Math.min(limits[1], this.offset[side]));
    }
  }

  releaseAll(): void {
    this.grips[0] = this.grips[1] = null;
    this.pending[0] = this.pending[1] = 0;
  }
}
