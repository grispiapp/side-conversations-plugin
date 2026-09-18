# `ts.email_ccs` — doğrulanmış API sözleşmesi

Kaynak: `grispi-api` repo'su (okundu, 2026-09-18). Her madde bir dosya/satıra
dayanır — varsayım yok.

## 1. Alan tanımı

`api/src/main/resources/db/migration/V89__insert-system-field-definitions.sql:11`

```
('Email CCs', 'ts.email_ccs', 'AGENT_ONLY', 'NOT_REQUIRED', 'MULTI_USER', attributes=1)
```

- Tip: `MULTI_USER` (`LinkedHashSet<FieldUser>`)
- `attributes = 1` = `FieldAttribute.ALLOW_NEW_VALUES` (`core/.../ticket/FieldAttribute.java:22`)
  → **kayıtlı olmayan e-posta adresleri kabul edilir**, sunucu end-user'ı bulur/oluşturur.
- Sistem alanı, `SystemFields.Keys.EMAIL_CCS` (`core/.../field/SystemFields.java:180`).
- Plugin custom field'ı DEĞİL → `tp.` değil `ts.` öneki, D-01/D-02 gereği hardcode.

## 2. YAZMA formatı (serialized value)

`core/.../field/FieldParser.java` — `deserializeValue` → `parseUsers` → `parseUser`

- Liste ayracı: `,` (`Field.PARSABLE_LIST_SEPARATOR`)
- Eleman ayracı: `:` (`Field.PARSABLE_FIELD_SEPARATOR`) → `id:email:phone`
- `split(":", -1)`, `length` 1..3 arası olmalı; aksi hâlde `MALFORMED_CF_VALUE`.
- Boş string ve (case-insensitive) `"null"` → o parça yok sayılır
  (`FieldParser.emptyOrNull`).
- id, email ve phone aynı anda boşsa → `INVALID_USER_RESOURCE`.
- id yoksa ve `ALLOW_NEW_VALUES` varsa → `new User(NEW_USER_ID, email, ...)`;
  id varsa → `StaticUserLoader.loadById(id)`.

Bu yüzden iki geçerli eleman biçimi:

| Durum | Gönderilecek eleman |
|---|---|
| Yeni / e-postayla belirtilen alıcı | `null:someone@example.com:null` |
| Zaten CC'de olan kayıtlı kullanıcı | `123:null:null` (veya sadece `123`) |

grispi-ui'nin canlı payload'ı (kullanıcı ekran görüntüsü) tam olarak
`null:asdasdasd@asdasc.cas:null` gönderiyor — birebir bu biçimi kullan.

## 3. OKUMA formatı — burası tuzak

`core/.../public_api/TicketToPublicApi.java:46`

```java
new FieldToPublicApi(field.key(), field.serializedValue().orElse(null))
```

ve `core/.../user/User.java:326`

```java
public @NotNull String serializedValue() { return id.toString(); }
```

→ `GET /public/v1/tickets/{key}` yanıtında
`fieldMap["ts.email_ccs"].value` **sadece virgülle ayrılmış kullanıcı
id listesi**dir (ör. `"41,57"`), e-posta DEĞİL. CC yoksa alan ya yok ya `null`
(`FieldSerializer` boş koleksiyonda bilerek `null` döner).

E-posta göstermek için id → e-posta çözümlemesi gerekir:
`GET /public/v1/users/{id}` (`grispiAPI.users.getUser`, zaten var).

Yan bilgi: her `comment.commentCCs` dizisi, o yorum eklendiği andaki CC
**e-postalarını** taşır (`core/.../ticket/Comment.java:138-141`,
`Ticket.addComment` → `comment.addCommentCCs(this.emailCCs)`). Tarihsel kayıt;
güncel CC kümesi için otorite fieldMap'tir.

## 4. Yazma semantiği — REPLACE, append değil

- **PATCH** (`core/.../ticket/UpdateTicketAction.java:210-241`):
  `ticket.clearEmailCCs(); ticket.addEmailCCs(emailCCUsers);`
  → gönderilen küme mevcut kümenin **yerine geçer**. Delta göndermek mevcut
  CC'leri siler. Her zaman TAM küme gönderilmeli.
- **Alanı temizleme**: `TicketFromClient.shouldClearEmailCCs()` (satır 160) =
  "anahtar var ama değer boş" → `{ key: "ts.email_ccs", value: "" }` CC'leri
  tamamen siler. Değişiklik yoksa anahtarı hiç gönderme (no-op).
- **POST create** (`CreateTicketAction.java:236-264`): yeni ticket'ta
  `addEmailCCs` — set etmekle aynı.

## 5. Giden e-posta

`core/.../ticket/TicketService.java:532` (create) ve `:595` (update):

```java
new EmailRecipients(List.of(ticket.getRequester()), new ArrayList<>(ticket.getEmailCCs()))
```

→ CC'ler gerçekten giden e-postanın CC satırına düşer; hem ilk mesajda
(`WEB` + `publicVisible` + agent creator) hem sonraki agent yanıtlarında.

## 6. Bilinen uç durum

`channel != EMAIL` iken CC'ye tenant'ın destek adresi yazılırsa
`findUserOrCreateEndUser` `SUPPORT_ADDRESS_CANNOT_BE_USER_EMAIL` fırlatır ve
**tüm istek 422 olur** (EMAIL kanalında sessizce atlanır, bizim kanalımız
`WEB`). İstemci tarafında destek adresini bilemeyiz; 422 hatası mevcut hata
yüzeyinden kullanıcıya gösterilir.
