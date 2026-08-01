---
phase: 04-dosya-ekleri-ve-inline-g-rseller
plan: 06
subsystem: api
tags: [grispi-rest, v2-tickets, attachments, mobx, deepFreeze, retry-envelope]

# Dependency graph
requires:
  - phase: 04-dosya-ekleri-ve-inline-g-rseller
    provides: "Plan 01's live write-path split finding (public/v1 silently ignores comment.attachmentIds; only /v2/tickets binds) and N1 constraint; Plan 03's AttachmentUploadStore.collectAttachmentIds/hasAttachments/reset; Plan 05's fully wired composer UI on both surfaces (attach button, chip panel, send lock) with no attachmentIds binding yet"
provides:
  - "Ticket write-path split implemented in code: Tickets.replyTicket (new) + POST /v2/tickets for comment-bearing writes; Tickets.patchTicket narrowed to StatusTicketPatchRequest (public/v1, D-15-preserving lifecycle-only)"
  - "ComposeStore.submit and ActiveConversationStore.sendReply both bind collectAttachmentIds output to comment.attachmentIds, omitting the field entirely when empty"
  - "D-18: AttachmentUploadStore.hasAttachments(surface) folded into both surfaces' isDirty computation"
  - "Post-send attachment-bucket cleanup on both surfaces (compose via reset(), reply via explicit clear + session-change reset), preventing cross-surface/cross-session leakage (T-04-21)"
  - "Live-verified end-to-end delivery: create + reply paths bind real attachments through /v2/tickets to a real side ticket, both comments public and addressed to the real recipient (P6a, partial per precision note below)"
