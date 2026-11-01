// Oyun üstü göstergeler: süre, yıldızlar, etap etiketi, hayalet farkı, ipuçları.

import type { LevelData } from '../game/levels/types';
import { formatDelta, formatTime, t } from '../i18n';
import type { App } from './app';
import { h, svg } from './dom';
import { icons } from './icons';

export class Hud {
  readonly el: HTMLElement;
  private timer: HTMLElement;
  private stars: HTMLElement;
  private label: HTMLElement;
  private ghost: HTMLElement;
  private toastEl: HTMLElement;
  private hint: HTMLElement;
  private tiltCard: HTMLElement;
  private sideBtn: HTMLElement;
  private calib: HTMLElement;
  private windLayer: HTMLElement;
  private windEls: HTMLElement[] = [];
  private lastTimer = '';
  private toastTimer = 0;
  private starTotal = 3;

  constructor(private app: App) {
    this.timer = h('div.timer.glass', '00:00.0');
    this.stars = h('div.chip.glass', [svg(icons.star(18)), h('span.count', '0/3')]);
    const pause = h('button.round-btn.glass', { 'aria-label': t('hud.pause'), onclick: () => app.pauseGame() }, [svg(icons.pause())]);
    this.label = h('div.level-chip', '');
    this.ghost = h('div.ghost-chip', '');
    this.toastEl = h('div.hud-toast.glass', '');
    this.hint = h('div.hint.glass', [svg(icons.rope()), h('span', t('hud.hint.ropes'))]);
    this.tiltCard = h('div.tilt-card.glass', [svg(icons.phone()), h('div', [h('b', t('hud.hint.tilt')), h('span', t('hud.hint.tiltSub'))])]);
    this.sideBtn = h('button.side-btn.glass', { onclick: () => this.swapSide() }, [svg(icons.swap()), h('span.txt', '')]);
    this.calib = h('div.calib.glass.hidden', [svg(icons.phone()), h('span', t('hud.calibrate'))]);
    this.windLayer = h('div');
    this.el = h('div.hud.hidden', [
      this.windLayer,
      h('div.hud-top', [pause, this.timer, this.stars]),
      h('div.hud-label', [this.label, this.ghost]),
      this.toastEl,
      this.hint,
      this.tiltCard,
      this.sideBtn,
      this.calib,
    ]);
  }

  setVisible(v: boolean): void {
    this.el.classList.toggle('hidden', !v);
  }

  prepare(level: LevelData, ghost: boolean): void {
    this.label.textContent = this.app.levelLabel(level);
    if (this.app.save.data.settings.assist) this.label.append(svg(icons.assist(12)));
    this.starTotal = (level.stars ?? []).length;
    this.setStars(0);
    this.ghost.classList.toggle('show', false);
    this.ghost.dataset.on = ghost ? '1' : '';
    this.lastTimer = '';
    const s = this.app.save.data.settings;
    const tilt = s.control === 'tilt';
    this.hint.classList.toggle('hidden', tilt);
    this.hint.style.opacity = '1';
    this.tiltCard.classList.toggle('hidden', !tilt);
    this.sideBtn.classList.toggle('hidden', !tilt);
    this.applySide();
    // Rüzgâr etiketleri
    this.windLayer.innerHTML = '';
    this.windEls = (level.wind ?? []).map((w) => {
      const el = h('div.wind-label', [t('hud.wind'), svg(w.force < 0 ? icons.arrowLeft(14) : icons.arrowRight(14))]);
      this.windLayer.append(el);
      return el;
    });
    this.toastEl.classList.remove('show');
  }

  private applySide(): void {
    const left = this.app.save.data.settings.ropeSide === 'left';
    // Kart ve buton halatın karşı tarafında dursun
    this.tiltCard.classList.toggle('left-side', !left);
    this.sideBtn.classList.toggle('left-side', !left);
    this.sideBtn.querySelector('.txt')!.textContent = t('hud.ropeSide', { side: t(left ? 'hud.side.left' : 'hud.side.right') });
  }

  private swapSide(): void {
    const s = this.app.save.data.settings;
    const next = s.ropeSide === 'left' ? 'right' : 'left';
    this.app.save.update((d) => (d.settings.ropeSide = next));
    if (this.app.session) this.app.session.opts.ropeSide = next;
    this.applySide();
  }

  hideHint(): void {
    this.hint.style.opacity = '0';
    this.tiltCard.style.opacity = '0.0';
    setTimeout(() => {
      this.tiltCard.style.opacity = '';
      this.tiltCard.classList.add('hidden');
    }, 2500);
  }

  setStars(n: number): void {
    this.stars.querySelector('.count')!.textContent = `${n}/${this.starTotal}`;
  }

  bumpStars(): void {
    const s = this.app.session;
    if (!s) return;
    this.setStars(s.starsCollected);
    this.stars.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' });
  }

  flash(text: string, kind: 'ok' | 'warn'): void {
    this.toastEl.textContent = text;
    this.toastEl.style.color = kind === 'ok' ? '#3E7A62' : '#A9503F';
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 1400);
  }

  update(): void {
    const s = this.app.session;
    if (!s || this.app.screen !== 'game') return;
    const txt = formatTime(s.raceTime);
    if (txt !== this.lastTimer) {
      this.timer.textContent = txt;
      this.lastTimer = txt;
    }
    if (this.ghost.dataset.on) {
      const d = s.ghostDelta;
      if (d === null || !s.sim.started) this.ghost.classList.remove('show');
      else {
        this.ghost.classList.add('show');
        const behind = d > 0.05;
        const ahead = d < -0.05;
        this.ghost.classList.toggle('behind', behind);
        this.ghost.classList.toggle('ahead', ahead);
        this.ghost.textContent = behind ? t('hud.ghostBehind', { t: formatDelta(d) }) : t('hud.ghostAhead', { t: formatDelta(d) });
      }
    }
    this.calib.classList.toggle('hidden', !(s.calibrating > 0));
    const lvl = s.opts.level;
    (lvl.wind ?? []).forEach((w, i) => {
      const el = this.windEls[i];
      if (!el) return;
      const p = this.app.renderer.projectLevelPoint(w.x + w.w * 0.92, w.y + w.h * 0.8);
      const vis = p.y > 90 && p.y < window.innerHeight - 40;
      el.style.display = vis ? '' : 'none';
      el.style.left = `${Math.min(window.innerWidth - 8, p.x)}px`;
      el.style.top = `${p.y}px`;
    });
  }
}
