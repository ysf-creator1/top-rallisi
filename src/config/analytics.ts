// Oyun istatistiklerinin gönderildiği Firebase projesi (Firestore).
// Bu değerler gizli değildir: Firebase web ayarları zaten tarayıcıya gider.
// Kimin ne yazıp okuyabileceğini Firestore kuralları belirler (sadece ekleme serbest, okuma sadece sahibe).
// projectId boşsa istatistik gönderilmez.

export const ANALYTICS = {
  projectId: 'top-rallisi-log',
  apiKey: 'AIzaSyAm7tUtkMQq2fDYQQD9iwihDCQWxT0hdog',
  /** Olayların yazıldığı koleksiyon */
  collection: 'logs',
  /** Biriken olaylar bu sıklıkla gönderilir (ms) */
  flushMs: 45_000,
  /** Arka planda bu kadar kalınca dönüşte yeni oturum sayılır (ms) */
  newSessionAfterMs: 30 * 60_000,
};
