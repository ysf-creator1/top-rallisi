# Top Rallisi — Claude Code çalışma kuralları

Telefonda dikey oynanan bir beceri ve yarış oyunu. Oyuncu iki halatla bir çubuğu kaldırıp beyaz topu koyu parkur üzerinde tutarak yukarıdaki bitiş deliğine götürür. Oyun **GitHub Pages** üzerinden web'de yayınlanır; linke tıklayan herkes kurulum yapmadan tarayıcıda oynar. Aynı zamanda PWA'dır.

## Önce oku
1. `docs/TOP_RALLISI_TARIF.md`: oyunun tam tarifi (kurallar, teknoloji, fizik, kontroller, modlar, veri formatı, fazlar)
2. `docs/TASARIM_REHBERI.md`: renkler, yazı tipleri, sahne ve arayüz kuralları
3. `docs/tasarim/*.png`: hedef ekran görüntüleri. Bir ekranı yapmadan önce ilgili görsele bak. Tam değerler gerekirse `docs/tasarim/kaynak/*.html` dosyasını oku.

Tarif ile bu dosya çelişirse tarif geçerlidir. Tarifte olmayan bir karar gerekirse en basit makul seçimi yap ve faz sonu raporunda belirt.

## Çalışma şekli
- Tarifteki **fazlara** (Bölüm 13) sırayla uy. Her faz bitince **dur** ve kullanıcıya Türkçe olarak şunları yaz:
  - ne yapıldı (kısa liste),
  - nasıl denenir: yerelde hangi komut, telefonda hangi link (GitHub Pages adresi),
  - kendi verdiğin kararlar,
  - bir sonraki faz.
- Kullanıcı onay vermeden bir sonraki faza geçme.
- Kullanıcı yazılımcı değil; açıklamaları sade Türkçe ile yap, teknik terimleri gerektiğinde kısaca açıkla. GitHub ile ilgili adımlarda (depo oluşturma, Pages'i açma) ne yapacağını tıklama tıklama anlat.
- Git: anlamlı, küçük commit'ler at. Kullanıcı istemeden zorla gönderme (`--force`) yapma.

## Teknik çerçeve
- TypeScript (strict), Vite, **Three.js** (görüntü), elle yazılmış **2B fizik** (fizik motoru yok), HTML/CSS arayüz katmanı, Vitest.
- Fizik `src/game/physics/` altında, sabit adımlı (120 Hz) ve deterministik. Three.js fizik durumunu sadece çizer.
- Sunucu yok. Kayıt `localStorage` üzerinde, `src/save/` katmanında, sürüm numaralı.
- Tarayıcıya özel API'ler (titreşim, eğim, kayıt, tam ekran) sadece `src/platform/` içinde; oyun kodu bunları doğrudan çağırmaz (ileride Capacitor'a geçiş için).
- Yazı tipleri `@fontsource/*` ile gömülür. PWA için `vite-plugin-pwa`.
- Reklam, takip betiği, dış CDN yok; her şey pakete dahil. **İstisna (kullanıcının isteği, 2026-11-09):** kendi anonim oyun istatistiklerimiz Firestore'a yazılır ve `public/rapor.html` raporunda gösterilir. Ayrıntılar `RAPOR.md` dosyasında.

## Yayın (GitHub Pages)
- `vite.config.ts` içinde `base: '/top-rallisi/'` (depo adı farklıysa ona göre).
- `.github/workflows/deploy.yml`: `main` dalına her gönderimde `npm ci`, `npm test`, `npm run build`, ardından `actions/upload-pages-artifact` ve `actions/deploy-pages` ile yayın. Testler geçmezse yayın yapılmaz.
- Kullanıcının GitHub'da yapması gerekenler (Faz 1 raporunda adım adım anlat): depoyu **herkese açık** oluşturmak, Settings → Pages → Source: **GitHub Actions** seçmek.
- PWA önbelleği yüzünden eski sürüm takılı kalmasın: yeni sürüm gelince "Yeni sürüm hazır, yenile" bildirimi göster.

Önerilen klasör yapısı:
```
src/
  main.ts
  config/        fizik, puan ve tema sabitleri (physics.ts, scoring.ts, theme.ts)
  game/
    physics/     çubuk, top, çukur, duvarlar, düşme, bitiş deliği
    input/       halat kontrolü, eğim kontrolü
    render/      Three.js sahnesi: ışık, park, stand, parkur, çubuk, halat, top (ballSkins.ts)
    levels/      etap yükleme ve doğrulama
  ui/            HTML/CSS ekranları (açılış, harita, oyun üstü, etap sonu, mağaza, ayarlar)
  platform/      titreşim, eğim izni, tam ekran, kayıt erişimi
  save/          kayıt ve sürüm geçişleri
  levels/        etap JSON dosyaları (w1-01.json …)
  i18n/tr.json   bütün arayüz metinleri
public/          PWA simgeleri
tests/           Vitest testleri
.github/workflows/deploy.yml
```

## Kurallar
- **Fizik sabitleri tek yerde** (`src/config/physics.ts`). Geliştirici panelinden canlı değiştirilebilmeli (adrese `?dev=1` eklenince açılır; GitHub Pages'te de çalışsın ki kullanıcı telefonda ayar yapabilsin). Panelde FPS göstergesi de olsun.
- **Arayüz metinleri** sadece `src/i18n/tr.json` içinde.
- **Testler:** fizik (çukur, uç duvarları, düşme, bitiş deliği), puan, yıldız kuralları, hayalet kaydı, kayıt sürüm geçişi ve etap JSON doğrulaması. `npm test` her fazın sonunda geçmeli.
- **Komutlar:** `npm run dev` (yerelde), `npm run dev -- --host` (aynı Wi-Fi'deki telefondan deneme), `npm test`, `npm run build`, `npm run preview`.
- Halat: **herhangi bir noktasından** tutulabilir, hareket göreli (tarif 4.1).
- Varsayılanlar: **beyaz top, siyah parkur**. Top türlerinin kendi renk ve deseni var; parkur rengi Ayarlar'dan değişir (tarif 7.1 ve 11.1).
- Dokunma: oyun alanında tarayıcı kaydırma/yakınlaştırma kapalı; çoklu dokunma (iki halat aynı anda) çalışmalı.
- Performans: orta seviye Android telefonda 60 FPS hedefi; düşerse kalite otomatik düşer (tarif 2.3).

## Görsel kalite (çok önemli)
- Bu oyun önceki "kodla çizilmiş" oyunlara **benzememeli**. Hedef görseller `docs/tasarim/` içinde; ekranlar bunlara olabildiğince yakın olmalı.
- Three.js sahnesi tarif Bölüm 11.3'teki ışık, gölge, sis ve malzeme kurallarına uymalı: pastel, yumuşak ışıklı, mat.
- Düz renkli dikdörtgen butonlar, varsayılan sistem yazı tipi, emoji kullanma.
- Hazır model ya da doku kullanırsan sadece CC0 / serbest lisanslı olanları kullan ve `ASSETS.md` içine kaynağını yaz.
- Her faz sonunda ekranların görüntüsünü al ve hedef görsellerle karşılaştır; belirgin farkları düzelt ya da raporda belirt.
