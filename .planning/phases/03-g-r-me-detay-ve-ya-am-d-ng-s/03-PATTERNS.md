# Phase 3: Görüşme Detayı ve Yaşam Döngüsü - Pattern Map

**Mapped:** 2026-07-28
**Files analyzed:** 13 planned new/modified files
**Analogs found:** 13 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/types/grispi.type.ts` | model | request-response | existing `Ticket` / `CreateTicketRequest` | exact |
| `src/grispi/client/tickets.ts` | service | request-response | `getTicket` / `createTicket` in same file | exact |
| `src/lib/last-seen-store.ts` | utility | file-I/O | `getLastSeenAt` in same file | exact |
| `src/store/active-conversation-store.ts` | store | request-response | existing optimistic create lifecycle | exact |
| `src/store/side-conversations-store.ts` | store | transform | existing hydration, generation, badge mapping | exact |
| `src/screens/chat-screen.tsx` | component | event-driven | existing `ChatScreen` shell | exact |
| `src/screens/components/message-bubble.tsx` (or replacement thread-message component) | component | transform | existing `MessageBubble` status/retry rendering | role-match |
| `src/screens/components/rich-text-composer.tsx` | component | event-driven | `MessageBubble` props/events + `Button` primitive | role-match |
| `src/store/__tests__/active-conversation-store.test.ts` | test | request-response | existing active-store lifecycle tests | exact |
| `src/store/__tests__/side-conversations-store.test.ts` | test | transform | existing badge/race tests | exact |
| `src/lib/__tests__/last-seen-store.test.ts` | test | file-I/O | existing defensive storage tests | exact |
| `src/grispi/client/__tests__/tickets.test.ts` | test | request-response | client methods in `tickets.ts` | role-match |
| thread/composer component tests | test | event-driven | `ChatScreen` / `MessageBubble` public props and copy | role-match |

## Pattern Assignments

### `src/types/grispi.type.ts`

Export the existing thread shapes rather than duplicating them. `Comment` already carries every normalization input (`body`, visibility, creator, timestamp, channel):

```ts
// src/types/grispi.type.ts:43-58
interface Comment {
  body: string;
  publicVisible: boolean;
  createdAt: number;
  creator: User;
  channel: string;
}
```

Add a narrow `PatchTicketRequest` union beside `CreateTicketRequest` (`src/types/grispi.type.ts:219-226`); do not reuse create fields for reply/status PATCHes.

### `src/grispi/client/tickets.ts`

Copy the encoded ticket URL, auth, and no-cache request convention:

```ts
// src/grispi/client/tickets.ts:17-25
return this.http.send<Ticket>(
  `public/v1/tickets/${encodeURIComponent(ticketKey)}`,
  {
    method: "GET",
    cache: "no-cache",
    headers: this.auth.headers,
  }
);
```

For `patchTicket`, copy mutation serialization from `createTicket` (`src/grispi/client/tickets.ts:59-65`), changing only method, URL, and the probe-confirmed response type. Keep reply and status-only bodies typed distinctly.

### `src/lib/last-seen-store.ts`

Mirror the defensive read for the writer:

```ts
// src/lib/last-seen-store.ts:12-20
try {
  const raw = window.localStorage.getItem(KEY_PREFIX + ticketKey);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
} catch {
  return null;
}
```

`setLastSeenAt` should use the same prefix, catch storage exceptions, and return `boolean`; opening the thread must not fail when iframe storage is unavailable.

### `src/store/active-conversation-store.ts`

Keep MobX ownership and immutable message transitions:

```ts
// src/store/active-conversation-store.ts:125-149
this.messages = this.messages.map((m) =>
  m.id === messageId
    ? { ...m, status: "pending" as const, errorKind: undefined }
    : m
);
```

Copy the background mutation lifecycle from `sendCreateTicket` (`src/store/active-conversation-store.ts:160-177`): append pending immediately, retain the exact retry payload, classify only network/server failure, and refetch real active/list data after success. Extend it with:

- `load(ticketKey, parentKey)` and a monotonic generation guard.
- chronological `Comment` → `MessageVM` normalization, including public/internal and external/own classification;
- sanitized HTML plus optional collapsed quote fields;
- `sendReply`, reply-specific retry payloads, and immediate editor clear;
- `setSolved`/`reopen` with `statusPending`/`statusError`, but no optimistic lifecycle flip;
- a one-shot composer-focus signal after successful reopen.

The existing tests establish pending-first rendering, preserved failed body, identical retry, refetch, and new-array identity (`src/store/__tests__/active-conversation-store.test.ts:74-180,230-245`).

### `src/store/side-conversations-store.ts`

Replace the conflated `badge` result with independent lifecycle/action/unseen fields at the existing mapping seam (`src/store/side-conversations-store.ts:23-35,100-125`). Preserve the verified author rule:

```ts
// src/store/side-conversations-store.ts:104-109
const publicComments = (ticket.comments ?? [])
  .filter((comment) => comment.publicVisible)
  .map((comment) => ({
    createdAt: comment.createdAt,
    authorIsAgent: comment.creator?.role?.authority !== "ROLE_END_USER",
  }));
