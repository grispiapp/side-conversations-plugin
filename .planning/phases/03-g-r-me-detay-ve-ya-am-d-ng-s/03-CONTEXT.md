# Phase 3: Görüşme Detayı ve Yaşam Döngüsü - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Temsilci bir side ticket'ı açtığında, dar sağ panelde e-posta karakterini koruyan iki yönlü thread'i görür; HTML destekli hafif rich editor ile tek alıcıya yanıt yazar; görüşmeyi çözüldü olarak işaretler veya tekrar açar; yeni dış yanıtların görülme ve temsilciden aksiyon bekleme durumunu birbirinden ayırır.

Karşılanan gereksinimler: THRD-01, THRD-02, THRD-03, THRD-04. Faz 2'deki minimal chat kabuğu bu fazda gerçek thread'e genişletilir.

</domain>

<decisions>
## Implementation Decisions

### Thread görünümü
- **D-01:** Thread sağ/sol chat balonları yerine kronolojik, alt alta minimal e-posta akışıdır. Mesajlar ince ayırıcı ve boşlukla ayrılır.
- **D-02:** Karşı tarafın ilk mesajında `Ad Soyad <e-posta>` görünür; ardışık mesajlarda sade kimlik bilgisi kullanılır. Giden mesajlarda küçük mor `Siz` etiketi yeterlidir.
- **D-03:** Önceki e-posta alıntıları varsayılan kapalıdır; temsilci `Önceki e-postayı göster` ile açar. Giden e-postada bağlam alıntı olarak korunur.
- **D-04:** Internal notlar yalnız görüntülenir: aynı kronolojik akışta amber çizgi ve `İç not` etiketiyle ayrışır. Bu fazda yeni internal note oluşturma YOK.
- **D-05:** Gelen HTML güvenli temizlenerek gösterilir; paragraf, kalın/italik, liste, bağlantı ve alıntı korunur; karmaşık HTML sadeleşir.
- **D-06:** Thread, varsa ilk görülmemiş dış yanıta; yoksa son mesaja kaydırılır.

### Yanıt editörü
- **D-07:** Editör sayfanın altında sabittir; içerikle yaklaşık 5-6 satıra kadar büyür, sonrası kendi içinde kayar.
- **D-08:** Araç çubuğu her zaman görünür ve kompakt tek satırdadır: kalın, italik, bağlantı, liste, emoji, alıntı. Editör HTML üretir.
- **D-09:** Tablo ve inline görsel YOK; karmaşık biçimle yapıştırılan içerik sadeleşebilir. Dosya ekleme Faz 4 kapsamındadır.
- **D-10:** Enter yeni satır, Shift+Enter gönderir. Gönderilince editör hemen temizlenir; hata olursa mesaj thread'de hata durumunda kalır ve oradan yeniden denenir.
- **D-11:** Editör üstünde her zaman değiştirilemeyen `Yanıt şu kişiye gidecek: Ad Soyad <e-posta>` satırı bulunur. Faz 2'nin tek alıcı kararı korunur.
- **D-12:** Gönderilmemiş taslakla geri dönmek isteyen temsilciye kaybolma uyarısı gösterilir; onaylanırsa taslak silinir.

### Yaşam döngüsü
- **D-13:** Başlıktaki `⋯` menüsünde açık görüşme için `Çözüldü olarak işaretle`, çözülmüş görüşme için `Tekrar aç` aksiyonu bulunur.
- **D-14:** `Çözüldü olarak işaretle`, `SOLVED` durumuna geçirir ve onay ister; kopya, dış yanıtın görüşmeyi yeniden aktif yapacağını söyler. `Kapat` ifadesi kullanılmaz.
- **D-15:** Çözüldü/tekrar aç aksiyonları yalnız status PATCH'i ile yapılır; yorum veya e-posta bildirimi üretmez.
- **D-16:** Çözüldükten sonra aynı thread açık kalır; üstte `Çözüldü` bandı gösterilir, editör pasif olur. `Tekrar aç` editörü otomatik odaklayarak aktifleşir.
- **D-17:** Dış e-posta yanıtı çözülen görüşmeyi otomatik aktifleştirir. Kapatma/açma API çağrısı başarısız olursa mevcut görünüm korunur, kısa hata ve `Tekrar dene` sunulur; optimistic durum değişimi yapılmaz.

### Görülme ve aksiyon-bekleme
- **D-18:** Mor vurgu, cihaz/tarayıcı bazında görülmemiş içerik sinyalidir. Thread başarıyla açıldığında localStorage'daki `sc:lastSeenAt:<side-ticket-key>` yazılır ve mor vurgu kalkar.
- **D-19:** `Yeni yanıt` rozeti görülme durumundan ayrıdır: son public mesaj dış taraftansa, temsilci yanıt gönderene kadar kalır; temsilci yanıtlayınca `Yanıt bekleniyor` olur.
- **D-20:** Çözülen/kapalı görüşme her zaman yalnız `Çözüldü` olarak görünür; mor vurgu veya `Yeni yanıt` rozeti taşımaz. Sonraki dış yanıt onu aktifleştirir ve thread açılana kadar mor vurgu + `Yeni yanıt` gösterir.

