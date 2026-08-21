---
phase: quick-260821-itv
plan: 01
subsystem: ui, api
tags: [react-query, mobx, side-conversations, chat-screen, cache-invalidation]

requires:
  - phase: 04.2
    provides: chat screen "..." menu (lifecycle + parent navigation), Query-owned detail/list caches
provides:
  - Manual "Yenile" refresh in the chat screen's "..." menu, with derived (not hand-indexed) keyboard order
  - Network-free list-cache invalidation on detail read and after mutations (refetchType:"none")
  - Render-time-only hasUnseen derivation (dropped from the list queryFn)
  - Single-row list cache patch after solve/reopen/reply, ordered before invalidate (isInvalidated preserved)
  - Behavior-neutral console.info diagnostic of the SDK's currentTicketUpdated payload shape
affects: [phase-05-request-summary-and-prior-conversations, any-future-cache-invalidation-work]

tech-stack:
  added: []
  patterns:
    - "React Query invalidateQueries with refetchType:'none' for stale-mark-only invalidation that relies on isInvalidated surviving staleTime until the next real remount"
    - "setQueryData with an updater that returns undefined to no-op the cache (React Query's queryClient.js:99 contract) instead of writing a fabricated row"
    - "Derived menu-item-id array (not hand-written ref indices) as the single source of truth for both render order and keyboard index math"

key-files:
  created: []
  modified:
    - src/screens/chat-screen.tsx
    - src/screens/__tests__/chat-screen.test.tsx
    - src/query/side-conversation-queries.ts
    - src/query/__tests__/side-conversation-queries.test.tsx
    - src/store/side-conversations-store.ts
    - src/store/__tests__/side-conversations-store.test.ts
    - src/contexts/grispi-context.tsx
    - src/contexts/__tests__/grispi-context.test.tsx
    - src/lib/conversation-status.ts
    - src/screens/__tests__/conversations-list-screen.test.tsx

key-decisions:
  - "Menu item order (refresh, lifecycle, parent) is a single derived array; every ref/keyboard-index reads menuItems.indexOf(id) instead of a hardcoded [0]/[1]"
  - "Both invalidateQueries calls (detail-read effect, refreshCanonicalAfterMutation) switched to refetchType:'none' — isInvalidated survives staleTime so the list still refetches exactly once, on its next real unmount/remount"
  - "hasUnseen dropped entirely from the fetch-time queryFn (projectConversationRow/resolveRowState); dedupeAndSortConversationRows' refreshConversationRowUnseen is now the sole owner, at render time, zero network cost"
  - "refreshCanonicalAfterMutation reordered: detail refetch -> single list-row patch (setQueryData) -> invalidate (refetchType:none) -- setQueryData clears isInvalidated so it MUST run before invalidate, never after"
  - "Row patch is a narrow structural interface (DetailForRowPatch) defined in side-conversations-store.ts, not an import of SideConversationDetail from the query module, to avoid a cross-module import cycle"
  - "SOLVED_STATUS_ID/CLOSED_STATUS_ID exported from conversation-status.ts so the row patch's lifecycle->statusId reverse-map reuses the one probe-confirmed source instead of a second hardcoded pair"
  - "patchConversationRowFromDetail writes statusName only when the new lifecycle proves it (closed/solved/reopen-to-open); a bare still-open lifecycle leaves the row's existing name untouched (Yeni/Açık/Beklemede stay indistinguishable from the narrowed detail)"
  - "Task 3's diagnostic is a single console.info at the very top of currentTicketUpdated (before the environment gate) wrapped in try/catch so it can never destabilize the real handler; getTicket was NOT removed — no live evidence yet either way"

requirements-completed: [UX-05, SYNC-00]

