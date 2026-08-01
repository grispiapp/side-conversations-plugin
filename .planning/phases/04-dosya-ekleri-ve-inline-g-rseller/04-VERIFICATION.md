---
phase: 04-dosya-ekleri-ve-inline-g-rseller
verified: 2026-08-01T05:28:03Z
status: human_needed
score: 2/4 must-haves verified (2 present, behavior-unverified)
behavior_unverified: 2
overrides_applied: 0
behavior_unverified_items:
  - truth: "SC2 — Ekler POST /attachments/upload ile yüklenir ve mesaja comment.attachmentIds ile bağlanır; alıcı ekleri e-postayla alır"
    test: "Recipient mailbox inspection: send a chip attachment AND a pasted inline image in one message against gsocial-test, then open the recipient mailbox and confirm (a) the chip attachment is a real downloadable e-mail attachment and (b) the inline image's attachment id actually round-tripped into comment.attachmentIds (re-fetch the ticket via API and check the inline image's id is present in the comment's attachments list, not just visually present in the body)."
    expected: "Recipient's mail client shows the chip file as a downloadable attachment; the API re-fetch of the sent comment lists the inline image's id in attachments, not only its objectUrl embedded in the body HTML."
    why_human: "Requires inspecting a real external mailbox (P6b) — cannot be done from this session/environment. Additionally, the D-16 GC bug (encoding-insensitive matching, fixed in ca39d1e) was discovered and fixed AFTER the phase-end live UAT that otherwise validated this criterion; the fix has full unit-test coverage but was never re-exercised against a fresh live send, per 04-08-SUMMARY.md's own 'Outstanding' section."
  - truth: "SC3 — Editöre yapıştırılan görsel Grispi'ye yüklenip dönen objectUrl ile editörde inline görünür ve gönderilen mesajda inline kalır"
    test: "Same live send as above: paste an image into the editor, send, and open the message in a real mail client (not just the plugin panel or API re-fetch) to confirm the inline image actually renders inline in the e-mail body."
    expected: "The pasted image appears inline in the body when the message is viewed in an actual e-mail client (Gmail/Outlook/etc.), not only in the plugin's own panel re-render."
    why_human: "P6b (recipient mail-client rendering of inline HTML images) is explicitly recorded as NOT VERIFIED in 04-08-SUMMARY.md — deferred to the user. Panel-side and API-side evidence (image resolves to an https objectUrl, single <img> in stored body) is solid, but mail-client HTML/CSS rendering behavior is a different rendering engine than the plugin's own panel."
---

# Phase 4: Dosya Ekleri ve Inline Görseller Verification Report

