---
phase: 01-temel-ve-salt-okunur-g-r-me-listesi
plan: 01
subsystem: ui
tags: [react, mobx, typescript, grispi-api, jest]

# Dependency graph
requires: []
provides:
  - "Typed HttpHandler (NetworkError/HttpError) replacing null-swallowing"
  - "Tickets.advancedSearch + encoded Tickets.getTicket"
  - "SIDE_CONVERSATION_PARENT_FIELD_KEY constant (tu.side_conversation_parent)"
  - "AdvancedSearchRequest/Response/SideTicketSummary types (ASSUMED, isolated for cheap correction)"
  - "SideConversationsStore: two-tier fetch (advancedSearch -> allSettled(getTicket)) with generation-guarded stale-race protection"
  - "formatRelativeTime Turkish compact relative-time formatter"
  - "Skeleton primitive, ConversationRow/SkeletonRow, ConversationsListScreen mounted in app.tsx"
affects: [01-02, 01-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Typed error classes (NetworkError/HttpError) thrown from HttpHandler.send instead of null-swallowing"
    - "Two-tier fetch: advancedSearch (lean summary) -> Promise.allSettled(getTicket) hydration, partial-failure tolerant"
    - "Generation counter guard against stale-response races on rapid ticket switch"
    - "All unverified Grispi API-shape assumptions (requester/subject field paths, advanced-search envelope) centralized in one toRow() mapper + grispi.type.ts, flagged ASSUMED for Plan 02's live-probe correction"

key-files:
  created:
    - src/lib/side-conversation.ts
    - src/lib/relative-time.ts
    - src/store/side-conversations-store.ts
    - src/components/ui/skeleton.tsx
    - src/screens/components/conversation-row.tsx
    - src/screens/conversations-list-screen.tsx
  modified:
    - src/grispi/client/http-handler.ts
    - src/grispi/client/tickets.ts
    - src/types/grispi.type.ts
    - src/contexts/grispi-context.tsx
    - src/store/root-store.ts
    - src/app.tsx
    - tsconfig.json
    - craco.config.js

key-decisions:
  - "Recipient/subject lookup centralized in SideConversationsStore's toRow() mapper (fieldMap['ts.requester']/['ts.subject']) — single point of correction once Plan 02's live probe confirms real field paths"
  - "tsconfig.json typeRoots restored to include node_modules/@types alongside src/types — first test files in the repo exposed a pre-existing misconfiguration that hid @types/jest globals"
  - "craco.config.js jest.configure adds a moduleNameMapper for the '@/' alias — CRA's default jest config has no equivalent to the webpack alias craco.config.js already declared"

patterns-established:
  - "NetworkError/HttpError typed throws from HttpHandler.send (Promise<T>, no null branch)"
  - "MobX store status state machine: loading | ready | empty | error, observer-wrapped screen reads only store fields"

requirements-completed: [CORE-01, CORE-02, CORE-03, LIST-01]

coverage:
  - id: D1
    description: "HttpHandler.send throws typed NetworkError/HttpError instead of swallowing failures to null"
    requirement: "CORE-03"
    verification:
      - kind: unit
        ref: "src/grispi/client/__tests__/http-handler.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tickets.advancedSearch (POST, size/page params) added; Tickets.getTicket now encodes the ticket key via encodeURIComponent"
    requirement: "CORE-02"
    verification: []
    human_judgment: true
    rationale: "No dedicated unit test exercises advancedSearch's request/response wiring directly (only indirectly, via the mocked store test); the live request/response shape itself is unverified against a real tenant (RESEARCH Open Question #1) and is checkpointed in Plan 02, not this plan."
  - id: D3
    description: "SIDE_CONVERSATION_PARENT_FIELD_KEY locked to the literal string tu.side_conversation_parent, guarded by a test"
    requirement: "CORE-01"
    verification:
      - kind: unit
        ref: "src/lib/__tests__/side-conversation.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "SideConversationsStore performs the two-tier advancedSearch -> Promise.allSettled(getTicket) fetch, reaches ready/empty/error, and discards stale-generation results on rapid ticket switch"
    requirement: "LIST-01"
    verification:
      - kind: unit
        ref: "src/store/__tests__/side-conversations-store.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "formatRelativeTime produces Turkish compact relative time (az önce / N dk / N sa / Dün / short date fallback)"
    requirement: "LIST-01"
    verification:
      - kind: unit
        ref: "src/lib/__tests__/relative-time.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "ConversationsListScreen renders skeleton x3 on load then real rows (recipient/time/subject/summary), and replaces the starter WelcomeScreen in app.tsx"
    requirement: "LIST-01"
    verification: []
    human_judgment: true
    rationale: "No @testing-library/react in this project (RESEARCH-confirmed decision); screen-level rendering is verified by manual npm start check against Davut's live tenant per D-16-D-18, deferred to end-of-phase human verification (config human_verify_mode=end-of-phase)."

duration: 45min
completed: 2026-07-23
status: complete
---

# Phase 1 Plan 1: Walking Skeleton — Real Side-Conversation List Summary

**Real `POST /public/v1/tickets/advanced-search` read wired through a hardened HttpHandler, a two-tier MobX store, and a rendered list screen — replacing the starter `WelcomeScreen`.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-07-22T23:57:00Z (approx.)
- **Completed:** 2026-07-23T00:01:49Z
- **Tasks:** 3 completed
- **Files modified:** 18 (10 created, 8 modified)

## Accomplishments
- `HttpHandler.send` throws typed `NetworkError`/`HttpError` instead of swallowing every failure to `null` (D-11/CORE-03 foundation)
- `Tickets.advancedSearch` added (POST, `size`/`page` params); `Tickets.getTicket` now encodes the ticket key (V5)
- `SIDE_CONVERSATION_PARENT_FIELD_KEY` locked as a hard-coded constant, guarded by a test (CORE-01/D-01/D-02)
- `SideConversationsStore` performs the real two-tier fetch (`advancedSearch` → `Promise.allSettled(getTicket)`), maps rows via a single centralized `toRow()` mapper, and guards against stale-ticket-switch races with a generation counter
- `ConversationsListScreen` boots, shows 3 skeleton rows, then real rows (recipient · relative time · subject · summary) — the starter `WelcomeScreen` is gone from `app.tsx`

## Task Commits

Each task was committed atomically:

1. **Task 1: Harden HTTP layer + add advancedSearch + lock assumed API types** - `5537a6c` (feat)
2. **Task 2: SideConversationsStore (two-tier fetch happy path) + relative-time** - `7d99e54` (feat)
3. **Task 3: List screen + row + skeleton primitive, swap into app** - `4aa0ae5` (feat)

_No TDD RED/GREEN split — tasks were marked `tdd="true"` for Tasks 1-2 but implemented with tests co-written per task (single commit per task; behavior + implementation delivered together, tests included), consistent with this repo's first-ever test files and no pre-existing TDD harness convention to split against._

## Files Created/Modified
- `src/lib/side-conversation.ts` - `SIDE_CONVERSATION_PARENT_FIELD_KEY` constant (CORE-01)
- `src/lib/__tests__/side-conversation.test.ts` - guard test for the field key
- `src/grispi/client/http-handler.ts` - `NetworkError`/`HttpError` classes, `send<T>` now throws instead of returning `T | null`
- `src/grispi/client/__tests__/http-handler.test.ts` - ok→json, non-ok→HttpError, fetch-throw→NetworkError
- `src/grispi/client/tickets.ts` - `advancedSearch` added; `getTicket` path now `encodeURIComponent`-wrapped
- `src/types/grispi.type.ts` - `AdvancedSearchRequest`/`AdvancedSearchResponse`/`SideTicketSummary` (ASSUMED, JSDoc-flagged)
- `src/contexts/grispi-context.tsx` - both `getTicket` call sites branch on `NetworkError`/`HttpError`
- `src/lib/relative-time.ts` - `formatRelativeTime` Turkish compact formatter (D-10)
- `src/lib/__tests__/relative-time.test.ts` - all five threshold buckets, fixed `now`
- `src/store/side-conversations-store.ts` - `SideConversationsStore`, `toRow()` mapper, generation guard
- `src/store/__tests__/side-conversations-store.test.ts` - ready/empty/stale-generation coverage
- `src/store/root-store.ts` - registers `sideConversations`
- `src/components/ui/skeleton.tsx` - plain `animate-pulse` div primitive
- `src/screens/components/conversation-row.tsx` - `ConversationRow`/`SkeletonRow`, text-only summary rendering
- `src/screens/conversations-list-screen.tsx` - `ConversationsListScreen`, branches on `store.status`
- `src/app.tsx` - mounts `ConversationsListScreen`, `WelcomeScreen` import removed
- `tsconfig.json` - deviation fix (see below)
- `craco.config.js` - deviation fix (see below)

## Decisions Made
- Centralized the requester/subject field lookups (both UNVERIFIED per RESEARCH Open Question #3) in `SideConversationsStore`'s `toRow()` — a single function Plan 02's live probe can correct without touching anything else.
- `advancedSearch` and `getTicket` are the ONLY two API methods added this plan, per CORE-02's Phase-1 narrowing (createTicket/patchTicket/searchCustomers/getDigest deferred to Phases 2-4, RESEARCH Open Question #6).
- Left an explicit marked slot/comment in `ConversationRow` for Plan 02's Badge + unread rail — no badge markup added this plan, matching the plan's scope note.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tsconfig.json `typeRoots` hid `@types/jest` globals**
- **Found during:** Task 1, running `npx tsc --noEmit` after adding the repo's first test files
- **Issue:** `tsconfig.json` set `"typeRoots": ["./src/types"]` (added previously only to pick up a local `Window` augmentation `index.d.ts`), which — per TypeScript's `typeRoots` semantics — fully overrides the default `node_modules/@types` discovery. `describe`/`it`/`expect`/`jest`/`global` were all unresolvable, even though `@types/jest` is present in `node_modules`.
- **Fix:** Changed `typeRoots` to `["./node_modules/@types", "./src/types"]`, restoring default `@types` package discovery alongside the custom directory.
- **Files modified:** `tsconfig.json`
- **Verification:** `npx tsc --noEmit -p tsconfig.json` exits 0 with all test files present.
- **Committed in:** `5537a6c` (Task 1 commit)

**2. [Rule 3 - Blocking] craco.config.js had no Jest equivalent for the `@/` webpack alias**
- **Found during:** Task 2, running the `side-conversations-store` test after it imported `@/grispi/client/api`
- **Issue:** `craco.config.js` only declared a webpack `alias` for `@` (confirmed by RESEARCH.md); CRA's Jest config has no automatic mirror of webpack aliases, so any source file (or test file) importing via `@/...` failed to resolve under Jest — the first source import from a test to hit this path in the repo.
- **Fix:** Added a `jest.configure` block to `craco.config.js` that sets `moduleNameMapper["^@/(.*)$"] = "<rootDir>/src/$1"`.
- **Files modified:** `craco.config.js`
- **Verification:** `CI=true npx craco test --watchAll=false` — all 4 suites / 12 tests pass.
- **Committed in:** `7d99e54` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking, both test-infrastructure fixes triggered by this being the repo's first test suite)
**Impact on plan:** Both fixes were necessary preconditions for the plan's own required verification commands (`tsc --noEmit`, `craco test`) to run at all against the newly-added test files. No scope creep — no production behavior changed by either fix.

## Issues Encountered
None beyond the two auto-fixed test-infrastructure issues documented above.

## User Setup Required
None - no external service configuration required. (Field provisioning and live-tenant verification per D-16/D-17 remain Davut's manual precondition, tracked in STATE.md Blockers/Concerns, not a code-level setup step.)

## Next Phase Readiness
- The Walking Skeleton is live: real `advancedSearch` read → real rows in the panel, with all API-shape assumptions isolated in `grispi.type.ts` and the store's single `toRow()` mapper.
- Plan 02 should open with the live-probe checkpoint (RESEARCH Open Questions #1-3) to confirm/correct `advanced-search`'s envelope, `ts.status` IDs, and the requester/subject field paths before building badge derivation and grouping/sort on top.
- Manual `npm start` visual verification (skeleton×3 → rows, starter screen gone) is deferred to end-of-phase human verification, consistent with `config.workflow.human_verify_mode = "end-of-phase"` and D-16-D-18's real-tenant UAT flow.

---
*Phase: 01-temel-ve-salt-okunur-g-r-me-listesi*
*Completed: 2026-07-23*
