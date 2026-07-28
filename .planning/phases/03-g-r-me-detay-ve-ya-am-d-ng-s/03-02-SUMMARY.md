---
phase: 03-g-r-me-detay-ve-ya-am-d-ng-s
plan: 02
subsystem: api
tags: [typescript, grispi, tickets, patch, tdd]

requires:
  - phase: 03-g-r-me-detay-ve-ya-am-d-ng-s
    provides: Live-proven reply, SOLVED, OPEN, and PATCH response contracts from Plan 01
provides:
  - Disjoint public-reply and status-only ticket PATCH request types
  - Narrow mutation-ticket response type distinct from canonical GET Ticket
  - Encoded authenticated no-cache Tickets.patchTicket client
  - Exact transport regression tests for reply, SOLVED, and OPEN mutations
affects: [03-03, active-conversation-store, thread-replies, lifecycle-actions]

tech-stack:
  added: []
  patterns:
    - Probe-backed disjoint mutation unions
    - Canonical GET refetch after mutation-ticket responses

key-files:
  created:
    - src/grispi/client/__tests__/tickets.test.ts
  modified:
    - src/types/grispi.type.ts
    - src/grispi/client/tickets.ts

key-decisions:
  - "Reply PATCH permits only the live-proven public comment shape; lifecycle PATCH permits only one ts.status field."
  - "PATCH response is modeled as a narrow mutation response and must not replace canonical GET Ticket state."
  - "Callers construct the narrow union directly; no solve/reopen builders can drift from the probe contract."

patterns-established:
  - "Mutation isolation: CreateTicketRequest remains separate from PatchTicketRequest."
  - "Lifecycle invariant: SOLVED is status 4, OPEN is status 2, and neither body can contain comment."

requirements-completed: [THRD-02, THRD-03]

duration: 3min
completed: 2026-07-29
---

# Phase 3 Plan 2: Probe-Backed Ticket PATCH Contracts Summary

**Public replies and lifecycle transitions now use disjoint live-proven request bodies through an encoded, authenticated JSON PATCH client with a narrow mutation response.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-28T23:25:15Z
- **Completed:** 2026-07-28T23:28:02Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Locked reply bodies to `{comment:{body,publicVisible:true,creator:[{key:"us.email",value}]}}`.
- Locked lifecycle bodies to the exact status-only SOLVED (`"4"`) and OPEN (`"2"`) tuples, with compile-time rejection of comments and create-only fields.
- Added `Tickets.patchTicket` with reserved-key encoding, authenticated headers, no-cache behavior, exact JSON serialization, and a response type distinct from canonical GET `Ticket`.
- Added seven focused request/transport tests; the adjacent HTTP handler suite also remains green.

## TDD Gate Results

- **Task 1 RED:** `d388b15` — TypeScript failed because the PATCH contracts were absent.
- **Task 1 GREEN:** `c6f8e71` — Narrow request/response contracts made Jest and TypeScript pass.
- **Task 2 RED:** `ecb644c` — Three transport tests failed because `Tickets.patchTicket` did not exist.
- **Task 2 GREEN:** `5ce8362` — The encoded authenticated PATCH client made all transport tests pass.
- **REFACTOR:** No separate refactor commit was needed; formatting was applied and verified in the GREEN commit.

## Task Commits

1. **Task 1 RED: Add failing PATCH contract tests** — `d388b15` (test)
2. **Task 1 GREEN: Define narrow ticket PATCH contracts** — `c6f8e71` (feat)
3. **Task 2 RED: Add failing patchTicket transport tests** — `ecb644c` (test)
4. **Task 2 GREEN: Implement authenticated ticket PATCH client** — `5ce8362` (feat)

## Files Created/Modified

- `src/types/grispi.type.ts` — Exports thread-facing types, disjoint reply/status PATCH contracts, and the narrow mutation response.
- `src/grispi/client/tickets.ts` — Implements encoded authenticated `patchTicket`.
- `src/grispi/client/__tests__/tickets.test.ts` — Covers exact reply/SOLVED/OPEN bodies, type exclusions, encoding, auth, caching, serialization, and response typing.

## Decisions Made

- Modeled the mutation response by its probe-backed identity/comments/status subset rather than pretending the 11-key PATCH object is the canonical five-key GET `Ticket`.
- Used a one-element tuple for lifecycle fields so callers cannot append subject/requester/parent-link fields.
- Preserved the existing authenticated client boundary and passed request bodies straight to `JSON.stringify` without merges or normalization.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The sandbox cannot use Watchman, so Jest verification used the required `--no-watchman` option. This is an environment restriction, not a product failure.
- CRA emitted its existing Babel dependency/open-handle warnings after successful tests; neither affected results and no dependency was added.

## User Setup Required

None - no external service configuration required.

## Verification

- `CI=true npm test -- --watchAll=false --no-watchman --runTestsByPath src/grispi/client/__tests__/tickets.test.ts src/grispi/client/__tests__/http-handler.test.ts` — PASS, 2 suites / 10 tests.
- `CI=true npx tsc --noEmit` — PASS.
- `npx prettier --check src/types/grispi.type.ts src/grispi/client/tickets.ts src/grispi/client/__tests__/tickets.test.ts` — PASS.
- Stub scan across all created/modified files — no blocking stubs found.
- Threat scan — no unplanned trust boundary; encoded authenticated PATCH is the planned T-03-04/T-03-05/T-03-06 mitigation.

## Next Phase Readiness

- Active conversation work can consume `PatchTicketRequest` for public replies and lifecycle actions.
- Mutation success should trigger canonical `getTicket` refetch rather than storing `PatchTicketResponse` as a `Ticket`.
- No blockers.

## Self-Check: PASSED

- All three key files exist.
- All four TDD task commits are present in git history.
- Exact-body tests, adjacent HTTP client tests, TypeScript, and formatting pass.
- Shared `STATE.md` and `ROADMAP.md` were not modified.

---
*Phase: 03-g-r-me-detay-ve-ya-am-d-ng-s*
*Completed: 2026-07-29*