### the agent's Discretion
- HTML sanitizasyon kütüphanesi/uygulama şekli, rich editor bileşeni, toolbar ikonları, zaman biçimi, loading/skeleton ve hata metinlerinin küçük görsel ayrıntıları mevcut Grispi teması ve güvenlik kurallarıyla uyumlu seçilir.
- Zendesk'teki tam e-posta alıntılama davranışının Grispi API üzerinden nasıl güvenli uygulanacağı araştırma/planlama aşamasında doğrulanır.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Ürün ve önceki faz kararları
- `.planning/PROJECT.md` — side-ticket modeli, dar panel ve güvenlik kısıtları.
- `.planning/REQUIREMENTS.md` — THRD-01..04 gereksinimleri; rich editor kararı bu context ile Faz 3'e eklenmiştir.
- `.planning/ROADMAP.md` §`Phase 3` — faz hedefi ve başarı kriterleri.
- `.planning/phases/01-temel-ve-salt-okunur-g-r-me-listesi/01-CONTEXT.md` — rozet/sıralama kuralları, localStorage görülme varsayımları.
- `.planning/phases/02-yeni-yan-g-r-me-ba-latma/02-CONTEXT.md` — tek alıcı, optimistic hata/retry ve minimal chat kabuğu kararları.
- `.planning/phases/01-temel-ve-salt-okunur-g-r-me-listesi/01-02-probe-findings.md` — canlı doğrulanmış PATCH/comment davranışları ve status alanı.

### Zendesk ürün referansları
- `https://support.zendesk.com/hc/en-us/articles/4604347676954-Viewing-and-replying-to-side-conversations` — thread ilk okunmamış yanıta açılır, yeni yanıtlar alttadır, email side conversation rich-text composer davranışı.
- `https://support.zendesk.com/hc/en-us/articles/4604333207578-Closing-and-reopening-side-conversations` — done/reopen yalnız side-conversation durumu, kapanışın yeni yanıtı engellememesi.
- `https://support.zendesk.com/hc/en-us/articles/4408844184730-Rich-text-formatting-options-reference` — hafif rich-text araçları ve sınırları.
- `https://support.zendesk.com/hc/en-us/articles/4408831849882-Composing-messages-in-the-Zendesk-Agent-Workspace` — altta kalan ve yeniden boyutlanabilen composer deseni.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/store/active-conversation-store.ts` — `MessageVM` yön/durum modeli, optimistic gönderim ve retry; gerçek thread yükleme/yanıt yaşam döngüsü buraya genişler.
- `src/screens/chat-screen.tsx` ve `src/screens/components/message-bubble.tsx` — Faz 2 minimal chat kabuğu; Faz 3'te e-posta akışına dönüştürülecek seam.
- `src/lib/last-seen-store.ts` — güvenli localStorage okuma; Faz 3 yazma yolu eklenir.
- `src/grispi/client/tickets.ts` — mevcut `getTicket`, `createTicket`; yanıt ve SOLVED PATCH istemcileri buraya eklenir.
- `src/components/ui/screen.tsx`, `button.tsx`, `badge.tsx` — panel ekranı ve tema primitifleri.

### Established Patterns
- Router yok; `PanelNavigationStore` ile tam-panel screen swap kullanılır.
- `SideConversationsStore.resolveBadge()` bugün localStorage görülmesini rozete çeviriyor; Faz 3 mor vurgu ve aksiyon rozetini ayrı view-model alanlarına bölmelidir.
- React text interpolation kullanılır; harici HTML ham render edilmez.

### Integration Points
- Liste satırına tıklama active conversation yükleme yolunu başlatır; başarılı yükleme ardından last-seen zamanı yazılır ve liste yeniden türetilir.
- Yanıt/çözüldü/tekrar-aç sonrası ilgili active conversation ve liste gerçek veriyle tazelenir.
- `SOLVED` status id mevcut rozet yardımcılarında zaten kapalı/çözüldü kategorisindedir.

</code_context>

<specifics>
## Specific Ideas

- UI, Zendesk side conversations'ın e-posta odaklı akışını referans alır; tam chat görünümü değildir.
- Temsilcinin en önemli ihtiyacı, hem okunmamış yeni yanıtı hem de kendisinden yanıt bekleyen açık görüşmeyi ayrı sinyallerle görebilmektir.
- Editör, kullanıcıya konuşma deneyimi verir ama tam belge editörü kapsamına girmez.

</specifics>

<deferred>
## Deferred Ideas

- Yeni internal note oluşturma — sonraki bir fazda değerlendirilecek.
- Dosya ekleme — Faz 4.
- Tablo ve inline görsel içeren gelişmiş rich editor — kapsam dışı.
- Sunucu taraflı, cihazlar arası okundu senkronizasyonu — v2.

</deferred>

---

*Phase: 3-Görüşme Detayı ve Yaşam Döngüsü*
*Context gathered: 2026-07-28*
