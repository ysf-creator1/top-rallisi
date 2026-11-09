// Bir etap oturumu: sabit adımlı fizik döngüsü, girdiler, olaylar, hayalet ve görüntü durumu.

import { physics, type BallType } from '../config/physics';
import { play, setRoll } from '../platform/audio';
import { vibrate } from '../platform/haptics';
import { readTiltDeg, tiltAvailable } from '../platform/tilt';
import type { ControlMode } from '../save/schema';
import { Autopilot } from './autopilot';
import { GhostPlayer, GhostRecorder, ballScale, type GhostData, type GhostFrame } from './ghost';
import type { KeyboardInput } from './input/keyboard';
import type { RopeInput } from './input/ropes';
import type { LevelData } from './levels/types';
import type { FallCause } from './physics/obstacles';
import { obstacleTime } from './physics/obstacles';
import { ballCenter } from './physics/bar';
import { FALL_DURATION, Simulation, type SimEvent } from './physics/sim';
import type { GameRenderer, RenderState } from './render/scene';

export interface SessionOptions {
  level: LevelData;
  ball: BallType;
  assist: boolean;
  ghost: GhostData | null;
  control: ControlMode;
  ropeSide: 'left' | 'right';
  /** 0..1 */
  sensitivity: number;
  tiltSensitivity: number;
  tiltOffset: number;
  /** Açılış ekranındaki gösteri: otopilot oynar, ses ve titreşim yok */
  attract?: boolean;
}

export interface SessionResult {
  time: number;
  falls: number;
  stars: boolean[];
  ghost: GhostData;
  /** Gizli yıldız bu denemede bulundu */
  secret: boolean;
}

export interface SessionCallbacks {
  onStart?(): void;
  onStar?(index: number, total: number): void;
  onSecret?(): void;
  onCheckpoint?(index: number): void;
  onFall?(cause: FallCause): void;
  onRespawn?(): void;
  onFinish?(result: SessionResult): void;
}

/** Kamera turunun iniş süresi; toplam tur = INTRO_HOLD + INTRO_PAN */
const INTRO_PAN = 1.6;
/** Yeniden doğunca eğimin tamamen devreye girme süresi (sn) */
const TILT_EASE_SEC = 0.8;
const INTRO_HOLD = 0.6;

export class GameSession {
  sim: Simulation;
  paused = false;
  autopilot: Autopilot | null = null;
  /** Düşme animasyonu için topun kaydığı yön ve son yeniden doğma anı */
  private fallDir = 1;
  private spawnAt = -10;
  /** Etap başı kamera turu (sn): önce bitiş deliği görünür, sonra kamera topa iner */
  private intro = 0;
  private acc = 0;
  private time = 0;
  private recorder = new GhostRecorder();
  private ghostPlayer: GhostPlayer | null = null;
  private ghostFrame: GhostFrame = { yL: 0, yR: 0, u: 0, scale: 1 };
  private maxHeight = -Infinity;
  private finished = false;
  private kbTilt = 0;
  ghostDelta: number | null = null;
  /**
   * Yıldız süreleri hangi moda göre: deneme boyunca hep çift halatla oynandıysa 'ropes',
   * araya eğim modu girdiyse 'tilt' (daha uzun halat süreleri istismar edilmesin).
   */
  timeControl: ControlMode;
  /**
   * Halat koçunun gösterisi (ilk etaplar): halat düğümlerinin kayması (px),
   * uçların hayalet yükselişi ve hayalet topun kayması (birim). Fiziği etkilemez.
   */
  demo: { pull: [number, number]; lift: [number, number]; slide: number; ghost: boolean } | null = null;
  /** Kalibrasyon süresi (eğim modunda başta) */
  calibrating = 0;
  private calibSum = 0;
  private calibN = 0;
  tiltOffset: number;
  /** Süzülmüş sensör açısı (tek tük ani okumaları yumuşatır) */
  private tiltFilt: number | null = null;
  /** 0→1: yeniden doğunca / kalibrasyondan sonra eğim yavaşça devreye girer */
  private tiltEase = 1;

