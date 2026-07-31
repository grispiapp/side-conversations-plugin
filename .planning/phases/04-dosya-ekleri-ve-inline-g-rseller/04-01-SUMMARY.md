---
phase: 04-dosya-ekleri-ve-inline-g-rseller
plan: 01
subsystem: grispi-api-contract
tags: [grispi-rest, attachments, multipart-upload, v2-tickets, sonner, tiptap, react-dropzone, jsdom-datatransfer]

# Dependency graph
requires:
  - phase: 02-yeni-yan-g-r-me-ba-latma
    provides: "public/v1 createTicket/patchTicket client, disposable side-ticket probe pattern"
  - phase: 03-g-r-me-detay-ve-ya-am-d-ng-s
    provides: "public/v1 reply/lifecycle PATCH contract, dependency-free HTML sanitizer"
provides:
  - "Live-verified attachment upload contract: correct endpoint path, response shape, inline flag, size ceiling, token authorization (A1-A5, N1-N3)"
  - "Phase-level write-path split decision: comment-bearing writes use /v2/tickets, status-only stays on public/v1 (D-15 preservation)"
  - "Four npm dependencies installed with human-approved exact pins (react-dropzone, @tiptap/extension-file-handler, @tiptap/extension-image, sonner)"
  - "Single root-mounted <Toaster /> (next-themes stripped, always-light theme)"
  - "src/lib/attachment-test-helpers.ts — shared File/paste/drop event construction for all Phase 4 test files, with hasNativeDataTransfer capability recorded as false in this repo's jsdom"
affects: [04-02, 04-03, 04-04, 04-05, 04-06, 04-07, 04-08]

# Tech tracking
tech-stack:
  added: ["react-dropzone@19.1.1", "@tiptap/extension-file-handler@2.27.2", "@tiptap/extension-image@2.27.2", "sonner@2.0.7"]
  patterns:
    - "Comment-bearing ticket writes (new conversation create, reply, with or without attachments) go through /v2/tickets; status-only lifecycle PATCH stays on public/v1 because /v2 PATCH requires a comment body, which would violate D-15's no-comment/no-email rule for solve/reopen"
    - "Attachment upload path has no public/v1 prefix — POST https://api.grispi.net/attachments/upload (not .../public/v1/attachments/upload)"
    - "Each uploaded attachment id can be bound to exactly one comment (N1) — re-attaching an id returns HTTP 422"
    - "jsdom in this repo's pinned Jest/react-scripts version does NOT support a working native DataTransfer — attachment-test-helpers.ts's stub-object fallback path is what Phase 4's drop tests actually exercise"

key-files:
  created:
    - src/components/ui/sonner.tsx
    - src/lib/attachment-test-helpers.ts
    - src/lib/__tests__/attachment-test-helpers.test.ts
  modified:
    - package.json
    - package-lock.json
    - yarn.lock
    - src/app.tsx

key-decisions:
  - "Upload endpoint has NO public/v1 prefix: POST https://api.grispi.net/attachments/upload (public/v1/attachments/upload returns 403)"
  - "Comment-bearing ticket writes (create + reply, with or without attachments) must use /v2/tickets; status-only lifecycle updates stay on public/v1 because /v2 PATCH without a comment returns 500, and adding a comment to solve/reopen would violate Phase 3's D-15 (no comment, no email on lifecycle change)"
  - "public/v1 tickets PATCH/POST silently ignores comment.attachmentIds — it returns 2xx but never binds; only /v2/tickets binds correctly"
  - "?inline=true is supported and round-trips as inline:true on the re-fetched comment attachment, confirming D-22 is implementable"
  - "Client-side attachment size/count policy (D-08: 10MB/file, 25MB total, 10 files) is an email-deliverability choice, not a server constraint — server accepted a 30MB probe upload with no 413"
  - "Each uploaded attachment id binds to exactly one comment; re-attaching an already-bound id returns HTTP 422 (new constraint N1, not in original research)"
  - "sonner is pinned to an exact version (no caret) alongside the three SUS-flagged packages, consistent with T-04-SC's 'tam sürüm pini (caret yok)' mitigation for all four new dependencies"
  - "npm install required --legacy-peer-deps due to a pre-existing eslint@9 vs eslint-config-react-app's eslint@8 peer conflict already present in the repo before this plan (confirmed: a plain `npm install` with zero dependency changes fails identically) — unrelated to the legitimacy of the four new packages"

