# Phase 03 Plan 01 — Canlı PATCH Sözleşmesi Bulguları

**Tarih:** 2026-07-28  
**Ortam:** Mevcut kimliği doğrulanmış geliştirme tenant'ı; tek kullanımlık yan talep  
**Redaksiyon:** Tenant kimliği, ticket anahtarları, token, e-posta adresleri, kişi adları ve serbest metin içerikleri kayda alınmamıştır.

## Kısa Sonuç

- Public HTML yanıtı `PATCH /public/v1/tickets/{encoded-key}` üzerinde yalnız `comment` gövdesiyle kabul edilir.
- `Content-Type: application/json` zorunludur: header kaldırıldığında HTTP 400 ve yorum sayısında artış yoktur; JSON header ile aynı gövde HTTP 200 döner.
- `SOLVED` tam değeri `"4"`, tekrar açma için kabul edilen tam değer `"2"` (`OPEN`) olarak doğrulandı.
- SOLVED ve OPEN işlemleri yalnız `fields` taşır; yorum sayısı `3 → 3 → 3` kalır.
- PATCH yanıtları 11 anahtarlı mutation-ticket nesnesidir; `fieldMap["ts.status"].value` burada `{id,name}` nesnesidir. Sonraki GET daha dar 5 anahtarlı ticket döndürür ve aynı değer string ID (`"2"`) olur. Bu nedenle PATCH cevabı mevcut GET `Ticket` tipiyle birebir aynı kabul edilmemelidir.
- SOLVED durumundayken ROLE_END_USER public yorumu `3 → 4` yorum ekledi ve status'u plugin tarafından ayrıca PATCH yapılmadan `OPEN(2)` yaptı.
- Quote sınırı için canlı korunan kararlı öğe çıplak `<blockquote>...</blockquote>` yapısıdır; sağlayıcıya özgü `gmail_*`, Yahoo, ProtonMail veya Mozilla sınıfları kararlı sözleşme olarak kullanılamaz.

## Probe Sırası ve Gizlilik

Probe yalnızca tek kullanımlık yan talepte çalıştırıldı. Gövdelerde kişisel/iş verisi yerine sabit `[Phase 3 contract probe]` metinleri kullanıldı. Kimlik alanları canlı çağrıda mevcut ticket/user verisinden bellekte çözüldü; hiçbir kimlik değeri bu dosyaya veya git'e yazılmadı.

| Adım | İşlem | HTTP | Önce → sonra yorum | Önce → sonra status |
|---|---|---:|---:|---|
| Baseline | Tek kullanımlık side ticket oluşturma | 201 | `0 → 1` | `— → NEW(1)` |
| Bağlam | ROLE_END_USER public bağlam yorumu | 200 | `1 → 2` | `NEW(1) → NEW(1)` |
| A1 negatif | Aynı reply, `Content-Type` yok | 400 | `2 → 2` | `NEW(1) → NEW(1)` |
| A1 pozitif | Public HTML reply, JSON content type | 200 | `2 → 3` | `NEW(1) → NEW(1)` |
| A2 | Status-only SOLVED | 200 | `3 → 3` | `NEW(1) → SOLVED(4)` |
| A3 | Status-only reopen | 200 | `3 → 3` | `SOLVED(4) → OPEN(2)` |
| A6 hazırlık | Status-only SOLVED | 200 | `3 → 3` | `OPEN(2) → SOLVED(4)` |
| A6 | ROLE_END_USER public reply | 200 | `3 → 4` | `SOLVED(4) → OPEN(2)` |

## A1 — Public HTML Reply ve Content-Type

Kabul edilen gövde:

```json
{
  "comment": {
    "body": "<p>[REDACTED_CURRENT_TEXT]</p><blockquote><p>[REDACTED_PRIOR_1]</p><p>[REDACTED_PRIOR_2]</p></blockquote>",
    "publicVisible": true,
    "creator": [
      {
        "key": "us.email",
        "value": "[REDACTED_AGENT_EMAIL]"
      }
    ]
  }
}
```

Gövde `fields` içermez. Creator gösterimi create akışıyla aynıdır: tek elemanlı `creator` dizisi, `key: "us.email"` ve temsilcinin e-posta değeri.

Content-Type kanıtı:

- `Content-Type` tamamen kaldırılmış aynı JSON gövdesi → HTTP 400 (`Bad Request`), yorum sayısı değişmedi.
- `Content-Type: application/json` ile aynı gövde → HTTP 200, yorum sayısı `2 → 3`.
- Başarılı response'ta son yorum `publicVisible: true`, creator authority `ROLE_ADMIN`, channel `INTEGRATION`; body'nin `<p>...current...</p><blockquote>...two prior messages...</blockquote>` yapısı byte-düzeyinde korunmuştur.

