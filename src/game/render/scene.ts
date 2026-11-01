// Three.js sahnesi: iki katman.
//  - Arka sahne (park): kendi kamerası yavaş kayar → paralaks, hafif sis.
//  - Ön sahne (stand, parkur, çubuk, top, halatlar): kamera topu takip eder.
// Gökyüzü CSS gradyanıdır (tuvalin arkasında). Fizik durumunu sadece çizer.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { physics, type BallType } from '../../config/physics';
import { THEMES, type SceneTheme, type ThemeId } from '../../config/theme';
import type { Costume } from '../../save/schema';
import type { LevelData } from '../levels/types';
import type { Track } from '../physics/track';
import { BallView } from './ball';
import { BAR_Z, GROUND_Y, LEAN, S, canvasTexture, disposeTree, makeCanvas, type Quality } from './common';
import { applyParkTheme, buildPark, type ParkParts } from './park';
import { Props } from './props';
import { ROPE_R, RopeView } from './rope';
import { BarView, POST_X, applyStandTheme, buildStand, type StandParts } from './stand';
import { TrackSurface } from './track';

const FOV = 35;
const VIEW_W = 14.4;
const MIN_VIEW_H = 24;
const PITCH = 0.035;
const BG_PARALLAX = 0.12;

export interface RopeVisual {
  visible: boolean;
  /** Tutan parmağın ekran y'si (px), yoksa null */
  gripPx: number | null;
  /** Düğümün dinlenme yerinden kayması (px) */
  offsetPx: number;
  scroll: number;
}

export interface RenderState {
  yL: number;
  yR: number;
  ballX: number;
  ballY: number;
  roll: number;
  ballScale: number;
  ghost: { yL: number; yR: number; x: number; y: number; scale: number } | null;
  ropes: [RopeVisual, RopeVisual];
  time: number;
}

export interface LevelVisualOptions {
  level: LevelData;
  track: Track;
  checkpoints: number[];
  trackColor: string;
  ball: BallType;
  costume: Costume;
  ghost: boolean;
}

const QUALITY_SETTINGS: Record<Quality, { dpr: number; shadow: number }> = {
  high: { dpr: 2, shadow: 2048 },
  medium: { dpr: 1.5, shadow: 1024 },
  low: { dpr: 1, shadow: 512 },
};