patterns-established:
  - "Pattern: attachment upload is POST {no public/v1}/attachments/upload (?inline=true for editor-embedded images), multipart field name `files`, response is always an array even for one file"
  - "Pattern: write-path selection by payload shape — comment present → /v2/tickets, status-only → public/v1/tickets"

requirements-completed: []  # COMP-05/COMP-08 are multi-plan requirements (also listed in 04-02/03/05/06/07/08 frontmatter); this plan only lands the live contract + install/scaffolding prep, not the user-visible capability, so REQUIREMENTS.md checkboxes stay unchecked until the plan that ships the observable behavior (see Requirement Status Correction below)

coverage:
  - id: 04-01-probe
    description: "Live attachment upload/binding contract (A1-A5, N1-N3) confirmed or corrected against gsocial-test"
    requirement: "COMP-05, COMP-08"
    verification:
      - kind: live-contract
        ref: "Probe Findings section below (human-run against gsocial-test; verdicts recorded verbatim)"
        status: pass
    human_judgment: true
    rationale: "Live tenant probes cannot be automated/re-run by the executor; human ran P1-P5 directly and supplied raw verdicts."
  - id: 04-01-packages
    description: "Three SUS-flagged packages (react-dropzone, @tiptap/extension-file-handler, @tiptap/extension-image) approved by human before install; sonner installed via shadcn official path"
    verification:
      - kind: unit
        ref: "package.json exact-pin grep checks (see Acceptance Criteria Verification below)"
        status: pass
    human_judgment: true
    rationale: "Package legitimacy approval is a blocking-human checkpoint per protocol; cannot be auto-approved."
  - id: 04-01-toast-testhelpers
    description: "Root-mounted next-themes-free <Toaster />, and File/drop/paste test helpers with jsdom DataTransfer capability recorded"
    verification:
      - kind: unit
        ref: "src/lib/__tests__/attachment-test-helpers.test.ts (5/5 pass)"
        status: pass
      - kind: unit
        ref: "CI=true npx craco test --watchAll=false (23 suites / 196 tests pass)"
        status: pass
      - kind: compile
        ref: "CI=true npx tsc --noEmit (clean)"
        status: pass
      - kind: other
        ref: "CI=true npm run build (compiled successfully)"
        status: pass
    human_judgment: false

# Metrics
duration: ~45min active execution (across original probe/approval session plus this continuation)
completed: 2026-08-01
status: complete
---

# Phase 04 Plan 01: Live Attachment Contract Probe + Package Legitimacy + Toast/Test Scaffolding Summary

**Live gsocial-test probes corrected two upload assumptions (no `public/v1` prefix, `/v2/tickets` required for attachment binding), forcing a phase-level write-path split to preserve D-15; four packages installed with human-approved exact pins; root `<Toaster/>` and shared jsdom File/drop/paste test helpers are in place for Plan 02 onward.**

## Performance

- **Duration:** ~45 min active execution (human-run live probes + package approval in an earlier session; this continuation completed Task 3 install/scaffolding and closed out the plan)
- **Tasks:** 3/3 complete
- **Files modified:** 7 (package.json, package-lock.json, yarn.lock, src/app.tsx, src/components/ui/sonner.tsx, src/lib/attachment-test-helpers.ts, src/lib/__tests__/attachment-test-helpers.test.ts)

## Probe Findings

Human ran P1-P5 live against the `gsocial-test` tenant (not re-run by this executor — recorded verbatim per continuation instructions).

### A1 — Upload path: CORRECTED

- `POST https://api.grispi.net/public/v1/attachments/upload` → **403 Forbidden**
- `POST https://api.grispi.net/attachments/upload` → **201** — correct path has **NO `public/v1` prefix**, breaking the convention every other client method in this codebase uses.
- Multipart field name `files` confirmed (matches research doc). Response is a single-element **array** even for one file:
  ```json
  [{"id":630,"filename":"probe-test.txt","objectKey":"...grspaf","objectThumbKey":"...grspaf","bucket":"itsphythonimages","mimeType":"text/plain","size":5,"userId":4,"inline":false,"objectUrl":"https://usercontent.grispi.net/?tenant=gsocial-test&objectkey=...","objectThumbUrl":"https://usercontent.grispi.net/?tenant=gsocial-test&objectkey=..."}]
  ```
