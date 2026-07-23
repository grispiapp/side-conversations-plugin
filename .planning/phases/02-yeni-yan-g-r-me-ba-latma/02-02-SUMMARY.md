---
phase: 02-yeni-yan-g-r-me-ba-latma
plan: 02
subsystem: ui
tags: [react, mobx, mobx-react-lite, typescript, navigation-state-machine]

# Dependency graph
requires:
  - phase: 02-yeni-yan-g-r-me-ba-latma
    provides: "Plan 01's createTicket/customers.search API clients + confirmed agent identity probe (davutkmbr@gmail.com)"
provides:
  - "PanelNavigationStore — list/compose/chat screen state machine with D-02/D-03 dirty-guard return contracts"
  - "GrispiContext.agentEmail — createTicket creator source, wired from bundle.context.agent.email (plugin) and REACT_APP_DEV_AGENT_EMAIL (standalone dev)"
  - "app.tsx screen-swap wiring — compose/chat screens now reachable from the list via + CTA / back arrow (COMP-01)"
affects: ["02-03 (compose form fields land inside ComposeScreen's empty shell)", "02-05 (dirty-guard wiring replaces isDirty=false stub, ConfirmDialog consumes requestBack/handleParentTicketChanged return values)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MobX state-machine store with no generation-guard (plain synchronous field mutations) — PanelNavigationStore, contrasted with SideConversationsStore's async generation-guard pattern"
    - "React context -> MobX store bridging via useEffect on useGrispi().ticket?.key (existing pattern, referenced not yet consumed this plan — app.tsx's D-03 bridge lands in a later plan)"

key-files:
  created:
    - src/store/panel-navigation-store.ts
    - src/store/__tests__/panel-navigation-store.test.ts
    - src/screens/compose-screen.tsx
    - src/screens/chat-screen.tsx
  modified:
    - src/lib/standalone-dev.ts
    - src/lib/__tests__/standalone-dev.test.ts
    - src/contexts/grispi-context.tsx
    - src/contexts/plugin-bootstrap.ts
    - src/contexts/__tests__/plugin-bootstrap.test.ts
    - src/store/root-store.ts
    - src/app.tsx
    - src/screens/components/empty-state.tsx
    - src/screens/conversations-list-screen.tsx

key-decisions:
  - "DEFAULT_DEV_AGENT_EMAIL hardcoded to davutkmbr@gmail.com (Plan 01's live-verified probe identity — team user 'Davut Kember', id 15, ROLE_ADMIN) as the standalone-dev fallback, same .trim()-or-default style as tenantId/ticketKey"
  - "conversations-list-screen.tsx's new header '+' button is wrapped in an explicit w-full flex div — ScreenHeader's title container is line-clamp-2 (-webkit-box display), which sizes a single flex child to its content by default; without w-full the button would hug the title instead of pinning to the right edge"
  - "ComposeScreen's isDirty is hardcoded false this plan (no form fields exist yet) — requestBack/handleParentTicketChanged are called with real values only from Plan 05 onward; the shell wiring is proven by PanelNavigationStore's own unit tests, not by ComposeScreen's currently-trivial call site"

requirements-completed: [COMP-01, COMP-04]

coverage:
  - id: D1
    description: "agentEmail resolves from bundle.context.agent.email in plugin mode, or REACT_APP_DEV_AGENT_EMAIL (with DEFAULT_DEV_AGENT_EMAIL fallback) in standalone dev mode, and is exposed via useGrispi().agentEmail"
    requirement: "COMP-04"
    verification:
      - kind: unit
        ref: "src/contexts/__tests__/plugin-bootstrap.test.ts#resolve branch: wires auth/settings/loading then routes the ticket key through switchTicket"
        status: pass
      - kind: unit
        ref: "src/contexts/__tests__/plugin-bootstrap.test.ts#resolve branch: calls setAgentEmail with null when the bundle carries no agent"
        status: pass
      - kind: unit
        ref: "src/lib/__tests__/standalone-dev.test.ts#honors REACT_APP_DEV_AGENT_EMAIL when set, falls back to the default otherwise"
        status: pass
    human_judgment: false
  - id: D2
    description: "PanelNavigationStore drives list/compose/chat transitions and D-02/D-03 dirty-guard return contracts deterministically"
    verification:
      - kind: unit
        ref: "src/store/__tests__/panel-navigation-store.test.ts (9 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Temsilci '+' (header) veya boş-durum CTA'sı ile compose ekranını açar; ScreenHeader geri oku ile listeye döner (COMP-01)"
    requirement: "COMP-01"
    verification:
      - kind: unit
        ref: "typecheck: CI=true npx tsc --noEmit (clean); build: CI=true npx craco build (compiled successfully)"
        status: pass
    human_judgment: true
    rationale: "Visual/interactive screen-swap behavior (button click -> screen transition -> back arrow -> list) is not covered by an automated UI test in this plan; typecheck+build prove it compiles and wires correctly, but a human should click through the actual iframe/standalone flow to confirm COMP-01 end-to-end (Plan 03/05 UAT will exercise this along with the full compose form)."

duration: ~25min
completed: 2026-07-23
status: complete
---

# Phase 2 Plan 2: Navigation State Machine + Agent Identity Summary

**PanelNavigationStore (list/compose/chat MobX state machine with D-02/D-03 dirty-guard contracts) wired into a working screen-swap in app.tsx, plus GrispiContext.agentEmail sourced from bundle.context.agent.email (plugin) or REACT_APP_DEV_AGENT_EMAIL (standalone dev) as createTicket's future creator.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-23
- **Tasks:** 3 (Task 2 was TDD: RED then GREEN)
- **Files modified:** 12 (4 new, 8 modified — includes 2 pre-existing test files updated for the new required fields)

## Accomplishments
- `GrispiContext.agentEmail` now resolves in both plugin mode (`bundle.context.agent?.email ?? null`) and standalone dev mode (`REACT_APP_DEV_AGENT_EMAIL` env var, falling back to the live-verified `davutkmbr@gmail.com`) — closes the RESEARCH.md Pitfall #3 gap blocking `createTicket`'s mandatory `creator` field
- `PanelNavigationStore` (new MobX store) owns `list`/`compose`/`chat` screen state plus `requestBack`/`handleParentTicketChanged` dirty-guard return contracts (D-02/D-03), fully covered by 9 unit test cases written RED-first
- `app.tsx` swapped its hardcoded `<ConversationsListScreen/>` for `panelNavigation.screen`-driven conditional rendering across all three screens — the list's header "+" and the empty-state CTA now actually navigate (COMP-01)

## Task Commits

Each task was committed atomically:

1. **Task 1: Agent kimliği — GrispiContext.agentEmail + plugin-bootstrap + standalone-dev fallback** - `b2a2b53` (feat)
2. **Task 2: PanelNavigationStore — list/compose/chat durum makinesi + D-02/D-03 dirty-guard** - `243d4cc` (test, RED) → `ab43f63` (feat, GREEN)
3. **Task 3: app.tsx screen-swap + ComposeScreen/ChatScreen kabukları + "+" CTA enable (COMP-01)** - `2a9a700` (feat)

**Plan metadata:** _pending final docs commit_

## Files Created/Modified
- `src/lib/standalone-dev.ts` - `StandaloneDevConfig.agentEmail` + `DEFAULT_DEV_AGENT_EMAIL` + `REACT_APP_DEV_AGENT_EMAIL` resolution
- `src/lib/__tests__/standalone-dev.test.ts` - updated exact-match assertion + new agentEmail resolution test
- `src/contexts/grispi-context.tsx` - `agentEmail` state, threaded through both standalone and plugin branches and the provider value
- `src/contexts/plugin-bootstrap.ts` - `setAgentEmail` dep, called with `bundle.context.agent?.email ?? null`
- `src/contexts/__tests__/plugin-bootstrap.test.ts` - `setAgentEmail` fake added to all three existing tests + new "no agent -> null" case
- `src/store/panel-navigation-store.ts` (new) - `PanelScreen` type + `PanelNavigationStore` class
- `src/store/__tests__/panel-navigation-store.test.ts` (new) - 9 behavior cases
- `src/store/root-store.ts` - `panelNavigation: PanelNavigationStore` wired in
- `src/screens/compose-screen.tsx` (new) - navigable shell, `onBack` -> `requestBack(isDirty=false)`, empty `ScreenContent` (form fields deferred to Plan 03)
- `src/screens/chat-screen.tsx` (new) - minimal stub, `onBack` -> `confirmDiscardAndReturnToList()`
- `src/app.tsx` - `AppContent` observer reads `panelNavigation.screen`, conditionally renders list/compose/chat
- `src/screens/components/empty-state.tsx` - "+" CTA enabled, `onClick` -> `panelNavigation.openCompose()`
- `src/screens/conversations-list-screen.tsx` - header "+" button added (`w-full` flex wrapper), `onClick` -> `panelNavigation.openCompose()`

## Decisions Made
- `DEFAULT_DEV_AGENT_EMAIL = "davutkmbr@gmail.com"` — Plan 01's live probe confirmed this is a real ROLE_ADMIN team user on the tenant, matching the same hardcoded-fallback convention `DEFAULT_DEV_TENANT_ID`/`DEFAULT_DEV_TICKET_KEY` already use
- Header "+" button wrapped in an explicit `w-full` flex div inside `ScreenHeader`'s children slot, rather than modifying the shared `screen.tsx` primitive — `ScreenHeader`'s title container is `line-clamp-2` (`-webkit-box` display), which would otherwise size the button+title row to fit-content instead of stretching to the header's full width
- `ComposeScreen.isDirty` intentionally hardcoded `false` this plan — no form exists yet to be dirty; `PanelNavigationStore`'s dirty-guard branches are proven directly by its own unit tests rather than through ComposeScreen's still-trivial call site

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a pre-existing exact-match test broken by the new required `agentEmail` field**
- **Found during:** Task 1 (agentEmail threading)
- **Issue:** `src/lib/__tests__/standalone-dev.test.ts`'s `toEqual({...})` assertion on `resolveStandaloneDevConfig`'s return value would fail once `agentEmail` was added to `StandaloneDevConfig` (extra key mismatch)
- **Fix:** Updated the existing assertion to include `agentEmail: DEFAULT_DEV_AGENT_EMAIL`, added a new test case covering the `REACT_APP_DEV_AGENT_EMAIL` env override
- **Files modified:** src/lib/__tests__/standalone-dev.test.ts
- **Verification:** `CI=true npx craco test --watchAll=false --testPathPattern=standalone-dev` green (6/6)
- **Committed in:** b2a2b53 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed plugin-bootstrap tests broken by the new required `setAgentEmail` dep**
- **Found during:** Task 1 (agentEmail threading)
- **Issue:** `BootstrapPluginInitDeps.setAgentEmail` is a non-optional field; the three existing `plugin-bootstrap.test.ts` call sites (reject branch, store-error integration) would fail to typecheck without it, and the resolve-branch test's default `agent: {}` stub meant `bundle.context.agent.email` was `undefined`, not a real email, making the new assertion meaningless
- **Fix:** Added `setAgentEmail = jest.fn()` fakes to all call sites; gave the resolve-branch test's `makeBundle()` override a concrete agent (`id: 15, fullName: "Davut Kember", email: "davutkmbr@gmail.com"`, matching Plan 01's live probe) so the assertion exercises a real value; added a dedicated "no agent -> null" test
- **Files modified:** src/contexts/__tests__/plugin-bootstrap.test.ts
- **Verification:** `CI=true npx craco test --watchAll=false --testPathPattern=plugin-bootstrap` green (4/4)
- **Committed in:** b2a2b53 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — pre-existing tests broken by this plan's own type changes, in-scope per the scope-boundary rule since the breakage was directly caused by this task's edits)
**Impact on plan:** No scope creep — both fixes are the minimal test updates required to keep the touched files' own test suites green.

