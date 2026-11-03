// Eğim sensörü (DeviceOrientation). iPhone'da izin bir dokunuşla istenir.

type PermissionFn = () => Promise<'granted' | 'denied' | 'default'>;

let gamma = 0;
let beta = 0;
let hasReading = false;
let listening = false;

function onOrientation(e: DeviceOrientationEvent): void {
  if (e.gamma == null || e.beta == null) return;
  gamma = e.gamma;
  beta = e.beta;
  hasReading = true;
}

export function tiltApiExists(): boolean {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
}

export function tiltNeedsPermission(): boolean {
  const D = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: PermissionFn } }).DeviceOrientationEvent;
  return !!D && typeof D.requestPermission === 'function';
}

/** İzin ister (iPhone) ve dinlemeye başlar. Sonuç: sensör kullanılabilir mi. */
export async function requestTilt(): Promise<boolean> {
  if (!tiltApiExists()) return false;
  if (tiltNeedsPermission()) {
    try {
      const D = (window as unknown as { DeviceOrientationEvent: { requestPermission: PermissionFn } }).DeviceOrientationEvent;
      const res = await D.requestPermission();
      if (res !== 'granted') return false;
    } catch {
      return false;
    }
  }
  startTilt();
  // Masaüstünde olay hiç gelmeyebilir: kısa süre bekle
  if (hasReading) return true;
  return new Promise((resolve) => {
    const t0 = performance.now();
    const check = () => {
      if (hasReading) resolve(true);
      else if (performance.now() - t0 > 1800) resolve(false);
      else setTimeout(check, 60);
    };
    check();
  });
}

export function startTilt(): void {
  if (listening || !tiltApiExists()) return;
  window.addEventListener('deviceorientation', onOrientation);
  listening = true;
}

export function stopTilt(): void {
  if (!listening) return;
  window.removeEventListener('deviceorientation', onOrientation);
  listening = false;
}

/**
 * Ekran yönüne göre düzeltilmiş sağ-sol eğim (derece). Sağa eğince artı.
 * Doğrudan gamma kullanılmaz: telefon dik tutulunca (beta ~90°) gamma kararsızlaşır,
 * bir anda ±90° sıçrayabilir. Bunun yerine telefona göre "yukarı" yönünden açı
 * hesaplanır: düz tutunca gamma ile aynı, dik tutunca da kararlı.
 */
export function readTiltDeg(): number {
  return tiltFromAngles(beta, gamma, (screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0) as number);
}

/** beta, gamma (derece) ve ekran açısından sağ-sol eğim (derece) */
export function tiltFromAngles(betaDeg: number, gammaDeg: number, screenAngle: number): number {
  const b = (betaDeg * Math.PI) / 180;
  const g = (gammaDeg * Math.PI) / 180;
  // Yukarı yönün (yerçekiminin tersi) telefona göre bileşenleri
  const ux = -Math.cos(b) * Math.sin(g);
  const uy = Math.sin(b);
  const uz = Math.cos(b) * Math.cos(g);
  const asinDeg = (v: number) => (Math.asin(Math.max(-1, Math.min(1, v))) * 180) / Math.PI;
  if (screenAngle === 90) return asinDeg(uy);
  if (screenAngle === -90 || screenAngle === 270) return -asinDeg(uy);
  // Düz tutuşta gamma'ya, dik tutuşta direksiyon gibi çevirme açısına eşit;
  // aradaki açılarda da gerçek çevirme açısına çok yakın ve hiç sıçramaz.
  return (Math.atan2(-ux, Math.max(Math.abs(uy), Math.abs(uz), 1e-6)) * 180) / Math.PI;
}

export function tiltAvailable(): boolean {
  return hasReading;
}
