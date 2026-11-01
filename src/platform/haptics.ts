// Titreşim. Android'de çalışır, iPhone tarayıcısında desteklenmez (sessizce atlanır).

let enabled = true;

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

export function hapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function vibrate(pattern: number | number[]): void {
  if (!enabled || !hapticsSupported()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* yok say */
  }
}
