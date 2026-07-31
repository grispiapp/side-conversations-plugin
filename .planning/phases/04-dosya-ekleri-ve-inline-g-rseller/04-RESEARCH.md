# Phase 4: Dosya Ekleri ve Inline Görseller - Research

**Researched:** 2026-07-31
**Domain:** Multipart file upload, Tiptap paste/drop file handling, DOMPurify policy split, MobX optimistic-envelope retry, shadcn/sonner toast under CRA
**Confidence:** MEDIUM-HIGH — package/version facts and every named code trap are directly verified against installed source and the registry; the Grispi API surface (upload path prefix, `public/v1` `attachmentIds` acceptance, size ceiling, email delivery) is CONFIRMED only for the `grispi-ui` reference app and remains PROBE-PENDING for this plugin's `public/v1` API family until Task 1 of Plan 04-01 runs.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Ek listesi yerleşimi ve alan bütçesi**
- **D-01:** Ek chip'leri composer içinde, araç çubuğunun üstündeki mevcut panel yuvasında gösterilir (`rich-text-composer.tsx:515` — başlık menüsü ve bağlantı formunun kullandığı konteyner). Editör ve Gönder butonu yerinde kalır.
- **D-02:** Çok dosyada dikey alan korunur: liste tek satırlık `3 dosya ▾` özetine katlanır, tıklanınca açılır. D-07'nin (editör altta sabit, sınırlı büyüme) alan bütçesi korunur.
- **D-03:** Metin her zaman zorunludur — sadece ek göndermek mümkün değil. Mevcut salt-metin gönderim guard'ları (composer `hasMeaningfulContent`, `ComposeStore.submit`, `ActiveConversationStore.sendReply`) olduğu gibi kalır.
- **D-04:** Ataç ikonu D-08'in tek satırlık kompakt araç çubuğuna katılır (çubuk 372px'te zaten yatay kayıyor).

