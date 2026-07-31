# Ek (Attachment) Yükleme Sözleşmesi ve Paket Kararları — Faz 4 ön araştırması

**Tarih:** 2026-07-31
**Kaynaklar:** `~/Code/grispiapp/grispi-ui` referans implementasyonu (birebir kod okuması) + paket araştırması (npm/GitHub, 2026-07-31 doğrulaması)
**Durum:** Sözleşme grispi-ui'dan CONFIRMED; `public/v1` uyumu PROBE BEKLİYOR (Faz 4 ilk task)

---

## 1. Gerçek API sözleşmesi — Base64 DEĞİL

`PROJECT.md`'deki eski not (`Base64 attachment desteği: comment.attachments[{name, file}]`) **hatalıydı**. grispi-ui'da ilk attachment commit'inden bu yana akış her zaman **upload-first → numeric id ile referans** olmuştur. Geçmişte tek `getBase64` kullanımı yorum satırına alınmış lokal *önizleme* koduydu. Pre-signed URL / iki adımlı S3 akışı da yok.

```
POST {BASE}/attachments/upload             # normal ek
POST {BASE}/attachments/upload?inline=true # editör içi inline görsel

Headers:
  Authorization: Bearer <token>
  tenantId: <tenant>
  Content-Type: tarayıcı üretir (multipart boundary) — ELLE YAZMA

Body: FormData, tek alan "files" = <File>     # ÇOĞUL "files"
      (grispi-ui chat varyantı non-inline'da "file" tekil kullanıyor — dikkat)

200 → UploadFilesResponse[]   # tek dosyada bile DİZİ; [0] tüketilir
  { id: number, filename: string, mimeType: string, size: number,
    bucket: string, objectKey: string, objectUrl: string,
    objectThumbKey: string, objectThumbUrl: string, publicUrl?: string }
```

Mesaja bağlama:

```
PATCH {BASE}/v2/tickets/{key}     # grispi-ui yolu (bizim plugin public/v1 kullanıyor → probe)
{ comment: { body, publicVisible, creator[], attachmentIds: number[] }, fields: [...] }
```

- Alan adı **`attachmentIds`**, **`comment` altında** ve **boşsa hiç gönderilmiyor** (`[]` değil, alan yok).
- `id` upload cevabından gelir (`file.id = file.response.id`).

### Inline görsel akışı (kullanıcının istediği davranışın birebir Grispi karşılığı)

1. Paste/drop yakalanır → dosya **önce upload edilir** (`?inline=true`).
2. Yükleme sürerken geçici bir **base64 placeholder** blot'u gösterilir (yalnızca lokal önizleme).
3. Başarıda placeholder silinir, yerine **`<img src="{objectUrl}">`** gömülür. `objectUrl` kullanılır — thumb değil.
4. Hatada placeholder kaldırılır + bildirim. **Retry yok.**
5. Inline görseller ek chip listesine **girmez**; ayrı `inlineImages` kovasında tutulur.
6. Submit'te **çöp toplama**: yalnızca `objectUrl`'i hâlâ gövde HTML'inde geçen inline görsellerin id'leri `attachmentIds`'e eklenir (kullanıcı sildiyse düşer).

```ts
const filteredInlineImages = inlineImages.filter(({ src }) => body?.includes(src)).map(({ id }) => id);
const attachmentIds = [...filteredInlineImages, ...attachments.map((v) => v.id)];
```

### Gelen ekleri render etme

- `attachment.inline === true` olanlar **listeden filtrelenir** (zaten gövdede `<img>` olarak var).
- MIME'a göre 5 yol: image → önizleme, pdf, svg (ayrı önizleme), video, diğer → dosya chip'i.
- Her yerde **`objectUrl`** kullanılır; grid küçük resimde `objectThumbUrl || objectUrl`.
- **`objectUrl` auth header'sız erişilebilir** (doğrudan `<img src>` / `window.open` ile kullanılıyor) → plugin'de doğrudan render edilebilir.
- Ayrıca tenant-scoped `GET /attachments/{attachmentKey}` → indirme URL'i string döner (alternatif yol).

### Limitler / doğrulama (grispi-ui'da)

- Boyut limiti tutarsız uygulanmış: editör yolu **51 MB**, hook yolu bug nedeniyle efektif **50 MB**. Gerçek otorite sunucu.
- **Dosya sayısı / toplam boyut client'ta zorlanmıyor** — sunucu abonelik limitleri hata cevabında `limitKey` ile dönüyor.
- Ataç ile ek yüklemede **MIME filtresi yok** (her tip). Inline paste'te allowlist: png/jpeg/gif/webp/**svg+xml**; drop'ta ise SVG hariç ~80 uzantı. (Asimetri = grispi-ui bug'ı; biz **SVG'yi bloklamalıyız** — güvenlik, aşağıda.)
- **Client-side sıkıştırma/yeniden boyutlandırma yok.**
- 413 için özel işleme yok; jenerik "upload failed" bildirimi.

---

## 2. Bizim plugin'e taşırken PROBE gerektiren açık sorular

Faz 2'nin canlı-probe checkpoint deseni birebir tekrarlanmalı — hiçbir kod varsayım üstüne kurulmamalı:

