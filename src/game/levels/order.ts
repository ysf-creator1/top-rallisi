// Dünyalardaki etap sırası. Etap dosyalarının adı (w1-03 gibi) kalıcıdır, çünkü
// rekorlar ve kayıtlar ona bağlı; oyunda görünen sıra bu listeden gelir.
// Sonradan eklenen kolay etaplar (11–15) zor etapların önüne konmuştur.

export const WORLD_ORDER: Record<number, string[]> = {
  1: ['w1-01', 'w1-02', 'w1-11', 'w1-03', 'w1-04', 'w1-12', 'w1-05', 'w1-06', 'w1-13', 'w1-07', 'w1-14', 'w1-08', 'w1-09', 'w1-15', 'w1-10'],
  2: ['w2-01', 'w2-11', 'w2-02', 'w2-03', 'w2-12', 'w2-04', 'w2-05', 'w2-13', 'w2-06', 'w2-07', 'w2-14', 'w2-08', 'w2-09', 'w2-15', 'w2-10'],
  3: ['w3-01', 'w3-11', 'w3-02', 'w3-03', 'w3-12', 'w3-04', 'w3-05', 'w3-13', 'w3-06', 'w3-07', 'w3-14', 'w3-08', 'w3-09', 'w3-15', 'w3-10'],
  4: ['w4-11', 'w4-01', 'w4-12', 'w4-02', 'w4-03', 'w4-13', 'w4-04', 'w4-05', 'w4-14', 'w4-06', 'w4-07', 'w4-15', 'w4-08', 'w4-09', 'w4-10'],
};

/** Etabın dünyasındaki sıra anahtarı (listede yoksa dosya adına göre) */
export function orderKey(id: string, world: number): number {
  const i = WORLD_ORDER[world]?.indexOf(id) ?? -1;
  if (i >= 0) return i;
  return 1000 + Number(id.split('-')[1] ?? 0);
}
