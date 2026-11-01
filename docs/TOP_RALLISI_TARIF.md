# Top Rallisi — Claude Code için Oyun Tarifi

> Bu, oyunun tam tarifidir. Çalışma kuralları `CLAUDE.md`, görsel kurallar `docs/TASARIM_REHBERI.md`, hedef ekran görüntüleri `docs/tasarim/` klasöründedir.

---

## 1. Oyunun özeti

**Top Rallisi**, telefonda dikey (portre) oynanan bir beceri ve yarış oyunudur. Gerçek hayattaki iple çekilen "topu dengede taşı" oyununun dijital hâlidir.

- Açık hava bir parkta, arkaya doğru hafif eğimli, dikey bir **stand** durur. Standın üzerinde aşağıdan yukarıya kıvrılan, **siyah / koyu gri** bir **parkur (pist)** vardır. Parkurun dışı boşluktur; arkadan park (çimen, ağaçlar) görünür.
- Standın önünde, tüm genişliği kaplayan yatay bir **çubuk (taşıma tahtası)** vardır. Çubuk tam düz değildir: **ortası hafif çukurdur** ve **iki ucunda topun düşmemesi için yukarı kalkık küçük duvarlar** vardır.
- Oyuncu çubuğun sol ve sağ ucunu ayrı ayrı yükseltip alçaltır. Çubuk eğildikçe **beyaz top** çubuk üzerinde sağa sola yuvarlanır.
- Amaç, çubuğu yukarı taşırken topu **parkurun üzerinde tutmak** ve parkurun en üstündeki **bitiş deliğine** düşürmektir.
- Topun merkezi pistin dışına çıkarsa top **boşluğa düşer**. Oyuncu son kontrol noktasından devam eder.
- Etabı bitirmek yetmez: **ne kadar hızlı bitirirsen o kadar çok yıldız ve puan** kazanırsın. Kıvrımlı pist bir ralli parkuru gibidir.

Hedef kitle: 6 yaş ve üstü çocuklar, gençler ve yetişkinler. Arayüz Türkçe olacak; metinler ileride başka dillere çevrilebilecek şekilde tek bir dil dosyasında tutulmalı.

---

## 2. Teknik tercihler

