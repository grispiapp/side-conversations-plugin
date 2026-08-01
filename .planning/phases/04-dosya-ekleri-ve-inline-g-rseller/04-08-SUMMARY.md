---
phase: 04-dosya-ekleri-ve-inline-g-rseller
plan: 08
subsystem: ui
tags: [tiptap, prosemirror, mobx, file-handler, image-upload, html-sanitizer, dompurify]

# Dependency graph
requires:
  - phase: 04-dosya-ekleri-ve-inline-g-rseller (Plan 03)
    provides: "AttachmentUploadStore's registerInlineImage/inlineImages bucket, built with zero callers"
  - phase: 04-dosya-ekleri-ve-inline-g-rseller (Plan 05)
    provides: "Composer surface (attach button, chip panel, drag overlay, send lock), prop-driven architecture with no useStore import"
  - phase: 04-dosya-ekleri-ve-inline-g-rseller (Plan 06)
    provides: "collectAttachmentIds -> comment.attachmentIds send-path binding on both compose/reply surfaces"
  - phase: 04-dosya-ekleri-ve-inline-g-rseller (Plan 07)
    provides: "sanitizeAuthoredHtml permissive policy (permits img src/alt for https?/mailto), sanitizeHtml unchanged"
provides:
  - "AttachmentUploadStore.uploadInlineImage(surface, file) — first caller of Plan 03's inline bucket"
  - "InlineImage Tiptap node + insertInlineImagePlaceholder/resolveInlineImagePlaceholder/removeInlineImagePlaceholder lifecycle helpers"
  - "FileHandler wired for both paste and editor-internal drop, with position-based D-13-rev. routing (image drop into editor text area = inline, everything else = attachment)"
  - "Two-zone drag affordance (editor zone vs. composer-rest zone) shown only for confirmed all-image drag payloads"
  - "D-16 garbage collection now runs end-to-end through a real upload, and is encoding-insensitive after the TICKET-592 fix"
affects: [phase-5-quoting-and-lookups]

tech-stack:
  added: []
  patterns:
    - "Ref-mirror idiom extended to a new optional prop (onInlineImagePaste) — useEditor's deps array stays []"
    - "Placeholder lifecycle as three pure Editor-instance helpers isolated in their own file, kept out of the composer's own risk surface"
    - "objectkey-token matching (not whole-URL substring) as the durable way to compare an upload response URL against arbitrarily-re-encoded HTML"

key-files:
  created:
    - src/screens/components/inline-image-extension.ts
    - src/screens/components/__tests__/inline-image-extension.test.ts
  modified:
    - src/store/attachment-upload-store.ts
    - src/store/__tests__/attachment-upload-store.test.ts
    - src/screens/components/rich-text-composer.tsx
    - src/screens/components/__tests__/rich-text-composer.test.tsx
    - src/screens/components/message-field.tsx
    - src/screens/chat-screen.tsx
    - src/index.css
    - src/lib/attachment-validation.ts
    - src/lib/__tests__/attachment-validation.test.ts

key-decisions:
  - "D-13 rev. (2026-08-01, from live UAT): drop routing is positional, not just entry-point — an all-image drop landing inside the editor text area embeds inline; a drop anywhere else on the composer (or any drop containing a non-image) is always an attachment"
  - "collectSurvivingInlineImageIds matches on the upload response's objectkey query token after decoding HTML entities, not on whole-URL substring inclusion — survives both the composer's own &amp; serialization and the server's N3 &amp;+&#61; re-encoding, and cannot confuse two uploads with prefix-sharing keys"
  - "InlineImage.configure({ inline: true }) is required, not cosmetic — without it every image is a block atom and ProseMirror leaves a NodeSelection around a just-inserted placeholder, so a second paste before the first resolves silently deletes the first"

patterns-established:
  - "Pattern: entity-decode + token-match instead of raw substring match for any future round-trip URL comparison against server-echoed HTML"

requirements-completed: [COMP-05, COMP-08, THRD-05, THRD-06]

