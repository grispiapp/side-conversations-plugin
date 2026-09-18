---
phase: quick-260918-fx7
plan: 01
subsystem: ui
tags: [react, mobx, tanstack-query, grispi-api, email-ccs]

requires:
  - phase: quick-260902-dhy
    provides: "ts.brand hardcode + omit-when-empty fields precedent in ComposeStore/CreateTicketRequest, reused verbatim for ts.email_ccs"
provides:
  - "src/lib/email-ccs.ts pure wire-format module (parse/serialize/dedupe for ts.email_ccs)"
  - "CcField shared CC row component (compose + reply surfaces)"
  - "ComposeStore CC draft + omit-when-empty POST fields wiring"
  - "ActiveConversationStore session-scoped CC draft + REPLACE-semantics PATCH wiring"
  - "SideConversationDetail.ccEntries + id-preserving email resolution"
affects: [side-conversation-plugin-cc-followups]

actuals:
  tokens: 8600
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Prop-driven shared field component (CcField) reused across compose/reply surfaces, mirroring RecipientField's autocomplete/a11y wiring without forking it"
    - "Session-scoped draft-or-canonical read pattern (ccDraft null vs [] vs populated) for REPLACE-semantics fields, parallel to draftHtml's own session reset"

key-files:
  created:
    - src/lib/email-ccs.ts
    - src/lib/__tests__/email-ccs.test.ts
    - src/screens/components/cc-field.tsx
  modified:
    - src/lib/side-conversation.ts
    - src/store/compose-store.ts
    - src/screens/compose-screen.tsx
    - src/types/grispi.type.ts
    - src/store/active-conversation-store.ts
    - src/query/side-conversation-queries.ts
    - src/screens/components/rich-text-composer.tsx
    - src/screens/chat-screen.tsx
    - src/screens/__tests__/compose-screen.test.tsx
    - src/screens/__tests__/chat-screen.test.tsx
    - src/screens/__tests__/inbox-surfaces.test.tsx

key-decisions:
  - "ccDraft uses three-state semantics (null=untouched, []=serializes to \"\" i.e. clear-all, populated=full set) rather than a boolean touched flag, so the D-CC-3 REPLACE-semantics distinction between 'omit key' and 'send empty value' falls directly out of the type"
  - "CcField is prop-driven and reads useGrispi() only for tenantId, exactly like RecipientField, so it works unmodified in both compose (ComposeStore-backed) and reply (ActiveConversationStore-backed) surfaces"
  - "resolveDetailCcEmails always preserves the id on resolution failure and only ever fills email in, matching the D-CC-3 round-trip guarantee already established by resolveDetailRecipientFallback/hydrateSummaries"

requirements-completed: [COMP-02, THRD-05]

coverage:
  - id: D1
    description: "New side conversation: CC recipient addable/removable; selected CC serializes into POST /v2/tickets fields as a single ts.email_ccs null:<email>:null entry; omitted entirely when no CC selected"
    requirement: COMP-02
    verification:
      - kind: unit
        ref: "src/store/__tests__/compose-store.test.ts"
        status: pass
      - kind: unit
        ref: "src/lib/__tests__/email-ccs.test.ts"
        status: pass
    human_judgment: true
    rationale: "Live wire-format correctness (server accepting the POST body, address landing on the actual outgoing email's CC line) was verified against the API-CONTRACT.md document, not a live probe this session — needs human/UAT confirmation against a real tenant."
  - id: D2
    description: "Reply flow: CC read from fieldMap ids -> emails (id preserved on resolution failure), untouched CC sends no fields key in PATCH, touched CC sends full REPLACE set, clearing all CCs sends value:\"\", CC draft resets on conversation switch"
    requirement: THRD-05
    verification:
      - kind: unit
        ref: "src/store/__tests__/active-conversation-store.test.ts"
        status: pass
      - kind: unit
        ref: "src/query/__tests__/side-conversation-queries.test.tsx"
        status: pass
      - kind: unit
        ref: "src/screens/__tests__/chat-screen.test.tsx"
        status: pass
    human_judgment: true
    rationale: "Same as D1 — REPLACE-semantics correctness against the live grispi-api server, and the 280px-width no-horizontal-scroll requirement, need human/UAT confirmation; not exercised by this session's unit/component tests."

duration: ~35min
completed: 2026-09-18
status: complete
---

# Quick 260918-fx7: Yeni konuşma ve yanıt akışına CC (`ts.email_ccs`) desteği Summary

