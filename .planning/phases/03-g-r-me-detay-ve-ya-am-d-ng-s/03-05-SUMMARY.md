---
phase: 03-g-r-me-detay-ve-ya-am-d-ng-s
plan: 05
subsystem: state-management
tags: [mobx, thread, retry, lifecycle, localstorage, sanitization]

requires:
  - phase: 03-02
    provides: Probe-backed narrow reply and status PATCH client contracts
  - phase: 03-03
    provides: Independent list lifecycle, action, and unseen state
  - phase: 03-04
    provides: Shared sanitizer and quoted-context serializer
provides:
  - Race-safe canonical thread loading and immutable comment normalization
  - Separate first-unseen scroll targeting and monotonic latest-external read tracking
  - Exact-payload reply retry and non-optimistic solve/reopen state machines
affects: [03-06-thread-ui, chat-screen, panel-navigation]

tech-stack:
  added: []
  patterns:
    - Monotonic generation guard for selected-thread authority
    - Build-once retained mutation payloads for exact retry
    - Canonical refetch after every successful mutation

key-files:
  created: []
  modified:
    - src/store/active-conversation-store.ts
    - src/store/__tests__/active-conversation-store.test.ts

key-decisions:
  - "Scroll targeting uses the earliest unseen external public message, while last-seen persistence uses the latest external public timestamp."
  - "Reply payloads are sanitized and quoted once, retained per optimistic message, and reused unchanged by retry."
  - "SOLVED 4 and OPEN 2 are status-only mutations; visible lifecycle changes only after canonical refetch."

patterns-established:
  - "Server-truth mutation completion: PATCH success is followed by active-ticket and parent-list refetch."
  - "Read-state separation: viewport intent and persisted read watermark are independent values."

requirements-completed: [THRD-01, THRD-02, THRD-03, THRD-04]

duration: 6min
completed: 2026-07-29
---

# Phase 3 Plan 5: Authoritative Thread State Summary

**Race-safe canonical email threads with sanitized quoted reply retry, monotonic read tracking, and server-truth solve/reopen lifecycle**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-28T23:44:28Z
- **Completed:** 2026-07-28T23:50:47Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Loads canonical comments oldest-first, classifies incoming/own/internal content, sanitizes remote HTML, and prevents stale selections from publishing.
- Keeps the earliest unseen external message as the scroll target while advancing local last-seen only to the latest relevant external timestamp.
- Builds one narrow sanitized reply payload with one public-history quote, retains it exactly across retry, and excludes internal notes and recursive quotes.
- Keeps solve/reopen non-optimistic, uses exact live status IDs, exposes retry-safe error state, and refetches both active thread and parent list after success.

## Task Commits

Each task was committed atomically using TDD:

1. **Task 1 RED: Real thread load contracts** - `0e6c160` (test)
2. **Task 1 GREEN: Authoritative thread loading** - `6b27496` (feat)
3. **Task 2 RED: Reply and lifecycle contracts** - `3055865` (test)
4. **Task 2 GREEN: Reply and lifecycle state machines** - `ba6f594` (feat)

## Files Created/Modified

- `src/store/active-conversation-store.ts` - Authoritative load, normalization, read-state, reply retry, and lifecycle mutation owner.
- `src/store/__tests__/active-conversation-store.test.ts` - Race, sanitization, two-unseen-message, exact retry payload, refetch, and lifecycle coverage.

## Decisions Made

- The loaded canonical GET status is the only source allowed to change `solved`; PATCH mutation responses are never installed as application state.
- A reply retry holds the already-built `ReplyTicketPatchRequest`, so changing draft or thread state cannot add, omit, or duplicate quote content.
- Storage and list-refresh failures do not downgrade a successfully normalized active thread.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Jest's default Watchman integration is unavailable in the sandbox; all suites ran successfully with the required `--no-watchman` flag.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Verification

- `CI=true npm test -- --watchAll=false --no-watchman --runTestsByPath src/store/__tests__/active-conversation-store.test.ts` — PASS (19 tests)
- Related thread/read safety suites — PASS (53 tests across 4 suites)
- `CI=true npx tsc --noEmit` — PASS

## Next Phase Readiness

- Plan 03-06 can wire row selection, chronological thread rendering, fixed composer, lifecycle actions, retry feedback, scroll targeting, and one-shot reopen focus directly to this store.
- No blockers remain for UI integration.

## Self-Check: PASSED

- Both declared key files exist.
- All four Task 1/Task 2 RED and GREEN commits exist.
- Focused acceptance suite, related safety suites, and TypeScript all pass.
- No shared `STATE.md` or `ROADMAP.md` tracking file was modified.

---
*Phase: 03-g-r-me-detay-ve-ya-am-d-ng-s*
*Completed: 2026-07-29*
