// Uygulama: ekranlar, oyun akışı, kayıt ve ödüller.

import { ASSIST, type BallType } from '../config/physics';
import { LEVELS_PER_WORLD, PLAYABLE_WORLDS, UNLOCK_BY_COMPLETION, WORLD_UNLOCK, pointsEarned, timeBonus, timeStars } from '../config/scoring';
import { themeForWorld, trackHex, type ThemeId } from '../config/theme';
import { parseGhost, type GhostData } from '../game/ghost';
import { KeyboardInput } from '../game/input/keyboard';
import { RopeInput } from '../game/input/ropes';
import { initBackButton } from '../platform/backButton';
import { LEVELS, getLevel, levelNumber, levelsOfWorld, nextLevel } from '../game/levels';
import type { LevelData } from '../game/levels/types';
import { effectiveCheckpoints } from '../game/physics/sim';
import { Track } from '../game/physics/track';
import type { Quality } from '../game/render/common';
import { GameRenderer } from '../game/render/scene';
import { GameSession, type SessionResult } from '../game/session';
import { t } from '../i18n';
import { play, setSoundEnabled, suspendAudio, unlockAudio } from '../platform/audio';
import { getQueryParam, isIOS, isLandscapePhone, isStandalone, isTouchDevice, requestFullscreen } from '../platform/device';
import { setHapticsEnabled, vibrate } from '../platform/haptics';
import { requestTilt, startTilt, tiltAvailable } from '../platform/tilt';
import { SaveStore } from '../save/save';
import type { LevelRecord, RunRecord } from '../save/schema';
import { h } from './dom';
import { Hud } from './hud';
import { showA2hs, showConfirm, showTiltPermission, showWorldUnlocked } from './screens/dialogs';
import { DevPanel } from './screens/dev';
import { levelEndScreen, type EndInfo } from './screens/levelEnd';
import { levelsScreen } from './screens/levels';
import { mapScreen } from './screens/map';
import { pauseOverlay } from './screens/pause';
import { settingsScreen } from './screens/settings';
import { shopScreen } from './screens/shop';
import { titleScreen } from './screens/title';
import { tutorialOverlay } from './screens/tutorial';
import { toast } from './toast';

const FIRST_LEVEL = 'w1-01';

export type ScreenName = 'title' | 'map' | 'levels' | 'game' | 'shop' | 'settings';

interface Mounted {
  el: HTMLElement;
  cleanup?: () => void;
}

export class App {
  readonly save = new SaveStore();
  readonly root: HTMLElement;
  readonly stage: HTMLElement;
  readonly screens: HTMLElement;
  readonly overlays: HTMLElement;
  readonly renderer: GameRenderer;
  readonly ropes: RopeInput;
  readonly keys = new KeyboardInput();
  readonly hud: Hud;
  readonly dev: DevPanel | null;
  session: GameSession | null = null;
  screen: ScreenName = 'title';
  currentLevel: LevelData | null = null;
  private current: Mounted | null = null;
  private overlay: Mounted | null = null;
  private lastFrame = performance.now();
  private render3D = true;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private fpsLowWindows = 0;
  fps = 60;
  themeOverride: ThemeId | null = null;
  ghostMode = false;
  private worldShown = 1;
  private rotateEl: HTMLElement;
  private firstTouchDone = false;

