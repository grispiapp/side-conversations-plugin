# Phase 3: Görüşme Detayı ve Yaşam Döngüsü - Research

**Researched:** 2026-07-28  
**Domain:** Grispi ticket thread, HTML composer/rendering, MobX lifecycle state  
**Confidence:** MEDIUM — code integration is directly verified; Grispi PATCH payload details require a live probe.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Thread is a chronological email flow, not chat bubbles; quoted history is collapsed, internal notes are read-only, and incoming HTML is sanitized. [CITED: 03-CONTEXT.md D-01..D-06]
- The fixed composer produces lightweight HTML, sends with Shift+Enter, clears immediately, and leaves a failed message retryable in the thread. [CITED: 03-CONTEXT.md D-07..D-12]
- Resolve/reopen are status-only PATCH operations with no comment, no optimistic status flip, and SOLVED disables the composer while keeping the thread open. [CITED: 03-CONTEXT.md D-13..D-17]
- Seen state and “action required” are separate: opening writes local last-seen; the last public author controls `Yeni yanıt` versus `Yanıt bekleniyor`; solved rows suppress both signals. [CITED: 03-CONTEXT.md D-18..D-20]

### the agent's Discretion
- Choose the sanitizer/editor implementation, toolbar details, time format, and minor loading/error presentation consistently with the existing theme and safety rules. [CITED: 03-CONTEXT.md]
- Verify how quoted email context must be represented through the Grispi API. [CITED: 03-CONTEXT.md]

### Deferred Ideas (OUT OF SCOPE)
- Creating internal notes, attachments, tables, inline images, and server-synchronized read state. [CITED: 03-CONTEXT.md]
</user_constraints>

## Summary

Extend `ActiveConversationStore` from a create-only optimistic shell into the owner of load/reply/status lifecycles. Keep list hydration in `SideConversationsStore`; after successful reply or status PATCH, refetch both the active ticket and its parent list rather than synthesizing server state. [VERIFIED: codebase grep]

Add a typed `patchTicket(key, body)` next to `getTicket`. `getTicket` itself needs no URL or transport change; its `Ticket.comments` already contains body, visibility, creator, timestamps, and channel needed by the thread. The `Comment` and `User` interfaces must be exported or mapped inside the store, and PATCH response typing should be `Ticket` only after a live probe confirms it. [VERIFIED: codebase grep]

**Primary recommendation:** implement one dependency-light `contentEditable` composer, sanitize every HTML boundary with a proven allowlist sanitizer, and gate the exact Grispi PATCH bodies behind a focused integration probe before implementation. [ASSUMED]

## Exact API and Type Changes

### `src/grispi/client/tickets.ts`

Add:

```ts
async patchTicket(ticketKey: string, body: PatchTicketRequest) {
  return this.http.send<Ticket>(
    `public/v1/tickets/${encodeURIComponent(ticketKey)}`,
    {
      method: "PATCH",
      cache: "no-cache",
      headers: this.auth.headers,
      body: JSON.stringify(body),
    }
  );
}
```

This mirrors the verified `getTicket` path and existing authenticated JSON mutations. [VERIFIED: codebase grep] The return type and the following bodies are not established by the permitted source set and must be probed before locking:

- Public reply: a PATCH containing exactly one `comment` with sanitized HTML, `publicVisible: true`, and the current agent creator identity. [ASSUMED]
- Resolve/reopen: a PATCH containing only the ticket status field; it must omit `comment` entirely. [CITED: 03-CONTEXT.md D-15]
- Confirm the accepted status values/IDs for both `SOLVED` and reopen, whether `Content-Type` is injected by `HttpHandler`, whether quoted context belongs inside `comment.body`, and whether PATCH returns a full `Ticket`, partial object, or empty response. [ASSUMED]

Add a narrow `PatchTicketRequest` union only after that probe:

```ts
type PatchTicketRequest =
  | { comment: PublicReplyComment }
  | { fields: Array<{ key: "ts.status"; value: string }> };
```

Do not reuse `CreateTicketRequest`: creation requires subject/requester/parent fields, while reply/status PATCH must not accidentally resend them. [VERIFIED: codebase grep]

