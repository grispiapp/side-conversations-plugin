---
phase: quick-260810-j2w
plan: 01
subsystem: auth
tags: [react, jest, sdk-bridge, race-condition, http-handler]

requires:
  - phase: 04.1
    provides: HttpHandler.setEnvironment routing (CORE-04) and bootstrapPluginInit's success/reject-path split (CORE-03 gap closure)
provides:
  - Required onEnvironmentReady dep on BootstrapPluginInitDeps, called from bootstrapPluginInit's success path only
  - environmentReadyRef gate inside GrispiProvider's currentTicketUpdated handler
  - First test in the repo that renders the real GrispiProvider
affects: [04.1-VERIFICATION, WR-02]

tech-stack:
  added: []
  patterns:
    - "Module-scope SDK singleton testing: jest.isolateModules requiring react + react-dom/client + the target module together (not via the file's static imports) to avoid a duplicate-React-instance null-dispatcher crash when the target module reads window.GrispiClient at import time"
    - "Gate-flip-owned-by-the-caller-with-the-invariant: an injected onEnvironmentReady() callback invoked inside bootstrapPluginInit's synchronous success block, not via .finally() on the calling side, so the reject path never opens the gate"

key-files:
  created:
    - src/contexts/__tests__/grispi-context.test.tsx
  modified:
    - src/contexts/plugin-bootstrap.ts
    - src/contexts/grispi-context.tsx
    - src/contexts/__tests__/plugin-bootstrap.test.ts

key-decisions:
  - "onEnvironmentReady is called immediately after setEnvironment, inside bootstrapPluginInit's uninterrupted synchronous success block, and never on the reject path (DD-1)"
  - "Early SDK events are dropped, not queued — bootstrapPluginInit re-drives the bundle's own ticketKey through switchTicket the instant the gate opens, making the drop self-healing (DD-2)"
  - "The gate lives in the currentTicketUpdated handler, not inside switchTicket — switchTicket is shared with standalone mode and the dev-only ticket switcher (DD-3)"
  - "The handler stays registered synchronously; only its body is gated, so the SDK never sees an undefined currentTicketUpdated member (DD-4)"

patterns-established:
  - "Pattern: when a test must reload a module that captures a global (window.X) at import time AND that module renders React, require react + react-dom/client + the target module together inside one jest.isolateModules callback — requiring only the target module leaves its component using a different 'react' instance than the outer test's createRoot/act, producing 'Cannot read properties of null (reading useState)'"

requirements-completed: [CORE-04]

coverage:
  - id: D1
    description: "An SDK currentTicketUpdated event arriving before plugin._init() resolves issues zero HTTP requests (grispiAPI.tickets.getTicket not called while the environment is unresolved)"
    requirement: "CORE-04"
    verification:
      - kind: unit
        ref: "src/contexts/__tests__/grispi-context.test.tsx#Test A (regression): a currentTicketUpdated event fired before _init() resolves issues zero getTicket calls"
        status: pass
      - kind: unit
        ref: "src/contexts/__tests__/grispi-context.test.tsx#Test D (reject path): when _init() rejects, a subsequent currentTicketUpdated event still issues zero getTicket calls"
        status: pass
    human_judgment: false
  - id: D2
    description: "After bootstrapPluginInit succeeds, currentTicketUpdated events reach switchTicket/getTicket exactly as before, and the initial bootstrap ticket still loads through switchTicket (CORE-03 not regressed)"
    requirement: "CORE-04"
    verification:
      - kind: unit
        ref: "src/contexts/__tests__/grispi-context.test.tsx#Test B (no regression): after _init() resolves, currentTicketUpdated reaches getTicket with the event's ticket key"
        status: pass
      - kind: unit
        ref: "src/contexts/__tests__/grispi-context.test.tsx#Test C (CORE-03 not regressed): resolving _init() routes the bundle's own ticketKey through switchTicket, after setEnvironment"
        status: pass
      - kind: unit
        ref: "src/contexts/__tests__/plugin-bootstrap.test.ts#resolve branch: wires auth/settings/loading then routes the ticket key through switchTicket"
        status: pass
    human_judgment: false
  - id: D3
    description: "Standalone dev mode behaves exactly as before (invariant-parity ref assignment only, no reachable SDK event source)"
    verification:
      - kind: unit
        ref: "src/lib/__tests__/standalone-dev.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Full regression baseline preserved: 30/384 -> 31/388 suites/tests green, tsc --noEmit exit 0"
    verification:
      - kind: unit
        ref: "CI=true npm test -- --watchAll=false (31 suites, 388 tests, 0 failures)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit (exit 0)"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-08-10
