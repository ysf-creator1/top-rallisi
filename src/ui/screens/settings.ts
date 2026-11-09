// Ayarlar (hedef: docs/tasarim/07-gunduz-ayarlar.png)

import { TRACK_COLORS, trackHex, trackPalette } from '../../config/theme';
import { t } from '../../i18n';
import { analyticsEnabled, setAnalyticsEnabled } from '../../platform/analytics';
import { hapticsSupported } from '../../platform/haptics';
import { isIOS } from '../../platform/device';
import type { App } from '../app';
import { h, svg } from '../dom';
import { icons } from '../icons';
import { toast } from '../toast';

const BALL_GRAD: Record<string, [string, string, string]> = {
  standard: ['#FFFFFF', '#F2F4F6', '#C9D1D8'],
  heavy: ['#FAFAFA', '#E3E4E7', '#A9ADB4'],
  light: ['#FFF7F1', '#FBE1D3', '#E9B49C'],
  rubber: ['#EFFAF5', '#BFE6D5', '#7FBFA4'],
  ice: ['#FFFFFF', '#DDF0FA', '#8FC3DE'],
};

export function ballGradient(type: string): [string, string, string] {
  return BALL_GRAD[type] ?? BALL_GRAD.standard;
}

function previewSvg(trackColor: string, ball: string): string {
  const pal = trackPalette(trackColor);
  const [g0, g1, g2] = ballGradient(ball);
  const contour = pal.needsContour ? `<circle cx="179" cy="47" r="11.5" fill="none" stroke="#3B3F45" stroke-width="2"/>` : '';
  return `<svg viewBox="0 0 358 118" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<defs><linearGradient id="ps" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sky-top)"/><stop offset="1" stop-color="var(--sky-horizon)"/></linearGradient>
<radialGradient id="pb" cx="0.38" cy="0.32" r="0.78"><stop offset="0" stop-color="${g0}"/><stop offset="0.5" stop-color="${g1}"/><stop offset="1" stop-color="${g2}"/></radialGradient></defs>
<rect width="358" height="118" fill="url(#ps)"/>
<circle cx="40" cy="62" r="22" fill="#A9CAA7"/><circle cx="70" cy="58" r="18" fill="#A9CAA7"/><circle cx="310" cy="58" r="22" fill="#A9CAA7"/><circle cx="340" cy="64" r="18" fill="#A9CAA7"/>
<rect y="74" width="358" height="44" fill="#BFE0A8"/>
<path d="M-10 100 C60 92 110 40 180 40 C250 40 300 92 368 100 L368 140 L-10 140Z" fill="${pal.edge}" transform="translate(3 6)" opacity=".35"/>
<path d="M-10 96 C60 88 110 36 180 36 C250 36 300 88 368 96 L368 140 L-10 140Z" fill="${pal.edge}"/>
<path d="M-10 99 C60 91 110 39 180 39 C250 39 300 91 368 99 L368 140 L-10 140Z" fill="${pal.fill}"/>
<path d="M118 56 Q179 66 240 54" fill="none" stroke="#98A1AA" stroke-width="5" stroke-linecap="round"/>
<path d="M118 56 Q179 66 240 54" fill="none" stroke="#DCE1E5" stroke-width="3" stroke-linecap="round"/>
<ellipse cx="181" cy="60" rx="8" ry="2" fill="#000" opacity=".2"/>
<circle cx="179" cy="47" r="11" fill="url(#pb)" ${ball === 'ice' ? 'opacity=".92"' : ''}/>${contour}
<circle cx="175" cy="43" r="3" fill="#fff" opacity=".85"/>
</svg>`;
}

function toggle(on: boolean, onChange: (v: boolean) => void, label: string): HTMLElement {
  const b = h(`button.toggle${on ? '.on' : ''}`, { 'aria-pressed': String(on), 'aria-label': label }, [h('span')]);
  b.addEventListener('click', () => {
    const v = !b.classList.contains('on');
    b.classList.toggle('on', v);
    b.setAttribute('aria-pressed', String(v));
    onChange(v);
  });
  return b;
}

function segmented(options: { label: string; value: string }[], value: string, onChange: (v: string) => void, small = false): HTMLElement {
  const el = h(`div.segmented${small ? '.small' : ''}`);
  const btns = options.map((o) =>
    h(`button${o.value === value ? '.on' : ''}`, {
      onclick: () => {
        btns.forEach((b, i) => b.classList.toggle('on', options[i].value === o.value));
        onChange(o.value);
      },
    }, o.label),
  );
  el.append(...btns);
  return el;
}

function sensLabel(v: number): string {
  return v < 0.34 ? t('settings.sens.low') : v > 0.66 ? t('settings.sens.high') : t('settings.sens.mid');
}

function slider(value: number, onChange: (v: number) => void, label: string): HTMLElement {
  const val = h('span', { style: { fontWeight: '700', color: 'var(--muted)' } }, sensLabel(value));
  const input = h('input', { type: 'range', min: '0', max: '100', value: String(Math.round(value * 100)), 'aria-label': label }) as HTMLInputElement;
  input.addEventListener('input', () => {
    const v = Number(input.value) / 100;
    val.textContent = sensLabel(v);
    onChange(v);
  });
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, [
    h('div.row', { style: { fontSize: '14px', fontWeight: '800' } }, [h('span', label), val]),
    input,
  ]);
}