1. **Upload yolu prefix'i**: grispi-ui `{BASE}/attachments/upload` çağırıyor (public/v1 yok). Bizim `HttpHandler` `public/v1` ön ekliyor. Doğru yol `public/v1/attachments/upload` mı, kök `attachments/upload` mı?
2. **`public/v1` `attachmentIds` kabul ediyor mu?** grispi-ui `/v2/tickets` kullanıyor. Bizim `POST public/v1/tickets` ve `PATCH public/v1/tickets/{key}` `comment.attachmentIds`'i kabul ediyor mu?
3. **Bundle token yetkisi**: plugin token'ı `/attachments/upload`'a yetkili mi?
4. **`?inline=true`** public API'de destekli mi; `inline` bayrağı gelen ekte geri dönüyor mu?
5. **Gerçek boyut tavanı** (413 eşiği) ve hata gövdesi şekli.
6. **E-posta teslimi**: `attachmentIds` ile bağlanan ek alıcıya gerçekten e-posta eki olarak gidiyor mu; inline `<img src=objectUrl>` alıcının e-postasında görünüyor mu (uzak görsel engelleme davranışı dahil).

---

## 3. Paket kararları (doğrulanmış sürümler, 2026-07-31)

| Alan | Karar | Sürüm | gzip |
|---|---|---|---|
| Sürükle-bırak + seçici | **react-dropzone** | 19.1.1 | 5.7 KB |
| Tiptap paste/drop | **@tiptap/extension-file-handler** | 2.27.2 (`v2-latest`) | ~1 KB |
| Inline görsel node | **@tiptap/extension-image** | 2.27.2 | 0.6 KB |
| Chip/liste UI | **El yapımı** (mevcut Button/Badge/ikonlar) | — | 0 |
| Görsel sıkıştırma | **compressorjs** (opsiyonel) | 1.3.0 | 4.6 KB |

Gerekçeler:
- `react-dropzone@19` artık dual ESM/CJS, React 18/19 uyumlu; **`useFsAccessApi` varsayılanı `false`** → cross-origin iframe'de seçici bozulmuyor (bizim panel için kritik). Node >= 20 (engines) — CI imajını kontrol et.
- **Tiptap FileHandler artık MIT** (eski Pro eklentisi açıldı) ve `v2-latest` tam olarak bizdeki **2.27.2**'ye sabitli → v3 migration gerekmiyor. Peer dep `@tiptap/extension-text-style` zaten starter-kit üzerinden mevcut.
- **Uppy / FilePond reddedildi**: tus/S3/resumable transport için tasarlanmışlar; bizde upload tek multipart POST. 16–34 KB gzip + kendi CSS'i, 372px panele uymuyor.
- `browser-image-compression` **terk edilmiş** (2023'ten beri release yok, 65 açık issue) → `compressorjs` (Nisan 2026 release, aktif).
- Chip UI için shadcn resmi file-upload primitifi **yok**; üçüncü parti registry'lerin hepsi progress/transport modeli etrafında kurulu — bizde submit anında upload olduğundan çoğu ölü ağırlık.

### Uygulamada iki tuzak (kod okumasıyla doğrulandı)

1. **`editorProps.handlePaste` her şeyi eziyor.** `rich-text-composer.tsx:277-290` koşulsuz `true` dönüyor; ProseMirror `_props`'u plugin'lerden önce sorguladığı için FileHandler'ın `handlePaste`'i **hiç çalışmaz**. Düzeltme: pano dosya taşıyorsa `false` dön.
   ```ts
   if (event.clipboardData?.files.length) return false; // FileHandler devralsın
   ```
2. **Sanitizer `<img>`'ı içeriğiyle siliyor.** `html-sanitizer.ts`: `img` hem `FORBID_TAGS` hem `FORBID_CONTENTS`'te, `src` `ALLOWED_ATTR`'da değil. Inline görsel için `img` + `src` açılmalı. **`data:` açmaya gerek YOK** — Grispi URL'i `https://` olduğu için mevcut `ALLOWED_URI_REGEXP` zaten geçiriyor. `svg` her iki politikada da bloklu kalmalı.
   - **Politika ayrımı önerisi:** `sanitizeAuthoredHtml` (kendi yazdığımız gövde — `img` serbest) vs gelen uzak e-posta HTML'i (mevcut sıkı politika korunur; tracking pixel / uzak içerik sızıntısı riski).
   - `onUpdate` her tuş vuruşunda `sanitizeHtml` çalıştırıyor → inline görsel devreye girince **debounce (~300ms)** önerilir.

### Güvenlik notları

- **SVG ve HTML dosyalarını blokla.** 2026'da bu sınıftan çok sayıda gerçek zafiyet var; en yakın örnek **FreeScout** (yardım masası) SVG upload → stored XSS. Uzantı/MIME uyumsuzluğu (`.png` + `image/svg+xml`) klasik bypass.
- Client-side MIME kontrolü **UX'tir, güvenlik değildir** — sunucu otoritedir.
- Dosya adları güvenilmez girdi: yol ayırıcı/kontrol karakterlerini temizle, uzunluğu sınırla, **daima metin olarak** render et (JSX `{file.name}` zaten güvenli).
- Grispi ekibiyle doğrulanacak: ek indirmelerinde `Content-Disposition: attachment` ve mümkünse ayrı origin.

### Bellek/performans

- `File` nesnelerini store'da tut, **base64'ü store'da tutma**. MobX'te büyük dosya listelerini `observable.shallow` / payload'ları `observable.ref` ile işaretle (multi-MB string'leri proxy'lemesin).
- Küçük resim önizlemesi için **`URL.createObjectURL`** kullan (base64 değil) ve kaldırma/unmount'ta `revokeObjectURL`.