Bildirim gözlemi:

- API tarafında public yorum oluşması, bu tenant'ta daha önce canlı doğrulanmış `publicVisible:true → harici e-posta` sözleşmesini tetikleyen gözlemdir.
- Grispi Public API ayrı bir mail-delivery/notification receipt döndürmez. Gerçek gelen kutusunda tek reply maili ve quote görünümü Task 2 insan kapısında onaylanmalıdır.

## A2 — SOLVED Status-Only PATCH

Kabul edilen tam gövde:

```json
{
  "fields": [
    {
      "key": "ts.status",
      "value": "4"
    }
  ]
}
```

Sonuç:

- HTTP 200.
- Status `NEW(1) → SOLVED(4)`.
- Yorum sayısı `3 → 3`; son yorumun rolü ve body uzunluğu değişmedi.
- `comment` alanı yoktur. D-14/D-15/D-17 gereği lifecycle mutasyonu reply değildir.
- API notification receipt üretmez; yorum oluşmaması sunucu tarafındaki doğrulanabilir “mail üretme girdisi yok” kanıtıdır. Gelen kutusunda status maili oluşmadığı Task 2'de onaylanmalıdır.

## A3 — Reopen Status-Only PATCH

Kabul edilen tam gövde:

```json
{
  "fields": [
    {
      "key": "ts.status",
      "value": "2"
    }
  ]
}
```

Sonuç:

- HTTP 200.
- Status `SOLVED(4) → OPEN(2)`.
- Yorum sayısı `3 → 3`; `comment` yoktur.
- PATCH cevabında `solvedAt` alanı null'a dönmedi. UI açık/çözüldü kararını `ts.status` üzerinden vermeli; `solvedAt` reopen sonrası lifecycle doğruluğu için kullanılmamalıdır.
- Reopen için `"1"` tahmini kullanılmamalıdır; canlı kabul edilen değer/id açıkça `"2"` / `OPEN`.

## A4 — Üç PATCH Response Şekli

Public reply, SOLVED ve reopen çağrılarının üçü de HTTP 200 ile aynı top-level anahtar ailesini döndürdü:

```text
callMergeStatus
channel
comments
createdAt
fieldMap
form
key
relation
resolution
solvedAt
updatedAt
```

Önemli type farkı:

```json
{
  "fieldMap": {
    "ts.status": {
      "value": {
        "id": 2,
        "name": "Open"
      }
    }
  }
}
```

PATCH mutation response'ta status value nesnedir. Aynı ticket'ın hemen sonraki canonical GET cevabı yalnız `channel`, `comments`, `fieldMap`, `key`, `relation` anahtarlarını taşıdı ve:

```json
{
  "fieldMap": {
    "ts.status": {
      "value": "2"
    }
  }
}
```

Sonuç: PATCH 200 gövdesi boş değildir, fakat mevcut GET `Ticket` shape'inin aynısı da değildir. Plan 03-02 dar bir mutation-response tipi tanımlamalı veya başarıdan sonra response'u state'e doğrudan koymayıp canonical GET ile refetch etmelidir.

## A5 — Quote Marker ve Outbound Context-Preservation

### Canlı inbound gövde taraması

Tenant'taki 190 ticket / 1.548 comment body yalnız yapısal imzalarla tarandı; ham mesaj metni veya kimlik alanı kalıcılaştırılmadı.

| Marker | Eşleşme |
|---|---:|
| `<blockquote>` | 11 comment |
| `gmail_quote` / `gmail_attr` / `gmail_extra` | 0 |
| `yahoo_quoted` | 0 |
| `protonmail_quote` | 0 |
| `moz-cite-prefix` / `type="cite"` | 0 |
| `data-smartmail` / `replyForwardMsg` | 0 |

Kararlı inbound ayrıştırma sözleşmesi:

1. İlk `<blockquote>` öğesi quote başlangıcıdır.
2. İlk blockquote öncesi içerik görünür güncel mesajdır.
3. Blockquote ve içi `quotedHtml` olarak ayrılır, aynı sanitizer policy ile temizlenir ve UI'da varsayılan kapalı gösterilir.
4. Sağlayıcı sınıfına güvenilmez.
5. Blockquote bulunmazsa tüm sanitize edilmiş body güncel mesaj olarak korunur; tahminle metin silinmez.

### Outbound body sözleşmesi

Çok mesajlı bağlamı harici reply mailinde koruyan doğrulanmış body:

```html
<p>[REDACTED_CURRENT_TEXT]</p>
<blockquote>
  <p>[REDACTED_PRIOR_1]</p>
  <p>[REDACTED_PRIOR_2]</p>
</blockquote>
```

