---
phase: quick-260902-dhy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/side-conversation.ts
  - src/lib/__tests__/side-conversation.test.ts
  - src/store/compose-store.ts
  - src/store/__tests__/compose-store.test.ts
  - src/screens/compose-screen.tsx
  - src/query/side-conversation-queries.ts
  - src/query/__tests__/side-conversation-queries.test.tsx
autonomous: true
requirements: [CORE-02]
quick: true
closes:
  - "Grispi'ye Multibranding geldi (grispi-api 676e25876, 1.63.0+). Yan talepler markasız açıldığı için giden e-posta tenant default adresinden çıkıyor; ana talebin markasını devralmalı."

must_haves:
  truths:
    - "Ana talep markalıysa `POST /v2/tickets` gövdesindeki `fields` dizisi `{key:\"ts.brand\", value:\"<marka id>\"}` içerir"
    - "Ana talep markasızsa (alan yok / null / boş string) `ts.brand` anahtarı gövdeye HİÇ eklenmez — boş değer gönderilmez"
    - "Ana talep henüz hydrate olmamışken (`switchTicket`'in provisional `{key}` nesnesi, `fieldMap` yok) okuma throw etmez, `null` döner"
    - "Create çağrısı HTTP 422 ile düşerse ve istekte `ts.brand` varsa, aynı istek `ts.brand` ÇIKARILMIŞ hâliyle TEK SEFER tekrar denenir"
    - "Retry yalnızca 422'de yapılır: 4xx/5xx diğer statüler ve `NetworkError` doğrudan yükselir, retry denenmez"
    - "İstekte `ts.brand` yoksa 422 için retry YAPILMAZ (sonsuz/anlamsız ikinci istek olmaz)"
    - "Retry de düşerse İKİNCİ hata yükselir, ilki değil — marka çıkarıldıktan sonra hâlâ engelleyen sebep odur (plan sırasında 'orijinal hatayı yükselt' olarak konuşulmuştu, gerekçeyle değiştirildi)"
    - "Retry, envelope'un `request` nesnesini KALICI OLARAK DEĞİŞTİRMEZ — kopya üzerinde çalışır, elle tekrar denemede orijinal istek yeniden oynatılabilir"
    - "`tsc --noEmit` exit 0 ve tüm testler yeşil kalır"
  artifacts:
    - "src/lib/side-conversation.ts — `TICKET_BRAND_FIELD_KEY` sabiti + `brandIdOfTicket()` okuyucusu"
    - "src/store/compose-store.ts — `submit()` yeni `brandId` parametresi; omit-when-empty ile `fields`'a ekleme"
    - "src/screens/compose-screen.tsx — `brandIdOfTicket(ticket)` değerini `submit`'e geçiren tek çağrı noktası"
    - "src/query/side-conversation-queries.ts — `createTicketWithBrandFallback()` yardımcısı, `executeCreateMutation` içinde kullanılır"
    - "Üç test dosyası — mevcut testler silinmez, yeni sözleşme testleri eklenir"
  key_links:
    - "`useGrispi().ticket.fieldMap[\"ts.brand\"].value` → `brandIdOfTicket` → ComposeScreen → `compose.submit(..., brandId)` → `CreateTicketRequest.fields` → `POST /v2/tickets`"
    - "grispi-api `TicketService.getSenderAddress(supportAddressId, brand)` → markalı talep `brand.getDefaultSupportAddress()`'ten, markasız talep tenant default'undan gönderilir — bu değişikliğin tek gerçek etkisi budur"
    - "grispi-api `FieldParser.parseBrand(..., WRITING)` → disabled marka `BRAND_DISABLED` fırlatır → HTTP 422 → `createTicketWithBrandFallback`'in retry kolu"
  prohibitions:
    - statement: "Reply/patch yollarına (`replyTicket`, `addInternalNote`, `patchTicket`) `ts.brand` EKLENMEZ — marka talep üzerinde kalıcıdır, güncelleme yolu gönderen adresi zaten ondan türetir (grispi-api TicketService:399)"
      status: must-not
    - statement: "`ts.brand` için settings anahtarı OKUNMAZ — D-01/D-02 gereği alan anahtarı hardcode'dur"
      status: must-not
    - statement: "Marka adını/id'sini çözmek için EK İSTEK atılmaz (`/field-values/ts.brand/options` çağrılmaz) — ana talep zaten hydrate, değer oradan okunur"
      status: must-not
    - statement: "UI'da marka gösterimi (rozet, seçici, banner) EKLENMEZ — kapsam dışı"
      status: must-not
    - statement: "422 retry'ı bir DÖNGÜ hâline getirilmez — en fazla tek ek istek"
      status: must-not
---

# Quick 260902-dhy: Yan konuşma açarken ana talebin markasını devral

## Bağlam

Grispi'ye Multibranding geldi (`grispi-api` commit `676e25876`, tag `1.63.0`+, `master`'da). Marka alanı bir custom field değil, **sistem alanı**: `ts.brand` (`SystemFields.Keys.BRAND`, tip `BRAND`, `AGENT_ONLY`). Değeri marka id'sinin string hâli.

