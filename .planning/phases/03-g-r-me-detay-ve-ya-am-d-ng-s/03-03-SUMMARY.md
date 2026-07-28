---
phase: 03-g-r-me-detay-ve-ya-am-d-ng-s
plan: 03
subsystem: ui-state
tags: [typescript, mobx, localstorage, lifecycle, tdd]

requires:
  - phase: 03-g-r-me-detay-ve-ya-am-d-ng-s
    provides: Hydrated side-conversation rows and server status/comment inputs from Plan 01
provides:
  - Non-throwing validated per-ticket last-seen writes
  - Independent lifecycle, action-responsibility, and unseen row state
  - Solved-only row rendering and unseen-only purple emphasis
affects: [03-04, active-conversation-store, thread-opening, conversation-list]

tech-stack:
  added: []
  patterns:
    - Browser-local seen state is an optional visual hint only
    - Server status and last public author exclusively own lifecycle and action responsibility

key-files:
  created: []
  modified:
    - src/lib/last-seen-store.ts
    - src/lib/__tests__/last-seen-store.test.ts
    - src/store/side-conversations-store.ts
    - src/store/__tests__/side-conversations-store.test.ts
    - src/screens/components/conversation-row.tsx

key-decisions:
  - "Local last-seen data can remove only the unseen rail; it never changes Yeni yanıt into Yanıt bekleniyor."
  - "Solved rows expose lifecycle=solved, actionBadge=null, and hasUnseen=false regardless of stored or comment timestamps."
  - "Existing list grouping is preserved by sorting independent row state as Yeni yanıt, Yanıt bekleniyor, then Çözüldü."

patterns-established:
  - "Three-signal row model: lifecycle, actionBadge, and hasUnseen remain independently derived."
  - "Defensive storage: invalid input and localStorage failures return false without blocking navigation."

requirements-completed: [THRD-04, THRD-03]

duration: 4min
completed: 2026-07-29
---

# Phase 3 Plan 3: Independent Lifecycle, Action, and Unseen State Summary

**Per-agent local last-seen persistence now controls only the purple unseen accent while server status and public-author history independently drive solved and reply-responsibility labels.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-28T23:29:18Z
- **Completed:** 2026-07-28T23:32:50Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added validated, ticket-scoped `setLastSeenAt` writes that safely degrade when iframe storage is denied or full.
- Split the list row view model into `lifecycle`, `actionBadge`, and `hasUnseen`, preventing mutable local storage from claiming an external reply was answered.
- Made solved rows suppress both action and unseen signals, while a later external reply on an open server status restores `Yeni yanıt` and the unseen rail.
- Updated list-row rendering to show `Çözüldü` instead of `Kapalı` and to render the purple rail independently from the action badge.

## TDD Gate Results

- **Task 1 RED:** `c0c1bf1` — Seven writer tests failed because `setLastSeenAt` did not exist.
- **Task 1 GREEN:** `e4c69f7` — Validated non-throwing local writes made all 11 storage tests pass.
- **Task 2 RED:** `ff28a3d` — The lifecycle/action/unseen matrix failed against the legacy conflated `badge` model.
- **Task 2 GREEN:** `16884d0` — Independent row state and UI mapping made both focused suites and TypeScript pass.
- **REFACTOR:** No separate refactor commit was needed; formatting and the final state derivation cleanup were included in GREEN.

## Task Commits

1. **Task 1 RED: Add failing last-seen writer tests** — `c0c1bf1` (test)
2. **Task 1 GREEN: Persist resilient local last-seen state** — `e4c69f7` (feat)
3. **Task 2 RED: Add failing row-state regression matrix** — `ff28a3d` (test)
4. **Task 2 GREEN: Split lifecycle, action, and unseen row state** — `16884d0` (feat)

## Files Created/Modified

- `src/lib/last-seen-store.ts` — Adds validated, non-throwing last-seen writes beside the defensive reader.
- `src/lib/__tests__/last-seen-store.test.ts` — Covers successful writes, denied/quota storage, blank keys, and non-finite timestamps.
- `src/store/side-conversations-store.ts` — Derives independent lifecycle/action/unseen state while preserving hydration, generation guards, immutable upgrades, and grouping.
- `src/store/__tests__/side-conversations-store.test.ts` — Covers external unseen/seen, agent-last, solved suppression, reactivation, and existing store behavior.
- `src/screens/components/conversation-row.tsx` — Maps unseen state to the purple rail and lifecycle/action state to independent badges with `Çözüldü` copy.

## Decisions Made

- Kept `deriveBadge` as the established pure server-state classifier, then split its output at the row mapping seam so local storage participates only in `hasUnseen`.
- Treated rows without a hydrated public timestamp as not unseen; failed hydration remains dimmed and keeps its existing safe action fallback.
- Recreated D-08 grouping locally from independent fields rather than retaining a hidden/conflated `badge` property on the public row model.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The sandbox cannot use Watchman, so Jest verification used the required `--no-watchman` option.
- CRA emitted its existing Babel dependency/open-handle warnings after successful tests; neither affected results and no dependency was added.

## User Setup Required

None - no external service configuration required.

## Verification

- `CI=true npm test -- --watchAll=false --no-watchman --runTestsByPath src/lib/__tests__/last-seen-store.test.ts src/store/__tests__/side-conversations-store.test.ts` — PASS, 2 suites / 27 tests.
- `CI=true npx tsc --noEmit` — PASS.
- `npx prettier --check src/store/side-conversations-store.ts src/store/__tests__/side-conversations-store.test.ts src/screens/components/conversation-row.tsx` — PASS after formatting.
- Stub scan across all modified files — no blocking stubs found.
- Threat scan — no unplanned trust boundary; finite validation, caught storage access, public-comment filtering, and server-owned action/lifecycle derivation implement T-03-07 through T-03-09.

## Next Phase Readiness

- Thread opening can call `setLastSeenAt` without risking navigation failure, then refresh list state to remove only the unseen rail.
- Active-conversation reply and lifecycle work can rely on the split row model without local seen state corrupting responsibility labels.
- No blockers.

## Self-Check: PASSED

- All five modified key files exist.
- All four TDD task commits are present in git history.
- Both focused suites, TypeScript, formatting, and diff checks pass.
- Shared `STATE.md` and `ROADMAP.md` were not modified.

---
*Phase: 03-g-r-me-detay-ve-ya-am-d-ng-s*
*Completed: 2026-07-29*
