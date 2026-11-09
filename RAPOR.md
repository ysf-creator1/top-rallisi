# Oyun Raporu (Yusuf için)

Oyun kimin, ne zaman, ne kadar, hangi cihazla ve nereden oynadığını kaydeder. Rapor sayfası bu kayıtları gösterir.

## Rapora nasıl girilir
- **Adres:** https://ysf-creator1.github.io/top-rallisi/rapor.html
- **Kısayol:** bu klasördeki `Top Rallisi Raporu.webloc` dosyasına çift tıkla, rapor tarayıcıda açılır.
- **Terminalden:** `npm run rapor`

Açılınca **Google ile giriş yap**'a bas. Verileri sadece senin iki Google hesabın görebilir (liste aşağıdaki kurallar dosyasında). Başka biri sayfayı açsa bile veri göremez.

## Sağ üstteki düğmeler
- **Yenile:** sadece yeni kayıtları indirir ve bütün analizi baştan yapar. Claude'a sormana gerek yok.
- **PDF:** yazdırma penceresini açar. Hedef olarak **"PDF olarak kaydet"**i seç. PDF, seçili tarih aralığıyla açık renkli olarak çıkar.
- **Çıkış:** Google hesabından çıkar.

Üstteki düğmelerle tarih aralığı seçilir: Bugün, 7, 30 veya 90 gün ya da Tümü. "Deneme oturumlarını gizle" işaretliyken senin `?dev=1` ile açtığın denemeler sayılmaz.

## Raporda neler var
- Özet: oyuncu, oturum, toplam süre, ortalama oturum, etap denemesi, bitirme oranı
- Günlük etkinlik grafiği (oyuncu / oturum / dakika)
- Hangi gün ve saatte oynandığı (ısı haritası)
- Şehir, bölge, ülke ve internet sağlayıcısı
- Cihaz, işletim sistemi, tarayıcı, ekran ve oyunun ana ekrana eklenip eklenmediği
- Cihazlara göre akıcılık (FPS)
- Oyuncu listesi. Satıra tıklayınca o oyuncunun oturum geçmişi açılır, ✎ ile oyuncuya ad verebilirsin.
- Etap etap zorluk: deneme, bitirme oranı, takılan oyuncu, düşüş, süre, yıldız
- Son oturumlar ve mağaza satın alımları
- En altta: ham veriyi JSON olarak indirme

## Ne kaydediliyor, ne kaydedilmiyor
- Kaydedilenler: oyunun açılışı ve süresi; etap başlatma, bitirme ve yarıda bırakma (süre, düşüş, yıldız); mağaza alımları; cihaz bilgisi; internet bağlantısından tahmin edilen şehir.
- Kaydedilmeyenler: ad, e-posta, IP adresi. Her telefona rastgele bir oyuncu kimliği verilir.
- Oyuncu istatistiği **Ayarlar → Anonim istatistik** ile kapatabilir.
- Kayıtlar 2026-11-09'dan itibaren tutuluyor; daha eskisi yok.

## Veriler nerede
- **Firebase projesi:** `top-rallisi-log` (senin ana Google hesabında). Konsol: https://console.firebase.google.com/project/top-rallisi-log/firestore
- Ücretsiz planda. Günde birkaç yüz oturuma kadar ücret çıkmaz.
- Güvenlik kuralları bu deponun **dışında** tutuluyor, çünkü içinde e-posta adresleri var ve depo herkese açık. Yerleri: `../firebase/firestore.rules` ve `../firebase/firebase.json`. Yayınlamak için o klasörde: `npx firebase-tools deploy --only firestore:rules,auth --project top-rallisi-log`
- Raporu görebilecek başka bir hesap eklemek için o kurallardaki e-posta listesine ekleyip yeniden yayınlamak yeterli. Claude'a "rapora şu hesabı ekle" demen yeterli.

## Koddaki yerleri (geliştirici için)
- `src/platform/analytics.ts`: olayları toplar ve toplu halde Firestore'a yazar. İnternet yoksa kuyrukta bekletir.
- `src/config/analytics.ts`: Firebase proje ayarı. Bu değerler gizli değildir.
- `src/ui/app.ts`: olayların gönderildiği yerler (`ls` etap başı, `le` bitiş, `lq` bırakma, `screen`, `buy`, `qdown`).
- `public/rapor.html`: rapor sayfası. Tek dosyadır; analizin hepsini tarayıcıda yapar ve indirdiği kayıtları tarayıcıda saklar.
- `tests/analytics.test.ts`: testler.
- Yerelde (localhost) kayıt gönderilmez. Denemek için adrese `?log=1` ekle.
