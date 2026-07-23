---
phase: 02-yeni-yan-g-r-me-ba-latma
plan: 01
subsystem: api
tags: [typescript, mobx, grispi-rest, jest, tdd]

# Dependency graph
requires:
  - phase: 01-temel-ve-salt-okunur-g-r-me-listesi
    provides: HttpHandler/Authentication/Tickets(advancedSearch,getTicket)/Users client scaffolding, NetworkError/HttpError typing, side-conversation.ts convention
provides:
  - Probe-confirmed CreateTicketRequest/Customer/CustomerSearchResponse types
  - Tickets.createTicket(body) client method (POST public/v1/tickets)
  - New Customers client with search() (GET public/v1/customers/search)
  - grispiAPI.customers facade wiring
  - formatRequesterField/formatPrefillSubject/isValidEmail pure helpers (tested)
affects: [02-02, 02-03, 02-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "createTicket mirrors advancedSearch's POST send<T> pattern exactly"
    - "Customers client mirrors Users client (constructor-injection http/auth)"
    - "New page-envelope types (CustomerSearchResponse) reuse the AdvancedSearchResponse content-wrapped Spring-page shape rather than inventing a new envelope"

key-files:
  created:
    - src/grispi/client/customers.ts
  modified:
    - src/types/grispi.type.ts
    - src/grispi/client/tickets.ts
    - src/grispi/client/api.ts
    - src/lib/side-conversation.ts
    - src/lib/__tests__/side-conversation.test.ts

key-decisions:
  - "Reused existing Ticket type for createTicket's 201 response instead of defining a new CreateTicketResponse — probe confirmed identical shape family (A1)"
  - "CustomerSearchResponse reuses the AdvancedSearchResponse content-wrapped page-envelope pattern — probe corrected the RESEARCH.md assumption of a plain array (A2)"
  - "publicVisible narrowed to the true literal type (not boolean) in CreateTicketRequest — a caller cannot accidentally construct a silent/internal-only side ticket"
  - "Customers.search size defaults to 10 (panel is ~372px wide; a larger page would never fit on screen)"

patterns-established:
  - "Pattern: probe-confirmed types get a 'CONFIRMED live (Phase 02 Plan 01 Task 1 checkpoint probe)' doc-comment citing 02-01-SUMMARY.md, matching the Phase 1 convention of citing 01-02-probe-findings.md"

requirements-completed: [COMP-02, COMP-04]

coverage:
  - id: D1
    description: "formatRequesterField/formatPrefillSubject/isValidEmail pure helpers, TDD'd against the plan's behavior cases"
    requirement: "COMP-04"
    verification:
      - kind: unit
        ref: "src/lib/__tests__/side-conversation.test.ts#formatRequesterField / formatPrefillSubject / isValidEmail"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tickets.createTicket + Customers.search + grispiAPI.customers wired with probe-confirmed types, typecheck clean"
    requirement: "COMP-02"
    verification:
      - kind: unit
        ref: "CI=true npx tsc --noEmit"
        status: pass
    human_judgment: true
    rationale: "No unit test exercises the actual live HTTP call (correctly deferred to Plan 04's ComposeStore integration) — typecheck alone proves shape compatibility, not runtime correctness against the live tenant beyond what Task 1's checkpoint already confirmed."

# Metrics
duration: ~15min (Tasks 2-3; Task 1 checkpoint resolved by human in a prior session)
completed: 2026-07-23
status: complete
---

# Phase 02 Plan 01: Yeni Yan Görüşme — Temel (Types + Clients) Summary

**Probe-confirmed createTicket/customers.search types, two new REST client methods (Tickets.createTicket, Customers.search), and three TDD'd pure formatting/validation helpers.**

## Performance

- **Duration:** ~15 min for Tasks 2-3 (this continuation session)
- **Tasks:** 3 (Task 1 checkpoint resolved by human before this session; Tasks 2-3 executed here)
- **Files modified:** 6 (1 new: `src/grispi/client/customers.ts`)

## Accomplishments

- Verified `POST /public/v1/tickets` and `GET /public/v1/customers/search` real response shapes against the gsocial-test tenant before writing any client code (A1-A5, see "Probe Findings" below)
- Added `Tickets.createTicket` (COMP-04) and a brand-new `Customers` client with `search()` (COMP-02), wired into the `grispiAPI` facade
- Added `formatRequesterField`/`formatPrefillSubject`/`isValidEmail` pure helpers with TDD coverage, appended to the existing `side-conversation.ts`/`side-conversation.test.ts` (no new files)

## Probe Findings (Task 1 checkpoint — human-run against gsocial-test)

**A1 — createTicket → HTTP 201 CONFIRMED.** New side-ticket key arrives in the top-level `key` field of the response body (e.g. `"TICKET-580"` — the probe ticket key, for traceability with Plan 04). `channel` returned `"INTEGRATION"` (Open Question #2 answered). The 201 body is the same shape family as the existing `getTicket` `Ticket` type (top-level `key`, `channel`, `callMergeStatus`, `form`, `createdAt`, `updatedAt`, `solvedAt`, `comments[]`, `fieldMap{}`, `relation[]`, `resolution`) — **the existing `Ticket` type was reused as-is**, no new `CreateTicketResponse` type was needed.

**A2 — customers.search envelope CORRECTED.** RESEARCH.md assumed a plain array; the live response is a content-wrapped Spring-page envelope (`{ content: [...], pageable, totalSize, totalPages, empty, size, offset, pageNumber, numberOfElements }`) — the same family as `AdvancedSearchResponse`. `CustomerSearchResponse` was typed to reuse that existing envelope pattern rather than duplicating it.

**A3 — Customer record fields CONFIRMED.** `id: number`, `email: string`, `emails: string[]`, `fullName: string | null`, `firstName: string | null`, `lastName: string | null`, `role: string` (e.g. `"ROLE_END_USER"`), `enabled: boolean`, plus `phone`, `phones`, `organization`, `language`, `tags`, `fieldMap`, `groups`, `createdAt`, `updatedAt`. The recipient-field UI (Plan 03) only needs `fullName` + `email`.

**A4 — unregistered `:email` requester CONFIRMED.** An unregistered `:<email>` requester auto-creates an end-user and the ticket still creates (201) — the colon-prefix format (`formatRequesterField`) is correct.

**A5 — creator binding CONFIRMED.** `creator: [{ key: "us.email", value: "<agentEmail>" }]` binds to the real team user (Davut Kember, id 15, ROLE_ADMIN, teamUser:true) — format confirmed as-is.

**Pitfall #1 — empty subject REJECTED (new constraint).** `ts.subject` with `value: ""` → HTTP 422 `"Subject is required when creating a ticket."`, even though the key is present. `CreateTicketRequest.fields` types the key as always-required and callers must always supply a non-empty subject string; documented as a doc-comment on the type and on `formatPrefillSubject`.

**New constraint — customers.search `searchTerm` minimum length.** A `searchTerm` under 3 characters returns HTTP 422 `"Search term must be at least '3' characters long."`. Documented as a doc-comment on `Customers.search` and on `CustomerSearchResponse`; **directly informs Plan 02-03's debounce logic — the recipient-field autocomplete must not fire a search below 3 characters.**

**Probe ticket for traceability:** `TICKET-580` (created live during the A1 probe against gsocial-test; not cleaned up, left as evidence of the confirmed shape).

## Task Commits

Each task was committed atomically:

1. **Task 1: Canlı API probe (A1-A5)** — resolved by human before this continuation session (no commit in this session's log; checkpoint findings supplied directly and recorded above)
2. **Task 2: Saf yardımcı fonksiyonlar** - `9dbeb69` (feat, TDD)
3. **Task 3: Yazma/arama istemcileri** - `0299c74` (feat)

_Note: Task 2 was TDD but tests and implementation landed together in one commit since the plan's `<behavior>` cases were straightforward pure functions with no separate RED-only step required by the plan (no plan-level `type: tdd` gate on this plan — task-level `tdd="true"` only)._

## Files Created/Modified

- `src/types/grispi.type.ts` - Added `CreateTicketRequest`, `Customer`, `CustomerSearchResponse` (reused existing `Ticket` for createTicket's response)
- `src/grispi/client/tickets.ts` - Added `createTicket(body)`; updated class doc-comment (createTicket now built in Phase 2)
- `src/grispi/client/customers.ts` (NEW) - `Customers` class with `search(params)`, mirrors `users.ts`
- `src/grispi/client/api.ts` - Wired `customers: Customers` into the `GrispiAPI` facade
- `src/lib/side-conversation.ts` - Added `formatRequesterField`, `formatPrefillSubject`, `isValidEmail`
- `src/lib/__tests__/side-conversation.test.ts` - Added `describe` blocks for the three new helpers

## Decisions Made

- Reused the existing `Ticket` type for `createTicket`'s 201 response instead of a new `CreateTicketResponse` type — probe confirmed identical shape family (A1), and the plan explicitly allowed this ("mevcut Ticket yeterliyse onu kullan")
- `CustomerSearchResponse` reuses the `AdvancedSearchResponse` content-wrapped page-envelope pattern rather than a bespoke type — same Spring-page family (A2)
- `CreateTicketRequest.comment.publicVisible` typed as the `true` literal (not `boolean`) so a caller cannot silently construct an internal-only side ticket
- `Customers.search` defaults `size` to 10 given the ~372px panel width (Open Question #3 resolved by planner discretion, per plan)

## Deviations from Plan

None - plan executed exactly as written for Tasks 2-3. Task 1's checkpoint was resolved by the human outside this agent's execution (per the continuation brief); no live API calls, curl probes, or ticket creation were performed by this agent — all Task 2/3 work was built purely from the human-supplied confirmed shapes.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required beyond what was already verified in Task 1 (existing `.env.development.local` / `REACT_APP_DEV_TOKEN` from Phase 1).

## Next Phase Readiness

- `grispiAPI.customers.search` and `grispiAPI.tickets.createTicket` are ready for Plan 02 (compose screen wiring) and Plan 04 (ComposeStore submit flow)
- Plan 04's `createTicket` body construction can rely on the confirmed shapes above without further live-probing
- Plan 03's recipient-field debounce must respect the 3-character `searchTerm` minimum documented here
- No blockers for subsequent plans in this phase

---
*Phase: 02-yeni-yan-g-r-me-ba-latma*
*Completed: 2026-07-23*

## Self-Check: PASSED

All created/modified files and both task commit hashes (`9dbeb69`, `0299c74`) verified present on disk / in git log.
