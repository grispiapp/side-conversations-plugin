# Yan Konuşmalar — Grispi Side Conversations Plugin

## What This Is

Grispi talep (ticket) sayfasının sağ panelinde (~372px iframe) çalışan bir plugin. Temsilci, talep sahibini hiç dahil etmeden üçüncü taraflarla (tedarikçi, kargo firması, başka ekip) talep bağlamında ayrı e-posta yazışmaları başlatır, yürütür ve takip eder — Zendesk'teki "Side Conversations" özelliğinin Grispi'ye uyarlanmış hâli.

## Core Value

Temsilci, talebi çözmek için gereken harici yazışmaları talepten hiç ayrılmadan yürütebilmeli; talep sahibi bu yazışmaları asla görmemeli.

## Requirements

### Validated

<!-- Starter'dan hazır gelen, çalışır durumda doğrulanmış yetenekler. -->

- ✓ Plugin bootstrap: SDK bridge `_init()` → bundle (tenantId, token, ticketKey, agent, requester); aktif talep değişiminin izlenmesi (`currentTicketUpdated`) — starter
- ✓ Grispi REST istemci iskeleti: auth header yönetimi, `HttpHandler`, `getTicket` — starter
- ✓ Panel UI temeli: `Screen/ScreenHeader/ScreenContent` primitifleri, Grispi teması (mor primary `hsl(272 53% 37%)`, shadcn yoğunluğu), loading ekranı — starter
- ✓ **Faz 1 (Temel ve Salt Okunur Görüşme Listesi):** Aktif talebe bağlı yan görüşmeler rozetleriyle (Yeni yanıt / Yanıt bekleniyor / Kapalı), doğru gruplama/sıralama, boş durum, katmanlı Türkçe hata + "Yeniden dene", "Daha fazla yükle" sayfalama, talep değişiminde stale-flash'sız yenileme; canlı `gsocial-test` tenant UAT (7/7) onaylı — Faz 1 (tamamlandı 2026-07-23)

### Active

<!-- Detaylı, ID'li liste .planning/REQUIREMENTS.md'de. -->

- [x] Talebe bağlı yan görüşmeleri durum rozetleriyle listeleme (boş durum ve sayfalama dahil) — ✓ Faz 1
- [ ] Yeni yan görüşme başlatma: alıcı autocomplete, prefill konu, mesaj, ek dosya, talep özeti ekleme
- [ ] Görüşme detayı: mesajları yön ayrımıyla görüntüleme, yanıtlama, kapatma/yeniden açma, okundu takibi
- [ ] Alıcı seçilince o alıcıyla önceki yan görüşmelerin gösterimi
- [ ] Sabit ilişki field'ı (kurulumda otomatik oluşur) ve anlaşılır hata durumları

### Out of Scope

- CC/BCC ve çoklu alıcı — public API `CommentRequest` desteklemiyor; v1 tek alıcı
- Slack/Teams/child-ticket kanalları — kapsam yalnızca e-posta; Grispi'de karşılığı yok
- Ana talebin durumunu otomatik değiştirme (yan görüşmeye yanıt gelince reopen vb.) — client-side güvenilir değil; Grispi tarafında otomasyon gerektirir
- Zengin metin editörü — v1 düz metin; e-posta gövdesi için yeterli
- Gerçek zamanlı bildirim — webhook yok; panel açıkken polling yeterli

## Context

