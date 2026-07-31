---
phase: 04-dosya-ekleri-ve-inline-g-rseller
plan: 04
subsystem: ui
tags: [react, mobx, react-query, attachments, thread-rendering, xss-hardening]

# Dependency graph
requires:
  - phase: 04-dosya-ekleri-ve-inline-g-rseller
    provides: "Plan 01's live-verified auth-header-free objectUrl behavior; Plan 02's exported Attachment type (with the probe-confirmed inline?: boolean field) and attachmentKind/formatFileSize/truncateFilename formatters; Plan 03's read-only href mode on AttachmentChip and the badgeVariants 'file' pill variant"
provides:
  - "normalizeComment now projects comment.attachments through to MessageVM unfiltered (D-22) — the projection bug that silently dropped every incoming/own attachment is fixed"
  - "ThreadMessage renders a two-zone attachment block (72px image thumbnail row + read-only AttachmentChip file row) for both incoming and own messages, per UI-SPEC §9"
  - "First user-visible, end-to-end slice of Phase 4: a supplier's invoice attachment is now visible and clickable in the thread, with zero new network calls (data was already in getTicket's response)"
affects: [04-05, 04-06, 04-07, 04-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Attachment → AttachmentChipVM adapter (toAttachmentChipVM in thread-message.tsx) lets a read-only thread surface reuse the exact same AttachmentChip shell the composer uses, without AttachmentChip ever depending on the wire-level Attachment type directly"
    - "Two-zone MIME split (attachmentKind(mimeType) === 'image' vs. everything else, SVG excluded from the image zone) computed inline in the render component rather than as a store-level derived field — attachments are a fixed comment payload, no observability/staleness concern"

key-files:
  created: []
  modified:
    - src/store/active-conversation-store.ts
    - src/query/side-conversation-queries.ts
    - src/query/__tests__/side-conversation-queries.test.tsx
    - src/screens/components/thread-message.tsx
    - src/screens/components/__tests__/thread-components.test.tsx
    - .planning/REQUIREMENTS.md

key-decisions:
  - "D-22 is enforced by ABSENCE of a filter, not by an explicit allow-list: normalizeComment's attachments field is `comment.attachments?.length ? comment.attachments : undefined` — the exact same 'empty → undefined' idiom already used for senderName/senderEmail on the same function, with zero .filter() call anywhere in the path"
  - "The image/file split lives in ThreadMessage, not in a new store or MessageVM-level derived field — attachmentKind() is a pure function already exported from Plan 02, and the split only needs to happen once per render"
  - "REQUIREMENTS.md's THRD-06 checkbox text was corrected in-place (not just checked): the original text assumed grispi-ui's inline-filtering behavior ('inline: true ekler gövdede zaten göründüğü için listeden filtrelenir'), which is the literal opposite of the D-22 decision this plan implements. Text now says D-22's 'NOT filtered' rule with the rationale, matching what actually shipped"

patterns-established:
  - "Pattern: a wire-level DTO (Attachment) is adapted into a component-local view-model (AttachmentChipVM) via a small pure mapping function co-located with the component that needs it, when the component's public API is intentionally decoupled from any one caller's data shape"

requirements-completed: [THRD-06]

coverage:
  - id: 04-04-projection
    description: "normalizeComment projects comment.attachments to MessageVM.attachments unfiltered, including inline:true records (D-22); empty array and missing field both normalize to undefined; existing body/direction/quote fields unaffected"
    requirement: "THRD-06"
    verification:
      - kind: unit
        ref: "src/query/__tests__/side-conversation-queries.test.tsx — 'projects comment.attachments to MessageVM.attachments without filtering inline-flagged ones (D-22)', 'leaves MessageVM.attachments undefined when comment.attachments is an empty array', 'leaves MessageVM.attachments undefined and does not throw when comment.attachments is missing'"
        status: pass
      - kind: compile
        ref: "CI=true npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: 04-04-render
    description: "ThreadMessage renders incoming/own attachments below the body/quote block: 72px image thumbnails (non-SVG) in a wrapping row, read-only AttachmentChip pills (pdf/video/generic/svg) below that; every link opens objectUrl directly in a new tab with rel=noopener noreferrer; filenames render as plain text only; D-21's incoming body-image policy and D-10's no-SVG-thumbnail rule are both preserved"
    requirement: "THRD-06"
    verification:
      - kind: unit
        ref: "src/screens/components/__tests__/thread-components.test.tsx — 'renders no attachment block...', 'renders an image attachment as a new-tab thumbnail link with hardened rel', 'renders a pdf attachment in the file chip row, not the thumbnail row', 'renders an SVG attachment as a file chip, never a thumbnail (D-10)', 'still renders an inline-flagged attachment (D-22 regression guard)', 'shows attachments for own-direction messages too', 'renders the attachment filename as plain text, never through an HTML sink'"
        status: pass
      - kind: unit
        ref: "full existing suite (271/271) including pre-existing body/quote sanitizer regression tests, unchanged and green"
        status: pass
      - kind: compile
        ref: "CI=true npx tsc --noEmit"
        status: pass
    human_judgment: false

# Metrics
duration: ~20min
completed: 2026-08-01
status: complete
---

# Phase 04 Plan 04: Incoming Attachment Rendering (THRD-06) Summary

**Fixed a silent projection bug (`normalizeComment` dropped `comment.attachments` entirely) and added a two-zone attachment render — 72px image thumbnails plus a read-only `AttachmentChip` file row — to `ThreadMessage`, shipping Phase 4's first end-to-end visible slice: a counterparty's invoice attachment is now visible and openable in the thread with zero new network calls.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-01T02:20:00+03:00
- **Completed:** 2026-08-01T02:30:00+03:00
- **Tasks:** 2/2 complete
- **Files modified:** 6 (5 code/test + REQUIREMENTS.md)

## Accomplishments

- `MessageVM` (`active-conversation-store.ts`) gained `attachments?: Attachment[]`, following the exact optional-field style already used by `errorKind?`/`senderName?`/`authoredBodyHtml?` on the same interface.
- `normalizeComment` (`side-conversation-queries.ts`) now projects `comment.attachments` through to `MessageVM.attachments` using the same "empty → undefined" idiom the function already uses for `senderName`/`senderEmail` — **no filtering** is applied anywhere in the path, which is the entire point of D-22 (grispi-ui drops `inline: true` attachments because it renders them in the body; this plugin never renders incoming body images per D-21, so filtering here would make a third party's screenshot vanish with no other way to see it).
- `ThreadMessageData` (`thread-message.tsx`) gained the matching `attachments?: Attachment[]` field, and a new `ThreadAttachments` render block appears after the body/quote-disclosure block and before the pending/failed status row, for **both** `direction === "own"` and `direction === "incoming"` messages whenever `message.attachments` is non-empty.
- The render block follows UI-SPEC §9's two-zone layout exactly: an image thumbnail row (`size-[72px]`, `image/*` except SVG — D-10) rendered first, then a file chip row (pdf/video/generic/svg) reusing Plan 03's `AttachmentChip` in its read-only `href` mode. Every link/thumbnail wraps `attachment.objectUrl` directly in a plain `<a target="_blank" rel="noopener noreferrer">` — no `window.open` wrapper anywhere, satisfying D-20's native-anchor-semantics requirement (middle-click/ctrl-click work for free).
- Filenames are rendered exclusively through `AttachmentChip`'s existing plain-JSX-text convention and the thumbnail row's `alt`/`title` attributes — no new HTML sink was introduced anywhere in this plan.
- `bodyHtml`/`quotedHtml` sinks were not touched at all (D-21 unchanged) — confirmed by the full pre-existing sanitizer regression suite staying green untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: normalizeComment attachment projection** — `06b8eb5` (feat)
2. **Task 2: ThreadMessage attachment render** — `a998902` (feat)

**Plan metadata:** commit created at the end of this SUMMARY/state-update step (see git log for the following `docs(04-04): ...` commit).

## Files Created/Modified

- `src/store/active-conversation-store.ts` — `MessageVM.attachments?: Attachment[]`, imports `Attachment` from `@/types/grispi.type`
- `src/query/side-conversation-queries.ts` — `normalizeComment` now carries `comment.attachments` through unfiltered, with a doc-comment attributing the "no filter" rule to D-22
- `src/query/__tests__/side-conversation-queries.test.tsx` — three new tests: D-22 regression (inline-flagged attachment survives projection, other fields unaffected), empty-array → undefined, missing-field → undefined without throwing
- `src/screens/components/thread-message.tsx` — `ThreadMessageData.attachments?: Attachment[]`; new `toAttachmentChipVM` adapter and `ThreadAttachments` component; wired into the main render between the quote block and the pending/failed status row
- `src/screens/components/__tests__/thread-components.test.tsx` — new `makeAttachment` fixture helper and seven new `ThreadMessage` tests (no-attachments, image thumbnail + rel hardening, pdf chip, SVG-never-thumbnail/D-10, D-22 inline regression, own-direction attachments, plain-text filename/no-HTML-sink)
- `.planning/REQUIREMENTS.md` — THRD-06 checked complete; its description text corrected from the stale "inline attachments are filtered" assumption to the shipped D-22 "not filtered" behavior

## Decisions Made

See `key-decisions` in frontmatter — repeated here for readability:

- D-22 is enforced by the absence of a `.filter()` call, not an explicit allow-list — matches the function's existing "empty → undefined" idiom exactly.
- The image/file MIME split happens inline in `ThreadMessage`'s render, not as a new store-level derived field — `attachmentKind()` is already a pure, already-tested function from Plan 02, and the comment's attachment list never changes after the initial fetch, so there's no staleness/observability need for a store field.
- `REQUIREMENTS.md`'s THRD-06 line text was corrected, not just checked — its original wording assumed grispi-ui's inline-filtering behavior, which is the literal opposite of what D-22 (locked earlier in this phase) and this plan actually implement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed the literal substring `window.open` from a doc-comment to satisfy the plan's own grep-based acceptance criterion**

- **Found during:** Task 2, running the plan's acceptance-criteria greps after the first draft
- **Issue:** The first-draft doc-comment on `ThreadAttachments` explained D-20 by saying "...never a `window.open` wrapper" — correct and useful prose, but it defeats the plan's own literal `grep -c "window.open" src/screens/components/thread-message.tsx` = 0 acceptance gate (which greps for the raw substring regardless of comment vs. code context).
- **Fix:** Reworded to "...via plain anchor semantics (D-20) — no imperative popup-window API is used anywhere in this file," conveying the identical intent without the literal forbidden substring.
- **Verification:** `grep -c "window.open" src/screens/components/thread-message.tsx` = 0 (passes); `grep -c "AttachmentChip"` = 6, `grep -c "noopener noreferrer"` = 1, `grep -c "attachments?: Attachment\[\]"` = 1 (all pass).
- **Files modified:** `src/screens/components/thread-message.tsx`.
- **Commit:** `a998902`

**2. [Rule 1 - Bug] Corrected REQUIREMENTS.md's THRD-06 description text, which contradicted the D-22 decision this plan implements**

- **Found during:** State-update step, before running `requirements mark-complete`
- **Issue:** The existing THRD-06 line read "...`inline: true` ekler gövdede zaten göründüğü için listeden filtrelenir" (inline attachments are filtered from the list because they already appear in the body) — this is the grispi-ui behavior D-22 explicitly and deliberately diverges from. Marking the checkbox complete without fixing the text would leave a permanently false record of what shipped, directly contradicting this plan's own `must_haves` ("hiçbir ek görünürlük dışı bırakılmıyor (D-22)") and its passing D-22 regression tests.
- **Fix:** Rewrote the clause to state the shipped behavior — attachments are NOT filtered, with the D-21/D-22 rationale inline — before checking the box.
- **Verification:** `git diff` on `.planning/REQUIREMENTS.md` shows only the corrected THRD-06 line and its checkbox; no other requirement text touched.
- **Files modified:** `.planning/REQUIREMENTS.md`.
- **Commit:** included in this plan's final `docs(04-04)` metadata commit.

---

**Total deviations:** 2 auto-fixed (both Rule 1).
**Impact on plan:** Deviation 1 is a comment-wording fix required by the plan's own literal grep gate, no behavioral change. Deviation 2 corrects a stale requirements-tracking record so it matches the actually-shipped, tested D-22 behavior — no code impact, prevents a future reader from believing the opposite of what was built.

## Issues Encountered

None blocking.

## Known Stubs

None. Both the projection fix and the render block are fully wired against real data already present in `getTicket`'s response — no new fetch, no mock/placeholder attachment source. Plan 05/06/08 (composer wiring, reply-flow, inline-paste) remain out of this plan's scope as planned; this plan only covers rendering attachments that already exist on a fetched comment.

## Threat Flags

None beyond what `04-04-PLAN.md`'s own `<threat_model>` already covers, all satisfied as designed:
- T-04-12 (SVG stored-XSS class risk) — mitigated: SVG is excluded from the image-thumbnail zone by `attachmentKind()` (never `=== "image"`), always rendered via `AttachmentChip`'s icon-only leading slot; no `<object>`/`<iframe>`/raw `<svg>` anywhere in this file; regression-tested ("renders an SVG attachment as a file chip, never a thumbnail (D-10)").
- T-04-13 (filename XSS) — mitigated: filenames render only as JSX text nodes / `alt`/`title` attribute values, never through `dangerouslySetInnerHTML`; regression-tested with a filename containing raw markup.
- T-04-14 (remote body-image tracking pixels) — mitigated by non-change: `bodyHtml`/`quotedHtml` sinks are untouched; the full pre-existing sanitizer test suite (D-21 coverage) passes unmodified.
- T-04-15 (tabnabbing via new-tab links) — mitigated: every attachment link/thumbnail carries `rel="noopener noreferrer"`, grep-gated and test-asserted.
- T-04-16 (unauthenticated `objectUrl` access) — accepted per Plan 01's disposition, unchanged; no client-side mitigation available.

## User Setup Required

None.

## Next Phase Readiness

- `MessageVM.attachments` and `ThreadMessageData.attachments` are both live, tested, and structurally compatible — any future screen that passes a `MessageVM` straight into `ThreadMessage` (as `chat-screen.tsx` already does) gets attachment rendering with zero additional wiring.
- Plan 05 (attach button/chip UI in the compose screen) and Plan 06 (reply-flow wiring, `/v2/tickets` write path) can now build with confidence that whatever they successfully attach and send will round-trip and render correctly on the next fetch, since the read path (this plan) is proven end-to-end against `getTicket`'s real response shape.
- `toAttachmentChipVM` in `thread-message.tsx` is a small, local adapter (not exported) — if Plan 05/06/08 need the same `Attachment → AttachmentChipVM` mapping elsewhere, consider promoting it to a shared helper rather than duplicating it, but no such need exists yet.
- No blockers identified for downstream plans.

## Self-Check: PASSED

- `src/store/active-conversation-store.ts` — FOUND, contains `attachments?: Attachment[]`
- `src/query/side-conversation-queries.ts` — FOUND, `normalizeComment` projects `attachments`
- `src/screens/components/thread-message.tsx` — FOUND, contains `ThreadAttachments` and `attachments?: Attachment[]`
- Commit `06b8eb5` — FOUND in `git log --oneline --all`
- Commit `a998902` — FOUND in `git log --oneline --all`
- Full test suite: 28 suites / 271 tests passing
- `tsc --noEmit`: clean
- Acceptance-criteria greps: all pass (`attachments?: Attachment\[\]` = 1 in both files, `noopener noreferrer` ≥ 1, `window.open` = 0, `AttachmentChip` ≥ 1)

---
*Phase: 04-dosya-ekleri-ve-inline-g-rseller*
*Completed: 2026-08-01*
