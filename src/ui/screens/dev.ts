// Geliştirici paneli (?dev=1): FPS, fizik sabitleri (canlı), kalite, otopilot, tema,
// etap önizleyici. GitHub Pages'te de çalışır; telefonda ayar yapılabilir.

import { DEFAULT_PHYSICS, physics, resetPhysics, type PhysicsConfig } from '../../config/physics';
import type { ThemeId } from '../../config/theme';
import { validateLevel } from '../../game/levels/validate';
import type { LevelData } from '../../game/levels/types';
import type { Quality } from '../../game/render/common';
import { t } from '../../i18n';
import type { App } from '../app';
import { h } from '../dom';
import { toast } from '../toast';

const SLIDERS: [keyof PhysicsConfig, number, number, number][] = [
  ['gravity', 800, 6000, 50],
  ['friction', 0, 3, 0.05],
  ['restitution', 0, 0.95, 0.05],
  ['sagRatio', 0, 1.5, 0.05],
  ['endSpeed', 200, 1600, 10],
  ['maxLead', 20, 300, 5],
  ['maxTiltDeg', 8, 40, 1],
  ['ropeSensitivity', 0.5, 6, 0.1],
  ['tiltSensitivity', 0.2, 3, 0.1],
  ['maxBallSpeed', 400, 3000, 50],
  ['vacuumForce', 0, 3000, 50],
  ['windForce', 0, 3000, 50],
  ['magnetForce', 0, 3000, 50],
  ['armContact', 0.3, 1.2, 0.05],
  ['armBounce', 0, 1.5, 0.05],
  ['starPickupRadius', 20, 160, 5],
];

const SAMPLE: LevelData = {
  id: 'onizleme',
  name: 'Önizleme',
  world: 1,
  height: 4200,
  boardWidth: 1000,
  road: [
    { x: 500, y: 0, w: 260 },
    { x: 500, y: 300, w: 240 },
    { x: 330, y: 900, w: 210 },
    { x: 650, y: 1600, w: 180 },
    { x: 380, y: 2300, w: 150 },
    { x: 600, y: 3000, w: 190 },
    { x: 480, y: 3700, w: 210 },
    { x: 500, y: 4000, w: 200 },
  ],
  finishHole: { x: 500, y: 4000, r: 46 },
  checkpoints: [1600, 3000],
  stars: [
    { x: 380, y: 1000 },
    { x: 620, y: 2000 },
    { x: 560, y: 3300 },
  ],
  vacuum: [{ x: 330, y: 900, radius: 260, strength: 0.6 }],
  wind: [{ x: 0, y: 1900, w: 1000, h: 500, force: -0.35, pulse: 1.6 }],
  magnets: [{ x: 880, y: 2900, radius: 320, strength: 0.5, onOff: [2, 1.5] }],
  timeTargets: { bronze: 70, silver: 45, gold: 30 },
};

export class DevPanel {
  readonly el: HTMLElement;
  private toggleBtn: HTMLElement;
  private panel: HTMLElement;
  private fpsAcc = 0;
  private frames = 0;
  unlockAll = false;
  private autopilotBtn!: HTMLElement;

  constructor(private app: App) {
    this.toggleBtn = h('button.dev-toggle', { onclick: () => this.panel.classList.toggle('hidden') }, 'FPS --');
    this.panel = h('div.dev-panel.hidden');
    this.el = h('div', [this.panel, this.toggleBtn]);
    this.build();
  }