**Codebase:** `grispiapp/right-panel-react-starter-app` kopyası. CRA + craco, React 18, TypeScript 4.9, Tailwind 3, shadcn-style bileşenler, MobX (minimal kullanım). Router yok — ekranlar state ile değişir (diğer Grispi side plugin'leriyle aynı desen). SDK CDN'den yüklenir: `grispi.app/grispi-plugin-sdk/grispi-plugin.js` (v0.3.1) — **salt okunur köprü**; Grispi UI'a yazma komutu yok, tüm yazmalar REST üzerinden.

**Grispi Public API** (`api.grispi.net`, `public/v1`):
- `POST /tickets` — TicketRequest `{comment{body, publicVisible, creator[us.*]}, fields[{key,value}]}`
- **Ek (attachment) akışı — upload-first, Base64 DEĞİL** *(düz. 2026-07-31; kaynak: `grispi-ui` referans implementasyonu)*: `POST /attachments/upload` (multipart `FormData`, alan adı `files`; inline gövde görselleri için `?inline=true`) → `[{id, filename, mimeType, size, objectKey, objectUrl, objectThumbUrl, bucket}]`. Dönen `id`'ler mesaja `comment.attachmentIds: number[]` ile bağlanır (boşsa alan hiç gönderilmez). Inline görsel: gövdeye `<img src="{objectUrl}">` + id'si `attachmentIds`'e, ancak yalnızca `objectUrl` son gövdede hâlâ duruyorsa. `objectUrl` auth header'sız erişilebilir. **Not:** grispi-ui `/v2/tickets` kullanıyor; `public/v1`'in `attachmentIds`'i kabul edip etmediği ve upload yolunun prefix'i Faz 4'te canlı probe ile doğrulanacak. Önceki "Base64 `comment.attachments[{name, file}]`" notu hatalıydı.
- `PATCH /tickets/{key}` — mevcut ticket'a yorum + field güncelleme
- `POST /tickets/advanced-search` — field koşullarıyla ticket arama (`allConditions`/`anyConditions`, max 5'er; `size` ≤ 10, sayfalı). Custom field prefix'i `tu.*`, sistem alanları `ts.*` (ts.status ID'leri: NEW 1, OPEN 2, PENDING 3, SOLVED 4, CLOSED 5, ON_HOLD 6; channel: 2 EMAIL, 3 INTEGRATION)
- `GET /customers/search?searchTerm=` — alıcı autocomplete
- `GET /digests/tickets/{key}/comments` — public yorum özeti ("talep özetini ekle")
- `GET /fields?type=TICKET`, `GET /tickets/{key}`
- `GET /public/v2/tickets?requesterEmail=…` — **V2 preview, değişebilir**; yalnızca "alıcıyla önceki görüşmeler" özelliğinde kullanılır, core listeleme akışı advanced-search'te kalır (Grispi değişiklikleri önceden bildirir)

**Doğrulanmış davranış (Davut, 22 Tem 2026):** `publicVisible: true` olan her yorum requester'a e-posta olarak gider; `comment.creator` ≠ `ticket.requester` ayrıştırılabilir.

**UI tasarımı onaylı:** 4 ekran (Liste / Boş durum / Yeni görüşme / Görüşme) — mockup: https://claude.ai/code/artifact/cb7e4939-3602-4f44-a029-bda1ac772ae1

**Domain araştırması:** `.planning/research/SUMMARY.md` (Zendesk side conversations modeli, rakip yaklaşımları, Grispi API imkan/kısıtları).

## Constraints

- **Tech stack**: Starter'ın yapısı korunur (CRA+craco, React 18, TS 4.9, Tailwind 3, shadcn, MobX, React Query) — mevcut Grispi plugin ekosistemiyle tutarlılık
- **Platform**: Grispi sağ paneli iframe'i, her zaman açık tema, UI dili Türkçe. **Panel genişliği sabit değildir** — kullanıcı sürükleyerek boyutlandırabiliyor; 1366px viewport'ta ~295px, panel yüksekliği ~405px ölçüldü. Layout ~280px genişlik ve ~590px viewport yüksekliğinden yukarı akışkan olmalı. *(düz. 2026-08-17 — canlı ölçüm; önceki "sabit 372px" varsayımı yanlıştı, Faz 1–04.1 dokümanları bu eski sayıyı taşır)*
- **API**: advanced-search `size` ≤ 10 → sayfalama şart; CC/BCC yok → tek alıcı; webhook yok → polling; SDK köprüsü salt okunur → tüm yazmalar REST
- **Dependencies**: İlişki field'ı prod'da plugin kurulumuyla otomatik oluşur; geliştirme tenant'ında elle oluşturulur. Plugin manifest kaydı Grispi ekibi onayı gerektirir
- **Security**: Token bundle'dan gelir, saklanmaz. Ortam ayarı `_grispi_env` settings'ten okunur (tek settings anahtarı). İlişki field key'i (`tu.side_conversation_parent`) ise D-01/D-02 gereği HARDCODE'dur ve settings'ten ASLA okunmaz — alan Grispi tarafından sağlanır, kod yalnızca değerini okur/yazar

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Yan görüşme = ayrı Grispi ticket'ı ("side ticket"); requester = harici alıcı | E-posta gidiş/dönüşü Grispi'nin native ticket mail kanalıyla akar; ek backend gerekmez | — Pending |
| İlk yorum: creator = temsilci, publicVisible = true | Alıcıya mail otomatik gider; Davut davranışı doğruladı | ✓ Good |
| İlişki: side ticket'ta `tu.*` parent-key field'ı; listeleme advanced-search ile | Parent'ta registry field gereksizleşti; tek doğruluk kaynağı, race yok | — Pending |
| Field key sabit: `tu.side_conversation_parent`; field plugin kurulumunda otomatik oluşturulur | Davut kararı (Faz 1 tartışması, 22 Tem): provisioning Grispi kurulum tarafında; settings'e gerek yok | — Pending |
| Kapalı durumu = side ticket `ts.status` (SOLVED/CLOSED) | Ayrı state field'ı gerektirmez; Grispi'nin native reopen davranışından yararlanır | — Pending |
| Durum rozetleri "sıra kimde" semantiği: Yanıt bekleniyor / Yeni yanıt / Kapalı | Temsilcinin gerçek sorusu "beklediğim cevap geldi mi?"; son yorumun yazar rolünden türetilir | — Pending |
| Okunmamışlık localStorage'da (`ticketKey → lastSeenAt`) | Server-side görülme takibi yok; cihaz bazlı kısıt kabul edildi | — Pending |
| UI: chat balonu değil sol-raylı yazışma blokları + kesikli "posta hattı" | E-posta gecikmeli/resmi kanal; mockup ile onaylandı | — Pending |
| "Alıcıyla önceki görüşmeler" v1'de, v2 preview endpoint'iyle | Davut'un isteği; ekip Grispi ile doğrudan iletişimde, API değişiklikleri önceden bildiriliyor | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-23 — Phase 1 complete (read-only side-conversation list, UAT-approved, verified)*