coverage:
  - id: D1
    description: "AttachmentUploadStore.uploadInlineImage uploads first, registers into the surface's inline bucket, never enters the chip list, extends isUploading/hasAttachments"
    requirement: "COMP-08"
    verification:
      - kind: unit
        ref: "src/store/__tests__/attachment-upload-store.test.ts#uploadInlineImage describe block"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-16 garbage collection (collectSurvivingInlineImageIds) survives entity re-encoding and correctly drops a deleted image's id"
    requirement: "COMP-08"
    verification:
      - kind: unit
        ref: "src/lib/__tests__/attachment-validation.test.ts#encoding-insensitive matching (TICKET-592 regression)"
        status: pass
    human_judgment: false
  - id: D3
    description: "InlineImage node + placeholder lifecycle (insert/resolve/remove) and FileHandler paste/drop wiring with position-based D-13-rev. routing"
    requirement: "COMP-08"
    verification:
      - kind: unit
        ref: "src/screens/components/__tests__/inline-image-extension.test.ts"
        status: pass
      - kind: unit
        ref: "src/screens/components/__tests__/rich-text-composer.test.tsx#RichTextComposer inline image paste/drop (COMP-08, D-13 rev.)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Phase-end panel UAT: four ROADMAP success criteria (COMP-05, send binding + delivery, COMP-08 inline paste, THRD-06 incoming attachments) verified live in a real 372x812 panel"
    requirement: "COMP-05, THRD-06"
    verification: []
    human_judgment: true
    rationale: "Layout, real drag/drop gestures, and cross-client mail rendering cannot be proven by jsdom (04-VALIDATION.md); requires the human's own eyes in a real browser against the live gsocial-test tenant"
  - id: D5
    description: "P6b (recipient mailbox rendering of the inline image) and plugin-mode P5 (bundle-token authorization)"
    verification: []
    human_judgment: true
    rationale: "Both require access outside this session's environment — a real mailbox inspection and the live Grispi plugin panel with manifest registration — and are explicitly recorded as NOT verified in this session"

duration: ~48min
completed: 2026-08-01
status: complete
---

# Phase 4 Plan 8: Inline Paste Flow, D-16 Garbage Collection, Phase-End UAT Summary