**CC recipient support for `ts.email_ccs` on both the create-ticket and reply-PATCH paths, honoring the server's REPLACE semantics (full-set-always, id-preserving round-trip) and read/write format asymmetry documented in the live-verified API contract.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 (Task 3 was verification-only, no new commit needed for code — one test-fixture fix commit)
- **Files modified:** 14 (11 planned `files_modified` + 3 existing test fixtures fixed under the test fence)

## Accomplishments

- `src/lib/email-ccs.ts`: pure module for the `ts.email_ccs` wire format — `parseEmailCcsFieldValue` (never throws, handles bare ids, `id:email:phone` triples, `"null"`/empty parts, dedupe), `serializeEmailCcs` (empty list → `""`, the real "clear all" value), `ccEntryIdentity`/`dedupeCcEntries` (numeric id or case-insensitive email identity)
- `CcField`: shared, prop-driven CC row component used by both the compose screen and the reply composer — mirrors `RecipientField`'s autocomplete/keyboard/a11y behavior (3-char threshold, free-email row, Escape/Arrow/Enter, comma/blur-adds) without forking it; chip row wraps at narrow widths (`flex-wrap`, `min-w-[8rem]` input)
- New-conversation path: `ComposeStore.ccEntries`/`ccQuery` feed `isDirty`, `reset()`, and `submit()`'s omit-when-empty `fields` entry (`{key:"ts.email_ccs", value:"null:<email>:null"}`)
- Reply path: `ActiveConversationStore` owns a session-scoped `ccDraft: CcEntry[] | null` (`null`=untouched→no `fields` key, `[]`=serializes to `""`→clears all CCs, populated=full REPLACE set), reset on `activateSession`; `sendReply` sends `fields` in the same PATCH as the comment, gated `!= null` not truthy
- Read path: `SideConversationDetail.ccEntries` parsed from `fieldMap["ts.email_ccs"].value` (bare id list); `resolveDetailCcEmails` resolves each id via `users.getUser`, always preserving the id on resolution failure so a CC member is never silently dropped on the next write
- `ReplyTicketPatchRequest.fields?` added, narrowed to the literal `ts.email_ccs` key so the type still enforces "no subject/requester/parent-link resend"
- `RichTextComposer` gained an optional `ccSlot` prop (store-independent, same architecture as `attachments`/`onAttachFiles`); wired in `ChatScreen` right after the recipient label row

## Task Commits

1. **Task 1+2: CC wire format + new-conversation and reply-flow wiring** - `fecb159` (feat)
2. **Task 3: full-suite verification, one broken test fixture fixed** - `5a8e23a` (test)

_Task 1 and Task 2 were committed atomically per the executor's constraints (code changes only). Task 3 was full-suite verification; the only fixture it needed to fix (`inbox-surfaces.test.tsx`, which renders `ComposeScreen` for real and needed CC-shaped mock fields) is a test-only change, committed separately as required._

## Files Created/Modified

- `src/lib/email-ccs.ts` - wire-format parse/serialize/dedupe module
- `src/lib/__tests__/email-ccs.test.ts` - 12 unit tests covering all listed cases
- `src/screens/components/cc-field.tsx` - shared CC row component
- `src/lib/side-conversation.ts` - `EMAIL_CCS_FIELD_KEY` constant
- `src/store/compose-store.ts` - `ccEntries`/`ccQuery`, `addCc`/`removeCc`, `isDirty`/`reset`/`submit` integration
- `src/screens/compose-screen.tsx` - `<CcField>` between `<RecipientField>` and `<SubjectField>`
- `src/types/grispi.type.ts` - `ReplyTicketPatchRequest.fields?`
- `src/store/active-conversation-store.ts` - `ccDraft`/`ccQuery`, `ccEntriesFor`/`addCcEntry`/`removeCcEntry`/`ccValue`, `ReplyParams.ccValue`, `sendReply` fields wiring
- `src/query/side-conversation-queries.ts` - `SideConversationDetail.ccEntries`, `resolveDetailCcEmails`, queryFn chain update
- `src/screens/components/rich-text-composer.tsx` - optional `ccSlot` prop
- `src/screens/chat-screen.tsx` - `ccCanonical`, `CcField` wired as `ccSlot`, `submitReply` passes `ccValue`
- `src/screens/__tests__/compose-screen.test.tsx` - `CcField` mock added (test fence fix, Task 1)
- `src/screens/__tests__/chat-screen.test.tsx` - `makeActive()` CC methods + `ccEntries: []` in detail fixture + `CcField` mock (test fence fix, Task 2)
- `src/screens/__tests__/inbox-surfaces.test.tsx` - `compose` mock CC fields added (test fence fix, Task 3 — `CcField` renders for real in this suite)

