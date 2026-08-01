# Phase 4: Dosya Ekleri ve Inline Görseller - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Temsilci yan görüşmelere dosya ekleyebilir ve alabilir: yeni görüşmede ve yanıtta çoklu sürükle-bırak/ataç ile ek yükler, gönderim öncesi eklerini görüp kaldırabilir, editöre yapıştırdığı görsel mesaj gövdesine inline gömülür, ve karşı tarafın gönderdiği ekleri thread'de görüp açabilir.

Kapsam dışı: talep özeti alıntılama, alıcıyla önceki görüşmeler, sessiz tazeleme (hepsi Faz 5).

</domain>

<decisions>
## Implementation Decisions

### Ek listesi yerleşimi ve alan bütçesi

- **D-01:** Ek chip'leri composer içinde, **araç çubuğunun üstündeki mevcut panel yuvasında** gösterilir (`rich-text-composer.tsx:515` — başlık menüsü ve bağlantı formunun kullandığı konteyner). Editör ve Gönder butonu yerinde kalır.
- **D-02:** Çok dosyada dikey alan korunur: liste **tek satırlık `3 dosya ▾` özetine katlanır**, tıklanınca açılır. D-07'nin (editör altta sabit, sınırlı büyüme) alan bütçesi korunur.
- **D-03:** **Metin her zaman zorunludur** — sadece ek göndermek mümkün değil. Mevcut salt-metin gönderim guard'ları (composer `hasMeaningfulContent`, `ComposeStore.submit`, `ActiveConversationStore.sendReply`) olduğu gibi kalır.
- **D-04:** Ataç ikonu D-08'in tek satırlık kompakt araç çubuğuna katılır (çubuk 372px'te zaten yatay kayıyor).

### Yükleme anı ve gönderim kilidi

