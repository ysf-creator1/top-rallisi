// Klavye: W/S sol uç, ↑/↓ sağ uç. Eğim modunda ←/→ eğim, ↑/↓ (ya da W/S) yükseltme.

export class KeyboardInput {
  private down = new Set<string>();
  enabled = true;

  constructor() {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
  }

  private onDown = (e: KeyboardEvent): void => {
    if (!this.enabled) return;
    const k = e.key.toLowerCase();
    if (['w', 's', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'a', 'd'].includes(k)) {
      this.down.add(k);
      e.preventDefault();
    }
  };

  private onUp = (e: KeyboardEvent): void => {
    this.down.delete(e.key.toLowerCase());
  };

  private onBlur = (): void => {
    this.down.clear();
  };

  /** İki halat: [sol, sağ] yön (-1..1), yukarı = artı */
  ropes(): [number, number] {
    const d = this.down;
    const l = (d.has('w') ? 1 : 0) - (d.has('s') ? 1 : 0);
    const r = (d.has('arrowup') ? 1 : 0) - (d.has('arrowdown') ? 1 : 0);
    return [l, r];
  }

  /** Eğim modu: eğim (-1 sol uç aşağı .. +1 sağ uç aşağı) ve yükseltme */
  tilt(): { tilt: number; lift: number } {
    const d = this.down;
    const tilt = (d.has('arrowright') || d.has('d') ? 1 : 0) - (d.has('arrowleft') || d.has('a') ? 1 : 0);
    const lift = (d.has('arrowup') || d.has('w') ? 1 : 0) - (d.has('arrowdown') || d.has('s') ? 1 : 0);
    return { tilt, lift };
  }

  get any(): boolean {
    return this.down.size > 0;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
