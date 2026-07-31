# Phase 4: Dosya Ekleri ve Inline Görseller - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 4-Dosya Ekleri ve Inline Görseller
**Areas discussed:** Ek listesi yerleşimi ve alan bütçesi, Yükleme anı ve gönderim kilidi, Boyut/tip politikası ve reddetme davranışı, Gelen ekler ve gelen e-postadaki görseller, Kalan gri noktalar (inline/ek ayrımı, kaldırma, kirli taslak)

---

## Ek listesi yerleşimi ve alan bütçesi

### Chip yeri

| Option | Description | Selected |
|--------|-------------|----------|
| Araç çubuğu üstünde, composer içinde | Mevcut panel yuvası; editör ve Gönder yerinde kalır, Zendesk'e yakın | ✓ |
| Editörün altında, Gönder barının üzerinde | Gmail sırası; ama D-07 alan bütçesini sıkıştırır | |
| Editörün üstünde (alıcı satırının altında) | Yazı alanına dokunmaz; ama D-11 alıcı satırıyla yarışır | |

### Alan bütçesi

| Option | Description | Selected |
|--------|-------------|----------|
| 2-3 chip görünür, gerisi kendi içinde kaysın | D-07'nin "büyü sonra kay" deseniyle tutarlı | |
| Tek satır özet: "3 dosya ▾" | En az yer; ekleri görmek için fazladan tıklama | ✓ |
| Hepsi görünsün, sınırsız büyüsün | En şeffaf; 5+ dosyada thread'i görünmez yapar | |

### Sadece ek gönderimi

| Option | Description | Selected |
|--------|-------------|----------|
| Evet, ek varsa metin zorunlu değil | Gmail/Zendesk davranışı; 3 guard değişmeli | |
| Hayır, her zaman metin gerekli | Guard mantığı değişmez, daha az risk | ✓ |

**Notes:** "3 dosya ▾" seçimi ile kullanıcının başlangıçtaki "yüklediğini görebilsin" hedefi arasındaki gerilim kullanıcıya belirtildi; 1-2 dosyada chip'i doğrudan gösterme incelmesi Claude takdirine bırakıldı (UI-SPEC'te netleşecek).

---

## Yükleme anı ve gönderim kilidi

| Soru | Seçenekler | Seçim |
|------|-----------|-------|
| Yükleme anı | Seçilir seçilmez hemen **✓** / Gönder'e basınca topluca | Hemen (grispi-ui davranışı; inline görsel zaten bunu zorunlu kılıyor) |
| Gönder kilidi | Kilitlensin, biter bitmez açılsın **✓** / Aktif kalsın, gönderim beklesin | Kilitlensin |
| Yükleme hatası | Chip kalsın + "Tekrar dene" **✓** / Listeden düşsün + hata | Chip kalsın + retry |

**Notes:** Retry kararı grispi-ui'dan bilinçli sapma — orada başarısız dosya sessizce listeden düşüyor. Faz 3'ün D-10/D-17 retry deseniyle hizalandı. Hemen-yükleme bedeli (terk edilen taslakta sahipsiz dosya) kullanıcıya açıkça belirtildi ve kabul edildi.

---

## Boyut/tip politikası ve reddetme davranışı

### Boyut/adet