  constructor(
    readonly opts: SessionOptions,
    private renderer: GameRenderer,
    private ropes: RopeInput,
    private keys: KeyboardInput,
    private cb: SessionCallbacks = {},
  ) {
    this.sim = new Simulation(opts.level, { ball: opts.ball, assist: opts.assist });
    this.tiltOffset = opts.tiltOffset;
    this.timeControl = opts.control;
    if (opts.ghost) {
      this.ghostPlayer = new GhostPlayer(opts.ghost, opts.level.boardWidth, this.sim.depth, physics.ballRadius);
    }
    if (opts.attract) this.autopilot = new Autopilot();
    if (opts.control === 'tilt' && !opts.attract) this.calibrating = 1.0;
    renderer.follow(this.sim.ballY, 0, true);
    if (!opts.attract) this.intro = INTRO_HOLD + INTRO_PAN;
  }

  /** Etap başındaki kamera turu sürüyor mu */
  get introActive(): boolean {
    return this.intro > 0 && !this.sim.started;
  }

  get raceTime(): number {
    return this.sim.raceTime;
  }

  get starsCollected(): number {
    return this.sim.starsCollected.filter(Boolean).length;
  }

  /** Etkin halatlar: [sol, sağ] */
  get ropesEnabled(): [boolean, boolean] {
    if (this.opts.attract) return [true, true];
    if (this.opts.control === 'tilt') return this.opts.ropeSide === 'left' ? [true, false] : [false, true];
    return [true, true];
  }

  frame(dtReal: number): void {
    const dt = Math.min(0.1, Math.max(0, dtReal));
    this.time += dt;
    if (!this.paused) {
      this.applyInput(dt);
      this.acc += dt;
      const stepDt = 1 / physics.stepHz;
      let n = 0;
      while (this.acc >= stepDt && n < 14) {
        this.autopilot?.control(this.sim);
        this.sim.step();
        if (!this.opts.attract) this.recorder.sample(this.sim);
        this.handleEvents(this.sim.drainEvents());
        if (this.sim.phase === 'playing') this.maxHeight = Math.max(this.maxHeight, this.sim.ballY);
        this.acc -= stepDt;
        n++;
      }
      if (n === 14) this.acc = 0;
      this.renderer.levelProps?.revealSecret(this.sim.ballX, this.sim.ballY, this.time);
      if (this.ghostPlayer && this.sim.started && this.sim.phase !== 'finished') {
        this.ghostDelta = this.ghostPlayer.delta(this.sim.raceTime, this.maxHeight);
      }
      if (this.opts.attract && this.sim.phase === 'finished') this.restart();
    }
    if (!this.opts.attract) {
      const speed = this.sim.phase === 'playing' && !this.paused ? Math.abs(this.sim.v) / 900 : 0;
      setRoll(speed);
    }
    this.ropes.update(dt, [-window.innerHeight * 0.42, window.innerHeight * 0.16]);
    if (this.intro > 0 && !this.sim.started) {
      if (!this.paused) this.intro -= dt;
      // İlk 0,6 sn delikte bekler, sonra 1,6 sn'de yumuşakça topa iner
      const k = 1 - Math.max(0, Math.min(1, this.intro / INTRO_PAN));
      const e = k * k * (3 - 2 * k);
      const holeY = this.opts.level.finishHole.y;
      this.renderer.follow(holeY + (this.sim.ballY - holeY) * e, dt, true);
    } else {
      this.intro = 0;
      this.renderer.follow(this.sim.ballY, dt);
    }
    this.renderer.update(this.renderState(), dt);
  }

