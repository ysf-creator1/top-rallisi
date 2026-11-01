// Çubuk geometrisi: çukurlu eğri, uçlar, topun dünyadaki yeri (tarif 3.1, 3.2)

export interface BarFrame {
  /** Uçlar arası gerçek uzunluk */
  length: number;
  /** Genel eğim açısı (radyan, sağ uç yukarıdaysa artı) */
  theta: number;
  cos: number;
  sin: number;
}

export function barFrame(yL: number, yR: number, width: number, out?: BarFrame): BarFrame {
  const dy = yR - yL;
  const length = Math.hypot(width, dy);
  const theta = Math.atan2(dy, width);
  const o = out ?? { length: 0, theta: 0, cos: 1, sin: 0 };
  o.length = length;
  o.theta = theta;
  o.cos = width / length;
  o.sin = dy / length;
  return o;
}

/** Çukur derinliği: d(s) = D · 4 · s · (1 − s) */
export function sagDepth(s: number, depth: number): number {
  return depth * 4 * s * (1 - s);
}

/** Çukurun çubuk boyunca eğimi (yükseklik / uzunluk): −d'(s) / L */
export function sagSlope(s: number, depth: number, length: number): number {
  return (-depth * 4 * (1 - 2 * s)) / length;
}

/** Topun bulunduğu noktadaki yerel eğim açısı: θ_çubuk + atan(çukur eğimi) */
export function localAngle(frame: BarFrame, s: number, depth: number): number {
  return frame.theta + Math.atan(sagSlope(s, depth, frame.length));
}

/** Çubuk üzerindeki bir noktanın (u: soldan uzaklık) dünyadaki yeri. lift: yüzey normali yönünde ek mesafe. */
export function barPoint(
  yL: number,
  frame: BarFrame,
  u: number,
  depth: number,
  lift: number,
  out: { x: number; y: number },
): { x: number; y: number } {
  const s = u / frame.length;
  const d = sagDepth(s, depth);
  // Çubuk doğrultusu (cos, sin), yukarı normal (−sin, cos)
  const nx = -frame.sin;
  const ny = frame.cos;
  out.x = frame.cos * u + nx * (lift - d);
  out.y = yL + frame.sin * u + ny * (lift - d);
  return out;
}

/** Topun merkezi, verilen çubuk durumunda. */
export function ballCenter(
  yL: number,
  yR: number,
  u: number,
  width: number,
  depth: number,
  radius: number,
  out: { x: number; y: number } = { x: 0, y: 0 },
): { x: number; y: number } {
  const f = barFrame(yL, yR, width);
  return barPoint(yL, f, u, depth, radius, out);
}

/**
 * Topun s noktasında kendiliğinden durması için gereken çubuk eğimi
 * (çukurun ortaya itişini dengeler). Yeniden doğarken kullanılır.
 */
export function equilibriumTilt(s: number, depth: number, width: number): number {
  return Math.atan((depth * 4 * (1 - 2 * s)) / width);
}