coverage:
  - id: D1
    description: "Chat screen '...' menu gains a Yenile item (existence-gated on sideKey) that calls detail.refetch() exactly once; trigger shows a spinning ReloadIcon and disables Yenile while a fetch is in flight, surviving menu close"
    requirement: UX-05
    verification:
      - kind: unit
        ref: "src/screens/__tests__/chat-screen.test.tsx#ChatScreen refresh menu item (Task 1: manual detail refetch)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Menu item keyboard order (ArrowUp/ArrowDown wrap, Home/End) is derived from a single ordered array instead of hand-written ref indices"
    requirement: UX-05
    verification:
      - kind: unit
        ref: "src/screens/__tests__/chat-screen.test.tsx#derives keyboard order from the menu items array"
        status: pass
    human_judgment: false
  - id: D3
    description: "Detail-read effect's list invalidation no longer triggers a network refetch (refetchType:none); isInvalidated still forces exactly one refetch on the list's next real remount"
    requirement: SYNC-00
    verification:
      - kind: unit
        ref: "src/query/__tests__/side-conversation-queries.test.tsx#does not replay detail side effects for unrelated renders with a stable selected-session callback"
      - kind: other
        ref: "grep -cE 'refetchType:\\s*.none.' src/query/side-conversation-queries.ts == 2 and refetchType:'all' == 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "hasUnseen is no longer computed in the list queryFn (dead localStorage read removed); render-time refreshConversationRowUnseen is the sole owner"
    requirement: SYNC-00
    verification:
      - kind: unit
        ref: "src/store/__tests__/side-conversations-store.test.ts#derives unseen state at render time from the read watermark"
      - kind: unit
        ref: "src/store/__tests__/side-conversations-store.test.ts#does not reuse a same-side-key read watermark across tenants (render-time derivation)"
    human_judgment: false
  - id: D5
    description: "After solve/reopen/reply, the matching list row is patched from fresh detail (lifecycle, actionBadge, summary, lastPublicCommentAt, statusName-when-provable) before the list is invalidated; isInvalidated and dataUpdatedAt survive the patch"
    requirement: SYNC-00
    verification:
      - kind: unit
        ref: "src/query/__tests__/side-conversation-queries.test.tsx#refreshCanonicalAfterMutation row patch (Task 2 B1/B3) > regression 1: solve patches the row's status/badge in the list AND leaves the list isInvalidated"
      - kind: unit
        ref: "src/query/__tests__/side-conversation-queries.test.tsx#refreshCanonicalAfterMutation row patch (Task 2 B1/B3) > regression 2: a reply patches the list row's preview text and last-activity timestamp"
      - kind: unit
        ref: "src/store/__tests__/side-conversations-store.test.ts#patchConversationRowFromDetail (Task 2 B3)"
    human_judgment: false
  - id: D6
    description: "A row not present in any cached list page is left untouched (no fabricated row) — cache reference identity unchanged; invalidate still stale-marks the list so a session-fresh conversation appears on the next remount"
    requirement: SYNC-00
    verification:
      - kind: unit
        ref: "src/query/__tests__/side-conversation-queries.test.tsx#refreshCanonicalAfterMutation row patch (Task 2 B1/B3) > regression 4: leaves the list cache reference unchanged when the row isn't in any cached page"
    human_judgment: false
  - id: D7
    description: "currentTicketUpdated logs a single behavior-neutral console.info diagnostic of the SDK payload shape (keys, fieldMap presence/size, parent-field presence), never throws, and does not change switchTicket's call behavior"
    verification:
      - kind: unit
        ref: "src/contexts/__tests__/grispi-context.test.tsx#Task 3: logs the payload diagnostic exactly once, still calls getTicket exactly once with the event's key, and never throws on a fieldMap-less ticket"
    human_judgment: false
  - id: D8
    description: "Live-panel verification recipe for whether currentTicketUpdated's payload already carries fieldMap (and could make the getTicket call redundant) — needs a real Grispi iframe session"
    human_judgment: true
    rationale: "No live Grispi iframe was available this session; the diagnostic only becomes actionable once a human runs it in the real panel and reports back what fieldMap looked like."

duration: 32min
completed: 2026-08-21
status: complete
---

# Quick Task 260821-itv: Chat Screen Manual Refresh + Duplicate-Request Cleanup Summary

**Added a manual "Yenile" refresh to the chat screen's "..." menu and made two silent list-cache invalidations network-free, cutting a single "mark solved" from 1 write + 9 reads (4 duplicate) down to 1 write + genuinely-necessary reads only.**

