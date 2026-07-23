---
phase: 02-yeni-yan-g-r-me-ba-latma
plan: 05
subsystem: ui
tags: [react, mobx, cva, radix-icons, xss-mitigation, tailwind]

requires:
  - phase: 02-yeni-yan-g-r-me-ba-latma (Plan 02-04)
    provides: ComposeStore.submit + ActiveConversationStore optimistic MessageVM lifecycle (startNew/retry/resolveSent/markFailed)
provides:
  - MessageBubble component rendering the pending/sent/failed optimistic state machine (D-14/D-15)
  - Real ChatScreen shell (client-echoed header + generic bubble list, replacing Plan 02's stub)
  - Gönder button wired to ComposeStore.submit, completing the compose → chat happy path
affects: [02-06]

tech-stack:
  added: []
  patterns:
    - "cva direction variant (own/incoming) on MessageBubble, modeled on badge.tsx's cva+cn convention — incoming reserved as a Phase 3 seam"
    - "Chat header title reads exclusively from ActiveConversationStore (recipientLabel/subject), never re-fetched from the server (Pitfall #6)"
    - "Bottom action bar pinned via `sticky bottom-0` inside ScreenContent's own scroll container, not the outer Screen"

key-files:
  created:
    - src/screens/components/message-bubble.tsx
  modified:
    - src/screens/chat-screen.tsx
    - src/screens/compose-screen.tsx

key-decisions:
  - "Failed-bubble retry row uses text-red-200 (not text-destructive-foreground, which resolves to near-white and would be indistinguishable from the bubble's own primary-foreground body text on the bg-primary background) to pass the UI-SPEC's AA-against-primary requirement while staying visually distinct from the pending/sent text color"
  - "compose-screen's ScreenHeader onBack keeps isDirty hardcoded false in this plan — wiring the real compose.isDirty here without Plan 06's ConfirmDialog would make requestBack return true with nothing to act on it, silently swallowing a dirty-form back-tap"
  - "Gönder's disabled condition explicitly re-derives the invalid-email-warning state (mirroring RecipientField's local computation, since ComposeStore exposes no getter for it) even though in practice it's implied by !recipientEmail — kept explicit for acceptance-criteria clarity"

patterns-established:
  - "Optimistic chat bubble UI state machine (pending/sent/failed) rendered purely off a MessageVM prop, with retry as a callback prop rather than a store import — keeps MessageBubble presentation-only and reusable for Phase 3's incoming-message variant"

requirements-completed: [COMP-04]

coverage:
  - id: D1
    description: "MessageBubble renders the pending/sent/failed optimistic state machine (bottom-right spinner while pending, spinner gone once sent, preserved message text + Tekrar dene retry action on failure), with message body rendered via React text interpolation only (XSS mitigation)"
    requirement: "COMP-04"
    verification:
      - kind: unit
        ref: "grep -c dangerouslySetInnerHTML src/screens/components/message-bubble.tsx == 0"
        status: pass
      - kind: unit
        ref: "grep -c animate-spin src/screens/components/message-bubble.tsx >= 1"
        status: pass
      - kind: unit
        ref: "grep -c 'Tekrar dene' src/screens/components/message-bubble.tsx >= 1"
        status: pass
    human_judgment: true
    rationale: "Three-state visual rendering (pending/sent/failed) and the AA color-contrast choice for the failed row need a human eyeball against a live/dev-mode chat screen — grep gates only prove markup presence, not visual correctness."
  - id: D2
    description: "ChatScreen is a real minimal shell: header shows recipientLabel · subject (client-echo, no server refetch), ScreenContent renders activeConversation.messages as a generic MessageBubble list, back button returns to the list"
    requirement: "COMP-04"
    verification:
      - kind: unit
        ref: "grep -c getTicket src/screens/chat-screen.tsx == 0"
        status: pass
    human_judgment: true
    rationale: "End-to-end navigation (compose submit -> optimistic bubble appears -> resolves to sent) is a live interaction flow best confirmed via UAT, deferred to Plan 06's checkpoint:human-verify."
  - id: D3
    description: "Compose screen's Gönder button is wired to compose.submit(agentEmail, ticket?.key), full-width primary, pinned as a sticky bottom action bar, disabled when recipient unselected / message empty / submitting / invalid-email warning showing (subject emptiness does not disable)"
    requirement: "COMP-04"
    verification:
      - kind: unit
        ref: "grep -c Gönder src/screens/compose-screen.tsx >= 1"
        status: pass
      - kind: unit
        ref: "CI=true npx tsc --noEmit"
        status: pass
    human_judgment: true
    rationale: "The full happy path (side ticket creation, real email delivery, SYNC-02 refetch) requires a live tenant round-trip — explicitly deferred to Plan 06's end-of-phase UAT checkpoint per the plan's own acceptance criteria."

duration: 15min
completed: 2026-07-23
status: complete
---

# Phase 2 Plan 5: MessageBubble + ChatScreen + Gönder Summary

**Optimistic chat bubble state machine (pending/sent/failed, XSS-safe React text interpolation), real ChatScreen shell reading client-echoed header from ActiveConversationStore, and a Gönder button wiring ComposeStore.submit into a sticky bottom action bar — completing COMP-04's compose-to-chat happy path.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `MessageBubble` renders the D-14/D-15 optimistic state machine: bottom-right `ReloadIcon` spinner while `pending`, spinner disappears on `sent`, message body preserved (never recolored) with a clickable "Gönderilemedi · Tekrar dene" row calling `onRetry(message.id)` on `failed` — message body renders via `{message.body}` text interpolation only (T-02-02 XSS gate: `dangerouslySetInnerHTML` grep == 0)
- `ChatScreen` replaced Plan 02's stub with a real shell: header title is `{recipientLabel} · {subject}` sourced exclusively from `ActiveConversationStore` (no `getTicket` call — Pitfall #6), `ScreenContent` renders `activeConversation.messages` as a generic vertical `MessageBubble` list (Phase 3 seam preserved, not a hardcoded single child)
- `ComposeScreen` gained a full-width primary "Gönder" button pinned as a sticky bottom action bar; `onClick` calls `compose.submit(agentEmail, ticket?.key ?? "")` with trusted `useGrispi()` context values; disabled when no recipient, empty message, `submitting`, or the recipient field's invalid-email warning is showing — subject emptiness does not disable it (D-10)

## Task Commits

Each task was committed atomically:

1. **Task 1: MessageBubble — cva own varyantı + pending/sent/failed durum makinesi (D-14/D-15)** - `1b77bd8` (feat)
2. **Task 2: ChatScreen — gerçek minimal kabuk** - `82f45d7` (feat)
3. **Task 3: ComposeScreen Gönder butonu + submit wiring** - `635cc1d` (feat)

_No TDD tasks this plan — all three are `type="auto"` UI wiring tasks._

## Files Created/Modified
- `src/screens/components/message-bubble.tsx` - New: `bubbleVariants` (cva `direction` own/incoming) + `MessageBubble` (pending/sent/failed render, XSS-safe interpolation, retry callback)
- `src/screens/chat-screen.tsx` - Replaced Plan 02 stub with real header (client-echo) + generic bubble list
- `src/screens/compose-screen.tsx` - Added Gönder button, sticky bottom action bar layout, `sendDisabled` derivation

## Decisions Made
- Failed-bubble retry row color: `text-red-200` chosen over `text-destructive-foreground` (which resolves to near-white on the dark `bg-primary` background, per `src/index.css`'s `--destructive-foreground: 210 40% 98%` — nearly identical to `--primary-foreground`) to keep the failed state visually distinguishable while passing AA contrast, per UI-SPEC's explicit "executor picks whichever passes AA" instruction
- `compose-screen.tsx`'s `isDirty` stays hardcoded `false` in this plan (not wired to `compose.isDirty`) — that wiring is explicitly Plan 06's task, paired with the `ConfirmDialog` component that must exist before `requestBack(true)`'s return value has anywhere to go
- `sendDisabled`'s invalid-email-warning branch is computed locally in `compose-screen.tsx` (mirroring `RecipientField`'s own derivation) rather than adding a new `ComposeStore` getter, since `ComposeStore` doesn't expose that intermediate UI state and the condition is, in practice, already implied by `!compose.recipientEmail`

## Deviations from Plan

**1. [Rule 1 - Bug] Removed the literal string "dangerouslySetInnerHTML" from MessageBubble's doc comment**
- **Found during:** Task 1 verification
- **Issue:** The doc comment explaining the XSS mitigation used the literal prop name `dangerouslySetInnerHTML` as prose, which made the acceptance gate's own grep (`grep -c "dangerouslySetInnerHTML" == 0`) fail against the comment text itself, not real usage
- **Fix:** Reworded the comment to describe "ham-HTML enjeksiyon prop'u" (raw-HTML injection prop) instead of naming the API literally, preserving the WHY without defeating the grep gate
- **Files modified:** src/screens/components/message-bubble.tsx
- **Verification:** `grep -c "dangerouslySetInnerHTML" src/screens/components/message-bubble.tsx` == 0, confirmed after edit
- **Committed in:** 1b77bd8 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — self-defeating grep gate in own doc comment)
**Impact on plan:** Cosmetic fix to documentation wording only; no functional or security change. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The full compose → optimistic bubble → chat happy path (COMP-04) is now visually complete and internally consistent (`tsc` clean, all 92 existing tests still green — no regressions in Plan 04's store test suite)
- Plan 06 is unblocked to add `ConfirmDialog` (D-02/D-03), wire the real `compose.isDirty` into `ScreenHeader onBack`, refine `MessageBubble`'s failed copy with network/server `errorKind` branching, and run the end-of-phase live UAT checkpoint
- No blockers introduced by this plan

---
*Phase: 02-yeni-yan-g-r-me-ba-latma*
*Completed: 2026-07-23*

## Self-Check: PASSED
