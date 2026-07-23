---
phase: 02-yeni-yan-g-r-me-ba-latma
plan: 06
subsystem: ui
tags: [react, mobx, radix, tailwind, xss-mitigation, uat]

requires:
  - phase: 02-yeni-yan-g-r-me-ba-latma (Plan 02-02..02-05)
    provides: PanelNavigationStore (requestBack/handleParentTicketChanged), ComposeStore (isDirty/submit/reset), ActiveConversationStore (startNew/optimistic MessageVM lifecycle), MessageBubble/ChatScreen happy path
provides:
  - Shared ConfirmDialog component (single component, two copy variants) wired to D-02 dirty-back and D-03 parent-change guards
  - MessageBubble failed-copy network/server distinction (D-15)
  - Phase-end live UAT against gsocial-test (TICKET-563) confirming all 5 Phase 2 success criteria + D-02/D-03/D-15
  - Three UAT-discovered bugs fixed and re-verified live: ActiveConversationStore.startNew state bleed (M-4), ComposeStore stale state on reopen (M-2/M-3a), compose parent-pinning for D-03 "Kalsın" (M-3b, T-02-01)
affects: [03]

tech-stack:
  added: []
  patterns:
    - "Single ConfirmDialog component reused for two distinct confirmation copy sets (D-02/D-03) via props, not two components"
    - "Compose session parent-pinning: ComposeStore pins its target parent ticket key at open (initSubject) so a dirty draft cannot silently rebind to a different active ticket if the host's active-ticket changes underneath it"
    - "Fresh-open reset seam: openCompose() is the single point that resets ComposeStore, guaranteeing every '+' / empty-state compose open starts pristine regardless of how the previous compose session ended"

key-files:
  created:
    - src/screens/components/confirm-dialog.tsx
  modified:
    - src/screens/compose-screen.tsx
    - src/app.tsx
    - src/store/compose-store.ts
    - src/screens/components/message-bubble.tsx
    - src/store/active-conversation-store.ts
    - src/store/panel-navigation-store.ts

key-decisions:
  - "ConfirmDialog is one component with title/body/confirmLabel/cancelLabel/onConfirm/onCancel props, used for both D-02 (Vazgeçilsin mi?) and D-03 (Taslağın kaybolacak) — CONTEXT.md's explicit single-component rule"
  - "ComposeStore.reset() made public (was private) so ComposeScreen's D-02 confirm handler can discard the draft directly"
  - "Fresh-open reset moved to PanelNavigationStore.openCompose() (the only entry point for '+' and empty-state CTA) rather than every back-navigation path, so an in-progress D-03 'Kalsın' session is never disturbed but every genuinely fresh compose open is pristine"
  - "Compose session pins its parent ticket key at open (same one-shot guard pattern as subject prefill); submit() prefers the pinned key over the live parentKey argument, and reset() clears the pin — prevents a dirty draft from silently rebinding to a different ticket when the host's active ticket changes while D-03's dialog is dismissed with 'Kalsın' (T-02-01 mitigation)"

patterns-established:
  - "UAT-discovered defects during a phase-end checkpoint are fixed in the same plan as fix(02-06) commits with regression unit tests, then re-verified live before the checkpoint is considered passed — not deferred to a separate gap-closure plan when the fix is small and the live session is still open"

requirements-completed: [COMP-04, SYNC-02]

