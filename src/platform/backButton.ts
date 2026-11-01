// Telefonun geri tuşu: tarayıcı geçmişine bir "nöbetçi" kayıt eklenir.
// Geri basılınca oyun bunu yakalar; oyun "ben hallettim" derse kayıt yenilenir,
// demezse (açılış ekranı) tarayıcı normal şekilde geri gider.

export function initBackButton(onBack: () => boolean): void {
  try {
    history.replaceState({ topRallisi: 'base' }, '');
    history.pushState({ topRallisi: 'guard' }, '');
  } catch {
    return;
  }
  window.addEventListener('popstate', () => {
    if (onBack()) history.pushState({ topRallisi: 'guard' }, '');
    else history.back();
  });
}