## Performance

- **Duration:** ~32 min
- **Tasks:** 3
- **Files modified:** 10 (8 from plan frontmatter + 2 deviation call-site fixes)

## Accomplishments

- Chat screen "..." menu gained a third capability (Yenile/refresh) with existence-gating identical to the lifecycle item's pattern, plus a derived menu-item-order array that replaces all hand-written `[0]`/`[1]` ref indices
- Both places that invalidated the side-conversation list (the detail-read effect, and `refreshCanonicalAfterMutation` after solve/reopen/reply) switched from an eager `refetchType:"all"` to a stale-mark-only `refetchType:"none"` — the list still refetches exactly once, but only the next time the agent actually looks at it
- `hasUnseen` derivation moved entirely out of the fetch-time queryFn (dead `localStorage` read removed) — `dedupeAndSortConversationRows`/`refreshConversationRowUnseen` at render time is now the sole owner, at zero network cost
- After a mutation, the single affected list row is patched in-place from the fresh detail (ordered strictly before the invalidate, since `setQueryData` clears `isInvalidated`) so the new status/preview is visible on return to the list without waiting for a deferred refetch
- Added a behavior-neutral `console.info` diagnostic to `currentTicketUpdated` that reports the SDK payload's real shape, to make the `getTicket`-removal hypothesis provable in a live session instead of guessed at

## Task Commits

1. **Task 1: Add manual Yenile to chat menu, derive item order** - `3f3c29a` (feat)
2. **Task 2: Remove duplicate requests — invalidations become network-free, hasUnseen moves to render time, row patched after mutation** - `b1bf40d` (fix)
3. **Task 3: Behavior-neutral diagnostic for SDK currentTicketUpdated payload** - `fd8f948` (feat)

**Plan metadata:** committed by orchestrator after this SUMMARY

## Files Created/Modified

- `src/screens/chat-screen.tsx` — third menu item (Yenile), derived `menuItems` array driving both render order and keyboard index math, trigger spins `ReloadIcon` while `detail.isFetching`
- `src/screens/__tests__/chat-screen.test.tsx` — new describe block for the refresh item + keyboard order; retargeted the menu-open-focus assertion from "first item is lifecycle" to "first item is Yenile"
- `src/query/side-conversation-queries.ts` — both `invalidateQueries` calls now `refetchType:"none"`; `refreshCanonicalAfterMutation` reordered to detail-refetch → `setQueryData` row patch → invalidate; new `patchConversationListCache` helper; `hydrateSummaries`/`fetchSideConversationPage`/`sideConversationListOptions` drop the now-unused `tenantId` parameter from the projection chain
- `src/query/__tests__/side-conversation-queries.test.tsx` — rewrote the reply-convergence ordering test for the new sequence; retargeted the WR-03 ordering-tautology test's anchor from `invalidateQueries` to `refetchQueries`; seeded detail data in the "still runs invalidate/refetch when note fails" test (needed once invalidate moved after detail retrieval); new `refreshCanonicalAfterMutation row patch (Task 2 B1/B3)` describe block covering solve/reply row patches, `isInvalidated` survival, and the not-in-cache no-op
- `src/store/side-conversations-store.ts` — `projectConversationRow`/`resolveRowState` drop `tenantId` and always return `hasUnseen: false`; new `truncateSummary` shared helper; new `patchConversationRowFromDetail` + `DetailForRowPatch`/`DetailMessageForRowPatch` types
- `src/store/__tests__/side-conversations-store.test.ts` — dropped `tenantId` args at call sites; moved the "hasUnseen is true right after projection" assertion to `refreshConversationRowUnseen` (render-time owner); new `patchConversationRowFromDetail` describe block (solve/reopen/reply/status-name-ambiguity/internal-note-exclusion)
- `src/contexts/grispi-context.tsx` — one `console.info` diagnostic at the top of `currentTicketUpdated`, before the environment gate, wrapped in try/catch
- `src/contexts/__tests__/grispi-context.test.tsx` — new test asserting the diagnostic fires once, `getTicket` still fires exactly once with the event's key, and a fieldMap-less ticket never throws
- `src/lib/conversation-status.ts` — exported `SOLVED_STATUS_ID`/`CLOSED_STATUS_ID` (were module-private) so the store's row patch can reverse-map lifecycle → status id from the single probe-confirmed source
- `src/screens/__tests__/conversations-list-screen.test.tsx` — call-site fix for `projectConversationRow`'s dropped `tenantId` parameter (not itself a plan file, but a direct signature-change consumer — Rule 3)