coverage:
  - id: D1
    description: "ConfirmDialog (single component) wired to D-02 dirty-back guard and D-03 parent-change guard with distinct copy; empty-form/empty-draft cases skip the dialog"
    requirement: "COMP-04"
    verification:
      - kind: unit
        ref: "grep -c 'Vazgeçilsin mi' src/screens/compose-screen.tsx >= 1; grep -c 'Taslağın kaybolacak' src/app.tsx >= 1"
        status: pass
      - kind: e2e
        ref: "Live UAT D-02/D-03, gsocial-test TICKET-563 (see Human UAT Results)"
        status: pass
    human_judgment: false
  - id: D2
    description: "MessageBubble failed-copy branches on message.errorKind: network -> 'Bağlantı sorunu · Gönderilemedi. Tekrar dene', server/undefined -> generic 'Gönderilemedi · Tekrar dene'; retry action and preserved message text unchanged; no raw HttpError detail rendered"
    requirement: "COMP-04"
    verification:
      - kind: unit
        ref: "grep -c 'Bağlantı sorunu' src/screens/components/message-bubble.tsx >= 1; grep -c dangerouslySetInnerHTML src/screens/components/message-bubble.tsx == 0"
        status: pass
      - kind: e2e
        ref: "Live UAT D-15 (network-restricted send -> failed bubble -> retry), gsocial-test"
        status: pass
    human_judgment: false
  - id: D3
    description: "Phase-end live UAT: all 5 Phase 2 success criteria (COMP-01..04, SYNC-02) verified end-to-end against gsocial-test tenant, parent TICKET-563, including a real email delivered via createTicket publicVisible:true and a real SYNC-02 refetch (not an optimistic fake row)"
    requirement: "SYNC-02"
    verification:
      - kind: manual_procedural
        ref: "Live browser UAT session, standalone dev mode, gsocial-test, TICKET-563 — see Human UAT Results section"
        status: pass
    human_judgment: true
    rationale: "Real side-ticket creation, real outbound email delivery, and live list refetch can only be confirmed by a human observing the actual gsocial-test tenant round-trip — this is exactly the checkpoint:human-verify Task 3 was designed for and it was executed live by the orchestrator with Davut driving the browser."
  - id: D4
    description: "Three UAT-discovered bugs (M-2/M-3a stale compose state on reopen, M-4 conversation state bleed across new compose sessions, M-3b D-03 parent-pinning) fixed with regression unit tests and re-verified live"
    verification:
      - kind: unit
        ref: "src/store/__tests__/active-conversation-store.test.ts (M-4), src/store/__tests__/panel-navigation-store.test.ts (M-2/M-3a), src/store/__tests__/compose-store.test.ts (M-3b) — full suite 96/96 green"
        status: pass
      - kind: e2e
        ref: "Live re-verification of each fix in the same UAT session (see UAT Fixes section)"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-07-24
status: complete
---

# Phase 2 Plan 6: ConfirmDialog Guards + Error Copy Polish + Phase-End UAT Summary

**Single-component ConfirmDialog covering both D-02 (dirty-back discard) and D-03 (parent-change) confirmations, MessageBubble's network-vs-server failed-copy split (D-15), and a live phase-end UAT against the gsocial-test tenant that passed all 5 Phase 2 success criteria after three UAT-discovered bugs (conversation state bleed, stale compose reopen, and D-03 parent-pinning) were fixed and re-verified in the same session.**

## Performance

- **Duration:** ~55 min (2 code tasks + live UAT + 3 fix/re-verify cycles)
- **Tasks:** 3 planned (2 auto + 1 checkpoint:human-verify), plus 3 UAT-discovered fix tasks
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments
- `ConfirmDialog` (new, `src/screens/components/confirm-dialog.tsx`): single overlay+card component with `title`/`body`/`confirmLabel`/`cancelLabel`/`onConfirm`/`onCancel` props, reused for both D-02 and D-03 with distinct copy — per CONTEXT.md's explicit "one component, two variants" instruction
- D-02 wired: `ComposeScreen`'s `onBack` now reads real `compose.isDirty`; a dirty form opens "Vazgeçilsin mi? / Yazılanlar kaybolur." (İptal/Vazgeç), an empty form returns to the list immediately with no dialog
- D-03 wired: a new `useEffect` in `app.tsx` bridges `useGrispi().ticket?.key` changes into `panelNavigation.handleParentTicketChanged(compose.isDirty)`; a dirty draft opens "Taslağın kaybolacak" (Kalsın/Vazgeç ve devam et), an empty draft switches silently
- `MessageBubble`'s failed-state copy now branches on `message.errorKind`: `"network"` → "Bağlantı sorunu · Gönderilemedi. Tekrar dene", server/untyped (WR-05 precedent) → generic "Gönderilemedi · Tekrar dene" — matching Faz 1's ErrorCard/CORE-03 language; retry action and preserved message text unchanged; no raw `HttpError.body`/`status` rendered
- Live phase-end UAT executed end-to-end in the browser (standalone dev mode, real gsocial-test token, parent `TICKET-563`) — all 8 UAT items PASS (see Human UAT Results below), including a real side ticket created via `createTicket` with `publicVisible:true` and a real SYNC-02 list refetch
- Three bugs found live during UAT were fixed and re-verified in the same session: `ActiveConversationStore.startNew` conversation-state bleed (M-4), `ComposeStore`/`PanelNavigationStore` stale reopen state (M-2/M-3a), and D-03 "Kalsın" parent-pinning (M-3b, closing threat T-02-01)