| Option | Description | Selected |
|--------|-------------|----------|
| ~10MB/dosya, ~25MB toplam, max 10 dosya | E-posta gerçekçi (Gmail 25MB'da reddediyor) | ✓ |
| ~50MB/dosya, sınırsız (grispi-ui) | Ana uygulamayla birebir; teslimat sessizce patlayabilir | |
| 7MB/dosya, 10MB toplam (Zendesk) | Teslimat garanti; destek işinde fazla dar | |

### Tip politikası

| Option | Description | Selected |
|--------|-------------|----------|
| Sadece SVG ve HTML bloklu | XSS yüzeyini kapatır; FreeScout vb. örnekleri sunuldu | |
| Beyaz liste (görsel/PDF/Office/metin/ZIP) | En güvenli; meşru .log/.har/.apk engellenir | |
| Hiçbir kısıt yok (grispi-ui gibi) | En az sürtünme; render riski bize geçer | ✓ |

### Kısmi ret

| Option | Description | Selected |
|--------|-------------|----------|
| Geçerliler eklensin + satır içi uyarı | İş kaybolmaz; reddedilenler nedeniyle listelenir | ✓ |
| Hiçbiri eklenmesin, toplu hata | Öngörülebilir ama geçerli dosyalar tekrar sürüklenmeli | |

**Notes:** Kullanıcı serbest metinle ekledi: *"önerdiğin gibi olsun. toast mekanizması da kuralım shadcn üzerinden"* → toast (sonner) yeni bir karar olarak eklendi (CONTEXT D-12). Tip kısıtı "yok" seçildiği için Claude bir güvenlik önlemi ekledi ve kullanıcıya bildirdi: SVG yüklenebilir ama panelde `<object>`/`<iframe>` ile gömülmez (CONTEXT D-10).

---

## Gelen ekler ve gelen e-postadaki görseller

| Soru | Seçenekler | Seçim |
|------|-----------|-------|
| Ek görünümü | Görseller küçük resimli + diğerleri chip / Hepsi tek tip chip | **Serbest metin:** "grispi ui'ı örnek alabilirsin ek gösterme konusunda. orayı yeni yaptık sayılır ve iyi oldu." |
| Açma | Yeni sekmede **✓** / Panel içi lightbox | Yeni sekme |
| Gelen inline görseller | Gövdede gösterme + ek listesinde göster **✓** / Gövdede göster / "Görselleri göster" düğmesi | Gövdede gösterme, listede göster |

**Notes:** Claude, seçimlerin birleşiminden doğan tuzağı önceden çıkardı: grispi-ui `inline: true` ekleri listeden filtreliyor (çünkü gövdede gösteriyor); biz gövdede göstermediğimiz için aynı filtreyi uygularsak karşı tarafın ekran görüntüsü tamamen kaybolurdu. Sonuç: görsel muamele grispi-ui'dan alınır, `inline` filtresi alınmaz (CONTEXT D-22).

---

## Kalan gri noktalar

| Soru | Seçenekler | Seçim |
|------|-----------|-------|
| Editöre görsel sürüklenirse | Her sürükleme ek olur, sadece paste inline **✓** / Yazı alanına inline, dışına ek | Her sürükleme ek |
| Inline görsel chip listesinde de görünsün mü | Hayır, sadece gövdede **✓** / Evet | Sadece gövdede |
| Ek kaldırılınca sunucu | Sadece referans düşsün **✓** / Sunucudan da silinsin | Referans düşsün |
| Ekli taslakla geri dönüş | Ek de taslak sayılır **✓** / Sadece metin sayılır | Ek de taslak sayılır |

**Notes:** "Sunucudan da silinsin" seçeneğinin bir silme endpoint'i gerektirdiği ve varlığının doğrulanmamış olduğu belirtildi; kullanıcı referans-düşürme yolunu seçerek probe'a ek soru eklenmesini engelledi.

---

## Claude's Discretion

- 1-2 dosyada chip'leri doğrudan gösterme, 3+ dosyada özete katlama incelmesi (UI-SPEC)
- Chip içeriği: ad kısaltma biçimi, boyut formatı, küçük resim boyutu
- Yükleme ilerleme göstergesinin biçimi (yüzde vs belirsiz spinner)
- Toast konumu/süresi
- `AbortController` ile yükleme iptalinin bu faza dahil edilip edilmeyeceği (maliyet/fayda plan aşamasında)

## Deferred Ideas

- Sahipsiz (orphan) dosya temizliği — sunucu tarafının işi
- Yükleme iptali (`AbortController`) — ayrı iyileştirme olabilir
- Gelen gövde görsellerini "Görselleri göster" düğmesiyle açma (Gmail deseni)
- Panel içi lightbox önizleme
- Client-side görsel sıkıştırma (`compressorjs`)