- **D-05:** Dosya **seçilir seçilmez hemen** Grispi'ye yüklenir (grispi-ui davranışı). Gönder anında bekleme olmaz. Kabul edilen bedel: taslak terk edilirse sunucuda sahipsiz dosya kalır.
- **D-06:** Yükleme sürerken **Gönder kilitlenir**, biten yüklemeyle açılır; buton pasifken kısa açıklama gösterilir (ör. "Ekler yükleniyor…").
- **D-07:** Yükleme başarısız olursa **chip hata durumunda kalır ve "Tekrar dene" sunar** (Faz 3'ün D-10/D-17 deseniyle tutarlı). grispi-ui'dan bilinçli sapma — orada başarısız dosya sessizce listeden düşüyor.

### Boyut/tip politikası ve reddetme

- **D-08:** Client-side politika **~10MB/dosya, ~25MB toplam, max 10 dosya**. Gerekçe: ek nihayetinde e-postayla gidiyor ve Gmail 25MB'da reddediyor; Grispi 50MB kabul etse bile teslimat sessizce patlar. Toplam boyut kontrolü client'ta yapılır (grispi-ui'da hiç yok). Sunucu her hâlükârda nihai otorite.
- **D-09:** **Dosya tipi kısıtı yok** (grispi-ui gibi) — destek işinde log/zip/har/apk gibi dosyalar meşru.
- **D-10:** D-09'un güvenlik önlemi: **SVG asla kendi panelimizde `<object>`/`<iframe>` ile gömülmez**; dosya chip'i olarak gösterilir ve yeni sekmede (Grispi origin'inde) açılır. `<img>` içindeki SVG script çalıştıramadığı için önizleme yolu güvenlidir.
- **D-11:** Kısmi ret: **geçerli dosyalar eklenir**, reddedilenler adı ve nedeniyle bildirilir (ör. "rapor.zip — 12MB, sınır 10MB"). "Ya hep ya hiç" davranışı yok.
- **D-12:** Hata bildirimi için **shadcn tabanlı toast mekanizması kurulur (sonner)**. Projede şu an toast yok; ev deseni satır içi `role="alert"`. Bu, proje geneli hata deseni hâline gelecek — sürüm plan aşamasında sabitlenecek.

### Inline görsel ile ek ayrımı

- **D-13 (rev. 2026-08-01 — canlı UAT sonrası revize edildi):** Yönlendirme **konuma göre** yapılır:
  | Hareket | Hedef | Sonuç |
  |---|---|---|
  | Yapıştırma (görsel) | editör | **inline** |
  | **Görsel** bırakma | editör yazı alanı | **inline** (bırakılan konuma) |
  | Görsel bırakma | composer'ın geri kalanı | ek |
  | **Görsel olmayan** bırakma | her yer | ek |
  | Ataç butonu | — | her zaman ek |

  **Karışık bırakma** (en az bir görsel-olmayan dosya içeren çoklu bırakma) → **hepsi ek olur**; tek jest tek sonuç verir (372px'te iki farklı sonuç kafa karıştırıcı olurdu).
  Tiptap FileHandler hem `onPaste` hem `onDrop` ile kullanılır; `onDrop`, `posAtCoords` ile bırakma konumunu alır. `rich-text-composer.tsx`'teki `handleDrop` guard'ı koşulludur: bırakılan dosyaların **tamamı** gömülebilir görselse `false` döner (FileHandler devralır), aksi hâlde `true` döner (ek yoluna gider).

  *Revizyon gerekçesi:* İlk sürüm ("her sürükleme ek, yalnızca yapıştırma inline") basitlik için seçilmişti, ama Faz 4 canlı UAT'sinde kullanıcı editöre görsel sürüklediğinde inline gömülmesini bekledi. Gerçek kullanım sinyali kâğıt üstündeki tahmini geçersiz kıldı; ayrıca bu, Gmail'in ve grispi-ui'ın davranışı. Görünmez sınır riski, sürükleme sırasında iki bölgenin ayrı vurgulanmasıyla karşılanır (UI-SPEC §2).
- **D-14:** Inline görsel akışı: dosya **önce yüklenir** (`?inline=true`), dönen **`objectUrl`** ile gövdeye `<img src="…">` gömülür. Base64 data URI kullanılmaz (yalnızca yükleme sürerken geçici placeholder olarak kabul edilebilir).
- **D-15:** Inline görseller **ek chip listesinde görünmez** (grispi-ui deseni) — ayrı kovada tutulur. Aksi halde aynı görsel iki yerde çıkar.
- **D-16:** Gönderimde **çöp toplama**: yalnızca `objectUrl`'i son gövde HTML'inde hâlâ geçen inline görsellerin id'leri `attachmentIds`'e eklenir (kullanıcı görseli sildiyse ek de düşer). grispi-ui'dan devralınan davranış.

### Ek kaldırma ve taslak koruması

- **D-17:** Ek kaldırılınca **yalnızca referans düşer**, dosya sunucuda kalır (`attachmentIds`'e girmez → alıcı asla görmez). Silme endpoint'i varsayılmaz; sahipsiz dosya temizliği sunucu tarafının işi.
- **D-18:** **Ekler taslağı kirli sayar** — metin boş olsa bile ek varken geri dönülürse D-12'nin (Faz 3) "taslak kaybolacak" uyarısı çıkar. `isDirty` hesabına ek listesi katılır. Faz 2'nin D-02 deseniyle tutarlı.

### Gelen ekler (THRD-06)

- **D-19:** Gelen eklerin görsel muamelesi **grispi-ui örnek alınarak** yapılır (MIME'a göre ayrışan görsel önizlemesi / PDF / video / genel dosya chip'i). Kullanıcı notu: "orayı yeni yaptık sayılır ve iyi oldu."
- **D-20:** Eke tıklayınca **yeni sekmede açılır** (`objectUrl` auth header'sız erişilebilir; `window.open` + `noopener`). Panel içi lightbox yok — 372px'te getirisi yok.
- **D-21:** Gelen mesaj **gövdesindeki görseller gösterilmez** — sanitizer'ın gelen politikası sıkı kalır (D-05/Faz 3 korunur, takip pikseli ve uzak içerik sızıntısı riski alınmaz).
- **D-22:** D-21'in zorunlu tamamlayıcısı: **`inline: true` ekler listeden FİLTRELENMEZ**. grispi-ui bunları filtreliyor (çünkü gövdede gösteriyor); biz göstermediğimiz için filtrelersek karşı tarafın ekran görüntüsü tamamen kaybolurdu. Görsel muamele grispi-ui'dan alınır, `inline` filtresi bilinçli olarak alınmaz.

### Claude's Discretion

- **D-02'nin inceltmesi:** 1-2 dosyada chip'leri doğrudan göstermek, 3+ dosyada `N dosya ▾` özetine katlamak — "yüklediğini görebilsin" hedefiyle alan bütçesini uzlaştırır. UI-SPEC'te netleşecek.
- Chip içeriği (ad kısaltma biçimi, boyut formatı, küçük resim boyutu), yükleme ilerleme göstergesinin biçimi (yüzde vs belirsiz spinner) ve toast'un konumu/süresi UI-SPEC'e bırakıldı.
- `AbortController` ile yükleme iptali: grispi-ui'da var (modern yol); dahil edilip edilmeyeceği plan aşamasında maliyete göre kararlaştırılır.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Ek yükleme sözleşmesi (ZORUNLU — ilk okunacak)
- `.planning/research/attachment-upload-contract.md` — grispi-ui referans implementasyonundan birebir çıkarılmış gerçek API sözleşmesi (endpoint, FormData alan adı, cevap şekli, `attachmentIds` bağlama, inline akışı, GC kuralı), doğrulanmış paket sürümleri, iki kritik kod tuzağı ve 6 probe sorusu. **`PROJECT.md`'deki eski "Base64" notu bu belgeyle çürütülmüştür.**
- `.planning/PROJECT.md` §Grispi Public API — düzeltilmiş ek akışı notu ve `public/v1` uyumu uyarısı

### Referans implementasyon (harici repo — okunabilir)
- `~/Code/grispiapp/grispi-ui/src/components/QuillGrispiRichTextEditor/modules/grispiUploader.ts` — inline paste/drop yaşam döngüsü, placeholder, hata yolu
- `~/Code/grispiapp/grispi-ui/src/components/QuillGrispiRichTextEditor/components/UploadController.tsx` — FormData kurulumu, ilerleme, boyut kontrolü, navigasyon guard'ı
- `~/Code/grispiapp/grispi-ui/src/components/Forms/CreateTicketForm.tsx` — `attachmentIds` birleştirme + inline çöp toplama
- `~/Code/grispiapp/grispi-ui/src/components/TicketPage/Conversations/ConversationContent/DefaultContent.tsx` — gelen ek render'ı (D-19'un örnek aldığı yer)
- `~/Code/grispiapp/grispi-ui/src/services/upload/uploadFiles.ts` — `UploadFilesResponse` tipi

### Bu fazı kısıtlayan önceki kararlar
- `.planning/phases/03-g-r-me-detay-ve-ya-am-d-ng-s/03-CONTEXT.md` — D-05 (gelen HTML temizliği), D-07 (editör alan bütçesi), D-08 (kompakt araç çubuğu), **D-09 (inline görsel yasağı — bu faz devralıp günceller)**, D-10 (Shift+Enter gönderir), D-12 (kirli taslak uyarısı)
- `.planning/phases/02-yeni-yan-g-r-me-ba-latma/02-CONTEXT.md` — D-02 vazgeç onayı deseni, tek alıcı kararı
- `.planning/REQUIREMENTS.md` — COMP-05, COMP-08, THRD-05, THRD-06

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/screens/components/rich-text-composer.tsx` — compose ve yanıtın **ortak** composer'ı; ataç butonu + chip listesi buraya eklenince **her iki yüzey birden** kazanır (COMP-05 ve THRD-05 tek yerden karşılanır)
- `:515` panel konteyneri — başlık menüsü/bağlantı formunun kullandığı yuva; ek listesi için hazır slot (D-01)
- `src/components/ui/button.tsx` — `size="toolbar"` (`h-8 w-8`) zaten composer çubuğu için ayarlı; ataç ve chip-kaldır butonları için birebir
- `src/components/ui/badge.tsx` — chip için temel; şu an varyantları semantik (`new-reply`/`awaiting-reply`/`closed`), nötr/dosya varyantı eklenmeli
- `src/screens/components/confirm-dialog.tsx` — odak tuzağı + Esc + odak geri yükleme hazır (D-18 uyarısı bunu kullanır)
- `src/lib/html-to-text.ts`, `src/grispi/client/http-handler.ts` (`NetworkError`/`HttpError` taksonomisi)

### Established Patterns
- **Ortak composer** → tek değişiklik iki yüzeyi kapsar; ayrı compose/reply implementasyonu yapılmamalı
- **Optimistic + generation-guard** (`ActiveConversationStore`, `ComposeStore`) — yükleme durumları da bu desene oturmalı
- **Envelope `deepFreeze`** (`active-conversation-store.ts:19-27`) — `attachmentIds` taşıyan payload da donacak; retry aynı donmuş zarfı tekrar gönderir
- **Hata gösterimi** şu an satır içi `role="alert"`; D-12 ile toast eklenmesi bu deseni **genişletir**, yerini almaz
- **React Query mutasyonları** (`src/query/side-conversation-queries.ts`) — gönderim yolu 03.1'de Query'ye taşındı; ek yükleme bunun dışında (mutasyon öncesi) durur

### Integration Points
- `src/types/grispi.type.ts` — `Attachment` tipi **zaten var ama sadece gelen (inbound) için** ve export edilmemiş; `CreateTicketRequest`/`ReplyTicketPatchRequest`'e `attachmentIds?: number[]` eklenecek
- `src/grispi/client/` — **yeni** upload istemcisi (multipart; `HttpHandler` şu an `Content-Type: application/json`'ı sabit gönderiyor — FormData yolu bunu atlamalı)
- `src/query/side-conversation-queries.ts:411-435` `normalizeComment` — `attachments` alanını **tamamen düşürüyor**; `MessageVM`'e taşınmalı (THRD-06)
- `src/screens/components/thread-message.tsx` — gelen ek render'ının ekleneceği yer
- `src/lib/html-sanitizer.ts` — `img` şu an `FORBID_TAGS` **ve** `FORBID_CONTENTS`'te, `src` izinli değil. Yazdığımız gövde için `img`+`src` açılmalı; **`data:` açmaya gerek yok** (Grispi URL'i `https://`, mevcut `ALLOWED_URI_REGEXP` zaten geçiriyor). `svg` her iki politikada bloklu kalır. Gelen HTML politikası D-21 gereği **değişmez** → iki ayrı politika gerekir.

</code_context>

<specifics>
## Specific Ideas

- Kullanıcının tarifi (birebir): *"paste durumunda biz bunu grispiye upload ederiz. sonra grispi linkiyle oluşan görseli inline şekilde editörde gösteririz. ama sürükle bırak veya butona basıp yüklenenleri ek kısmında gösteririz ve ek olarak (attachments[]) ile göndeririz."* — D-13/D-14/D-15 bunun doğrudan karşılığı.
- Gelen ek gösteriminde referans: *"grispi ui'ı örnek alabilirsin ek gösterme konusunda. orayı yeni yaptık sayılır ve iyi oldu."* (D-19)
- Hedeflenen his: Gmail/Zendesk tarzı — eklenen dosyalar görünür, tek tek kaldırılabilir, sonra mesaj yazılıp gönderilir.
- Toast talebi kullanıcıdan açıkça geldi: *"toast mekanizması da kuralım shadcn üzerinden"* (D-12).

</specifics>

<deferred>
## Deferred Ideas

- **Sahipsiz (orphan) dosya temizliği** — D-17 gereği kaldırılan ek sunucuda kalıyor. Bir temizleme/silme akışı gerekirse Grispi sunucu tarafının işi; plugin fazı değil.
- **Yükleme iptali (`AbortController`)** — grispi-ui'da mevcut; bu fazda dahil edilmezse ayrı iyileştirme olarak alınabilir.
- **Gelen gövde görsellerini "Görselleri göster" düğmesiyle açma (Gmail deseni)** — D-21 şimdilik tümüyle engelliyor; ileride istenirse mesaj bazlı durum yönetimi + ayrı sanitizer politikası gerektirir.
- **Ek önizlemesinde panel içi lightbox** — D-20 yeni sekmeyi seçti; 372px kısıtı gevşerse yeniden değerlendirilebilir.
- **Client-side görsel sıkıştırma (`compressorjs`)** — araştırmada önerildi ama bu fazın kararlarına girmedi; büyük ekran görüntülerinde faydalı olabilir, plan aşamasında maliyet/fayda değerlendirilir.

</deferred>

---

*Phase: 4-Dosya Ekleri ve Inline Görseller*
*Context gathered: 2026-07-31*
