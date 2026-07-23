---
phase: 01-temel-ve-salt-okunur-g-r-me-listesi
plan: 03
subsystem: ui
tags: [react, mobx, typescript, grispi-api, jest, pagination, error-handling, dev-mode]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Typed HttpHandler, advancedSearch/getTicket, SideConversationsStore two-tier fetch + generation guard, list screen"
  - phase: 01-02
    provides: "Live-confirmed API shapes (envelope/requester/status/role), deriveBadge/sortConversations, Badge + unread rail"
provides:
  - "EmptyState with the privacy identity sentence + disabled 'Yeni görüşme başlat' CTA (LIST-04, D-13)"
  - "ErrorCard with NetworkError/HttpError Turkish copy variants + Yeniden dene (CORE-03, D-11)"
  - "ListFooter 'Daha fazla yükle' with constant aria-label + spinner (LIST-06, D-12/D-14)"
  - "Store loadMore()/hasMore/loadingMore pagination + full-list re-sort across pages"
  - "Silent partial-hydration retry (one background pass, generation-guarded, never flips status)"
  - "Recipient enrichment via GET /public/v1/users/{id} (new Users client) — raw ticket key never rendered as alıcı (LIST-01 gap closure)"
  - "htmlToText plain-text summary extraction (tags stripped, entities decoded, React-text-only rendering preserved)"
  - "Standalone dev mode (NODE_ENV=development + REACT_APP_DEV_TOKEN) with soft-fail SDK guard + dev ticket switcher"
