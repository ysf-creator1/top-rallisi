// Top Rallisi giriş noktası.

import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import './ui/styles.css';
import { registerSW } from 'virtual:pwa-register';
import { t } from './i18n';
import { App } from './ui/app';
import { toast } from './ui/toast';

async function boot(): Promise<void> {
  // Canvas yazıları (tabela, numara) doğru yazı tipiyle çizilsin
  try {
    await Promise.race([
      Promise.all([document.fonts.load('600 40px Fredoka'), document.fonts.load('800 40px Nunito')]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch {
    /* yazı tipi yüklenemese de devam */
  }
  const root = document.getElementById('app')!;
  let app: App;
  try {
    app = new App(root);
  } catch (e) {
    root.innerHTML = `<div style="padding:40px 24px;font:700 16px Nunito,sans-serif;color:#3B3F45;text-align:center">WebGL başlatılamadı. Tarayıcını güncellemeyi dene.<br><small>${String(e)}</small></div>`;
    throw e;
  } finally {
    const b = document.getElementById('boot');
    if (b) {
      b.style.opacity = '0';
      setTimeout(() => b.remove(), 320);
    }
  }
  (window as unknown as { __app: App }).__app = app;

  // PWA: yeni sürüm gelince "Yeni sürüm hazır, yenile"
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    const updateSW = registerSW({
      onNeedRefresh() {
        toast(app, t('pwa.update'), { label: t('pwa.reload'), run: () => void updateSW(true) }, 0);
      },
      onOfflineReady() {
        toast(app, t('pwa.offline'));
      },
    });
  }
}

void boot();
