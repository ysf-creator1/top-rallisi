// Parkur yüzeyi: etap merkez çizgisinden canvas dokular (döşemeler) olarak çizilir.
// Her döşeme 1024 etap birimi yüksekliğinde. Yumuşak gölge, açık tonlu kenar (pah),
// koyu dolgu, bitiş deliğinin karanlık içi ve kontrol noktası çizgileri dokuda.
// (Şerit geometrisi sert virajlarda katlandığı için doku yöntemi seçildi.)

import * as THREE from 'three';
import { trackPalette, type TrackPalette } from '../../config/theme';
import type { LevelData } from '../levels/types';
import { POPPER_VIS } from '../physics/obstacles';
import type { Polyline, Track } from '../physics/track';
import { S, canvasTexture, makeCanvas, type Quality } from './common';

const TILE = 1024;
const MARGIN = 100;
const EDGE = 4.5;

const PPU: Record<Quality, number> = { high: 1, medium: 0.8, low: 0.6 };

export class TrackSurface {
  readonly group = new THREE.Group();
  private tiles: { mesh: THREE.Mesh; canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; y0: number }[] = [];
  private sil: HTMLCanvasElement | null = null;
  private palette: TrackPalette;

  constructor(
    private level: LevelData,
    private track: Track,
    color: string,
    private quality: Quality,
    private checkpoints: number[],
  ) {
    this.palette = trackPalette(color);
    this.build();
  }

  get needsContour(): boolean {
    return this.palette.needsContour;
  }