  private build(): void {
    const p = this.panel;
    p.append(h('h3', t('dev.title')));
    const valEls: Record<string, HTMLElement> = {};
    const inputs: Record<string, HTMLInputElement> = {};
    for (const [key, min, max, step] of SLIDERS) {
      const val = h('span.val', fmt(physics[key]));
      const input = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(physics[key]) }) as HTMLInputElement;
      input.addEventListener('input', () => {
        (physics as unknown as Record<string, number>)[key] = Number(input.value);
        val.textContent = fmt(physics[key]);
      });
      valEls[key] = val;
      inputs[key] = input;
      p.append(h('label', [h('span', key), input, val]));
    }
    p.append(
      h('div.btnrow', [
        h('button', {
          onclick: () => {
            resetPhysics();
            for (const [key] of SLIDERS) {
              inputs[key].value = String(DEFAULT_PHYSICS[key]);
              valEls[key].textContent = fmt(DEFAULT_PHYSICS[key]);
            }
          },
        }, t('dev.reset')),
        h('button', {
          onclick: () => {
            const diff: Record<string, number> = {};
            for (const [key] of SLIDERS) if (physics[key] !== DEFAULT_PHYSICS[key]) diff[key] = physics[key];
            const txt = JSON.stringify(diff);
            navigator.clipboard?.writeText(txt).catch(() => {});
            toast(this.app, txt || '{}', undefined, 5000);
          },
        }, 'Kopyala'),
      ]),
    );

    p.append(h('h3', t('dev.quality')));
    const qRow = h('div.btnrow');
    for (const q of ['high', 'medium', 'low'] as Quality[]) {
      qRow.append(h(`button${this.app.renderer.quality === q ? '.on' : ''}`, {
        onclick: (e: Event) => {
          this.app.setQuality(q);
          qRow.querySelectorAll('button').forEach((b) => b.classList.remove('on'));
          (e.currentTarget as HTMLElement).classList.add('on');
        },
      }, q));
    }
    p.append(qRow);

    p.append(h('h3', `${t('dev.autopilot')} · ${t('dev.theme')}`));
    this.autopilotBtn = h('button', {
      onclick: () => {
        const s = this.app.session;
        if (!s || s.opts.attract) return;
        const on = !s.autopilot;
        s.setAutopilot(on);
        this.autopilotBtn.classList.toggle('on', on);
      },
    }, t('dev.autopilot'));
    const themeRow = h('div.btnrow', [this.autopilotBtn]);
    for (const th of ['gunduz', 'aksam'] as ThemeId[]) {
      themeRow.append(h('button', {
        onclick: () => {
          this.app.themeOverride = th;
          this.app.renderer.setTheme(th);
        },
      }, th));
    }
    themeRow.append(
      h('button', { onclick: (e: Event) => { this.unlockAll = !this.unlockAll; (e.currentTarget as HTMLElement).classList.toggle('on', this.unlockAll); } }, t('dev.unlockAll')),
      h('button', { onclick: () => this.app.save.update((d) => (d.points += 5000)) }, t('dev.addPoints')),
    );
    p.append(themeRow);

    p.append(h('h3', t('dev.preview')));
    const ta = h('textarea', { placeholder: t('dev.previewHint'), spellcheck: 'false' }) as HTMLTextAreaElement;
    ta.value = JSON.stringify(SAMPLE, null, 1);
    const err = h('div.err');
    p.append(
      ta,
      h('div.btnrow', [
        h('button', {
          onclick: () => {
            const lvl = this.app.currentLevel;
            if (lvl) ta.value = JSON.stringify(lvl, null, 1);
          },
        }, 'Bu etap'),
        h('button.on', {
          onclick: () => {
            let data: unknown;
            try {
              data = JSON.parse(ta.value);
            } catch (e) {
              err.textContent = String(e);
              return;
            }
            const r = validateLevel(data);
            // Önizleme sadece var olan dünyaların görünümüyle (1–4)
            if (r.ok && ![1, 2, 3, 4].includes((data as LevelData).world)) r.errors.push('world 1–4 olmalı');
            if (r.errors.length) {
              err.textContent = r.errors.join('\n');
              return;
            }
            err.textContent = t('dev.valid');
            this.panel.classList.add('hidden');
            // Önizlemede puan ve rekor kaydedilmez
            void this.app.startLevel(data as LevelData, { preview: true });
          },
        }, t('dev.validate')),
      ]),
      err,
    );
  }

  update(dt: number): void {
    this.fpsAcc += dt;
    this.frames++;
    if (this.fpsAcc > 0.5) {
      this.toggleBtn.textContent = `FPS ${Math.round(this.frames / this.fpsAcc)} · ${this.app.renderer.quality}`;
      this.fpsAcc = 0;
      this.frames = 0;
    }
  }
}

function fmt(v: number): string {
  return Math.abs(v) >= 100 ? String(Math.round(v)) : v.toFixed(2);
}
