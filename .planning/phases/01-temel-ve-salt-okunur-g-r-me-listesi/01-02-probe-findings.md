# Canlı API Probe Bulguları — Plan 01-02 / Task 1 Checkpoint Kanıtı

**Tarih:** 2026-07-23 · **Tenant:** gsocial-test (api.grispi.net) · **Kaynak:** Orchestrator canlı curl probe'ları (manuel token, `.token`)

## 1) advanced-search zarfı — DOĞRULANDI (varsayım büyük ölçüde doğru)

`POST /public/v1/tickets/advanced-search?size=10&page=0` → HTTP 200:

```json
{
  "content": [ ... ],
  "pageable": { "number": 0, "sort": {}, "size": 10, "mode": "..." },
  "totalSize": 549,
  "totalPages": 55,
  "empty": false,
  "size": 10,
  "offset": 0,
  "pageNumber": 0,
  "numberOfElements": 10
}
```

- Dizi alanı: **`content`** ✓ · Toplam sayfa: **`totalPages`** ✓ · `page` **0-indexli** ✓ (`pageNumber:0` döner)
- **DÜZELTME/NETLEŞME:** `content` kayıtları **lean özet**tir, tam `Ticket` DEĞİLDİR:

```json
{"key":"TICKET-562","subject":"[Vivollo] Merhaba...","status":{"id":4,"name":"Solved"},"channel":"TECMONY_CHAT","createdAt":1784211750238,"updatedAt":1784211910402}
```

- **BONUS:** Özet içinde `status: {id, name}` **inline geliyor** — rozet için status'a hydration gerekmeden erişilebilir. `updatedAt`/`createdAt` epoch-millis (number).
- Alıcı/açıklama özet içinde YOK → iki katmanlı fetch (getTicket hydration) D-09 gereği zorunlu.
- Boş koşul listesi **422** döner: "Conditions cannot be empty" — en az bir koşul şart.
- `EQUAL` operatörü geçerli. Tam `FieldOperator` enum'u (validation hatasından):
  `NEXT_WEEK, NO, BETWEEN_TIME, BEFORE_TOMORROW, CHANGED_TO, YES, NOT_EQUAL, NEXT_YEAR, INCLUDES, INCLUDES_ALL, NOT_PRESENT, NOT_CHANGED_TO, CHANGED, NOT_INCLUDES, INCLUDES_ANY, NOT_INCLUDES_ALL, PRESENT, LESS_THAN_EQUAL, IS_NOT, NEWER_THAN_DURATION, TODAY, YESTERDAY, GREATER_THAN, OLDER_THAN_DURATION, BETWEEN, IS, EMPTY, CHANGED_FROM, NOW, ANY_OF_USER_ID, GREATER_THAN_EQUAL, AFTER, SINCE_YESTERDAY, THIS_MONTH, NOT_CHANGED_FROM, TOMORROW, LESS_THAN, NOT_CHANGED, NEXT_MONTH, PREVIOUS_MONTH, GREATER_THAN_DATE, PREVIOUS_WEEK, BEFORE, PREVIOUS_YEAR, EQUAL, LESS_THAN_DATE`

## 2) Requester ("alıcı") konumu — DOĞRULANDI (önemli nüans)

`GET /public/v1/tickets/TICKET-562` → üst düzey anahtarlar: `{key, channel, comments, fieldMap, relation}`

- `fieldMap["ts.requester"]` = `{"key":"ts.requester","value":"92"}` → **value = kullanıcı ID (string)**, e-posta/isim DEĞİL.
- **TÜM fieldMap girdileri yalnızca `{key, value}` taşır — `serializedValue` HİÇBİR alanda yok.** Değerler string ya da null.
- Alıcının e-posta/ismini göstermek için: ticket'ın `comments[].creator` nesneleri (id, email, fullName içerir) ile `fieldMap["ts.requester"].value` eşlenebilir (`creator.id === Number(value)`); yan taleplerde harici taraf yorum yazmış olacağı için pratikte ücretsiz çözüm. (Public spec'te `GET /users/{id}` yok; `/customers/search` var.)

## 3) Status yolu + ID'ler — DOĞRULANDI

- Tam ticket: `fieldMap["ts.status"].value` = `"4"` (**string!** sayıya çevirerek karşılaştır).
- Özet (advanced-search content): `status.id` = `4` (**number**), `status.name` = `"Solved"`.
- **SOLVED = 4 ✓** (canlı: `{"id":4,"name":"Solved"}`) · **CLOSED = 5 ✓** (canlı: `ts.status EQUAL "5"` araması 478 sonuç, hepsi `{"id":5,"name":"Closed"}`).

## 4) Agent-vs-harici yazar sinyali — DOĞRULANDI (kritik düzeltme)

Tam ticket `comments[].creator.role` bir NESNE: `{authority, impliedAuthorities, teamUser}`. Canlı örnekler:

| Yazar | authority | teamUser |
|---|---|---|
| İnsan agent (davutkmbr@gmail.com) | ROLE_ADMIN | **true** |
| Son kullanıcı (anon+...@...vivollo.com) | ROLE_END_USER | **false** |
| AI Assistant (ai_assistant@integration.grispi.com) | ROLE_INTEGRATION | **false** (!) |