  constructor(root: HTMLElement) {
    this.root = root;
    const sky = h('div.sky', [h('div.sun')]);
    this.stage = h('div.stage');
    const inputLayer = h('div.input-layer');
    this.stage.append(inputLayer);
    this.screens = h('div');
    this.overlays = h('div');
    this.rotateEl = h('div.rotate', [h('b', t('rotate.title')), h('span', t('rotate.body'))]);
    root.append(sky, this.stage, this.screens, this.overlays, this.rotateEl);

    const q = (getQueryParam('q') as Quality | null) ?? (isTouchDevice() ? 'medium' : 'high');
    this.renderer = new GameRenderer(this.stage, ['high', 'medium', 'low'].includes(q) ? q : 'medium');
    this.stage.append(inputLayer);

    this.ropes = new RopeInput({
      enabled: () => (this.session && this.screen === 'game' && !this.session.paused ? this.session.ropesEnabled : [false, false]),
      ropeX: () => this.renderer.ropeScreenPositions,
      onGrab: () => {
        vibrate(8);
        play('grab');
      },
    });
    this.ropes.attach(inputLayer);
    this.hud = new Hud(this);
    this.stage.append(this.hud.el);

    const th = getQueryParam('theme');
    if (th === 'aksam' || th === 'gunduz') this.themeOverride = th;

    this.applySettings();
    this.dev = getQueryParam('dev') === '1' ? new DevPanel(this) : null;
    if (this.dev) root.append(this.dev.el);

    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseGame();
        suspendAudio();
      } else if (this.firstTouchDone) unlockAudio();
    });
    // Çift dokunmayla yakınlaştırma ve uzun basma menüsü olmasın
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    window.addEventListener(
      'pointerdown',
      () => {
        if (!this.firstTouchDone) {
          this.firstTouchDone = true;
          unlockAudio();
        }
      },
      { capture: true },
    );
    this.onResize();
    this.showTitle();
    initBackButton(() => this.handleBack());
    requestAnimationFrame(this.loop);
  }

  /** Telefonun geri tuşu. false dönerse uygulamadan çıkılır (sadece açılış ekranında). */
  private handleBack(): boolean {
    const backBtn = (root: HTMLElement | undefined) => root?.querySelector<HTMLButtonElement>('.round-btn.white');
    if (this.overlay) {
      const b = backBtn(this.overlay.el);
      if (b) b.click();
      else if (this.screen === 'game' && this.session?.paused && this.overlay.el.querySelector('.pause-list')) this.resumeGame();
      else if (this.screen === 'game' && this.currentLevel) this.showLevels(this.currentLevel.world);
      else this.closeOverlay();
      return true;
    }
    if (this.screen === 'title') return false;
    if (this.screen === 'game') {
      this.pauseGame();
      return true;
    }
    const b = backBtn(this.current?.el);
    if (b) b.click();
    else this.showTitle();
    return true;
  }

  // ---------- Ayarlar ----------

  applySettings(): void {
    const s = this.save.data.settings;
    setSoundEnabled(s.sound);
    setHapticsEnabled(s.vibration);
    this.renderer.setTrackColor(trackHex(s.trackColor));
    if (s.control === 'tilt') startTilt();
  }

  get theme(): ThemeId {
    if (this.themeOverride) return this.themeOverride;
    return themeForWorld(this.currentLevel?.world ?? this.worldShown);
  }

  // ---------- Döngü ----------

  private loop = (now: number): void => {
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (this.render3D && this.session) {
      this.session.frame(dt);
      this.renderer.render();
      this.hud.update();
    }
    this.measureFps(dt);
    this.dev?.update(dt);
    requestAnimationFrame(this.loop);
  };

  private measureFps(dt: number): void {
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc >= 2) {
      this.fps = this.fpsFrames / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
      // Kalite otomatik düşer (tarif 2.3)
      if (this.render3D && this.screen === 'game' && !document.hidden && this.fps < 48) {
        this.fpsLowWindows++;
        if (this.fpsLowWindows >= 2) {
          this.fpsLowWindows = 0;
          const q = this.renderer.quality;
          if (q === 'high') this.setQuality('medium');
          else if (q === 'medium') this.setQuality('low');
        }
      } else this.fpsLowWindows = 0;
    }
  }

  setQuality(q: Quality): void {
    this.renderer.setQuality(q);
    if (this.currentLevel && this.session) this.loadLevelVisuals(this.currentLevel, this.ghostMode);
  }

  private onResize = (): void => {
    this.renderer.resize(window.innerWidth, window.innerHeight);
    const land = isLandscapePhone();
    this.rotateEl.classList.toggle('show', land);
    if (land) this.pauseGame();
  };

  // ---------- Ekran yönetimi ----------

  private mount(name: ScreenName, m: Mounted, show3D: boolean): void {
    this.current?.cleanup?.();
    this.current?.el.remove();
    this.closeOverlay();
    this.current = m;
    this.screen = name;
    this.screens.append(m.el);
    this.render3D = show3D;
    this.stage.style.visibility = show3D ? 'visible' : 'hidden';
    this.hud.setVisible(name === 'game');
    this.renderer.setTheme(this.theme);
  }

  openOverlay(el: HTMLElement, cleanup?: () => void): void {
    this.closeOverlay();
    this.overlay = { el, cleanup };
    this.overlays.append(el);
  }

  closeOverlay(): void {
    this.overlay?.cleanup?.();
    this.overlay?.el.remove();
    this.overlay = null;
  }

  showTitle(): void {
    this.currentLevel = null;
    this.startAttract();
    this.mount('title', { el: titleScreen(this) }, true);
  }

  private startAttract(): void {
    const lvl = getLevel('w1-01') ?? LEVELS[0];
    this.worldShown = 1;
    this.loadLevelVisuals(lvl, false);
    const s = this.save.data.settings;
    this.session = new GameSession(
      { level: lvl, ball: this.save.data.ball, assist: false, ghost: null, control: 'ropes', ropeSide: s.ropeSide, sensitivity: s.sensitivity, tiltSensitivity: s.tiltSensitivity, tiltOffset: 0, attract: true },
      this.renderer,
      this.ropes,
      this.keys,
    );
  }

  showMap(): void {
    this.session = null;
    this.mount('map', { el: mapScreen(this) }, false);
  }

  showLevels(world: number): void {
    this.session = null;
    this.worldShown = world;
    this.mount('levels', { el: levelsScreen(this, world) }, false);
  }

  showShop(): void {
    const back = this.screen;
    this.session = null;
    const m = shopScreen(this, () => (back === 'map' ? this.showMap() : this.showTitle()));
    this.mount('shop', m, false);
  }

  showSettings(fromPause = false, afterBack?: () => void): void {
    if (fromPause) {
      // Oyun duraklatılmış kalır; ayarlar üstte açılır
      const m = settingsScreen(this, () => {
        this.closeOverlay();
        this.applySettings();
        // Değişen kontrol ayarları süren etaba da geçsin
        if (this.session && this.currentLevel) {
          this.session.applySettings(this.save.data.settings);
          this.hud.refreshControls();
        }
        if (afterBack) afterBack();
        else this.showPause();
      });
      m.el.style.zIndex = '30';
      this.openOverlay(m.el, m.cleanup);
      return;
    }
    const back = this.screen;
    this.session = null;
    const m = settingsScreen(this, () => {
      this.applySettings();
      if (back === 'map') this.showMap();
      else this.showTitle();
    });
    this.mount('settings', m, false);
  }

  // ---------- Oyun ----------

  /** Dünya/etap kilidi */
  totalStars(): number {
    let n = 0;
    // Sadece yoldan toplanan yıldızlar (süre ödülü madalyadır, yıldız sayılmaz)
    for (const r of Object.values(this.save.data.levels)) n += (r.stars ?? []).filter(Boolean).length;
    return n;
  }

  worldUnlocked(world: number): boolean {
    if (this.dev?.unlockAll) return true;
    if (!PLAYABLE_WORLDS.includes(world)) return false;
    if (this.totalStars() >= (WORLD_UNLOCK[world] ?? Infinity)) return true;
    // Dünya 4: önceki dünyanın bütün etaplarını bitiren de açar
    const prev = levelsOfWorld(world - 1);
    return UNLOCK_BY_COMPLETION.includes(world) && prev.length > 0 && prev.every((l) => this.save.data.levels[l.id]?.completed);
  }

  levelUnlocked(level: LevelData): boolean {
    if (this.dev?.unlockAll) return true;
    if (!this.worldUnlocked(level.world)) return false;
    const list = levelsOfWorld(level.world);
    const i = list.findIndex((l) => l.id === level.id);
    if (i <= 0) return true;
    return !!this.save.data.levels[list[i - 1].id]?.completed;
  }

  record(id: string): LevelRecord | undefined {
    return this.save.data.levels[id];
  }

  ghostFor(id: string, assist: boolean): GhostData | null {
    return parseGhost(this.save.getGhost(id, assist));
  }

  /** Etabı başlatır. Eğim modunda gerekirse izin ekranı gösterir. */
  /** Geliştirici önizlemesi: puan ve rekor kaydedilmez */
  private previewMode = false;

  async startLevel(level: LevelData, opts: { ghost?: boolean; preview?: boolean } = {}): Promise<void> {
    this.previewMode = !!opts.preview;
    requestFullscreen();
    unlockAudio();
    const s = this.save.data.settings;
    if (s.control === 'tilt') {
      const ok = await this.ensureTilt();
      if (!ok) {
        this.save.update((d) => (d.settings.control = 'ropes'));
        toast(this, t('tilt.denied'));
      }
    }
    this.currentLevel = level;
    this.worldShown = level.world;
    const assist = s.assist;
    const ghost = opts.ghost ? this.ghostFor(level.id, assist) : null;
    this.ghostMode = !!ghost;
    this.loadLevelVisuals(level, !!ghost);
    this.session = new GameSession(
      {
        level,
        ball: this.save.data.ball,
        assist,
        ghost,
        control: this.save.data.settings.control,
        ropeSide: s.ropeSide,
        sensitivity: s.sensitivity,
        tiltSensitivity: s.tiltSensitivity,
        tiltOffset: s.tiltOffset,
      },
      this.renderer,
      this.ropes,
      this.keys,
      {
        onStart: () => this.hud.hideHint(),
        onStar: () => this.hud.bumpStars(),
        onCheckpoint: () => this.hud.flash(t('hud.checkpoint'), 'ok'),
        onFall: (cause) => {
          const fromCp = !!this.session && this.session.sim.lastCheckpoint >= 0;
          if (cause === 'edge') this.hud.flash(t(fromCp ? 'hud.fell' : 'hud.fellStart'), 'warn');
          else this.hud.flash(`${t(`hud.cause.${cause}`)} ${t(fromCp ? 'hud.from.cp' : 'hud.from.start')}`, 'warn');
          // 5'ten fazla düşen ve yardım modu kapalı olan oyuncuya yardım modunu öner
          if (this.session && !this.session.opts.assist && this.session.sim.falls > ASSIST_TIP_FALLS) this.hud.suggestAssist();
        },
        onFinish: (r) => this.finishLevel(level, r),
      },
    );
    this.mount('game', { el: h('div') }, true);
    this.hud.prepare(level, !!ghost);
    // Birinci etapta nasıl oynandığını anlat (diğer etaplarda değil)
    if (level.id === FIRST_LEVEL && !ghost) this.showTutorial();
    // Bir engel ilk kez çıktığı etapta kısa bir ipucu
    const hint = obstacleHint(level);
    if (hint && !ghost) setTimeout(() => this.session && toast(this, t(hint), undefined, 5200), 2400);
  }

  private showTutorial(): void {
    if (!this.session) return;
    this.session.paused = true;
    const start = () => {
      this.closeOverlay();
      if (this.session) this.session.paused = false;
    };
    this.openOverlay(
      tutorialOverlay(this, start, () =>
        this.showSettings(true, () => {
          // Ayarlardan dönünce kart yeniden görünür, oyuncu Başla'ya basar
          this.showTutorial();
        }),
      ),
    );
  }

  private loadLevelVisuals(level: LevelData, ghost: boolean): void {
    const s = this.save.data.settings;
    this.renderer.setTheme(this.theme);
    this.renderer.setLevel({
      level,
      track: new Track(level),
      checkpoints: effectiveCheckpoints(level, s.assist),
      trackColor: trackHex(s.trackColor),
      ball: this.save.data.ball,
      costume: this.save.data.costume,
      ghost,
    });
    this.renderer.levelProps?.resetStars((level.stars ?? []).map(() => false));
  }

  private async ensureTilt(): Promise<boolean> {
    // Sensör zaten veri gönderiyorsa izin ekranını tekrar gösterme
    if (tiltAvailable()) return true;
    const ok = await new Promise<boolean>((resolve) => {
      showTiltPermission(this, async () => resolve(await this.searchTilt()), () => resolve(false), true);
    });
    return ok;
  }

  /** Sensörü ararken "aranıyor" yazısı gösterir (en fazla ~2 sn) */
  private async searchTilt(): Promise<boolean> {
    const note = toast(this, t('tilt.searching'), undefined, 0);
    const ok = await requestTilt();
    note.remove();
    return ok;
  }

  /** Eğim modu seçildiğinde (ayarlar) izin iste */
  async enableTiltMode(): Promise<boolean> {
    const ok = await new Promise<boolean>((resolve) => {
      showTiltPermission(this, async () => resolve(await this.searchTilt()), () => resolve(false), false);
    });
    if (!ok) toast(this, t('tilt.denied'));
    return ok;
  }

  pauseGame(): void {
    if (this.screen !== 'game' || !this.session || this.session.paused) return;
    if (this.session.sim.phase === 'finished' || this.session.sim.phase === 'finishing') return;
    this.session.paused = true;
    this.ropes.releaseAll();
    this.showPause();
  }

  showPause(): void {
    this.openOverlay(pauseOverlay(this));
  }

  resumeGame(): void {
    this.closeOverlay();
    if (this.session) this.session.paused = false;
  }

  restartLevel(ghost = false): void {
    if (!this.currentLevel) return;
    this.closeOverlay();
    // Hayaletle yarışta hayalet her seferinde son rekordan yeniden okunur
    if (ghost || ghost !== this.ghostMode) {
      void this.startLevel(this.currentLevel, { ghost, preview: this.previewMode });
      return;
    }
    this.session?.restart();
    this.hud.prepare(this.currentLevel, ghost);
    this.hud.setVisible(true);
  }

  private finishLevel(level: LevelData, r: SessionResult): void {
    if (this.screen !== 'game' || this.currentLevel?.id !== level.id) return;
    // Rekor, etap başladığındaki moda yazılır (oyun sırasında değişse bile)
    const assist = this.session?.opts.assist ?? this.save.data.settings.assist;
    const ball: BallType = this.save.data.ball;
    const prev = this.save.data.levels[level.id];
    const prevBest = assist ? prev?.bestAssist : prev?.best;
    const tStars = timeStars(r.time, level.timeTargets, assist);
    const bonus = timeBonus(r.time, level.timeTargets);
    const earned = this.previewMode ? 0 : pointsEarned(prev, tStars, r.stars, bonus);
    const isRecord = !prevBest || r.time < prevBest.time - 1e-6;
    const unlockedBefore = PLAYABLE_WORLDS.filter((w) => this.worldUnlocked(w));

    if (!this.previewMode) this.save.update((d) => {
      const rec: LevelRecord = d.levels[level.id] ?? { completed: false, timeStars: 0, stars: [], bonus: 0 };
      rec.completed = true;
      rec.timeStars = Math.max(rec.timeStars, tStars);
      rec.stars = r.stars.map((s, i) => s || !!rec.stars[i]);
      rec.bonus = Math.max(rec.bonus, bonus);
      const run: RunRecord = { time: r.time, ball, falls: r.falls };
      if (isRecord) {
        if (assist) rec.bestAssist = run;
        else rec.best = run;
      }
      d.levels[level.id] = rec;
      d.points += earned;
    });
    if (isRecord && !this.previewMode) this.save.setGhost(level.id, assist, JSON.stringify(r.ghost));

    const info: EndInfo = {
      level,
      time: r.time,
      falls: r.falls,
      timeStars: tStars,
      collected: r.stars.filter(Boolean).length,
      earned,
      prevBest: prevBest ?? null,
      isRecord,
      assist,
      ball,
      maxTimeStars: assist ? ASSIST.maxTimeStars : 3,
    };
    if (isRecord && prevBest) play('record');
    this.hud.setVisible(false);
    this.openOverlay(levelEndScreen(this, info));
    const newly = PLAYABLE_WORLDS.filter((w) => this.worldUnlocked(w) && !unlockedBefore.includes(w));
    const w = newly[0];
    if (w)
      setTimeout(() => {
        play('record');
        showWorldUnlocked(this, w, () => this.showLevels(w));
      }, 900);
  }

  nextLevelOf(level: LevelData): LevelData | null {
    const n = nextLevel(level);
    if (!n || !this.levelUnlocked(n)) return null;
    return n;
  }

  levelLabel(level: LevelData): string {
    return t('hud.level', { world: t(`world.short.${level.world}`), n: levelNumber(level) });
  }

  confirm(text: string, yes: string, onYes: () => void): void {
    showConfirm(this, text, yes, onYes);
  }

  maybeShowA2hs(): void {
    if (!isIOS() || isStandalone() || this.save.data.flags.a2hsShown) return;
    this.save.update((d) => (d.flags.a2hsShown = true));
    showA2hs(this);
  }

  levelsPerWorld = LEVELS_PER_WORLD;
}

/** Bu etap bir engel türünün ilk göründüğü etapsa o engelin ipucu anahtarı */
/** Bu kadar düşüşten sonra yardım modu önerilir */
const ASSIST_TIP_FALLS = 5;

function obstacleHint(level: LevelData): string | null {
  const kinds = [
    ['arm', (l: LevelData) => !!l.arms?.length],
    ['pop', (l: LevelData) => !!l.poppers?.length],
    ['hole', (l: LevelData) => !!l.holes?.length],
  ] as const;
  for (const [k, has] of kinds) {
    if (has(level) && LEVELS.find(has)?.id === level.id) return `hint.${k}`;
  }
  return null;
}