Bugün yan konuşma talepleri markasız açılıyor, dolayısıyla giden e-posta tenant default support address'inden çıkıyor. Ana talep markalıysa yan konuşma da o markadan çıkmalı.

### Canlı probe bulguları (preprod / `gsocial-test`, 2026-09-02)

| Kontrol | Sonuç |
|---|---|
| `GET public/v1/tickets/{key}` | `fieldMap["ts.brand"] = {"key":"ts.brand","value":"1"}` — düz serialized id |
| `POST /v2/tickets` + `fields:[{key:"ts.brand",value:"1"}]` | 201; alan persist oldu (create response + ayrı GET ile doğrulandı) |
| Create e-postasının gönderen adresi | `comments[0].attributes.fromAddress = "adres1@gsocial-test.grispi.net"` = **Marka 1'in default support address'i** (tenant default `support@gsocial-test.grispi.dev` DEĞİL) |
| Disabled marka (`ts.brand:"2"`) | **HTTP 422**, `"Brand 'Adres 2' is disabled and cannot be set on a ticket."`; talep yaratılmıyor, e-posta gitmiyor, orphan kayıt yok |
| Hata gövdesi | Sadece `message` — makine-okunur kod alanı YOK, bu yüzden fallback yalnızca HTTP statüsüne bakabilir |

04.2-RESEARCH'te belgelenen "POST `fields` dizisi persist etmiyor" anomalisi bu probe'da tekrar etmedi (`tp.side_conversation_parent` de aynı POST'ta yazıldı).

## Görevler

### Task 1 — `brandIdOfTicket` okuyucusu

**files:** `src/lib/side-conversation.ts`, `src/lib/__tests__/side-conversation.test.ts`

**action:** `SIDE_CONVERSATION_PARENT_FIELD_KEY`'in yanına `TICKET_BRAND_FIELD_KEY = "ts.brand"` sabitini ekle (D-01/D-02 gereği hardcode; alanı Grispi sağlıyor, kod yalnızca değerini okuyor). `parentKeyOfTicket` deseniyle birebir aynı hizada `brandIdOfTicket(ticket: Ticket | null): string | null` ekle: `isHydratedTicket` guard'ından geçmiyorsa `null`; değer string değilse veya trim sonrası boşsa `null`; aksi hâlde trim'lenmiş değer.

**verify:** `npm test -- --watchAll=false src/lib/__tests__/side-conversation.test.ts`

**done:** Hydrate olmamış ticket, `fieldMap`'i olan ama `ts.brand` taşımayan ticket, boş string ve dolu değer için dört durum da testle kapalı.

### Task 2 — Compose payload'una `ts.brand`

**files:** `src/store/compose-store.ts`, `src/screens/compose-screen.tsx`, `src/store/__tests__/compose-store.test.ts`

**action:** `ComposeStore.submit()`'e altıncı parametre olarak `brandId: string | null = null` ekle (varsayılanlı, böylece mevcut çağrı noktaları ve testler derlenmeye devam eder — `attachmentIds`'in kurduğu precedent). `fields` dizisine `ts.brand`'i `attachmentIds`'teki omit-when-empty deseniyle ekle: yalnızca `brandId` doluysa. Store React context okumaz — değeri ÇAĞIRAN geçer; `ComposeScreen.submit` `brandIdOfTicket(ticket)` çağırıp aktarır.

**verify:** `npm test -- --watchAll=false src/store/__tests__/compose-store.test.ts`

**done:** Marka varken `fields` içinde `ts.brand` var, yokken anahtar hiç yok.

### Task 3 — 422 fallback

**files:** `src/query/side-conversation-queries.ts`, `src/query/__tests__/side-conversation-queries.test.tsx`

**action:** `executeCreateMutation`'ın `createTicket` çağrısını `createTicketWithBrandFallback(request)` yardımcısıyla değiştir: ilk deneme düşerse ve hata `HttpError` + `status === 422` + istekte `ts.brand` varsa, `fields`'ı filtrelenmiş bir KOPYA ile tek sefer tekrar dener. Envelope'un `request`'i asla mutate edilmez. Diğer tüm hatalar (ve `ts.brand` içermeyen istekler) doğrudan yükselir; mevcut `mutationFailed(envelope, errorKind(error))` + `throw` akışı korunur.

**verify:** `npm test -- --watchAll=false src/query/__tests__/side-conversation-queries.test.tsx`

**done:** 422'de brand'siz ikinci istek atılıyor ve başarılıysa akış normal devam ediyor; 422 dışı hatada tek istek; brand'siz istekte 422 alınca ikinci istek yok; envelope'un `request.fields`'i değişmemiş.

### Task 4 — Tam doğrulama

**verify:** `CI=true npx tsc --noEmit` ve `npm test -- --watchAll=false`

**done:** tsc exit 0, tüm testler yeşil.
