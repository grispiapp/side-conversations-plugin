---
phase: 3
slug: g-r-me-detay-ve-ya-am-d-ng-s
status: approved
shadcn_initialized: true
preset: grispi-light
created: 2026-07-28
---

# Phase 3 — UI Design Contract

> E-posta karakterini koruyan, Zendesk esintili dar-panel görüşme deneyimi. Bu belge `03-CONTEXT.md` kararlarını görsel ve etkileşim sözleşmesine dönüştürür.

## Design System

| Property | Value |
|---|---|
| Tool | shadcn-style project primitives |
| Component library | Radix icons + mevcut `src/components/ui` |
| Icon library | `@radix-ui/react-icons` |
| Font | Uygulamanın mevcut sistem font stack'i |
| Theme | yalnız açık tema; ~372px sağ-panel |

## Layout Contract

- `ScreenHeader`: geri oku, iki satıra taşmayan alıcı/konu başlığı, sağda `⋯` menüsü.
- Thread alanı esnek ve kaydırılabilir; en yeni mesajlar altta. Açılışta ilk görülmemiş dış mesaja, yoksa sona kayar.
- Mesajlar sağ/sol chat balonu değildir: kronolojik, tam genişlikte, `border-b` veya 16px boşlukla ayrılan e-posta bloklarıdır.
- İlk karşı taraf mesajında `Ad Soyad <mail>`; ardışık mesajlarda sade ad; giden mesajda küçük mor `Siz` etiketi.
- Internal note aynı akışta görünür: 3px amber sol çizgi + `İç not` etiketi. Internal note oluşturma yoktur.
- Eski e-posta alıntısı varsayılan kapalıdır; nötr `Önceki e-postayı göster` kontrolüyle açılır.
- Açık görüşmede composer altta yapışık kalır. Çözülen görüşmede `Çözüldü` bandı görünür, composer pasiftir.

## Composer Contract

- Composer 1 satırdan başlayıp en çok 5-6 satıra büyür; bundan sonra kendi içinde kayar.
- Üstünde salt-okunur `Yanıt şu kişiye gidecek: Ad Soyad <mail>` satırı vardır. Alıcı değiştirilemez.
- Toolbar her zaman görünür tek satırdır: bold, italic, link, bulleted/numbered list, emoji, block quote.
- HTML desteklenir; tablo ve inline image araçları yoktur. Karmaşık yapıştırma sadeleşebilir.
- Enter yeni satır, Shift+Enter gönderir. Gönderim sonrası editor temizlenir; hata mesaj bloğunda `Tekrar dene` ile görünür.
- Dolu taslakla geri çıkış, `Taslak kaybolacak` onayı ister.

## Status & Feedback Contract

- `Yeni yanıt`: son public mesaj dış taraftan ve temsilci henüz yanıtlamamış; amber/uyarı rozeti.
- Mor sol vurgu yalnız görülmemiş içeriği gösterir. Thread başarıyla açılınca kalkar; rozet kalabilir.
- `Çözüldü`: SOLVED durumudur. Çözülen görüşmede yeni/okunmamış sinyali gösterilmez.
- Dışarıdan yeni yanıt gelmesi görüşmeyi aktifleştirir; thread açılana kadar yeniden mor vurgu + `Yeni yanıt` gösterilir.
- `Çözüldü olarak işaretle` ve `Tekrar aç` başlık menüsündedir. Çözüldü aksiyonu onay ister; her iki aksiyon da e-posta/yorum üretmez.
- Status isteği başarısız olursa ekran değişmez; kısa Türkçe hata ve `Tekrar dene` sunulur.

## Spacing & Typography

| Token | Value | Usage |
|---|---:|---|
| xs | 4px | icon/etiket içi boşluk |
| sm | 8px | meta satırları, toolbar ikonları |
| md | 16px | mesaj bloğu ve composer iç boşluğu |
| lg | 24px | ana alan üst boşluğu |

| Role | Size | Weight | Usage |
|---|---:|---:|---|
| Mesaj gövdesi | 14px | 400 | okunabilir e-posta içeriği |
| Meta/etiket | 12px | 500 | gönderen, zaman, durum |
| Başlık | 14px | 600 | alıcı · konu |

## Color

| Role | Value | Usage |
|---|---|---|
| Surface | `hsl(var(--background))`, `hsl(var(--card))` | thread ve composer |
| Primary | `hsl(var(--primary))` | `Siz`, aktif/focus, mor görülmemiş çizgi |
| Internal note | amber-500/amber-50 uyumlu tonlar | amber sol çizgi ve etiketi |
| Solved | muted/slate tonu | çözüldü bandı |
| Error | `hsl(var(--destructive))` | yalnız hata metni/ikon |

Accent yalnız `Siz`, focus ve görülmemiş çizgi için kullanılır; tüm mesaj yüzeylerini mora boyamak yasaktır.

## Copywriting Contract

| Element | Copy |
|---|---|
| Resolve action | `Çözüldü olarak işaretle` |
| Reopen action | `Tekrar aç` |
| Solved band | `Çözüldü` |
| Resolve confirmation | `Görüşme çözüldü olarak işaretlensin mi? Yeni bir e-posta yanıtı gelirse tekrar aktif olur.` |
| Quote disclosure | `Önceki e-postayı göster` |
| Recipient summary | `Yanıt şu kişiye gidecek:` |
| Failed send | `Gönderilemedi · Tekrar dene` |

## Accessibility & Safety

- Toolbar ve menü düğmeleri erişilebilir ad taşır; klavye odağı görünürdür.
- Renk tek başına anlam taşımaz: internal note/status/failure metin etiketiyle de ayrılır.
- Gelen HTML allowlist ile sanitize edilir; script/style/event handler, inline image ve table render edilmez.
- HTML olmayan fallback mesaj gövdesi güvenli metin olarak gösterilir.

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS — Türkçe, eylem odaklı ve `Kapat` yerine `Çözüldü` kullanıyor.
- [x] Dimension 2 Visuals: PASS — dar panel için e-posta thread'i ve sabit composer net.
- [x] Dimension 3 Color: PASS — mevcut Grispi tokenları ve sınırlı accent kullanımı.
- [x] Dimension 4 Typography: PASS — mesaj/meta hiyerarşisi tanımlı.
- [x] Dimension 5 Spacing: PASS — 4px tabanlı ölçek tanımlı.
- [x] Dimension 6 Registry Safety: PASS — yeni third-party UI registry yok.

**Approval:** approved 2026-07-28