affects: [04-07, 04-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Comment-bearing ticket writes (create + reply) go through /v2/tickets via Tickets.replyTicket/existing v2 create path; status-only lifecycle PATCH (solve/reopen) stays on public/v1 via Tickets.patchTicket narrowed to StatusTicketPatchRequest — this split is now load-bearing CODE, not just a documented decision, and must not be 'unified' by later phases"
    - "attachmentIds is spread onto request.comment only when the collected id list is non-empty; an empty list omits the field entirely rather than sending [] (mirrors the existing conditional-spread idiom already used for other optional comment fields)"
    - "Attachment id collection happens in the screen component (ComposeScreen/ChatScreen), computed against the exact final body HTML immediately before the store call that builds the frozen envelope — same D-16 GC-before-envelope timing already established for body sanitization"
    - "The frozen mutation envelope (deepFreeze) is not touched for attachments: an id list bound into request.comment.attachmentIds at envelope-construction time is replayed identically on retry, by design — no new retry-path logic, no attachment comparison added to reconcileCanonical"

key-files:
  created: []
  modified:
    - src/grispi/client/tickets.ts
    - src/grispi/client/__tests__/tickets.test.ts
    - src/query/side-conversation-queries.ts
    - src/query/__tests__/side-conversation-queries.test.tsx
    - src/types/grispi.type.ts
    - src/store/compose-store.ts
    - src/store/__tests__/compose-store.test.ts
    - src/screens/compose-screen.tsx
    - src/screens/__tests__/compose-screen.test.tsx
    - src/screens/__tests__/inbox-surfaces.test.tsx
    - src/store/active-conversation-store.ts
    - src/store/__tests__/active-conversation-store.test.ts
    - src/screens/chat-screen.tsx
    - src/screens/__tests__/chat-screen.test.tsx

key-decisions:
  - "Write-path split (public/v1 for status-only lifecycle, /v2/tickets for every comment-bearing write) is now implemented in code as a phase-level architectural fact, not just Plan 01's documented finding — Tickets.patchTicket's request type was narrowed to StatusTicketPatchRequest so a future caller cannot accidentally route a comment through the lifecycle-only public/v1 path and silently lose it (public/v1 returns 2xx while dropping comment.attachmentIds)"
  - "N1 constraint (one attachment id binds to exactly one comment; reuse returns HTTP 422) means the retry path must NOT recompute or dedupe ids — the already-bound id list captured in the deepFrozen envelope at first-send time is the only list that can ever legally bind to that comment, so getRetryEnvelope/reconcileCanonical were deliberately left untouched"
  - "Both surfaces clear their own attachment bucket only AFTER a successful send (reading the frozen envelope's own captured ids, not the live bucket) so a subsequent retry of the same envelope still replays its original ids even if the bucket has since been cleared or a new file added"
  - "P6a live verification is recorded as proven at the API level (real /v2/tickets binding, publicVisible:true comments addressed to the real recipient) but NOT independently re-verified by inspecting the recipient's mailbox in this session — approved to proceed on that basis; true mail-client rendering (P6b, inline images) is deferred to Plan 04-08's phase-end UAT"

patterns-established:
  - "Pattern: conditional attachmentIds spread — `...(attachmentIds.length > 0 ? { attachmentIds } : {})` — applied identically on both the create (ComposeStore.submit) and reply (ActiveConversationStore.sendReply) request bodies"
  - "Pattern: screen-level id collection immediately before store mutation call, mirroring the existing body-sanitization-before-envelope timing (D-16 garbage collection runs on the pre-send HTML, at the caller, before the frozen envelope is constructed)"

requirements-completed: []  # COMP-05/THRD-05 remain multi-plan requirements. This plan lands the send-binding half (attachmentIds reach comment.attachmentIds on both surfaces, live-verified) but Plan 08's inline-image slice and the phase-end UAT are still outstanding before either requirement's full text is satisfied end to end. REQUIREMENTS.md progress notes updated, checkboxes left unchecked, per 04-01/04-02/04-05's established precedent.

coverage:
  - id: 04-06-write-path-split
    description: "Comment-bearing ticket writes (create, reply) route through /v2/tickets; status-only lifecycle PATCH (solve/reopen) stays on public/v1 (Tickets.patchTicket narrowed to StatusTicketPatchRequest, D-15 preserved)"
    requirement: "COMP-05"
    verification:
      - kind: unit
        ref: "src/grispi/client/__tests__/tickets.test.ts"
        status: pass
      - kind: unit
        ref: "src/query/__tests__/side-conversation-queries.test.tsx"
        status: pass
    human_judgment: false
  - id: 04-06-compose-bind
    description: "ComposeStore.submit binds collectAttachmentIds output to comment.attachmentIds (omitted when empty), D-18 folds hasAttachments into isDirty, reset() clears the compose attachment bucket"
    requirement: "COMP-05"
    verification:
      - kind: unit
        ref: "src/store/__tests__/compose-store.test.ts"
        status: pass
      - kind: unit
        ref: "CI=true npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: 04-06-reply-bind
    description: "ActiveConversationStore.sendReply binds collectAttachmentIds output to comment.attachmentIds via ReplyParams.attachmentIds, frozen envelope replays identical ids on retry, reconcileCanonical unaffected, reply bucket cleared post-send and on session change"
    requirement: "THRD-05"
    verification:
      - kind: unit
        ref: "src/store/__tests__/active-conversation-store.test.ts"
        status: pass
      - kind: unit
        ref: "CI=true npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: 04-06-p6a-live-delivery
    description: "Live end-to-end delivery: two attachments bound on create, one on reply, one removed-before-send attachment absent from the ticket, all verified by direct API re-fetch of the created side ticket in the gsocial-test tenant"
    verification: []
    human_judgment: true
    rationale: "Live tenant delivery cannot be automated or re-run by the executor; human drove the browser session and the API re-fetch evidence was supplied directly. Full mailbox inspection (recipient's mail client showing downloadable attachments) was not independently re-verified in this session — approved to proceed on API-level proof; deferred to Plan 04-08's phase-end UAT for final confirmation alongside P6b."

# Metrics
duration: ~40min
completed: 2026-08-01
status: complete
---

# Phase 04 Plan 06: Send-Path Attachment Binding + Live Delivery Summary

**`attachmentIds` now reach `comment.attachmentIds` on both the compose and reply request paths via a code-level `/v2/tickets` vs `public/v1` write-path split; live API re-fetch of a real `gsocial-test` side ticket confirms both create and reply attachments bind correctly and a removed attachment is correctly absent.**

## Performance

- **Duration:** ~40 min (Tasks 1-2 automated; Task 3 checkpoint resolved via live browser session)
- **Tasks:** 3/3 complete
- **Files modified:** 14

## Accomplishments

- Implemented the write-path split Plan 01 discovered live: `Tickets.patchTicket` is narrowed to `StatusTicketPatchRequest` (public/v1, lifecycle-only, D-15-preserving — no comment, no email on solve/reopen), and a new `Tickets.replyTicket` carries reply traffic to `PATCH /v2/tickets/{key}` with `comment.channel: "WEB"`. This split is now enforced by the type system, not just documentation.
- `ComposeStore.submit` gained a final `attachmentIds` parameter (default `[]`); `request.comment.attachmentIds` is spread only when the list is non-empty. The existing recipient+message guard (D-03) is untouched — attachments never make a text-less send valid.
- `isDirty` now also asks `AttachmentUploadStore.hasAttachments("compose")` (D-18); `reset()` clears the compose attachment bucket so a fresh "+" session never inherits a previous session's chips.
- `ReplyParams` gained an optional `attachmentIds` field, folded into `sendReply`'s frozen `request.comment.attachmentIds` the same conditional way. `deepFreeze`, `envelopeBody`, `envelopeCreator`, `mutationStarted/Failed/Accepted`, `getRetryEnvelope`, and `reconcileCanonical` were deliberately left untouched — Integration Pitfall #4 (RESEARCH.md) confirmed no retry-path or reconciliation logic is needed, since an id list bound at envelope-construction time is correctly replayed as-is on retry.
- `ComposeScreen`/`ChatScreen` both compute the id list via `AttachmentUploadStore.collectAttachmentIds(surface, finalBodyHtml)` immediately before the submit/sendReply call (same D-16 GC-before-envelope timing as body sanitization), and clear their own surface's attachment bucket only after a successful send. `ChatScreen`'s session-change effect also resets the reply bucket so switching side conversations never carries over stale chips (T-04-21).
- Live end-to-end verification (P6a) in the `gsocial-test` tenant: two files attached and sent on create, a third file attached then removed via its chip before send (D-17), and one file attached on a reply. Full detail in the dedicated section below.

## Task Commits

Each task was committed atomically:

1. **Task 0 (prerequisite, discovered ahead of Task 1): write-path split** — `f58d4ac` (feat) — `Tickets.patchTicket` narrowed to `StatusTicketPatchRequest`; new `Tickets.replyTicket` added targeting `/v2/tickets`
2. **Task 1: Compose path — attachmentIds, D-18, session cleanup** — `485c7cd` (feat)
3. **Task 2: Reply path — ReplyParams.attachmentIds, frozen-envelope retry, post-send cleanup** — `bb24004` (feat)
4. **Task 3: Live e-mail delivery checkpoint (P6a)** — checkpoint, human-run against `gsocial-test`; no code commit (findings recorded below; this SUMMARY is the artifact)

**Plan metadata:** commit created at the end of this SUMMARY/state-update step (see git log for the following `docs(04-06): ...` commit).

## Files Created/Modified

- `src/grispi/client/tickets.ts` — `patchTicket` narrowed to `StatusTicketPatchRequest`; new `replyTicket` method targeting `PATCH /v2/tickets/{key}` with `comment.channel: "WEB"`
- `src/grispi/client/__tests__/tickets.test.ts` — coverage for the narrowed `patchTicket` type and the new `replyTicket` method
- `src/query/side-conversation-queries.ts` / `__tests__/side-conversation-queries.test.tsx` — query layer updated to call `replyTicket` instead of the old `patchTicket`-based reply path
- `src/types/grispi.type.ts` — `StatusTicketPatchRequest`, `ReplyTicketPatchRequest`/comment shapes formalized to reflect the split
- `src/store/compose-store.ts` — `submit`'s new `attachmentIds` parameter, conditional spread onto `request.comment`, `isDirty`'s new D-18 clause, `reset()`'s bucket cleanup, extended doc-comment on why the id list is caller-computed
- `src/store/__tests__/compose-store.test.ts` — six new tests covering id binding, empty-list field omission, D-03 guard preserved, D-18 `isDirty`, and `reset()` cleanup
- `src/screens/compose-screen.tsx` — `collectAttachmentIds` call before `submit()`, post-success bucket clear
- `src/screens/__tests__/compose-screen.test.tsx`, `src/screens/__tests__/inbox-surfaces.test.tsx` — updated for the new submit signature/store shape
- `src/store/active-conversation-store.ts` — `ReplyParams.attachmentIds?: number[]`, conditional spread in `sendReply`, doc-comment explaining why the retry path is untouched
- `src/store/__tests__/active-conversation-store.test.ts` — six new tests covering id binding, empty-list omission, frozen-envelope deep-freeze coverage, identical-ids-on-retry, `reconcileCanonical` unaffected, D-03 guard preserved
- `src/screens/chat-screen.tsx` — `collectAttachmentIds` call before `sendReply()`, post-success bucket clear, session-change bucket reset
- `src/screens/__tests__/chat-screen.test.tsx` — updated/extended for the new `sendReply` params and bucket-clear behavior

## Decisions Made

See `key-decisions` in frontmatter — repeated here for readability:

- The `/v2/tickets` vs `public/v1` write-path split is now a phase-level architectural fact enforced by the type system (`Tickets.patchTicket` narrowed to `StatusTicketPatchRequest`), not merely a documented decision from Plan 01. Later phases must not attempt to "unify" these two paths — `public/v1` silently ignores `comment.attachmentIds` (Plan 01 probe A2) and `/v2` PATCH 500s on a `fields`-only body (Plan 01 probe N2), so collapsing them would either break attachment binding or violate Phase 3's locked D-15 (solve/reopen must produce no comment and send no email).
- N1 (an attachment id binds to exactly one comment; reuse returns HTTP 422) is the reason the retry path was deliberately left untouched: the id list is captured once, at envelope-construction time, inside the `deepFreeze`d mutation envelope. A retry that recomputed or deduped the id list against the live (possibly-since-cleared) attachment bucket would either resend nothing or attempt to rebind an id already consumed by the failed attempt's own request — both wrong. Replaying the identical frozen payload is the only correct retry behavior, and it is also what the existing `getRetryEnvelope` already does for every other field with zero new code required.
- Both surfaces clear their attachment bucket only *after* a successful send, and only their own surface's bucket — this is what makes T-04-21 (bucket leakage across surfaces or sessions) untestable-to-happen rather than merely untested.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Write-path split implemented ahead of Task 1 as a prerequisite**

- **Found during:** Start of Task 1, before writing any compose-store test
- **Issue:** Plan 01's probe (A2/N2) proved `public/v1` silently ignores `comment.attachmentIds` and `/v2` PATCH requires a `comment` body. The plan's own `<objective>` explicitly calls this out as a Purpose note: without the split landing first, Task 1/2's attachmentIds wiring would compile and pass every mocked unit test while silently failing to deliver any attachment in production, because the mocked HTTP client in the existing tests never distinguished `public/v1` from `/v2`.
- **Fix:** Narrowed `Tickets.patchTicket` to `StatusTicketPatchRequest` (public/v1, lifecycle-only) and added `Tickets.replyTicket` targeting `/v2/tickets` before starting Task 1's attachmentIds work, exactly as flagged.
- **Verification:** `src/grispi/client/__tests__/tickets.test.ts` and `src/query/__tests__/side-conversation-queries.test.tsx` pass; full suite green; `tsc --noEmit` clean.
- **Files modified:** `src/grispi/client/tickets.ts`, `src/grispi/client/__tests__/tickets.test.ts`, `src/query/side-conversation-queries.ts`, `src/query/__tests__/side-conversation-queries.test.tsx`, `src/types/grispi.type.ts`.
- **Commit:** `f58d4ac`

---

**Total deviations:** 1 auto-fixed (Rule 3).
**Impact on plan:** Necessary prerequisite explicitly anticipated by the plan's own Purpose text — not scope creep. No other deviations; Tasks 1 and 2 otherwise followed the plan's action items as written.

## Issues Encountered

None blocking beyond the prerequisite noted above.

## P6a — Canlı E-posta Teslimi

Live verification was driven in the browser against the real `gsocial-test` tenant at 372×812 in standalone dev mode (`.env.development.local` token).

**Panel-side, observed directly:**

1. **Attach + upload:** The "Dosya ekle" attach button in the composer toolbar opened a real `input[type=file]`; two files were selected and uploaded. Two chips rendered in the panel's attachment slot above the toolbar (D-01), with middle-truncated names and formatted sizes: `faz4-te…notu.txt · 34 B`, `faz4-ek…tusu.png · 70 B`. The PNG showed a thumbnail, the txt a file icon (D-19/D-10 treatment).
2. **Send-lock (D-06/D-03):** Gönder was disabled while uploads were in flight and became enabled once uploads finished AND message text was present; with text empty it stayed disabled regardless of attachment state.
3. **Send:** Text was written and Gönder was pressed; the panel navigated to the chat screen with no error, and the sent message showed its attachment in the thread.
4. **Reply with attachment:** A reply with one further attachment (`yanit-eki.txt`) was sent from the same conversation (THRD-05's second surface, shared composer).
5. **Removal before send (D-17):** A third file (`KALDIRILACAK.txt`) was attached, then removed via its chip; only the two original chips remained visible in the panel afterward.
6. **Türkçe karakter:** filename handling for the attached files (including the ekran-goruntusu/ekli naming shown above) rendered and uploaded without corruption in the panel; no separate Turkish-character-specific filename test was run in this session beyond what's shown in the filenames above.

**Server-side, confirmed by direct API re-fetch of the created side ticket `TICKET-591`:**

```
comment[0]  publicVisible=true  to=davutkmbr@gmail.com
            attachments=[faz4-ekran-goruntusu.png(id=639), faz4-test-notu.txt(id=640)]
            body="Merhaba, Faz 4 ek testi. Ekte iki dosya var. (TEST)"
comment[1]  publicVisible=true  to=davutkmbr@gmail.com
            attachments=[yanit-eki.txt(id=644)]
            body="Yanit testi: ekli dosya gonderiyorum. (TEST)"
```

Both comments are `publicVisible: true`, addressed to the real recipient mailbox, with their attachments correctly bound via `/v2/tickets` — the same mechanism Phase 2 already proved live delivers email (`02-01-SUMMARY.md` A1/A5). The removed `KALDIRILACAK.txt` is absent from both comments, confirming D-17's observable consequence: a chip removed before send never binds to the outgoing comment, even though the underlying uploaded file may still exist server-side (accepted cost, D-05/D-17, unchanged from Plan 01).

**Precision note — what is and is not proven:** What is proven, by direct API re-fetch, is that the create and reply paths bind attachments correctly through `/v2/tickets`, that both comments are `publicVisible: true` and addressed to the real recipient mailbox, and that the removed attachment is correctly absent. The final link — the recipient's actual mail client showing the two files as downloadable e-mail attachments — was **not independently re-verified by inspecting the mailbox in this session**. The user reviewed this API-level evidence and approved proceeding on that basis. P6b (inline image rendering in a real mail client) remains explicitly scheduled for Plan 04-08's phase-end UAT, and full mailbox inspection of these attachments can be folded into that same session if desired.

**Resume-signal recorded:** Approved to proceed (API-level evidence reviewed and accepted in lieu of a separate mailbox inspection in this session).

## Known Stubs

None. Every code path shipped in this plan (write-path split, both surfaces' attachmentIds binding, D-18 dirty-draft, post-send bucket cleanup) is fully wired to real store/API methods — no mock or placeholder data source.

## Threat Flags

None beyond what `04-06-PLAN.md`'s own `<threat_model>` already covers. Both `high`-severity threats (T-04-21 bucket leakage, T-04-22 removed-attachment leakage) are satisfied as designed: T-04-21 by the per-surface bucket independence (Plan 03) plus this plan's post-send/session-change cleanup, unit-tested; T-04-22 by `collectAttachmentIds` only ever reading currently-listed, completed chips, live-confirmed in Task 3 step 6 above. T-04-23 (accepted, no idempotency key) and T-04-24 (mitigated, conditional spread, tested on both surfaces) are unchanged from the plan's disposition. T-04-25 (accepted, orphaned server-side uploads) is unchanged.

## User Setup Required

None further. The `REACT_APP_DEV_TOKEN` env var used for Task 3's live delivery was already present from earlier phase setup.

## Next Phase Readiness

- Plan 07 (security hardening / sanitization pass ahead of inline images) can build on a fully working, live-verified send path for both plain attachments and comment delivery.
- Plan 08 (inline paste/drop, phase-end UAT, P6b) is the only remaining piece before COMP-05/COMP-08/THRD-05 are all fully satisfied — it will call `AttachmentUploadStore.collectAttachmentIds` for the inline bucket the same way this plan calls it for the plain-attachment bucket, and its phase-end UAT can fold in a genuine mailbox inspection of the files bound in this plan's Task 3 session if a fresh live check is preferred over relying on the API-level proof recorded here.
- No blockers identified for downstream plans.

## Self-Check: PASSED

- `src/grispi/client/tickets.ts` — FOUND, contains `replyTicket`, `StatusTicketPatchRequest`
- `src/store/compose-store.ts` — FOUND, contains `attachmentIds`
- `src/store/active-conversation-store.ts` — FOUND, contains `attachmentIds`
- Commit `f58d4ac` — FOUND in `git log --oneline --all`
- Commit `485c7cd` — FOUND in `git log --oneline --all`
- Commit `bb24004` — FOUND in `git log --oneline --all`
- Full test suite: 28 suites / 294 tests passing
- `tsc --noEmit`: clean
- `npm run build`: succeeds

---
*Phase: 04-dosya-ekleri-ve-inline-g-rseller*
*Completed: 2026-08-01*
