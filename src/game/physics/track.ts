// Pist geometrisi: merkez çizgisini Catmull-Rom eğrisiyle örnekler,
// "top pistte mi" sorusunu ve en yakın yol noktasını cevaplar.

import type { LevelData, RoadPoint } from '../levels/types';

export interface Polyline {
  xs: Float64Array;
  ys: Float64Array;
  ws: Float64Array;
  /** Her örneğe kadar biriken uzunluk */
  len: Float64Array;
  count: number;
  totalLength: number;
  /** Kaba eleme için sınır kutusu (genişlik dahil) */
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  kind: 'main' | 'short' | 'long';
}

export interface NearestResult {
  /** Merkez çizgisine uzaklık */
  dist: number;
  /** O noktadaki yarı genişlik */
  halfWidth: number;
  /** Merkez çizgisindeki en yakın nokta */
  cx: number;
  cy: number;
  line: Polyline;
}

/** Uniform Catmull-Rom: p1 ile p2 arasında, t ∈ [0,1] */
function cr(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** Noktaları yumuşak eğriye çevirip yaklaşık `step` aralıkla örnekler. */
export function samplePolyline(points: RoadPoint[], kind: Polyline['kind'], step = 10): Polyline {
  const xs: number[] = [];
  const ys: number[] = [];
  const ws: number[] = [];
  const n = points.length;
  if (n === 1) {
    xs.push(points[0].x);
    ys.push(points[0].y);
    ws.push(points[0].w);
  }
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const sub = Math.max(2, Math.ceil(segLen / step));
    for (let k = 0; k < sub; k++) {
      const t = k / sub;
      xs.push(cr(p0.x, p1.x, p2.x, p3.x, t));
      ys.push(cr(p0.y, p1.y, p2.y, p3.y, t));
      // Genişlik yumuşak geçişli (smoothstep), taşma yapmasın
      const s = t * t * (3 - 2 * t);
      ws.push(p1.w + (p2.w - p1.w) * s);
    }
  }
  if (n > 1) {
    const last = points[n - 1];
    xs.push(last.x);
    ys.push(last.y);
    ws.push(last.w);
  }
  const count = xs.length;
  const len = new Float64Array(count);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    if (i > 0) len[i] = len[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    const h = ws[i] / 2;
    minX = Math.min(minX, xs[i] - h);
    maxX = Math.max(maxX, xs[i] + h);
    minY = Math.min(minY, ys[i] - h);
    maxY = Math.max(maxY, ys[i] + h);
  }
  return {
    xs: Float64Array.from(xs),
    ys: Float64Array.from(ys),
    ws: Float64Array.from(ws),
    len,
    count,
    totalLength: len[count - 1] ?? 0,
    minX,
    maxX,
    minY,
    maxY,
    kind,
  };
}

/** Bir çizgiye en yakın noktayı bulur. */
export function nearestOnLine(line: Polyline, px: number, py: number, out: NearestResult): boolean {
  const { xs, ys, ws, count } = line;
  let best = Infinity;
  let found = false;
  if (count === 1) {
    const d = Math.hypot(px - xs[0], py - ys[0]);
    out.dist = d;
    out.halfWidth = ws[0] / 2;
    out.cx = xs[0];
    out.cy = ys[0];
    out.line = line;
    return true;
  }
  for (let i = 0; i < count - 1; i++) {
    const ax = xs[i];
    const ay = ys[i];
    const bx = xs[i + 1];
    const by = ys[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + dx * t;
    const cy = ay + dy * t;
    const ex = px - cx;
    const ey = py - cy;
    const d2 = ex * ex + ey * ey;
    if (d2 < best) {
      best = d2;
      out.dist = Math.sqrt(d2);
      out.halfWidth = (ws[i] + (ws[i + 1] - ws[i]) * t) / 2;
      out.cx = cx;
      out.cy = cy;
      out.line = line;
      found = true;
    }
  }
  return found;
}

export class Track {
  readonly main: Polyline;
  readonly lines: Polyline[];
  private readonly tmp: NearestResult;

  constructor(level: LevelData, step = 10) {
    this.main = samplePolyline(level.road, 'main', step);
    this.lines = [this.main];
    for (const b of level.branches ?? []) {
      this.lines.push(samplePolyline(b.points, b.type, step));
    }
    this.tmp = { dist: 0, halfWidth: 0, cx: 0, cy: 0, line: this.main };
  }

  /** Topun merkezi pist alanının içinde mi? (tarif 3.3) */
  isOnTrack(px: number, py: number): boolean {
    for (const line of this.lines) {
      if (px < line.minX || px > line.maxX || py < line.minY || py > line.maxY) continue;
      if (nearestOnLine(line, px, py, this.tmp) && this.tmp.dist < this.tmp.halfWidth) return true;
    }
    return false;
  }

  /**
   * En yakın merkez çizgisi noktası. Pist içindeki kollar arasında
   * "içinde olduğu" kolu tercih eder; yoksa en yakın olanı.
   */
  nearest(px: number, py: number, out: NearestResult): void {
    let bestRatio = Infinity;
    for (const line of this.lines) {
      nearestOnLine(line, px, py, this.tmp);
      const ratio = this.tmp.dist / Math.max(1, this.tmp.halfWidth);
      if (ratio < bestRatio) {
        bestRatio = ratio;
        out.dist = this.tmp.dist;
        out.halfWidth = this.tmp.halfWidth;
        out.cx = this.tmp.cx;
        out.cy = this.tmp.cy;
        out.line = this.tmp.line;
      }
    }
  }

  /**
   * Ana yolun verilen yükseklikteki merkez x'i (yol yukarı doğru
   * ilk kez bu yüksekliği geçtiği yer). Bulamazsa en yakın örnek.
   */
  centerXAt(y: number, line: Polyline = this.main): number {
    const { xs, ys, count } = line;
    for (let i = 0; i < count - 1; i++) {
      const y0 = ys[i];
      const y1 = ys[i + 1];
      if ((y0 <= y && y1 >= y) || (y0 >= y && y1 <= y)) {
        const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
        return xs[i] + (xs[i + 1] - xs[i]) * t;
      }
    }
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < count; i++) {
      const d = Math.abs(ys[i] - y);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    return xs[bi];
  }

  /** Ana yolun verilen yükseklikteki genişliği. */
  widthAt(y: number, line: Polyline = this.main): number {
    const { ws, ys, count } = line;
    for (let i = 0; i < count - 1; i++) {
      const y0 = ys[i];
      const y1 = ys[i + 1];
      if ((y0 <= y && y1 >= y) || (y0 >= y && y1 <= y)) {
        const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
        return ws[i] + (ws[i + 1] - ws[i]) * t;
      }
    }
    return ws[count - 1];
  }
}