### 2.1 Yayın hedefi
- **İlk hedef: web.** Oyun **GitHub Pages** üzerinde yayınlanır. Linke tıklayan herkes telefondan ya da bilgisayardan, hiçbir şey kurmadan, tarayıcıda oynar.
- Oyun aynı zamanda bir **PWA**'dır (yüklenebilir web uygulaması): telefonda "Ana ekrana ekle" ile uygulama gibi, tam ekran ve internetsiz açılır.
- **Sunucu yok.** Oyun tamamen statik dosyalardan oluşur (HTML, JS, CSS, görseller, etap JSON'ları).
- Google Play ve App Store uygulaması (Capacitor ile) **sonraki sürümdür** (Faz 6). Kod bu geçişi zorlaştırmayacak şekilde yazılmalı: tarayıcıya özel API'ler (titreşim, eğim, kayıt) tek bir `platform/` katmanının arkasında toplanmalı.

### 2.2 Teknolojiler
| Katman | Seçim | Not |
|---|---|---|
| Dil | **TypeScript** (strict) | |
| Derleme | **Vite** | `base: '/top-rallisi/'` (GitHub Pages alt yolu; depo adı değişirse güncellenir) |
| Görüntü | **Three.js** | Sahne gerçek 3B nesnelerle çizilir: stand, parkur, metal çubuk, top, halatlar, ağaçlar. Yumuşak ışık, gölge ve hafif sis ile "Unity gibi" görünüm (bkz. Bölüm 11) |
| Fizik | **Elle yazılmış 2B fizik** | Fizik motoru kullanılmaz (bkz. Bölüm 3). Fizik dünyası 2B'dir; Three.js sadece görüntüler |
| Arayüz | **HTML/CSS katmanı** (Three.js tuvalinin üstünde) | Menüler, etap sonu, mağaza, ayarlar, oyun üstü sayaçlar. Ayrı bir arayüz kütüphanesi gerekmez; düz TypeScript + CSS yeterli |
| PWA | **vite-plugin-pwa** | Manifest, simgeler, çevrimdışı önbellek |
| Yazı tipleri | **@fontsource/fredoka, nunito, outfit** | Pakete gömülür, çevrimdışı çalışır |
| Test | **Vitest** | Fizik, puan, kayıt ve etap doğrulama testleri |
| Yayın | **GitHub Actions → GitHub Pages** | `main` dalına her gönderimde otomatik derleme ve yayın |

### 2.3 Tarayıcı ayrıntıları
- **Eğim sensörü:** `DeviceOrientationEvent`. HTTPS gerektirir (GitHub Pages HTTPS'tir). iPhone'da izin yalnızca bir dokunuşla istenebilir: eğme modu seçildiğinde "Eğim sensörüne izin ver" butonu olan kısa bir ekran gösterilir. İzin verilmezse oyun iki halat moduna döner ve bunu kullanıcıya söyler.
- **Titreşim:** `navigator.vibrate`. Android'de çalışır, iPhone tarayıcısında çalışmaz; o durumda sessizce atlanır.
- **Tam ekran ve yön:** Telefonda dikey oynanır. Telefon yan çevrilirse "Telefonu dik tut" uyarısı gösterilir. Tarayıcı izin veriyorsa ilk dokunuşta tam ekran istenir; iPhone'da bu desteklenmediği için oyuncuya "Ana ekrana ekle" önerisi bir kez, kapatılabilir şekilde gösterilir.
- **Dokunma:** Tarayıcının kaydırma, yakınlaştırma ve geri çekme hareketleri oyun alanında kapatılır (`touch-action: none`, `overscroll-behavior: none`, `user-scalable=no`). Uzun basınca metin seçimi ve menü çıkmamalı.
- **Kayıt:** `localStorage` (bir `save/` katmanı üzerinden, sürüm numaralı). Kayıtlar o cihazdaki o tarayıcıya aittir; oyuncu tarayıcı verilerini silerse ilerleme kaybolur. Ayarlar'da bunu açıklayan kısa bir not bulunur. İleride online kayıt için bu katman Supabase'e bağlanabilecek şekilde tasarlanır.
- **Performans:** Orta seviye bir Android telefonda 60 FPS hedeflenir. Gölge haritası boyutu, piksel oranı (`devicePixelRatio` en fazla 2) ve ağaç sayısı ayarlanabilir olmalı; FPS düşerse kalite otomatik bir kademe düşürülür.
- Masaüstünde fare ile de oynanabilmeli (halatlar fareyle sürüklenir, eğme modu klavye ok tuşlarıyla).

### 2.4 Genel
- **Reklam, satın alma, veri toplama yok.** Oyun çocuklara da hitap ettiği için ilk sürümde hiçbiri olmayacak. Analitik ya da takip betiği eklenmeyecek.
- Ekran yönü: yalnızca **dikey**. Tasarım ölçüsü 390×844 (mantıksal piksel); farklı oranlara uyum sağlamalı (kenarlarda sahne uzar, arayüz güvenli alan içinde kalır).

---

## 3. Fizik (oyunun kalbi)

Oyunun tamamı fiziğin hissine bağlı. Fizik **sabit zaman adımı** ile (saniyede 120 adım) ve **deterministik** çalışmalı; aynı girdiler her zaman aynı sonucu vermeli.

### 3.1 Çubuk
- Çubuğun uzunluğu sabittir ve tahta genişliğine eşittir. Uçları `x = 0` ve `x = W` noktasındadır.
- Sol ucun yüksekliği `yL`, sağ ucun yüksekliği `yR`. Oyuncu bu iki değeri kontrol eder.
- İki uç arasındaki fark sınırlıdır (en fazla yaklaşık ±25° eğim).
- Her ucun hareket hızı sınırlıdır; parmak ne kadar hızlı çekerse çeksin uç bu hızı aşamaz. Böylece çubuk "ışınlanmaz".
- Çubuk alt sınırın altına inemez, bitiş deliğinin üstüne çıkamaz.
- **Çukur:** Çubuk düz bir çizgi değil, ortası hafif aşağı sarkan bir eğridir. Çubuk boyunca konum `s` (0 = sol uç, 1 = sağ uç) için çukur derinliği `d(s) = D · 4 · s · (1 − s)`. `D` yaklaşık top çapının 0,6 katı olsun ve ayarlanabilir olsun. Bu yüzden top, çubuk düz tutulduğunda kendiliğinden ortaya doğru yuvarlanır ve orada durmaya meyillidir.
- **Uç duvarları:** Çubuğun iki ucunda, yaklaşık top çapı kadar yüksek, yukarı kalkık duvarlar vardır. Top bu duvarlardan dışarı düşemez, çarpınca hafifçe seker.

### 3.2 Top
- Top çubuğa bağlıdır, çubuk üzerinde tek eksende (çubuk boyunca) hareket eder.
- Çubuk boyunca ivme: `a = g · sin(θ_yerel) · k − sürtünme · v`. Burada `θ_yerel`, çubuğun genel eğim açısı ile topun bulunduğu noktadaki çukur eğiminin toplamıdır (`θ_yerel = θ_çubuk + atan(d'(s) / çubuk uzunluğu)`), `k` yuvarlanma katsayısı (dolu küre için 5/7).
- Uç duvarlarına çarpınca top, sekme katsayısıyla geri döner.
- Top türüne göre kütle, sürtünme ve sekme katsayısı değişir (bkz. Bölüm 7).
- Topun dünyadaki konumu (x, y), çubuk üzerindeki konumundan hesaplanır.

### 3.3 Düşme kuralı
- Her fizik adımında topun merkezi **pist alanının içinde mi** diye kontrol edilir.
- Pist alanı, merkez çizgisine olan uzaklığı o noktadaki yol genişliğinin yarısından küçük olan noktalardır (bkz. Bölüm 9).
- Top pist dışına çıkarsa: kısa bir düşme animasyonu (top küçülerek boşluğa düşer), sonra son kontrol noktasından yeniden başlanır.

### 3.4 Bitiş deliği
- Parkurun en üstünde yuvarlak bir **bitiş deliği** vardır.
- Topun merkezi deliğin yarıçapı içine girdiğinde top deliğe düşer (küçülüp kaybolma animasyonu) ve etap biter. Süre o anda durur.

### 3.5 Kamera
- Pist ekrandan uzundur. Kamera topu yumuşakça takip eder, top ekranın alt üçte birlik kısmında durur. Böylece oyuncu ilerideki virajları görür.

---

## 4. Kontroller

Ayarlar menüsünden iki kontrol türünden biri seçilir. Her iki türde de **yukarı hareket için ekranın kenarındaki ip aşağı doğru çekilir.**

### 4.1 İki ip kontrolü (varsayılan)
- Ekranın **sol kenarında** ve **sağ kenarında** birer dikey ip vardır. İpler **gerçek halat** görünümündedir (bükülmüş lifler) ve ucunda **topak bir düğüm** bulunur. İpler standın tepesindeki makaralardan çubuğun uçlarına iner.
- Sol ipi aşağı çekmek çubuğun **sol ucunu yukarı** kaldırır. Sağ ip de sağ uç için aynı şekilde çalışır.

**Halatı istediği yerden tutma (önemli):**
- Oyuncu halatı **sadece düğümden değil, halatın üzerindeki herhangi bir noktadan** tutabilir. Yeni başlayanlar genellikle halatı düğümden daha yukarıdan tutar; bu da çalışmalı.
- Dokunma alanı halatın görünen kalınlığından geniştir: ekran kenarından itibaren yaklaşık 64 px genişliğinde, halat boyunca uzanan dikey bir şerit. Bu şeridin içinde nereye dokunulursa dokunulsun, o halat tutulmuş sayılır.
- Hareket **göreli** hesaplanır: parmağın ilk dokunduğu nokta referans alınır, sonraki dikey kayma miktarı çubuk ucunun hareketine çevrilir. Halatın neresinden tutulduğu sonucu değiştirmez.
- Görsel olarak tutulan nokta parmağın altında kalır: halat parmakla birlikte kayar, düğüm de buna göre aşağı iner ya da yukarı çıkar. Tutulan noktada halat hafifçe sıkışmış görünür ve küçük bir titreşim verilir.
- Parmak halat şeridinin dışına kaysa bile, parmak ekrandan kalkana kadar tutuş devam eder.
- İpi yukarı doğru itmek ilgili ucu aşağı indirir.
- Parmak kalkınca uç olduğu yerde kalır.
- İki ip aynı anda (çoklu dokunma) kullanılabilmeli.
- Çekme miktarı ile uç hareketi arasındaki oran (hassasiyet) ayarlardan değiştirilebilmeli.

### 4.2 Eğme + tek ip kontrolü
- Telefonu **sağa sola eğmek** çubuğun eğimini belirler (telefon sağa eğilirse çubuğun sağ ucu alçalır).
- Çubuğun **yukarı-aşağı hareketi** için ekranın bir kenarında **tek bir ip** vardır. İp aşağı çekilince çubuğun iki ucu birlikte yükselir.
- **Sağlak / solak seçeneği:** Bu tek ip ayarlardan **sağ kenara** ya da **sol kenara** alınabilir.
- Bu modda da halat, 4.1'deki gibi **herhangi bir noktasından** tutulabilir.
- Oyun başlarken "telefonu düz tut" kalibrasyonu yapılır; eğim duyarlılığı ayarlardan değiştirilebilir.
- iPhone'da eğim sensörü izni gerekir: bu mod ilk seçildiğinde "Eğim sensörüne izin ver" butonlu kısa bir ekran gösterilir (bkz. 2.3).
- Eğim sensörü yoksa ya da izin verilmezse oyun otomatik olarak iki ip kontrolüne geçer ve bunu kullanıcıya söyler.

---

## 5. Etaplar ve pist özellikleri

Oyun **kariyer modu** üzerine kurulur. Etaplar "dünyalar" içinde gruplanır. Her dünya yeni bir özellik tanıtır, böylece oyun tekrara düşmez.

| Dünya | Tema önerisi | Tanıtılan özellik |
|---|---|---|
| 1 | Çayır Parkı (gündüz, "C · Pastel Park" tasarımı) | Temel kıvrımlı yollar + **vakum yardımı** |
| 2 | Orman Parkı (gündüz, daha çok ağaç) | **Daralan yollar** |
| 3 | Bahçe Labirenti (ikindi) | **Kısa yol / uzun yol ayrımları** |
| 4 | Göl Kenarı (akşam, "D · Lavanta Akşamı" tasarımı) | **Rüzgâr bölgeleri** |
| 5 | Eski Maden Parkı | **Mıknatıslar** |
| 6 | Tepe Parkı (gün doğumu) | Hepsinin karışımı |

Bütün dünyalar açık hava park sahnesidir; sadece günün saati, ağaçlar ve renk tonu değişir. Her dünyada 10 etap olacak. İlk sürüm için Dünya 1–3 yeterli (30 etap); Dünya 4'ün akşam teması ileriki sürümde.

### 5.1 Vakum (ilk etaplar için kolaylık)
- İlk etaplarda, tehlikeli viraj ve dar geçitlerin yanında **vakum bölgeleri** bulunur.
- Top bu bölgedeyken hafifçe pistin ortasına doğru çekilir; böylece yeni başlayan oyuncu kolayca geçer.
- Görsel olarak hafif parıldayan, içe doğru akan halkalar şeklinde gösterilir.
- Vakum gücü dünyalar ilerledikçe azalır, Dünya 3'ten sonra (yardım modu kapalıysa) tamamen kalkar.

### 5.2 Daralan yollar
- Yol genişliği pist boyunca değişebilir. Dar yerlerde çubuğun neredeyse düz tutulması gerekir.

### 5.3 Kısa yol / uzun yol
- Pist bazı yerlerde **ikiye ayrılır** ve sonra yeniden birleşir.
- **Kısa yol:** daha dar, daha keskin virajlı, riskli ama hızlı.
- **Uzun yol:** daha geniş ve güvenli ama daha uzun sürer.
- Ayrımın başında küçük bir tabela gösterilir (ör. "Kısa yol ⚡" / "Güvenli yol").

### 5.4 Rüzgâr
- Belirli dikdörtgen bölgelerde topa sabit ya da nabız gibi atan yatay bir kuvvet uygulanır.
- Görsel: rüzgâr yönünde akan çizgiler veya yapraklar.

### 5.5 Mıknatıs
- Pistin yanına yerleştirilmiş mıknatıslar, belirli yarıçap içinde topu kendine doğru çeker. Kuvvet uzaklıkla azalır.
- Bazı mıknatıslar açılıp kapanabilir (zamanlı).

### 5.6 Kontrol noktaları
- Pist üzerinde yatay **kontrol noktası çizgileri** vardır (bayrakla gösterilir).
- Top düşerse son geçilen kontrol noktasından devam eder. Süre durmaz; düşmek zaman kaybettirir ama etap baştan başlamaz.
- Etap başına 1–3 kontrol noktası. Yardım modunda daha sık.

### 5.7 Toplanabilir yıldızlar
- Her etapta **3 adet** toplanabilir yıldız vardır. Genellikle riskli yerlere, kısa yola ya da yolun kenarına konur.
- Topun merkezi yıldıza belirli yakınlıkta geçerse yıldız toplanır.
- Hangi yıldızların toplandığı etap bazında kaydedilir.

---

## 6. Süre, yıldız, puan ve etap sonu

### 6.1 Süre yıldızları
- Her etabın üç süre hedefi vardır: `bronz`, `gümüş`, `altın` (saniye).
- Etabı bitirmek **1 süre yıldızı**, gümüş süreyi geçmek **2**, altın süreyi geçmek **3** süre yıldızı verir.

### 6.2 Puan
- Etap sonunda kazanılan **puan** = süre yıldızlarına göre taban puan + toplanan her yıldız için ek puan + süreye göre küçük bir bonus.
- Puan sadece **ilk kez kazanılan** yıldızlar ve **rekor kırıldığında** aradaki fark için verilir; aynı etabı tekrar tekrar oynayıp sonsuz puan kasılamaz.
- Puan, mağazada top ve kostüm almak için kullanılan oyun içi paradır. Gerçek parayla satın alma yoktur.

### 6.3 Etap sonu ekranı
Şunları gösterir:
- Bitiş süresi
- Kazanılan süre yıldızları (0–3) ve toplanan yıldızlar (0–3)
- Kişisel rekor ve **rekora yakınlık** ("Rekora 0,4 sn kaldı!" ya da "Yeni rekor! −1,2 sn")
- Bir sonraki süre yıldızı için gereken süre ("Altın için 2,1 sn daha hızlı olmalısın")
- Kazanılan puan
- Butonlar: **Tekrar**, **Hayaletle yarış**, **Sonraki etap**

---

## 7. Mağaza: toplar ve kostümler

Mağazada her şey **kazanılan puanla** yavaş yavaş açılır.

### 7.1 Farklı özellikte toplar
Toplar oyunun hissini değiştirir:

Her top türünün **kendine özgü rengi ve deseni** vardır; oyuncu topa bakınca hangi türü kullandığını hemen anlamalı. Varsayılan top **beyazdır** (Standart). Bütün toplar koyu parkur üzerinde rahat görünecek kadar açık tonlu olmalı.

| Top | Özellik | Görünüm (renk ve desen) |
|---|---|---|
| Standart | Dengeli; başlangıç topu | **Beyaz**, düz, yumuşak gölgeli |
| Ağır | Yavaş hızlanır, rüzgârdan ve mıknatıstan az etkilenir | **Açık gri mermer**: beyaz zemin üzerinde ince gri damarlar, biraz mat |
| Hafif | Çabuk hızlanır, rüzgârdan çok etkilenir | **Şeftali / krem köpük**: açık şeftali zemin, üzerinde küçük açık benekler, çok hafif parlak |
| Kauçuk | Sürtünmesi yüksek, durması kolay | **Nane yeşili**: tenis topu gibi kavisli beyaz bir dikiş çizgisi, mat |
| Buz | Sürtünmesi çok düşük, kayar; zor ama hızlı | **Buz mavisi, yarı saydam**: içinde ince kristal çizgiler, belirgin parlama |

- Top döndükçe deseni de dönmeli (yuvarlanma hissi için desen, topun kat ettiği yola göre döndürülür).
- Desenler kod içinde gradyan ve basit şekillerle ya da küçük doku görselleriyle çizilebilir; her tür için ayrı bir "top görünümü" tanımı olsun (`src/game/ballSkins.ts`).

Adillik kuralı: Rekorlar ve hayaletler **hangi topla** yapıldığıyla birlikte kaydedilir. Etap sonu ekranında rekorun hangi topla kırıldığı gösterilir.

### 7.2 Kostümler (sadece görüntü)
Kostümlerin oyuna **hiçbir etkisi yoktur**, sadece görünümdür. Topun üzerine giydirilir:
- **Renk** (topun renk tonu varyantı; top türünün deseni korunur, böylece tür hâlâ tanınır. Varsayılan: türün kendi rengi)
- **Etiket / çıkartma**
- **Şapka**
- **Gözlük**
- **Forma**
- **Numara** (topun üzerinde yazan ralli numarası, oyuncu seçer)

Kostüm parçaları ayrı katmanlar olarak çizilmeli ki birlikte giyilebilsinler (ör. beyaz top + 7 numara + kask + güneş gözlüğü). Mağazada önizleme olmalı. Fiyatlar ucuzdan pahalıya kademeli olmalı ki oyuncu her birkaç etapta bir yeni şey alabilsin.

---

## 8. Oyun modları

### 8.1 Kariyer modu (ana mod)
- Dünya haritası → etap seçimi.
- Bir sonraki dünyanın kilidi, toplam yıldız sayısıyla açılır (ör. Dünya 2 için 15 yıldız).
- Her etap kartında: en iyi süre, kazanılan süre yıldızları, toplanan yıldızlar.

### 8.2 Hayaletle yarış
- Oyuncunun bir etaptaki **en iyi denemesi kaydedilir**: her karede çubuğun iki ucunun yüksekliği ve topun konumu (saniyede 30 örnek yeterli, aradaki kareler enterpolasyonla).
- Hayaletle yarışta bu kayıt **yarı saydam bir çubuk ve top** olarak, oyuncuyla aynı anda oynatılır.
- Ekranın üstünde anlık fark gösterilir: "+0,8 sn" (kırmızı, gerideysen) / "−0,3 sn" (yeşil, öndeysen).
- Hayalet, oyuncunun o anki kostümünden farklı, soluk ve saydam görünmeli.
- İlk sürümde sadece kendi rekoruna karşı yarış. (İleride: arkadaşın hayaleti.)

### 8.3 Sonsuz mod (sonraki sürüm — Faz 5)
- Otomatik üretilen, bitişi olmayan pist. Gittikçe daralır ve yeni engeller eklenir.
- Skor: çıkılan yükseklik (metre). Tek can; düşünce biter.
- Pist üretimi, etaplarda kullanılan parçaların rastgele ama oynanabilir şekilde birleştirilmesiyle yapılır.

---

## 9. Etap veri formatı

Etaplar JSON dosyaları olarak `src/levels/` klasöründe tutulmalı. Önerilen format:

```json
{
  "id": "w1-03",
  "name": "Çayır Virajı",
  "world": 1,
  "height": 6000,
  "boardWidth": 1000,
  "road": [
    { "x": 500, "y": 0,    "w": 260 },
    { "x": 380, "y": 600,  "w": 240 },
    { "x": 640, "y": 1300, "w": 200 }
  ],
  "branches": [
    {
      "type": "short",
      "points": [ { "x": 640, "y": 1300, "w": 120 }, { "x": 520, "y": 1800, "w": 110 } ]
    }
  ],
  "finishHole": { "x": 500, "y": 5900, "r": 34 },
  "checkpoints": [2000, 4000],
  "stars": [ { "x": 420, "y": 900 }, { "x": 560, "y": 1650 }, { "x": 500, "y": 5200 } ],
  "vacuum": [ { "x": 380, "y": 600, "radius": 160, "strength": 0.6 } ],
  "wind": [ { "x": 0, "y": 3000, "w": 1000, "h": 500, "force": -0.4, "pulse": 1.5 } ],
  "magnets": [ { "x": 900, "y": 3600, "radius": 250, "strength": 0.5, "onOff": [2, 1] } ],
  "timeTargets": { "bronze": 60, "silver": 40, "gold": 28 }
}
```

- `road`: pistin merkez çizgisi; her noktada `w` o noktadaki yol genişliği. Noktalar arası yumuşak eğriyle (Catmull-Rom) birleştirilir.
- `branches`: ana yoldan ayrılıp yeniden birleşen kısa/uzun yollar.
- Pist alanı kontrolü: topun merkezinin ana yola ya da herhangi bir kola uzaklığı, o noktadaki `w/2` değerinden küçükse top pisttedir.
- Etap tasarlamayı kolaylaştırmak için geliştirici modunda basit bir **etap önizleyici** olmalı: JSON'u yükleyip pisti, bölgeleri ve yıldızları gösterir, oyunu o etaptan başlatır.

---

## 10. Yardım modu (özellikle çocuklar için)

Ayarlardan açılıp kapanır. Açıkken:
- Vakum bölgeleri tüm dünyalarda aktif olur ve biraz daha güçlüdür.
- Topun en yüksek hızı biraz düşürülür.
- Kontrol noktaları daha sık konur (her etapta en az 3).
- Rüzgâr ve mıknatıs güçleri yarıya iner.
- Yardım modunda yapılan süreler ayrı kaydedilir ve küçük bir "yardımlı" simgesiyle gösterilir; normal rekorlarla karıştırılmaz.
- Yardım modunda da yıldız ve puan kazanılır (çocuk motive olsun), ama süre yıldızı en fazla 2'dir.

---

## 11. Görsel stil

Oyun, sıradan "kod ile çizilmiş" oyunlara benzememeli. Hedef: Unity ile yapılmış şık mobil oyunlar gibi **yumuşak ışıklı, pastel renkli, sade ve gözü yormayan** bir görünüm.

- Ana görsel referans: `docs/tasarim/` klasöründeki **C · Pastel Park** ekranları (oyun ekranı, etap sonu, mağaza). Bunlar birebir hedef görünümdür.
- **D · Lavanta Akşamı** ekranları, Dünya 4'ün (Göl Kenarı, akşam) teması ve arayüz için ikinci referanstır.
- Renk kodları, yazı tipleri ve bileşen kuralları: `docs/TASARIM_REHBERI.md`.

### 11.1 Sahne (gerçekçi park)
- Arka plan açık hava bir park: pastel gökyüzü, uzakta yumuşak tepeler, katman katman yuvarlak tepeli ağaçlar, biçilmiş çim (açık ve koyu şeritli), uzakta bank ve sokak lambası gibi küçük ayrıntılar.
- Arka plan **paralaks** katmanlardan oluşur (gökyüzü, uzak ağaçlar, yakın ağaçlar, çim). Kamera yukarı çıktıkça katmanlar farklı hızlarda kayar; derinlik hissi verir.
- **Stand:** Çimlerin üzerinde duran, arkaya doğru hafif eğimli dikey bir çerçeve. İki yan direk, tepede iki makara, altta koyu bir taban tepsisi. Çimin üzerine yumuşak gölge düşer.
- **Parkur:** Varsayılan renk **siyah / koyu gri** (#2E3136 civarı), kenarlarında çok ince açık ton bir kenar (pah) ve arkaya düşen yumuşak gölge. Parkur parçalarının arasından park görünür.
- **Parkur rengi oyuncu tarafından değiştirilebilir** (Ayarlar → Görünüm → Parkur rengi). Seçenekler: Siyah (varsayılan), Antrasit, Gece mavisi, Orman yeşili, Bordo, Ceviz kahve, Lavanta, Pastel mint. Kenar (pah) ve gölge tonları seçilen renkten otomatik türetilir.
- Açık bir parkur rengi seçildiğinde top ile parkur arasındaki kontrast düşerse, topun çevresine otomatik olarak ince koyu bir kontur çizilir; top her zaman net görünmeli.
- Ayarlar ekranında seçili parkur rengi ve seçili top, küçük bir önizlemede birlikte gösterilir.
- **Bitiş deliği:** Parkurun tepesinde, içi karanlık, kenarında ince metal halka olan yuvarlak delik. Yanında küçük pastel bir bayrak.
- **Çubuk:** Fırçalanmış metal görünümlü, ortası hafif çukur, uçları yukarı kalkık.
- **Top:** Varsayılan Standart top **beyaz**, yumuşak gölgeli (üst solda parlama, alt sağda hafif gri ton), altında çubuğa düşen küçük bir gölge. Diğer top türlerinin renk ve desenleri Bölüm 7.1'deki tablodadır; ışık ve gölge kuralı hepsinde aynıdır. Kostümler topun üzerine katman olarak giydirilir.
- **Halat:** Gerçek halat dokusu (çapraz bükülmüş lifler, açık bej ve koyu bej tonlar), ucunda topak düğüm.

### 11.2 Renk ve arayüz
- Pastel ve düşük doygunluklu renkler; saf beyaz yerine krem, saf siyah yerine koyu antrasit (yalnızca parkur koyu).
- Arayüz elemanları yarı saydam, buzlu cam etkili krem kartlar (`backdrop-filter: blur`), büyük köşe yuvarlaklıkları (16–28 px), yumuşak ve geniş gölgeler.
- Vurgu renkleri: mercan (#E8907E), nane (#8CCFB4), pastel altın (#F2C46D). Metin rengi koyu gri (#3B3F45).
- Yazı tipi: başlıklar için **Fredoka**, metinler için **Nunito** (ikisi de Google Fonts, ücretsiz).
- İkonlar yumuşak köşeli, tek kalınlıkta çizgi ikonlar. Emoji kullanılmayacak.
- Animasyonlar yumuşak olmalı: butonlar basılınca hafif küçülür, kartlar yaylanarak açılır (ease-out, 150–250 ms).

### 11.3 Three.js ile sahne
Sahne Three.js ile **2,5B** çizilir: kamera standa önden, hafif yukarıdan bakar (hedef görsellerdeki açı), fizik 2B kalır.

- **Işık:** Bir yumuşak yönlü ışık (güneş, sol üstten, gölge atar) + gökyüzü/zemin yarımküre ışığı (pastel mavi / çim yeşili). Gölgeler yumuşak (`PCFSoftShadowMap`), sert ve siyah değil.
- **Renk ve ton:** `ACESFilmicToneMapping`, sRGB çıkış. Malzemeler çoğunlukla `MeshStandardMaterial`, düşük metaliklik, yüksek pürüzlülük (pastel, mat görünüm). Çubuk ve bitiş deliği halkası hafif metalik.
- **Sis:** Uzak ağaçlar ve tepeler için hafif, gökyüzü renginde sis; derinlik hissi verir.
- **Stand:** Kutu ve silindirlerden, köşeleri yuvarlatılmış (`RoundedBoxGeometry`) direkler; tepede makaralar; altta taban tepsisi.
- **Parkur:** Etap JSON'undaki merkez çizgisi ve genişlikten üretilen, birkaç mm kalınlığında **ekstrüde** şerit; kenarları pahlı; arkasına gölge düşer.
- **Çubuk:** Çukurlu eğriden üretilen tüp/ekstrüzyon geometri, uçlarında kalkık duvarlar.
- **Top:** Küre; top türüne göre malzeme ve doku (`ballSkins.ts`; desenler `CanvasTexture` ile üretilebilir). Buz top yarı saydam (`MeshPhysicalMaterial`, transmission).
- **Halatlar:** Halat dokulu `TubeGeometry`; ucunda düğüm (birkaç iç içe torus ya da küre). Tutulan nokta parmağı takip eder.
- **Ağaçlar ve park:** Düşük poligonlu, yuvarlak taçlı ağaçlar (birkaç küreden), bank, sokak lambası. Arka plan katmanları kamera yukarı çıktıkça paralaks hissi verecek şekilde farklı derinliklerde durur.
- **Hazır modeller:** İstenirse CC0 lisanslı hazır modeller (ör. Kenney.nl doğa paketleri, glTF) kullanılabilir; renkleri pastel paletle değiştirilir. Kullanılan her dış dosyanın kaynağı ve lisansı `ASSETS.md` içinde yazılı olmalı.
- **Boyut:** Toplam indirme boyutu 10 MB'ın altında kalmalı (sıkıştırılmış dokular, küçük modeller).

---

## 12. Ekranlar

1. **Açılış:** Oyun logosu, "Oyna" butonu, ayarlar ve mağaza simgeleri. İlk dokunuş aynı zamanda ses ve (mümkünse) tam ekranı başlatır.
2. **Dünya haritası:** Dünyalar ve kilitleri, toplam yıldız.
3. **Etap seçimi:** Etap kartları (süre, yıldızlar).
4. **Oyun ekranı:** Pist, çubuk, top, kenarlarda ip(ler), üstte süre ve toplanan yıldızlar, duraklat butonu, (hayalet modunda) anlık fark göstergesi.
5. **Duraklatma:** Devam, Yeniden başlat, Ayarlar, Haritaya dön.
6. **Etap sonu:** Bölüm 6.3'teki bilgiler.
7. **Mağaza:** "Toplar" ve "Kostümler" sekmeleri, önizlemeli top, puan bakiyesi.
8. **Ayarlar:**
   - Kontroller: kontrol türü (İki ip / Eğme + tek ip), tek ipin tarafı (sağ / sol), hassasiyet, eğim kalibrasyonu
   - Görünüm: parkur rengi (önizlemeli)
   - Oyun: yardım modu
   - Ses ve titreşim (iPhone'da titreşim desteklenmez notu)
   - Kayıt notu: "İlerlemen bu tarayıcıda saklanır"
   - İlerlemeyi sıfırla (onay ister)

---

## 13. Geliştirme fazları

Her fazın sonunda dur, neyin bittiğini ve nasıl test edileceğini anlat.

**Faz 1 — Çekirdek his (en önemli)**
- Proje kurulumu (Vite + Three.js + TypeScript + Vitest).
- **GitHub Pages'e otomatik yayın** (GitHub Actions) ve temel PWA ayarları ilk fazda kurulur; böylece her aşama telefondan linkle denenebilir.
- Çubuk ve top fiziği, iki ip kontrolü (halatın herhangi bir noktasından tutma dahil), kamera takibi.
- Pist çizimi ve düşme kuralı, çukurlu ve uç duvarlı çubuk, bitiş deliği, süre.
- Görsel stil (Bölüm 11) ilk fazdan itibaren uygulanmalı; geçici "kutu ve çizgi" görünümüyle ilerlenmemeli.
- Gündüz park sahnesi (hedef: `docs/tasarim/01-gunduz-oyun-ekrani.png`), beyaz Standart top, siyah parkur.
- 3 deneme etabı.
- Fizik sabitleri (yerçekimi, sürtünme, uç hızı, hassasiyet) geliştirici panelinden canlı değiştirilebilir olsun; doğru his bulunana kadar ayarlanacak.

**Faz 2 — Pist özellikleri ve kontroller**
- Eğme + tek ip kontrolü, sağlak/solak seçeneği, kalibrasyon.
- Ayarlar ekranı: kontroller, parkur rengi seçimi (önizlemeli, açık renklerde topa otomatik kontur), yardım modu anahtarı (davranışı Faz 4’te), ses ve titreşim.
- Kontrol noktaları, toplanabilir yıldızlar, vakum, daralan yollar, kısa/uzun yollar, rüzgâr, mıknatıs.
- Etap JSON formatı ve etap önizleyici.

**Faz 3 — Kariyer, puan ve etap sonu**
- Dünya haritası, etap seçimi, kilit sistemi.
- Süre yıldızları, puan hesabı, etap sonu ekranı (rekora yakınlık dahil).
- Yerel kayıt.
- Dünya 1–3 için toplam 30 etap.

**Faz 4 — Hayalet, mağaza ve yardım modu**
- Hayaletle yarış.
- Dünya 4 akşam teması için sahne renklerinin temadan okunması (`docs/tasarim/04-aksam-oyun-ekrani.png`); etapları sonraki sürümde.
- Mağaza: 5 top türü (her biri kendi renk ve deseniyle, `docs/tasarim/08-top-gorunumleri.png`) ve kostüm katmanları (renk, etiket, şapka, gözlük, forma, numara).
- Yardım modu.
- PWA'nın tamamlanması: simgeler, açılış ekranı, çevrimdışı oynama, "Ana ekrana ekle" önerisi.

**Faz 5 — Sonsuz mod (sonraki sürüm)**
- Otomatik pist üretimi ve yükseklik skoru.

**Faz 6 — Mağaza uygulamaları (sonraki sürüm)**
- Capacitor ile Android ve iOS paketleme; `platform/` katmanına yerel titreşim ve eğim eklentileri.

---

## 14. Kapsam dışı (ilk sürümde yapılmayacak)

- Sunucu, online sıralama, hesap, arkadaş sistemi, cihazlar arası kayıt (ileride Supabase ile eklenebilir)
- Google Play / App Store uygulaması (Faz 6)
- Reklam ve gerçek parayla satın alma
- Aynı telefonda iki kişilik mod
- Günlük etap