### `src/types/grispi.type.ts`

Export the existing `Comment`, `User`, and `Role` shapes or introduce exported thread-facing projections. Add `PatchTicketRequest` and make response typing reflect the probe. Preserve `body` as HTML and use `publicVisible` plus `creator.role.authority === "ROLE_END_USER"` to classify internal/public and incoming/own messages; this is the classification already used by the list store. [VERIFIED: codebase grep]

## HTML Editor and Rendering

Use a small controlled wrapper around `contentEditable`: keep the canonical draft as sanitized HTML, read `innerHTML` on input, cap height with CSS, and implement toolbar actions through selection-preserving DOM commands. This avoids adopting a large editor whose React/TypeScript peer range is unknown in this constrained research pass. [ASSUMED]

Use a maintained sanitizer library with one shared policy at both boundaries: pasted/editor HTML before PATCH and server HTML before `dangerouslySetInnerHTML`. Allow only `p`, `br`, `strong`, `b`, `em`, `i`, `ul`, `ol`, `li`, `a`, and `blockquote`; allow `href`, `target`, and `rel` on anchors; reject `style`, `script`, event attributes, `img`, and `table`; force safe link protocols and `rel="noopener noreferrer"`. [CITED: 03-UI-SPEC.md Accessibility & Safety] The package/version must be checked against the repository’s CRA/React/TS4 versions before install because those files were outside this narrow read scope. [ASSUMED]

Render plain fallback content with React text interpolation. Never pass unsanitized API HTML to `dangerouslySetInnerHTML`. [CITED: 03-UI-SPEC.md]

Treat quote extraction as an adapter, not a renderer concern: split recognizable quoted history into `bodyHtml` and optional `quotedHtml`, sanitize both, and default the quote disclosure closed. Unknown markup should remain sanitized body content rather than be deleted. [ASSUMED]

## MobX State and Navigation Integration

`ActiveConversationStore` should add:

- `load(ticketKey, parentKey)`, loading/error state, active `Ticket`, normalized chronological `MessageVM[]`, recipient, subject, and solved state. [ASSUMED]
- `sendReply(html)` plus per-message retry payloads; clear editor state immediately, append pending immutably, PATCH in background, then replace active data from `getTicket` and reload the parent list. [CITED: 03-CONTEXT.md D-10] [VERIFIED: codebase grep]
- `setSolved()` / `reopen()` with `statusPending` and retryable `statusError`; do not modify solved state until PATCH succeeds. On reopen success, expose a one-shot `shouldFocusComposer` flag consumed by the screen. [CITED: 03-CONTEXT.md D-16..D-17]
- A generation/token guard for active loads so late responses cannot overwrite a newly opened conversation, matching the list store’s established concurrency pattern. [VERIFIED: codebase grep]

Navigation should call `activeConversation.load(row.key, parentKey)` when entering the thread. Only after `getTicket` succeeds should it call `setLastSeenAt(key, firstUnseenOrLatestPublicTimestamp)` and ask the list store to rederive that row; backing out with a non-empty draft must pass the confirmation gate before navigation. [CITED: 03-CONTEXT.md D-12,D-18]

Add a defensive `setLastSeenAt(ticketKey, timestamp): boolean` beside the existing reader; catch storage exceptions and return failure without blocking the thread. [VERIFIED: codebase grep]

### Badge refactor

Replace the single `ConversationRowVM.badge` as the source of both meanings with:

```ts
interface ConversationRowVM {
  // existing fields
  lifecycle: "open" | "solved";
  actionBadge: "yeni-yanit" | "yanit-bekleniyor" | null;
  hasUnseen: boolean;
}
```

For solved rows: `actionBadge = null`, `hasUnseen = false`. For open rows: last public external author means `actionBadge = "yeni-yanit"` regardless of last-seen; last public agent author means `"yanit-bekleniyor"`. Independently, `hasUnseen` is true only when the latest relevant external timestamp is newer than local last-seen. [CITED: 03-CONTEXT.md D-18..D-20] This removes the current bug where `resolveBadge` converts a seen external reply into `yanit-bekleniyor`, conflating “seen” with “agent replied.” [VERIFIED: codebase grep]

