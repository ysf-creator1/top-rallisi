// Dünyalardaki etap sırası. Etap dosyalarının adı (w1-03 gibi) kalıcıdır, çünkü
// rekorlar ve kayıtlar ona bağlı; oyunda görünen sıra bu listeden gelir.
// Sonradan eklenen kolay etaplar (11–15) zor etapların önüne konmuştur.
// Dünya 2–6'daki kara kalem taslak etaplar (16–18) 10., 15. ve 18. sırada.

export const WORLD_ORDER: Record<number, string[]> = {
  1: ['w1-01', 'w1-02', 'w1-11', 'w1-03', 'w1-04', 'w1-12', 'w1-05', 'w1-06', 'w1-13', 'w1-07', 'w1-14', 'w1-08', 'w1-09', 'w1-15', 'w1-10'],
  2: ['w2-01', 'w2-11', 'w2-02', 'w2-03', 'w2-12', 'w2-04', 'w2-05', 'w2-13', 'w2-06', 'w2-16', 'w2-07', 'w2-14', 'w2-08', 'w2-09', 'w2-17', 'w2-15', 'w2-10', 'w2-18'],
  3: ['w3-01', 'w3-11', 'w3-02', 'w3-03', 'w3-12', 'w3-04', 'w3-05', 'w3-13', 'w3-06', 'w3-16', 'w3-07', 'w3-14', 'w3-08', 'w3-09', 'w3-17', 'w3-15', 'w3-10', 'w3-18'],
  4: ['w4-11', 'w4-01', 'w4-12', 'w4-02', 'w4-03', 'w4-13', 'w4-04', 'w4-05', 'w4-14', 'w4-16', 'w4-06', 'w4-07', 'w4-15', 'w4-08', 'w4-17', 'w4-09', 'w4-10', 'w4-18'],
  5: ['w5-01', 'w5-02', 'w5-03', 'w5-04', 'w5-05', 'w5-06', 'w5-07', 'w5-08', 'w5-09', 'w5-16', 'w5-10', 'w5-11', 'w5-12', 'w5-13', 'w5-17', 'w5-14', 'w5-15', 'w5-18'],
  6: ['w6-01', 'w6-02', 'w6-03', 'w6-04', 'w6-05', 'w6-06', 'w6-07', 'w6-08', 'w6-09', 'w6-16', 'w6-10', 'w6-11', 'w6-12', 'w6-13', 'w6-17', 'w6-14', 'w6-15', 'w6-18'],
};

/** Etabın dünyasındaki sıra anahtarı (listede yoksa dosya adına göre) */
export function orderKey(id: string, world: number): number {
  const i = WORLD_ORDER[world]?.indexOf(id) ?? -1;
  if (i >= 0) return i;
  return 1000 + Number(id.split('-')[1] ?? 0);
}