  private applyInput(dt: number): void {
    const sim = this.sim;
    const sens = 0.5 + this.opts.sensitivity;
    const [pxL, pxR] = this.ropes.consume();
    if (this.opts.attract || this.autopilot) return;
    const k = physics.ropeSensitivity * sens;
    const kbRate = physics.endSpeed * 0.85 * dt;

    if (this.opts.control === 'tilt') {
      // Eğim: telefon sağa eğilince sağ uç alçalır
      let deg = 0;
      if (tiltAvailable()) {
        const raw0 = readTiltDeg();
        // Hafif süzgeç (~60 ms): sensörün tek tük sıçramaları çubuğa yansımasın
        this.tiltFilt = this.tiltFilt === null ? raw0 : this.tiltFilt + (raw0 - this.tiltFilt) * (1 - Math.exp(-dt / 0.06));
        const raw = this.tiltFilt;
        if (this.calibrating > 0) {
          this.calibrating -= dt;
          this.calibSum += raw;
          this.calibN++;
          if (this.calibrating <= 0) {
            this.tiltOffset = this.calibSum / Math.max(1, this.calibN);
            this.tiltEase = 0;
          }
          return;
        }
        deg = raw - this.tiltOffset;
        if (Math.abs(deg) < 1.5) deg = 0;
        else deg -= Math.sign(deg) * 1.5;
      } else {
        this.calibrating = 0;
      }
      const kb = this.keys.tilt();
      this.kbTilt += kb.tilt * dt * 40;
      if (kb.tilt === 0) this.kbTilt *= Math.exp(-dt * 3);
      this.kbTilt = Math.max(-physics.maxTiltDeg, Math.min(physics.maxTiltDeg, this.kbTilt));
      const mult = 0.6 + this.opts.tiltSensitivity * 1.2;
      // Yeniden doğunca çubuk telefonun o anki eğimine sıçramasın: ~0,8 sn'de yumuşakça gelsin
      this.tiltEase = Math.min(1, this.tiltEase + dt / TILT_EASE_SEC);
      const ease = this.tiltEase * this.tiltEase * (3 - 2 * this.tiltEase);
      const tiltDeg = -(deg * mult * ease + this.kbTilt);
      const pull = this.opts.ropeSide === 'left' ? pxL : pxR;
      const lift = pull * k + kb.lift * kbRate;
      sim.setTiltLift((tiltDeg * Math.PI) / 180, lift);
    } else {
      const [kl, kr] = this.keys.ropes();
      const dL = pxL * k + kl * kbRate;
      const dR = pxR * k + kr * kbRate;
      if (dL !== 0 || dR !== 0) sim.nudge(dL, dR);
    }
  }

  private handleEvents(events: SimEvent[]): void {
    if (!events.length) return;
    const quiet = !!this.opts.attract;
    for (const e of events) {
      switch (e.type) {
        case 'start':
          this.cb.onStart?.();
          break;
        case 'star':
          this.renderer.levelProps?.collectStar(e.index, this.time);
          if (!quiet) {
            play('star');
            vibrate(18);
          }
          this.cb.onStar?.(e.index, this.starsCollected);
          break;
        case 'secret':
          this.renderer.levelProps?.collectSecret(this.time);
          if (!quiet) {
            play('record');
            vibrate(30);
          }
          this.cb.onSecret?.();
          break;
        case 'checkpoint':
          if (!quiet) {
            play('checkpoint');
            vibrate(12);
          }
          this.cb.onCheckpoint?.(e.index);
          break;
        case 'fall':
          this.fallDir = this.sim.v < 0 ? -1 : 1;
          if (!quiet) {
            play('fall');
            vibrate([30, 40, 30]);
          }
          this.ropes.releaseAll();
          this.cb.onFall?.(e.cause);
          break;
        case 'respawn':
          this.spawnAt = this.time;
          this.tiltEase = 0;
          this.renderer.follow(this.sim.ballY, 0.3);
          this.cb.onRespawn?.();
          break;
        case 'wall':
          if (!quiet && e.strength > 0.15) {
            play('wall', e.strength);
            if (e.strength > 0.35) vibrate(8);
          }
          break;
        case 'finish':
          if (!quiet) {
            play('finish');
            vibrate([20, 30, 60]);
          }
          if (!this.finished && !quiet) {
            this.finished = true;
            const ghost = this.recorder.finish(this.sim, this.opts.level.id, this.opts.ball);
            const result: SessionResult = { time: e.time, falls: this.sim.falls, stars: [...this.sim.starsCollected], ghost, secret: this.sim.secretFound };
            // Delik animasyonu bitsin diye kısa gecikme
            setTimeout(() => this.cb.onFinish?.(result), 900);
          }
          break;
      }
    }
  }