export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 400);
  private bgCamera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 600);
  private bgScene = new THREE.Scene();
  private fgScene = new THREE.Scene();
  private standGroup = new THREE.Group();
  private levelGroup = new THREE.Group();
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private bgSun: THREE.DirectionalLight;
  private bgHemi: THREE.HemisphereLight;
  private envMap: THREE.Texture;
  private park: ParkParts;
  private stand: StandParts | null = null;
  private trackSurface: TrackSurface | null = null;
  private props: Props | null = null;
  private bar: BarView | null = null;
  private ball: BallView | null = null;
  private ghostBar: BarView | null = null;
  private ghostBall: BallView | null = null;
  private ropes: [RopeView, RopeView];
  private groundShadow: THREE.Mesh;
  theme: SceneTheme = THEMES.gunduz;
  quality: Quality;

  private width = 1;
  private height = 1;
  private viewH = 30;
  private dist = 50;
  private focusY = 0;
  private focusMin = 0;
  private focusMax = 0;
  private startCamY = 0;
  private tmpV = new THREE.Vector3();
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane();
  private standInv = new THREE.Matrix4();
  private ropeLocalX: [number, number] = [-6.6, 6.6];
  private ropeScreenX: [number, number] = [20, 370];
  private levelTop = 30;

  constructor(container: HTMLElement, quality: Quality) {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', stencil: false });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.autoClear = false;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'game-canvas';
    container.appendChild(this.canvas);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Ön sahne ışıkları
    this.sun = new THREE.DirectionalLight(this.theme.sunColor, this.theme.sunIntensity);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 5;
    this.sun.shadow.blurSamples = 12;
    this.fgScene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(this.theme.hemiSky, this.theme.hemiGround, this.theme.hemiIntensity);
    this.fgScene.add(this.hemi);
    // Arka sahne ışıkları
    this.bgSun = new THREE.DirectionalLight(this.theme.sunColor, this.theme.sunIntensity * 0.9);
    this.bgSun.position.set(-30, 50, 30);
    this.bgScene.add(this.bgSun);
    this.bgHemi = new THREE.HemisphereLight(this.theme.hemiSky, this.theme.hemiGround, this.theme.hemiIntensity);
    this.bgScene.add(this.bgHemi);
    this.bgScene.fog = new THREE.Fog(this.theme.fog, 70, 230);

    this.park = buildPark(this.theme, quality);
    this.bgScene.add(this.park.group);

    // Stand yatık grup içinde
    this.standGroup.rotation.x = -LEAN;
    this.fgScene.add(this.standGroup);
    this.standGroup.add(this.levelGroup);

    // Standın çime düşen bulanık gölgesi + gölge yakalayıcı
    const sc = makeCanvas(256, 128);
    const sctx = sc.getContext('2d')!;
    const grad = sctx.createRadialGradient(128, 64, 4, 128, 64, 124);
    grad.addColorStop(0, 'rgba(46,70,44,0.55)');
    grad.addColorStop(0.6, 'rgba(46,70,44,0.22)');
    grad.addColorStop(1, 'rgba(46,70,44,0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 256, 128);
    this.groundShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(17, 5),
      new THREE.MeshBasicMaterial({ map: canvasTexture(sc), transparent: true, depthWrite: false }),
    );
    this.groundShadow.rotation.x = -Math.PI / 2;
    this.groundShadow.position.set(0.4, GROUND_Y + 0.01, -0.4);
    this.fgScene.add(this.groundShadow);
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.18 }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.y = GROUND_Y;
    catcher.receiveShadow = true;
    this.fgScene.add(catcher);

    this.ropes = [new RopeView(), new RopeView()];
    for (const r of this.ropes) this.standGroup.add(r.group);

    this.applyQuality();
    this.applyThemeLights();
  }

  // ---------- Etap ----------

  setLevel(o: LevelVisualOptions): void {
    this.clearLevel();
    const L = o.level;
    this.levelTop = L.finishHole.y;
    const stand = buildStand(L.finishHole.y, this.theme);
    this.stand = stand;
    this.levelGroup.add(stand.local);
    this.fgScene.add(stand.world);

    this.trackSurface = new TrackSurface(L, o.track, o.trackColor, this.quality, o.checkpoints);
    this.levelGroup.add(this.trackSurface.group);

    this.props = new Props(L, o.track, o.checkpoints, this.envMap, this.theme.flag);
    this.levelGroup.add(this.props.group);

    this.bar = new BarView(L.boardWidth, this.envMap, false, [stand.pulleyL, stand.pulleyR]);
    this.levelGroup.add(this.bar.group);
    for (const m of this.bar.stringMeshes) this.levelGroup.add(m);

    this.setBall(o.ball, o.costume);

    if (o.ghost) {
      this.ghostBar = new BarView(L.boardWidth, null, true);
      this.levelGroup.add(this.ghostBar.group);
      this.ghostBall = new BallView({ type: o.ball, ghost: true, radius: physics.ballRadius * S });
      this.levelGroup.add(this.ghostBall.root);
    }
    this.updateFocusLimits();
  }

  setBall(type: BallType, costume: Costume): void {
    if (this.ball) {
      this.levelGroup.remove(this.ball.root);
      disposeTree(this.ball.root);
    }
    this.ball = new BallView({ type, costume, radius: physics.ballRadius * S });
    this.ball.setContour(this.trackSurface?.needsContour ?? false);
    this.levelGroup.add(this.ball.root);
  }

  setTrackColor(hex: string): void {
    this.trackSurface?.setColor(hex);
    this.ball?.setContour(this.trackSurface?.needsContour ?? false);
  }

  private clearLevel(): void {
    if (this.stand) {
      this.fgScene.remove(this.stand.world);
      disposeTree(this.stand.world);
    }
    this.trackSurface?.dispose();
    for (const c of [...this.levelGroup.children]) {
      this.levelGroup.remove(c);
      disposeTree(c);
    }
    this.stand = null;
    this.trackSurface = null;
    this.props = null;
    this.bar = null;
    this.ball = null;
    this.ghostBar = null;
    this.ghostBall = null;
  }

  get levelProps(): Props | null {
    return this.props;
  }

  // ---------- Tema ve kalite ----------

  setTheme(id: ThemeId): void {
    this.theme = THEMES[id];
    applyParkTheme(this.park, this.theme);
    if (this.stand) applyStandTheme(this.stand, this.theme);
    this.applyThemeLights();
  }

  private applyThemeLights(): void {
    const th = this.theme;
    this.sun.color.set(th.sunColor);
    this.sun.intensity = th.sunIntensity;
    this.hemi.color.set(th.hemiSky);
    this.hemi.groundColor.set(th.hemiGround);
    this.hemi.intensity = th.hemiIntensity;
    this.bgSun.color.set(th.sunColor);
    this.bgSun.intensity = th.sunIntensity * 0.9;
    this.bgHemi.color.set(th.hemiSky);
    this.bgHemi.groundColor.set(th.hemiGround);
    this.bgHemi.intensity = th.hemiIntensity;
    (this.bgScene.fog as THREE.Fog).color.set(th.fog);
    this.renderer.toneMappingExposure = th.exposure;
    const root = document.documentElement.style;
    root.setProperty('--sky-top', th.sky[0]);
    root.setProperty('--sky-mid', th.sky[1]);
    root.setProperty('--sky-horizon', th.sky[2]);
    root.setProperty('--sun-glow', th.sunGlow);
    root.setProperty('--sun-disc', th.sunDisc);
    document.body.dataset.theme = th.id;
  }

  setQuality(q: Quality): void {
    if (q === this.quality) return;
    this.quality = q;
    this.applyQuality();
  }

  private applyQuality(): void {
    const qs = QUALITY_SETTINGS[this.quality];
    this.renderer.setPixelRatio(Math.min(qs.dpr, window.devicePixelRatio || 1));
    this.sun.shadow.mapSize.set(qs.shadow, qs.shadow);
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      (this.sun.shadow as { map: THREE.WebGLRenderTarget | null }).map = null;
    }
    this.resize(this.width, this.height);
  }

  // ---------- Kamera ----------

  resize(w: number, h: number): void {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    this.renderer.setSize(this.width, this.height, false);
    const aspect = this.width / this.height;
    this.camera.aspect = aspect;
    this.bgCamera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.bgCamera.updateProjectionMatrix();
    const k = 2 * Math.tan(((FOV / 2) * Math.PI) / 180);
    this.dist = Math.max(VIEW_W / (k * aspect), MIN_VIEW_H / k);
    this.viewH = this.dist * k;
    const sc = this.sun.shadow.camera;
    const half = this.viewH / 2 + 3;
    sc.left = -half;
    sc.right = half;
    sc.top = half;
    sc.bottom = -half;
    sc.near = 1;
    sc.far = 60;
    sc.updateProjectionMatrix();
    this.updateFocusLimits();
  }

  private updateFocusLimits(): void {
    const H = this.viewH;
    this.focusMin = H / 2 - 1.9;
    const top = (this.stand?.topY ?? this.levelTop * S + 1.7) + 0.7;
    this.focusMax = Math.max(this.focusMin, top + H * 0.14 - H / 2);
  }

  /** Kamerayı topa göre hedefler. snap: yumuşatmadan atla. */
  follow(ballY: number, dt: number, snap = false): void {
    const want = Math.min(this.focusMax, Math.max(this.focusMin, ballY * S + this.viewH * 0.16));
    if (snap) this.focusY = want;
    else this.focusY += (want - this.focusY) * (1 - Math.exp(-dt * 4.5));
  }

  /** Başlangıç görünümü (taban görünür) */
  get startFocus(): number {
    return this.focusMin;
  }

  private placeCameras(): void {
    const T = this.tmpV.set(0, this.focusY, 0).applyMatrix4(this.standGroup.matrixWorld);
    this.camera.position.set(T.x, T.y + Math.sin(PITCH) * this.dist, T.z + Math.cos(PITCH) * this.dist);
    this.camera.lookAt(T);
    this.camera.updateMatrixWorld();
    if (this.startCamY === 0) this.startCamY = this.focusMin;
    const startY = this.focusMin + Math.sin(PITCH) * this.dist;
    this.bgCamera.position.copy(this.camera.position);
    this.bgCamera.position.y = startY + (this.camera.position.y - startY) * BG_PARALLAX;
    this.bgCamera.quaternion.copy(this.camera.quaternion);
    this.bgCamera.updateMatrixWorld();
    // Gölge kamerası odakla birlikte
    this.sun.position.set(T.x - 8, T.y + 12, T.z + 10);
    this.sun.target.position.copy(T);
    this.sun.target.updateMatrixWorld();
  }

  /** Ekran noktasını (px) stand düzleminde yerel koordinata çevirir (z düzleminde). */
  screenToStand(px: number, py: number, z: number, out: THREE.Vector3): THREE.Vector3 {
    const ndc = new THREE.Vector2((px / this.width) * 2 - 1, -(py / this.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    this.standGroup.updateMatrixWorld();
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(this.standGroup.quaternion);
    const p = new THREE.Vector3(0, 0, z).applyMatrix4(this.standGroup.matrixWorld);
    this.plane.setFromNormalAndCoplanarPoint(n, p);
    if (!this.ray.ray.intersectPlane(this.plane, out)) out.set(0, 0, z);
    this.standInv.copy(this.standGroup.matrixWorld).invert();
    return out.applyMatrix4(this.standInv);
  }

  /** Etap noktasının ekrandaki yeri (px) */
  projectLevelPoint(x: number, y: number): { x: number; y: number } {
    const v = new THREE.Vector3((x - 500) * S, y * S, 0.3).applyMatrix4(this.standGroup.matrixWorld).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.width, y: ((1 - v.y) / 2) * this.height };
  }

  /** Halatların ekrandaki x'i (dokunma şeritleri için) */
  get ropeScreenPositions(): [number, number] {
    return this.ropeScreenX;
  }

  /** Bir ekran pikseli kaç dünya birimi (halat düzleminde) */
  get unitsPerPixel(): number {
    return this.viewH / this.height;
  }

  // ---------- Çizim ----------

  update(st: RenderState, dt: number): void {
    this.standGroup.updateMatrixWorld();
    this.placeCameras();
    if (this.bar) this.bar.update(st.yL, st.yR);
    if (this.ball) {
      this.ball.update((st.ballX - 500) * S, st.ballY * S, BAR_Z, st.roll, st.ballScale, st.time);
    }
    if (st.ghost && this.ghostBar && this.ghostBall) {
      this.ghostBar.group.visible = this.ghostBall.root.visible = true;
      this.ghostBar.update(st.ghost.yL, st.ghost.yR);
      this.ghostBar.group.position.z = BAR_Z - 0.02;
      this.ghostBall.update((st.ghost.x - 500) * S, st.ghost.y * S, BAR_Z - 0.02, 0, st.ghost.scale, st.time);
    } else if (this.ghostBar && this.ghostBall) {
      this.ghostBar.group.visible = this.ghostBall.root.visible = false;
    }
    this.props?.update(st.time);
    this.updateRopes(st, dt);
  }

  private updateRopes(st: RenderState, dt: number): void {
    if (!this.stand) return;
    const v = this.tmpV;
    const z = BAR_Z + 0.05;
    const edgePx = 26;
    const midY = this.height * 0.5;
    const upp = this.unitsPerPixel;
    for (let i = 0; i < 2; i++) {
      const rv = st.ropes[i];
      const rope = this.ropes[i];
      rope.setVisible(rv.visible);
      if (!rv.visible) continue;
      const sx = i === 0 ? -1 : 1;
      const px = i === 0 ? edgePx : this.width - edgePx;
      this.screenToStand(px, midY, z, v);
      let x = v.x;
      const minX = POST_X + 0.55;
      const maxX = POST_X + 1.7;
      x = sx * Math.min(maxX, Math.max(minX, Math.abs(x)));
      this.ropeLocalX[i] = x;
      // Halatın ekran x'i
      const wp = new THREE.Vector3(x, this.focusY, z).applyMatrix4(this.standGroup.matrixWorld).project(this.camera);
      this.ropeScreenX[i] = ((wp.x + 1) / 2) * this.width;
      // Düğüm: ekranın alt kısmında, tutunca parmakla birlikte kayar
      const restFrac = i === 0 ? 0.72 : 0.79;
      const knotPx = Math.min(this.height - 40, Math.max(this.height * 0.3, this.height * restFrac + rv.offsetPx));
      this.screenToStand(this.ropeScreenX[i], knotPx, z, v);
      const knotY = v.y;
      let gripY: number | null = null;
      if (rv.gripPx !== null) {
        this.screenToStand(this.ropeScreenX[i], rv.gripPx, z, v);
        gripY = v.y;
      }
      const pulley = i === 0 ? this.stand.pulleyL : this.stand.pulleyR;
      const p = new THREE.Vector3(pulley.x, pulley.y, z);
      rope.update({ pulley: p, x, knotY: Math.min(knotY, p.y - 1.2), gripY, scroll: rv.scroll * upp / (Math.PI * 2 * ROPE_R), side: sx, z }, dt);
    }
  }

  render(): void {
    this.renderer.clear();
    this.renderer.render(this.bgScene, this.bgCamera);
    this.renderer.clearDepth();
    this.renderer.render(this.fgScene, this.camera);
  }

  dispose(): void {
    this.clearLevel();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
