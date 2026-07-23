---
phase: 02-yeni-yan-g-r-me-ba-latma
plan: 04
subsystem: ui
tags: [typescript, mobx, react, grispi-rest, jest, tdd]

# Dependency graph
requires:
  - phase: 02-yeni-yan-g-r-me-ba-latma
    provides: "Plan 01 (createTicket client + probe-confirmed CreateTicketRequest/formatRequesterField), Plan 02 (agentEmail via useGrispi, PanelNavigationStore.openChat), Plan 03 (ComposeStore recipient/subject fields, ComposeScreen shell)"
provides:
  - "ActiveConversationStore: optimistic MessageVM lifecycle (pending→sent/failed), createTicket POST, SYNC-02 refetch on success"
  - "ComposeStore.submit: D-17 reentrancy guard, D-10 required-field guard, confirmed-live CreateTicketRequest construction, isDirty getter"
  - "Textarea UI primitive + MessageField (D-12 Shift+Enter submit, always-visible keyboard hint)"
  - "ComposeScreen renders MessageField below RecipientField/SubjectField"
affects: [02-05, 02-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ActiveConversationStore.startNew/retry are synchronous (void) and fire-and-forget the createTicket POST — callers get the optimistic pending message immediately without blocking on the network round-trip"
    - "ComposeStore.submit yields exactly one microtask (await Promise.resolve()) between firing startNew and navigating to chat — enough to make the D-17 synchronous reentrancy guard meaningful without delaying navigation until the POST settles"
    - "Immutable message-array replacement (same UAT Defect 2 lesson as SideConversationsStore) for every MessageVM status transition"

key-files:
  created:
    - src/store/active-conversation-store.ts
    - src/store/__tests__/active-conversation-store.test.ts
    - src/components/ui/textarea.tsx
    - src/screens/components/message-field.tsx
  modified:
    - src/store/compose-store.ts
    - src/store/__tests__/compose-store.test.ts
    - src/store/root-store.ts
    - src/screens/compose-screen.tsx

key-decisions:
  - "startNew/retry return void (not a Promise callers await to completion) — the network POST runs in the background via a private async sendCreateTicket, so ComposeStore.submit and the eventual chat screen never block on the createTicket round-trip (matches UI-SPEC 'Chat screen anatomy': bubble mounts pending, THEN transitions when the POST settles)"
  - "ComposeStore.submit awaits a single `Promise.resolve()` (not the full startNew/network chain) between constructing the request and navigating to chat — this is what makes D-17's synchronous reentrancy guard exercise a real race window in tests while still keeping navigation-on-submit fast/optimistic"
  - "isDirty tracks a private initialSubject (the value initSubject first set), not empty-string, so an untouched prefilled subject never counts as a dirty edit — only agent-made changes to recipient/message/subject do"
  - "Message ids are a simple incrementing counter (msg-N), not crypto.randomUUID — dependency-free and deterministic for tests; uniqueness is all that's required since ids never leave the client"

patterns-established:
  - "Pattern: store methods that trigger background async work but must not block navigation return void and use `void this.privateAsyncMethod(...)` internally, with runInAction wrapping only the post-await mutations"

requirements-completed: [COMP-04, SYNC-02]

coverage:
  - id: D1
    description: "ActiveConversationStore optimistic message lifecycle: pending→sent (createTicket 201, ticketKey set from response.key, SYNC-02 refetch fires) and pending→failed (network/server errorKind, body preserved, no refetch)"
    requirement: "COMP-04"
    verification:
      - kind: unit
        ref: "src/store/__tests__/active-conversation-store.test.ts#resolves the message to sent, sets ticketKey from the response .key, and refetches the list (SYNC-02)"
        status: pass
      - kind: unit
        ref: "src/store/__tests__/active-conversation-store.test.ts#marks the message failed with body preserved on a network error, and never refetches the list"
        status: pass
    human_judgment: false
  - id: D2
    description: "ActiveConversationStore.retry re-fires the identical POST (D-15) and resolves to sent + refetches; message-array updates are immutable throughout"
    requirement: "COMP-04"
    verification:
      - kind: unit
        ref: "src/store/__tests__/active-conversation-store.test.ts#retry(messageId) re-sends the identical POST and resolves to sent + refetches (D-15)"
        status: pass
      - kind: unit
        ref: "src/store/__tests__/active-conversation-store.test.ts#message list updates are immutable (new array identity on every transition)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ComposeStore.submit: D-17 synchronous reentrancy guard, D-10 required-field guard (empty recipient/message no-ops), and the confirmed-live CreateTicketRequest shape (publicVisible:true, creator=agentEmail, ts.requester via formatRequesterField, tu.side_conversation_parent, ts.subject key always present even when empty)"
    requirement: "COMP-04"
    verification:
      - kind: unit
        ref: "src/store/__tests__/compose-store.test.ts#D-17: a second submit() call before the first await resolves is a no-op"
        status: pass
      - kind: unit
        ref: "src/store/__tests__/compose-store.test.ts#D-10: does not start a send when recipient or message is empty"
        status: pass
      - kind: unit
        ref: "src/store/__tests__/compose-store.test.ts#builds the CreateTicketRequest per the confirmed live shape (A1/A4/A5, Pitfall #1-#3)"
        status: pass
      - kind: unit
        ref: "src/store/__tests__/compose-store.test.ts#ts.subject key is always present even when the subject was left empty (Pitfall #1, D-10 non-blocking)"
        status: pass
    human_judgment: false
  - id: D4
    description: "submit() navigates to chat + resets the form after a successful call; isDirty reflects recipient/message/edited-subject state"
    requirement: "COMP-04"
    verification:
      - kind: unit
        ref: "src/store/__tests__/compose-store.test.ts#navigates to chat and resets the whole form after a successful submit"
        status: pass
      - kind: unit
        ref: "src/store/__tests__/compose-store.test.ts#isDirty (describe block, 4 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Textarea primitive + MessageField: Shift+Enter submits (D-12), plain Enter untouched, keyboard hint always visible, wired into ComposeScreen; CI=true npx tsc --noEmit clean"
    requirement: "COMP-04"
    verification:
      - kind: unit
        ref: "CI=true npx tsc --noEmit"
        status: pass
    human_judgment: true
    rationale: "No React Testing Library render test exercises MessageField's onKeyDown/disabled wiring directly (plan's Task 3 verification was typecheck-only, matching Plan 03's precedent for pure-JSX field components) — visual/keyboard-interaction correctness needs a human click-through in the actual compose screen, deferred to Plan 05/06's UAT alongside the 'Gönder' button and full chat screen."

# Metrics
duration: ~20min
completed: 2026-07-24
status: complete
---

# Phase 02 Plan 04: Yazma Akışının Çekirdeği — Optimistic Gönderim + SYNC-02 Summary

**ComposeStore.submit builds and POSTs the confirmed-live createTicket request through a new ActiveConversationStore that manages an optimistic pending→sent/failed message bubble and triggers a real list refetch (not a fake row) on success — plus the Textarea/MessageField primitives with the D-12 Shift+Enter shortcut.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files modified:** 8 (4 new: `active-conversation-store.ts`, its test file, `textarea.tsx`, `message-field.tsx`)

## Accomplishments

- `ActiveConversationStore` (new): optimistic `MessageVM` lifecycle (`pending → sent | failed`), fires `grispiAPI.tickets.createTicket` in the background, resolves `ticketKey` from the response's top-level `.key` (A1), and refetches the real conversation list (`sideConversations.load(parentKey)`) only after a genuine 2xx — never on an optimistic fake row (SYNC-02/D-16)
- `ComposeStore.submit` (extended): synchronous D-17 reentrancy guard, D-10 required-field guard (recipient + message required, subject may be empty but its `ts.subject` key is never omitted — Pitfall #1), builds the exact confirmed-live `CreateTicketRequest` (`publicVisible: true`, `creator` from `agentEmail`, `ts.requester` via `formatRequesterField`, `tu.side_conversation_parent` from the trusted `parentKey`), hands off to `ActiveConversationStore.startNew`, then navigates to chat and resets the form
- `Textarea` (new) + `MessageField` (new): `input.tsx`'s exact `forwardRef`/`cn()` pattern adapted to multi-line (`min-h-[96px]`); Shift+Enter submits (D-12), plain Enter is untouched (native newline); persistent keyboard hint; wired into `ComposeScreen` below `RecipientField`/`SubjectField`
- `RootStore.activeConversation` wired

## Task Commits

Each task was committed atomically:

1. **Task 1: ActiveConversationStore — optimistic mesaj yaşam döngüsü + createTicket POST + SYNC-02** - `f88ecb3` (feat, TDD)
2. **Task 2: ComposeStore.submit — reentrancy guard + payload kurulumu + handoff** - `cb7edbd` (feat, TDD)
3. **Task 3: Textarea primitifi + MessageField (D-12)** - `1ff02c6` (feat)

## Files Created/Modified

- `src/store/active-conversation-store.ts` (NEW) - `MessageVM`, `ActiveConversationStore` (`startNew`/`retry`/`resolveSent`/`markFailed`/private `sendCreateTicket`)
- `src/store/__tests__/active-conversation-store.test.ts` (NEW) - 6 tests: pending state, sent+SYNC-02, network failure, server failure, retry, immutability
- `src/store/compose-store.ts` - Added `message`/`setMessage`/`submitting`/`isDirty`/`submit`/private `reset`
- `src/store/__tests__/compose-store.test.ts` - Added `isDirty` (4 tests) and `submit` (5 tests) describe blocks
- `src/store/root-store.ts` - Wired `activeConversation: ActiveConversationStore`
- `src/components/ui/textarea.tsx` (NEW) - `Textarea` primitive
- `src/screens/components/message-field.tsx` (NEW) - `MessageField` (Shift+Enter → `compose.submit`)
- `src/screens/compose-screen.tsx` - Renders `<MessageField />`

## Decisions Made

- `startNew`/`retry` on `ActiveConversationStore` are `void`, not awaited-to-completion by `ComposeStore.submit` — the network POST runs in the background so the optimistic bubble appears and chat navigation happens without waiting on the round-trip, matching UI-SPEC's "bubble mounts pending, then transitions when POST settles"
- `ComposeStore.submit` awaits exactly one `Promise.resolve()` (not the full network chain) between firing `startNew` and calling `openChat()` — this single microtask yield is what makes the D-17 synchronous-guard test meaningful (a second call made in the same tick, before that yield, is blocked) without delaying the optimistic UX
- `isDirty` compares the current `subject` against a private `initialSubject` (captured once by `initSubject`), not against `""` — an untouched prefilled subject never counts as a dirty edit, only agent-made recipient/message/subject changes do
- Message ids use a simple incrementing counter (`msg-N`) rather than `crypto.randomUUID` — dependency-free, deterministic for tests, and sufficient since ids never leave the client this phase

## Deviations from Plan

None - plan executed exactly as written. One clarification worth recording: the plan's task text describes `submit` as calling `startNew` "→" `openChat` sequentially, which could be read as "await startNew to completion." Implementing it that way would have made chat navigation wait on the full `createTicket` network round-trip, contradicting `02-UI-SPEC.md`'s explicit "Chat screen anatomy" (bubble mounts `pending` immediately on chat-screen mount, THEN transitions to `sent`/`failed` when the POST settles) and the D-17 test's premise that a synchronous second `submit()` call must be blockable before "the first await" resolves. Reconciled by making `ActiveConversationStore.startNew` synchronous/fire-and-forget and having `submit` await a single `Promise.resolve()` instead of the full chain — satisfies both the D-17 test semantics and the UI-SPEC's optimistic-navigation requirement. Not logged as a Rule 1-4 deviation since no plan text was contradicted, only an ambiguity resolved in the direction the plan's own artifacts (UI-SPEC + behavior tests) point.

## Accepted Risk (per plan's <output> instruction)

**Pitfall #5 — retry double-creation (T-02-08, locked D-15).** The Grispi `createTicket` API has no idempotency key. `ActiveConversationStore.retry(messageId)` re-fires the EXACT SAME POST body on a failed message. If the FIRST attempt actually succeeded server-side but the success response was lost to a network error on the client (a narrow but real race), retrying creates a SECOND side ticket. This is an explicitly accepted risk per D-15 (locked decision) — no idempotency marker exists in the current API surface. A v2 mitigation idea (client-generated idempotency marker in a custom field, deduped server-side or by the list view) is noted here for a future phase; out of scope for Phase 2.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ActiveConversationStore` is the seam Plan 05/06 (chat screen, "Gönder" button, retry UI) hang off of — `messages`/`ticketKey`/`recipientLabel`/`subject` and the `retry(messageId)` method are all ready to render
- `ComposeStore.isDirty` is ready for Plan 05/06's D-02/D-03 dirty-guard confirm dialogs (currently `ComposeScreen` still hardcodes `isDirty = false` pending that wiring)
- `ComposeStore.submit(agentEmail, parentKey)` is ready to be called from both `MessageField`'s Shift+Enter (wired this plan) and Plan 05's "Gönder" button — both get the same D-17 protection for free since the guard lives in the store, not the caller
- No blockers for subsequent plans in this phase

---
*Phase: 02-yeni-yan-g-r-me-ba-latma*
*Completed: 2026-07-24*

## Self-Check: PASSED

All 8 created/modified files verified present on disk; all 3 task commit hashes (`f88ecb3`, `cb7edbd`, `1ff02c6`) verified present in `git log`.