## Task Commits

Each task was committed atomically:

1. **Task 1: ConfirmDialog (D-02/D-03 tek bileşen) + dirty-back + parent-change wiring** - `9d348c8` (feat)
2. **Task 2: MessageBubble failed copy — ağ vs sunucu ince ayrımı (D-15)** - `a143e0d` (feat)
3. **Task 3: Faz-sonu UAT — 5 success criteria canlı doğrulama** - checkpoint, executed live in-session (no code commit; see Human UAT Results)
4. **UAT fix M-4: ActiveConversationStore.startNew state reset** - `93b56ff` (fix)
5. **UAT fix M-2/M-3a: ComposeStore reset on every fresh openCompose()** - `b950e3f` (fix)
6. **UAT fix M-3b: compose session parent-pinning (D-03/T-02-01)** - `9c98950` (fix)

_No TDD tasks for the two planned code tasks; the three UAT fixes each added regression unit tests alongside the fix (test-with-fix commits, not a separate RED/GREEN pair)._

## Files Created/Modified
- `src/screens/components/confirm-dialog.tsx` - New: `ConfirmDialog` (overlay + card; single component for D-02 and D-03)
- `src/screens/compose-screen.tsx` - D-02 dirty-back wiring (real `compose.isDirty`, local dialog state); parent-pinning call site for M-3b
- `src/app.tsx` - D-03 `useEffect([ticket?.key])` bridge + local dialog state
- `src/store/compose-store.ts` - `reset()` made public (D-02 handler); M-3b parent-pinning (`initSubject` pins parent key, `submit()` prefers pinned key, `reset()` clears pin)
- `src/screens/components/message-bubble.tsx` - D-15 network/server failed-copy branching on `message.errorKind`
- `src/store/active-conversation-store.ts` - M-4: `startNew` resets `messages`/`ticketKey`/`retryPayloads` instead of appending
- `src/store/panel-navigation-store.ts` - M-2/M-3a: `openCompose()` now calls `compose.reset()` on every fresh open

## Decisions Made
- `ConfirmDialog` is one component with props for both D-02 and D-03 copy variants, not two separate components (CONTEXT.md's explicit rule)
- `ComposeStore.reset()` made public (was private) so `ComposeScreen`'s D-02 confirm handler can discard the draft directly
- **Reset-on-fresh-open decision:** the reset seam lives in `PanelNavigationStore.openCompose()` — the single entry point for both the list "+" button and the empty-state CTA — rather than being scattered across every back-navigation path. This guarantees every genuinely fresh compose open is pristine (no stale recipient-search text, no stale subject from a previous parent) without disturbing an in-progress D-03 "Kalsın" session, which never calls `openCompose()` again.
- **Parent-pinning decision (M-3b, closes T-02-01):** `ComposeStore` pins its target parent ticket key at open time via `initSubject(value, parentKey)` (the same one-shot guard pattern already used for subject prefill). `submit()` prefers this pinned key over the live `parentKey` argument passed at click time, and `reset()` clears the pin. This closes a threat-model gap: previously, dismissing D-03's dialog with "Kalsın" only closed the confirmation UI — the plugin cannot command the host to revert its active-ticket selection — so a dirty draft would silently rebind to whatever ticket was live at Gönder-click time, contradicting T-02-01's "no unconfirmed rebind" mitigation. With pinning, "Kalsın" keeps the draft bound to its original parent regardless of what the host's active ticket does afterward.
- **By-design, not a defect:** COMP-03's prefilled subject appearing as bare `[TICKET-563]` with no title text is expected — the parent `Ticket` object returned by `getTicket` has no `subject` field live (Pitfall #6, confirmed in Phase 1's live probe), and D-09 explicitly tolerates an empty-title prefill. `formatPrefillSubject` degrades gracefully to `[<KEY>]` only, which is exactly what was observed.

## Human UAT Results

Executed live in the browser by the orchestrator, driven interactively by Davut, in standalone dev mode against the real gsocial-test tenant (real token + `REACT_APP_DEV_AGENT_EMAIL`), parent ticket `TICKET-563`. All 8 items PASS:

| # | Item | Result | Notes |
|---|------|--------|-------|
| 1 | COMP-01 — "+"/empty-CTA opens compose; back on empty form returns to list, no dialog | PASS | |
| 2 | COMP-02 — live recipient search (≥3 chars) with name+email; email-only when `fullName` is null; valid-unregistered address shows "…adresini kullan" row; invalid format shows "Geçerli bir e-posta adresi girin." with no row | PASS | |
| 3 | COMP-03 — subject prefills `[TICKET-563]`, editable | PASS | Empty title text is by-design — see "By-design" decision above; parent `Ticket` has no subject field live |
| 4 | COMP-04 — real send: recipient + message → Gönder → optimistic pending bubble → chat screen → bubble resolves to "sent" via real `createTicket` 201 | PASS | Real side ticket created (e.g. recipient `regresyon-test@example.com` under `TICKET-563`) |
| 5 | SYNC-02 — after send, list shows the new conversation with REAL refetched data ("az önce" timestamp, "Yanıt bekleniyor" badge), not an optimistic fake row | PASS | |
| 6 | D-02 — dirty-back shows "Vazgeçilsin mi?" dialog; İptal keeps the draft, Vazgeç discards and returns to list | PASS | |
| 7 | D-03 — parent-change with dirty draft shows "Taslağın kaybolacak" dialog (distinct copy from D-02, single component); empty draft switches silently | PASS | Re-verified after M-3b fix (see below) |
| 8 | D-15 — simulated network failure produces failed bubble with network-error copy "Bağlantı sorunu · Gönderilemedi. Tekrar dene" (distinct from server errors) + retry action | PASS | |

**COMP-04 privacy-contract proof:** a real side ticket was created via `createTicket` with `publicVisible:true`, confirming the outbound email actually reaches the external recipient — the plugin's core privacy/delivery contract, verified live rather than assumed.

## UAT Fixes (M-2/M-3/M-4)

Three bugs were found during the live UAT session, fixed inline, and re-verified live before the checkpoint was considered passed:

**M-4 — `ActiveConversationStore.startNew` conversation-state bleed** (`93b56ff`)
- **Found during:** UAT item 4/7 — opening a second new compose after a first one showed the previous conversation's message bubble bleeding into the new chat screen.
- **Root cause:** `startNew` appended to the `messages` array instead of resetting it, so a new conversation inherited the prior conversation's bubbles (and stale `ticketKey`/`retryPayloads`).
- **Fix:** `startNew` now resets `messages`/`ticketKey`/`retryPayloads` before starting the new conversation.
- **Re-verified live:** compose A → back → compose B → chat B shows ONLY B's message.
- **Regression test:** `src/store/__tests__/active-conversation-store.test.ts`.

**M-2 + M-3a — stale `ComposeStore` state on reopen** (`b950e3f`)
- **Found during:** UAT item 7 (D-03 flow) and general reopen testing.
- **Root cause:** leaving compose via a non-dirty back never called `compose.reset()` (only Vazgeç/submit did), so reopening compose kept the stale recipient-search text/hint (M-2) and a stale prefilled subject from a previous parent (M-3a, since `subjectInitialized` was never cleared).
- **Fix:** `PanelNavigationStore.openCompose()` — the single entry point for the list "+" and empty-state CTA — now calls `compose.reset()` on every fresh open.
- **Re-verified live:** reopened compose is pristine (empty search, subject re-prefilled from the current parent).
- **Regression test:** `src/store/__tests__/panel-navigation-store.test.ts`.

**M-3b — D-03 "Kalsın" silently rebound the draft's parent** (`9c98950`)
- **Found during:** re-testing UAT item 7 after M-2/M-3a — "Kalsın" left the dirty draft silently rebinding to the new parent ticket, violating D-03's onCancel intent and threat T-02-01.
- **Root cause:** dismissing the D-03 dialog only closes the confirmation UI; the plugin cannot command the host to revert `useGrispi().ticket.key`, so the draft's eventual `submit()` used whatever parent key was live at click time.
- **Fix:** parent-pinning — `ComposeStore.initSubject(value, parentKey)` pins the parent at open, `submit()` prefers the pinned key over the live argument, `reset()` clears the pin.
- **Re-verified live:** after "Kalsın", the draft stayed bound to its original parent (subject stayed `[TICKET-563]` while the live host label showed `TICKET-560`); a post-fix regression send confirmed the happy path (COMP-04 + SYNC-02) still worked.
- **Regression test:** `src/store/__tests__/compose-store.test.ts` (proves `submit()` uses the pinned key).