## Common Pitfalls

- Writing last-seen before `getTicket` succeeds can hide content the agent never loaded. [CITED: 03-CONTEXT.md D-18]
- Deriving action state from localStorage produces the wrong badge after an external reply is seen. [VERIFIED: codebase grep]
- Optimistically changing SOLVED/open state violates the locked failure behavior. [CITED: 03-CONTEXT.md D-17]
- Reusing creation retry payloads for replies can duplicate/create a ticket rather than patch the active ticket. [VERIFIED: codebase grep]
- Sanitizing only on render leaves unsafe or out-of-contract markup in outbound email; sanitizing only on send leaves inbound HTML unsafe. [ASSUMED]
- Using array in-place mutation can fail to repaint existing non-observer children; preserve immutable replacements. [VERIFIED: codebase grep]

## Validation Architecture

Existing Jest tests cover active optimistic transitions, list hydration/badges, and defensive last-seen reads. [VERIFIED: codebase grep]

Add:

| Area | Automated verification |
|---|---|
| Tickets client | PATCH URL encoding, method, auth headers, exact reply body, exact status-only body, and probed response shape |
| Active store load | chronological normalization, public/internal classification, generation race, error state, last-seen only after success |
| Reply | sanitized HTML payload, immediate draft clear, pending/sent/failed transitions, identical PATCH retry, active + list refetch |
| Lifecycle | no optimistic flip, SOLVED disables composer, failure preserves view, retry, reopen focus flag, no comment in status PATCH |
| Badge split | seen external remains `Yeni yanıt` but loses purple unseen accent; solved suppresses both; new external reply restores both |
| Last seen | correct key/value write, malformed/throwing storage is non-fatal |
| HTML | allowlisted formatting survives; scripts, handlers, unsafe links, images, tables, and pasted styles are removed |
| Keyboard/navigation | Enter newline, Shift+Enter sends, draft back-navigation cancel/confirm behavior |

Run the existing targeted suites plus new Phase 3 component/client suites, then the full CRA test command configured by the repository. [ASSUMED]

Manual verification at ~372px:

1. Open a thread with unseen external mail; it scrolls to the first unseen external message and purple emphasis clears only after successful load.
2. Confirm `Yeni yanıt` remains after viewing and changes to `Yanıt bekleniyor` only after a successful agent reply.
3. Paste hostile/complex HTML and inspect both DOM and PATCH body.
4. Resolve and reopen; verify no comment/email is generated, failure does not flip UI, solved composer is disabled, and reopen focuses it.
5. Verify quote disclosure, internal-note styling, toolbar keyboard labels/focus, 5–6 line composer cap, and draft-loss confirmation.

## Assumptions Log

| # | Claim | Risk if Wrong |
|---|---|---|
| A1 | PATCH uses the same ticket URL and returns `Ticket` | Client response parsing may be wrong |
| A2 | Reply/status payloads use `comment` and `fields/ts.status` shapes | Requests may be rejected or mutate unintended fields |
| A3 | A lightweight native `contentEditable` wrapper is sufficient | Browser command behavior may require a vetted editor dependency |
| A4 | Quote history can be recognized from body markup | Grispi may expose a different quoting contract |

## Open Questions

1. What exact PATCH bodies and reopen status value does the live tenant accept?
2. Does PATCH return the full ticket, and does an external email automatically reopen SOLVED without any plugin action?
3. What stable HTML markers identify quoted history in inbound Grispi comments?
4. Which sanitizer package/version is already installed or compatible with this repository’s CRA/React/TS4 versions?

## Sources

- `03-CONTEXT.md` — locked product and lifecycle decisions. [CITED: 03-CONTEXT.md]
- `03-UI-SPEC.md` — visual, interaction, accessibility, and sanitizer contract. [CITED: 03-UI-SPEC.md]
- `active-conversation-store.ts`, `side-conversations-store.ts`, `last-seen-store.ts`, `tickets.ts`, `grispi.type.ts`, and matching Jest tests — current implementation seams and verified behavior. [VERIFIED: codebase grep]