**Wired the last unused primitive of Phase 4 (AttachmentUploadStore's inline bucket) to Tiptap's FileHandler for paste AND position-routed drop, then closed a silent attachment-loss bug in the D-16 garbage collector found during the phase-end UAT.**

## Performance

- **Tasks:** 3 code tasks + 1 checkpoint UAT + 1 confirmed-bug fix
- **Files modified:** 9 (2 new)
- **Duration:** ~48 min across this plan's commits

## Accomplishments

- `AttachmentUploadStore.uploadInlineImage(surface, file)` is now the first and only caller of Plan 03's `registerInlineImage` — uploads first (D-14), never enters the chip list (D-15), extends `isUploading`/`hasAttachments` with the inline bucket (D-06/D-18).
- `InlineImage` Tiptap node + three pure placeholder-lifecycle helpers (`insertInlineImagePlaceholder`, `resolveInlineImagePlaceholder`, `removeInlineImagePlaceholder`) live in their own new file, isolated from the composer's own risk surface.
- `RichTextComposer`'s `handlePaste` now releases control when the clipboard carries files (Integration Pitfall #1 fix) and `handleDrop`'s guard is now conditional per D-13 rev.: an all-image drop landing in the editor text area goes inline, everything else (non-image, mixed, or dropped outside the editor) is an attachment.
- Both composer surfaces (`message-field.tsx` compose, `chat-screen.tsx` reply) wire the inline upload adapter and show the single UI-SPEC §7/§8.4 failure toast, never letting the composer itself render UI.
- **Confirmed phase-end UAT bug fixed:** `collectSurvivingInlineImageIds` (D-16) silently dropped every surviving inline image's id from `comment.attachmentIds` because it compared the raw (bare `&`) `objectUrl` against the composer's `&amp;`-encoded serialized HTML. Now matches on each upload's `objectkey` token after decoding HTML entities, surviving both the client's own encoding and the server's N3 re-encoding (`&#61;`+`&amp;`), with 5 new regression tests.
- Full jest suite grew from the 334-test baseline to **339 tests / 29 suites**, all green; `tsc --noEmit` and `npm run build` both clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Store inline yükleme eylemi** — `d4df0a0` (feat) — `AttachmentUploadStore.uploadInlineImage`, in-flight inline counter, `isUploading`/`hasAttachments` extension, `reset` extension
2. **Task 2: Inline görsel düğümü, yapıştırma yolunun açılması ve yer tutucu yaşam döngüsü** — `fcb075d` (feat) — `inline-image-extension.ts`, `handlePaste`/`handleDrop` wiring, two-zone drag affordance, CSS badge rules
3. **Task 3: İki yüzeyin inline bağlanması, hata toast'ı ve yapıştırma testleri** — `4e3b11a` (feat) — `message-field.tsx`/`chat-screen.tsx` adapters, `inline-image-extension.test.ts`, composer paste/drop tests; includes the `inline: true` NodeSelection fix (Rule 1, see below)
4. **Bug fix (this session): D-16 GC encoding-insensitivity** — `ca39d1e` (fix) — `collectSurvivingInlineImageIds` token-match rewrite + 5 regression tests

**Plan metadata:** _(this commit, docs: complete plan)_

## Files Created/Modified

- `src/store/attachment-upload-store.ts` — `uploadInlineImage` action, per-surface in-flight inline counter, `isUploading`/`hasAttachments`/`reset` extended
- `src/store/__tests__/attachment-upload-store.test.ts` — new `describe` block covering the 12 behaviors specified in Task 1
- `src/screens/components/inline-image-extension.ts` (new) — `InlineImage`, `INLINE_IMAGE_MIME_TYPES`, `INLINE_IMAGE_UPLOADING_CLASS`, `insertInlineImagePlaceholder`, `resolveInlineImagePlaceholder`, `removeInlineImagePlaceholder`
- `src/screens/components/__tests__/inline-image-extension.test.ts` (new) — direct `Editor`-instance tests for the lifecycle helpers
- `src/screens/components/rich-text-composer.tsx` — `onInlineImagePaste` prop, `handlePaste`/`handleDrop` wiring, `InlineImage`+`FileHandler` extensions, two-zone drag affordance, placeholder start/resolve/remove flow, blob-URL cleanup effect
- `src/screens/components/__tests__/rich-text-composer.test.tsx` — new paste/drop describe block, re-pointed 04-05's drop-on-editor regression test to a non-image file
- `src/screens/components/message-field.tsx` — compose-surface inline upload adapter + failure toast
- `src/screens/chat-screen.tsx` — reply-surface inline upload adapter + failure toast
- `src/index.css` — `.inline-image-uploading` wrapper/opacity/badge rules (UI-SPEC §8.2)
- `src/lib/attachment-validation.ts` — `decodeHtmlEntities`/`extractObjectKeys`/`extractObjectKey` helpers, `collectSurvivingInlineImageIds` rewritten to token-match
- `src/lib/__tests__/attachment-validation.test.ts` — 5 new regression tests for the TICKET-592 bug

## Decisions Made

- **D-13 rev. (2026-08-01, live UAT):** drop routing became positional — an all-image drop that lands inside the editor's text area embeds inline; everything else (non-image, mixed selection, or a drop outside the editor's text area) is always an attachment. This revises the phase's earlier "paste = inline, drop = attachment" rule after the human explicitly expected an image dropped into the editor to embed.
- **D-16 GC matching strategy:** match on the upload response's `objectkey` query-string token (decoded, exact-Set-membership) rather than whole-URL substring inclusion — the only approach proven to survive both the client's own HTML serialization and the server's independent re-encoding (N3), without a false positive across two uploads with prefix-sharing keys.
- **`InlineImage.configure({ inline: true })` is load-bearing**, not cosmetic — see Deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `InlineImage` needed `inline: true`, or a second paste silently deletes the first placeholder**
- **Found during:** Task 3, while writing the composer's paste tests
- **Issue:** The base `@tiptap/extension-image` defaults to `inline: false`, making every image a block atom. ProseMirror leaves a `NodeSelection` wrapping a just-inserted block atom; if a second placeholder was inserted immediately after (two pastes before the first resolved), the insertion **replaced** that selection, silently deleting the first placeholder.
- **Fix:** `InlineImage.configure({ inline: true })` in `rich-text-composer.tsx`'s extensions array — the node now joins the paragraph's own inline content group, so insertion always leaves an ordinary post-node cursor instead of a selection that a subsequent insert can clobber.
- **Files modified:** `src/screens/components/rich-text-composer.tsx`
- **Verification:** Composer test "two concurrent placeholders never cross-contaminate" (also covered directly at the node level in `inline-image-extension.test.ts`)
- **Committed in:** `4e3b11a`

