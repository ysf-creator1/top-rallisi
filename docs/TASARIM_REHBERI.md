# Top Rallisi — Tasarım Rehberi

Bu dosya oyunun görsel dilini tanımlar. Hedef: Unity ile yapılmış şık mobil oyunlar gibi **yumuşak ışıklı, pastel, sade ve gözü yormayan** bir görünüm. Sıradan "kodla çizilmiş kutu ve daire" görünümünden kaçınılmalı.

## 1. Hedef ekranlar

`docs/tasarim/` klasöründeki görseller **birebir hedeftir**. Her görselin HTML kaynağı `docs/tasarim/kaynak/` içinde; tam renk kodları, ölçüler ve gölgeler oradan okunabilir.

| Dosya | Ne gösteriyor |
|---|---|
| `01-gunduz-oyun-ekrani.png` | **Ana referans.** Oyun ekranı, iki halat modu, Dünya 1 gündüz park sahnesi |
| `02-gunduz-etap-sonu.png` | Etap sonu ekranı |
| `03-gunduz-magaza-kostumler.png` | Mağaza, kostümler sekmesi |
| `04-aksam-oyun-ekrani.png` | Dünya 4 akşam teması, eğme + tek halat (solak, halat solda), rüzgâr bölgesi |
| `05-aksam-etap-sonu.png` | Akşam teması etap sonu (yeni rekor durumu) |
| `06-aksam-magaza-toplar.png` | Mağaza, toplar sekmesi |
| `07-gunduz-ayarlar.png` | Ayarlar: parkur rengi, kontroller, yardım modu |
| `08-top-gorunumleri.png` | Beş top türünün renk ve deseni, açık parkurda otomatik kontur |

Not: Görseller oluşturulurken yazı tipleri yüklenemediği için PNG'lerde yedek yazı tipi görünür. Gerçek yazı tipleri aşağıda; HTML kaynakları doğru yazı tipini kullanır.

## 2. Renkler

### 2.1 Gündüz teması (varsayılan, Dünya 1–3)
| Ad | Kod | Kullanım |
|---|---|---|
| `sky.top` | `#C7E2EE` | Gökyüzü üstü |
| `sky.mid` | `#E4EEEA` | Gökyüzü ortası |
| `sky.horizon` | `#F4EEE1` | Ufuk |
| `hills` | `#CADFC6` | Uzak tepeler |
| `trees.far` | `#A9CAA7` | Uzak ağaçlar |
| `trees.near` | `#8DB99A` / `#7FAE8D` | Yakın ağaçlar (açık / gölge) |
| `grass` | `#BFE0A8` / `#B5DA9D` | Çim şeritleri |
| `path` | `#EFE6D3` | Parktaki yürüyüş yolu |
| `stand.light` / `stand.dark` | `#F2B7A9` / `#D88E7E` | Stand direkleri (pastel mercan) |
| `track` | `#2E3136` | **Parkur, varsayılan** |
| `track.edge` | `#4A4F56` | Parkur kenarı (pah) |
| `bar.light` / `bar.dark` | `#DCE1E5` / `#98A1AA` | Metal çubuk |
| `rope.base` / `rope.dark` / `rope.light` | `#DCC29A` / `#BC9C6E` / `#F0E2C6` | Halat lifleri |

### 2.2 Akşam teması (Dünya 4)
| Ad | Kod |
|---|---|
| `sky.top` / `sky.mid` / `sky.horizon` | `#C9C1E8` / `#EBCFD6` / `#F8E0CC` |
| `hills` | `#BDB6D6` |
| `trees.far` / `trees.near` | `#9FB9BA` / `#86A7A6` |
| `grass` | `#BCD3AE` / `#B2CBA3` |
| `stand.light` / `stand.dark` | `#F0E2C9` / `#D2BC98` (açık ahşap) |
| `lamp.glow` | `#FFE8BE` |

### 2.3 Arayüz
| Ad | Kod | Kullanım |
|---|---|---|
| `ui.bg` | `#F6F1E8` | Menü ekranı zemini (krem) |
| `ui.card` | `rgba(251, 248, 242, 0.85)` + `backdrop-filter: blur(10px)` | Oyun üstü buzlu kartlar |
| `ui.text` | `#3B3F45` | Ana metin |
| `ui.textMuted` | `#6A7078` | İkincil metin |
| `accent.mint` | `#8CCFB4` | Ana buton, seçili durum (üzerindeki metin `#23302A`) |
| `accent.coral` | `#E8907E` | Bayrak, vurgu |
| `accent.gold` | `#F2C46D` | Yıldız, puan |
| `success` | `#3E7A62` zemin `#E6F3EC` | Olumlu bilgi |
| `warn` | `#A9503F` zemin `#FBE5DF` | "Rekora 0,4 sn kaldı" gibi |
| Akşam vurgusu | `#B3A3E0` (lila), metin `#36334A` | Dünya 4 arayüzü |