```

Solved suppresses both signals. For open rows, last public author determines `actionBadge`; local last-seen independently determines `hasUnseen`. Retain the generation checks around both request tiers (`src/store/side-conversations-store.ts:232-285`) and immutable row replacement. Tests should extend the current external/agent/solved matrix and stale-generation case (`src/store/__tests__/side-conversations-store.test.ts:156-280`).

### `src/screens/chat-screen.tsx`

Retain the full-panel composition and store-driven observer:

```tsx
// src/screens/chat-screen.tsx:21-45
export const ChatScreen = observer(() => {
  const activeConversation = useStore().activeConversation;
  return (
    <Screen>
      <ScreenHeader>{/* title and lifecycle menu */}</ScreenHeader>
      <ScreenContent>{/* chronological thread */}</ScreenContent>
    </Screen>
  );
});
```

Expand this seam into header menu, scroll target, solved band, chronological email blocks, and fixed composer. Keep draft-loss navigation behind the existing `onBack` gate (`src/screens/chat-screen.tsx:27-29`). `Screen`/`ScreenContent` already provide fixed full-panel flex and scrollable content (`src/components/ui/screen.tsx:17-24,67-75`).

### Thread message component

Reuse `MessageBubble`’s typed message/event boundary and explicit pending/failed branches, but replace bubble geometry with full-width email blocks:

```tsx
// src/screens/components/message-bubble.tsx:42-69
{message.status === "pending" && <ReloadIcon className="animate-spin" />}
{message.status === "failed" && (
  <button type="button" onClick={() => onRetry(message.id)}>
    Gönderilemedi · Tekrar dene
  </button>
)}
```

Render sanitized allowlisted HTML only; plain fallback remains React text interpolation. Add sender/meta labels, amber internal-note treatment, and closed-by-default quote disclosure.

### `src/screens/components/rich-text-composer.tsx`

Use `Button` for toolbar actions and focus/disabled conventions (`src/components/ui/button.tsx:7-33,43-51`). Keep the component boundary narrow: sanitized HTML value, input/change, Shift+Enter submit, toolbar commands, disabled state, and focus ref. Cap the editable region at 5–6 lines with internal overflow. Toolbar buttons require accessible names and visible focus.

## Shared Patterns

### Async state and errors

Use `makeAutoObservable`, background async work, and `runInAction` (`src/store/active-conversation-store.ts:1,72-75,160-177`). Store only safe error categories; never expose raw response bodies. Status PATCH failure preserves the current solved/open view.

### Server truth after mutations

After reply or lifecycle PATCH, reload the active ticket and parent list. Do not synthesize final server comments/status. Status changes are never optimistic; reply messages alone use the existing pending/failed optimistic pattern.

### HTML safety

One shared sanitizer policy must run at inbound render and outbound editor/PATCH boundaries. Allow paragraph, breaks, emphasis, lists, safe anchors, and blockquote; reject scripts, styles, handlers, images, and tables. Unknown/plain content falls back to text interpolation.

### Observable updates and races

Assign fresh arrays/objects for message and row transitions. Copy the list store’s monotonic generation check so an older active-ticket load cannot overwrite a newer selection.

### Test style

Mock `grispiAPI`, construct typed fixture tickets/comments, assert synchronous optimistic state before flushing promises, then assert settled state/refetch. Storage tests spy on `Storage.prototype` and verify thrown access is non-fatal (`src/lib/__tests__/last-seen-store.test.ts:8-33`).

## Probe-Gated Details

No codebase analog establishes the exact Grispi PATCH body, reopen status value, quote marker, or PATCH response shape. The planner must gate `PatchTicketRequest` and client assertions on the focused live probe described in `03-RESEARCH.md`; the structural patterns above remain valid regardless of those values.

## Metadata

**Analog search scope:** Direct source and test analogs named by Phase 3 context/research/UI spec only  
**Pattern extraction date:** 2026-07-28
