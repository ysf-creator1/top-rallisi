// Cihaz ve tarayıcı bilgisi, tam ekran, ekran yönü.

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isTouchDevice(): boolean {
  return navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
}

export function canFullscreen(): boolean {
  return !!document.documentElement.requestFullscreen && !isIOS();
}

/** Tarayıcı izin veriyorsa tam ekran ister (sadece bir dokunuş içinden çağrılmalı). */
export function requestFullscreen(): void {
  if (!canFullscreen() || document.fullscreenElement || isStandalone()) return;
  if (!isTouchDevice()) return;
  document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  const so = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  so?.lock?.('portrait').catch(() => {});
}

/** Yatay mı? (sadece dokunmatik cihazlarda uyarı için) */
export function isLandscapePhone(): boolean {
  return isTouchDevice() && window.innerWidth > window.innerHeight && window.innerHeight < 560;
}

export function devicePixelRatioCapped(max = 2): number {
  return Math.min(max, window.devicePixelRatio || 1);
}

export function getQueryParam(name: string): string | null {
  return new URLSearchParams(location.search).get(name);
}
