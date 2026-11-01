// Top görünümleri (tarif 7.1, rehber 2.5). Her türün kendi rengi ve deseni var.
// Desenler küre üzerine sarılan (eşdikdörtgen) CanvasTexture olarak çizilir;
// top yuvarlandıkça desen de döner.

import * as THREE from 'three';
import type { BallType } from '../../config/physics';
import { canvasTexture, makeCanvas } from './common';

export interface BallSkin {
  base: string;
  roughness: number;
  metalness: number;
  clearcoat: number;
  opacity: number;
  draw?: (ctx: CanvasRenderingContext2D, w: number, h: number, rnd: () => number) => void;
}

function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

export const BALL_SKINS: Record<BallType, BallSkin> = {
  standard: { base: '#F6F7F9', roughness: 0.42, metalness: 0, clearcoat: 0.2, opacity: 1 },
  heavy: {
    base: '#F1F1F3',
    roughness: 0.62,
    metalness: 0,
    clearcoat: 0,
    opacity: 1,
    draw(ctx, w, h, rnd) {
      // İnce gri mermer damarları
      ctx.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        ctx.strokeStyle = i % 3 === 0 ? 'rgba(142,146,154,0.75)' : 'rgba(169,173,180,0.55)';
        ctx.lineWidth = i % 3 === 0 ? 2.4 : 1.4;
        let x = rnd() * w;
        let y = h * (0.2 + rnd() * 0.6);
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          const nx = x + 30 + rnd() * 60;
          const ny = y + (rnd() - 0.5) * 50;
          ctx.quadraticCurveTo(x + (nx - x) / 2, y + (rnd() - 0.5) * 60, nx, ny);
          x = nx;
          y = ny;
        }
        ctx.stroke();
      }
    },
  },
  light: {
    base: '#FBE1D3',
    roughness: 0.35,
    metalness: 0,
    clearcoat: 0.35,
    opacity: 1,
    draw(ctx, w, h, rnd) {
      // Şeftali zemin: hafif koyu kenar tonu + açık benekler
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#FDEDE3');
      g.addColorStop(0.5, '#FBE1D3');
      g.addColorStop(1, '#F1C6B1');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#FFF8F2';
      for (let i = 0; i < 70; i++) {
        const y = h * (0.12 + rnd() * 0.76);
        const lat = (y / h - 0.5) * Math.PI;
        const r = 3 + rnd() * 5;
        ctx.beginPath();
        ctx.ellipse(rnd() * w, y, r / Math.max(0.3, Math.cos(lat)), r, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  rubber: {
    base: '#BFE6D5',
    roughness: 0.88,
    metalness: 0,
    clearcoat: 0,
    opacity: 1,
    draw(ctx, w, h) {
      // Tenis topu dikişi: tek sürekli eğri (önden iki kavis gibi görünür)
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 256; i++) {
        const phi = (i / 256) * Math.PI * 2;
        const lat = 0.62 * Math.sin(2 * phi);
        const x = (i / 256) * w;
        const y = h * (0.5 - lat / Math.PI);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    },
  },
  ice: {
    base: '#DDF0FA',
    roughness: 0.12,
    metalness: 0,
    clearcoat: 1,
    opacity: 0.9,
    draw(ctx, w, h, rnd) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#F2FAFF');
      g.addColorStop(0.55, '#DDF0FA');
      g.addColorStop(1, '#A9D2E8');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // Kristal çizgileri
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      for (let i = 0; i < 8; i++) {
        let x = rnd() * w;
        let y = h * (0.25 + rnd() * 0.5);
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 3; k++) {
          x += 18 + rnd() * 30;
          y += (rnd() - 0.5) * 50;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    },
  },
};

const texCache = new Map<BallType, THREE.Texture | null>();

export function skinTexture(type: BallType): THREE.Texture | null {
  if (texCache.has(type)) return texCache.get(type)!;
  const skin = BALL_SKINS[type];
  if (!skin.draw) {
    texCache.set(type, null);
    return null;
  }
  const c = makeCanvas(512, 256);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = skin.base;
  ctx.fillRect(0, 0, c.width, c.height);
  skin.draw(ctx, c.width, c.height, seeded(type.length * 7919 + 13));
  const t = canvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  texCache.set(type, t);
  return t;
}

/** Top malzemesi. tint: kostüm renk tonu (deseni korur). */
export function ballMaterial(type: BallType, tint: string | null, ghost = false): THREE.MeshPhysicalMaterial {
  const skin = BALL_SKINS[type];
  const map = skinTexture(type);
  const color = new THREE.Color(map ? '#FFFFFF' : skin.base);
  if (tint) color.multiply(new THREE.Color(tint));
  const m = new THREE.MeshPhysicalMaterial({
    color,
    map,
    roughness: skin.roughness,
    metalness: skin.metalness,
    clearcoat: skin.clearcoat,
    clearcoatRoughness: 0.25,
    transparent: skin.opacity < 1 || ghost,
    opacity: ghost ? 0.38 : skin.opacity,
    depthWrite: !ghost,
  });
  if (ghost) {
    m.color.set('#C9C2E6');
    m.map = null;
  }
  return m;
}
