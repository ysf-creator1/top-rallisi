// Link paylaşma: telefonun paylaş menüsü varsa o, yoksa panoya kopyalama.

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

export async function shareLink(opts: { title: string; text: string; url: string }): Promise<ShareResult> {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ title: opts.title, text: opts.text, url: opts.url });
      return 'shared';
    } catch (e) {
      // Kullanıcı menüyü kapattıysa kopyalamaya geçme
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(`${opts.text} ${opts.url}`);
    return 'copied';
  } catch {
    return copyFallback(`${opts.text} ${opts.url}`) ? 'copied' : 'failed';
  }
}

/** Eski tarayıcılar için gizli metin kutusuyla kopyalama */
function copyFallback(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Oyunun adresi (karma kısmı olmadan) */
export function appBaseUrl(): string {
  return `${location.origin}${import.meta.env.BASE_URL}`;
}

/** Adres çubuğundaki karma kısmı */
export function readHash(): string {
  return location.hash;
}

/** Karma kısmını geçmişe kayıt eklemeden temizler */
export function clearHash(): void {
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch {
    /* önemli değil */
  }
}

export function onHashChange(fn: () => void): void {
  window.addEventListener('hashchange', fn);
}
