---
phase: 01-temel-ve-salt-okunur-g-r-me-listesi
plan: 04
subsystem: ui
tags: [react, mobx, typescript, jest, error-handling, gap-closure]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Typed HttpHandler (NetworkError/HttpError), grispiAPI singleton, SideConversationsStore"
  - phase: 01-03
    provides: "Shared switchTicket path (provisional-key ticket, D-14/D-15), ErrorCard component (CORE-03/D-11), standalone dev mode"
provides:
  - "bootstrapPluginInit(deps) — pure, injectable plugin-mode bootstrap wiring (src/contexts/plugin-bootstrap.ts)"
  - "Production (Grispi iframe) bootstrap path now routes through the same resilient switchTicket path as standalone mode and currentTicketUpdated — an initial advanced-search/getTicket failure reaches store.status='error' and engages ErrorCard + Yeniden dene (CORE-03 gap closed)"
  - "plugin._init() rejection clears loading with no unhandled promise rejection"
  - "ErrorCard error prop widened to NetworkError | HttpError | null (WR-05); no non-null assertion on store.error"
affects: [02, 03, 04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure, injectable bootstrap-wiring function (structural interface, not concrete classes) extracted from a React useEffect specifically to make an integration-only file's failure paths unit-testable"

key-files:
  created:
    - src/contexts/plugin-bootstrap.ts
    - src/contexts/__tests__/plugin-bootstrap.test.ts
  modified:
    - src/contexts/grispi-context.tsx
    - src/screens/components/error-card.tsx
    - src/screens/conversations-list-screen.tsx

key-decisions:
  - "bootstrapPluginInit does NOT call getTicket itself — it delegates ticket hydration entirely to switchTicket, which already owns the Network/Http/unexpected error branching for the detail fetch (single source of truth for the resilient path)"
  - "_init() rejection is swallowed inside bootstrapPluginInit (console.error + setLoading(false)) so the returned promise always resolves — this IS the missing .catch, not a workaround for one"
  - "ErrorCard's error prop is now nullable (WR-05) because the store's load() catch sets status='error' with error=null for a non-Network/Http exception; the existing instanceof-NetworkError ternary already degrades null to the generic Turkish copy with no logic change"

patterns-established:
  - "Pure, injectable bootstrap-wiring function (structural interface deps object) as the pattern for making integration-only provider useEffects unit-testable without React or the real SDK"

requirements-completed: [CORE-03]

coverage:
  - id: D1
    description: "Plugin-mode bootstrap resolve branch wires tenantId/token/settings/loading then routes the initial ticket key through switchTicket (the resilient path)"
    requirement: "CORE-03"
    verification:
      - kind: unit
        ref: "src/contexts/__tests__/plugin-bootstrap.test.ts#resolve branch: wires auth/settings/loading then routes the ticket key through switchTicket"
        status: pass
    human_judgment: false
  - id: D2
    description: "plugin._init() rejection resolves without throwing, clears loading, and never calls switchTicket/setSettings — no infinite rocket, no unhandled rejection"
    requirement: "CORE-03"
    verification:
      - kind: unit
        ref: "src/contexts/__tests__/plugin-bootstrap.test.ts#reject branch: resolves without throwing, clears loading, and never calls switchTicket/setSettings"
        status: pass
    human_judgment: false
  - id: D3
    description: "A rejecting advanced-search during bootstrap lands a real SideConversationsStore in status='error' with a typed HttpError, not a permanent 'loading' skeleton — proves store.load() actually fires on the production bootstrap path"
    requirement: "CORE-03"
    verification:
      - kind: unit
        ref: "src/contexts/__tests__/plugin-bootstrap.test.ts#store-error integration: a rejecting advanced-search during bootstrap lands the store in status='error' with a typed error"
        status: pass
    human_judgment: false
  - id: D4
    description: "ErrorCard error prop widened to NetworkError | HttpError | null; conversations-list-screen.tsx no longer force-asserts store.error non-null (WR-05)"
    requirement: "CORE-03"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit -p tsconfig.json (exit 0, proves widened type + removed assertion are sound end to end)"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-07-23
status: complete
---

# Phase 1 Plan 4: CORE-03 Plugin-Bootstrap Gap Closure Summary

**Extracted a pure, injectable `bootstrapPluginInit(deps)` that routes the production (Grispi iframe) bootstrap's initial ticket fetch through the same resilient `switchTicket` path standalone mode already used, closing the one verification gap where a bootstrap-time API failure left the agent stuck on an infinite skeleton with no Turkish error and no retry.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-23T16:39:37Z
- **Completed:** 2026-07-23T16:41:51Z
- **Tasks:** 2 completed (Task 1: TDD — RED/GREEN; Task 2: auto)
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- `src/contexts/plugin-bootstrap.ts` exports `bootstrapPluginInit(deps)` — a pure, injectable function that (a) is the missing `.catch` on `plugin._init()`, clearing `loading` and never throwing on an SDK handshake rejection, and (b) routes a successful bundle's `ticketKey` through `switchTicket`, the SAME provisional-key path standalone mode and `currentTicketUpdated` already use — so `store.load()` always fires on the plugin bootstrap path regardless of hydration outcome
- `src/contexts/grispi-context.tsx`'s plugin-mode `useEffect` now calls `bootstrapPluginInit({ plugin, authentication: grispiAPI.authentication, setSettings, setLoading, switchTicket })` in place of the old inline `plugin._init().then(...)` block that swallowed the initial `getTicket` failure with a console.error-only catch and never called `setTicket`/surfaced any error state
- Three new unit tests in `src/contexts/__tests__/plugin-bootstrap.test.ts` prove: (1) the resolve branch wires auth/settings/loading and calls `switchTicket(bundle.context.ticketKey)`; (2) the reject branch resolves without throwing and clears loading without calling `switchTicket`/`setSettings`; (3) a STORE-ERROR integration test driving a real `SideConversationsStore` through a rejecting `advancedSearch` (mocked `HttpError`) lands the store in `status="error"` with a typed, non-null `error` — proving CORE-03's ErrorCard + "Yeniden dene" now engage on the production bootstrap path
- WR-05 hardened: `ErrorCard`'s `error` prop widened to `NetworkError | HttpError | null` (the existing `instanceof NetworkError` ternary already degrades `null` to the generic Turkish copy — no logic change), and `conversations-list-screen.tsx` no longer force-asserts `store.error!` non-null
- Full suite green: 9 suites / 48 tests (original 45 + 3 new). `npx tsc --noEmit -p tsconfig.json` exits 0.

## Task Commits

1. **Task 1 (RED): add failing test for bootstrapPluginInit** - `a740118` (test)
2. **Task 1 (GREEN): route plugin bootstrap through switchTicket** - `445223d` (feat)
3. **Task 2: widen ErrorCard error prop to allow null (WR-05)** - `9572bc2` (fix)

## Files Created/Modified

- `src/contexts/plugin-bootstrap.ts` - new module, `bootstrapPluginInit(deps)`; pure/injectable, no React or SDK dependency
- `src/contexts/__tests__/plugin-bootstrap.test.ts` - resolve, reject, and store-error-integration coverage
- `src/contexts/grispi-context.tsx` - plugin-mode `useEffect` calls `bootstrapPluginInit` instead of the old inline `_init().then(...)` block; `GrispiBundle` import removed (no longer referenced directly in this file)
- `src/screens/components/error-card.tsx` - `error` prop widened to `NetworkError | HttpError | null` (WR-05)
- `src/screens/conversations-list-screen.tsx` - `ErrorCard error={store.error}` (non-null assertion removed)

## Decisions Made

- `bootstrapPluginInit` does not duplicate `getTicket` error handling — it delegates entirely to `switchTicket`, which already owns the Network/Http/unexpected branching for the detail fetch. Single source of truth for the resilient path, avoids two slightly different error-handling implementations drifting apart.
- The reject branch's `console.error` + `setLoading(false)` is the fix itself, not a placeholder — the function's contract is "the returned promise always resolves," proven directly by the reject-branch unit test's `resolves.toBeUndefined()` assertion.
- WR-05's `null` case is real and reachable today (the store's `load()` catch sets `error = null` for any exception that is not a `NetworkError`/`HttpError`), so widening the type is a correctness fix, not defensive-only churn.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>` blocks precisely; no auto-fixes, no blocking issues, no architectural questions.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The single Phase 1 verification gap (01-VERIFICATION.md, CORE-03 / ROADMAP SC5 partial) is closed: the production (Grispi iframe) bootstrap path now surfaces the Turkish ErrorCard + "Yeniden dene" on an initial-fetch failure, matching the already-verified standalone-mode and search-fetch behavior.
- `bootstrapPluginInit`'s pure/injectable pattern (structural-interface deps object) is available as a reusable convention for future integration-only wiring that needs unit coverage without spinning up React or the real SDK.
- No new packages, no new API endpoints, no schema changes — this plan touched only the bootstrap error path and the adjacent ErrorCard prop type.

---
*Phase: 01-temel-ve-salt-okunur-g-r-me-listesi*
*Completed: 2026-07-23*

## Self-Check: PASSED

All 5 created/modified source files confirmed present on disk; all 3 task commit hashes (`a740118`, `445223d`, `9572bc2`) confirmed in `git log`.