export function settingsScreen(app: App, onBack: () => void): { el: HTMLElement; cleanup?: () => void } {
  const save = app.save;
  const s = () => save.data.settings;
  const preview = h('div.preview-box', { html: previewSvg(trackHex(s().trackColor), save.data.ball) });
  preview.append(h('div.preview-tag', t('settings.preview').toLocaleUpperCase('tr')));
  const colorName = h('span', { style: { fontSize: '13px', fontWeight: '700', color: 'var(--muted)' } });
  const setColorName = () => {
    const id = s().trackColor;
    colorName.textContent = t(`track.${id}`) + (id === 'black' ? ` · ${t('settings.default')}` : '');
  };
  setColorName();

  const colorBtns = TRACK_COLORS.map((c) =>
    h(`button${c.id === s().trackColor ? '.on' : ''}`, {
      'aria-label': t(`track.${c.id}`),
      onclick: () => {
        save.update((d) => (d.settings.trackColor = c.id));
        colorBtns.forEach((b, i) => b.classList.toggle('on', TRACK_COLORS[i].id === c.id));
        preview.firstElementChild!.outerHTML = previewSvg(c.hex, save.data.ball);
        setColorName();
        app.renderer.setTrackColor(c.hex);
      },
    }, [h('span.dot', { style: { background: c.hex } }), t(`track.${c.id}`)]),
  );

  // Kontroller
  const tiltRows = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } });
  const renderTiltRows = () => {
    tiltRows.innerHTML = '';
    if (s().control !== 'tilt') return;
    tiltRows.append(
      slider(s().tiltSensitivity, (v) => save.update((d) => (d.settings.tiltSensitivity = v)), t('settings.tiltSensitivity')),
    );
  };
  const control = segmented(
    [
      { label: t('settings.ctrl.ropes'), value: 'ropes' },
      { label: t('settings.ctrl.tilt'), value: 'tilt' },
    ],
    s().control,
    async (v) => {
      if (v === 'tilt') {
        const ok = await app.enableTiltMode();
        if (!ok) {
          (control.children[0] as HTMLElement).click();
          return;
        }
      }
      save.update((d) => (d.settings.control = v as 'ropes' | 'tilt'));
      renderTiltRows();
    },
  );
  renderTiltRows();

  const iosNote = isIOS() || !hapticsSupported();
  const el = h('div.screen', [
    h('div.screen-inner', [
      h('div.header', [
        h('button.round-btn.white', { 'aria-label': t('common.back'), onclick: onBack }, [svg(icons.back())]),
        h('div.title', t('settings.title')),
      ]),
      preview,
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, [
        h('div.row', { style: { alignItems: 'baseline' } }, [h('span.section-title', t('settings.trackColor')), colorName]),
        h('div.color-grid', colorBtns),
      ]),
      h('div.card', [
        h('span.section-title', t('settings.controls')),
        control,
        h('div.row', [
          h('span.label', [t('settings.ropeSide'), h('small', t('settings.ropeSideSub'))]),
          segmented(
            [
              { label: t('settings.left'), value: 'left' },
              { label: t('settings.right'), value: 'right' },
            ],
            s().ropeSide,
            (v) => save.update((d) => (d.settings.ropeSide = v as 'left' | 'right')),
            true,
          ),
        ]),
        slider(s().sensitivity, (v) => save.update((d) => (d.settings.sensitivity = v)), t('settings.sensitivity')),
        tiltRows,
      ]),
      h('div.card', { style: { padding: '6px 16px', gap: '0' } }, [
        h('div.row.list-row', [
          h('span.label', [t('settings.assist'), h('small', t('settings.assistSub'))]),
          toggle(s().assist, (v) => save.update((d) => (d.settings.assist = v)), t('settings.assist')),
        ]),
        h('div.row.list-row', [
          h('span.label', [t('settings.vibration'), iosNote ? h('small', t('settings.vibrationNote')) : null]),
          toggle(s().vibration, (v) => {
            save.update((d) => (d.settings.vibration = v));
            app.applySettings();
          }, t('settings.vibration')),
        ]),
        h('div.row.list-row', [
          h('span.label', t('settings.sound')),
          toggle(s().sound, (v) => {
            save.update((d) => (d.settings.sound = v));
            app.applySettings();
          }, t('settings.sound')),
        ]),
        h('div.row.list-row', [
          h('span.label', [t('settings.stats'), h('small', t('settings.statsSub'))]),
          toggle(analyticsEnabled(), (v) => setAnalyticsEnabled(v), t('settings.stats')),
        ]),
      ]),
      h('p.note', t('settings.saveNote')),
      h('button.danger-btn', {
        onclick: () =>
          app.confirm(t('settings.resetConfirm'), t('settings.resetYes'), () => {
            save.reset();
            toast(app, t('settings.resetDone'));
          }),
      }, t('settings.reset')),
      h('p.note', { style: { fontSize: '11px' } }, t('settings.version', { v: __APP_VERSION__ })),
    ]),
  ]);
  return { el };
}
