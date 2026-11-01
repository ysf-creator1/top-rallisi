# Başlarken (Yusuf için)

Bu klasör, Top Rallisi oyununu Claude Code'a yaptırmak ve GitHub Pages'te ücretsiz yayınlamak için gereken her şeyi içerir.

## Klasörde ne var
- `CLAUDE.md`: Claude Code'un her oturumda otomatik okuduğu çalışma kuralları
- `docs/TOP_RALLISI_TARIF.md`: oyunun tam tarifi
- `docs/TASARIM_REHBERI.md`: renkler, yazı tipleri, görsel kurallar
- `docs/tasarim/`: hedef ekran görüntüleri (8 adet) ve HTML kaynakları

## Hazırlık (bir kez)
1. Bilgisayarında **Node.js 20 veya üstü** ve **Git** kurulu olmalı. Terminalde `node -v` ve `git --version` ile kontrol edebilirsin.
2. Bir **GitHub hesabın** olmalı.
3. Bu klasörü bilgisayarında istediğin yere koy, adı `top-rallisi` olsun.

## Claude Code ile başla
1. Terminalde bu klasöre gir ve Claude Code'u başlat: `claude`
2. İlk mesaj olarak şunu yapıştır:

```
CLAUDE.md, docs/TOP_RALLISI_TARIF.md ve docs/TASARIM_REHBERI.md dosyalarını oku, docs/tasarim klasöründeki görsellere bak. Sonra Faz 1'i yap; GitHub Pages yayınını da kur. Faz bitince dur, GitHub'da benim yapmam gereken adımları ve oyunu nasıl deneyeceğimi anlat.
```

## GitHub Pages'te yayın (Faz 1 sonunda)
Claude Code sana adımları ayrıca anlatacak. Özetle:
1. GitHub'da `top-rallisi` adında **Public (herkese açık)** yeni bir depo oluştur. Ücretsiz planda Pages sadece herkese açık depolarda çalışır, yani kod da herkese görünür olur.
2. Claude Code'a "kodu GitHub'daki depoma gönder" de; depo adresini ver.
3. GitHub'da deponun **Settings → Pages** bölümüne gir, **Source** olarak **GitHub Actions** seç.
4. Birkaç dakika sonra oyun şu adreste açılır: `https://KULLANICI-ADIN.github.io/top-rallisi/`
5. Bu linki telefonda aç ve dene. Sonraki her güncellemede oyun kendiliğinden yeniden yayınlanır.

## Faz faz ilerleme
- Faz 1 bitince oyunu telefonda dene. Özellikle **çubuğun ve topun hissine** odaklan: topun hızı, çukurun derinliği, halatın hassasiyeti. Linkin sonuna `?dev=1` eklersen ayar paneli açılır; değerlerle telefonda oynayabilirsin.
- His oturana kadar Faz 2'ye geçme. Memnunsan şunu yaz: `Faz 1 tamam, Faz 2'ye geç.`

## İpuçları
- Bir şey beğenmezsen somut yaz: "top çok hızlı kayıyor", "halatı tutunca çubuk geç tepki veriyor", "etap sonu ekranı 02 numaralı görsele benzemiyor".
- Görünüm hedeften uzaklaşırsa: `docs/tasarim/01-gunduz-oyun-ekrani.png görseline daha çok benzet` demen yeterli.
- Telefonda eski sürüm görünüyorsa sayfayı yenile; oyun yeni sürüm gelince "yenile" uyarısı da gösterecek.
- Oyuncuların ilerlemesi kendi tarayıcılarında saklanır; tarayıcı verilerini silen oyuncunun ilerlemesi sıfırlanır. Bu şimdilik normal.
- Yeni oturum açınca `CLAUDE.md` zaten okunur; "hangi fazdayız, kaldığın yerden devam et" demen yeterli.