- `inline` IS present on the upload response. `userId` is the token's own user (4 = `ROLE_INTEGRATION` for the dev token).

### A1-c — objectUrl access: CONFIRMED

No auth header needed: `objectUrl` returns **307**, redirecting to a **time-limited signed S3 URL** (`X-Amz-Expires`) which returns 200. Rendering consequence: always use `objectUrl` (the redirector); never persist or cache the resolved S3 link.

### A2 — Attachment binding: CORRECTED (the significant finding)

- `PATCH public/v1/tickets/{key}` with `comment.attachmentIds` → 2xx but **silently ignores it** (re-fetched comment has `attachments: []`).
- `POST public/v1/tickets` with `comment.attachmentIds` → same silent ignore.
- Alternatives probed and rejected: `comment.attachments:[630]` → 400; `comment.attachments:[{id:630}]` → 200 but ignored; `fields:[{key:"ts.attachments"}]` → 500.
- **Working path: `/v2/tickets`.** `PATCH https://api.grispi.net/v2/tickets/{key}` and `POST https://api.grispi.net/v2/tickets` with `comment.attachmentIds: [id]` both **bind correctly** (verified by re-fetch: `attachments: [{id:631,inline:true},{id:633,inline:false}]`).

### A3 — `?inline=true`: CONFIRMED

`POST /attachments/upload?inline=true` → 201 with `inline: true` in the response, and the flag round-trips on the re-fetched comment's attachment. D-22 is implementable.

### A4 — Size ceiling: CONFIRMED (no 413 found)

A 30MB upload → **201**. Server ceiling is ≥30MB. The client policy (D-08: 10MB/file, 25MB total, 10 files) is therefore an email-deliverability choice, NOT a server constraint.

### A5 — Token authorization: CONFIRMED

Dev token is authorized on the root upload path (201, no 401/403). Plugin-mode bundle token remains a secondary manual check in Plan 08's panel UAT.

### New constraint N1 — one attachment ↔ one comment

Reusing an already-bound attachment id returns HTTP 422: `"Attachment(s) with id '630' are already attached a comment."` Each upload can be attached exactly once.

### New finding N2 — v2 PATCH requires a `comment`

`PATCH /v2/tickets/{key}` with `fields` only (e.g. status-only) → **500**. With `comment` + `fields` → 200. `PATCH public/v1/tickets/{key}` with `fields` only → 200 (works today, unchanged).

### New finding N3 — server HTML-entity-encodes the stored inline `<img src>`