affects: [02, 03, 04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Immutable row/array replacement inside runInAction for silent store-side upgrades (deep in-place mutation is invisible to non-observer row components)"
    - "Background enrichment with per-id promise cache (userEmailCache) — dedupes /users/{id} lookups across load/loadMore cycles"
    - "Standalone dev mode gated on NODE_ENV=development AND env token; plugin mode byte-for-byte unchanged otherwise"
    - "Shared switchTicket path for SDK currentTicketUpdated + dev switcher: provisional ticket key set synchronously (instant skeleton, no rocket) then background detail hydration"

key-files:
  created:
    - src/screens/components/empty-state.tsx
    - src/screens/components/error-card.tsx
    - src/screens/components/list-footer.tsx
    - src/grispi/client/users.ts
    - src/lib/html-to-text.ts
    - src/lib/__tests__/html-to-text.test.ts
    - src/lib/standalone-dev.ts
    - src/lib/__tests__/standalone-dev.test.ts
    - src/components/dev-ticket-switcher.tsx
  modified:
    - src/store/side-conversations-store.ts
    - src/store/__tests__/side-conversations-store.test.ts
    - src/screens/conversations-list-screen.tsx
    - src/screens/components/conversation-row.tsx
    - src/grispi/client/api.ts
    - src/types/grispi.type.ts
    - src/contexts/grispi-context.tsx
    - src/app.tsx

key-decisions:
  - "Recipient ('alıcı') NEVER renders the raw ticket key: comment-creator match → background GET /public/v1/users/{id} (primaryEmail) → neutral '—' placeholder as strict last resort (LIST-01 gap closure, orchestrator note)"
  - "Comment bodies converted to plain text via htmlToText before truncation — text extraction only, output still rendered exclusively through React text interpolation (T-01 preserved)"
  - "Silent store-side row upgrades replace row objects + the rows array immutably; ConversationRow additionally wrapped in observer (belt-and-suspenders)"
  - "Ticket switch (SDK event AND dev switcher) no longer flips the global loading rocket — provisional key set synchronously so the list clears to skeleton instantly (D-14/D-15)"
  - "Standalone dev mode activates only with NODE_ENV=development AND REACT_APP_DEV_TOKEN (.env.development.local, git-ignored); CORS verified live so no dev proxy needed"

patterns-established:
  - "hasMore computed from the confirmed envelope (pageNumber + 1 < totalPages) with a content.length === size fallback"
  - "loadMore no-ops while loadingMore/!hasMore/status!=='ready' (self-throttling, T-03-03) and discards stale-generation appends"

requirements-completed: [CORE-03, LIST-04, LIST-05, LIST-06]

coverage:
  - id: D1
    description: "EmptyState renders the exact privacy sentence + single disabled CTA with 'Çok yakında' aria/tooltip"
    requirement: "LIST-04"
    verification:
      - kind: manual_procedural
        ref: "Task 3 UAT step 3 (approved 2026-07-23, standalone panel + orchestrator in-browser check)"
        status: pass
    human_judgment: true
    rationale: "No @testing-library/react in this repo; visual copy/layout verified live per config human_verify_mode=end-of-phase."
  - id: D2
    description: "ErrorCard shows distinct Turkish copy for NetworkError vs HttpError with working Yeniden dene; never renders error.body/status/headers"
    requirement: "CORE-03"
    verification:
      - kind: manual_procedural
        ref: "Task 3 UAT step 4 (approved; offline → network copy → retry restores)"
        status: pass
    human_judgment: true
    rationale: "Copy switching is a two-branch ternary on error class (code-reviewed); end-to-end offline behavior verified by human UAT."
  - id: D3
    description: "Silent partial-hydration retry upgrades dimmed rows in place without flipping status; repeat failure leaves them dimmed"
    requirement: "CORE-03"
    verification:
      - kind: unit
        ref: "src/store/__tests__/side-conversations-store.test.ts#silently retries a partially failed hydration"
        status: pass
    human_judgment: false
  - id: D4
    description: "loadMore appends page+1, re-sorts the full list, toggles hasMore off at the last page, discards stale-generation appends; ListFooter keeps aria-label during spinner"
    requirement: "LIST-06"
    verification:
      - kind: unit
        ref: "src/store/__tests__/side-conversations-store.test.ts#loadMore (D-12)"
        status: pass
      - kind: manual_procedural
        ref: "Task 3 UAT step 5 (approved; 10→13 with correct group insertion, button removed at end)"
        status: pass
    human_judgment: false
  - id: D5
    description: "load() resets rows/page/hasMore/loadingMore synchronously and bumps the generation at entry — ticket switch shows zero stale flash"
    requirement: "LIST-05"
    verification:
      - kind: unit
        ref: "src/store/__tests__/side-conversations-store.test.ts#resets rows/page/hasMore synchronously"
        status: pass
      - kind: manual_procedural
        ref: "Task 3 UAT step 6 (approved via dev switcher; no stale flash, instant skeleton)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Recipient email resolved for agent-only rows via GET /users/{id}; raw ticket key never rendered as alıcı; '—' strict last resort"
    requirement: "LIST-04"
    verification:
      - kind: unit
        ref: "src/store/__tests__/side-conversations-store.test.ts#falls back to GET /users/{id} + #applies the users-endpoint enrichment OBSERVABLY"
        status: pass
      - kind: manual_procedural
        ref: "Task 3 UAT step 1 (approved; uretici-firma@/destek-hatti@/servis-merkezi@ resolved live)"
        status: pass
    human_judgment: false

duration: ~40min code work (2 tasks + 2 deviation commits) + end-of-phase UAT checkpoint across sessions
completed: 2026-07-23
status: complete
---

# Phase 1 Plan 3: Boş/Hata/Sayfalama Durumları + Talep-Değişimi Sağlamlığı Summary

**Empty state with the privacy identity sentence, layered Turkish error card + retry, silent self-healing rows, "Daha fazla yükle" pagination, instant stale-free ticket switching — plus a standalone dev mode that made the real UAT runnable, all 7 UAT steps approved live.**

## Performance

- **Duration:** ~40 min of code work (12:48–13:13 local across 4 commits), plus the blocking end-of-phase UAT checkpoint (2 rounds of user feedback → fixes → approval)
- **Completed:** 2026-07-23
- **Tasks:** 3 completed (2 auto + 1 human-verify checkpoint, approved)
- **Files modified:** 17 (9 created, 8 modified)

## Accomplishments

- `EmptyState` with the exact copy contract — heading, body, the privacy sentence "Talep sahibi bu yazışmayı görmez." as its own line, and the single disabled "Yeni görüşme başlat" CTA with "Çok yakında" aria/tooltip (LIST-04, D-13)
- `ErrorCard` switching Turkish copy on `NetworkError` vs `HttpError` with "Yeniden dene"; never renders `error.body`/status/headers (CORE-03, D-11, T-03-01)
- Store: silent one-pass hydration retry (generation-guarded, never flips status), `loadMore()`/`hasMore`/`loadingMore` pagination with full-list re-sort across pages, synchronous reset at `load()` entry (D-15)
- **LIST-01 gap closed (orchestrator note):** recipient resolution is now comment-match → background `GET /public/v1/users/{id}` (`grispiAPI.users`, new client) → neutral "—" — the raw ticket key is never rendered as alıcı; live-verified on the agent-only test rows
- `ListFooter` keeps `aria-label="Daha fazla yükle"` constant while the visible label swaps to a spinner (D-14 + UI checker note)
- Standalone dev mode (dev-build + env-token gated, plugin mode untouched) with a soft-fail SDK guard and a dev-only ticket switcher driving the same `switchTicket` path as the SDK event — this is what made the real-panel-equivalent UAT executable
- `htmlToText` plain-text summaries (UAT feedback) with the XSS guarantee intact
- **Task 3 UAT: approved** — all 7 steps pass (rows/alıcı, badges+grouping+rail, empty state, error+retry+self-heal, pagination 10→13, stale-free ticket switch, no HTML rendering)

## Task Commits

1. **Task 1: Empty state + layered error card + partial-hydration retry (+ recipient gap closure)** - `017e768` (feat)
2. **Task 2: "Daha fazla yükle" pagination footer** - `658ec6c` (feat) — note: the store's `hasMore`/`loadingMore`/`loadMore()` and the screen's ListFooter wiring were implemented together with Task 1's coherent store rewrite and live in `017e768`; this commit adds the component
3. **Task 3: Phase-1 UAT (checkpoint)** — approved by Davut; no code. Two deviation commits emerged from the checkpoint loop:
   - `24df290` (feat) — standalone dev mode (UAT enabler)
   - `61dd905` (fix) — plain-text summaries + observable users-endpoint enrichment (UAT feedback)

## Files Created/Modified

- `src/screens/components/empty-state.tsx` - privacy sentence + disabled CTA (LIST-04/D-13)
- `src/screens/components/error-card.tsx` - Network/HTTP Turkish variants + Yeniden dene (CORE-03/D-11)
- `src/screens/components/list-footer.tsx` - Daha fazla yükle with constant accessible name (D-12/D-14)
- `src/grispi/client/users.ts` - `Users.getUser` → `GET /public/v1/users/{id}` (undocumented, live-confirmed)
- `src/grispi/client/api.ts` - registers `users` on the singleton
- `src/types/grispi.type.ts` - `GrispiUserProfile` (only consumed fields typed)
- `src/store/side-conversations-store.ts` - loadMore/hasMore/loadingMore, silent hydration retry, recipient enrichment + userEmailCache, htmlToText summaries, immutable row replacement
- `src/store/__tests__/side-conversations-store.test.ts` - 8 new tests (retry, enrichment incl. pre-fix-failing observability test, pagination, stale discard, sync reset, HTML stripping)
- `src/screens/conversations-list-screen.tsx` - EmptyState/ErrorCard/ListFooter wired into the status machine
- `src/screens/components/conversation-row.tsx` - wrapped in `observer`
- `src/lib/html-to-text.ts` + test - plain-text extraction, entity decoding, `<script>` case covered
- `src/lib/standalone-dev.ts` + test - pure activation-rule/config resolver
- `src/contexts/grispi-context.tsx` - soft-fail SDK guard, standalone bootstrap, shared `switchTicket` path (no rocket on ticket switch — D-14/D-15)
- `src/components/dev-ticket-switcher.tsx` - dev-only bar (renders null outside standalone mode)
- `src/app.tsx` - mounts DevTicketSwitcher

## Decisions Made

- Raw ticket key is banned as alıcı: resolution chain is comment-creator match → `/users/{id}.primaryEmail` (background, cached per user id, silent-fail) → "—" placeholder. Reverses Plan 02's "no new endpoint" boundary per the explicit Plan 03 orchestrator directive (live-verified endpoint).
- Ticket switching no longer flips the global `loading` (rocket is bundle-init only, D-14): a provisional `{key}` ticket is set synchronously so `store.load` clears the list instantly (D-15), then full details hydrate in the background with a latest-key guard.
- Silent store-side upgrades must be immutable (new row objects + new array): deep in-place mutation is invisible to non-observer row components. `ConversationRow` is now an `observer` as a second line of defense.
- Standalone dev mode is a permanent dev affordance, not throwaway: activation is impossible in production builds (NODE_ENV gate) and without the git-ignored env token.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Recipient fell back to the raw ticket key on agent-only rows (orchestrator-flagged gap)**
- **Found during:** Task 1 (carried over from Wave 2 QA; 6/13 live rows affected)
- **Issue:** `resolveRecipientEmail` returned `summary.key` ("TICKET-569") when no comment creator matched the requester — the common case for fresh side conversations, violating LIST-01.
- **Fix:** New `Users` client (`GET /public/v1/users/{id}`, live-verified), background enrichment with per-id promise cache, neutral "—" as strict last resort.
- **Files modified:** store, `users.ts`, `api.ts`, `grispi.type.ts`
- **Verification:** 2 unit tests + UAT step 1 live (uretici-firma@/destek-hatti@/servis-merkezi@ resolved)
- **Committed in:** `017e768` (+ observability fix in `61dd905`)

**2. [Rule 3 - Blocking] App hard-crashed outside the Grispi iframe — UAT was unrunnable**
- **Found during:** Task 3 checkpoint (user report: TypeError at `grispi-context.tsx:21`)
- **Issue:** Unguarded module-scope `window.GrispiClient.instance()`; no way to run the panel against the real API outside the iframe.
- **Fix:** Soft-fail SDK guard; standalone dev mode (NODE_ENV=development + `REACT_APP_DEV_TOKEN` from git-ignored `.env.development.local`); dev ticket switcher driving the shared `switchTicket` path; CORS pre-verified live (localhost:3000 allowed → no proxy). Plugin mode unchanged otherwise.
- **Files modified:** `grispi-context.tsx`, `standalone-dev.ts` (+test), `dev-ticket-switcher.tsx`, `app.tsx`
- **Verification:** 5 unit tests (activation rule/precedence), dev server compile + HTTP 200, live UAT ran on it
- **Committed in:** `24df290`

**3. [Rule 1 - Bug] UAT feedback: raw HTML tags in summaries + enrichment not visible in the browser**
- **Found during:** Task 3 checkpoint (user screenshot)
- **Issue:** (a) Comment bodies are HTML — `<p>` tags rendered as literal text in özet; (b) the `/users/{id}` enrichment mutated `row.recipientEmail` in place, invisible to the non-observer `ConversationRow` (request succeeded — CORS/token verified — the UPDATE was unobservable).
- **Fix:** (a) `htmlToText` applied in `toRow` pre-truncation (text extraction only; T-01 XSS guarantee intact, `<script>` test included); (b) immutable row/array replacement in `runInAction` (hydration retry made consistent too) + `ConversationRow` wrapped in `observer`; new store test fails on the pre-fix behavior.
- **Files modified:** `html-to-text.ts` (+test), store (+test), `conversation-row.tsx`
- **Verification:** 45/45 tests green; UAT re-check approved
- **Committed in:** `61dd905`

---

**Total deviations:** 3 (2 bugs, 1 blocking enabler). No architectural changes beyond the explicitly-directed `/users/{id}` addition; no new packages.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-endpoint | src/grispi/client/users.ts | `GET /public/v1/users/{id}` added (not in Plan 03's threat model) — read-only, id URL-encoded, response never rendered as HTML; returns user PII (email) already shown to agents in Grispi itself |
| threat_flag: dev-credential-path | src/lib/standalone-dev.ts | Token read from `REACT_APP_DEV_TOKEN` (`.env.development.local`, verified git-ignored + `git check-ignore`); activation impossible in production builds (NODE_ENV gate) |

## Issues Encountered

- **Stale webpack watcher during UAT:** the long-running dev server had not picked up commits `24df290`/`61dd905`, making the fixes appear absent in-browser; the orchestrator killed and restarted the server, after which everything rendered correctly. No code change — operational note: restart `npm start` after pulling executor commits.
- **Dataset note:** TICKET-574 displays its tenant-side mangled requester email literally — expected edge-case fixture behavior, not a defect.

## User Setup Required

For local standalone UAT only: `.env.development.local` with `REACT_APP_DEV_TOKEN` (+ optional `REACT_APP_DEV_TENANT_ID`/`REACT_APP_DEV_TICKET_KEY`) — already created from `.token` on this machine, never committed. Plugin-mode deployment needs nothing new.

## Next Phase Readiness

- All five ROADMAP Phase-1 success criteria verified live (UAT approved) — the read-only list is complete: rows, badges, grouping/rail, empty/error/pagination states, stale-free ticket switch.
- Phase 2 (compose) inherits: the disabled CTA to enable (zero layout shift, D-13), the `Users` client, the confirmed `ts.requester` write format (`:email` — probe findings #3), and standalone dev mode for fast local iteration.
- Known intentional stub: the "+" CTA is disabled by design until Phase 2 (D-13) — not a gap.

---
*Phase: 01-temel-ve-salt-okunur-g-r-me-listesi*
*Completed: 2026-07-23*

## Self-Check: PASSED

All 9 created files confirmed present on disk; all 4 task/deviation commit hashes (`017e768`, `658ec6c`, `24df290`, `61dd905`) confirmed in `git log`.