**Verification state after all fixes:** `CI=true npx tsc --noEmit` clean; full Jest suite 96/96 green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `ActiveConversationStore.startNew` appended instead of resetting conversation state**
- **Found during:** Task 3 (live UAT, item COMP-04 re-test with a second compose)
- **Issue:** A new compose session's chat screen showed a bubble from the previous conversation because `startNew` appended to `messages` rather than clearing it.
- **Fix:** `startNew` now resets `messages`, `ticketKey`, and `retryPayloads`.
- **Files modified:** `src/store/active-conversation-store.ts`
- **Verification:** live re-test (compose A → back → compose B shows only B's message) + new unit test; full suite green
- **Committed in:** `93b56ff`

**2. [Rule 1 - Bug] Compose state not reset on fresh reopen (stale recipient search + stale subject)**
- **Found during:** Task 3 (live UAT, D-03 flow retest)
- **Issue:** `PanelNavigationStore.openCompose()` never called `compose.reset()`, so reopening compose after a non-dirty back showed a stale recipient-search hint and a subject prefilled from the previous parent ticket.
- **Fix:** `openCompose()` now calls `compose.reset()` on every fresh open (the single entry point for "+"/empty-state CTA).
- **Files modified:** `src/store/panel-navigation-store.ts`
- **Verification:** live re-test (reopened compose is pristine) + new unit test; full suite green
- **Committed in:** `b950e3f`

**3. [Rule 2 - Missing Critical] D-03 "Kalsın" did not prevent the dirty draft from rebinding to a new parent ticket (T-02-01)**
- **Found during:** Task 3 (live UAT, D-03 retest)
- **Issue:** The threat model's T-02-01 mitigation ("no unconfirmed rebind") was not actually enforced — dismissing the D-03 dialog only closed the UI; the eventual `submit()` used whichever parent ticket key was live at click time, silently rebinding a dirty draft.
- **Fix:** Added parent-pinning to `ComposeStore` — the parent key is pinned at open (`initSubject`), `submit()` prefers the pinned key, `reset()` clears it.
- **Files modified:** `src/store/compose-store.ts`, `src/screens/compose-screen.tsx`
- **Verification:** live re-test (draft stays bound to original parent after "Kalsın") + new unit test proving `submit()` uses the pinned key; full suite green
- **Committed in:** `9c98950`

---

**Total deviations:** 3 auto-fixed (2 bugs found live during UAT, 1 missing critical mitigation closing threat T-02-01)
**Impact on plan:** All three fixes were essential correctness/security fixes surfaced by the live UAT the plan itself mandated; no scope creep — each is scoped to the exact bug found and re-verified live before sign-off.

## Issues Encountered

**Dev-server staleness (not a product defect):** during UAT the long-running CRA dev server twice served a stale incremental-HMR bundle (a private-`reset` compile error, and a `null.trim()` runtime error). Neither reproduced against the committed source (`tsc --noEmit` clean both times) and both cleared after a clean dev-server restart. No code change was needed.

**Out-of-scope, flagged for backlog:** one Phase-1 list row (the "Ödeme mutabakatı (kapalı)" conversation) renders a stray JSON tail `"finans-birimi@example.com"}` as its recipient. This is a Phase-1 list-mapping issue, not Phase-2 code — deliberately not fixed here (out of this plan's scope).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 Phase 2 success criteria (COMP-01..04, SYNC-02) are live-verified against the real gsocial-test tenant; the compose → real side-ticket → real email → optimistic bubble → SYNC-02 refetch happy path is proven end-to-end, not just unit-tested
- D-02/D-03/D-15 protections are live-verified; T-02-01 (parent-rebind tampering) is closed via parent-pinning
- Known non-blocking item carried forward: the Phase-1 list-row JSON-tail rendering bug (see Issues Encountered) — candidate for a future gap-closure or Phase-3 cleanup pass
- Phase 3 (Görüşme Detayı ve Yaşam Döngüsü) is unblocked

---
*Phase: 02-yeni-yan-g-r-me-ba-latma*
*Completed: 2026-07-24*

## Self-Check: PASSED