## Decisions Made

- `ccDraft`'s three-state design (`null`/`[]`/populated) was chosen over a separate boolean "touched" flag so the `!= null` gate in `sendReply` and the `ccValue` getter directly encode D-CC-7's "no key vs empty-value key" distinction without any parallel bookkeeping that could drift out of sync.
- `CcField` deliberately duplicates (not imports/wraps) `RecipientField`'s autocomplete logic per the plan's explicit instruction — `RecipientField` itself was left untouched.
- `resolveDetailCcEmails` was placed immediately after `resolveDetailRecipientFallback` and mirrors its defensive shape (early exit, `Promise.allSettled` + inner `try/catch`, no new cache key/store method), per the plan's explicit precedent-reuse instruction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug / test fence] Fixed three test fixtures broken by the CC shape/behavior change**
- **Found during:** Task 1 verify (`compose-screen.test.tsx`), Task 2 verify (`chat-screen.test.tsx`), Task 3 full-suite verify (`inbox-surfaces.test.tsx`)
- **Issue:** Each fixture mocks `@/query/side-conversation-queries` or a plain `compose`/`activeConversation` object without the new CC-related exports/fields; `CcField` (rendered for real in `compose-screen`/`chat-screen`/`inbox-surfaces` tests, since none of them mock it out of the box except where I added a mock) threw on `useCustomersQuery is not a function` or `query.trim()` on `undefined`.
- **Fix:** Added `CcField` mocks to `compose-screen.test.tsx` and `chat-screen.test.tsx` (matching the existing `RecipientField`/`SubjectField` mock precedent); added the CC mock fields directly to the `compose` fixture in `inbox-surfaces.test.tsx` (that suite renders `CcField` for real, since only `useCustomersQuery` is mocked there); added one `ccValue: null` expectation to an existing `sendReply` call-with assertion in `chat-screen.test.tsx`.
- **Files modified:** `src/screens/__tests__/compose-screen.test.tsx`, `src/screens/__tests__/chat-screen.test.tsx`, `src/screens/__tests__/inbox-surfaces.test.tsx`
- **Verification:** Full suite green (593/593), `tsc --noEmit` exit 0
- **Committed in:** `fecb159` (compose-screen/chat-screen fixtures, part of Task 1/2 feat commit — required by those tasks' own `<verify>` command lists) and `5a8e23a` (inbox-surfaces fixture, Task 3's own test-only commit — only surfaced when running the full suite)

---

**Total deviations:** 1 auto-fixed (test fence, Rule 1 — existing test breakage caused directly by this plan's shape/behavior change, explicitly permitted to fix)
**Impact on plan:** No scope creep — no new screen/store test suite was authored; only `email-ccs.test.ts` is new test code, per the plan's explicit test fence.

## Issues Encountered

None beyond the test fixture fixes documented above.

## Known Stubs

None. Every code path is wired to real data: `CcField` reads live customer search via `useCustomersQuery`, the compose/reply submit paths build real request bodies, and `resolveDetailCcEmails` calls the real `users.getUser` API.

## User Setup Required

None - no external service configuration required. `ts.email_ccs` is a Grispi system field, already provisioned server-side (no plugin settings, no tenant admin action needed).

## Next Phase Readiness

- All three `<truths>` compile-time-verifiable claims (omit-when-empty, `!= null` PATCH gate, id-preserving round-trip) are structurally enforced in code and covered by unit tests.
- Remaining verification is live/UAT-level: does the server actually accept the wire format and does the CC address land in the real outgoing email's CC line (D-CC-contract §5), and does the CC row visually survive a 280px-wide panel with many chips. Both are `human_judgment: true` in the `coverage:` block above — recommend a live smoke test against the gsocial-test tenant before considering this fully closed.
- `422 SUPPORT_ADDRESS_CANNOT_BE_USER_EMAIL` (API-CONTRACT.md §6) is a known server-side edge case for non-EMAIL-channel tickets; this plugin's channel is always `WEB`, so it is silently NOT affected per the contract note, but any future channel change should re-check this.

---
*Quick task: 260918-fx7*
*Completed: 2026-09-18*

## Self-Check: PASSED

All 15 claimed files verified present on disk; both commit hashes (`fecb159`, `5a8e23a`) verified present in `git log`.