  private build(): void {
    const ppu = PPU[this.quality];
    const W = this.level.boardWidth;
    const top = this.level.finishHole.y + 400;
    const bottom = -300;
    const wPx = Math.round((W + MARGIN * 2) * ppu);
    const hPx = Math.round(TILE * ppu);
    for (let y0 = bottom; y0 < top; y0 += TILE) {
      const canvas = makeCanvas(wPx, hPx);
      const tex = canvasTexture(canvas);
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.generateMipmaps = true;
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: '#FFFFFF',
        emissiveIntensity: 0.32,
        transparent: true,
        roughness: 0.82,
        metalness: 0,
        depthWrite: false,
      });
      const geo = new THREE.PlaneGeometry((W + MARGIN * 2) * S, TILE * S);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, (y0 + TILE / 2) * S, 0);
      mesh.receiveShadow = true;
      mesh.renderOrder = -1;
      this.group.add(mesh);
      this.tiles.push({ mesh, canvas, tex, y0 });
    }
    this.redraw();
  }

  setColor(color: string): void {
    this.palette = trackPalette(color);
    this.redraw();
  }

  private redraw(): void {
    const ppu = PPU[this.quality];
    for (const t of this.tiles) {
      this.drawTile(t.canvas, t.y0, ppu);
      t.tex.needsUpdate = true;
    }
  }

  /** Etap koordinatından döşeme pikseline */
  private drawTile(c: HTMLCanvasElement, y0: number, ppu: number): void {
    const ctx = c.getContext('2d')!;
    const { width: w, height: h } = c;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const y1 = y0 + TILE;
    const toX = (x: number) => (x + MARGIN) * ppu;
    const toY = (y: number) => (y1 - y) * ppu;
    const lines = this.track.lines;
    const pal = this.palette;

    // 1) Siluet (gölge için)
    if (!this.sil || this.sil.width !== w || this.sil.height !== h) this.sil = makeCanvas(w, h);
    const sctx = this.sil.getContext('2d')!;
    sctx.clearRect(0, 0, w, h);
    sctx.fillStyle = sctx.strokeStyle = '#000';
    for (const l of lines) this.strokeLine(sctx, l, toX, toY, ppu, y0, y1, EDGE * 2);

    // 2) Yumuşak gölge: siluet ekran dışına çizilir, sadece gölgesi düşer
    ctx.save();
    ctx.shadowColor = pal.shadow;
    ctx.shadowBlur = 16 * ppu;
    ctx.shadowOffsetX = 9 * ppu + w * 2;
    ctx.shadowOffsetY = 14 * ppu;
    ctx.drawImage(this.sil, -w * 2, 0);
    ctx.restore();

    // 3) Kenar (pah) ve 4) dolgu
    ctx.fillStyle = ctx.strokeStyle = pal.edge;
    for (const l of lines) this.strokeLine(ctx, l, toX, toY, ppu, y0, y1, EDGE * 2);
    ctx.fillStyle = ctx.strokeStyle = pal.fill;
    for (const l of lines) this.strokeLine(ctx, l, toX, toY, ppu, y0, y1, 0);

    // Kontrol noktası çizgileri (kesikli)
    ctx.save();
    ctx.strokeStyle = 'rgba(247, 242, 232, 0.88)';
    ctx.lineCap = 'round';
    ctx.lineWidth = 7 * ppu;
    ctx.setLineDash([13 * ppu, 10 * ppu]);
    for (const cy of this.checkpoints) {
      if (cy < y0 - 50 || cy > y1 + 50) continue;
      const [l, r] = this.track.spanAt(cy);
      ctx.beginPath();
      ctx.moveTo(toX(l + 14), toY(cy));
      ctx.lineTo(toX(r - 14), toY(cy));
      ctx.stroke();
    }
    ctx.restore();

    // Bitiş deliğinin karanlık içi
    const hole = this.level.finishHole;
    if (hole.y + hole.r > y0 - 10 && hole.y - hole.r < y1 + 10) {
      const hx = toX(hole.x);
      const hy = toY(hole.y);
      const r = hole.r * ppu;
      const g = ctx.createRadialGradient(hx, hy - r * 0.2, r * 0.1, hx, hy, r);
      g.addColorStop(0, '#050506');
      g.addColorStop(0.75, '#141618');
      g.addColorStop(1, '#24272B');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(hx, hy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Düşürme delikleri: tahtada gerçek bir delik; içinden arkadaki manzara görünür.
    // Üst iç kenarda tahtanın kalınlığı, çevresinde turuncu ağız ve uyarı halkası.
    for (const th of this.level.holes ?? []) {
      if (th.y + th.r < y0 - 30 || th.y - th.r > y1 + 30) continue;
      const hx = toX(th.x);
      const hy = toY(th.y);
      const r = th.r * ppu;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(hx, hy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Tahta kalınlığı: deliğin üst iç duvarı (hilal)
      ctx.save();
      ctx.beginPath();
      ctx.arc(hx, hy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = pal.edge;
      ctx.beginPath();
      ctx.arc(hx, hy, r, Math.PI, 0);
      ctx.arc(hx, hy + r * 0.16, r, 0, Math.PI, true);
      ctx.fill();
      ctx.restore();
      ctx.lineWidth = 7 * ppu;
      ctx.strokeStyle = '#EE8A4E';
      ctx.beginPath();
      ctx.arc(hx, hy, r + 2 * ppu, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();
      ctx.lineWidth = 4 * ppu;
      ctx.strokeStyle = 'rgba(238, 138, 78, 0.55)';
      ctx.setLineDash([9 * ppu, 8 * ppu]);
      ctx.beginPath();
      ctx.arc(hx, hy, r + 14 * ppu, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Fırlatıcıların zemindeki yuvası
    for (const p of this.level.poppers ?? []) {
      if (p.y + p.r < y0 - 20 || p.y - p.r > y1 + 20) continue;
      ctx.fillStyle = '#121315';
      ctx.beginPath();
      ctx.arc(toX(p.x), toY(p.y), (p.r * POPPER_VIS + 6) * ppu, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Değişken genişlikli çizgi: her parça kendi genişliğiyle, yuvarlak uçlu. */
  private strokeLine(
    ctx: CanvasRenderingContext2D,
    l: Polyline,
    toX: (x: number) => number,
    toY: (y: number) => number,
    ppu: number,
    y0: number,
    y1: number,
    extra: number,
  ): void {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pad = 300;
    for (let i = 0; i < l.count - 1; i++) {
      const ya = l.ys[i];
      const yb = l.ys[i + 1];
      if (Math.max(ya, yb) < y0 - pad || Math.min(ya, yb) > y1 + pad) continue;
      ctx.lineWidth = ((l.ws[i] + l.ws[i + 1]) / 2 + extra) * ppu;
      ctx.beginPath();
      ctx.moveTo(toX(l.xs[i]), toY(ya));
      ctx.lineTo(toX(l.xs[i + 1]), toY(yb));
      ctx.stroke();
    }
    if (l.count === 1) {
      ctx.beginPath();
      ctx.arc(toX(l.xs[0]), toY(l.ys[0]), ((l.ws[0] + extra) / 2) * ppu, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  dispose(): void {
    for (const t of this.tiles) {
      t.tex.dispose();
      t.mesh.geometry.dispose();
      (t.mesh.material as THREE.Material).dispose();
    }
    this.tiles = [];
  }
}