### 2.4 Parkur rengi seçenekleri
Siyah `#2E3136` (varsayılan) · Antrasit `#4A4F57` · Gece mavisi `#2F3E5C` · Orman `#33503F` · Bordo `#5C2E36` · Ceviz `#5A4334` · Lavanta `#A99AD6` · Mint `#9FD3C0`.
Kenar rengi = ana rengin %15 açığı. Topla parkur arasındaki parlaklık farkı düşükse (Lavanta, Mint) topa 2 px `#3B3F45` kontur eklenir.

### 2.5 Top görünümleri
| Tür | Gradyan (merkez → kenar) | Desen |
|---|---|---|
| Standart | `#FFFFFF` → `#F2F4F6` → `#C9D1D8` | Yok |
| Ağır | `#FAFAFA` → `#E3E4E7` → `#A9ADB4` | İnce gri damarlar `#8E929A` |
| Hafif | `#FFF7F1` → `#FBE1D3` → `#E9B49C` | Açık benekler `#FFF8F2` |
| Kauçuk | `#EFFAF5` → `#BFE6D5` → `#7FBFA4` | İki kavisli beyaz dikiş |
| Buz | `#FFFFFF` → `#DDF0FA` → `#8FC3DE`, %90 opak | Beyaz kristal çizgileri, güçlü parlama |

Bütün toplarda ışık sol üstten gelir: sol üstte beyaz parlama lekesi, altta çubuğa düşen yumuşak gölge. Desen top yuvarlandıkça döner.

## 3. Yazı tipleri
- Başlık ve sayılar: **Fredoka** (500–600)
- Metin: **Nunito** (600–800)
- Akşam teması arayüzü: **Outfit** (400–600)
- Uygulama çevrimdışı çalışacağı için yazı tipleri pakete gömülmeli: `npm i @fontsource/fredoka @fontsource/nunito @fontsource/outfit`.
- Sayaçlarda `font-variant-numeric: tabular-nums` kullanılmalı ki rakamlar zıplamasın.

## 4. Biçim kuralları
- Köşe yuvarlaklığı: küçük butonlar 14–18 px, kartlar 22–32 px, yuvarlak butonlar tam daire.
- Gölgeler geniş ve yumuşak: `0 8px 24px rgba(59, 63, 69, 0.12)`. Sert, koyu gölge yok.
- Dokunma alanları en az 44 × 44 px.
- İkonlar yuvarlak uçlu, tek kalınlıkta çizgi ikonlar. **Emoji kullanılmaz.**
- Animasyonlar 150–250 ms, ease-out. Butona basınca %96'ya küçülme. Kartlar hafif yaylanarak açılır.
- Neon renk, keskin gradyan, parlak doygun renk yok.

## 5. Sahne kuralları
Aşağıdaki kurallar Three.js ile 3B nesnelerle uygulanır (ışık, malzeme ve sis ayrıntıları: tarif Bölüm 11.3). Hedef, görsellerdeki yumuşak ve pastel görünümü gerçek ışık ve gölgeyle yakalamaktır.

- Arka plan paralaks katmanları: gökyüzü (+güneş parıltısı) → uzak tepeler → uzak ağaçlar → yakın ağaçlar ve sokak lambası/bank → çim şeritleri.
- Ağaçlar üst üste binen yuvarlak taçlarla, iki ton (ışık ve gölge) ile çizilir.
- Stand: iki yan direk tepeye doğru hafifçe içe eğilir (arkaya yatık görünüm), tepede iki makara, arkada destek bacakları, altta koyu taban tepsisi ve çime düşen bulanık gölge.
- Parkur: kenarı açık tonlu, arkasına bulanık gölge düşer. Arasından park görünür.
- Bitiş deliği: ince metal halka, içi koyu radyal gradyan, yanında küçük bayrak.
- Çubuk: metal, ortası çukur, uçları yukarı kalkık; üstünde ince beyaz parlama çizgisi; parkura bulanık gölge düşürür.
- Halat: çapraz bükülmüş lif dokusu, ucunda topak düğüm ve hafif açılmış lif uçları. Makaradan kenara doğru kıvrılarak iner.