  private renderState(): RenderState {
    const sim = this.sim;
    let ghost: RenderState['ghost'] = null;
    if (this.ghostPlayer) {
      const f = this.ghostPlayer.sample(sim.started ? sim.raceTime : 0, this.ghostFrame);
      const c = this.ghostPlayer.ballAt(f);
      ghost = { yL: f.yL, yR: f.yR, x: c.x, y: c.y, scale: f.scale };
    } else if (this.demo?.ghost && sim.phase === 'playing') {
      const d = this.demo;
      let yL = sim.yL + d.lift[0];
      let yR = sim.yR + d.lift[1];
      // Eğim sınırı aşılmasın (fizikteki gibi)
      const md = sim.maxDiff * 0.9;
      const diff = yR - yL;
      if (Math.abs(diff) > md) {
        const ex = diff - Math.sign(diff) * md;
        if (d.lift[0] >= d.lift[1]) yL += ex;
        else yR -= ex;
      }
      const u = Math.max(sim.width * 0.12, Math.min(sim.width * 0.88, sim.u + d.slide));
      const c = ballCenter(yL, yR, u, sim.width, sim.depth, physics.ballRadius);
      ghost = { yL, yR, x: c.x, y: c.y, scale: 1, strong: true };
    }
    const demoPull = this.demo?.pull ?? [0, 0];
    const en = this.ropesEnabled;
    const rope = (i: 0 | 1) => ({
      visible: en[i],
      gripPx: this.ropes.grips[i]?.y ?? null,
      offsetPx: this.ropes.offset[i] + demoPull[i] + (this.opts.attract ? Math.sin(this.time * 1.3 + i) * 8 : 0),
      scroll: this.ropes.scroll[i] + demoPull[i] + (this.opts.attract ? (i === 0 ? this.sim.yL : this.sim.yR) * 0.3 : 0),
    });
    return {
      yL: sim.yL,
      yR: sim.yR,
      ballX: sim.ballX,
      ballY: sim.ballY,
      roll: sim.roll,
      ballScale: ballScale(sim),
      fall: sim.phase === 'falling' ? { t: Math.min(1, sim.phaseTime / (FALL_DURATION * 0.85)), dir: this.fallDir, ...sim.fallInfo } : null,
      spawn: Math.min(1, (this.time - this.spawnAt) / 0.32),
      ghost,
      ropes: [rope(0), rope(1)],
      time: this.time,
      obsTime: obstacleTime(sim.simTime, sim.opts.assist),
    };
  }

  restart(): void {
    this.sim = new Simulation(this.opts.level, { ball: this.opts.ball, assist: this.opts.assist });
    this.recorder = new GhostRecorder();
    this.maxHeight = -Infinity;
    this.finished = false;
    this.acc = 0;
    this.ghostDelta = null;
    this.timeControl = this.opts.control;
    this.paused = false;
    this.ropes.releaseAll();
    this.renderer.levelProps?.resetStars(this.sim.starsCollected);
    this.renderer.levelProps?.resetSecret();
    this.renderer.follow(this.sim.ballY, 0, true);
    if (this.opts.control === 'tilt' && !this.opts.attract) {
      this.calibrating = 1.0;
      this.calibSum = 0;
      this.calibN = 0;
    }
  }

  /** Oyun sırasında değişen ayarları uygular (duraklatma → Ayarlar). */
  applySettings(s: { control: ControlMode; ropeSide: 'left' | 'right'; sensitivity: number; tiltSensitivity: number }): void {
    const switchedToTilt = s.control === 'tilt' && this.opts.control !== 'tilt';
    this.opts.control = s.control;
    if (s.control === 'tilt') this.timeControl = 'tilt';
    this.opts.ropeSide = s.ropeSide;
    this.opts.sensitivity = s.sensitivity;
    this.opts.tiltSensitivity = s.tiltSensitivity;
    this.ropes.releaseAll();
    if (switchedToTilt && !this.opts.attract) {
      this.calibrating = 1.0;
      this.calibSum = 0;
      this.calibN = 0;
    }
  }

  setAutopilot(on: boolean): void {
    this.autopilot = on ? new Autopilot() : this.opts.attract ? this.autopilot : null;
  }
}