status: complete
---

# Quick Task 260810-j2w Summary

**Closed WR-01 (04.1-REVIEW.md): gated `GrispiProvider`'s SDK `currentTicketUpdated` handler on an `onEnvironmentReady` flip inside `bootstrapPluginInit`'s success path, so an early SDK event can no longer fetch against the class-default (now prod) host with empty auth headers — and added the first test in the repo that renders the real `GrispiProvider`.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-10T10:56:28Z
- **Tasks:** 3 (RED / GREEN / full-suite gate)
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- Added `src/contexts/__tests__/grispi-context.test.tsx` — the first test that renders the real `GrispiProvider` (no `jest.mock("@/contexts/grispi-context")`), proving the WR-01 race with Test A/D and guarding the happy path with Test B/C.
- Added a required `onEnvironmentReady(): void` dep to `BootstrapPluginInitDeps`, invoked exactly once in `bootstrapPluginInit`'s success path (after `setEnvironment`, before `switchTicket`), never on the reject path.
- Added `environmentReadyRef` to `GrispiProvider`; the `currentTicketUpdated` handler stays registered synchronously but no-ops (dropped, logged via `console.info`) until the ref flips.
- Standalone mode sets the same ref for invariant parity (one line, nothing reads it there).
- Strengthened `plugin-bootstrap.test.ts`'s resolve-branch and reject-branch assertions for the new dep's call order / absence.

## RED Failure (Task 1, captured verbatim)

Command: `CI=true npm test -- --watchAll=false src/contexts/__tests__/grispi-context.test.tsx` (pre-fix source tree)

```
FAIL src/contexts/__tests__/grispi-context.test.tsx
  GrispiProvider — WR-01 pre-bootstrap SDK ticket-update gate
    ✕ Test A (regression): a currentTicketUpdated event fired before _init() resolves issues zero getTicket calls (31 ms)
    ✓ Test B (no regression): after _init() resolves, currentTicketUpdated reaches getTicket with the event's ticket key (6 ms)
    ✓ Test C (CORE-03 not regressed): resolving _init() routes the bundle's own ticketKey through switchTicket, after setEnvironment (3 ms)
    ✕ Test D (reject path): when _init() rejects, a subsequent currentTicketUpdated event still issues zero getTicket calls (3 ms)

  ● GrispiProvider — WR-01 pre-bootstrap SDK ticket-update gate › Test A (regression): a currentTicketUpdated event fired before _init() resolves issues zero getTicket calls

    expect(jest.fn()).not.toHaveBeenCalled()

    Expected number of calls: 0
    Received number of calls: 1

    1: "EARLY-TICKET"

      at Object.<anonymous> (src/contexts/__tests__/grispi-context.test.tsx:210:31)

  ● GrispiProvider — WR-01 pre-bootstrap SDK ticket-update gate › Test D (reject path): when _init() rejects, a subsequent currentTicketUpdated event still issues zero getTicket calls

    expect(jest.fn()).not.toHaveBeenCalled()

    Expected number of calls: 0
    Received number of calls: 1

    1: "POST-REJECT-TICKET"

      at Object.<anonymous> (src/contexts/__tests__/grispi-context.test.tsx:277:31)

Test Suites: 1 failed, 1 total
Tests:       2 failed, 2 passed, 4 total
```

This is the real race, not a setup failure: `mockGetTicket` was called once with the incoming ticket key when zero calls were expected — confirming the ungated handler fetches through the class-default host both before the SDK handshake resolves (Test A) and after it rejects (Test D). Tests B and C (the happy-path / CORE-03 assertions) passed unmodified, isolating the failure to exactly the two race scenarios WR-01 describes.

## Task Commits

1. **Task 1: RED — regression test rendering the real GrispiProvider** - `1c38a88` (test)
2. **Task 2: GREEN — onEnvironmentReady dep + gated handler** - `37cf6fd` (feat)
3. **Task 3: Full-suite and type-check regression gate** - no code changes (verification only, see below)

**Plan metadata:** committed separately by the orchestrator (docs)

## Files Created/Modified