**2. [Rule 2 - Missing Critical] Two-zone drag affordance for D-13 rev.'s positional routing**
- **Found during:** Task 2, implementing the conditional `handleDrop` guard
- **Issue:** The plan's revised D-13 makes an all-image drop's outcome depend on WHERE inside the composer it lands (editor text area = inline, composer-rest = attachment), but the existing drag overlay was a single full-composer zone with one message. Leaving it as-is would show the agent a single, now-inaccurate promise regardless of where they were about to drop — a correctness gap in the UI's own contract with the user, not just a nice-to-have.
- **Fix:** Added a second overlay state (`dragAllImages`) computed from the drag payload's MIME types at `dragenter`; when the payload is confirmed all-images, the editor zone shows "Mesaja göm" and the composer-rest zone shows "Dosya olarak ekle" as two visually distinct affordances. Falls back to the original single "becomes an attachment" zone whenever the payload isn't confirmed all-images (the safe default, matching D-13's non-image/mixed-drop behavior).
- **Files modified:** `src/screens/components/rich-text-composer.tsx`
- **Verification:** Manually verified in UAT step 1(c) below; jsdom cannot simulate real drag-payload MIME inspection at `dragenter`, so this affordance's visual correctness rests on the live panel check
- **Committed in:** `fcb075d`

**3. [Note] Task 3's read_first bullet about the existing paste test proved slightly stale**
- **Found during:** Task 2/3
- **Issue:** Task 3's `read_first` asserted the pre-existing composer paste test (pre-04-08, clipboard mock with no `files` field) was fully unaffected by Task 2's new control-releasing branch and would need zero changes. In practice the production code's new `handlePaste` branch read `event.clipboardData?.files?.length`, and the pre-existing test's clipboard mock didn't shape that field the same way the new branch expected, surfacing an optional-chaining gap the old test hadn't exercised.
- **Fix:** Added the missing optional chaining (`?.files?.length`) so an absent/malformed `clipboardData.files` never throws; the pre-existing test needed no behavioral change once the code was correct. No scope creep — this is the "existing behavior preserved" outcome the plan asked for, just reached via one extra defensive line the plan's stale bullet didn't anticipate.
- **Files modified:** `src/screens/components/rich-text-composer.tsx`
- **Verification:** Full existing paste test suite green, no assertions changed
- **Committed in:** `fcb075d`

**4. [Note] Sanitizer call-site grep counts don't match the plan's literal acceptance-criteria numbers**
- **Found during:** Task 2 self-check against acceptance criteria
- **Issue:** The plan's Task 2 acceptance criteria asserted `grep -c "sanitizeUntrustedDraftHtml"` = 2 and `grep -c "sanitizeAuthoredHtml"` = 4 in `rich-text-composer.tsx`. The actual post-Task-2 file greps to 3 and 5 respectively.
- **Explanation (not a bug):** `grep -c` counts *lines* containing the string, and this file has one `import { sanitizeAuthoredHtml, sanitizeUntrustedDraftHtml }` line plus one ternary (`sanitizeValue = valueIsTrustedAuthored ? sanitizeAuthoredHtml : sanitizeUntrustedDraftHtml`) that references both names on the SAME line as an assignment, not a call. Counting only actual call sites (`grep -n "sanitizeAuthoredHtml(\|sanitizeUntrustedDraftHtml("`) shows exactly 4 calls — `sanitizeAuthoredHtml(` at `handleKeyDown`, `onUpdate`, `submitCurrentContent` (all 3 pre-existing, per 04-07's table) and `sanitizeUntrustedDraftHtml(` at `handlePaste` (also pre-existing) — **zero new sanitizer call sites were added by this plan**, confirming 04-07's caller-to-policy distribution was not touched.
- **Files modified:** none (verification-only note)
- **Committed in:** n/a — recorded here for traceability since a future drift-check reading the plan's literal grep numbers would incorrectly flag this file

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 2 missing-critical) + 2 documentation notes + 1 confirmed post-UAT bug fix (see below)
**Impact on plan:** All auto-fixes necessary for correctness (silent placeholder deletion, misleading drag affordance) or for accurate self-verification. No scope creep.

### Confirmed Bug Found During Phase-End UAT (fixed this session)

**The surviving inline image's attachment id never reached `comment.attachmentIds`.**

- **Found during:** Task 4's phase-end panel UAT, live on `TICKET-592`.
- **Root cause:** `collectSurvivingInlineImageIds` compared the raw `objectUrl` from the upload response (bare `&`) against the composer's serialized `bodyHtml`, which always HTML-entity-encodes `&` as `&amp;`. `bodyHtml.includes(objectUrl)` therefore never matched, so the survival check silently treated every inline image as deleted and its id was filtered out of `attachmentIds` — even though the image rendered correctly in the panel and in email (because `objectUrl` is publicly fetchable on its own). The upload was orphaned server-side and D-16's contract was broken.
- **Fix:** `collectSurvivingInlineImageIds` now decodes HTML entities in `bodyHtml` (numeric decimal/hex + `&amp;`/`&lt;`/`&gt;`/`&quot;`/`&apos;`) and matches on each upload's `objectkey` query-string token via exact Set membership, rather than a whole-URL substring check. This survives both the composer's own `&amp;` serialization AND the server's independent re-encoding on storage (04-01 finding N3: `&#61;` for `=`, `&amp;` for `&`), and cannot confuse two different uploads whose `objectkey` values share a text prefix.
- **Regression tests added (5):** raw-URL match, `&amp;`-only-encoded match, `&#61;`+`&amp;`-doubly-encoded match (N3 round-trip), deleted image still correctly excluded, two prefix-sharing uploads not confused.
- **Files modified:** `src/lib/attachment-validation.ts`, `src/lib/__tests__/attachment-validation.test.ts`
- **Verification:** `CI=true npx craco test --watchAll=false --testPathPattern=attachment-validation` (15/15 pass), full suite 339/339 pass, `tsc --noEmit` clean, `npm run build` clean
- **Committed in:** `ca39d1e` (separate fix commit, per the continuation's instructions)

## Issues Encountered

None beyond the confirmed bug above and the two deviations documented in Task 2/3.

## Faz-Sonu Panel UAT

Driven live in the browser against the real `gsocial-test` tenant, 372×812 panel, standalone dev mode.

### Dört ROADMAP Başarı Ölçütü — Verdict

| # | Başarı ölçütü | Verdict |
|---|---|---|
| 1 | Çoklu ek, liste, kaldırma (COMP-05) | **KARŞILANDI** |
| 2 | `comment.attachmentIds` bağlaması + e-posta teslimi | **KARŞILANDI** (chip-bucket half was already live-verified in Plan 06/P6a; the inline-image half of this criterion is what the confirmed bug above threatened — now fixed and covered by unit tests, but the fixed code's own live re-send was NOT re-run in this session; see Outstanding below) |
| 3 | Editöre yapıştırılan görsel inline gömülür (COMP-08) | **KARŞILANDI** |
| 4 | Karşı tarafın gönderdiği ekler thread'de görünür (THRD-06) | **KARŞILANDI** |

### On maddenin sonucu

1. **COMP-05 multi-attach:** Paperclip picked multiple files; chips render above the toolbar with truncated names/sizes/thumbnails; at 4 files the `"4 dosya"` summary toggle appeared with correct `aria-expanded` true↔false; removing a chip moved focus to the next remove button, never stranded. **PASS.**
2. **Partial rejection:** 11MB file dropped alongside a small one — small file accepted, large one rejected, single toast read exactly `"cok-buyuk.bin — 11,0 MB, sınır 10 MB"`. **PASS.**
3. **D-06 send lock:** Gönder disabled while uploads in flight, enabled once finished; stayed disabled with empty text (D-03). **PASS.**
4. **COMP-08 inline paste:** Pasted image appeared in the editor, resolved to an `https://usercontent.grispi.net/...` src (no leftover `blob:`), never appeared in the chip list (D-15). **PASS.**
5. **D-13 rev. (positional routing), both directions:** image dropped into the editor text area embedded inline and did not enter the chip list; a PDF dropped into the same spot went to the attachment list and did not embed. **PASS.**
6. **Inline failure path:** with the upload endpoint blocked, the placeholder was fully removed (no residual `<img>`, no leaked `blob:` URL) and the toast read exactly `"Görsel yüklenemedi, editöre eklenemedi."` **PASS.**
7. **THRD-06 incoming/own attachments:** in the thread, image attachments render as thumbnails, other files as chips; all attachment links carry `target="_blank"` and `rel="noopener noreferrer"` (D-20). **PASS.**
8. **D-16 body-level GC:** with two pasted images, deleting one before send produced a delivered body containing only the surviving image visually. **The id-binding half of D-16 was the confirmed bug above** — fixed and unit-tested this session, but not re-verified live post-fix (see Outstanding below).
9. **ProseMirror artifact check:** the `<img class="ProseMirror-separator">` editing artifact does NOT reach the sent body — verified on `TICKET-592` (exactly one `<img>` in the stored body, no separator). **PASS.**

### P5 — Plugin-mode bundle-token authorization

**DEFERRED — NOT TESTED.** Plugin manifest registration in the real Grispi panel is an external dependency (Grispi team approval) not available in this session's environment. Per 04-RESEARCH.md's "Environment Availability" precedent, this alone does not block the phase.

### P6b — Recipient mailbox rendering

**NOT VERIFIED in this session.** Mailbox confirmation that attachments arrive as real email attachments, and whether the inline image renders in a real mail client, is deferred to the user. This is explicitly recorded as outstanding, not claimed as passed.

### Güncelleme gecikmesi ölçümü (Task 2f)

**NOT RELIABLY MEASURED in this session.** Perceptible typing latency after pasting a large screenshot needs a human judgment pass under real conditions; not reliably measurable via automation in this session. No delay constant was added — per the plan, this stays unaddressed until a human pass confirms it's actually needed.

## Outstanding / Explicitly Unverified (do not treat as passed)

1. **P6b (mailbox confirmation)** — whether attachments arrive as real email attachments and whether the inline image renders in a real mail client. Deferred to the user.
2. **P5 (plugin-mode bundle-token authorization)** — marked `DEFERRED — NOT TESTED`; manifest registration is an external dependency; does not block the phase per RESEARCH.md's documented precedent.
3. **Update-latency measurement (Task 2f)** — perceptible typing latency after pasting a large screenshot; not reliably measurable via automation, needs a human judgment pass. No delay constant applied.

Additionally, because the confirmed D-16 bug was found and fixed AFTER the live UAT session that produced items 1-9 above, **the fix itself has unit-test coverage but was not re-verified against a fresh live send** in this session. A future session (or the user, before relying on this in production) should re-run UAT step 5/8 once more against the live tenant to confirm the fixed `attachmentIds` binding round-trips correctly end to end.

## User Setup Required

None - no new external service configuration required (Task 4's `user_setup` block only re-used the existing `.env.development.local` dev token and a manual mailbox check, both already covered above as outstanding items).

## Next Phase Readiness

- `AttachmentUploadStore.uploadInlineImage(surface: ComposerSurface, file: File): Promise<InlineImageVM>` and the three placeholder lifecycle helpers (`insertInlineImagePlaceholder(editor, params): string | null`, `resolveInlineImagePlaceholder(editor, uploadId, objectUrl): boolean`, `removeInlineImagePlaceholder(editor, uploadId): boolean`) are the stable surfaces Phase 5 can build on.
- Phase 4's four requirements (COMP-05, COMP-08, THRD-05, THRD-06) are code-complete and live-verified except for the two explicitly-outstanding manual checks above (P5, P6b), which do not block Phase 5's start.
- No known stubs remain in the inline-image or attachment-chip code paths.

---
*Phase: 04-dosya-ekleri-ve-inline-g-rseller*
*Completed: 2026-08-01*

## Self-Check: PASSED

All created/modified files confirmed present on disk; all four referenced commits (`d4df0a0`, `fcb075d`, `4e3b11a`, `ca39d1e`) confirmed in `git log`.
