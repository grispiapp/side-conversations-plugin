# Project Research Summary

**Project:** Yan Görüşmeler — Grispi Side Conversations Plugin
**Domain:** Helpdesk eklentisi / side-channel e-posta işbirliği (Zendesk Side Conversations muadili)
**Researched:** 2026-07-22 (bu oturumda canlı araştırma: Zendesk resmi dokümanları + Collaboration API spec'i, rakip dokümanları, Grispi Public API spec'i + 03.06.2026 değişiklik PDF'i, SDK kaynak kodu)
**Confidence:** HIGH

## Executive Summary

Zendesk Side Conversations, sektörün kanıtlanmış deseni: ticket'ın sağ panelinde iki seviyeli yığın (liste → thread, listeden compose), ticket başına ~50 gizli konuşma, her konuşma kendi e-posta thread'i, iki durumlu yaşam döngüsü (open/done), okunmamışlık rozeti. Talep sahibi bu yazışmaları asla görmez. Intercom aynı deseni auto-reopen ile iyileştirir; Freshdesk mesaja çıpalı thread'ler ve kırmızı-nokta okunmamışlıkla ayrışır; Help Scout forward'ı ayrı bağlantılı konuşma olarak, Front ise misafir erişim linkiyle çözer.

Grispi'de bu deseni **backend eklemeden** kurmanın yolu: her yan görüşme = requester'ı harici alıcı olan ayrı bir Grispi ticket'ı ("side ticket"). `publicVisible: true` yorumlar requester'a otomatik e-posta gider (Davut doğruladı) ve `comment.creator` requester'dan bağımsız set edilebilir. Parent ilişkisi side ticket'taki bir `tu.*` custom field'ında tutulur; liste `POST /tickets/advanced-search` ile çekilir (03.06.2026 PDF'i ile geldi — önceki en büyük engel olan "field'a göre arama yok" kısıtını kaldırdı). Kapalılık side ticket'ın `ts.status`'u üzerinden yürür.