(`&#61;` for `=`, `&amp;` for `&`). Client-side D-16 garbage collection runs on our pre-send HTML so it is unaffected, but any round-trip URL matching (e.g. checking whether an inline image's `objectUrl` still appears in stored HTML) must decode entities first.

**Probe artifacts created in the tenant (for traceability, no PII):** attachments id 630 (txt), 631 (png, inline), 632 (30MB), 633 (txt); tickets TICKET-586, TICKET-587, TICKET-590.

## Architecture Decision — v1/v2 write-path split (phase-level, binding for 04-02 and 04-06)

Driven by A2 + N2:

- **Comment-bearing writes → `/v2/tickets`**: new conversation create (`POST /v2/tickets`) and reply (`PATCH /v2/tickets/{key}`), with or without attachments. `comment.channel: "WEB"` is sent on this path (v1 produced `INTEGRATION`).
- **Status-only updates stay on `public/v1`** (`PATCH public/v1/tickets/{key}` with `fields` only). Reason: v2 requires a `comment` in the body (N2), and Phase 3's locked decision **D-15** states solve/reopen must produce NO comment and NO email notification. Migrating status to v2 would violate D-15.

This is an API-forced split, not arbitrary version mixing. Plans 04-02 (attachments client + upload) and 04-06 (send-path wiring) must implement create/reply against `/v2/tickets` and leave lifecycle PATCH untouched on `public/v1`.

## Package Legitimacy Approval

Human approved all three `SUS`-flagged packages after the `too-new` false-positive explanation (recent patch-release timestamps on official-org, multi-million-download packages):

| Package | Version | Verdict | Approval |
|---|---|---|---|
| `react-dropzone` | `19.1.1` (exact) | SUS (too-new, false positive) | Approved |
| `@tiptap/extension-file-handler` | `2.27.2` (exact) | SUS (too-new, false positive) | Approved — critical: `latest` resolves to incompatible 3.x |
| `@tiptap/extension-image` | `2.27.2` (exact) | SUS (too-new, false positive) | Approved |
| `sonner` | `2.0.7` (exact) | OK | Approved via shadcn official path, `next-themes` dependency stripped |

Post-install verification: no `@tiptap/*` package resolved to the 3.x line (`npm ls @tiptap/core @tiptap/extension-file-handler @tiptap/extension-image @tiptap/extension-text-style` → all `2.27.2`, deduped against the existing `@tiptap/core@2.27.2` already in the project).

## Accomplishments

- Recorded live A1-A5 verdicts and three new findings (N1-N3) discovered during the human's probe run.
- Documented the phase-level `/v2/tickets` vs `public/v1` write-path split with its D-15 rationale for downstream plans.
- Installed four npm dependencies with human-approved exact version pins (no `^`, no ranges).
- Adapted the shadcn-generated `sonner.tsx` to strip `next-themes` and mount a single `<Toaster />` at the app root.
- Built `src/lib/attachment-test-helpers.ts` (`makeTestFile`, `makeClipboardPasteEvent`, `makeDropEvent`, `hasNativeDataTransfer`) plus its own test suite, and recorded that this repo's jsdom does **not** support native `DataTransfer` (see below) — Plan 05's drop tests will exercise the plain-object fallback path.
- Verified `tsc --noEmit` clean, full Jest suite green (23 suites / 196 tests, up from 22/191), and `npm run build` succeeds.

## Task Commits

Each task was committed atomically:

1. **Task 1: Live API probe (P1-P5)** — checkpoint, human-run live against `gsocial-test`; no code commit (findings recorded above; `04-01-PLAN.md`/this SUMMARY are the artifacts)
2. **Task 2: Package legitimacy approval** — checkpoint, human approval recorded above; no code commit (approval gates Task 3's install)
3. **Task 3: Package install + toast surface + test capability** — `0ae5feb` (`feat`)

**Plan metadata:** commit created at the end of this SUMMARY/state-update step (see git log for the `docs(04-01): ...` commit that follows).

## Files Created/Modified

- `package.json` / `package-lock.json` / `yarn.lock` — `react-dropzone@19.1.1`, `@tiptap/extension-file-handler@2.27.2`, `@tiptap/extension-image@2.27.2`, `sonner@2.0.7` (all exact pins); `next-themes` was added transitively by the shadcn CLI and removed
- `src/components/ui/sonner.tsx` (new) — `Toaster` wrapper, `theme="light"` hardcoded, `next-themes` stripped, UI-SPEC §7 positioning/sizing/destructive classnames
- `src/app.tsx` — single `<Toaster />` mounted as a sibling of `AppContent` inside `GrispiProvider`
- `src/lib/attachment-test-helpers.ts` (new, test-only) — `makeTestFile`, `makeClipboardPasteEvent`, `makeDropEvent`, `hasNativeDataTransfer`
- `src/lib/__tests__/attachment-test-helpers.test.ts` (new) — 5 tests covering all four exports

## hasNativeDataTransfer Result

**`false`** in this repo's pinned Jest 27.5.1 / jsdom (react-scripts 5) environment — constructing `new DataTransfer()` and calling `.items.add(file)` does not produce a usable `files` list here. `makeDropEvent` therefore falls back to its plain-object `{ files }` stub for every drop test built on this helper in this repo. This corrects RESEARCH.md's "ASSUMED... verify with one throwaway `it()`" note (§Constructing File/FileList/DataTransfer/clipboard-file objects in jsdom) — the assumption was wrong for this project's exact toolchain version, and downstream drop tests (Plan 05) should expect the stub path, not the native `DataTransfer` path.

## Decisions Made

See `key-decisions` in frontmatter — repeated here for readability:

- Upload path has no `public/v1` prefix.
- Comment-bearing writes use `/v2/tickets`; status-only stays on `public/v1` (D-15 preservation).
- `public/v1` silently ignores `comment.attachmentIds`; only `/v2/tickets` binds.
- `?inline=true` works and round-trips.
- Client attachment limits (D-08) are a UX choice, not a server constraint (ceiling ≥30MB).
- One attachment id binds to exactly one comment (N1).
- `sonner` gets an exact pin alongside the three SUS packages for consistency with the T-04-SC mitigation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used `npm install --legacy-peer-deps` for all installs/uninstalls in this plan**

- **Found during:** Task 3, first `npm install` attempt for `react-dropzone`/`@tiptap/extension-file-handler`/`@tiptap/extension-image`
- **Issue:** `npm install` (even a plain, argument-free run with zero dependency changes) fails with an ERESOLVE conflict between the repo's existing `eslint@9.2.0` devDependency and `eslint-config-react-app@7.0.1`'s `peerDependency` on `eslint@^8.0.0`. This conflict predates this plan — it is reproducible on a completely clean `npm install` with no new packages — and `package-lock.json` already contains `eslint@9.39.5` installed alongside `eslint-config-react-app`, confirming the lockfile itself was originally produced with a non-strict resolver.
- **Fix:** Ran all `npm install`/`npm uninstall` commands in this task with `--legacy-peer-deps`. This only changes how the pre-existing devDependency peer conflict is resolved; it does not change which packages/versions were requested or installed for the four new production dependencies (all four still resolved to the exact pinned versions, verified by `npm ls`).
- **Verification:** `npm ls @tiptap/core @tiptap/extension-file-handler @tiptap/extension-image @tiptap/extension-text-style` shows all `2.27.2`, no 3.x; `tsc --noEmit` clean; full test suite green; `npm run build` succeeds.
- **Files modified:** `package.json`, `package-lock.json` (already tracked as plan outputs).
- **Commit:** `0ae5feb`
- **Scope note:** This is out-of-scope for a permanent fix (the underlying `eslint@9` vs. `eslint-config-react-app@7`'s `eslint@8` peer mismatch is a pre-existing devDependency issue unrelated to Phase 4's attachment/toast work) — logged here rather than fixed, per the deviation-rules scope boundary. Not added to `deferred-items.md` since it is a one-line note here and does not block any future plan; a future eslint-tooling upgrade phase could resolve it properly.

**2. [Rule 1 - Bug] Pinned `sonner` to an exact version instead of the shadcn CLI's default caret range**

- **Found during:** Task 3(a), after `npx shadcn@latest add sonner`
- **Issue:** The shadcn CLI wrote `"sonner": "^2.0.7"` (caret range) into `package.json`, but the resolved checkpoint approval text explicitly requires "EXACT pins, no `^`, no ranges" for all four packages in this plan, and the plan's own threat mitigation (T-04-SC) names `sonner` alongside the three SUS packages as requiring "tam sürüm pini (caret yok)".
- **Fix:** Edited `package.json` to `"sonner": "2.0.7"` (no caret) and re-ran `npm install --legacy-peer-deps` to sync `package-lock.json`/`yarn.lock` to the exact pin (lockfiles already resolved to `2.0.7`, so this was a specifier-only correction).
- **Verification:** `grep -c '"sonner": "\^' package.json` = 0; installed version unchanged at `2.0.7`.
- **Files modified:** `package.json`.
- **Commit:** `0ae5feb`

**3. [Observation, not a deviation] `yarn.lock` (pre-existing tracked file, unused by this project's npm-based scripts) updated in sync with `package-lock.json`**

- **Found during:** Task 3, after the final `npm install --legacy-peer-deps` sync run
- **Observation:** `yarn.lock` — already git-tracked from before this phase, though the project's `scripts` and toolchain (`craco`, `react-scripts`) are npm-only — picked up entries for all four newly-installed packages (`react-dropzone@19.1.1`, `@tiptap/extension-file-handler@2.27.2`, `@tiptap/extension-image@2.27.2`, `sonner@2.0.7`) with matching integrity hashes to the npm registry. The exact mechanism that synced it was not identified (no `postinstall`/hook script found in this repo, `.npmrc`, or global npm config), but the resulting entries are internally consistent with `package-lock.json` and correct.
- **Action:** Committed `yarn.lock` alongside `package-lock.json` since both now consistently describe the same dependency tree and leaving them mismatched would be worse than committing the (harmless) sync.
- **Commit:** `0ae5feb`

**4. [Rule 1 - Bug] Reverted an incorrect `requirements mark-complete` run for COMP-05/COMP-08**

- **Found during:** State-update step, after running the standard `requirements mark-complete COMP-05 COMP-08` command from this plan's frontmatter `requirements` field
- **Issue:** `COMP-05` and `COMP-08` are multi-plan requirements — they also appear in the `requirements` frontmatter of `04-02-PLAN.md`, `04-03-PLAN.md`, `04-05-PLAN.md`, `04-06-PLAN.md`, `04-07-PLAN.md`, and `04-08-PLAN.md`. This plan (01) is explicitly scoped as the phase's gate/prep work — the plan's own objective states "Kullanıcıya görünür ilk yetenek (ataç + chip) Plan 05'te gelir" (the first user-visible capability lands in Plan 05). Running the generic `requirements mark-complete` command checked both boxes in `REQUIREMENTS.md` and set `COMP-05`'s traceability row to "Complete" — a false record, since no drag-drop, chip list, or inline-image UI exists yet.
- **Fix:** Reverted both checkboxes to unchecked in `.planning/REQUIREMENTS.md`, appended a note to each explaining Plan 01's contract/infra-only scope and which later plans deliver the observable behavior, and changed `COMP-05`'s traceability table status from "Complete" back to "In Progress (contract/infra done in Plan 01; UI lands Plan 02-06)".
- **Files modified:** `.planning/REQUIREMENTS.md`.
- **Commit:** included in this plan's final `docs(04-01)` metadata commit (not `0ae5feb`, which is code-only).

---

**Total deviations:** 3 auto-fixed (2× Rule 1, 1× Rule 3) + 1 observation (no rule triggered, informational only).
**Impact on plan:** None on Task 3's shipped code — all four packages resolved to their exact intended versions. Deviation 4 corrects a tracking-only overreach in the state-update step so `REQUIREMENTS.md` accurately reflects that COMP-05/COMP-08 remain in progress across Plans 02-08.

## Authentication Gates

None in this continuation. Task 1's live probes (run by the human in an earlier session) used the existing `.env.development.local` dev token already established in Phase 1 — no new credential setup was required.

## Issues Encountered

None blocking. See Deviations above for the two auto-fixed issues and one informational observation.

## Known Stubs

None. No production data-rendering code was added in this plan — this plan is purely dependency install + toast-surface scaffolding + test infrastructure. Plan 05 is where the attach button/chip UI (the first user-visible capability) lands.

## Threat Flags

None beyond what `04-01-PLAN.md`'s own `<threat_model>` already covers (T-04-SC, T-04-01, T-04-02, T-04-03 — all addressed as designed: exact pins for all four packages including `sonner`, `next-themes` removed and grep-verified absent, probe artifacts were disposable/meaningless content, `objectUrl`'s unauthenticated access confirmed and documented).

## User Setup Required

None further. The `REACT_APP_DEV_TOKEN` env var used for Task 1's probes was already present from Phase 1 setup.

## Next Phase Readiness

- Plan 02 (attachments client + types) can now be written against the CORRECTED contract: root `attachments/upload` path, `/v2/tickets` for binding, `inline` flag support, no server-side size ceiling below 30MB.
- Plan 06 (send-path wiring) must implement create/reply against `/v2/tickets` while leaving lifecycle PATCH on `public/v1` per the write-path split decision above.
- Plan 05 (attach button/chip UI, first user-visible capability) can build on the root `<Toaster />` and `attachment-test-helpers.ts` established here.
- `hasNativeDataTransfer === false` in this repo — Plan 05's drop-event tests should assert against the stub-object shape (`{ files }`), not a real `DataTransfer` instance.

## Self-Check: PASSED

- `src/components/ui/sonner.tsx` — FOUND
- `src/lib/attachment-test-helpers.ts` — FOUND
- `src/lib/__tests__/attachment-test-helpers.test.ts` — FOUND
- Commit `0ae5feb` — FOUND in `git log --oneline --all`
- `package.json` contains exact pins for all four packages (`grep` checks above all passed)
- `next-themes` absent from both `package.json` and `src/components/ui/sonner.tsx`
- Full test suite: 23 suites / 196 tests passing
- `tsc --noEmit`: clean
- `npm run build`: succeeds

---
*Phase: 04-dosya-ekleri-ve-inline-g-rseller*
*Completed: 2026-08-01*