## Issues Encountered
None.

## User Setup Required
**External services require manual configuration.** The plan's frontmatter declares one `user_setup` entry: `REACT_APP_DEV_AGENT_EMAIL` in `.env.development.local` (Davut's Grispi account email, e.g. `davutkmbr@gmail.com`), read only under `NODE_ENV=development`. A working default (`DEFAULT_DEV_AGENT_EMAIL`) is already baked in via Plan 01's live-verified probe identity, so standalone dev UAT works out of the box without this env var — it only needs to be set if a different local agent identity is desired.

## Next Phase Readiness
- `agentEmail` is available at `useGrispi().agentEmail` for Plan 04's `createTicket` call (`creator` field source)
- `PanelNavigationStore` and its `screen`/`openCompose`/`openChat`/`requestBack`/`confirmDiscardAndReturnToList`/`handleParentTicketChanged` API is ready for Plan 03 (compose form fields fill `ComposeScreen`'s empty shell) and Plan 05 (real `isDirty` replaces the `false` stub, `ConfirmDialog` consumes the `requestBack`/`handleParentTicketChanged` return values)
- No blockers. `CI=true npx tsc --noEmit` and `CI=true npx craco build` both clean; full test suite (68 tests, 10 suites) green.

## TDD Gate Compliance

Task 2 (`tdd="true"`) followed the RED → GREEN sequence:
1. `243d4cc` — `test(02-02): add failing test for PanelNavigationStore state machine` (RED — module-not-found failure confirmed before implementation existed)
2. `ab43f63` — `feat(02-02): implement PanelNavigationStore list/compose/chat state machine` (GREEN — all 9 cases passing)

No REFACTOR commit was needed (implementation matched the RESEARCH.md Pattern 5 shape on the first pass, no cleanup required).

---
*Phase: 02-yeni-yan-g-r-me-ba-latma*
*Completed: 2026-07-23*

## Self-Check: PASSED

All created/modified files verified present on disk; all 4 task commit hashes (b2a2b53, 243d4cc, ab43f63, 2a9a700) verified present in git log.