- `src/contexts/__tests__/grispi-context.test.tsx` — new; renders the real `GrispiProvider` via a `jest.isolateModules` helper that requires `react` + `react-dom/client` + the provider together (see Deviations), with a deferred `plugin._init()` stub to open the pre-bootstrap window
- `src/contexts/plugin-bootstrap.ts` — required `onEnvironmentReady(): void` dep, invoked immediately after `setEnvironment`, before the auth-header writes; documented as WR-01/CORE-04
- `src/contexts/grispi-context.tsx` — `environmentReadyRef` declared alongside `activeKeyRef`; standalone branch sets it for parity; plugin branch passes `onEnvironmentReady` into `bootstrapPluginInit`; `currentTicketUpdated` handler gates its body (registration stays synchronous)
- `src/contexts/__tests__/plugin-bootstrap.test.ts` — all six `bootstrapPluginInit({...})` call sites now pass `onEnvironmentReady: jest.fn()`; resolve-branch test asserts call order (`setEnvironment` < `onEnvironmentReady` < `switchTicket`); reject-branch test asserts it was never called

## Decisions Made

None beyond the plan's pre-settled `<design_decisions>` (DD-1 through DD-5), which were implemented as written — no re-litigation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed a duplicate-React-instance crash in the Task 1 test's module-reload helper**
- **Found during:** Task 1 (writing the RED test)
- **Issue:** The plan's prescribed pattern — `jest.isolateModules(() => { require("@/contexts/grispi-context") })`, rendered via the test file's top-level static `react`/`react-dom/client` imports — crashed every test with `TypeError: Cannot read properties of null (reading 'useState')`. Root cause: `jest.isolateModules` gives everything required inside its callback (including transitive `react` imports pulled in while loading `grispi-context.tsx`) a fresh, separate module instance from the one the test file's static imports already had cached. The freshly-isolated `GrispiProvider`'s hooks then called into a `react` copy whose dispatcher was never activated by the OUTER `react-dom`'s render loop — two disconnected React copies, not a bug in the source under test.
- **Fix:** Require `react`, `react-dom/client`, AND `@/contexts/grispi-context` together inside the same `jest.isolateModules` callback, and drive rendering (`createElement`, `createRoot`, `act`) exclusively through that one isolated set for the duration of each test — never mixing in the file's outer static imports for the actual render/act calls.
- **Files modified:** src/contexts/__tests__/grispi-context.test.tsx (this is the file being authored in Task 1; no source files under test were touched)
- **Verification:** Re-ran the RED command after the fix — the failure became the real race assertion (`getTicket` called once when zero expected) instead of the setup crash; confirmed via the RED Failure section above.
- **Committed in:** 1c38a88 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking, Rule 3 — test-infrastructure only, no production code affected)
**Impact on plan:** No change to the plan's design decisions, source-code fix, or test assertions/behavior — only the test file's internal module-loading mechanics needed adjustment to make the RED failure legible. All four `<behavior>` assertions in Task 1 are implemented exactly as specified.

## Issues Encountered

None beyond the Rule 3 test-infrastructure fix documented above.

## Task 3 — Full-suite and type-check regression gate

- `CI=true npm test -- --watchAll=false`: **31 suites / 388 tests, 0 failures** (baseline was 30/384; +1 suite / +4 tests, exactly the new `grispi-context.test.tsx` and its four cases).
- `npx tsc --noEmit`: exit 0.
- Confirmed by grep: all four screen/consumer test files still `jest.mock("@/contexts/grispi-context")` wholesale and were not modified.
- No file outside `files_modified` was changed; `git status --short` after Task 3 shows only the untracked planning directory.
- WR-02, WR-03, WR-04, WR-05, IN-02, IN-03, and REQUIREMENTS.md line 83 were left untouched, per the plan's explicit out-of-scope list.

## Next Phase Readiness

- `04.1-VERIFICATION.md`'s blocking gap (`status: gaps_found`) is now closeable — both `missing` items (the success-path gate and a test exercising the race) are satisfied. This plan does NOT edit `04.1-VERIFICATION.md`'s status field; re-verification owns that.
- WR-02 (the `setEnvironment` -> `fetch` terminal-link coverage gap) and the other deferred findings remain open and untouched, tracked separately.

---
*Quick task: 260810-j2w*
*Completed: 2026-08-10*

## Self-Check: PASSED

All 5 created/modified files found on disk; both task commits (1c38a88, 37cf6fd) found in git log.
