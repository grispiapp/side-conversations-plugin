# Phase 2: Yeni Yan Görüşme Başlatma - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Panelin ilk **yazma** akışı: temsilci listeden "+" ile compose ekranını açar, alıcı seçer (müşteri araması + kayıtlı olmayan serbest e-posta), konu aktif talepten önceden dolu gelir, mesaj yazıp gönderir. Gönderimde bir **side ticket** oluşur (`tu.side_conversation_parent` = aktif talep anahtarı, `ts.requester` = alıcı, mesaj **public** yorum olarak → alıcıya gerçek e-posta gider) ve temsilci **minimal bir görüşme (chat) görünümüne** düşer; gönderdiği mesaj optimistic bir balon olarak görünür.

**Bu fazda YENİ olan kapsam kaydırması:** Faz 2, gönderim sonrası inilecek **minimal tek-mesajlık görüşme kabuğunu** da kurar (başlık: alıcı/konu + gönderilen mesaj balonu + optimistic durum). Faz 3 bunu tam iki-yönlü thread'e genişletir (gelen yanıtları görme, yön ayrımı, yanıtlama, kapatma/yeniden açma, okundu). Bkz. `<deferred>` — Faz 3 sınır notu.

Karşılanan gereksinimler: COMP-01, COMP-02, COMP-03, COMP-04, SYNC-02.

</domain>

<decisions>
## Implementation Decisions

### Compose ekranı sunumu ve navigasyon
- **D-01:** Compose, ~372px panelde **tam-panel screen swap** olarak açılır (listenin yerini alır); `ScreenHeader`'daki geri oku ile listeye dönülür. Modal/sheet/satır-içi form DEĞİL — mevcut `Screen`/`ScreenHeader` primitifleriyle birebir. Giriş noktaları: liste header'ındaki "+" ve boş-durum CTA'sı (Faz 1'de görünür+devre dışı, "Çok yakında"; Faz 2'de **enable** edilir — D-13/Faz 1, layout zıplaması yok).
- **D-02:** Dolu formda geri/iptal → **onaylı vazgeç** ("Vazgeçilsin mi? Yazılanlar kaybolur"). Boş formda onaysız direkt döner.
- **D-03:** Compose açıkken temsilci **aktif talebi (parent) değiştirirse**: taslakta içerik varsa **uyar + onayla kapat** ("Yeni görüşme taslağın var; talebi değiştirirsen kaybolur"); onaylanırsa compose kapanır, yeni talebin listesi gelir. Boş taslakta sessizce kapanır.

### Alıcı (recipient) seçimi
- **D-04:** Müşteri araması (`/customers/search`) autocomplete **3+ karakterde, ~300ms debounce** ile tetiklenir.
- **D-05:** Kayıtlı olmayan serbest e-posta: geçerli bir e-posta yazılınca arama sonuçlarının **en altında "✉ <e-posta> adresini kullan" satırı** belirir; tıklanınca alıcı olur. Ayrı serbest-e-posta alanı/modu YOK — tek akış.
- **D-06:** Sonuç satırında **isim + e-posta** gösterilir (isim yoksa sadece e-posta). Geçersiz formatlı serbest e-postada "kullan" satırı **çıkmaz** + inline uyarı; Gönder devre dışı kalır.
- **D-07:** **Tek alıcı** (CC/BCC yok — public API `CommentRequest` desteklemiyor; PROJECT kısıtı). Alıcı `ts.requester` alanına canlı-doğrulanmış `:e-posta` formatıyla yazılır (bkz. canonical_refs → probe-findings).

### Konu (subject) prefill
- **D-08:** Ön-dolu konu biçimi: **`[<TALEP_ANAHTARI>] <Talep Başlığı>`** (ör. `[DESTEK-1042] Kargo sorunu`). Düzenlenebilir. Not: bu alan hem side ticket'ın `ts.subject`'i hem de alıcıya giden e-postanın konusu olur; anahtar dış tarafa gider ama temsilci düzenleyebilir.
- **D-09:** Konu **compose açılışında bir kez** aktif talepten doldurulur; sonra serbest bırakılır — otomatik üzerine yazılmaz.