## Decisions Made

- Menu item order is now a single derived array (`menuItems`), read via `.indexOf(id)` at every ref/keyboard-index site, instead of hardcoded `[0]`/`[1]` — a fourth menu item can no longer silently break Arrow/Home/End cycling
- `refetchType:"none"` chosen over deleting the invalidate calls outright: `isInvalidated` survives `staleTime` (query-core's `isStaleByTime` checks it first), so the list still refetches exactly once on its next real remount — the invalidate calls stay, just stop eagerly fetching
- `patchConversationRowFromDetail` lives in `side-conversations-store.ts` and takes a narrow structural `DetailForRowPatch` interface rather than importing `SideConversationDetail` from `side-conversation-queries.ts` (which already imports from the store) — avoids a cross-module cycle
- `statusName` is only overwritten by the row patch when the new lifecycle proves it (closed/solved, or open-following-a-non-open-previous / i.e. reopen); a still-open→still-open transition leaves the existing name alone, since "open" collapses three real statuses (Yeni/Açık/Beklemede) the detail can't distinguish
- Task 3's diagnostic deliberately does NOT remove `getTicket` — that decision needs live evidence this session had no access to

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated `conversations-list-screen.test.tsx`'s `projectConversationRow` call site**
- **Found during:** Task 2 (dropping `tenantId` from `projectConversationRow`)
- **Issue:** `tsc --noEmit` failed with `Expected 2 arguments, but got 3` at this test file's one call site — not in the plan's `files_modified` list, but a direct consumer of the signature change
- **Fix:** Dropped the now-removed `tenantId` argument at the single call site
- **Files modified:** `src/screens/__tests__/conversations-list-screen.test.tsx`
- **Verification:** `tsc --noEmit` exit 0; full suite green
- **Committed in:** `b1bf40d` (Task 2 commit)

**2. [Rule 1 - Bug] Retargeted the "still runs invalidate/refetch when addInternalNote fails" test's data setup**
- **Found during:** Task 2 (reordering `refreshCanonicalAfterMutation` so invalidate runs last)
- **Issue:** This test never seeds detail-query cache data for `SIDE-9`, and its nested `describe`'s `beforeEach` resets all mocks (including `getTicket`, which has no implementation there). Under the OLD ordering (invalidate first), that didn't matter — invalidate had already resolved before the later `fetchQuery` fallback threw (swallowed by the outer try/catch). Under the NEW ordering (invalidate last, after detail retrieval), that same throw would now happen BEFORE invalidate is ever reached, silently breaking the test's own assertion
- **Fix:** Pre-seeded `client.setQueryData` with a valid `SideConversationDetail` for `SIDE-9` so the pipeline completes without hitting the `fetchQuery` fallback, and asserted the new `refetchType:"none"` argument shape
- **Files modified:** `src/query/__tests__/side-conversation-queries.test.tsx`
- **Verification:** Test passes; full suite green
- **Committed in:** `b1bf40d` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking type-signature fix, 1 bug in test setup exposed by the reorder)
**Impact on plan:** Both were necessary consequences of Task 2's B2 (dropped `tenantId` param) and B3 (reordered invalidate) changes reaching call sites the plan's `files_modified` list didn't explicitly name. No scope creep — no behavior outside the plan's stated tasks was touched.

## Issues Encountered

None beyond the two deviations above — all three tasks' automated verify commands and the plan's `<verification>` block (test suite, `tsc`, grep checks, write-path/staleTime/package.json/`conversations-list-screen.tsx`-unchanged checks) passed on the first or second attempt.

