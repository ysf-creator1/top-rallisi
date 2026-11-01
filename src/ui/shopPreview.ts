// Mağaza önizlemesi: küçük ayrı bir Three.js çizici, kaide üzerinde kostümlü top.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { BallType } from '../config/physics';
import { BallView } from '../game/render/ball';
import { disposeTree, matte } from '../game/render/common';
import type { Costume } from '../save/schema';

export class ShopPreview {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private ball: BallView | null = null;
  private raf = 0;
  private t0 = performance.now();
  private dragging = false;
  private spin = 0;
  private lastX = 0;

  constructor(private host: HTMLElement, pedestal: boolean) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor(0, 0);
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.canvas = this.renderer.domElement;
    host.append(this.canvas);
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.25;
    pm.dispose();
    const sun = new THREE.DirectionalLight('#FFF4E2', 2.2);
    sun.position.set(-3, 5, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.radius = 6;
    this.scene.add(sun, new THREE.HemisphereLight('#C7E2EE', '#BFE0A8', 1.4));
    if (pedestal) {
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.9, 0.5, 48), matte('#F2B7A9', { roughness: 0.7 }));
      ped.position.y = -1.3;
      ped.receiveShadow = true;
      ped.castShadow = true;
      this.scene.add(ped);
    }
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.18 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = pedestal ? -1.04 : -1.25;
    shadow.receiveShadow = true;
    this.scene.add(shadow);
    this.camera.position.set(0, 1.1, 9.6);
    this.camera.lookAt(0, -0.05, 0);
    this.canvas.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.lastX = e.clientX;
    });
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    this.resize();
    this.loop();
  }

  private onMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.spin += (e.clientX - this.lastX) * 0.012;
    this.lastX = e.clientX;
  };
  private onUp = () => {
    this.dragging = false;
  };

  setBall(type: BallType, costume: Costume): void {
    if (this.ball) {
      this.scene.remove(this.ball.root);
      disposeTree(this.ball.root);
    }
    this.ball = new BallView({ type, costume, radius: 1 });
    this.ball.root.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.castShadow = true) : null));
    this.scene.add(this.ball.root);
  }

  resize(): void {
    const w = this.host.clientWidth || 300;
    const hh = this.host.clientHeight || 240;
    this.renderer.setSize(w, hh, false);
    this.camera.aspect = w / hh;
    this.camera.updateProjectionMatrix();
  }

  private loop = (): void => {
    const time = (performance.now() - this.t0) / 1000;
    if (this.ball) {
      this.ball.update(0, 0.02 + Math.sin(time * 1.6) * 0.05, 0, 0, 1, time);
      if (!this.dragging) this.spin *= 0.94;
      this.ball.root.rotation.y = Math.sin(time * 0.7) * 0.35 + this.spin;
    }
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  dispose(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    if (this.ball) disposeTree(this.ball.root);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