### Gönderim mekaniği, e-posta ve durum
- **D-10:** Zorunlu alanlar: **alıcı + mesaj**. Konu prefill'le dolu gelir; temsilci boşaltırsa inline uyarı verir ama gönderimi **engellemez**.
- **D-11:** E-posta gövdesi = **temsilcinin yazdığı düz metin AYNEN**. Plugin otomatik selamlama/imza EKLEMEZ (temsilci isterse kendi yazar). Zengin metin editörü yok (v1 düz metin).
- **D-12:** Mesaj alanı çok satırlı textarea. Klavye: **Enter = yeni satır**, **Shift+Enter = gönder**; ayrıca açık bir **"Gönder" butonu** da var. (Kaza gönderimi önlenir; kasıtlı iki-tuş kısayolu.)
- **D-13:** Mesaj alıcıya **public yorum** olarak gider (`publicVisible: true` → alıcıya e-posta; canlı doğrulandı). Yorumun creator'ı temsilcidir. E-postanın **GÖNDEREN (from) kimliği Grispi tenant tarafından yönetilir**, plugin belirlemez — araştırmacı canlı doğrular.
- **D-14 (gönderim sonrası — Alan 1 kararının revizyonu):** Gönderim başarılı olunca temsilci **minimal görüşme (chat) görünümüne** düşer: başlık (alıcı · konu) + gönderdiği mesaj **balonu**. Balon, gönderim sürerken sağ altında **optimistic loading** gösterir; POST onaylanınca çözülür (gönderildi durumu). "Listeye dön + vurgulu satır" YERİNE bu geçer.
- **D-15 (gönderim hatası — Alan 4 kararının revizyonu):** POST başarısız olursa **balonda "⚠ Gönderilemedi · Tekrar dene"** gösterilir; mesaj metni balonda korunur, "Tekrar dene" aynı POST'u yeniden atar. (Chat modeline düşüldüğü için "compose formunda kal + inline hata" YERİNE bu geçer.) Ağ vs sunucu hatası ayrımı Faz 1 `ErrorCard`/hata diliyle tutarlı olmalı.
- **D-16 (SYNC-02):** Gönderim sonrası tazeleme iki katmanlı: (a) chat balonu optimistic → POST cevabıyla çözülür; (b) temsilci listeye döndüğünde yeni görüşme **gerçek veriyle** (rozet/zaman doğru) görünür — **gerçek refetch** (`store.load(aktifTalep)`), optimistic sahte-satır değil. Generation guard (D-15/Faz 1) zaten var.
- **D-17:** Çift gönderim önleme: gönderim sürerken Gönder butonu + Shift+Enter kısayolu kilitlenir (balon zaten optimistic gösterildiği için form re-submit edilemez).

### Claude's Discretion
- Compose form alanlarının birebir yerleşimi, chat balonunun görsel dili (renk, hizalama, optimistic spinner/onay ikonu), "kullan" satırının stili — Faz 1 mockup dilini ve mor tema/`cva` konvansiyonunu koruyarak planner/executor karar verir.
- Müşteri arama sonuç limiti/sayfalama, debounce'un tam ms değeri, arama isteği iptali (stale race) — planner belirler.
- `/customers/search` cevabında isim alanının yokluğunda fallback gösterim — planner.
- Minimal görüşme kabuğunun bileşen adı/dosya yapısı ve Faz 3'e devredilecek genişleme noktaları — planner (Faz 3 thread'i buraya bağlanacak şekilde tasarlanmalı).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Canlı-doğrulanmış API şekilleri (Faz 1 probe — KRİTİK)
- `.planning/phases/01-temel-ve-salt-okunur-g-r-me-listesi/01-02-probe-findings.md` — `POST /public/v1/tickets` gövdesi (`{comment:{body, publicVisible, creator:[{key:"us.email",value}]}, fields:[{key,value}]}`), `ts.requester` serileştirme formatı **`:e-posta`** (colon-prefix; düz e-posta/JSON/identifier-array REDDEDİLİR), `publicVisible: true` = public yorum → alıcıya e-posta (spec açıklaması TERS), `PATCH /tickets/{key}` comment'siz fields kabul eder, `/customers/search?searchTerm=&orderBy=fullName&size=100&page=0`, `GET /users/{id}` → primaryEmail. **Faz 2 create + alıcı arama akışının canlı temeli.**
- `.planning/phases/01-temel-ve-salt-okunur-g-r-me-listesi/01-CONTEXT.md` — Faz 1 kilitli kararlar (D-01..D-18); özellikle D-13 (compose CTA present-disabled), D-16/17/18 (test düzeni: Davut'un tenant'ı, standalone dev modu + gerçek token).

