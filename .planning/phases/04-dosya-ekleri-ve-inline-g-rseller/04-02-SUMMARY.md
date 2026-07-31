---
phase: 04-dosya-ekleri-ve-inline-g-rseller
plan: 02
subsystem: api
tags: [grispi-rest, attachments, multipart-upload, mobx-adjacent-pure-functions, jest]

# Dependency graph
requires:
  - phase: 04-dosya-ekleri-ve-inline-g-rseller
    provides: "Plan 01's live-verified upload contract (root path, files field, always-array response, inline round-trip), attachment-test-helpers.ts (makeTestFile)"
provides:
  - "HttpHandler.sendMultipart — a multipart-safe sibling to send<T> that never leaks the default Content-Type header"
  - "Attachments API client (grispiAPI.attachments.upload) hitting the probe-confirmed root path"
  - "Attachment/UploadFilesResponse types with a real (probe-confirmed) inline field, and optional attachmentIds on both write-request types"
  - "Four pure rule functions the chip UI (Plan 05) and inline-paste flow (Plan 04/08) will call directly: validateAttachmentBatch, collectSurvivingInlineImageIds, formatFileSize/truncateFilename/attachmentKind/rejectionToastLines"
affects: [04-04, 04-05, 04-06, 04-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sendMultipart never spreads HttpHandler.headers — only the caller's extraHeaders (Authentication.headers) reach fetch, so the browser generates its own multipart boundary"
    - "Attachment upload path has no public/v1 prefix: POST https://api.grispi.net/attachments/upload (root), confirmed by both this plan's tests and Plan 01's live probe"
    - "Pure validation/formatting functions live outside any store (src/lib/, no DOM/React/MobX imports) so the chip UI store can call them directly without mocking"

key-files:
  created:
    - src/grispi/client/attachments.ts
    - src/grispi/client/__tests__/attachments.test.ts
    - src/lib/attachment-validation.ts
    - src/lib/__tests__/attachment-validation.test.ts
    - src/lib/attachment-format.ts
    - src/lib/__tests__/attachment-format.test.ts
  modified:
    - src/grispi/client/http-handler.ts
    - src/grispi/client/__tests__/http-handler.test.ts
    - src/grispi/client/api.ts
    - src/types/grispi.type.ts

key-decisions:
  - "sendMultipart is a genuinely separate method (not send<T> with a header override) — the class's default headers object is never referenced inside it"
  - "Attachments.upload final path string: 'attachments/upload' (root, via HttpHandler's ${baseUrl}/${url} template) — no public/v1 prefix, matches Plan 01's live-verified A1 finding exactly"
  - "Attachment.inline is a real, load-bearing optional field (not a documented no-op) — Plan 01's live probe confirmed it round-trips as inline:true"
  - "UploadFilesResponse is kept as its own named interface (same field set as Attachment) rather than a type alias, matching the acceptance-criteria grep for 'export interface UploadFilesResponse'"
  - "REJECTION_SIZE_LIMIT_LABEL in the rejection-toast copy is a literal '10 MB' (not formatFileSize(MAX_ATTACHMENT_BYTES), which would render '10,0 MB') — the Copywriting Contract's fixed limit label has no decimal, unlike the per-file {size} next to it"
  - "COMP-05/COMP-08/THRD-05 are NOT marked complete in REQUIREMENTS.md — this plan lands only the transport/pure-rules layer (no UI); precedent set in 04-01-SUMMARY deviation 4. Traceability table rows updated with a progress note instead of checking the box"

patterns-established:
  - "Pattern: multipart upload calls go through HttpHandler.sendMultipart, never a direct fetch() — same discipline as send<T> for JSON calls"
  - "Pattern: chip-facing business rules (limits, GC, formatting, copy) are pure functions in src/lib/, independently unit-tested without any store/DOM/upload mocking"

requirements-completed: []  # COMP-05/COMP-08/THRD-05 remain multi-plan requirements — this plan lands the shared upload client, types, and pure validation/format rules; the user-visible attach/chip UI ships in Plan 05, inline-paste UI in Plan 04/08, reply-flow wiring in Plan 06. See key-decisions above.

coverage:
  - id: 04-02-sendmultipart
    description: "HttpHandler.sendMultipart omits Content-Type entirely (browser sets its own multipart boundary) while preserving the NetworkError/HttpError taxonomy"
    requirement: "COMP-05"
    verification:
      - kind: unit
        ref: "src/grispi/client/__tests__/http-handler.test.ts#HttpHandler.sendMultipart (7 tests)"
        status: pass
    human_judgment: false
  - id: 04-02-attachments-client
    description: "Attachments.upload posts to the probe-confirmed root path with the 'files' field, supports ?inline=true, consumes the first element of the always-array response, and is wired to grispiAPI.attachments"
    requirement: "COMP-05"
    verification:
      - kind: unit
        ref: "src/grispi/client/__tests__/attachments.test.ts#Attachments.upload (7 tests)"
        status: pass
      - kind: unit
        ref: "CI=true npx tsc --noEmit (grispiAPI.attachments type-checks)"
        status: pass
    human_judgment: false
  - id: 04-02-pure-rules
    description: "validateAttachmentBatch (D-08/D-11 batch policy, partial rejection, priority order), collectSurvivingInlineImageIds (D-16 GC), formatFileSize/truncateFilename/attachmentKind/rejectionToastLines (Turkish copy, D-10 SVG distinction)"
    requirement: "COMP-05"
    verification:
      - kind: unit
        ref: "src/lib/__tests__/attachment-validation.test.ts (10 tests) + src/lib/__tests__/attachment-format.test.ts (17 tests)"
        status: pass
    human_judgment: false

# Metrics
duration: ~20min
completed: 2026-08-01
status: complete
---

# Phase 04 Plan 02: Attachment Upload Client + Types + Pure Chip Rules Summary

**HttpHandler.sendMultipart (never leaks the default JSON Content-Type header) plus an Attachments client posting to the probe-confirmed root `attachments/upload` path, live-accurate `Attachment`/`UploadFilesResponse` types with a real `inline` field, and four independently-tested pure functions (batch validation, D-16 garbage collection, Turkish size/truncation formatting, rejection-toast copy) that Plan 05's chip UI will call directly.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3/3 complete
- **Files modified:** 10 (4 modified, 6 created)

## Accomplishments

- Added `HttpHandler.sendMultipart<T>` as a genuinely separate sibling to `send<T>` — it never spreads or otherwise references the class's default `headers` field, closing the exact bug (`Content-Type: "undefined"` breaking multipart boundary generation) it exists to prevent; locked with a regression test asserting no `Content-Type` key reaches `fetch`.
- Built `Attachments.upload(file, { inline? })`, POSTing multipart to the **live-probe-confirmed** root path `attachments/upload` (no `public/v1` prefix — this diverges from every other client method in the codebase, per Plan 01's A1 finding), field name `files` (plural), consuming the first element of the always-array response.
- Wired `grispiAPI.attachments` alongside the existing `tickets`/`users`/`customers` triple in `api.ts`.
- Exported `Attachment` (previously module-internal) with a real, probe-confirmed optional `inline?: boolean` field; added `UploadFilesResponse` (same shape, its own named interface); added optional `attachmentIds?: number[]` to both `CreateTicketRequest.comment` and `ReplyTicketPatchRequest.comment` with omit-when-empty doc-comments.
- Wrote four pure, DOM/React/MobX-free rule functions in `src/lib/`: `validateAttachmentBatch` + `collectSurvivingInlineImageIds` (`attachment-validation.ts`), and `formatFileSize` + `truncateFilename` + `attachmentKind` + `rejectionToastLines` (`attachment-format.ts`) — all independently unit-tested (27 new tests) without any store/DOM/upload mocking.

## Task Commits

Each task was committed atomically:

1. **Task 1: HttpHandler.sendMultipart** — `80debab` (feat)
2. **Task 2: Attachments client + types + facade wiring** — `810d8cd` (feat)
3. **Task 3: Pure rules (validation, GC, formatting)** — `e6b63a6` (test)

**Plan metadata:** commit created at the end of this SUMMARY/state-update step (see git log for the following `docs(04-02): ...` commit).

## Files Created/Modified

- `src/grispi/client/http-handler.ts` — added `sendMultipart<T>(url, formData, extraHeaders)` sibling method
- `src/grispi/client/__tests__/http-handler.test.ts` — new `describe("HttpHandler.sendMultipart", ...)` block, 7 tests
- `src/grispi/client/attachments.ts` (new) — `Attachments` class, single `upload()` method
- `src/grispi/client/__tests__/attachments.test.ts` (new) — 7 tests covering path, inline suffix, field name, headers, response unwrapping, empty-array error
- `src/grispi/client/api.ts` — `Attachments` import + `readonly attachments` field + constructor wiring
- `src/types/grispi.type.ts` — exported `Attachment` with `inline?: boolean`; new `UploadFilesResponse`; `attachmentIds?: number[]` on both write-request `comment` shapes
- `src/lib/attachment-validation.ts` (new) — `MAX_ATTACHMENT_BYTES`/`MAX_ATTACHMENT_TOTAL_BYTES`/`MAX_ATTACHMENT_COUNT`, `validateAttachmentBatch`, `collectSurvivingInlineImageIds`
- `src/lib/__tests__/attachment-validation.test.ts` (new) — 10 tests
- `src/lib/attachment-format.ts` (new) — `AttachmentKind`, `attachmentKind`, `formatFileSize`, `truncateFilename`, `rejectionToastLines`
- `src/lib/__tests__/attachment-format.test.ts` (new) — 17 tests

## Decisions Made

See `key-decisions` in frontmatter — repeated here for readability:

- `sendMultipart` is a genuinely separate method, never reusing/overriding `this.headers`.
- Final upload path: `attachments/upload` (root, no `public/v1` prefix).
- `Attachment.inline` is real and load-bearing (Plan 01 probe confirmed round-trip).
- `UploadFilesResponse` stays a named `interface` (not a type alias) per the plan's own grep-based acceptance criteria.
- The rejection-toast size-limit label is a literal `"10 MB"`, not derived from `formatFileSize`, to match the Copywriting Contract's exact (non-decimal) fixed text.
- COMP-05/COMP-08/THRD-05 stay unchecked in REQUIREMENTS.md (transport/pure-rules only, no UI yet) — see Deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `UploadFilesResponse` implemented as an explicit-field `interface`, not `extends Attachment {}`**

- **Found during:** Task 2(a), first draft of `src/types/grispi.type.ts`
- **Issue:** The most DRY implementation (`export interface UploadFilesResponse extends Attachment {}`) is an empty-body interface extension, which several TypeScript ESLint configs flag as `@typescript-eslint/no-empty-interface`; adding a blanket disable comment risked an "unused eslint-disable directive" warning if the rule isn't actually enabled in this repo's `eslintConfig` (`react-app`/`react-app/jest`, not independently verified either way).
- **Fix:** Wrote `UploadFilesResponse` as its own interface with the full explicit field list (identical shape to `Attachment`) instead of `extends`. No behavioral difference; both compile to the same structural type.
- **Verification:** `CI=true npx tsc --noEmit` clean; `grep -c "export interface UploadFilesResponse"` = 1 (acceptance criteria).
- **Files modified:** `src/types/grispi.type.ts`.
- **Commit:** `810d8cd`

**2. [Rule 1 - Bug] Rejection-toast size-limit label corrected from a computed value to a literal string**

- **Found during:** Task 3(b), while wiring `rejectionToastLines`'s size-rejection line
- **Issue:** The natural DRY approach — computing the "sınır 10 MB" label via `formatFileSize(MAX_ATTACHMENT_BYTES)` — produces `"10,0 MB"` (formatFileSize always emits one decimal for the MB range), which does not byte-match the UI-SPEC Copywriting Contract's literal example text `"sınır 10 MB"` (no decimal). The acceptance criteria explicitly require the Turkish copy to match the contract "birebir" (verbatim).
- **Fix:** Replaced the computed label with a literal `${MAX_ATTACHMENT_BYTES / BYTES_PER_MB} MB"` expression (still derived from the named constant, not a bare magic number, but formatted without `formatFileSize`'s decimal convention) — evaluates to the literal string `"10 MB"`.
- **Verification:** `src/lib/__tests__/attachment-format.test.ts`'s size-rejection test asserts the line contains `"sınır 10 MB"` exactly.
- **Files modified:** `src/lib/attachment-format.ts`.
- **Commit:** `e6b63a6`

**3. [Rule 1 - Bug] Corrected a self-authored test fixture for the total-size rejection case**

- **Found during:** Task 3(c), first test run of `attachment-validation.test.ts`
- **Issue:** The initial test used two files each sized `MAX_ATTACHMENT_TOTAL_BYTES / 2 + 1` (~12.5MB) to trigger a total-size rejection on the second file — but each individual file already exceeded the 10MB per-file cap, so both were rejected for `"size"` before the total-size check ever ran (correctly demonstrating priority-ordering, but not what the test intended to assert).
- **Fix:** Rewrote the fixture with three 9MB files (each under the per-file cap; three together exceed the 25MB total) so the first two are accepted and the third is rejected `"total-size"`, as the test name states.
- **Verification:** `CI=true npx craco test --watchAll=false --testPathPattern="attachment-(validation|format)"` — 27/27 pass.
- **Files modified:** `src/lib/__tests__/attachment-validation.test.ts`.
- **Commit:** `e6b63a6`

**4. [Rule 1 - Bug] REQUIREMENTS.md traceability rows updated with a progress note instead of running `requirements mark-complete`**

- **Found during:** State-update step
- **Issue:** This plan's frontmatter lists `requirements: [COMP-05, COMP-08, THRD-05]`, and the standard state-update flow calls for running `requirements mark-complete` on these IDs. As documented in `04-01-SUMMARY.md`'s own deviation 4, these are multi-plan requirements (also listed in Plans 03/05/06/07/08's frontmatter) whose user-visible capability (attach button, chip list, inline-paste UI) has not shipped yet — this plan only lands the transport client and pure rule functions. Running the generic mark-complete command would have re-introduced the exact false-completion record Plan 01 had to revert.
- **Fix:** Left the checkboxes unchecked; manually updated the two affected traceability table rows (`COMP-05`, `THRD-05`) with a one-line progress note naming what Plan 02 contributed and which later plan(s) ship the observable behavior. `COMP-08` has no traceability table row (pre-existing gap from before this plan, out of scope to add here).
- **Files modified:** `.planning/REQUIREMENTS.md`.
- **Commit:** included in this plan's final `docs(04-02)` metadata commit.

---

**Total deviations:** 4 auto-fixed (all Rule 1).
**Impact on plan:** None on shipped code correctness — all four are precision/consistency corrections (an eslint-safety rewrite, a copy-format fix required by the acceptance criteria, a test-fixture bug fix, and a requirements-tracking accuracy fix matching established phase precedent). No scope creep.

## Issues Encountered

None blocking.

## Known Stubs

None. No UI-facing component renders these functions/types yet — that begins in Plan 05 (chip UI). All shipped code in this plan (client method, types, pure functions) is fully wired and tested, not a placeholder.

## Threat Flags

None beyond what `04-02-PLAN.md`'s own `<threat_model>` already covers (T-04-04 mitigated by the header regression test; T-04-05/T-04-06/T-04-07 accepted/mitigated exactly as designed — see the plan's threat register).

## User Setup Required

None.

## Next Phase Readiness

- **Final upload path string (for Plan 04/08):** `attachments/upload` (root, no `public/v1` prefix). With `?inline=true` for the inline-paste flow.
- **`Attachment.inline` round-trip status:** CONFIRMED real — Plan 01's live probe verified `?inline=true` produces `inline: true` on both the upload response and the re-fetched comment attachment. Plan 04/08 can rely on this field without a fallback.
- **`attachmentIds` contract:** optional on both `CreateTicketRequest.comment` and `ReplyTicketPatchRequest.comment`; MUST be omitted (not sent as `[]`) when empty. Binding still requires `/v2/tickets` (Plan 06's job, per 04-01's write-path split) — `public/v1` silently ignores the field even though the type now allows it on both request shapes.
- Plan 03 (recipient/UI-adjacent work, per phase plan sequence) and Plan 05 (chip UI) can now call `grispiAPI.attachments.upload`, `validateAttachmentBatch`, `collectSurvivingInlineImageIds`, `formatFileSize`, `truncateFilename`, `attachmentKind`, and `rejectionToastLines` directly — all are exported, typed, and independently tested.
- No blockers identified for downstream plans.

## Self-Check: PASSED

- `src/grispi/client/attachments.ts` — FOUND
- `src/grispi/client/__tests__/attachments.test.ts` — FOUND
- `src/lib/attachment-validation.ts` — FOUND
- `src/lib/__tests__/attachment-validation.test.ts` — FOUND
- `src/lib/attachment-format.ts` — FOUND
- `src/lib/__tests__/attachment-format.test.ts` — FOUND
- Commit `80debab` — FOUND in `git log --oneline --all`
- Commit `810d8cd` — FOUND in `git log --oneline --all`
- Commit `e6b63a6` — FOUND in `git log --oneline --all`
- Full test suite: 26 suites / 237 tests passing
- `tsc --noEmit`: clean

---
*Phase: 04-dosya-ekleri-ve-inline-g-rseller*
*Completed: 2026-08-01*