Ana riskler: (1) side ticket'ların temsilcilerin ana görünümlerine sızması — tenant'ta view filtresi + işaret field'ı ile önlenir; (2) advanced-search'ün 10'luk sayfa limiti — sayfalama baştan tasarlanır; (3) requester'ı set etme mekanizmasının tam şekli (`ts.requester` benzeri field'ın değer formatı, kayıtlı olmayan alıcıda `POST /customers` gerekliliği) — Faz 2 planlamasında tek API denemesiyle netleşir.

## Key Findings

### Recommended Stack

Stack starter tarafından sabitlenmiş durumda; yeni bağımlılık ihtiyacı minimal.

**Core technologies:**
- React 18 + TypeScript 4.9 (CRA + craco): starter'ın yapısı — Grispi plugin ekosistemiyle tutarlı, değiştirme maliyeti gereksiz
- Tailwind 3 + shadcn-style bileşenler: mevcut `Screen/Button/Input` primitifleri; eklenecekler küçük (textarea, badge, skeleton)
- MobX: starter'da hazır; ekran-state + görüşme cache'i için yeterli — router eklenmez (diğer Grispi side plugin'leri de eklemiyor)
- Grispi Plugin SDK v0.3.1 (CDN): salt okunur köprü — bundle context + `currentTicketUpdated`; tüm yazmalar REST

### Expected Features

**Must have (table stakes — Zendesk paritesinden):**
- Görüşme listesi: alıcı, konu, son mesaj özeti, zaman, durum, okunmamışlık vurgusu
- Compose: alıcı (autocomplete), prefill konu, gövde; gönderimde gerçek e-posta
- Thread: kronolojik mesajlar (yön ayrımı), altta yanıt kutusu
- Kapat / yeniden aç (iki durumlu yaşam döngüsü)
- Boş durum + gizlilik mesajı ("talep sahibi bu yazışmayı görmez")

**Should have (competitive):**
- "Sıra kimde" rozet semantiği (Yanıt bekleniyor / Yeni yanıt / Kapalı) — Zendesk'ten daha net
- Kapalı görüşmeye yanıt gelince otomatik yeniden açılma (Intercom davranışı; Grispi'nin native ticket reopen'ı sayesinde muhtemelen bedava)
- "Talep özetini ekle" (digest endpoint'i) — Zendesk'in "insert ticket comments" muadili
- Ek dosya (Base64 JSON — 03.06.2026 PDF'i ile kolaylaştı)

**Should have (competitive) — devam:**
- Alıcıyla önceki yan görüşmeler (compose'da alıcı seçilince; `GET /public/v2/tickets?requesterEmail=` preview endpoint'i — yalnızca bu özellikte kullanılır)

**Defer (v2+):**
- CC/BCC ve çoklu alıcı (API kazanınca)
- Şablonlar/makrolar, seçmeli yorum alıntılama, cihazlar arası okunmuşluk senkronu

### Architecture Approach

Backend'siz, tamamen client-side eklenti: SDK bundle'ından bağlam alınır, Grispi Public API'ye REST çağrıları yapılır. Side ticket deseni tüm e-posta trafiğini Grispi'nin mevcut ticket mail kanalına devreder.

**Major components:**
1. API katmanı (`src/grispi/client/`) — mevcut `Tickets` sınıfına ek: `advancedSearch`, `createTicket`, `patchTicket` (yorum/status), `searchCustomers`, `getDigest`
2. SideConversations store (MobX) — liste cache'i, durum türetme (son yorum yazar rolü + localStorage lastSeenAt), polling, ekran-state (list/compose/thread)
3. Ekranlar — `list-screen`, `compose-screen`, `thread-screen` (+ mevcut loading/boş durumlar); starter'ın Screen yığını, router yok
4. Settings adaptörü — field key'lerini (`tu.sc_parent_key` vb.) plugin `settings` objesinden varsayılanlarla okur

### Critical Pitfalls

1. **Side ticket'lar ana görünümlere sızar** — işaret field'ı (+ tercihen ayrı form/tag) ve tenant'ta view filtresi; Faz 1'de field şeması netleşirken ele al
2. **advanced-search `size` ≤ 10** — sayfalamayı liste ekranının ilk sürümünde tasarla, sona bırakma
3. **Requester set mekanizması** — `ts.requester` benzeri field'ın kabul ettiği değer (email vs id) ve kayıtsız alıcıda `POST /customers` ihtiyacı; Faz 2 başında tek denemeyle doğrula, akışı `search → yoksa create → set` kur
4. **Polling disiplinsizliği** — yalnızca panel görünürken 30-60 sn aralık; ticket değişiminde sıfırla; her yazma sonrası anlık tazele
5. **V2 preview endpoint'ine bağımlılık** — `GET /public/v2/tickets` değişebilir; yalnızca "önceki görüşmeler" özelliğinde izole kullan (özellik bayrağıyla kapatılabilir olsun), core listeleme akışına sokma
6. **Türetilmiş durumun yanlış hesaplanması** — "son yorum" kıyasında yalnızca `publicVisible` yorumları say; internal notlar sırayı bozmasın

## Implications for Roadmap

Based on research, suggested phase structure (Vertical MVP — her faz uçtan uca kullanılabilir yetenek):

### Phase 1: Temel + Salt Okunur Liste
**Rationale:** Veri modeli (field key'leri, settings) ve API katmanı her şeyin temeli; liste ekranı bunları uçtan uca doğrular
**Delivers:** Panel, aktif talebe bağlı yan görüşmeleri rozetleriyle listeler (elle oluşturulmuş test side ticket'larıyla doğrulanabilir); boş durum; talep değişiminde yenilenme
**Addresses:** Liste + durum semantiği table stakes
**Avoids:** Pitfall 1-2 (field şeması + sayfalama baştan)

### Phase 2: Yeni Görüşme (Compose)
**Rationale:** İlk yazma akışı; requester mekanizması burada netleşir
**Delivers:** Temsilci alıcı seçip konu/mesaj yazar, gönderir → side ticket oluşur, alıcıya gerçek e-posta gider, görüşme listede belirir
**Addresses:** Compose table stakes (autocomplete, prefill)
**Avoids:** Pitfall 3 (requester set — faz başında API doğrulaması)

### Phase 3: Görüşme Detayı (Thread)
**Rationale:** Döngüyü kapatır: gelen yanıtı görme, yanıtlama, kapatma
**Delivers:** Mesajlar yön ayrımıyla kronolojik; yanıt gönderme; kapat/yeniden aç; okundu işaretleme (localStorage)
**Addresses:** Thread + yaşam döngüsü table stakes

### Phase 4: Cila ve Dayanıklılık
**Rationale:** Uçtan uca akış çalıştıktan sonra deneyim tamamlanır
**Delivers:** Polling, ek dosya (Base64), "talep özetini ekle", alıcıyla önceki görüşmeler (v2 preview endpoint'i), sayfalama ("daha fazla yükle"), hata/yükleme durumları, boş durum mikrocopy'leri, son UI cilası
**Addresses:** Should-have'ler (digest, attachment, önceki görüşmeler) + pitfall 4-6

### Phase Ordering Rationale

- Okuma → oluşturma → yanıtlama → cila sırası, her fazda gösterilebilir değer bırakır ve en belirsiz API davranışlarını (requester set) erkene değil, temelin oturduğu Faz 2'ye koyar
- Field şeması ve settings Faz 1'de kilitlenir; sonraki fazlar üzerine inşa eder
- Attachment/digest gibi bağımsız zenginleştirmeler sona toplanır — core döngüyü geciktirmez

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Requester set mekanizması + kayıtsız alıcı akışı (küçük API doğrulaması; plan-phase research'ü yeterli)

Phases with standard patterns (skip research-phase):
- **Phase 1, 3, 4:** Desenler bu oturumda netleşti (API spec + mockup); ek araştırma beklenmez

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Starter sabitliyor; yeni bağımlılık minimal |
| Features | HIGH | Zendesk resmi dokümanları + rakip karşılaştırması; mockup Davut ile paylaşıldı |
| Architecture | HIGH | API spec + PDF + SDK kaynağı okundu; kritik e-posta davranışını Davut doğruladı |
| Pitfalls | MEDIUM | Requester set mekanizması ve view-sızıntı önlemi canlı tenant'ta henüz denenmedi |

**Overall confidence:** HIGH

### Gaps to Address

- Requester set mekanizması (field key + değer formatı + kayıtsız alıcı): Faz 2 planlamasında tek API denemesiyle kapat
- Custom field key isimleri (örn. `tu.sc_parent_key`) ve tenant'ta tanımlanması: Faz 1 öncesi Grispi admin'de oluşturulmalı; kod settings'ten okur
- Solved side ticket'a gelen yanıtın native reopen davranışı: Faz 3'te doğrula (beklenti: reopen olur)

## Sources

### Primary (HIGH confidence)
- https://support.zendesk.com/hc/en-us/articles/4408844206746 — About side conversations (model, kanallar, limitler)
- https://support.zendesk.com/hc/en-us/articles/4604286879642 · /4604347676954 · /4604333207578 — Creating / Viewing & replying / Closing & reopening
- https://developer.zendesk.com/api-reference/ticketing/side_conversation/side_conversation/ (+ events, OpenAPI spec) — veri modeli
- github.com/grispiapp/api-docs → public-api-v1.yml — Grispi Public API spec
- "Grispi Public API Değişiklikleri 03.06.2026" PDF (Grispi ekibinden) — advanced-search, Base64 attachment, v2 tickets filtresi
- grispi.app/grispi-plugin-sdk/grispi-plugin.js v0.3.1 — SDK köprüsünün gerçek yüzeyi (kaynak okundu)
- Davut'un doğrulaması (22 Tem 2026): publicVisible→mail davranışı; creator ≠ requester

### Secondary (MEDIUM confidence)
- https://www.intercom.com/help/en/articles/8398956-side-conversations — auto-reopen + timeline cross-post davranışı
- https://support.freshdesk.com/support/solutions/articles/50000005675 · /50000005676 — Threads (Forward/Private/Discussion)
- https://docs.helpscout.com/article/33-forwarding-a-conversation · https://help.front.com/en/articles/2098 — alternatif desenler

### Tertiary (LOW confidence)
- support.grispi.com "Grispi Public API Nedir?" makalesi — genel bakış (spec ile doğrulandı)

---
*Research completed: 2026-07-22*
*Ready for roadmap: yes*