- `teamUser === true` insan ekip üyesini güvenilir işaretler; ANCAK entegrasyon/AI kullanıcıları `teamUser:false` döner (impliedAuthorities'te ROLE_AGENT olsa bile).
- **ÖNERİ:** "Harici taraf yazdı" kararını `creator.role.authority === "ROLE_END_USER"` ile ver (teamUser'a tek başına güvenme). Tenant-tarafı = `teamUser === true || authority === "ROLE_INTEGRATION"`.
- `publicVisible` alanı yorumlarda mevcut ✓ (true/false canlı görüldü).
- NOT: `GET /digests/tickets/{key}/comments` yalnızca public yorumları döner ve creator şekli FARKLI/lean: `{id, role: "ROLE_..." (string!), email, isAiAssistant}`. Digest kullanılacaksa role string'dir, nesne değil.

## ENGEL — custom field tenant'ta tanımlı değil

- `tu.side_conversation_parent` araması **404**: `FieldDefinition with key 'tu.side_conversation_parent' is not found!`
- `GET /public/v1/fields?type=TICKET` → 26 field listelendi; benzer bir field yok.
- Public API'de field oluşturma endpoint'i YOK → **Grispi admin UI'dan tanımlanmalı** (tip: TEXT, key tam olarak `tu.side_conversation_parent`). CLAUDE.md'de belgelenen dış bağımlılık.
- Test verisi (bir parent'a bağlı ~11 yan talep, rozet çeşitliliğiyle) da henüz yok; field tanımlandıktan sonra `POST /tickets` + `PATCH /tickets/{key}` ile API üzerinden oluşturulabilir.

## EK BULGULAR — test verisi oluşturma sırasında (2026-07-23, canlı doğrulandı)

1. **Field tanımlandı ve doğrulandı:** `tu.side_conversation_parent` (TEXT, `AGENT_ONLY` permission — son kullanıcı göremez, gizlilik hedefiyle uyumlu). EQUAL/PRESENT aramaları 200 dönüyor.
2. **`GET /public/v1/users/{id}` ÇALIŞIYOR** (public spec'te yok, `GET /tickets/{key}` gibi dokümante edilmemiş): `{id, firstName, lastName, primaryEmail, emails, phones, role:{authority,impliedAuthorities,teamUser}, language, ...}` döner. **Alıcı (requester) e-postası çözümü için güvenilir yol budur** — requester id → `/users/{id}` → `primaryEmail`. (Yorum-yazarı id eşleme yalnız harici yorum varsa çalışır; agent-only satırlarda tek yol budur.)
3. **`ts.requester` serileştirme formatı: `id:email[:phone]`** (`ts.assignee`'deki `"1:15"` = grup:kullanıcı ile aynı aile). Yeni/var olan kullanıcıyı e-postayla bağlamak için değer **`:alici@ornek.com`** (başında iki nokta). Düz e-posta, JSON string, identifier-array HEPSİ reddedilir ya da bozuk kullanıcı yaratır. **Phase 2 create akışı için kritik.**
4. **`PATCH /tickets/{key}` comment'siz (yalnız `fields`) kabul ediyor** — spec `comment` zorunlu dese de canlıda gerekmedi.
5. **Kapalı (Closed=5) talepler değiştirilemez:** `"Closed ticket 'X' cannot be updated"` (422). Kapatma işlemi son adım olmalı.
6. **`publicVisible` spec açıklaması TERS:** canlı davranış `true` = public yorum, `false` = dahili not (oluşturma ve görüntülemede tutarlı).
7. Boş sonuçta `totalPages: 0` döner; advanced-search varsayılan sıralaması yeniden→eskiye görünüyor (`pageable.sort.orderBy: []`).

## TEST VERİ SETİ (kalıcı referans)

**Parent:** `TICKET-563` "[TEST] Yan Görüşmeler Ana Talep" · **13 yan talep** → size=10'da 2 sayfa (10+3).

| Key | Beklenen rozet | Alıcı | Not |
|---|---|---|---|
| TICKET-564 | Yanıt bekleniyor | tedarikci-a@example.com | tek agent mesajı |
| TICKET-565 | Yeni yanıt | muhasebe-ofisi@example.com | harici son yazan |
| TICKET-566 | Yeni yanıt | tedarikci-b@example.com | harici public + SONRA internal not (son public = harici) |
| TICKET-567 | Yeni yanıt | kargo-firmasi@example.com | |
| TICKET-568 | Yanıt bekleniyor | tedarikci-a@example.com | harici yazdı → agent son yazdı |
| TICKET-569 | Yanıt bekleniyor | satis-ekibi@example.com | |
| TICKET-570 | Yanıt bekleniyor | servis-merkezi@example.com | |
| TICKET-571 | Yanıt bekleniyor | destek-hatti@example.com | |
| TICKET-572 | Yanıt bekleniyor | uretici-firma@example.com | |
| TICKET-573 | Kapalı | tedarikci-c@example.com | Solved(4) |
| TICKET-574 | Kapalı | (bozuk requester — edge-case fikstürü) | Closed(5), düzeltilemez |
| TICKET-575 | Yeni yanıt | kalite-kontrol@example.com | |
| TICKET-578 | Kapalı | finans-birimi@example.com | Closed(5), temiz |

Requester'lar `/users/{id}.primaryEmail` üzerinden doğrulandı (574 hariç hepsi OK; harici yorumu olanlarda requester id == yorum yazarı id). Tenant'ta probe artığı birkaç `[TEST] requester format probe` talebi (TICKET-576/577) ve bozuk e-postalı kullanıcılar kaldı — zararsız, istenirse admin UI'dan temizlenebilir.

## Ham JSON dosyaları (oturum scratchpad'i)

`search-any.json`, `ticket.json`, `digest.json`, `fields-ticket.json`, `final-page0.json`, `final-page1.json`, `cp-t566.json`, `seed-manifest.json` — `/private/tmp/claude-501/-Users-davut-Code-grispiapp-side-conversations-plugin/ac452c75-47fe-49bc-8543-97d158fee402/scratchpad/`
