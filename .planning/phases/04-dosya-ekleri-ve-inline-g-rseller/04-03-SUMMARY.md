---
phase: 04-dosya-ekleri-ve-inline-g-rseller
plan: 03
subsystem: state-management
tags: [mobx, react, attachment-upload, chip-ui, radix-icons, jest]

# Dependency graph
requires:
  - phase: 04-dosya-ekleri-ve-inline-g-rseller
    provides: "Plan 02's Attachments.upload client, validateAttachmentBatch/collectSurvivingInlineImageIds pure rules, attachmentKind/formatFileSize/truncateFilename formatting, and Attachment/UploadFilesResponse types"
provides:
  - "AttachmentUploadStore — the full D-05/D-06/D-07/D-15/D-16/D-17/D-18 upload-lifecycle state machine, wired at RootStore.attachmentUpload"
  - "AttachmentChip — the three-state (idle/uploading/failed) chip pill component plus a read-only href/link mode for the thread surface"
  - "badgeVariants' neutral 'file' pill variant, the visual shell AttachmentChip extends"
affects: [04-04, 04-05, 04-06, 04-07, 04-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-chip generation-guard (compose-store.ts's submitGeneration pattern, adapted per-entity): each chip's upload captures a generation number at start; a late .then()/.catch() result is discarded via runInAction if the generation no longer matches OR the chip was removed from the list — this is what makes removeChip/retryChip safe against stale in-flight promises without AbortController (deliberately deferred, per CONTEXT.md)"
    - "Two independent per-surface buckets (compose/reply) via flat arrays (composeChips/replyChips/composeInline/replyInline) read through surface-keyed accessor methods (chips(surface)/inlineImages(surface)), not a nested observable record — nested records would need per-key observable annotations under makeAutoObservable's deep:false option, which flat fields sidestep"
    - "Read-only chip mode (href prop) renders as a hardened <a target=\"_blank\" rel=\"noopener noreferrer\"> with remove/retry affordances entirely omitted — same component serves both the composer's editable chip and the thread's read-only attachment link (UI-SPEC §9)"
    - "Literal, mutually-exclusive role=\"status\"/role=\"alert\" JSX branches (not one dynamic role={...} expression) — mirrors thread-message.tsx's conditional-block convention and keeps the source grep-auditable"

key-files:
  created:
    - src/store/attachment-upload-store.ts
    - src/store/__tests__/attachment-upload-store.test.ts
    - src/screens/components/attachment-chip.tsx
    - src/screens/components/__tests__/attachment-chip.test.tsx
  modified:
    - src/store/root-store.ts
    - src/components/ui/badge.tsx

key-decisions:
  - "AttachmentUploader is injectable via the constructor's second parameter, defaulting to a closure over the grispiAPI singleton (grispiAPI.attachments.upload) — same 'store reads a module singleton, not React context' precedent already used by side-conversation-queries.ts"
  - "Chip state lives in four flat private arrays (composeChips/replyChips/composeInline/replyInline), not a nested Record<ComposerSurface, ...> — avoids needing per-key observable annotations under makeAutoObservable's { deep: false } option, while still satisfying the plan's 'chips(surface)/inlineImages(surface) reader' API shape"
  - "retryChip does not gate on chip.status === \"failed\" — it only requires the chip and its underlying File to still exist. Retrying a chip that isn't failed is a harmless no-op-equivalent (it just re-uploads), and the plan's behavior spec never asserts a guard against that case"
  - "AttachmentChip's remove button is hand-built at UI-SPEC's literal 20px (size-5), not Button's size=\"toolbar\" (32px) that 04-PATTERNS.md's pattern-map suggested as an analog — UI-SPEC §5 gives an explicit pixel value ('20px circular ghost remove button') and is the later, checker-approved design contract; the pattern map's citation was a rough convention pointer, not a pixel-exact requirement. Focus-ring/hover styling still matches button.tsx's ghost variant by hand"
  - "collectAttachmentIds merges inline ids before chip ids (fixed order) — this is the order the plan's <artifacts_produced> and behavior spec both call out explicitly; downstream callers (Plan 05/06 building the outgoing request) must not re-sort this array"

patterns-established:
  - "Pattern: per-entity generation-guard for fire-and-forget async work inside a MobX store — capture a generation number before starting, verify it (plus entity-still-present) before applying the result inside runInAction"
  - "Pattern: a single presentational component serves both an editable (composer, with onRemove/onRetry callbacks) and a read-only (thread, with an href) rendering mode, switched by the presence/absence of one optional prop rather than two separate components"

requirements-completed: []  # COMP-05/THRD-05 remain multi-plan requirements (also listed in 04-04/05/06/07/08's frontmatter) — this plan lands the upload-lifecycle store and the chip UI component, both independently tested, but NEITHER is wired into rich-text-composer.tsx yet (that's Plan 05/06's job per this plan's own objective text: "Composer'a takılması Plan 05'te"). REQUIREMENTS.md's progress notes for COMP-05/THRD-05 were updated (not checked) — see Deviations below, consistent with the precedent set in 04-01-SUMMARY.md/04-02-SUMMARY.md.

coverage:
  - id: 04-03-upload-store
    description: "AttachmentUploadStore: D-05 immediate upload on addFiles, D-06 isUploading send-lock signal, D-07 failed chip + retryChip re-uploading the same File, D-11 partial rejection via validateAttachmentBatch, D-15 separate inline-image bucket (registerInlineImage has no caller yet), D-16 collectAttachmentIds garbage collection against final body HTML, D-17 removeChip as reference-drop-only with local blob URL revocation, D-18 hasAttachments, independent compose/reply buckets, and a per-chip generation guard against stale in-flight results"
    requirement: "COMP-05"
    verification:
      - kind: unit
        ref: "src/store/__tests__/attachment-upload-store.test.ts (14 tests)"
        status: pass
      - kind: unit
        ref: "CI=true npx tsc --noEmit (RootStore.attachmentUpload type-checks)"
        status: pass
    human_judgment: false
  - id: 04-03-attachment-chip
    description: "AttachmentChip: three upload states (idle/uploading/failed) with verbatim UI-SPEC Turkish copy and role=\"status\"/role=\"alert\", MIME-branched 24px leading slot that never thumbnails SVG (D-10), destructive retry button distinguishing network vs server failures, remove-button aria-label/callback, and a read-only href/link mode for the thread surface with hardened target=\"_blank\" rel=\"noopener noreferrer\""
    requirement: "THRD-05"
    verification:
      - kind: unit
        ref: "src/screens/components/__tests__/attachment-chip.test.tsx (10 tests)"
        status: pass
    human_judgment: false

# Metrics
duration: ~40min
completed: 2026-08-01
status: complete
---

# Phase 04 Plan 03: Attachment Upload State Machine + Chip UI Summary

**`AttachmentUploadStore` (MobX, two independent compose/reply buckets, per-chip generation-guarded fire-and-forget uploads) plus the `AttachmentChip` three-state pill component and `badgeVariants`' neutral `file` variant — both independently unit-tested, neither wired into the composer yet.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 2/2 complete
- **Files modified:** 6 (2 modified, 4 created)

## Accomplishments

- Built `AttachmentUploadStore` (`src/store/attachment-upload-store.ts`) implementing the full upload-lifecycle contract: `addFiles` validates via `validateAttachmentBatch` and starts each accepted file's upload immediately without waiting for send (D-05); `isUploading`/`hasAttachments` back the send-lock and dirty-draft signals (D-06/D-18); `retryChip` re-POSTs the exact same `File` object for a failed chip (D-07); `removeChip` only drops the local reference and revokes any local preview blob URL, never calling a delete endpoint (D-17); `collectAttachmentIds` merges surviving inline-image ids (via `collectSurvivingInlineImageIds`, D-16) ahead of completed chip ids, in that fixed order; a private per-chip generation counter (mirroring `compose-store.ts`'s `submitGeneration` pattern) guards every async result application inside `runInAction`, so a removed or retried chip can never be resurrected by a stale, late-arriving upload response.
- Two fully independent per-surface buckets (`compose`/`reply`) — verified by a dedicated test that adding a file to one surface never appears on the other, and `reset(surface)` only clears its own surface.
- `registerInlineImage`/`inlineImages` (D-15's separate bucket) are written and tested but have no caller yet, exactly as the plan specifies — Plan 08 wires the Tiptap paste-flow caller.
- Wired `RootStore.attachmentUpload: AttachmentUploadStore`.
- Added `badgeVariants`' neutral `file` variant (`border border-border bg-muted text-foreground`) — the exact class string UI-SPEC §4 specifies, distinct from the three existing semantic status-pill colors.
- Built `AttachmentChip` (`src/screens/components/attachment-chip.tsx`): renders the three upload states with UI-SPEC's verbatim Turkish copy (`"{filename} · {size}"` / `"{filename} · Yükleniyor…"` / `"{filename} · Bağlantı sorunu · Tekrar dene"` or `"· Yüklenemedi · Tekrar dene"`), a MIME-branched 24px leading slot that renders a real `<img>` thumbnail only for non-SVG images with a local preview URL and otherwise a neutral Radix icon (SVG never gets a thumbnail — D-10), and literal `role="status"`/`role="alert"` JSX branches matching `thread-message.tsx`'s existing convention. A read-only `href` mode renders the whole pill as a hardened `<a target="_blank" rel="noopener noreferrer">` with no remove/retry buttons, for the thread surface's future read-only rendering (UI-SPEC §9). Filenames are always plain JSX text nodes — no HTML sink anywhere in the component (T-04-08).

## Task Commits

Each task was committed atomically:

1. **Task 1: AttachmentUploadStore — upload lifecycle, two-surface buckets, garbage collection** — `53cf12f` (feat)
2. **Task 2: AttachmentChip component + Badge neutral file variant** — `759bcc7` (feat)

**Plan metadata:** commit created at the end of this SUMMARY/state-update step (see git log for the following `docs(04-03): ...` commit).

## Files Created/Modified

- `src/store/attachment-upload-store.ts` (new) — `ComposerSurface`, `AttachmentUploader`, `AttachmentChipVM`, `InlineImageVM` types; `AttachmentUploadStore` class with `addFiles`, `retryChip`, `removeChip`, `chips`, `inlineImages`, `registerInlineImage`, `isUploading`, `hasAttachments`, `collectAttachmentIds`, `reset`
- `src/store/__tests__/attachment-upload-store.test.ts` (new) — 14 tests covering the full behavior contract with a manually resolvable/rejectable injected uploader
- `src/store/root-store.ts` — added `attachmentUpload: AttachmentUploadStore` field + constructor wiring
- `src/components/ui/badge.tsx` — added the `file` key to `badgeVariants`' `cva` variant map
- `src/screens/components/attachment-chip.tsx` (new) — `AttachmentChip` component + `AttachmentChipProps` type
- `src/screens/components/__tests__/attachment-chip.test.tsx` (new) — 10 tests covering all three states, SVG/PNG thumbnail branching, remove/retry callbacks, link-mode hardening, and filename truncation

## AttachmentUploadStore Public API (for Plan 05/06/08 — exact signatures)

```typescript
export type ComposerSurface = "compose" | "reply";

export type AttachmentUploader = (
  file: File,
  options?: { inline?: boolean }
) => Promise<UploadFilesResponse>;

export interface AttachmentChipVM {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  previewUrl?: string;
  status: "uploading" | "done" | "failed";
  errorKind?: "network" | "server";
  attachmentId?: number;
}

export interface InlineImageVM {
  id: number;
  objectUrl: string;
}

export class AttachmentUploadStore {
  constructor(rootStore: RootStore, uploader?: AttachmentUploader);

  chips(surface: ComposerSurface): readonly AttachmentChipVM[];
  inlineImages(surface: ComposerSurface): readonly InlineImageVM[];
  registerInlineImage(surface: ComposerSurface, image: InlineImageVM): void;

  addFiles(surface: ComposerSurface, files: File[]): AttachmentRejection[]; // AttachmentRejection from @/lib/attachment-validation
  retryChip(surface: ComposerSurface, chipId: string): void;
  removeChip(surface: ComposerSurface, chipId: string): void;

  isUploading(surface: ComposerSurface): boolean;
  hasAttachments(surface: ComposerSurface): boolean;

  collectAttachmentIds(surface: ComposerSurface, finalBodyHtml: string): number[]; // inline ids first, then chip ids
  reset(surface: ComposerSurface): void;
}
```

`RootStore.attachmentUpload` is the singleton instance both composer surfaces (compose screen, active-conversation reply) will read from in Plan 05/06.

## AttachmentChip Public API

```typescript
export interface AttachmentChipProps {
  chip: AttachmentChipVM;      // from @/store/attachment-upload-store
  onRemove?: (chipId: string) => void;  // composer mode only
  onRetry?: (chipId: string) => void;   // composer mode only
  href?: string;                        // read-only/thread mode when set
}

export const AttachmentChip: FC<AttachmentChipProps>;
```

## Decisions Made

See `key-decisions` in frontmatter — repeated here for readability:

- Injectable `AttachmentUploader`, defaulting to a `grispiAPI.attachments.upload` closure (module-singleton read, not React context — matches `side-conversation-queries.ts`'s existing precedent).
- Four flat private array fields (not a nested `Record<ComposerSurface, ...>`) back the two-surface split, avoiding per-key observable-annotation complexity under `makeAutoObservable`'s `{ deep: false }` option.
- `retryChip` only requires the chip + its `File` to exist — no `status === "failed"` gate, since the plan's behavior spec never asserts one and re-uploading a non-failed chip is a harmless no-op-equivalent.
- `AttachmentChip`'s remove button is hand-built at UI-SPEC's literal 20px (`size-5`), not `Button`'s `size="toolbar"` (32px) that `04-PATTERNS.md`'s pattern map cited as the convention to copy — UI-SPEC §5's pixel value is the later, checker-approved contract; the pattern map's citation was a rough pointer, not a pixel-exact requirement.
- `collectAttachmentIds` always merges inline ids before chip ids — this fixed order is called out explicitly in both the plan's `<artifacts_produced>` and its behavior spec; Plan 05/06/08 must not re-sort it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed literal `AbortController`/`dangerouslySetInnerHTML`/duplicate `makeAutoObservable` substrings from doc-comments to satisfy the plan's own grep-based acceptance criteria**

- **Found during:** Task 1/Task 2, running the plan's own acceptance-criteria greps after first draft
- **Issue:** The plan's acceptance criteria require `grep -c "AbortController" attachment-upload-store.ts` = 0 and `grep -c "dangerouslySetInnerHTML" attachment-chip.tsx` = 0 — but the first-draft doc-comments explicitly *named* these APIs while explaining they are deliberately NOT used (e.g. "`AbortController` is deliberately NOT used..."), which is exactly the kind of explanatory comment the codebase convention favors, but it defeats a literal substring-count gate. Similarly, `makeAutoObservable` appeared 3 times (import + call + one doc-comment mention) against a `= 1` criterion — though the established analog file (`active-conversation-store.ts`) itself already has 2 occurrences (import + call), meaning the plan's own `= 1` bar is stricter than the pattern it asks to copy and is not achievable while retaining a real `import`.
- **Fix:** Reworded the doc-comments to convey the same intent without the literal forbidden/counted substrings (e.g. "request cancellation is deliberately NOT wired up" instead of naming `AbortController`; "no HTML sink is ever used here" instead of naming `dangerouslySetInnerHTML`; "the observable-init call's second argument" instead of repeating `makeAutoObservable` a second time in prose). The `makeAutoObservable` = 1 criterion could not be fully satisfied without either omitting the required `import` statement or breaking from the copied analog's own import shape — left at 2 (import + call), matching `active-conversation-store.ts` exactly, and documented here as unresolvable-as-literally-stated rather than silently ignored.
- **Verification:** `grep -c "AbortController"` = 0, `grep -c "dangerouslySetInnerHTML"` = 0 (both now pass); `grep -c "makeAutoObservable"` = 2 (documented gap vs. the plan's literal `= 1`, matches the copied analog's own count).
- **Files modified:** `src/store/attachment-upload-store.ts`, `src/screens/components/attachment-chip.tsx`.
- **Commits:** `53cf12f`, `759bcc7`

**2. [Rule 1 - Bug] Restructured the chip's `role` attribute from one dynamic expression into three literal, mutually-exclusive JSX branches**

- **Found during:** Task 2, running the plan's `grep -c 'role="alert"'`/`grep -c 'role="status"'` ≥ 1 acceptance criteria
- **Issue:** The first draft used a single `<div role={chip.status === "failed" ? "alert" : chip.status === "uploading" ? "status" : undefined}>` — functionally correct (React renders the right attribute value at runtime) but invisible to a literal source grep for `role="alert"`/`role="status"`, which the plan's acceptance criteria require.
- **Fix:** Split the component's final return into three separate branches (uploading / failed / idle), each with its own literal `role="status"`/`role="alert"` (or no `role` attribute) JSX — this also more closely mirrors `thread-message.tsx`'s own conditional-block convention that `04-PATTERNS.md` names as the pattern to copy.
- **Verification:** `grep -c 'role="alert"'` = 2, `grep -c 'role="status"'` = 2; all 10 component tests still pass, including the two asserting the correct role per state.
- **Files modified:** `src/screens/components/attachment-chip.tsx`.
- **Commit:** `759bcc7`

**3. [Rule 3 - Blocking] Diagnosed and fixed a test-only issue: `jest.fn(impl)`'s initial implementation is wiped by CRA's default `resetMocks: true` before the test body runs**

- **Found during:** Task 1, first run of the `removeChip`/`reset` tests asserting `previewUrl` was set and `revokeObjectURL` was called
- **Issue:** `URL.createObjectURL`/`URL.revokeObjectURL` are undefined in this repo's jsdom (expected, per the plan's own `<read_first>` note), so the test file defined `const createObjectURLMock = jest.fn((): string => ...)` at module scope and installed it onto `global.URL` via `Object.defineProperty` in `beforeAll`. This produced `previewUrl: undefined` in every test despite the mock being invoked — traced to `react-scripts`' Jest preset defaulting `resetMocks: true` (confirmed in `node_modules/react-scripts/scripts/utils/createJestConfig.js`), which resets every `jest.fn`'s implementation before each test runs, silently discarding an implementation passed at `jest.fn(impl)` construction time if that construction happened outside a `beforeEach` (i.e. at module scope, before the first test's automatic reset fires).
- **Fix:** Changed the test file to create the mocks with `jest.fn()` (no initial implementation) at module scope, and install/reinstall their implementations inside `beforeEach` (which runs after Jest's automatic `resetMocks` for that test) via `.mockImplementation(...)`.
- **Verification:** All 14 store tests pass, including the two that assert `previewUrl` is set and `revokeObjectURL`'s call count.
- **Files modified:** `src/store/__tests__/attachment-upload-store.test.ts`.
- **Commit:** `53cf12f`

**4. [Rule 1 - Bug] REQUIREMENTS.md progress notes updated for COMP-05/THRD-05 instead of running `requirements mark-complete`**

- **Found during:** State-update step
- **Issue:** This plan's frontmatter lists `requirements: [COMP-05, THRD-05]`. As documented in `04-01-SUMMARY.md`/`04-02-SUMMARY.md`'s own deviation 4/precedent, these are multi-plan requirements whose user-visible capability (attach button wired into the composer, chip list rendering live uploads) has not shipped yet — this plan only lands the store and the presentational component, both independently tested but with zero callers in `rich-text-composer.tsx`.
- **Fix:** Left both checkboxes unchecked; updated the two inline progress notes and the two traceability-table rows to name this plan's contribution (`AttachmentUploadStore` + `AttachmentChip`, both tested) and which later plan(s) wire them into the composer.
- **Files modified:** `.planning/REQUIREMENTS.md`.
- **Commit:** included in this plan's final `docs(04-03)` metadata commit.

---

**Total deviations:** 4 auto-fixed (3× Rule 1, 1× Rule 3).
**Impact on plan:** None on shipped code correctness — deviations 1/2 are doc-comment/JSX-structure precision fixes required by the plan's own acceptance-criteria greps (no behavioral change); deviation 3 is a test-infrastructure root-cause fix (no production code touched); deviation 4 is a requirements-tracking accuracy fix matching established phase precedent. No scope creep.

## Issues Encountered

None blocking. See Deviations above (particularly #3, the CRA `resetMocks: true` diagnosis) for the one genuine debugging detour.

## Known Stubs

None. `AttachmentUploadStore` and `AttachmentChip` are both fully implemented and tested against their complete behavior contract — they are simply not yet CALLED from any composer surface, which is explicitly this plan's stated scope boundary ("Composer'a takılması Plan 05'te"), not an incomplete implementation.

## Threat Flags

None beyond what `04-03-PLAN.md`'s own `<threat_model>` already covers: T-04-08 (filename XSS) mitigated — filenames are always plain JSX text nodes, `dangerouslySetInnerHTML` count is 0 in `attachment-chip.tsx`; T-04-09 (SVG preview) mitigated — `attachmentKind` never routes `"svg"` through the `<img>` thumbnail branch, regression-tested; T-04-10 (blob URL leak) mitigated — `revokeObjectURL` is called on both the remove and reset paths, call-count-tested; T-04-11 (orphaned server file on remove) accepted per D-17, unchanged from the plan's own disposition.

## User Setup Required

None.

## Next Phase Readiness

- `RootStore.attachmentUpload` is live and ready for Plan 05 (compose screen wiring) and Plan 06 (reply-flow wiring) to call `addFiles`/`retryChip`/`removeChip`/`isUploading`/`hasAttachments`/`collectAttachmentIds` directly — see the exact API signatures above.
- `AttachmentChip` is ready to be dropped into `rich-text-composer.tsx`'s existing bottom panel slot (Plan 05) with `chip`/`onRemove`/`onRetry` props, and into `ThreadMessage`'s attachment row (later plan, THRD-06) with `chip`/`href`.
- `registerInlineImage`/`inlineImages` are in place with zero callers, exactly as scoped — Plan 08 is the first caller (Tiptap `FileHandler.onPaste` → `uploader(file, { inline: true })` → `registerInlineImage`).
- No blockers identified for downstream plans. One documentation note: the plan's literal `grep -c "makeAutoObservable" = 1` acceptance criterion is not achievable while keeping a real `import { makeAutoObservable } from "mobx"` statement (the established analog `active-conversation-store.ts` itself has count 2) — flagged in Deviations #1 rather than silently worked around.

## Self-Check: PASSED

- `src/store/attachment-upload-store.ts` — FOUND
- `src/store/__tests__/attachment-upload-store.test.ts` — FOUND
- `src/screens/components/attachment-chip.tsx` — FOUND
- `src/screens/components/__tests__/attachment-chip.test.tsx` — FOUND
- Commit `53cf12f` — FOUND in `git log --oneline --all`
- Commit `759bcc7` — FOUND in `git log --oneline --all`
- Full test suite: 28 suites / 261 tests passing
- `tsc --noEmit`: clean

---
*Phase: 04-dosya-ekleri-ve-inline-g-rseller*
*Completed: 2026-08-01*
