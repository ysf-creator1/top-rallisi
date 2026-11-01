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

/** Ekran yönüne göre düzeltilmiş sağ-sol eğim (derece). Sağa eğince artı. */
export function readTiltDeg(): number {
  const angle = (screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0) as number;
  if (angle === 90) return beta;
  if (angle === -90 || angle === 270) return -beta;
  return gamma;
}

export function tiltAvailable(): boolean {
  return hasReading;
}
