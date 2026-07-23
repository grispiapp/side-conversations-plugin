---
phase: 01-temel-ve-salt-okunur-g-r-me-listesi
plan: 02
subsystem: ui
tags: [react, mobx, typescript, grispi-api, jest, badge-derivation]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Real advancedSearch -> Promise.allSettled(getTicket) two-tier fetch, SideConversationsStore, ConversationRow/ConversationsListScreen, ASSUMED grispi.type.ts shapes flagged for live-probe correction"
provides:
  - "Live-confirmed advanced-search + getTicket JSON shapes (envelope, requester, status, creator-role signal) recorded in 01-02-probe-findings.md and locked into grispi.type.ts + the store's toRow mapper"
  - "deriveBadge()/sortConversations() pure functions (src/lib/conversation-status.ts) implementing D-05/06/07/08"
  - "getLastSeenAt() defensive localStorage reader (src/lib/last-seen-store.ts), read-only this phase"
  - "Badge/badgeVariants component (src/components/ui/badge.tsx) matching the button.tsx cva/cn convention"
  - "SideConversationsStore rows now carry a computed badge and are grouped/sorted before status becomes 'ready'"
  - "ConversationRow renders the badge + a 3px primary left rail on 'yeni-yanit' rows"
affects: [01-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure derivation functions (deriveBadge/sortConversations) kept free of API/localStorage access; the store is the only place that resolves live data into their inputs"
    - "Defensive localStorage read (try/catch -> null) as the universal degrade-to-safe-default pattern for third-party iframe storage"
    - "statusId sourced from the advanced-search SUMMARY (not the hydrated ticket's fieldMap) — survives partial hydration failure"

key-files:
  created:
    - src/lib/conversation-status.ts
    - src/lib/__tests__/conversation-status.test.ts
    - src/lib/last-seen-store.ts
    - src/lib/__tests__/last-seen-store.test.ts
    - src/components/ui/badge.tsx
  modified:
    - src/types/grispi.type.ts
    - src/store/side-conversations-store.ts
    - src/store/__tests__/side-conversations-store.test.ts
    - src/screens/components/conversation-row.tsx
    - .gitignore

key-decisions:
  - "Recipient email resolved by matching fieldMap['ts.requester'].value (a user id, CONFIRMED live) against comments[].creator.id — no new API endpoint added (GET /public/v1/users/{id} exists live but is undocumented and out of this plan's file scope); falls back to the ticket key when no external comment exists yet"
  - "Agent-vs-external authorship derived from creator.role.authority !== 'ROLE_END_USER', NOT creator.role.teamUser alone — CONFIRMED live that integration/AI users report teamUser:false too"
  - "Badge statusId sourced from the advanced-search summary's inline status.id (always present) rather than the hydrated ticket's fieldMap['ts.status'] — makes the 'kapali' check independent of getTicket hydration success"
  - "getLastSeenAt wired into the store's badge resolution for forward-compatibility with Phase 3's seen-writer (THRD-04); functionally a no-op today since nothing writes a seen record yet, matching D-07's own 'no record ⇒ unseen' safe default"

patterns-established:
  - "Badge/rail is the sole Phase-1 differentiator: no separate 'seen' UI state exists yet, only the three ConversationBadge values"

requirements-completed: [LIST-02, LIST-03]

coverage:
  - id: D1
    description: "advanced-search + getTicket JSON shapes confirmed against Davut's live gsocial-test tenant (envelope, requester field, status path/IDs, creator-role signal) and locked into grispi.type.ts + toRow"
    requirement: "LIST-02"
    verification:
      - kind: manual_procedural
        ref: ".planning/phases/01-temel-ve-salt-okunur-g-r-me-listesi/01-02-probe-findings.md"
        status: pass
    human_judgment: true
    rationale: "Live-tenant confirmation was performed by the orchestrator against a real API with the user's token per Task 1's human-verify checkpoint (approved) — not re-derivable from an automated test."
  - id: D2
    description: "deriveBadge() returns kapali/yanit-bekleniyor/yeni-yanit per D-05/06/07, ignoring internal (non-public) comments"
    requirement: "LIST-02"
    verification:
      - kind: unit
        ref: "src/lib/__tests__/conversation-status.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "sortConversations() groups yeni-yanit -> yanit-bekleniyor -> kapali, descending activity within group, nulls last (D-08)"
    requirement: "LIST-03"
    verification:
      - kind: unit
        ref: "src/lib/__tests__/conversation-status.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "getLastSeenAt degrades to null on missing key, non-numeric value, or a throwing localStorage (Pitfall #5)"
    requirement: "LIST-02"
    verification:
      - kind: unit
        ref: "src/lib/__tests__/last-seen-store.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "SideConversationsStore computes badge per row (statusId from the summary, authorIsAgent from the confirmed role signal) and returns rows grouped/sorted before status becomes ready"
    requirement: "LIST-02"
    verification:
      - kind: unit
        ref: "src/store/__tests__/side-conversations-store.test.ts#derives per-ticket badges and returns rows grouped+sorted per D-08"
        status: pass
    human_judgment: false
  - id: D6
    description: "ConversationRow renders the correct Badge variant/label per row.badge and a 3px primary left rail only on yeni-yanit rows (LIST-03)"
    requirement: "LIST-03"
    verification: []
    human_judgment: true
    rationale: "No @testing-library/react in this project (RESEARCH-confirmed decision); visual rendering (badge colors, rail placement, top-of-list highlight) is deferred to end-of-phase human verification against the tenant's 13 test side tickets, consistent with config.workflow.human_verify_mode = 'end-of-phase'."

duration: ~20min (continuation after Task 1's live-probe checkpoint; probe itself performed by the orchestrator in a prior session)
completed: 2026-07-23
status: complete
---

# Phase 1 Plan 2: Badge Derivation + Grouped/Sorted List Summary

**"Sıra kimde" badges (Yeni yanıt / Yanıt bekleniyor / Kapalı) derived from live-confirmed API shapes, with the list grouped/sorted and new-reply rows highlighted by a purple left rail.**

## Performance

- **Duration:** ~20 min of code work (Task 1's live-tenant probe and 13-ticket test dataset were created by the orchestrator in a prior session per the human-verify checkpoint; this run recorded the confirmed findings into code and built Tasks 2-3)
- **Completed:** 2026-07-23T09:45:00Z (approx.)
- **Tasks:** 3 completed
- **Files modified:** 9 (5 created, 4 modified) + `.gitignore`

## Accomplishments
- Task 1's live probe (approved checkpoint) confirmed: advanced-search returns a **lean summary** with `status`/`subject` inline; `ts.requester` is a **user id**, not an email; SOLVED=4/CLOSED=5 as assumed; agent-vs-external authorship must use `creator.role.authority !== "ROLE_END_USER"`, not `teamUser` alone (integration/AI users also report `teamUser:false`)
- `grispi.type.ts` and the store's `toRow` mapper corrected to match — `subject` now read from the summary, `recipientEmail` resolved via comment-creator-id matching (no new API endpoint added)
- `deriveBadge`/`sortConversations` (pure, fully unit-tested) implement D-05/06/07/08; `getLastSeenAt` is a crash-safe localStorage reader (Pitfall #5)
- `Badge` component hand-written to match the existing `button.tsx` cva/cn convention with UI-SPEC's amber/emerald/slate color mapping
- `SideConversationsStore` now computes each row's badge (status from the summary, independent of hydration success) and returns the list grouped/sorted only after hydration fully settles
- `ConversationRow` renders the badge and a 3px primary left rail on `yeni-yanit` rows

## Task Commits

Each task was committed atomically:

1. **Task 1: Live-shape confirmation — lock statusId, requester, creator role** (checkpoint recording) - `abdf062` (fix)
2. **Task 2: deriveBadge + sortConversations + defensive last-seen + Badge component** - `6784ced` (feat)
3. **Task 3: Wire badges + sort into store and render badge + unread rail** - `01bbbcf` (feat)

_Task 1 itself was a human-verify checkpoint (no code) — the live-tenant probe and 13-ticket test dataset were produced by the orchestrator in the prior session per `01-02-probe-findings.md`; this commit records those confirmed findings into `grispi.type.ts` and the store's `toRow` mapper, which the plan's own Task 1 text explicitly permits ("if needed, corrections to src/types/grispi.type.ts + the store toRow mapper")._

## Files Created/Modified
- `src/types/grispi.type.ts` - `FieldMap`'s `serializedValue`/`userFriendlyValue`/`id`/`type` now optional (never observed live); `SideTicketSummary` gains `subject`/`status`/`channel`/`createdAt`/`updatedAt`; doc comments updated ASSUMED → CONFIRMED
- `src/store/side-conversations-store.ts` - `resolveRecipientEmail` (comment-creator-id match), `resolveBadge` (statusId from summary + `getLastSeenAt` wiring), `ConversationRowVM.badge`, `sortConversations` applied before `status = "ready"`
- `src/lib/conversation-status.ts` - `deriveBadge`, `sortConversations`, `ConversationBadge` (CONFIRMED SOLVED=4/CLOSED=5)
- `src/lib/__tests__/conversation-status.test.ts` - all badge branches + group/sort order + internal-comment exclusion
- `src/lib/last-seen-store.ts` - `getLastSeenAt`, try/catch degrade-to-null
- `src/lib/__tests__/last-seen-store.test.ts` - numeric/missing/malformed/throwing cases
- `src/components/ui/badge.tsx` - `Badge`/`badgeVariants`, `font-semibold`, amber/emerald/slate variants
- `src/screens/components/conversation-row.tsx` - Badge render + 3px primary left rail on `yeni-yanit`
- `src/store/__tests__/side-conversations-store.test.ts` - badge-derivation + grouped/sorted-order test; requester/subject fixtures aligned to confirmed shapes
- `.gitignore` - excludes the `.token` live-tenant probe artifact from ever being committed

## Decisions Made
- Requester email resolution stays a comment-creator-id match rather than adding a new `GET /public/v1/users/{id}` API call — that endpoint works live but is undocumented and outside this plan's `files_modified` scope (Rule 4 boundary); documented as a known limitation for agent-only threads with no external comment yet.
- Badge's `statusId` is read from the advanced-search summary (`summary.status.id`), not the hydrated ticket's `fieldMap["ts.status"]` — CONFIRMED the summary always carries status inline, so the "kapali" check no longer depends on `getTicket` succeeding.
- `getLastSeenAt` is called from the store's badge resolution now (not inside `deriveBadge`, which stays a pure function per RESEARCH's Code Example #3) — functionally a no-op today since Phase 3 (THRD-04) is the first plan to ever write a seen record.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `recipientEmail`/`subject` resolution was based on fields that don't exist live**
- **Found during:** Task 1 recording (applying the probe findings)
- **Issue:** Plan 01's `toRow` read `fieldMap["ts.requester"]?.userFriendlyValue` and `fieldMap["ts.subject"]?.userFriendlyValue` — CONFIRMED live that no `fieldMap` entry ever carries `userFriendlyValue`, and `ts.subject` doesn't exist as a `fieldMap` key at all. Both would have silently fallen through to `summary.key`, i.e. every row's recipient/subject was actually going to render the ticket key.
- **Fix:** `subject` now reads `summary.subject` (present inline in the advanced-search response); `recipientEmail` matches `fieldMap["ts.requester"].value` (a user id) against `comments[].creator.id`.
- **Files modified:** `src/store/side-conversations-store.ts`, `src/types/grispi.type.ts`
- **Verification:** `src/store/__tests__/side-conversations-store.test.ts` (updated fixtures + existing "reaches ready" test), `npx tsc --noEmit` exits 0
- **Committed in:** `abdf062` (Task 1 commit)

**2. [Rule 2 - Missing Critical] `.token` probe artifact was untracked but not gitignored**
- **Found during:** Task 1 recording, running `git status` before committing
- **Issue:** A live API token file (`.token`, used for the Task 1 tenant probe) sat untracked in the repo root with no `.gitignore` rule — a future `git add -A` or similar could accidentally commit a live credential.
- **Fix:** Added `.token` to `.gitignore`.
- **Files modified:** `.gitignore`
- **Verification:** `git status --short` no longer risks staging it accidentally.
- **Committed in:** `abdf062` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing-critical/security)
**Impact on plan:** Both fixes were necessary for the confirmed API shapes to actually work end-to-end and to prevent an accidental credential leak. No scope creep — no new API endpoints or architectural changes.

## Issues Encountered
None beyond the two auto-fixed issues documented above.

## User Setup Required
None - no external service configuration required. Task 1's live-tenant checkpoint (field provisioning + 13-ticket test dataset) was already completed and approved in the prior session; see `01-02-probe-findings.md` for the full test dataset reference table.

## Next Phase Readiness
- Every row now carries an accurate `badge` and the list is grouped/sorted per D-08; `ConversationRow` renders the badge + purple rail.
- Plan 03 (pagination, "daha fazla yükle") can rely on the confirmed advanced-search envelope (`content`/`totalPages`/`pageNumber` 0-indexed) without further probing.
- Visual verification (badge colors against the mockup, rail placement, closed rows staying at the bottom) is deferred to end-of-phase human verification against the tenant's 13 test side tickets (TICKET-563's children), per `config.workflow.human_verify_mode = "end-of-phase"`.
- Known limitation carried forward: recipient email falls back to the ticket key for any side ticket with no external-authored comment yet (agent-only threads) — resolvable via `GET /public/v1/users/{id}` if a future plan adds that API method.

---
*Phase: 01-temel-ve-salt-okunur-g-r-me-listesi*
*Completed: 2026-07-23*

## Self-Check: PASSED

All 11 created/modified files confirmed present on disk; all 3 task commit hashes (`abdf062`, `6784ced`, `01bbbcf`) confirmed in `git log`.