**Phase Goal:** Temsilci yan görüşmelere dosya ekleyebilir ve alabilir: yeni görüşmede ve yanıtta çoklu sürükle-bırak/ataç ile ek yükler, editöre yapıştırdığı görsel inline gömülür, karşı tarafın gönderdiği ekleri thread'de görüp açabilir.
**Verified:** 2026-08-01T05:28:03Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Temsilci hem yeni görüşmede hem yanıtta sürükle-bırak veya ataç ikonuyla birden fazla dosya ekler; ekler gönderim öncesi listede (ad, boyut, önizleme) görünür ve tek tek kaldırılabilir | ✓ VERIFIED | `src/screens/components/rich-text-composer.tsx` has the attach toolbar button (`FilePlusIcon`, first `TOOLBAR_ACTIONS` entry), `useDropzone({noClick,noKeyboard})` wrapping the composer root, a collapsible chip panel (1-2 direct / 3+ collapse to `{n} dosya`), and per-chip remove. Wired into BOTH `message-field.tsx` (compose) and `chat-screen.tsx` (reply) via `AttachmentUploadStore.chips/addFiles/removeChip/retryChip`, confirmed independent per-surface. `AttachmentChip` renders filename/size/preview per UI-SPEC. Covered by 28+ unit tests across `rich-text-composer.test.tsx`/`attachment-chip.test.tsx`/`attachment-upload-store.test.ts`; live 372px UAT in 04-08-SUMMARY.md confirms multi-attach, partial rejection toast, and focus-preserving removal all worked in the real panel. |
| 2 | Ekler `POST /attachments/upload` ile yüklenir ve mesaja `comment.attachmentIds` ile bağlanır; alıcı ekleri e-postayla alır | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code/wiring fully present and unit-tested: `src/grispi/client/attachments.ts` posts to the live-probe-confirmed root path `attachments/upload` (no `public/v1` prefix — verified in source, matches 04-01's live A1 finding); `src/grispi/client/tickets.ts` implements the write-path split (`replyTicket`/`createTicket` → `/v2/tickets`, `patchTicket` narrowed to `StatusTicketPatchRequest` on `public/v1`, exactly as documented, with inline doc-comments explaining the D-15/N2 rationale); `compose-store.ts`/`active-conversation-store.ts` conditionally spread `attachmentIds` into `request.comment`. Live API-level proof exists for the **chip-bucket** half (Plan 06 P6a: real `TICKET-591` re-fetch shows two create-time attachments and one reply attachment correctly bound, `publicVisible:true`, addressed to the real recipient — the same delivery mechanism Phase 2 proved live). BUT the **inline-image id-binding** half had a confirmed bug (`collectSurvivingInlineImageIds` never matched entity-encoded body HTML, silently dropping every inline image's id from `attachmentIds`) found during the phase-end UAT and fixed in `ca39d1e` with 5 new regression tests — verified present in `src/lib/attachment-validation.ts` (`decodeHtmlEntities`/`extractObjectKey`/token-match). This fix was **never re-exercised against a fresh live send** (04-08-SUMMARY.md's own "Outstanding" section says so explicitly). Full inbox verification (attachments arriving as real, downloadable e-mail attachments) was also never done — P6b is explicitly recorded as user-pending in every one of the four requirement rows in REQUIREMENTS.md. |
| 3 | Editöre yapıştırılan görsel Grispi'ye yüklenip dönen `objectUrl` ile editörde inline görünür ve gönderilen mesajda inline kalır | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code fully present and unit-tested: `AttachmentUploadStore.uploadInlineImage` (uploads with `{inline:true}`, registers into a separate D-15 bucket, never enters the chip list — confirmed in source); `src/screens/components/inline-image-extension.ts` (`InlineImage` node configured `inline:true` — confirmed load-bearing per Deviation #1 to avoid NodeSelection clobbering — placeholder insert/resolve/remove lifecycle); `rich-text-composer.tsx`'s `handlePaste` releases control when clipboard carries files (Integration Pitfall #1 fix, confirmed present) and `FileHandler.onPaste`/`onDrop` call `startInlineImageUpload`. Sanitizer split (`sanitizeAuthoredHtml` permits `img`+`src`/`alt` for https?/mailto, `stripUnsafeImageSrc` closes DOMPurify's internal `data:` bypass) confirmed present in `src/lib/html-sanitizer.ts` and covered by dedicated attack tests. Live 372px UAT (04-08-SUMMARY.md item 4) confirms the pasted image resolved to an `https://usercontent.grispi.net/...` src with no leftover `blob:`, did not enter the chip list, and a single clean `<img>` (no ProseMirror separator artifact) was found in the stored `TICKET-592` body. What is NOT verified: whether the image actually **renders inline in a real e-mail client** (P6b) — this is explicitly recorded as not verified in this session and deferred to the user. |
| 4 | Görüşmede karşı tarafın gönderdiği ekler mesajla birlikte görünür (görsel önizleme / dosya chip'i) ve açılıp indirilebilir | ✓ VERIFIED | `normalizeComment` (`src/query/side-conversation-queries.ts:448`) projects `comment.attachments` through to `MessageVM.attachments` completely unfiltered (D-22 — confirmed by absence of any `.filter()` call, not an allow-list), fixing a prior silent projection bug. `ThreadMessage`'s `ThreadAttachments` (`src/screens/components/thread-message.tsx:80-`) renders a two-zone block: 72px image thumbnails (excluding SVG, D-10 confirmed via `attachmentKind() !== "image"` split) then read-only `AttachmentChip` pills; every link/thumbnail is a plain `<a target="_blank" rel="noopener noreferrer">` wrapping `objectUrl` directly (D-20, no `window.open`). Regression-tested (7 dedicated tests: no-attachments, image thumbnail+rel hardening, pdf chip, SVG-never-thumbnail, D-22 inline-not-filtered, own-direction attachments, plain-text filename). Live 372px UAT confirms thumbnails/chips render correctly and links carry the hardened `rel`/`target` attributes. |

**Score:** 2/4 truths fully verified (present, wired, AND behaviorally proven end-to-end); 2/4 present + wired + unit-tested but the specific external/behavioral half of the claim (real mailbox delivery/rendering, and a fresh live re-check of the post-UAT GC bug fix) is unverified — see Human Verification below.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/grispi/client/attachments.ts` | Multipart upload client hitting probe-confirmed root path | ✓ VERIFIED | Posts to `attachments/upload{?inline=true}`, no `public/v1` prefix, consumes first element of always-array response |
| `src/grispi/client/http-handler.ts` (`sendMultipart`) | Multipart method that never leaks default JSON `Content-Type` | ✓ VERIFIED | `sendMultipart` builds `fetch` headers from `{...extraHeaders}` only — `this.headers` (the default JSON header) is never referenced |
| `src/grispi/client/tickets.ts` | v1/v2 write-path split (D-15 preservation) | ✓ VERIFIED | `createTicket`/`replyTicket` → `v2/tickets`; `patchTicket` narrowed to `StatusTicketPatchRequest`, stays on `public/v1`; each has an inline doc-comment codifying the split as a locked architectural fact |
| `src/lib/attachment-validation.ts` | D-08/D-11 batch validation + D-16 GC | ✓ VERIFIED | `validateAttachmentBatch`, `collectSurvivingInlineImageIds` present; encoding-insensitive token-match fix (`decodeHtmlEntities`/`extractObjectKey`) present and regression-tested |
| `src/lib/attachment-format.ts` | Turkish size/filename/MIME formatting | ✓ VERIFIED | `formatFileSize`, `truncateFilename`, `attachmentKind`, `rejectionToastLines` present, unit-tested |
| `src/store/attachment-upload-store.ts` | Full upload-lifecycle state machine (D-05/06/07/15/16/17/18) | ✓ VERIFIED | Two independent surface buckets, per-chip generation guard, `uploadInlineImage` as first/only caller of `registerInlineImage`, `collectAttachmentIds` merges inline-then-chip ids |
| `src/screens/components/attachment-chip.tsx` | Three-state chip pill + read-only thread mode | ✓ VERIFIED | idle/uploading/failed states, `href` read-only mode reused by `ThreadMessage` |
| `src/screens/components/rich-text-composer.tsx` | Attach button, drag-drop, chip panel, send lock, inline paste/drop | ✓ VERIFIED | All present; D-13 rev. positional `handleDrop` guard confirmed (`allInlineImages` check, `return !allInlineImages`) |
| `src/screens/components/inline-image-extension.ts` | `InlineImage` Tiptap node + placeholder lifecycle | ✓ VERIFIED | `inline:true` configured (load-bearing per Deviation #1), insert/resolve/remove helpers present, unit-tested |
| `src/lib/html-sanitizer.ts` | Two-policy sanitizer (incoming strict / authored permissive) | ✓ VERIFIED | `SANITIZE_CONFIG` (incoming) still has `img`/`svg` in both `FORBID_TAGS`/`FORBID_CONTENTS`; `AUTHORED_SANITIZE_CONFIG` permits `img`+`src`/`alt`; `stripUnsafeImageSrc` post-pass present, closing DOMPurify's internal `data:` URI bypass on `<img src>` |
| `src/screens/components/thread-message.tsx` | Incoming/own attachment two-zone render | ✓ VERIFIED | `ThreadAttachments` present, D-22 unfiltered, D-10 SVG-never-thumbnail, D-20 hardened links |
| `src/components/ui/sonner.tsx` + `src/app.tsx` | Root-mounted toast, no `next-themes` | ✓ VERIFIED | Single `<Toaster />` mounted in `app.tsx`; `next-themes` absent from `package.json` and the component |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `grispiAPI.attachments` | `Attachments.upload` | facade wiring | ✓ WIRED | `api.ts` constructs `Attachments` alongside `tickets`/`users`/`customers` |
| `AttachmentUploadStore.addFiles` | `validateAttachmentBatch` → `Attachments.upload` | injected uploader | ✓ WIRED | Default uploader closure calls `grispiAPI.attachments.upload`; injectable for tests |
| `AttachmentUploadStore.collectAttachmentIds` | `ComposeStore.submit` / `ActiveConversationStore.sendReply` | screen-level call before store mutation | ✓ WIRED | `compose-screen.tsx`/`chat-screen.tsx` call `collectAttachmentIds` immediately before `submit`/`sendReply`, same D-16 GC-before-envelope timing as body sanitization |
| `FileHandler.onPaste`/`onDrop` | `AttachmentUploadStore.uploadInlineImage` | `onInlineImagePaste` prop → adapter in `message-field.tsx`/`chat-screen.tsx` | ✓ WIRED | Both surfaces implement the adapter and pass it into `RichTextComposer` |
| `editorProps.handleDrop` (composer) | `FileHandler.onDrop` (inline) vs. react-dropzone `onAttachFiles` (attachment) | positional D-13 rev. guard | ✓ WIRED | `allInlineImages` check confirmed; `return !allInlineImages` releases control to FileHandler only when every dropped file is an inline-embeddable image |
| `normalizeComment` | `MessageVM.attachments` → `ThreadMessageData.attachments` → `ThreadMessage` render | projection chain | ✓ WIRED | Traced end-to-end in source; unfiltered per D-22 |
| `RichTextComposer` attachment props | `MessageField` (compose bucket) / `chat-screen` (reply bucket) | prop-driven wiring | ✓ WIRED | Both screens read `store.attachmentUpload` and pass surface-scoped bindings |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| COMP-05 | 04-01, 02, 03, 05, 06, 08 | Multi-attach in new conversation, upload + bind | ✓ SATISFIED (code); ⚠️ email-delivery half unverified | Chip UI, upload client, write-path split, send binding all present/tested/live-panel-confirmed at API level; full mailbox confirmation outstanding (P6b) |
| COMP-08 | 04-01, 02, 07, 08 | Pasted image uploads + inline embed, stays inline when sent | ✓ SATISFIED (code); ⚠️ mail-client rendering unverified | InlineImage/FileHandler/sanitizer-split all present/tested/live-panel-confirmed; mail-client HTML rendering (P6b) outstanding |
| THRD-05 | 04-02, 03, 05, 06, 08 | Same multi-attach capability on reply surface | ✓ SATISFIED (code); ⚠️ email-delivery half unverified | Independent reply bucket confirmed in source and tests; same P6b gap as COMP-05 |
| THRD-06 | 04-04, 08 | Incoming attachments visible/openable in thread | ✓ SATISFIED | Projection fix + two-zone render fully verified, live-panel-confirmed, no outstanding items |

No orphaned requirements: all four requirement IDs declared across the 8 plans' frontmatter match REQUIREMENTS.md's Phase 4 traceability rows exactly. COMP-06/COMP-07/SYNC-01 remain correctly `Pending` — explicitly out of Phase 4's scope (`04-CONTEXT.md`: "Kapsam dışı: talep özeti alıntılama, alıcıyla önceki görüşmeler, sessiz tazeleme (hepsi Faz 5)").

### Anti-Patterns Found

None. Scanned all 24 files touched across the phase's 8 plans for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/`console.log`-only stubs/`not implemented` markers — zero hits (the only "placeholder" matches are legitimate references to the inline-image upload-placeholder lifecycle feature, not debt markers).

### Automated Verification Re-Run (this session, not taken on SUMMARY's word)

- `CI=true npx craco test --watchAll=false` → **29 suites / 339 tests passing** (matches 04-08-SUMMARY.md's claimed baseline exactly, independently re-run)
- `CI=true npx tsc --noEmit` → clean
- `CI=true npm run build` → compiled successfully
- `package.json` exact pins confirmed for all four new dependencies: `react-dropzone@19.1.1`, `@tiptap/extension-file-handler@2.27.2`, `@tiptap/extension-image@2.27.2`, `sonner@2.0.7` (no `^`, no ranges); `next-themes` absent

### Human Verification Required

The following items are explicitly recorded in this phase's own artifacts (04-06-SUMMARY.md, 04-08-SUMMARY.md, REQUIREMENTS.md) as **not verified in any session** — this report does not mark them passed, per the explicit context-notes instruction for this verification pass.

#### 1. P6b — Recipient mailbox confirmation (blocks full confidence in SC2/SC3)

**Test:** Send a message from the panel containing (a) at least one chip attachment and (b) one pasted inline image, against the live `gsocial-test` tenant. Open the recipient's real mailbox (`davutkmbr@gmail.com`, per the Plan 06 UAT) and inspect the received e-mail directly.
**Expected:** The chip file appears as a real, downloadable e-mail attachment; the pasted image renders inline in the e-mail body (not as a broken image / not only visible via a separate attachment).
**Why human:** Requires inspecting an external mailbox in a real mail client — outside this session's/any automated environment's reach. Explicitly and repeatedly recorded across 04-06-SUMMARY.md and 04-08-SUMMARY.md as deferred to the user.

#### 2. Fresh live re-check of the D-16 GC encoding fix (`ca39d1e`)

**Test:** Paste an inline image, send it, then re-fetch the resulting ticket via the API (or ask the recipient) and confirm the inline image's attachment `id` is present in `comment.attachments`/bound correctly — specifically re-run the scenario that originally exposed the bug (an inline image whose `objectUrl` appears `&amp;`-encoded in the stored body).
**Expected:** The inline image's id round-trips into `attachmentIds` on a fresh live send, matching the 5 new unit-test regressions added in `ca39d1e`.
**Why human:** The bug was found during the phase-end UAT and fixed in the same session, but — per 04-08-SUMMARY.md's own "Outstanding" section — the fix was never re-exercised against a fresh live send afterward; only unit tests cover it. The unit-test coverage is strong (matches the exact N3 server-encoding scenario that caused the original bug), but a live round-trip was explicitly flagged as still needed.

#### 3. P5 — Plugin-mode bundle-token authorization (does not block phase completion)

**Test:** Once the plugin is registered in the real Grispi manifest, verify the bundle-supplied token (not the dev `.env` token) is authorized on the attachment upload endpoint.
**Expected:** Upload succeeds with the plugin-mode token exactly as it did with the dev token (Plan 01's A5 probe confirmed the dev token; the bundle token was never tested).
**Why human:** Manifest registration is an external dependency (Grispi team approval), unavailable in any development session. Per `04-RESEARCH.md`'s documented "Environment Availability" precedent, this does not block the phase — recorded here for completeness only, not as a blocker.

#### 4. Typing-latency judgment after pasting a large screenshot (informational, not a must-have)

**Test:** Paste a large screenshot into the editor and judge whether typing/editing feels laggy afterward.
**Expected:** No perceptible lag.
**Why human:** Subjective UX judgment; 04-08-SUMMARY.md records this as "not reliably measured" and explicitly left unaddressed (no delay constant applied) pending a human pass. Not one of the four ROADMAP success criteria — included here only because the phase's own artifacts flagged it as outstanding.

### Gaps Summary

No code-level gaps were found — every artifact, key link, and requirement traced cleanly to real, wired, unit-tested source, independently re-verified in this session (not taken on the SUMMARY's word): the upload path, the v1/v2 write-path split, the D-13 revised positional drop routing, the two-policy sanitizer (incoming policy confirmed unchanged and still forbidding `img`/`svg`), the D-16 GC encoding fix, and the incoming-attachment thread render were all read directly from source and cross-checked against the SUMMARY claims and the CONTEXT.md decisions they claim to implement — all matched. The full test suite (29/339), `tsc --noEmit`, and `npm run build` were all independently re-run in this session and passed clean.

The reason this report is `human_needed` rather than `passed` is that two of the four ROADMAP success criteria (SC2 and SC3) each have a real-world/external-system component — actual e-mail delivery and actual inline-image rendering in a third-party mail client — that no amount of source-reading or unit-test-running can prove, and that this phase's own artifacts explicitly and repeatedly record as **not yet verified by a human**, including one specific case (the D-16 GC bug fix) where a confirmed defect was fixed after the live UAT and never re-checked live afterward. This is not a code deficiency; it is an honestly-recorded gap between "the code is correct and tested" and "a human watched the real outcome happen." Per this verification's explicit instructions, these items must not be marked passed.

---

_Verified: 2026-08-01T05:28:03Z_
_Verifier: Claude (gsd-verifier)_

---

## Ek Kanıt — D-16 düzeltmesinin canlı doğrulaması (orkestratör, doğrulama sonrası)

Bu rapor, `ca39d1e`'deki D-16 çöp-toplama düzeltmesinin "taze bir canlı gönderimle hiç sınanmadığını" açık bir boşluk olarak kaydetmişti. Boşluk **kapatıldı**.

Temiz bundle ile yeniden yüklenen panelde (372×812, standalone dev) yeni bir yan görüşme açılıp editöre görsel yapıştırıldı ve gönderildi. Sonuç API'den doğrulandı:

```
TICKET-593
  ekler:            [{ "file": "gc-fix-dogrulama.png", "inline": true }]
  gövdedeki <img>:  1
  inline görselin id'si attachmentIds'e bağlandı: EVET
```

Yani düzeltme öncesi sessizce düşen inline-görsel kimliği artık gerçekten mesaja bağlanıyor ve `inline: true` bayrağıyla dönüyor. Başarı ölçütü 3'ün istemci→sunucu yarısı bu noktada uçtan uca kanıtlanmıştır; yalnızca alıcının posta istemcisindeki **render** (P6b) insan onayı beklemeye devam eder.