Canlı PATCH response body bu hiyerarşiyi değiştirmeden korudu. Plan 03-02/03-03:

- editörün yeni sanitize edilmiş HTML'ini blockquote dışına koymalı;
- mevcut thread'in gerekli public bağlamını kronolojik olarak tek `<blockquote>` içine serialize etmeli;
- internal note'ları outbound quote'a dahil etmemeli;
- API'den gelen body'yi tekrar quote içine körlemesine gömerek nested quote büyümesi üretmemeli.

Gerçek teslim edilen e-postada blockquote'un görünür/collapsed sunumu Task 2 insan doğrulamasının parçasıdır; API teslim edilen MIME/HTML receipt sunmaz.

## A6 — SOLVED Sonrası Harici Yanıt

Probe yeniden `SOLVED(4)` yapıldı:

- SOLVED öncesi/sonrası yorum sayısı `3 → 3`.
- Ardından `publicVisible:true`, creator authority `ROLE_END_USER` olan bir yanıt eklendi.
- Reply HTTP 200 döndü; yorum sayısı `3 → 4`.
- Status aynı response içinde otomatik `SOLVED(4) → OPEN(2)` oldu.
- Plugin ayrı bir reopen PATCH'i göndermedi.
- Sonraki GET status'u string `"2"` ve son public author'ı `ROLE_END_USER` olarak doğruladı.

Bu D-17'yi canlı olarak doğrular: çözülen görüşmeye harici public yanıt server-side yeniden aktivasyon üretir.

## Dependency-Free Sanitizer Uyumluluğu

Kurulu runtime matrisi:

| Bileşen | Sürüm |
|---|---|
| React / React DOM | 18.3.1 |
| TypeScript | 4.9.5 |
| react-scripts | 5.0.1 |
| Jest / Jest jsdom | 27.5.1 |
| jsdom | 16.7.0 |

Geçici, commitlenmeyen bir DOMParser + `document.createTreeWalker(..., NodeFilter.SHOW_ELEMENT)` allowlist prototipi iki kapıdan geçti:

1. TypeScript 4.9 strict DOM compile: `tsc --noEmit --target ES2017 --lib DOM,ES2020 --strict --skipLibCheck` → PASS.
2. Repository Jest 27 + jsdom runtime (`--no-watchman`) → 2/2 PASS:
   - `p/br/strong/em/ul/li/blockquote` korunuyor; style/event attribute siliniyor.
   - `script/img/table`, event handler ve `javascript:` link atılıyor; güvenli HTTP linkine `target="_blank"` + `rel="noopener noreferrer"` ekleniyor.

İlk Jest denemesi sandbox'ta Watchman state dizinine erişemedi; aynı suite `--no-watchman` ile geçti. Bu sanitizer davranışıyla ilgili bir hata değildir.

Production Browserslist hedefleri Chrome/Edge/Firefox/Safari/Android/iOS Safari ailesidir (listelenen en eski Safari hedefi 12.2–12.5). `DOMParser`, `TreeWalker`, `NodeFilter`, `Element.remove` ve `replaceWith` TypeScript DOM lib'de mevcuttur ve bu hedeflerde polyfill gerektirmeyen browser DOM API'leridir. Yeni sanitizer paketi gerekmez; Plan 03-02 ortak dependency-free helper'ı üretip aynı policy'yi inbound render ve outbound send sınırlarında kullanmalıdır.

## Notification ve Redaksiyon Kontrolü

- Reply: public comment sayısı arttı; mail-triggering API girdisi oluştu.
- SOLVED/reopen: yorum sayısı değişmedi; lifecycle body'lerinde `comment` yok.
- API, teslimat receipt'i veya notification listesi döndürmedi; gerçek mailbox gözlemi Task 2'de zorunlu.
- Bu dosyada authorization header, token, tenant kimliği, ticket key, e-posta, kişi adı veya ham müşteri mesajı yoktur.
- Temporary raw JSON yalnız `/private/tmp` altında tutuldu ve git kapsamına alınmadı.

## Downstream Uygulama Sözleşmesi

Plan 03-02 ve sonrası aşağıdaki canlı şekillere bağlanmalıdır:

- Reply: `{comment:{body,publicVisible:true,creator:[{key:"us.email",value}]}}`
- Solve: `{fields:[{key:"ts.status",value:"4"}]}`
- Reopen: `{fields:[{key:"ts.status",value:"2"}]}`
- Status mutation body'lerinde `comment` asla bulunmaz.
- Her mutation HTTP 200 response döndürür, fakat mutation ticket shape'i canonical GET shape'i değildir; success sonrası GET/refetch güvenlidir.
- Quote split/preservation sınırı `<blockquote>`.
- SOLVED sonrası ROLE_END_USER public reply server-side `OPEN(2)` üretir.

