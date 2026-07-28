---
phase: 03-g-r-me-detay-ve-ya-am-d-ng-s
plan: 04
subsystem: ui-security
tags: [react, contenteditable, domparser, html-sanitization, email-thread]

requires:
  - phase: 03-01
    provides: probe-confirmed plain-blockquote quote boundary and outbound wrapper
provides:
  - Dependency-free shared inbound/outbound HTML allowlist
  - Public-only chronological quote rebuilding without recursive nesting
  - Full-width chronological ThreadMessage with collapsed quotes and internal notes
  - Controlled accessible RichTextComposer with sanitized input, paste, and submit
affects: [03-05, 03-06, active-conversation-store, chat-screen]

tech-stack:
  added: []
  patterns:
    - One DOMParser and TreeWalker policy for every HTML boundary
    - Controlled contentEditable with externally-owned draft state
    - Sanitizer output as the only dangerouslySetInnerHTML input

key-files:
  created:
    - src/lib/html-sanitizer.ts
    - src/lib/__tests__/html-sanitizer.test.ts
    - src/screens/components/thread-message.tsx
    - src/screens/components/rich-text-composer.tsx
    - src/screens/components/__tests__/thread-components.test.tsx
  modified: []

key-decisions:
  - "Unknown benign elements are unwrapped, while active or data-bearing elements such as script, style, image, table, iframe, and SVG are removed with their contents."
  - "Outbound quote rebuilding accepts visibility metadata and filters non-public context itself, preventing internal notes from entering email payloads."
  - "The composer owns DOM mechanics and sanitation but not draft state, preserving the Phase 3 navigation seam."

patterns-established:
  - "HTML boundary: sanitize remote, pasted, edited, and submitted markup through sanitizeHtml."
  - "Quote boundary: split only at the first sanitized plain blockquote and rebuild one public-only chronological wrapper."
  - "Composer keyboard: Enter remains native newline; Shift+Enter submits only meaningful sanitized HTML."

requirements-completed: [THRD-01, THRD-02]

duration: 8min
completed: 2026-07-28
---

# Phase 3 Plan 4: Secure HTML and Thread Components Summary

**Dependency-free strict HTML sanitation with probe-backed quote preservation, chronological email blocks, and an accessible controlled rich composer**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-28T23:34:31Z
- **Completed:** 2026-07-28T23:42:34Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added one deterministic DOMParser/TreeWalker allowlist that preserves lightweight email formatting while removing executable, tracking, style, image, table, iframe, and SVG surfaces.
- Added first-`blockquote` splitting and a public-only outbound builder that removes prior nested quotes and never includes internal notes.
- Added full-width chronological messages with external/own/internal identity treatment, collapsed prior mail, and pending/failed retry states.
- Added an always-visible accessible formatting toolbar and controlled contentEditable with safe paste/input/submit boundaries, Enter newline, Shift+Enter submit, and solved/disabled protection.

## Task Commits

Each task followed RED/GREEN TDD and was committed atomically:

1. **Task 1 RED: strict sanitizer and quote contract** - `83df805` (test)
2. **Task 1 GREEN: shared safe HTML boundary** - `5230e8d` (feat)
3. **Task 2 RED: thread component contracts** - `7b86d07` (test)
4. **Task 2 GREEN: email thread and composer components** - `be8123e` (feat)

## Files Created/Modified

- `src/lib/html-sanitizer.ts` - Shared allowlist, quote splitter, and public-context reply builder.
- `src/lib/__tests__/html-sanitizer.test.ts` - Hostile corpus, protocol, quote, context filtering, and nesting coverage.
- `src/screens/components/thread-message.tsx` - Sanitized chronological email block with disclosure, note, pending, and retry states.
- `src/screens/components/rich-text-composer.tsx` - Controlled, selection-aware rich composer with accessible toolbar and sanitized boundaries.
- `src/screens/components/__tests__/thread-components.test.tsx` - Rendering, safety, keyboard, paste, retry, disabled, and accessibility contracts.

## Decisions Made

- Unknown provider wrappers are unwrapped instead of deleted so unrecognized quote-like markup remains visible sanitized body content.
- Safe web links are forced to a new tab with `noopener noreferrer`; mail links retain no browsing context target and still receive the safe relationship attribute.
- Quote rebuilding requires `{ html, publicVisible }` inputs so internal-note exclusion is enforced at the helper boundary instead of relying on callers.
- React DOM's installed test surface was used directly because Testing Library was not present in `node_modules`; no dependency was installed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The repository lockfile references Testing Library, but the package was not installed locally. Component tests use the already-installed React/React DOM test APIs, preserving the no-package-install security contract.
- CRA prints its existing Babel preset maintenance warning and Jest open-handle advisory after successful runs; neither affected results.

## Verification

- Focused sanitizer and component suites: **PASS** — 15/15 tests.
- Full repository Jest suite with `--no-watchman`: **PASS** — 127/127 tests across 15 suites.
- `CI=true npx tsc --noEmit`: **PASS**.
- Prettier check and `git diff --check`: **PASS**.

## User Setup Required

None - no external service configuration or package installation required.

## Next Phase Readiness

- Plan 03-05 can normalize API comments through `splitQuotedHtml` and build reply payloads through `buildQuotedReplyHtml`.
- Plan 03-06 can render normalized messages with `ThreadMessage` and bind store-owned drafts to `RichTextComposer`.
- No blockers or goal-preventing stubs remain.

## Self-Check: PASSED

- All five declared implementation/test files exist.
- RED and GREEN commits for both tasks exist.
- All task acceptance criteria and plan-level verification commands pass.

---

*Phase: 03-g-r-me-detay-ve-ya-am-d-ng-s*
*Completed: 2026-07-28*