**Yükleme anı ve gönderim kilidi**
- **D-05:** Dosya seçilir seçilmez hemen Grispi'ye yüklenir (grispi-ui davranışı). Gönder anında bekleme olmaz. Kabul edilen bedel: taslak terk edilirse sunucuda sahipsiz dosya kalır.
- **D-06:** Yükleme sürerken Gönder kilitlenir, biten yüklemeyle açılır; buton pasifken kısa açıklama gösterilir (ör. "Ekler yükleniyor…").
- **D-07:** Yükleme başarısız olursa chip hata durumunda kalır ve "Tekrar dene" sunar (Faz 3'ün D-10/D-17 deseniyle tutarlı). grispi-ui'dan bilinçli sapma — orada başarısız dosya sessizce listeden düşüyor.

**Boyut/tip politikası ve reddetme**
- **D-08:** Client-side politika ~10MB/dosya, ~25MB toplam, max 10 dosya. Gerekçe: ek nihayetinde e-postayla gidiyor ve Gmail 25MB'da reddediyor; Grispi 50MB kabul etse bile teslimat sessizce patlar. Toplam boyut kontrolü client'ta yapılır (grispi-ui'da hiç yok). Sunucu her hâlükârda nihai otorite.
- **D-09:** Dosya tipi kısıtı yok (grispi-ui gibi) — destek işinde log/zip/har/apk gibi dosyalar meşru.
- **D-10:** D-09'un güvenlik önlemi: SVG asla kendi panelimizde `<object>`/`<iframe>` ile gömülmez; dosya chip'i olarak gösterilir ve yeni sekmede (Grispi origin'inde) açılır. `<img>` içindeki SVG script çalıştıramadığı için önizleme yolu güvenlidir.
- **D-11:** Kısmi ret: geçerli dosyalar eklenir, reddedilenler adı ve nedeniyle bildirilir (ör. "rapor.zip — 12MB, sınır 10MB"). "Ya hep ya hiç" davranışı yok.
- **D-12:** Hata bildirimi için shadcn tabanlı toast mekanizması kurulur (sonner). Projede şu an toast yok; ev deseni satır içi `role="alert"`. Bu, proje geneli hata deseni hâline gelecek — sürüm plan aşamasında sabitlenecek.

**Inline görsel ile ek ayrımı**
- **D-13:** Yapıştırma (paste) → inline, sürükle-bırak ve ataç butonu → ek. Editörün yazı alanına sürüklenen görsel de ek olur; konuma bağlı gizli sınır yok. Tiptap FileHandler yalnızca `onPaste` için kullanılır.
- **D-14:** Inline görsel akışı: dosya önce yüklenir (`?inline=true`), dönen `objectUrl` ile gövdeye `<img src="…">` gömülür. Base64 data URI kullanılmaz (yalnızca yükleme sürerken geçici placeholder olarak kabul edilebilir).
- **D-15:** Inline görseller ek chip listesinde görünmez (grispi-ui deseni) — ayrı kovada tutulur. Aksi halde aynı görsel iki yerde çıkar.
- **D-16:** Gönderimde çöp toplama: yalnızca `objectUrl`'i son gövde HTML'inde hâlâ geçen inline görsellerin id'leri `attachmentIds`'e eklenir (kullanıcı görseli sildiyse ek de düşer). grispi-ui'dan devralınan davranış.

**Ek kaldırma ve taslak koruması**
- **D-17:** Ek kaldırılınca yalnızca referans düşer, dosya sunucuda kalır (`attachmentIds`'e girmez → alıcı asla görmez). Silme endpoint'i varsayılmaz; sahipsiz dosya temizliği sunucu tarafının işi.
- **D-18:** Ekler taslağı kirli sayar — metin boş olsa bile ek varken geri dönülürse D-12'nin (Faz 3) "taslak kaybolacak" uyarısı çıkar. `isDirty` hesabına ek listesi katılır. Faz 2'nin D-02 deseniyle tutarlı.

**Gelen ekler (THRD-06)**
- **D-19:** Gelen eklerin görsel muamelesi grispi-ui örnek alınarak yapılır (MIME'a göre ayrışan görsel önizlemesi / PDF / video / genel dosya chip'i).
- **D-20:** Eke tıklayınca yeni sekmede açılır (`objectUrl` auth header'sız erişilebilir; `window.open` + `noopener`). Panel içi lightbox yok.
- **D-21:** Gelen mesaj gövdesindeki görseller gösterilmez — sanitizer'ın gelen politikası sıkı kalır (D-05/Faz 3 korunur, takip pikseli ve uzak içerik sızıntısı riski alınmaz).
- **D-22:** D-21'in zorunlu tamamlayıcısı: `inline: true` ekler listeden FİLTRELENMEZ. grispi-ui bunları filtreliyor (çünkü gövdede gösteriyor); biz göstermediğimiz için filtrelersek karşı tarafın ekran görüntüsü tamamen kaybolurdu. Görsel muamele grispi-ui'dan alınır, `inline` filtresi bilinçli olarak alınmaz.

### Claude's Discretion
- D-02'nin inceltmesi: 1-2 dosyada chip'leri doğrudan göstermek, 3+ dosyada `N dosya ▾` özetine katlamak — UI-SPEC'te netleşti (bkz. 04-UI-SPEC.md §4).
- Chip içeriği (ad kısaltma biçimi, boyut formatı, küçük resim boyutu), yükleme ilerleme göstergesinin biçimi (yüzde vs belirsiz spinner) ve toast'un konumu/süresi UI-SPEC'e bırakıldı — UI-SPEC bunları çözdü (indeterminate spinner, top-center toast).
- `AbortController` ile yükleme iptali: dahil edilip edilmeyeceği plan aşamasında maliyete göre kararlaştırılır — bu araştırma **dahil etmemeyi önerir** (bkz. Assumptions Log A9).

### Deferred Ideas (OUT OF SCOPE)
- Sahipsiz (orphan) dosya temizliği — D-17 gereği kaldırılan ek sunucuda kalıyor; sunucu tarafının işi.
- Yükleme iptali (`AbortController`) — bu fazda dahil edilmezse ayrı iyileştirme.
- Gelen gövde görsellerini "Görselleri göster" düğmesiyle açma (Gmail deseni) — D-21 şimdilik tümüyle engelliyor.
- Ek önizlemesinde panel içi lightbox — D-20 yeni sekmeyi seçti.
- Client-side görsel sıkıştırma (`compressorjs`) — plan aşamasında maliyet/fayda değerlendirilir; bu araştırma paketi **bu fazda kurmamayı önerir** (bkz. Standard Stack notu).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMP-05 | Temsilci yeni görüşme mesajına sürükle-bırak veya ataç ikonuyla birden fazla dosya ekler; ekler gönderim öncesi listede görünür, tek tek kaldırılabilir; `POST /attachments/upload` ile yüklenip `comment.attachmentIds` ile bağlanır | §Standard Stack (react-dropzone), §Live-Probe Design (P1-P5), §Tiptap/FileHandler wiring (drop routing), §Integration Pitfalls #2/#4/#5 |
| COMP-08 | Editöre yapıştırılan görsel Grispi'ye yüklenir, dönen `objectUrl` ile editörde inline gösterilir, gönderilen mesajda inline kalır | §Tiptap FileHandler + Image wiring, §Integration Pitfalls #1/#3, §Live-Probe Design (P3) |
| THRD-05 | Temsilci yanıta da aynı şekilde çoklu dosya ekleyebilir (ortak composer) | Same as COMP-05 — `RichTextComposer` is shared (§Code Context, `code_context` in CONTEXT.md); one implementation covers both surfaces |
| THRD-06 | Görüşmede karşı tarafın gönderdiği ekler mesajla birlikte görünür ve açılıp indirilebilir; `inline: true` ekler FİLTRELENMEZ (D-22) | §Integration Pitfalls #4 (`normalizeComment` projection gap), §Live-Probe Design (P6) |
</phase_requirements>

## Summary

The API contract, package selection, and two headline code traps for this phase are **already settled** in `.planning/research/attachment-upload-contract.md` (grispi-ui reference-implementation read + package research, dated 2026-07-31) and must not be re-derived. That document establishes: upload-first (never Base64), `POST {BASE}/attachments/upload[?inline=true]` with a `files` FormData field returning `UploadFilesResponse[]`, binding via `comment.attachmentIds: number[]` on the PATCH/POST ticket body, the inline-paste lifecycle (upload → placeholder → `<img src="{objectUrl}">` → garbage-collect at submit), and the package trio `react-dropzone@19.1.1` + `@tiptap/extension-file-handler@2.27.2` + `@tiptap/extension-image@2.27.2`.

What that document explicitly leaves open — and what this research closes — is: (1) whether this plugin's `public/v1` API family actually accepts the same shapes grispi-ui's `/v2` family does (six concrete open questions, now converted into ready-to-run curl probes for the phase's opening checkpoint task); (2) a full Validation Architecture per the project's Nyquist gate, including exactly how to fake `File`/`DataTransfer`/clipboard-file paste events under this project's dependency-free (no RTL) React 18 + Jest 27.5.1 test harness; (3) five concrete, source-verified integration traps in this exact codebase (`rich-text-composer.tsx`, `http-handler.ts`, `html-sanitizer.ts`, `active-conversation-store.ts`, `side-conversation-queries.ts`) plus one newly-discovered trap in the FileHandler extension's own source (drop-routing race, GIF/WEBM clipboard edge case); (4) exact Tiptap FileHandler/Image wiring code including a source-verified nuance in `allowedMimeTypes` matching and the `onDrop`-unset early-return path; (5) that `npx shadcn add sonner` installs a `next-themes`-dependent wrapper that must be stripped for this always-light-theme CRA project; (6) a full Package Legitimacy Audit (all three non-shadcn packages score `SUS` on a "too-new" heuristic that is a false positive here — explained below).

**Primary recommendation:** Start Plan 04-01 with a `checkpoint:human-verify` task that runs the six curl probes in §Live-Probe Design against the live `gsocial-test` tenant before writing any upload client code — mirroring the Phase 2 Plan 01 Task 1 pattern exactly. Do not assume `public/v1/attachments/upload` or `public/v1/tickets` `comment.attachmentIds` acceptance; both are unverified for this plugin's endpoint family.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File selection (picker + drag-drop) | Browser/Client (`RichTextComposer` + `react-dropzone`) | — | Pure DOM/UI concern, no server round-trip until upload fires |
| Client-side size/count/total validation (D-08) | Browser/Client | — | UX-only gate; server remains authority (contract doc §1, "Limitler") |
| Attachment upload (multipart POST) | API/Backend (Grispi Public API via plugin's `HttpHandler`) | Browser/Client (constructs `FormData`, tracks per-chip state) | Actual file bytes must reach Grispi's storage; client only orchestrates and displays state |
| Attachment↔message binding (`attachmentIds`) | API/Backend (`PATCH`/`POST` tickets endpoint) | Browser/Client (MobX envelope assembles the final id list at submit time, after D-16 GC) | Server persists the association; client computes *which* ids survive garbage collection |
| Inline image rendering in editor | Browser/Client (Tiptap `Image` extension + local blob URL placeholder) | API/Backend (uploads bytes, returns `objectUrl` used as final `src`) | Editing/preview is local; the durable URL that survives in the sent email comes from the server |
| Outbound HTML sanitization (authored-content policy) | Browser/Client (`sanitizeHtml`/new authored variant in `html-sanitizer.ts`) | — | Trust boundary already lives client-side per Phase 3 precedent; server does not re-sanitize before emailing |
| Incoming attachment rendering (thumbnails, file chips) | Browser/Client (`ThreadMessage`) | API/Backend (`Comment.attachments[]` already returned by `getTicket`) | Data already present in the existing `getTicket` response; this phase is a *projection* fix (`normalizeComment`), not a new fetch |
| Toast notifications (rejection/failure surfacing) | Browser/Client (`sonner`) | — | Purely presentational; no server involvement |
| Optimistic retry / envelope freezing | Browser/Client (`ActiveConversationStore`) | — | Established Phase 2/3 pattern; this phase only needs to confirm `attachmentIds` composability with the existing `deepFreeze` + retry design (§Integration Pitfalls #4) |

No capability in this phase needs a Frontend-Server (SSR) or CDN/Static tier — this plugin has neither; everything is client + Grispi's REST API. [VERIFIED: codebase grep — no SSR layer exists in this CRA app]

## Settled Input Recap — DO NOT RE-DERIVE

Full detail lives in `.planning/research/attachment-upload-contract.md`; this is a pointer summary so the plan doesn't need to open two documents to find the load-bearing facts:

- **Endpoint (grispi-ui reference, `/v2` family):** `POST {BASE}/attachments/upload[?inline=true]`, FormData field `files` (plural), response `UploadFilesResponse[]` even for one file (`[0]` consumed). `objectUrl` is directly renderable without auth headers. [CITED: attachment-upload-contract.md §1]
- **Binding:** `comment.attachmentIds: number[]` on the ticket mutation body, field omitted entirely (not `[]`) when there is nothing to attach. [CITED: attachment-upload-contract.md §1]
- **Inline lifecycle:** upload with `?inline=true` → local base64/blob placeholder → swap to `<img src="{objectUrl}">` on success → no retry on failure → inline images excluded from the attachment chip bucket → garbage-collected at submit by scanning the final body HTML for surviving `objectUrl` occurrences. [CITED: attachment-upload-contract.md §1]
- **Incoming render:** `attachment.inline === true` is filtered from grispi-ui's list (because grispi-ui shows body images) — **this plugin explicitly does NOT filter it** (D-22), a deliberate, documented divergence. [CITED: 04-CONTEXT.md D-22]
- **Packages (already decided, versions verified below independently):** `react-dropzone@19.1.1`, `@tiptap/extension-file-handler@2.27.2`, `@tiptap/extension-image@2.27.2`; Uppy/FilePond explicitly rejected (built for resumable/chunked transport this project doesn't use); `browser-image-compression` rejected as abandoned in favor of `compressorjs` **but compressorjs itself is deferred out of this phase's scope** per CONTEXT.md. [CITED: attachment-upload-contract.md §3]
- **Two code traps already identified there** (re-verified against live source in §Integration Pitfalls below, with exact fixes): `handlePaste` returning `true` unconditionally, and the sanitizer's `img`/`src` block.
- **Six open questions already identified there** — converted into runnable probes in §Live-Probe Design.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-dropzone` | `19.1.1` [VERIFIED: npm registry, `dist-tags.latest = 19.1.1`] | Drag-and-drop + hidden-input file picker, wraps the composer root | Headless (no CSS to fight in a 372px panel), `useFsAccessApi` defaults to `false` in v19 which matters specifically for cross-origin iframe embedding (contract doc §3) |
| `@tiptap/extension-file-handler` | `2.27.2` exact pin, via dist-tag `v2-latest` [VERIFIED: `npm view @tiptap/extension-file-handler dist-tags` → `v2-latest: 2.27.2`] | Intercepts `paste` (not `drop`, per D-13) inside the ProseMirror editor to trigger inline-image upload | MIT-licensed since it was open-sourced from the former Pro registry; the `v2-latest` tag is pinned to the exact Tiptap 2.x line this project uses — installing without an explicit version (`npm install @tiptap/extension-file-handler`) resolves `latest` = **3.29.2**, which requires `@tiptap/core@3.x` peers and is incompatible with this project's `2.27.2` core [VERIFIED: `npm view @tiptap/extension-file-handler@3.29.2 peerDependencies` → `@tiptap/core: 3.29.2`] |
| `@tiptap/extension-image` | `2.27.2` [VERIFIED: npm registry, exact version match to installed `@tiptap/core`] | ProseMirror node type for `<img>` so pasted/inline images are a first-class editor node (undo/redo, copy/paste, serialization) rather than raw unmanaged HTML | Official Tiptap extension, zero extra runtime cost, peer dep `@tiptap/core: ^2.7.0` already satisfied |
| `sonner` | `2.0.7` [VERIFIED: npm registry] | Toast notifications for rejection summaries and non-retryable inline-paste failures (D-12) | shadcn official registry component; peer deps `react`/`react-dom` `^18.0.0 \|\| ^19.0.0` match this project's React 18.3.1 |

**Peer-dependency chain already satisfied:** `@tiptap/extension-file-handler@2.27.2` requires `@tiptap/extension-text-style@^2.7.0` — this is **already installed** at `2.27.2` in `node_modules` as a transitive dependency of `@tiptap/starter-kit` [VERIFIED: `node_modules/@tiptap/extension-text-style/package.json`]. No extra install needed for that peer.

**Node engine note:** `react-dropzone@19.1.1` declares `engines.node >= 20` [VERIFIED: `npm view react-dropzone@19.1.1 engines`]. Local dev node is `v22.12.0` (fine). This repo has **no CI workflow files and no `.nvmrc`/`engines` field** [VERIFIED: `find .github`, `cat .nvmrc` — both absent], so there is no CI gate to check, but if one is added later it must pin Node ≥ 20.

### Explicitly deferred, not installed this phase

| Library | Reason |
|---|---|
| `compressorjs` | CONTEXT.md's "Claude's Discretion"/Deferred list leaves image compression out of this phase's locked scope; installing it now would be scope creep beyond COMP-05/COMP-08/THRD-05/THRD-06. Verified clean (`OK` verdict, active April-2026 release) if a future phase wants it. |

### Alternatives Considered (already settled — pointer only)

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-dropzone` | Uppy, FilePond | Both assume chunked/resumable/tus transport; this plugin does one multipart POST. 16-34KB gzip + own CSS system doesn't fit 372px. Rejected in the settled contract doc. |
| `@tiptap/extension-file-handler` | Hand-rolled `handlePaste`/`handleDrop` ProseMirror plugin | FileHandler is MIT, exactly version-pinned to this project's Tiptap line, and its source is 70 lines (verified by inspecting `node_modules`) — hand-rolling duplicates it for no benefit |

**Installation:**
```bash
npm install react-dropzone@19.1.1 @tiptap/extension-file-handler@2.27.2 @tiptap/extension-image@2.27.2
npx shadcn@latest add sonner
```

## Package Legitimacy Audit

| Package | Registry | Age (first publish) | Weekly Downloads | Source Repo | Verdict (seam) | Disposition |
|---------|----------|----------------------|-------------------|--------------|-----------------|-------------|
| `react-dropzone` | npm | mature project, org-owned repo | 12,604,495/wk | `github.com/react-dropzone/react-dropzone` | `SUS` (reason: `too-new`) | **Approved — flag explained below** |
| `@tiptap/extension-file-handler` | npm | mature project, org-owned repo (`ueberdosis/tiptap` monorepo) | 451,271/wk | `github.com/ueberdosis/tiptap` | `SUS` (reason: `too-new`) | **Approved — flag explained below** |
| `@tiptap/extension-image` | npm | mature project, org-owned repo | 6,942,849/wk | `github.com/ueberdosis/tiptap` | `SUS` (reason: `too-new`) | **Approved — flag explained below** |
| `sonner` | npm | mature project | 43,829,989/wk | `github.com/emilkowalski/sonner` | `OK` | Approved |
| `compressorjs` (not installed this phase) | npm | mature project | 378,839/wk | `github.com/fengyuanchen/compressorjs` | `OK` | Not installed — see Standard Stack note |

**Packages removed due to `[SLOP]` verdict:** none.

**Packages flagged as suspicious `[SUS]`:** `react-dropzone`, `@tiptap/extension-file-handler`, `@tiptap/extension-image` — **all three flagged for the identical reason: `too-new`, computed from the latest *patch/version* publish timestamp (all three had a point release on 2026-07-19/07-28), not the package's actual age.** This is a false positive on well-established, multi-million-download, official-org-repo packages that happened to ship a routine version bump within the last two weeks. Cross-checked independently: `react-dropzone` has 12.6M weekly downloads and lives under the `react-dropzone` GitHub org; both Tiptap extensions live in the `ueberdosis/tiptap` monorepo (the same org publishing `@tiptap/core`, `@tiptap/react`, `@tiptap/starter-kit` already running in this codebase) [VERIFIED: `gsd-tools query package-legitimacy check`, `npm view <pkg> version/dist-tags/engines`]. **Per protocol these are kept, not removed, but the planner must still insert a `checkpoint:human-verify` step before the install task** — the check itself is cheap (confirm the version pin matches this document: `19.1.1` / `2.27.2` / `2.27.2`) since the legitimacy concern (recency) is already explained and low-risk here.

No suspicious `postinstall` scripts on any of the four packages checked [VERIFIED: `npm view <pkg> scripts.postinstall` → empty for all].

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ Browser (372px panel, RichTextComposer — shared by compose & reply)  │
│                                                                        │
│  [Attach button] ──┐                                                  │
│  [Drag onto panel]─┼──► react-dropzone (noClick,noKeyboard) ──► batch │
│                     │       validate (size/count/total, D-08/D-11)    │
│                     │       ├─ rejected → sonner toast (D-11/D-12)    │
│                     │       └─ accepted → AttachmentChip[] state      │
│                     │              │                                  │
│  [Paste image]──────┘              │ per-file, immediately (D-05)     │
│       │                            ▼                                  │
│       ▼                   ┌─────────────────────┐                    │
│  Tiptap FileHandler        │  Attachments client  │                   │
│  (onPaste only, D-13)      │  (new: multipart     │                   │
│       │                    │  POST via HttpHandler│                   │
│       ▼                    │  bypassing default    │                  │
│  local blob placeholder    │  Content-Type header) │                  │
│  <img data-uploading>      └──────────┬───────────┘                   │
│       │                               │ POST {BASE}/attachments/upload│
│       │                               │ [?inline=true]                │
│       │                               ▼                                │
│       │                    Grispi Public API (probe-pending prefix)   │
│       │                               │ 200 → UploadFilesResponse[]    │
│       │                               ▼                                │
│       │◄──── objectUrl + id ──────────┘                               │
│       ▼                                                               │
│  swap placeholder src → objectUrl (COMP-08 done)                      │
│                                                                         │
│  ── on Submit ──►  GC pass: keep chip ids + inline ids whose           │
│                    objectUrl still appears in final body HTML (D-16)  │
│                              │                                        │
│                              ▼                                        │
│                    ActiveConversationStore.startNew/sendReply         │
│                    builds frozen envelope with request.comment.       │
│                    attachmentIds (new field)                          │
│                              │                                        │
│                              ▼                                        │
│                    POST/PATCH public/v1/tickets[...]  (probe-pending  │
│                    attachmentIds acceptance)                          │
│                              │                                        │
│                              ▼                                        │
│                    Grispi emails recipient with attachments (probe-   │
│                    pending real delivery confirmation, P6)            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ Incoming path (THRD-06)                                              │
│  getTicket() → Ticket.comments[].attachments[] (ALREADY returned,    │
│  currently DROPPED by normalizeComment — projection bug to fix)      │
│         │                                                             │
│         ▼                                                             │
│  normalizeComment → MessageVM.attachments[] (new field)               │
│         │                                                             │
│         ▼                                                             │
│  ThreadMessage renders image-thumbnail row + file-chip row            │
│  (D-19/D-20/D-22) — objectUrl used directly, opens in new tab         │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── grispi/client/
│   ├── attachments.ts        # NEW — Attachments.upload(file, {inline}) via sendMultipart
│   └── http-handler.ts       # MODIFIED — add sendMultipart<T>() bypassing default Content-Type
├── screens/components/
│   ├── rich-text-composer.tsx    # MODIFIED — attach button, chip list slot, drop wiring,
│   │                              #   handlePaste fix, handleDrop guard, FileHandler+Image ext
│   └── attachment-chip.tsx       # NEW — chip pill (idle/uploading/failed), per UI-SPEC §4-5
├── screens/components/thread-message.tsx  # MODIFIED — incoming/own attachment rendering (D-19/20/22)
├── store/
│   ├── active-conversation-store.ts  # MODIFIED — attachmentIds flows into request.comment
│   └── attachment-upload-store.ts    # NEW (recommended) — per-chip upload lifecycle, isDirty input,
│                                       #   inline-image bucket, GC-at-submit logic (D-15/D-16)
├── query/side-conversation-queries.ts  # MODIFIED — normalizeComment projects attachments[]
├── lib/html-sanitizer.ts     # MODIFIED — authored-content policy allowing img+src (split from incoming policy)
├── types/grispi.type.ts      # MODIFIED — export Attachment, add attachmentIds? to request types
└── components/ui/sonner.tsx  # NEW (via shadcn CLI, then hand-edited to drop next-themes)
```

### Pattern 1: Multipart upload without corrupting the shared JSON `HttpHandler`

**What:** `HttpHandler.send()` unconditionally merges a `Content-Type: application/json` default header before every request (`http-handler.ts:28-39`). A multipart `FormData` body must let the browser set its own `Content-Type: multipart/form-data; boundary=...` header — this cannot be done by trying to "unset" the header via `undefined`.

**When to use:** Any new upload client method.

**Example (verified failure mode first):**
```ts
// THIS DOES NOT WORK — confirmed via direct test:
new Headers({ "Content-Type": undefined }).get("Content-Type") // → "undefined" (literal string!)
```
[VERIFIED: ran `node -e 'new Headers({"Content-Type": undefined})...'` — the WHATWG `Headers` constructor coerces `undefined` to the string `"undefined"`, which still overrides the browser's automatic multipart boundary header and breaks the upload]

**Correct fix — add a sibling method that never spreads `this.headers`:**
```ts
// src/grispi/client/http-handler.ts
async sendMultipart<T>(
  url: string,
  formData: FormData,
  extraHeaders: Record<string, string>
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${this.baseUrl}/${url}`, {
      method: "POST",
      cache: "no-cache",
      body: formData,
      headers: { ...extraHeaders }, // NOT { ...this.headers, ...extraHeaders } — no Content-Type key at all
    });
  } catch (cause) {
    throw new NetworkError(cause);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new HttpError(response.status, body);
  }
  return response.json();
}
```
```ts
// src/grispi/client/attachments.ts (new, mirrors customers.ts/users.ts constructor-injection pattern)
export class Attachments {
  constructor(private http: HttpHandler, private auth: Authentication) {}

  async upload(file: File, options: { inline?: boolean } = {}) {
    const formData = new FormData();
    formData.append("files", file);
    const suffix = options.inline ? "?inline=true" : "";
    return this.http.sendMultipart<UploadFilesResponse[]>(
      `public/v1/attachments/upload${suffix}`, // probe-pending prefix — see Live-Probe Design P1
      formData,
      this.auth.headers // tenantId + Authorization only — confirmed no Content-Type in Authentication.headers
    );
  }
}
```
`Authentication.headers` was directly read and confirmed to contain only `tenantId` and `Authorization` — never `Content-Type` [VERIFIED: `src/grispi/client/authentication.ts`], so passing it alone to `sendMultipart` is safe.

### Anti-Patterns to Avoid
- **Reusing `HttpHandler.send()` for uploads by trying to override `Content-Type` to an empty string or `undefined`:** produces a broken multipart request (verified above). Always use a dedicated method that skips the default headers object entirely.
- **Wiring FileHandler's `onDrop`:** D-13 requires drop to always be an attachment, never inline — leave `onDrop` unconfigured on the `FileHandler` extension (confirmed by reading its source: an unset `onDrop` makes its ProseMirror `handleDrop` return `false` immediately with no side effects — see Integration Pitfalls below for the resulting race that DOES need a separate fix).
- **Rendering SVG via `<object>`/`<iframe>`/inline `<svg>` markup:** D-10. `<img src="...svg">` is safe (browsers refuse to execute embedded `<script>` inside an SVG loaded via `<img>`) but never render the raw markup.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop file capture + hidden native picker | Custom `dragenter`/`dragover`/`drop` listeners + hidden `<input type=file>` | `react-dropzone@19.1.1` (`noClick`/`noKeyboard`) | Cross-browser DnD has many edge cases (nested-element dragleave flicker, `webkitdirectory`, `useFsAccessApi` cross-origin-iframe quirks) already solved and version-pinned |
| Paste-image-to-inline capture inside a ProseMirror/Tiptap editor | Custom `handlePaste` ProseMirror plugin that reads `clipboardData.files`, filters MIME, calls a callback | `@tiptap/extension-file-handler@2.27.2` `onPaste` | 70-line, MIT, exact-version-pinned to this project's Tiptap core; hand-rolling duplicates it with more risk of missing the `htmlContent` GIF/WEBM fallthrough case (see Integration Pitfalls) |
| Managed `<img>` ProseMirror node (undo/redo-safe, serializes correctly to/from HTML) | Insert raw `<img>` via `insertContent` string and hope Tiptap's default HTML parsing treats it as a first-class node | `@tiptap/extension-image@2.27.2` | Guarantees the pasted image participates correctly in undo/redo and `editor.getHTML()` round-trips it identically to what DOMPurify will re-sanitize on send |
| HTML sanitization allowlist for `<img>` | Hand-write a second regex/DOM-walk sanitizer just for the authored-content policy | Extend the **existing** DOMPurify `SANITIZE_CONFIG` in `html-sanitizer.ts` with a second exported config/function (see Integration Pitfalls #3) | The project already has one proven, tested sanitizer boundary (Phase 3); a second bespoke sanitizer is a second attack surface to audit |
| Toast/notification chrome | A custom `role="alert"` popup manager with timers/stacking | `sonner` (shadcn official) | D-12 explicitly requested this; hand-rolled stacking/timing/`aria-live` toast managers are a well-known source of accessibility bugs |
| Multipart FormData boundary generation | Manually construct `multipart/form-data` body strings with boundary markers | Native `FormData` + `fetch` (browser sets the boundary automatically when `Content-Type` is omitted) | This is exactly the bug class in Integration Pitfall #2 — never hand-construct MIME boundaries |

**Key insight:** every "don't hand-roll" item in this phase already has an existing, version-matched, MIT/official dependency in the settled contract — the actual engineering risk in this phase is *wiring integration correctly* (headers, event ordering, sanitizer split, type projection), not algorithm/library selection.

## Live-Probe Design

**This phase MUST open with a `checkpoint:human-verify` task** (mirrors `02-01-PLAN.md` Task 1 exactly — no upload client code is written until these six questions are CONFIRMED/CORRECTED against the live `gsocial-test` tenant). Base URL `https://api.grispi.net`; headers `tenantId: gsocial-test`, `Authorization: Bearer $REACT_APP_DEV_TOKEN` (loaded from `.env.development.local`, already present per Phase 1/2 setup — no new credential needed).

### P1 — Upload path prefix
```bash
curl -s -X POST "https://api.grispi.net/public/v1/attachments/upload" \
  -H "tenantId: gsocial-test" \
  -H "Authorization: Bearer $REACT_APP_DEV_TOKEN" \
  -F "files=@/tmp/probe-test.txt;type=text/plain" \
  -w "\nHTTP_STATUS:%{http_code}\n"
```
If this 404s, immediately retry against the root (no `public/v1`) path grispi-ui actually uses:
```bash
curl -s -X POST "https://api.grispi.net/attachments/upload" \
  -H "tenantId: gsocial-test" \
  -H "Authorization: Bearer $REACT_APP_DEV_TOKEN" \
  -F "files=@/tmp/probe-test.txt;type=text/plain" \
  -w "\nHTTP_STATUS:%{http_code}\n"
```
→ Records which prefix is correct, the exact response shape (confirm array-of-one `UploadFilesResponse[]` per contract doc), and whether the bundle token (dev token) is authorized (401/403 would mean P5 fails too).

### P2 — `attachmentIds` acceptance on `public/v1` tickets
Using an existing test side ticket (reuse `TICKET-563`'s children from `01-02-probe-findings.md`, or create a fresh probe ticket), and the attachment `id` returned by P1:
```bash
curl -s -X PATCH "https://api.grispi.net/public/v1/tickets/<SIDE-TICKET-KEY>" \
  -H "tenantId: gsocial-test" \
  -H "Authorization: Bearer $REACT_APP_DEV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment":{"body":"[TEST] Faz4 ek probe","publicVisible":true,"creator":[{"key":"us.email","value":"<agent-email>"}],"attachmentIds":[<id-from-P1>]}}' \
  -w "\nHTTP_STATUS:%{http_code}\n"
```
→ Confirms `public/v1` accepts `attachmentIds` inside `comment` (contract doc only verified this on grispi-ui's `/v2` endpoint). If rejected, inspect the error body shape for the actual accepted field name.

### P3 — `?inline=true` support + `inline` echoed back
```bash
curl -s -X POST "https://api.grispi.net/public/v1/attachments/upload?inline=true" \
  -H "tenantId: gsocial-test" \
  -H "Authorization: Bearer $REACT_APP_DEV_TOKEN" \
  -F "files=@/tmp/probe-image.png;type=image/png" \
  -w "\nHTTP_STATUS:%{http_code}\n"
```
Then attach that id via P2's PATCH pattern and re-`GET` the ticket:
```bash
curl -s "https://api.grispi.net/public/v1/tickets/<SIDE-TICKET-KEY>" \
  -H "tenantId: gsocial-test" -H "Authorization: Bearer $REACT_APP_DEV_TOKEN" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps([c.get('attachments') for c in d.get('comments',[])], indent=2))"
```
→ Confirms whether `?inline=true` is honored on `public/v1` and whether the returned/re-fetched attachment object carries `inline: true` (needed for D-22's explicit non-filtering to be meaningful — if `inline` is never returned, D-22 is a no-op and the plan should note that).

### P4 — Real size ceiling / 413 behavior
```bash
head -c 30000000 /dev/urandom > /tmp/probe-30mb.bin   # ~30MB, exceeds this plugin's own 10MB/file client cap on purpose
curl -s -X POST "https://api.grispi.net/public/v1/attachments/upload" \
  -H "tenantId: gsocial-test" -H "Authorization: Bearer $REACT_APP_DEV_TOKEN" \
  -F "files=@/tmp/probe-30mb.bin;type=application/octet-stream" \
  -w "\nHTTP_STATUS:%{http_code}\n" -o /tmp/probe-30mb-response.json
cat /tmp/probe-30mb-response.json
```
→ Confirms the real server ceiling and the exact error body shape (contract doc notes grispi-ui has "no special 413 handling, generic failure toast" — this plugin's D-07 retry-chip UX needs to know if the body carries a `limitKey` the way the subscription-limit errors do, per contract doc §1 "Limitler").

### P5 — Bundle token authorization
Covered implicitly by P1/P3 (a 401/403 response answers this directly). If P1 succeeds with the dev token but the **plugin-mode bundle token** (obtained via the SDK bridge at runtime, not `.env.development.local`) has narrower scope, this must be re-verified once the phase reaches manual in-panel UAT — flag as a secondary manual check, not a curl probe (the bundle token isn't obtainable outside the live iframe).

### P6 — Actual email delivery with attachment + inline image rendering
Not curl-able — requires a **live send** followed by checking the recipient mailbox (the existing `gsocial-test-agent` test mailbox pattern referenced in project memory, `uat-dev-server-stale-bundle.md`). Manual steps:
1. Complete P1-P3 to get a confirmed working upload+bind flow.
2. Send one side-conversation reply with (a) one non-inline attachment and (b) one inline pasted image in the body, to the test mailbox.
3. Open the received email and confirm: attachment appears as a downloadable file attachment (not inline-embedded), and the `<img src="{objectUrl}">` in the body actually loads in the recipient's mail client (note: many mail clients block remote images by default — record whether the email client shows a "show images" prompt, since `objectUrl` is a live remote URL, not an embedded `cid:` attachment).
→ **This determines whether COMP-08's "gönderilen mesajda inline kalır" success criterion is achievable as specified**, or whether it will visually depend on the recipient's remote-image-blocking settings — an inherent email-client limitation outside this plugin's control, but worth documenting explicitly in the phase's UAT script so it isn't mistaken for a bug.

## Integration Pitfalls Specific to This Codebase

### #1 — `editorProps.handlePaste` unconditionally returns `true`, preempting FileHandler

**File:** `src/screens/components/rich-text-composer.tsx:277-290`
```ts
handlePaste: (_view, event) => {
  if (disabledRef.current) return true;
  const clipboardHtml = event.clipboardData?.getData("text/html");
  const clipboardText = event.clipboardData?.getData("text/plain") || "";
  const safePaste = sanitizeUntrustedDraftHtml(clipboardHtml || plainTextHtml(clipboardText));
  if (!safePaste) return true;
  editorRef.current?.chain().focus().insertContent(safePaste).run();
  return true;   // ← ALWAYS true, regardless of path taken
},
```
**Confirmed [VERIFIED: codebase read]:** ProseMirror's `EditorView` checks `editorProps` (the `_props` passed directly to `useEditor`) **before** iterating registered plugin props (`FileHandler`'s `handlePaste` is a plugin prop). Since this handler always returns `true`, ProseMirror considers the paste "handled" and never reaches `FileHandler`'s `handlePaste` — **FileHandler's `onPaste` would never fire, even after being correctly configured.**

**Exact fix:**
```ts
handlePaste: (_view, event) => {
  if (disabledRef.current) return true;
  if (event.clipboardData?.files.length) return false; // let FileHandler's plugin-level handlePaste run
  const clipboardHtml = event.clipboardData?.getData("text/html");
  const clipboardText = event.clipboardData?.getData("text/plain") || "";
  const safePaste = sanitizeUntrustedDraftHtml(clipboardHtml || plainTextHtml(clipboardText));
  if (!safePaste) return true;
  editorRef.current?.chain().focus().insertContent(safePaste).run();
  return true;
},
```
**Test-impact:** the existing test `"sanitizes paste before parsing and external restore before synchronization"` in `rich-text-composer.test.tsx:320` constructs `clipboardData` as a plain object literal with only `getData` — it has no `.files` property, so `event.clipboardData?.files.length` evaluates to `undefined?.length` → `undefined`, which is falsy, so the existing test's behavior (falls through to the HTML-paste branch) is **unaffected** by this fix. A new test must add `files: [] `/`files: [aFile]` to the mocked `clipboardData` object to exercise both branches. [VERIFIED: read the exact test mock shape]

### #2 — `http-handler.ts` hardcodes `Content-Type: application/json`

**File:** `src/grispi/client/http-handler.ts:26-39`. Already covered in full with a verified failure repro and exact fix under **Architecture Patterns → Pattern 1** above. Summary: add `HttpHandler.sendMultipart()` that builds its `fetch` call with `headers: { ...extraHeaders }` only — never spreading `this.headers` (which always carries the default JSON content-type) — so the browser can set its own multipart boundary.

### #3 — `html-sanitizer.ts` forbids `img` in both `FORBID_TAGS` and `FORBID_CONTENTS`; `src` is not `ALLOWED_ATTR`

**File:** `src/lib/html-sanitizer.ts:24-53`. Confirmed live: `img` is in the shared `DROP_WITH_CONTENT` array, assigned to **both** `FORBID_TAGS` and `FORBID_CONTENTS` in `SANITIZE_CONFIG`; `ALLOWED_ATTR` is `["href"]` only (no `src`). One `sanitizeHtml()` function currently serves **every** boundary (incoming remote HTML, authored draft, restored draft) with this single policy.

**Required two-policy split (per D-14/D-21/UI-SPEC §8):**
```ts
// New: an authored-content variant that permits img+src for https:// URLs only.
// Keep the existing `SANITIZE_CONFIG`/`sanitizeHtml` untouched — used for ALL incoming/remote HTML.
const AUTHORED_ALLOWED_TAGS = [...ALLOWED_TAGS, "img"];
const AUTHORED_SANITIZE_CONFIG: Config = {
  ...SANITIZE_CONFIG,
  ALLOWED_TAGS: AUTHORED_ALLOWED_TAGS,
  ALLOWED_ATTR: ["href", "src", "alt"],
  // FORBID_TAGS/FORBID_CONTENTS must DROP "img" from DROP_WITH_CONTENT for this policy only —
  // svg stays forbidden in BOTH policies (D-10).
  FORBID_TAGS: DROP_WITH_CONTENT.filter((tag) => tag !== "img"),
  FORBID_CONTENTS: DROP_WITH_CONTENT.filter((tag) => tag !== "img"),
};

export function sanitizeAuthoredHtml(input: string): string {
  // Same DOMPurify.sanitize(...) call as sanitizeHtml but with AUTHORED_SANITIZE_CONFIG,
  // PLUS a post-pass that strips any <img src> not matching /^https:\/\//i (no data:, no http:) —
  // ALLOWED_URI_REGEXP already restricts to https/mailto, so `src="https://..."` passes without a
  // separate data: allowance (contract doc §1 explicitly notes "data: açmaya gerek YOK").
}
```
**No `data:` URI opening required** — Grispi's `objectUrl` is always `https://`, and `SANITIZE_CONFIG.ALLOWED_URI_REGEXP` (`/^(?:https?:\/\/|mailto:)/i`) already passes it once `img`/`src` are allowed in the authored policy.

**`onUpdate` debounce needed:** `rich-text-composer.tsx:292-298`'s `onUpdate` calls `sanitizeHtml(currentEditor.getHTML())` (soon `sanitizeAuthoredHtml`) on **every keystroke**. Once inline images are possible, `getHTML()` payloads grow (base64 placeholder or long `objectUrl` strings), so a debounce (~300ms, matching the contract doc's own recommendation) should wrap this call — otherwise every keystroke re-parses a potentially large DOM tree. [ASSUMED — recommend confirming empirically with a large pasted screenshot whether this is perceptibly slow before committing to a specific debounce value; 300ms is the contract doc's suggested starting point]

**Existing tests requiring updates (grep-confirmed list):**
- `src/screens/components/__tests__/rich-text-composer.test.tsx:320` (`"sanitizes paste before parsing..."`) — currently asserts `editor().querySelector("img")` is `null` after a paste containing `<img src=x onerror=steal()>`. This assertion is about the **incoming/draft-restore policy** (`sanitizeUntrustedDraftHtml`), which is untouched by this split — the test should still pass unmodified, but a **new** test must be added asserting the authored-content path (`sanitizeAuthoredHtml`) permits a `https://` `img src` while still stripping `onerror`/`javascript:`/`data:` variants.
- Any existing `html-sanitizer.test.ts` suite covering `sanitizeHtml`'s `FORBID_TAGS` list must gain a parallel `describe` block for the new `sanitizeAuthoredHtml` export, explicitly re-asserting `svg` stays forbidden in both policies (D-10) and `data:`/`javascript:` `src` values are stripped in the authored policy too (DOMPurify's `ALLOWED_URI_REGEXP` handles this, but assert it directly since it's now a security-load-bearing behavior it wasn't before).
- `thread-message.tsx` renders `bodyHtml`/`quotedHtml` via the **existing** (unmodified) `sanitizeHtml` — confirms D-21 (incoming body images never render) requires **no change** to that component; only the composer's outbound path and the new attachment-rendering block (separate from `dangerouslySetInnerHTML`) change.

### #4 — Envelope `deepFreeze` + retry replay, and `normalizeComment` dropping `attachments`

**File:** `src/store/active-conversation-store.ts:19-27` (`deepFreeze`), `376-391` (`bindCreatedTicket`), full envelope lifecycle. **Confirmed [VERIFIED: codebase read]:** `startNew`/`sendReply` build `request` (a `CreateTicketRequest`/`ReplyTicketPatchRequest`) and immediately `deepFreeze()` the whole envelope, including `request.comment`. `getRetryEnvelope()` returns the **same frozen object reference** for retry — `mutationStarted`/`mutationFailed`/`mutationAccepted` never mutate `envelope.request`, only the separate `MessageVM` overlay.

**What this means for `attachmentIds`:** because the attachment id list must be computed via D-16's garbage-collection pass (which ids' `objectUrl` still appear in the final body HTML) **before** the envelope is constructed, `attachmentIds` becomes just another frozen field on `request.comment`, exactly like `body`/`publicVisible`/`creator` today. **No special-casing is needed in the retry path** — retry already replays the identical frozen `request`, and since attachment ids don't change after a message has been queued (uploads already completed, GC already run once at submit-time), replaying the same `attachmentIds` array on retry is the **correct** behavior, not a bug. This is a genuine simplification, not a gap: the existing deepFreeze/retry design already handles the new field correctly with zero code changes to the retry mechanism itself — only the envelope **construction** call site (`startNew`/`sendReply` in `ActiveConversationStore`, and the request-building code in `ComposeStore`) needs to accept and pass through an `attachmentIds` array.

**One real gap:** `envelopeBody()`/`envelopeCreator()` (lines 133-143) are used by `reconcileCanonical()` to match an accepted optimistic overlay against the canonical `getTicket()`-derived message (by comparing sanitized body + creator email). This reconciliation does **not** compare `attachmentIds` — which is fine (attachments aren't expected to change the reconciliation match), but worth noting explicitly so the plan doesn't try to add attachment-id comparison to `reconcileCanonical` unnecessarily.

**`normalizeComment` gap (THRD-06):** `src/query/side-conversation-queries.ts:411-435`. Confirmed live: `Comment.attachments: Attachment[]` **is already present** on the type (`src/types/grispi.type.ts:30-44`, currently `interface Attachment` **not exported**) and is **already returned by `getTicket()`** (no new fetch needed) — but `normalizeComment()` builds its `MessageVM` return object without ever reading `comment.attachments`, silently dropping it. Exact fix:
```ts
// src/types/grispi.type.ts — export the existing interface, unchanged shape
export interface Attachment {
  id: number;
  filename: string;
  objectKey: string;
  objectThumbKey: string;
  bucket: string;
  mimeType: string;
  size: number;
  userId: number;
  objectThumbUrl: string;
  objectUrl: string;
  // NOTE: no `inline` field observed on this interface today — P3's probe must confirm
  // whether GET /tickets/{key} actually echoes `inline` on each attachment object; if not,
  // D-22's "don't filter inline" is moot (nothing to filter) but the field should still be
  // added optionally (`inline?: boolean`) to avoid a silent `any`-cast later.
}
```
```ts
// src/store/active-conversation-store.ts — MessageVM gains:
attachments?: Attachment[];
```
```ts
// src/query/side-conversation-queries.ts — normalizeComment gains one line:
return {
  id: `comment-${comment.id}`,
  // ...unchanged fields...
  attachments: comment.attachments?.length ? comment.attachments : undefined,
};
```
D-22 then means: **do not add any `.filter((a) => !a.inline)` call anywhere in this projection or in `ThreadMessage`** — the entire fix for THRD-06 is (a) export the type, (b) project the field through, (c) render it in `ThreadMessage` unconditionally.

### #5 — `useEditor` deps array is `[]`

**File:** `rich-text-composer.tsx:300` — `useEditor({...}, [])`. **Confirmed [VERIFIED: codebase read]:** the empty deps array means Tiptap's `useEditor` hook creates the `Editor` instance exactly once per mount; none of the closures captured inside `editorProps`/`onUpdate` at creation time are ever "fresh" on subsequent renders — this is why the component already uses the `onChangeRef`/`onSubmitRef`/`disabledRef`/`editorRef` mirror pattern (assigning `.current` on every render, read inside the frozen closures) instead of relying on the deps array.

**Impact for attachment state:** any new callback the composer needs inside `editorProps`/extensions that depends on fresh attachment-store state (e.g., FileHandler's `onPaste` callback needing to call the current attachment store's `addInlineUpload()` method) **must follow the same ref-mirror pattern** — e.g. `const attachmentStoreRef = useRef(attachmentStore); attachmentStoreRef.current = attachmentStore;` and read `attachmentStoreRef.current` inside `FileHandler.configure({ onPaste: (editor, files) => attachmentStoreRef.current.startInlineUpload(...) })`. Do not add `attachmentStore` (or any prop it depends on) to the `useEditor` deps array — that would recreate the entire `Editor` instance (destroying undo history, focus, selection) every time attachment state changes, which happens constantly during an upload.

### #6 (newly discovered, not in the original brief) — FileHandler's `handleDrop` early-return and the drop-routing race

**Source-verified by extracting `@tiptap/extension-file-handler@2.27.2`'s actual `dist/index.js`:**
```js
handleDrop(_view, event) {
  if (!onDrop) { return false; }          // ← if onDrop unset (our case, D-13), ALWAYS false, no preventDefault
  if (!event.dataTransfer?.files.length) { return false; }
  ...
  event.preventDefault();
  event.stopPropagation();
  onDrop(editor, filesArray, dropPos?.pos || 0);
  return true;
},
```
[VERIFIED: extracted and read `node_modules`-equivalent `dist/index.js` from `npm pack @tiptap/extension-file-handler@2.27.2`]

**Why this matters:** because D-13 intentionally leaves `FileHandler`'s `onDrop` option unconfigured, its `handleDrop` plugin prop **immediately returns `false` with zero side effects** (no `preventDefault`, no `stopPropagation`) for every file drop onto the editor. That means routing "drop → attachment, never inline" depends entirely on `react-dropzone`'s own `onDrop` (bound to an ancestor `<section>` per UI-SPEC §2) reliably intercepting the native `drop` event before any default browser/ProseMirror behavior inserts the file into the contenteditable. `react-dropzone` does call `event.preventDefault()` internally, and `@tiptap/starter-kit`'s bundled `Dropcursor` extension (confirmed present, `dropcursor` not disabled in this composer's `StarterKit.configure(...)` call) only manages a visual drop-position indicator — it does not itself insert files.

**Recommended defensive fix (ASSUMED — ProseMirror/browser default-drop-into-contenteditable behavior was not exhaustively re-derived from ProseMirror's own source in this pass; ~15 minutes of empirical dev-server drag-drop testing should confirm/refute before relying on react-dropzone's event-ordering alone):**
```ts
// rich-text-composer.tsx editorProps — new, parallel to the existing handlePaste fix
handleDrop: (_view, event) => {
  if (event.dataTransfer?.files.length) return true; // always "handled" — never let PM/FileHandler touch a file drop
  return false; // non-file drags (e.g. internal text drag) keep default ProseMirror behavior
},
```
This guarantees deterministic behavior regardless of DOM event-ordering nuances between `react-dropzone`'s ancestor listener and the editor's own native `drop` target-phase handling, and is the direct structural mirror of pitfall #1's fix (there, `handlePaste` needed to *release* control to a plugin; here, `handleDrop` needs to *retain* control so no plugin/native behavior can act on a file drop). **Verify empirically** during implementation: drag an image onto the editor text area and confirm it never appears inline, only as a chip via `react-dropzone`'s handler — this is a 1-minute local dev-server check, not a live-API probe.

**Related documented FileHandler nuance (source-verified, informational, accept as-is for MVP):** in `handlePaste`, when `event.clipboardData.getData('text/html').length > 0` (some GIF/WEBM clipboard payloads carry both files and HTML), FileHandler **still calls `onPaste(...)`** (upload starts) but then **returns `false`** instead of `true`, deliberately falling through so "other extensions handle the incoming html via their inputRules" [VERIFIED: source comment, `dist/index.js`]. Combined with pitfall #1's fix (`handlePaste` in `editorProps` also returns `false` when `clipboardData.files.length`), this specific edge case could result in the pasted GIF/WEBM being inserted **twice** — once via the upload-placeholder flow, once via whatever HTML-paste-insertion path picks up the fallthrough. This is a narrow, format-specific edge case (most OS clipboard "copy image" actions produce a plain bitmap `File` with no accompanying `text/html`); recommend accepting it as a known MVP limitation rather than adding special-case handling, and note it explicitly in the plan so a future bug report about "pasted GIF shows twice" isn't a mystery.

## Tiptap FileHandler + Image Wiring

**Version confirmation:** `@tiptap/extension-file-handler@2.27.2` (via `v2-latest` dist-tag) and `@tiptap/extension-image@2.27.2` both match the installed `@tiptap/core`/`@tiptap/react`/`@tiptap/starter-kit@2.27.2` exactly [VERIFIED: `npm view` version/peerDependencies as documented in Standard Stack]. `@tiptap/extension-text-style` peer (required by FileHandler) is already present transitively at `2.27.2` [VERIFIED: `node_modules` inspection]. No v3 migration risk if the exact pin is used (never a bare/`^` semver range for `@tiptap/extension-file-handler` specifically, since its `latest` tag resolves to the incompatible v3 line).

**`allowedMimeTypes` matching is a literal `Array.includes(file.type)` check** [VERIFIED: source, `filesArray.filter(file => allowedMimeTypes.includes(file.type))`] — no wildcard (`image/*`) support. Must enumerate every accepted MIME string explicitly.

**Recommended paste-only configuration** (D-13 — no `onDrop` passed):
```ts
import FileHandler from "@tiptap/extension-file-handler";
import Image from "@tiptap/extension-image";

// Added to the existing `extensions: [...]` array in useEditor's config, alongside
// StarterKit/Link:
Image.configure({
  HTMLAttributes: { class: "rich-text-content-image" }, // matches UI-SPEC §8's .rich-text-content img rule
  allowBase64: false, // never persist base64 into editor state beyond the transient local placeholder
}),
FileHandler.configure({
  allowedMimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
  // image/svg+xml deliberately excluded here — recommendation only (ASSUMED, not
  // locked by CONTEXT.md), for consistency with the uniform "no SVG preview
  // anywhere" rule already established for attachment chips (UI-SPEC §5/§9),
  // even though an <img src> reference to an SVG is script-safe per contract doc.
  onPaste: (currentEditor, files, htmlContent) => {
    if (htmlContent) return; // defer to FileHandler's own documented fallthrough (pitfall #6)
    files.forEach((file) => attachmentStoreRef.current.startInlinePaste(currentEditor, file));
  },
  // onDrop intentionally NOT configured (D-13) — see Integration Pitfall #6 for why a
  // separate editorProps.handleDrop guard is still recommended.
}),
```
`attachmentStoreRef.current.startInlinePaste` is where the local blob-URL placeholder insertion (`editor.chain().focus().setImage({ src: localBlobUrl, "data-uploading": "true" }).run()` — using the new `Image` extension's `setImage` command) and the `Attachments.upload(file, { inline: true })` call live; on success, swap the node's `src` attribute to the returned `objectUrl` via `editor.chain().updateAttributes("image", { src: objectUrl }).run()` targeted at the placeholder's position (Tiptap's `Image` node supports arbitrary extra attributes like `data-uploading` if declared via `addAttributes()` on a thin extended `Image` subclass, or tracked externally by node position — implementation detail left to the planner, both are valid, standard Tiptap patterns).

## sonner Toast Under CRA + React 18

**Install path verified:** `npx shadcn@latest add sonner` resolves against this project's `components.json` (`style: new-york`, `base: radix`/baseColor `slate`, `cssVariables: true`, `rsc: false`) [VERIFIED: `npx shadcn info` output matches `components.json`]. shadcn's registry entry for `sonner` declares two npm dependencies: `sonner` and **`next-themes`** [VERIFIED: fetched `https://ui.shadcn.com/r/styles/new-york/sonner.json` directly], plus this generated wrapper:
```tsx
"use client"
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"
type ToasterProps = React.ComponentProps<typeof Sonner>
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  return (
    <Sonner theme={theme as ToasterProps["theme"]} className="toaster group" toastOptions={{...}} {...props} />
  )
}
export { Toaster }
```

**Two things to fix before this is production-appropriate for this project:**
1. **The `"use client"` directive prologue is harmless under CRA/craco/Babel** — it's just a string-literal expression statement that Next.js's compiler treats specially and every other toolchain (including this project's `react-scripts`/`craco` Babel pipeline) silently ignores. No build failure expected. [ASSUMED — not independently build-tested in this research pass; low risk given directive prologues are valid ES2015+ syntax everywhere]
2. **`next-themes` is unnecessary and should be stripped**, not installed. This project has exactly one theme — "her zaman açık tema" (always-light) per `CLAUDE.md` project constraints — there is no theme toggle anywhere in the codebase to justify a theme-context dependency. Recommended replacement, deleting the `next-themes` import entirely:
```tsx
import { Toaster as Sonner } from "sonner";
type ToasterProps = React.ComponentProps<typeof Sonner>;
const Toaster = (props: ToasterProps) => (
  <Sonner theme="light" className="toaster group" toastOptions={{ ...UI_SPEC_TOAST_CLASSNAMES }} {...props} />
);
export { Toaster };
```
Then `npm uninstall next-themes` (or simply never run its install — edit `package.json`/remove it before `npm install` if the CLI already added it). `sonner` itself has no other peer beyond `react`/`react-dom ^18||^19` [VERIFIED: `npm view sonner peerDependencies`], both satisfied by this project's React 18.3.1.

**Mount requirement inside the 372px panel:** exactly one `<Toaster />` at the app's root render tree (not per-screen) — UI-SPEC §7 already specifies `position="top-center"` with a width clamp (`max-w-[340px]`) and a top offset clearing the fixed header, which works correctly because `sonner`'s toast container uses `position: fixed` relative to the **iframe's own document** (each iframe has an independent viewport/stacking context), so there is no cross-frame positioning concern — a `fixed`-positioned element inside this plugin's iframe is scoped to that iframe exactly as it would be in a normal top-level page. [ASSUMED — standard CSS `position: fixed` semantics inside an iframe are well-established browser behavior, not independently re-verified for this specific plugin's iframe embedding, but consistent with every other `fixed`/`absolute` UI element already working correctly in this codebase per Phase 1-3]

## Common Pitfalls

### Pitfall: Treating `objectUrl` as authenticated
**What goes wrong:** A developer instinctively adds `Authorization` headers or a signed-fetch wrapper before rendering `<img src={objectUrl}>` or opening it in a new tab, assuming it needs auth like every other Grispi API call in this codebase.
**Why it happens:** Every other endpoint in this codebase requires `Authorization`/`tenantId` headers; `objectUrl` is the one exception (contract doc §1: "auth header'sız erişilebilir").
**How to avoid:** Render `objectUrl` directly as a plain `<img src>` / anchor `href` — no fetch wrapper, no header injection. Confirm once during P1/P3 that the returned `objectUrl` truly loads unauthenticated (a quick `curl -I <objectUrl>` with no auth header after P1 is a good spot-check).
**Warning signs:** Broken image icons in the incoming-attachment thumbnail row that only fail in the plugin (not when the same URL is opened directly in a browser tab) — a sign something added an unnecessary auth wrapper.

### Pitfall: Losing the local blob URL memory lifecycle
**What goes wrong:** `URL.createObjectURL(file)` is used for chip thumbnails and inline placeholders (per contract doc's explicit "base64'ü store'da tutma" guidance and UI-SPEC §5) but never `revokeObjectURL`'d, leaking memory across a long agent session with many attach/remove cycles.
**Why it happens:** Easy to forget in a MobX store where chip removal is just an array-filter operation with no obvious "cleanup" hook.
**How to avoid:** Revoke the blob URL in the same store action that removes a chip or resolves an inline-image upload (swap to `objectUrl` + `URL.revokeObjectURL(localBlobUrl)` in the same action), and in a `useEffect`/store-disposal cleanup for any chips still present when the composer unmounts.
**Warning signs:** Chrome DevTools Memory tab showing growing detached `Blob`/`HTMLImageElement` retained size after repeated attach/remove cycles in a long-running dev session.

### Pitfall: MobX `observable.ref`-less large payload proxying
**What goes wrong:** Storing raw `File` objects or large base64 placeholder strings in a `makeAutoObservable`-managed store without `observable.ref`/`observable.shallow` annotations causes MobX to attempt deep-proxy instrumentation of binary/large-string data, which is both wasteful and — for `File`/`Blob` objects specifically — can break their native methods.
**Why it happens:** `makeAutoObservable` defaults to deep observability for anything that looks like a plain object/array; `File` objects are host objects that don't behave predictably once proxied.
**How to avoid:** Follow the contract doc's explicit guidance: mark `File` references and any large payload fields `observable.ref` (or exclude them from the auto-observable set the way `active-conversation-store.ts` already excludes `envelopes`/`matchedCanonicalIds` via the second `makeAutoObservable` argument).
**Warning signs:** `TypeError`s when calling `File`/`Blob` native methods (`.slice()`, `.stream()`) on a value pulled from a MobX-observable store; noticeably slower re-renders when many files are attached.

### Pitfall: Assuming `attachmentIds` field must always be present
**What goes wrong:** Sending `attachmentIds: []` when there are zero attachments, instead of omitting the field entirely.
**Why it happens:** TypeScript-driven habit of always including every declared optional field with its "empty" value.
**How to avoid:** Contract doc is explicit: "boşsa hiç gönderilmiyor (`[]` değil, alan yok)". Build the request body by conditionally spreading `attachmentIds` only when the computed array is non-empty: `{ ...(attachmentIds.length ? { attachmentIds } : {}) }`.
**Warning signs:** P2's probe rejecting the request, or (if the server silently tolerates `[]`) a behavior difference only surfacing much later against a stricter API version.

## Code Examples

### Client-side batch validation (D-08/D-11), pure function, easy to unit test
```ts
// src/lib/attachment-validation.ts (new)
export interface AttachmentRejection {
  file: File;
  reason: "size" | "count" | "total-size";
}
export interface AttachmentValidationResult {
  accepted: File[];
  rejected: AttachmentRejection[];
}

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB, D-08
const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // 25MB, D-08
const MAX_FILE_COUNT = 10; // D-08

export function validateAttachmentBatch(
  existingFiles: readonly File[],
  incoming: readonly File[]
): AttachmentValidationResult {
  const accepted: File[] = [];
  const rejected: AttachmentRejection[] = [];
  let runningTotal = existingFiles.reduce((sum, f) => sum + f.size, 0);
  let runningCount = existingFiles.length;

  for (const file of incoming) {
    if (file.size > MAX_FILE_BYTES) {
      rejected.push({ file, reason: "size" });
      continue;
    }
    if (runningCount + 1 > MAX_FILE_COUNT) {
      rejected.push({ file, reason: "count" });
      continue;
    }
    if (runningTotal + file.size > MAX_TOTAL_BYTES) {
      rejected.push({ file, reason: "total-size" });
      continue;
    }
    accepted.push(file);
    runningTotal += file.size;
    runningCount += 1;
  }
  return { accepted, rejected };
}
```
This is a pure function — trivially unit-testable without any DOM/upload mocking, and matches UI-SPEC §3's exact ordering rule ("earlier files in the batch win").

### D-16 garbage collection at submit (pure function)
```ts
// Given the final sanitized authored body HTML and the current inline-image bucket:
export function collectSurvivingInlineImageIds(
  finalBodyHtml: string,
  inlineImages: readonly { id: number; objectUrl: string }[]
): number[] {
  return inlineImages
    .filter(({ objectUrl }) => finalBodyHtml.includes(objectUrl))
    .map(({ id }) => id);
}
```
Matches the contract doc's exact snippet (`filteredInlineImages`) but extracted as an independently testable pure function rather than inlined into a component.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest `27.5.1` (bundled via `react-scripts@5.0.1`/CRA, invoked through `craco test`) [VERIFIED: `npx jest --version`, `npm ls jest`] |
| Config file | none dedicated — CRA's built-in Jest config via `craco.config.js`; no `jest.config.js` in this repo |
| Test library | **No `@testing-library/react` dependency** [VERIFIED: `package.json` has no `@testing-library/*`; `grep -rn "@testing-library"` across `src` returns zero hits] — all existing component tests use raw `react-dom/client` `createRoot` + `act()` + manual DOM querying (see `rich-text-composer.test.tsx:1-79` for the established pattern). New attachment/toast tests must follow the same pattern, not introduce RTL. |
| Quick run command | `CI=true npx craco test --watchAll=false --testPathPattern=<pattern>` |
| Full suite command | `CI=true npx craco test --watchAll=false` |

**`jest.advanceTimersByTimeAsync` is NOT available under Jest 27.5.1** (added in Jest 29.5). The established project pattern (confirmed live in `src/query/__tests__/side-conversation-queries.test.tsx:349-357`) is:
```ts
async function advanceAndFlush(ms: number): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    for (let index = 0; index < 10; index += 1) {
      await Promise.resolve();
      jest.advanceTimersByTime(0);
    }
  });
}
```
Any new debounce (e.g. the ~300ms `onUpdate` sanitize debounce from Pitfall #3, or an upload-retry debounce if added) must be tested with this exact helper pattern, not `advanceTimersByTimeAsync`.

### Constructing `File`/`FileList`/`DataTransfer`/clipboard-file objects in jsdom

jsdom (the environment CRA's Jest uses) supports the real `File` constructor and a real, usable `DataTransfer` constructor as of the jsdom version bundled with Jest 27/react-scripts 5 — both are exercised directly, no polyfill needed:

```ts
// Constructing a File — works natively in jsdom
function makeFile(name: string, sizeBytes: number, type: string): File {
  const content = new Uint8Array(sizeBytes); // avoid huge real allocations in tests — sizeBytes is enough to trip validation, contents are irrelevant
  return new File([content], name, { type });
}

// Faking a react-dropzone drop: react-dropzone's useDropzone listens for native
// `dragenter`/`dragover`/`drop` DOM events via its getRootProps() handlers (which are plain
// React synthetic event props under the hood) — dispatch real DOM events with a DataTransfer:
function dispatchDrop(target: Element, files: File[]): void {
  const dataTransfer = new DataTransfer();
  files.forEach((file) => dataTransfer.items.add(file));
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  act(() => target.dispatchEvent(event));
}

// Faking a clipboard-file paste (FileHandler's onPaste path) — mirrors the EXISTING
// html-paste test's exact mock shape (rich-text-composer.test.tsx:331-339), extended with files:
function dispatchFilePaste(target: Element, files: File[]): void {
  const paste = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(paste, "clipboardData", {
    value: {
      files,
      getData: () => "", // no accompanying text/html — avoids Pitfall #6's fallthrough branch
    },
  });
  act(() => target.dispatchEvent(paste));
}
```
`DataTransfer.items.add(file)` is supported in modern jsdom (bundled with `jest-environment-jsdom`/CRA 5's jsdom dependency) [ASSUMED — not independently smoke-tested in this research pass by actually running a Jest test in this repo; verify with one throwaway `it()` early in Plan 04's Wave 1 before building the full drop-test suite on top of it, since jsdom's `DataTransfer`/`DragEvent` completeness has historically varied by version].

### Mocking the multipart upload client

Follow the exact existing `HttpHandler.send` test pattern (`src/grispi/client/__tests__/http-handler.test.ts:1-12`, `jest.spyOn(global, "fetch")`), extended to assert the multipart contract:
```ts
it("omits Content-Type entirely so the browser sets the multipart boundary", async () => {
  const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true, status: 200, json: () => Promise.resolve([{ id: 1, objectUrl: "https://x/y.png" }]),
  } as unknown as Response);

  await handler.sendMultipart("public/v1/attachments/upload", new FormData(), { tenantId: "t", Authorization: "Bearer x" });

  const [, options] = fetchSpy.mock.calls[0];
  expect(Object.keys(options?.headers ?? {})).not.toContain("Content-Type");
});
```

### What is unit-testable vs. what needs a live/human check

| Area | Automated (unit/component) | Needs live/human check |
|---|---|---|
| Batch size/count/total validation (D-08/D-11) | Yes — pure function, `validateAttachmentBatch` | — |
| D-16 GC pure function | Yes — pure function | — |
| `HttpHandler.sendMultipart` header omission | Yes — `fetch` spy, assert no `Content-Type` key | — |
| `handlePaste` files-present short-circuit (Pitfall #1) | Yes — extend existing paste test with `files` in mock `clipboardData` | — |
| `handleDrop` file-present short-circuit (Pitfall #6) | Yes — dispatch a `drop` event with `DataTransfer` containing a file, assert editor content unchanged | — |
| FileHandler `onPaste` → upload-store call | Yes — mock `Attachments.upload`, dispatch file paste, assert store method invoked with the file | — |
| Sanitizer authored-policy `img`/`src` allow + XSS strip (Pitfall #3) | Yes — extend `html-sanitizer.test.ts` | — |
| `normalizeComment` attachment projection (Pitfall #4/THRD-06) | Yes — feed a `Comment` fixture with `attachments`, assert `MessageVM.attachments` matches | — |
| `ActiveConversationStore` envelope carrying `attachmentIds` through freeze+retry | Yes — extend existing envelope tests (`active-conversation-store.test.ts`) | — |
| Chip UI states (idle/uploading/failed) rendering | Yes — `createRoot`+`act` pattern, mock the upload promise | — |
| `sonner` toast firing on rejection/failure | Partial — assert the store/handler calls `toast.error(...)` (mock `sonner`'s `toast` export); **actual visual rendering/positioning inside the 372px iframe is a manual check** | Manual: confirm toast doesn't obscure composer at 372px |
| Real multipart upload against `gsocial-test` tenant | No | **Yes — P1/P3/P4 curl probes** |
| `public/v1` `attachmentIds` acceptance | No | **Yes — P2 curl probe** |
| Real email delivery with attachment + inline image render in recipient client | No | **Yes — P6 manual send + mailbox check** |
| Plugin-mode bundle token authorization for `/attachments/upload` | No (dev token ≠ bundle token) | **Yes — manual in-panel UAT once deployed, P5** |
| Drop-routing race (Pitfall #6, does react-dropzone win the ordering race even without the `handleDrop` guard) | Partial — jsdom event dispatch order may not perfectly replicate real-browser native/synthetic ordering | Recommend a 1-minute manual dev-server drag-drop check regardless of what the unit test shows |

### Sampling/validation requirements per success criterion

1. **SC1 (multi-file attach, list with preview, individually removable)** — unit: `validateAttachmentBatch`, chip render states, remove-button focus restoration (per UI-SPEC §Accessibility). Component: full attach→list→remove flow via `createRoot`+`act`.
2. **SC2 (upload + `attachmentIds` bind + real email delivery)** — unit: `sendMultipart` header contract, envelope carrying `attachmentIds`. Live: P1/P2/P4 curl probes (upload+bind mechanics) + P6 manual send (actual email delivery — cannot be automated).
3. **SC3 (paste → inline → survives to sent message)** — unit: FileHandler `onPaste` wiring, placeholder→`objectUrl` swap, D-16 GC pure function, authored-sanitizer `img` allow. Live: P3 (`?inline=true` + `inline` echo) + P6 (does the `<img>` actually render in the recipient's mail client — inherently mail-client-dependent, document as a known limitation not a bug).
4. **SC4 (incoming attachments visible + openable)** — unit: `normalizeComment` projection, `ThreadMessage` rendering both thumbnail and chip rows, D-22 non-filtering. Live: none required beyond what P2/P3 already exercise (attachments already flow through the existing `getTicket` response — this is a pure rendering fix once P1-P3 confirm the upload/bind mechanics work at all).

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Unchanged — this phase adds no new auth surface; bundle token reused as-is |
| V3 Session Management | No | No session model changes |
| V4 Access Control | No | No new role/permission surface; upload endpoint authorization is Grispi-server-side (P5 confirms token scope) |
| V5 Input Validation | Yes | Client-side batch validation (`validateAttachmentBatch`) is UX-only; DOMPurify authored-content policy (Pitfall #3) is the actual security boundary for any HTML this phase produces |
| V6 Cryptography | No | No new crypto surface |
| V12 File Handling (ASVS extended category, ~equivalent to OWASP File Upload Cheat Sheet) | Yes | See Known Threat Patterns below |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| SVG upload → stored XSS (real-world precedent cited in contract doc: FreeScout helpdesk) | Tampering / Elevation of Privilege | D-10: never render SVG via `<object>`/`<iframe>`/inline `<svg>` markup anywhere in the plugin — `<img src>` reference only (browsers refuse to execute `<script>` inside an SVG loaded as an `<img>`); enforced uniformly across composer chips and thread-render per UI-SPEC §5/§9 (stricter than D-10's literal minimum, by design) |
| MIME/extension spoofing (`.png` file that is actually `image/svg+xml`, or any executable disguised with a benign extension) | Tampering | Client-side MIME/type checks are UX only, never security (contract doc §1 explicit); server is the authority. This plugin does not attempt content-sniffing validation — that's out of scope and would be redundant with server-side checks |
| XSS via authored-content sanitizer regression when `img`/`src` is newly allowed (Pitfall #3) | Tampering / Information Disclosure | New `sanitizeAuthoredHtml` policy must be tested explicitly for `<img src="javascript:...">`, `<img src="data:...">`, `<img onerror=...>` — DOMPurify's `ALLOWED_URI_REGEXP` already restricts `src`-bearing tags to `https?://\|mailto:`, but this needs a directly-asserted test now that `img` is allowed for the first time (previously irrelevant since `img` was fully forbidden) |
| Filename-as-untrusted-input (path traversal chars, control characters, overlong names in the UI) | Tampering / Denial of Service (UI) | Render filenames as text only (`{file.name}` in JSX, never `dangerouslySetInnerHTML`) — already the plan per UI-SPEC's explicit "Filenames are untrusted input" accessibility note; no additional sanitization needed since React's default text-node escaping is sufficient for a *rendering* context (not a filesystem-path context, since this plugin never writes to a local filesystem) |
| Information disclosure via unauthenticated `objectUrl` (attacker who obtains a leaked `objectUrl` can view the attachment with no auth) | Information Disclosure | Accepted risk, inherited from Grispi's own API design (contract doc confirms `objectUrl` is intentionally unauthenticated so `<img src>`/`window.open` work without a signed-fetch wrapper) — not something this plugin can mitigate client-side; flag to the Grispi platform team is out of this phase's scope (contract doc §"Güvenlik notları" already suggests verifying `Content-Disposition: attachment` + separate-origin server-side, which is a Grispi-team action item, not a plugin code change) |
| Orphaned/unbounded server-side storage from abandoned drafts (D-05/D-17's accepted tradeoff) | Denial of Service (storage) | Explicitly accepted risk per D-17 — no plugin-side mitigation; deferred to Grispi server-side cleanup (already logged in CONTEXT.md's Deferred Ideas) |
| Supply-chain risk from three `SUS`-flagged (false-positive "too-new") packages | Tampering (supply chain) | Package Legitimacy Audit above — pin exact verified versions, no `^`/`latest` ranges for `@tiptap/extension-file-handler` specifically (its `latest` tag is a breaking v3), `checkpoint:human-verify` before install per protocol |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `react-dropzone@19.1.1` engines requirement (`>=20`) | Yes | v22.12.0 | — |
| npm registry access | `npm install` of the three new packages + `npx shadcn add sonner` | Yes (verified live via `npm view` throughout this research session) | — | — |
| Live `gsocial-test` tenant + `REACT_APP_DEV_TOKEN` | P1-P4 curl probes | Presumed yes — same credential already used successfully in Phase 1/2 probes (`.env.development.local`) | — | — |
| Test mailbox for P6 | Manual email-delivery verification | Referenced in prior-session project memory (`gsocial-test-agent` pattern) — availability to be confirmed by the human running the checkpoint, not verifiable from this research session | — | If unavailable, P6 must be deferred to a later manual UAT pass and explicitly flagged `DEFERRED — NOT TESTED` in the phase's final verification, matching the precedent already set in Phase 03.1's roadmap entry for its own deferred live-mailbox UAT |

No missing dependencies with no fallback — every dependency in this phase is either already present, cheaply installable, or has an explicit manual-deferral fallback.

## Assumptions Log

| # | Claim | Section | Status | Risk if Wrong |
|---|-------|---------|--------|---------------|
| A1 | `public/v1/attachments/upload` is the correct prefix (vs. root `attachments/upload`) | Live-Probe Design P1 | NEEDS-PROBE | Upload client hits 404 for every attempt until fixed; blocks all of COMP-05/COMP-08 |
| A2 | `public/v1` tickets endpoints accept `comment.attachmentIds` the same way grispi-ui's `/v2` family does | Live-Probe Design P2 | NEEDS-PROBE | Uploads succeed but never bind to the message; silent data loss (uploaded file, unattached to any comment) |
| A3 | `?inline=true` is supported on `public/v1` and `inline` is echoed back on the attachment object | Live-Probe Design P3 | NEEDS-PROBE | If unsupported, D-22's explicit non-filtering becomes moot (nothing to filter); inline paste flow may need a fallback design |
| A4 | Real server size ceiling and 413 error-body shape | Live-Probe Design P4 | NEEDS-PROBE | D-07's retry-chip UX may show a misleading "network error" for what is actually a size-rejection the client's own 10MB cap should have already caught (defense-in-depth mismatch) |
| A5 | Plugin-mode bundle token is authorized for `/attachments/upload` (vs. only the dev token tested by P1) | Live-Probe Design P5 | NEEDS-PROBE (secondary, manual in-panel) | Feature works in dev but fails silently/403s in production plugin mode |
| A6 | Attached files actually arrive as email attachments, and inline `<img src=objectUrl>` renders in a recipient's real mail client | Live-Probe Design P6 | NEEDS-PROBE | Both COMP-05's "alıcı ekleri e-postayla alır" and COMP-08's "gönderilen mesajda inline kalır" success criteria are unverifiable without this; remote-image-blocking by the recipient's mail client is an inherent, undocumented-until-now UX caveat |
| A7 | `handleDrop` needs an explicit `editorProps` guard (mirroring the `handlePaste` fix) to reliably prevent any native/ProseMirror file-drop insertion, rather than relying solely on `react-dropzone`'s event-ordering | Integration Pitfall #6 | ASSUMED — reasoned from FileHandler source + established codebase pattern, not empirically re-derived from ProseMirror's own default-drop-handling source | If wrong (i.e., react-dropzone's ordering is already sufficient), the extra guard is harmless defensive code, not a functional regression — low risk either way, but worth the ~1 line to add |
| A8 | `onUpdate`'s per-keystroke `sanitizeAuthoredHtml` call needs a ~300ms debounce once inline images are possible | Integration Pitfall #3 | ASSUMED | If wrong (no perceptible slowdown), the debounce adds a small, harmless latency to draft state propagation; if the debounce is *skipped* and it turns out to matter, typing near a large pasted image could visibly lag |
| A9 | `AbortController` upload cancellation should NOT be added this phase | User Constraints — Claude's Discretion | ASSUMED (recommendation) | If the team wants cancel-on-remove UX now rather than later, this recommendation under-scopes the phase; low risk since CONTEXT.md already lists it as a legitimate deferred item, this research just adds a recommendation, not a decision |
| A10 | `next-themes` should be stripped from the shadcn-generated `sonner.tsx` wrapper rather than installed and wired to a real theme provider | sonner Toast Under CRA | CONFIRMED (registry JSON directly inspected) that `next-themes` is what the CLI installs; the *recommendation* to strip it is reasoned from CLAUDE.md's "always-light theme" constraint, not independently probed | If wrong (project later wants a real theme toggle), re-adding `next-themes` + a `ThemeProvider` is a small, additive change — no rework of the toast content/positioning logic |
| A11 | jsdom's `DataTransfer`/`DataTransfer.items.add` is fully usable in this repo's exact jsdom version for simulating `react-dropzone` drops | Validation Architecture | ASSUMED — not run in this repo during this research session | If wrong, drop-simulation tests need a lower-level workaround (e.g., directly invoking `useDropzone`'s internal `onDrop` callback via a test-only prop rather than dispatching a real `DragEvent`) — recommend the one throwaway smoke test called out in that section before building the full suite on top of it |
| A12 | `"use client"` directive prologue in the shadcn-generated `sonner.tsx` causes no CRA/craco/Babel build issue | sonner Toast Under CRA | ASSUMED | If wrong (unlikely — it's valid ES2015+ syntax), the fix is a one-line deletion of the directive string; would surface immediately as a build failure, not a silent bug |

**If this table is empty:** N/A — twelve assumptions logged; six (A1-A6) are the phase-opening live-API probes already scheduled as a blocking checkpoint task, six (A7-A12) are lower-risk implementation recommendations the planner should carry forward but that don't block starting work.

## Open Questions

1. **Does the phase's opening checkpoint (P1-P5) reuse the existing `TICKET-563` test-parent side tickets from Phase 1, or should it create fresh probe tickets?**
   - What we know: `01-02-probe-findings.md` documents 13 existing side tickets under `TICKET-563` with known states; several are `Closed` and therefore immutable (`"Closed ticket 'X' cannot be updated"`, 422).
   - What's unclear: whether reusing an `Open`/`Solved`-but-reopenable one (e.g. `TICKET-564`) is preferable to creating a fresh throwaway probe ticket, to avoid polluting the existing badge-variety fixture set documented there.
   - Recommendation: create one fresh probe ticket via `createTicket` (already available from Phase 2) specifically for P2/P3, leaving the curated fixture set untouched — mirrors how `02-01-PLAN.md`'s Task 1 probe used ad-hoc test data rather than reusing production-adjacent fixtures.

2. **Does `GET /public/v1/tickets/{key}` echo the `inline` boolean on each `Comment.attachments[]` entry, or only the upload-response payload?**
   - What we know: the contract doc's `UploadFilesResponse` shape (the *upload* response) doesn't list an `inline` field at all — the `inline === true` filtering logic in grispi-ui's incoming-render path must be reading it from somewhere on the **comment-fetch** response, not the upload response.
   - What's unclear: whether this plugin's `public/v1` `Comment.attachments[]` (already typed in `grispi.type.ts`, currently missing an `inline` field) actually carries it.
   - Recommendation: P3's second curl (re-`GET` the ticket after attaching an inline-uploaded file) directly answers this — add the `inline?: boolean` field to `Attachment` only if the probe confirms it's present, otherwise omit it and treat D-22 as a documented no-op for this API version.

3. **Should the ~300ms authored-HTML sanitize debounce (Pitfall #3/A8) be implemented this phase, or is it premature optimization?**
   - What we know: the contract doc recommends it; no current perceptible slowdown exists today (since `img` was never allowed until now, HTML payloads have stayed small).
   - What's unclear: whether a single large pasted screenshot (near the 10MB client cap, though the *inline* placeholder is a local blob URL of bounded string length — the `<img>` tag itself is short regardless of the underlying file size, since `src` is a URL not embedded bytes) actually causes measurable `onUpdate` lag in practice.
   - Recommendation: implement the debounce proactively (cheap, ~5 lines) rather than defer measurement to a later performance-bug report — the contract doc already flags it as a known risk.

## Sources

### Primary (HIGH confidence — directly verified this session)
- `.planning/research/attachment-upload-contract.md` — settled API contract, package decisions, two pre-identified code traps [CITED — canonical settled input per task brief]
- Direct `Read` of `src/screens/components/rich-text-composer.tsx`, `src/grispi/client/http-handler.ts`, `src/grispi/client/authentication.ts`, `src/grispi/client/tickets.ts`, `src/grispi/client/api.ts`, `src/lib/html-sanitizer.ts`, `src/store/active-conversation-store.ts`, `src/query/side-conversation-queries.ts`, `src/types/grispi.type.ts`, `src/screens/components/thread-message.tsx`, `src/screens/components/__tests__/rich-text-composer.test.tsx`, `src/query/__tests__/side-conversation-queries.test.tsx`, `src/grispi/client/__tests__/http-handler.test.ts`, `package.json` [VERIFIED: codebase read]
- `npm view react-dropzone / @tiptap/extension-file-handler / @tiptap/extension-image / sonner / compressorjs` (version, dist-tags, engines, peerDependencies, scripts.postinstall) [VERIFIED: npm registry, live session]
- Extracted and read `@tiptap/extension-file-handler@2.27.2`'s actual published `dist/index.js` via `npm pack` [VERIFIED: npm registry package contents, live session]
- `node -e 'new Headers({"Content-Type": undefined})'` — direct repro of the header-omission failure mode [VERIFIED: local Node execution, live session]
- `https://ui.shadcn.com/r/styles/new-york/sonner.json` — exact shadcn registry payload for the `sonner` component [VERIFIED: WebFetch, live session]
- `npx shadcn info` — confirmed this project's actual shadcn configuration matches `components.json` [VERIFIED: local CLI run, live session]
- `gsd-tools query package-legitimacy check` — verdicts for all five candidate packages [VERIFIED: local tool run, live session]

### Secondary (MEDIUM confidence)
- `.planning/phases/04-dosya-ekleri-ve-inline-g-rseller/04-CONTEXT.md` (22 locked decisions) and `04-UI-SPEC.md` (visual/interaction contract) [CITED: project planning docs]
- `.planning/phases/03-g-r-me-detay-ve-ya-am-d-ng-s/03-RESEARCH.md` — format precedent, prior sanitizer/store pitfalls [CITED: prior-phase research]
- `.planning/phases/02-yeni-yan-g-r-me-ba-latma/02-01-PLAN.md`, `.planning/phases/01-temel-ve-salt-okunur-g-r-me-listesi/01-02-probe-findings.md` — live-probe checkpoint pattern precedent [CITED: prior-phase plans/findings]

### Tertiary (LOW confidence — flagged for validation, see Assumptions Log)
- ProseMirror/browser default native drop-into-contenteditable behavior (A7) — reasoned from source + established pattern, not independently re-derived from ProseMirror core
- CRA/craco tolerance of the `"use client"` directive prologue (A12) — standard JS syntax, not independently build-tested in this repo this session
- jsdom `DataTransfer` completeness in this repo's exact bundled version (A11) — not run this session

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version/peer-dep/license/postinstall fact independently re-verified against the live npm registry this session, not just carried over from the settled contract doc
- Architecture/integration pitfalls: HIGH — every named pitfall is grounded in a direct `Read` of the actual file plus, for #6, a direct read of the actual published extension source (not documentation, the real `dist/index.js`)
- Live-probe design: MEDIUM — the six questions are well-specified and the curl commands are copy-paste-ready, but the *answers* are genuinely unknown until the checkpoint runs (that's the point of the checkpoint)
- Validation architecture: MEDIUM-HIGH — test framework facts (Jest 27.5.1, no RTL, `advanceTimersByTime` pattern) are directly verified against real test files; jsdom `DataTransfer` completeness (A11) is the one unverified link in the chain
- Security domain: HIGH — every threat pattern traces to either a specific locked decision (D-10) or a specific code change this phase introduces (Pitfall #3's sanitizer split)

**Research date:** 2026-07-31
**Valid until:** ~14 days (fast-moving: three of five packages are actively maintained with frequent point releases per the Package Legitimacy Audit's "too-new" false-positive signal; re-verify exact versions if plan execution is delayed beyond that window) — the API-contract portions (P1-P6) have no freshness expiry beyond "until the checkpoint actually runs," since they are explicitly unresolved pending that live probe.