### Faz 1'de kurulan yeniden-kullanılacak kod
- `src/grispi/client/tickets.ts` — `advancedSearch`, `getTicket`; Faz 2 buraya `createTicket` (POST) ekler.
- `src/grispi/client/users.ts` — `getUser`; müşteri arama için `/customers/search` istemcisi eklenecek.
- `src/contexts/grispi-context.tsx` + `src/contexts/plugin-bootstrap.ts` — aktif talep (parent) kaynağı, `switchTicket` dirençli yolu (compose'da parent değişimi/D-03 buna bağlanır).
- `src/store/side-conversations-store.ts` — liste + `load()` refetch (SYNC-02/D-16 buraya bağlanır).
- `src/screens/components/empty-state.tsx` — "Çok yakında" devre dışı CTA (D-01'de enable edilecek).

### Roadmap / gereksinim
- `.planning/ROADMAP.md` §"Phase 2" — Goal + 5 Success Criteria (COMP-01..04, SYNC-02).
- `.planning/REQUIREMENTS.md` — COMP-01/02/03/04, SYNC-02 satırları.
- `.planning/PROJECT.md` — Core Value + kısıtlar (tek alıcı, düz metin, ~372px, Türkçe UI).

Not: Grispi public OpenAPI (`github.com/grispiapp/api-docs` `master`/`public-api-v1.yml`) `advanced-search`/`users` gibi bazı endpoint'leri BELGELEMİYOR — canlı probe-findings otoritedir.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/` — `button`, `input`, `screen` (Screen/ScreenHeader/ScreenContent), `badge`, `skeleton`. Compose formu + chat kabuğu bunları kullanır; muhtemelen `textarea` primitive'i eklenir.
- `src/grispi/client/` — `HttpHandler` (typed `NetworkError`/`HttpError`, throwing `send<T>`), `GrispiAPI` fasadı, `Tickets`, `Users`, `Authentication`. Yeni `createTicket` + müşteri arama aynı kalıba oturur.
- MobX store deseni (`side-conversations-store.ts`) — compose/gönderim durumu + minimal chat state için aynı desen (generation guard dahil).

### Established Patterns
- Tam-panel ekran geçişleri `Screen`/`ScreenHeader` ile; Faz 1 zaten status-machine ekranı kullanıyor (`conversations-list-screen.tsx`). Compose ve minimal-chat aynı screen-swap yaklaşımıyla eklenir.
- Türkçe hata dili + ağ/sunucu ayrımı Faz 1 `error-card.tsx`'te var — D-15 balon hatası bu dille tutarlı olmalı.
- Standalone dev modu (`standalone-dev.ts` + `plugin-bootstrap.ts`) canlı token'la yazma akışını localhost'ta test etmeyi sağlar (D-16/17/18).

### Integration Points
- Aktif talep (parent) anahtarı `grispi-context`'ten gelir → compose'da `tu.side_conversation_parent` değerine yazılır.
- Gönderim başarısı → `side-conversations-store.load(parentKey)` refetch (SYNC-02).
- Minimal chat kabuğu, Faz 3 thread'inin bağlanacağı genişleme noktası olarak tasarlanır.

</code_context>

<specifics>
## Specific Ideas

- Gönderim deneyimi bilinçli olarak **mesajlaşma-uygulaması hissi**: gönderilen mesaj chat'e optimistic düşer, balonun sağ altında küçük bir loading döner (WhatsApp/iMessage "gönderiliyor" paterni), onaylanınca çözülür, hata olursa balonda "gönderilemedi · tekrar dene".
- Klavye kısayolu bilinçli olarak ters: **Enter = yeni satır, Shift+Enter = gönder** (dar panelde kaza gönderimini önlemek için).
- Konu, iç talep anahtarını dış alıcıya taşır ama düzenlenebilir olduğu için temsilci kontrolünde.

</specifics>

<deferred>
## Deferred Ideas

- **Tam iki-yönlü görüşme thread'i** (gelen yanıtları görme, gönderen/alıcı yön ayrımı, yanıtlama, kapatma/yeniden açma, okundu işaretleme) → **Faz 3**. Faz 2'nin minimal chat kabuğu bunun bağlanacağı temeli kurar.
- **Dosya ekleme, talep özeti alıntılama, alıcıyla önceki yan görüşmelerin gösterimi** → **Faz 4** (Zenginleştirmeler).
- **Zengin metin editörü / HTML gövde** → v1 dışı (düz metin yeterli, PROJECT out-of-scope).
- **Çoklu alıcı / CC-BCC** → kalıcı kapsam dışı (public API desteklemiyor).
- **E-posta GÖNDEREN (from) kimliğini plugin'den özelleştirme** → kapsam dışı; Grispi tenant yönetir.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 2-yeni-yan-g-r-me-ba-latma*
*Context gathered: 2026-07-23*