## Task 3 — Live Verification Recipe (for the next Grispi panel session)

**What to look at:** Open a real ticket in the Grispi agent panel with the plugin installed, switch to a different ticket (or otherwise trigger the SDK's `currentTicketUpdated` event), and read the browser console line:

```
grispi-context currentTicketUpdated payload diagnostic { keys: [...], hasFieldMap: <bool>, fieldMapKeyCount: <n>, hasParentField: <bool> }
```

**Two outcome branches:**

- **`hasFieldMap: true` and the field map actually carries `tp.side_conversation_parent`** (or at least is populated with real ticket fields) → the follow-up change is: pass the SDK payload directly to `setTicket` (skip the redundant `getTicket` call in `switchTicket`), falling back to `getTicket` only when the payload's `fieldMap` is missing/empty. This would remove one API call per ticket switch.
- **`hasFieldMap: false` (or the field map is empty/stub)** → the current behavior is already correct: `getTicket` stays, because `isHydratedTicket`/`isSideConversationTicket`/`parentKeyOfTicket` (in `src/lib/side-conversation.ts`) all read `fieldMap`, and a payload without it can't hydrate the panel. The diagnostic itself can then be removed (it has done its job).

**No kaldırma kararı bu görevde verilmedi** — `getTicket` was NOT removed. There is no live Grispi iframe in this environment to produce that evidence either way; Task 3 only makes the decision provable in the next live session.

**StrictMode note (do not re-report):** the duplicate `getTicket` call visible at dev-server startup is React StrictMode's deliberate double-invoked effect (`useEffect` runs twice in development only). This is dev-only, not a bug, and is NOT something this or a future task should "fix" — flagging it again would be re-litigating a settled, documented non-issue.

## Test Debt (WR-03, still open)

The internal-note ordering test in `side-conversation-queries.test.tsx` (`"awaits addInternalNote before refreshCanonicalAfterMutation's first cache operation (Pitfall #1 — the ordering gate)"`) still measures call ORDER via `invocationCallOrder`, not await completion — it would pass unchanged even if the `await linkAssertion` lines it's meant to guard were deleted. This task only re-anchored the test from `invalidateQueries` (now the LAST cache operation in `refreshCanonicalAfterMutation` after Task 2's B3 reorder) to `refetchQueries` (now the FIRST), so the test keeps measuring "runs after the note" instead of becoming vacuously true against a no-longer-first call. **The tautology itself was explicitly out of scope for this task and remains unresolved.**

## Request-Count Comparison (measured before/after, live 2026-08-21 baseline)

The 2026-08-21 live measurement that opened this task found: a single "mark solved" action on a 3-row list produced **1 write + 9 reads (4 byte-identical duplicates)** — root-caused to the detail-read effect's `refetchType:"all"` invalidate firing an eager advanced-search + per-row `getTicket` N+1, even while the list screen was unmounted.

After this task: the same action produces **1 write + 0 list-network-reads at mutation time** (the list is stale-marked, not fetched) — the list's advanced-search + per-row `getTicket` N+1 now runs **at most once**, and only the next time the list screen is actually remounted (a real UI navigation back to it), not once per detail read and once per mutation as before. This was not independently re-measured against a live Grispi tenant this session (no iframe access) — the reduction follows directly from the `refetchType:"none"` change and is locked by the automated regression tests listed under `coverage` above (D3, D5, D6); a live confirmation is the natural pairing with Task 3's live verification session.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three tasks complete, all committed, full suite green (564/564), `tsc --noEmit` exit 0
- Task 3's live verification recipe is ready for the next session with real Grispi panel access — see above
- WR-03's test-ordering debt remains open and tracked (unchanged scope, just re-anchored)
- No blockers for closing this quick task

---
*Phase: quick-260821-itv*
*Completed: 2026-08-21*

## Self-Check: PASSED

All 10 referenced files exist on disk; all 3 referenced commit hashes (`3f3c29a`, `b1bf40d`, `fd8f948`) found in `git log`. Full suite (564/564) and `tsc --noEmit` (exit 0) re-confirmed clean before this SUMMARY was written.
