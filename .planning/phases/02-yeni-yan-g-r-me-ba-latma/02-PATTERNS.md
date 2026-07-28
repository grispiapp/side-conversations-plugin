# Phase 2: Yeni Yan Görüşme Başlatma - Pattern Map

**Mapped:** 2026-07-23
**Files analyzed:** 16 (new + modified)
**Analogs found:** 14 / 16

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/grispi/client/tickets.ts` (modify: add `createTicket`) | service (API client) | request-response | `Tickets.advancedSearch` (same file) | exact |
| `src/grispi/client/customers.ts` (new) | service (API client) | request-response | `src/grispi/client/users.ts` | exact |
| `src/grispi/client/api.ts` (modify: add `customers`) | service (facade) | wiring | same file, existing constructor wiring | exact |
| `src/lib/side-conversation.ts` (modify: add `formatPrefillSubject`, `formatRequesterField`, `isValidEmail`) | utility (pure fns) | transform | same file (`SIDE_CONVERSATION_PARENT_FIELD_KEY`) | exact |
| `src/contexts/grispi-context.tsx` (modify: add `agentEmail`) | provider | event-driven | same file (`ticket`/`settings` state pattern) | exact |
| `src/contexts/plugin-bootstrap.ts` (modify: consume `bundle.context.agent.email`) | provider (bootstrap) | request-response | same file | exact |
| `src/lib/standalone-dev.ts` (modify: add `REACT_APP_DEV_AGENT_EMAIL`) | config/utility | transform | same file | exact |
| `src/store/panel-navigation-store.ts` (new) | store (state machine) | event-driven | `src/store/side-conversations-store.ts` (MobX shape, not generation logic) | role-match |
| `src/store/compose-store.ts` (new) | store (form + async) | CRUD + event-driven | `src/store/side-conversations-store.ts` (`load()` generation-guard, `error` typing) | exact (data-flow: generation-guard) |
| `src/store/active-conversation-store.ts` (new) | store (chat state) | event-driven | `src/store/side-conversations-store.ts` (MobX shape/`runInAction`) | role-match |
| `src/store/root-store.ts` (modify: wire new stores) | store (composition root) | wiring | same file | exact |
| `src/components/ui/textarea.tsx` (new) | component (UI primitive) | — | `src/components/ui/input.tsx` | exact |
| `src/screens/compose-screen.tsx` (new) | component (screen) | request-response | `src/screens/conversations-list-screen.tsx` | exact |
| `src/screens/chat-screen.tsx` (new) | component (screen) | request-response | `src/screens/conversations-list-screen.tsx` | role-match |
| `src/screens/components/recipient-field.tsx` (new) | component (autocomplete) | event-driven | `src/screens/components/conversation-row.tsx` (not read in full — see below) + `compose-store` search state | partial (no combobox analog exists) |
| `src/screens/components/subject-field.tsx` (new) | component (form field) | — | `src/components/ui/input.tsx` (direct usage) | exact |
| `src/screens/components/message-field.tsx` (new) | component (form field) | event-driven | `src/components/ui/textarea.tsx` (new) direct usage | exact |
| `src/screens/components/confirm-dialog.tsx` (new) | component (dialog) | event-driven | `src/screens/components/error-card.tsx` (card/button shape only) | partial (no dialog analog) |
| `src/screens/components/message-bubble.tsx` (new) | component (chat bubble) | — | `src/components/ui/badge.tsx` (cva variant shape) | partial (no bubble analog) |
| `src/screens/components/empty-state.tsx` (modify: enable "+" CTA) | component | — | same file | exact |
| `src/app.tsx` (modify: screen-swap wiring) | provider/root component | event-driven | same file (current fixed render) | exact |

## Pattern Assignments

### `src/grispi/client/tickets.ts` — add `createTicket` (service, request-response)

**Analog:** same file, `advancedSearch` method (lines 35-48)

**Imports pattern** (lines 1-8):
```typescript
import { Authentication } from "./authentication";
import { HttpHandler } from "./http-handler";

import {
  AdvancedSearchRequest,
  AdvancedSearchResponse,
  Ticket,
} from "@/types/grispi.type";
```

**Core POST pattern to copy** (lines 35-48, `advancedSearch`):
```typescript
async advancedSearch(
  body: AdvancedSearchRequest,
  params: { size: number; page: number }
) {
  return this.http.send<AdvancedSearchResponse>(
    `public/v1/tickets/advanced-search?size=${params.size}&page=${params.page}`,
    {
      method: "POST",
      cache: "no-cache",
      headers: this.auth.headers,
      body: JSON.stringify(body),
    }
  );
}
```
`createTicket` follows this exact shape: `this.http.send<Ticket>("public/v1/tickets", { method: "POST", cache: "no-cache", headers: this.auth.headers, body: JSON.stringify(body) })`. Response typing is an open assumption (A1 in RESEARCH.md — verify via live probe before hardening past `Ticket`).

**Existing doc-comment convention** (lines 29-34) — the class already documents phase-scoping ("Only `advancedSearch` + `getTicket` are built in Phase 1... createTicket/patchTicket/searchCustomers/getDigest belong to Phases 2-4"). New `createTicket` method's doc comment should reference this same phase-scoping note and be removed/updated since Phase 2 now fills it in.

---

### `src/grispi/client/customers.ts` (new) — customer search (service, request-response)

**Analog:** `src/grispi/client/users.ts` (full file, 32 lines)

**Full pattern to copy:**
```typescript
import { Authentication } from "./authentication";
import { HttpHandler } from "./http-handler";

import { /* CustomerSearchResponse — new type, live-probe verified */ } from "@/types/grispi.type";

export class Customers {
  constructor(
    private http: HttpHandler,
    private auth: Authentication
  ) {}

  async search(params: { searchTerm: string; size: number; page: number }) {
    const query = new URLSearchParams({
      searchTerm: params.searchTerm,
      orderBy: "fullName",
      size: String(params.size),
      page: String(params.page),
    });
    return this.http.send<CustomerSearchResponse>(
      `public/v1/customers/search?${query.toString()}`,
      {
        method: "GET",
        cache: "no-cache",
        headers: this.auth.headers,
      }
    );
  }
}
```
Same constructor-injection shape (`http`, `auth`), same doc-comment convention explaining WHY this endpoint is used and what live-probe confirmed it (see `users.ts` lines 6-14 for the doc-comment style to mirror — cite `01-02-probe-findings.md` and note response envelope is UNVERIFIED, per RESEARCH.md Pitfall #7 / Assumption A2).

---

### `src/grispi/client/api.ts` — wire `Customers` (service, wiring)

**Analog:** same file, existing `Tickets`/`Users` wiring

**Pattern to copy** (full file, 21 lines) — add one line each in the class body, constructor, and instantiation, mirroring the existing `tickets`/`users` triplet:
```typescript
import { Customers } from "./customers";
// ...
readonly customers: Customers;
// ...
this.customers = new Customers(this.httpHandler, this.authentication);
```

---

### `src/lib/side-conversation.ts` — add pure helpers (utility, transform)

**Analog:** same file (currently just exports `SIDE_CONVERSATION_PARENT_FIELD_KEY`, 11 lines)

**Convention to copy:** one exported `const`/`function` per concern, each with a doc-comment explaining the WHY and citing the locked decision (D-XX) or probe-finding that justifies it — exactly like the existing `SIDE_CONVERSATION_PARENT_FIELD_KEY` comment style (lines 1-9).

RESEARCH.md already supplies the exact bodies to add (Code Examples section):
```typescript
export function formatRequesterField(email: string): string {
  return `:${email}`;
}

export function formatPrefillSubject(ticketKey: string, ticketTitle: string): string {
  return `[${ticketKey}] ${ticketTitle}`.trim();
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
```
Existing test file `src/lib/__tests__/side-conversation.test.ts` is the analog for the new tests — same file gets new `describe` blocks, not a new test file (per RESEARCH.md Wave 0 Gaps).

---

### `src/contexts/grispi-context.tsx` — add `agentEmail` (provider, event-driven)

**Analog:** same file — `ticket`/`settings` state additions

**Pattern to copy** (lines 21-33, 67-69, 141, 185-197): add `agentEmail: string | null` to `GrispiContextType`, add a `useState<string | null>(null)` alongside `ticket`/`settings`, set it in both the standalone branch (from `standaloneConfig`, needs new field) and the plugin branch (from `bundle.context.agent.email` via `bootstrapPluginInit`), and thread it through the `<GrispiContext.Provider value={{ ... }}>` object at the bottom exactly like `settings`/`loading` are threaded today.

**Standalone-config extension pattern** (from `src/lib/standalone-dev.ts` lines 18-51): `StandaloneDevConfig` interface gains `agentEmail: string`, `resolveStandaloneDevConfig` reads a new `REACT_APP_DEV_AGENT_EMAIL` env var with the same `.trim()` + fallback style used for `tenantId`/`initialTicketKey` (lines 42, 45-48).

---

### `src/contexts/plugin-bootstrap.ts` — consume `bundle.context.agent.email` (provider, request-response)

**Analog:** same file, full 55 lines

**Pattern to copy** (lines 39-54, `bootstrapPluginInit`): add `setAgentEmail(email: string | null): void` to `BootstrapPluginInitDeps` (mirroring `setSettings`/`setLoading`), then in the try block add `deps.setAgentEmail(bundle.context.agent?.email ?? null);` alongside the existing `deps.authentication.setTenantId(...)`/`deps.setSettings(...)` calls (lines 45-47) — same defensive-optional-chaining style as the rest of the function, same "pure injectable deps" testing approach (see `src/contexts/__tests__/plugin-bootstrap.test.ts`, not read in full but same convention applies: inject fakes for every dep, assert calls).

---

### `src/store/root-store.ts` — wire new stores (store composition, wiring)

**Analog:** same file, full 13 lines

**Pattern to copy exactly:**
```typescript
import { ComposeStore } from "./compose-store";
import { ActiveConversationStore } from "./active-conversation-store";
import { PanelNavigationStore } from "./panel-navigation-store";
// ... existing imports

export class RootStore {
  currentUser: CurrentUserStore;
  sideConversations: SideConversationsStore;
  compose: ComposeStore;
  activeConversation: ActiveConversationStore;
  panelNavigation: PanelNavigationStore;

  constructor() {
    this.currentUser = new CurrentUserStore(this);
    this.sideConversations = new SideConversationsStore(this);
    this.compose = new ComposeStore(this);
    this.activeConversation = new ActiveConversationStore(this);
    this.panelNavigation = new PanelNavigationStore(this);
  }
}
```
Every store takes `rootStore: RootStore` in its constructor — new stores follow the same convention (see `SideConversationsStore` constructor, lines 218-222 of `side-conversations-store.ts`).

---

### `src/store/compose-store.ts` (new) — form + search + submit (store, CRUD + event-driven)

**Analog:** `src/store/side-conversations-store.ts` (full file — generation-guard, MobX shape, error typing)

**MobX class shape to copy** (lines 205-222):
```typescript
export class ComposeStore {
  rootStore: RootStore;
  // ...observable fields...
  error: NetworkError | HttpError | null = null;

  private generation = 0; // reused per-concern: searchGeneration + submitGeneration

  constructor(rootStore: RootStore) {
    makeAutoObservable(this);
    this.rootStore = rootStore;
  }
}
```

**Generation-guard debounce pattern** — RESEARCH.md already supplies the exact adaptation (RESEARCH.md "Pattern 1", verbatim, based on `load()`'s guard at lines 232-300):
```typescript
private async runSearch(term: string) {
  const gen = ++this.searchGeneration;
  runInAction(() => { this.searchStatus = "loading"; });
  try {
    const response = await grispiAPI.customers.search({ searchTerm: term, size: 10, page: 0 });
    if (gen !== this.searchGeneration) return; // stale guard — copy from load()'s `if (gen !== this.generation) return;`
    runInAction(() => {
      this.results = response.content ?? [];
      this.searchStatus = this.results.length ? "results" : "no-results";
    });
  } catch {
    if (gen !== this.searchGeneration) return;
    runInAction(() => { this.searchStatus = "no-results"; });
  }
}
```

**Error typing pattern to copy** (from `load()`'s catch, lines 291-299):
```typescript
} catch (err) {
  if (gen !== this.generation) return;
  runInAction(() => {
    this.error = err instanceof NetworkError || err instanceof HttpError ? err : null;
    this.status = "error";
  });
}
```

**Reentrancy-guard submit pattern** — RESEARCH.md "Pattern 3" (verbatim):
```typescript
async submit() {
  if (this.submitting) return; // synchronous guard, before any await
  this.submitting = true;
  const gen = ++this.submitGeneration;
  // ...optimistic bubble via rootStore.activeConversation, then POST...
}
```

**SYNC-02 refetch call** — after successful `createTicket`, call `this.rootStore.sideConversations.load(parentKey)` — same `load(parentKey: string)` signature already used by `conversations-list-screen.tsx` (line 25).

---

### `src/store/active-conversation-store.ts` (new) — minimal chat state (store, event-driven)

**Analog:** `src/store/side-conversations-store.ts` (MobX shape + `runInAction` convention only — no generation-guard needed here per RESEARCH.md Pattern 4, since there's no concurrent fetch race for a single optimistic message)

**Shape to copy from RESEARCH.md "Pattern 4" (verbatim, already the recommended seam):**
```typescript
export interface MessageVM {
  id: string;
  direction: "own" | "incoming";
  body: string;
  status: "pending" | "sent" | "failed";
  createdAt: number;
}

export class ActiveConversationStore {
  rootStore: RootStore;
  ticketKey: string | null = null;
  recipientLabel = "";
  subject = "";
  messages: MessageVM[] = [];

  constructor(rootStore: RootStore) {
    makeAutoObservable(this);
    this.rootStore = rootStore;
  }

  startNew(recipientLabel: string, subject: string, body: string) { /* ... */ }
  resolveSent(messageId: string) { /* ... */ }
  markFailed(messageId: string) { /* ... */ }
  retry(messageId: string) { /* ... */ }
}
```
`runInAction` usage for all mutations from async callbacks — same convention as `resolveRecipientEmail`/`enrichUnresolvedRecipients` in `side-conversations-store.ts` (lines 443-450, immutable array replacement, not in-place mutation — same "UAT Defect 2" lesson applies to message list updates).

---

### `src/store/panel-navigation-store.ts` (new) — screen state machine (store, event-driven)

**Analog:** no direct analog exists (Phase 1 has no navigation state machine — RESEARCH.md confirms this explicitly). Closest structural analog is `SideConversationsStore`'s plain-observable-fields + method-based-mutation shape (no generation-guard needed).

**Shape to copy from RESEARCH.md "Pattern 5" (verbatim, this is the recommended implementation, not just an example)**:
```typescript
type PanelScreen = "list" | "compose" | "chat";

export class PanelNavigationStore {
  rootStore: RootStore;
  screen: PanelScreen = "list";

  constructor(rootStore: RootStore) {
    makeAutoObservable(this);
    this.rootStore = rootStore;
  }

  openCompose() { this.screen = "compose"; }
  requestBack(isDirty: boolean): boolean { /* D-02 */ }
  confirmDiscardAndReturnToList() { this.screen = "list"; }
  handleParentTicketChanged(isDirty: boolean): "closed-silently" | "needs-confirm" | "no-op" { /* D-03 */ }
}
```

**Bridge pattern** — `app.tsx` must add a `useEffect` bridging `useGrispi().ticket?.key` changes into `panelNavigation.handleParentTicketChanged(...)`, mirroring the EXACT bridge already used in `conversations-list-screen.tsx` (lines 23-28):
```typescript
useEffect(() => {
  if (ticket?.key) {
    store.load(ticket.key);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [ticket?.key]);
```

---

### `src/components/ui/textarea.tsx` (new) — multi-line input primitive (component, —)

**Analog:** `src/components/ui/input.tsx` (full file, 26 lines)

**Full pattern to copy (adapted to `<textarea>`):**
```typescript
import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
```
Same `React.forwardRef` + `cn()` + `displayName` convention as `Input` — no `cva` needed here since `Input` itself doesn't use `cva` (only `Button`/`Badge` do).

---

### `src/screens/compose-screen.tsx` (new) — full-panel screen (component, request-response)

**Analog:** `src/screens/conversations-list-screen.tsx` (full file, 75 lines)

**Screen structure to copy** (lines 1-38):
```typescript
import { observer } from "mobx-react-lite";

import {
  Screen,
  ScreenContent,
  ScreenHeader,
  ScreenTitle,
} from "@/components/ui/screen";
import { useGrispi } from "@/contexts/grispi-context";
import { useStore } from "@/contexts/store-context";

export const ComposeScreen = observer(() => {
  const { ticket } = useGrispi();
  const compose = useStore().compose;
  const panelNav = useStore().panelNavigation;

  return (
    <Screen>
      <ScreenHeader onBack={() => { /* D-02: dirty-guard via panelNav.requestBack */ }}>
        <ScreenTitle>Yeni görüşme</ScreenTitle>
      </ScreenHeader>
      <ScreenContent>
        <div className="flex h-full flex-col gap-2 p-4">
          {/* RecipientField, SubjectField, MessageField, Gönder button */}
        </div>
      </ScreenContent>
    </Screen>
  );
});
```
`ScreenHeader`'s `onBack` prop (already supports back-arrow rendering, see `screen.tsx` lines 28-53) is the exact mechanism D-01/D-02 need — no new header component required.

---

### `src/screens/chat-screen.tsx` (new) — minimal chat shell (component, request-response)

**Analog:** `src/screens/conversations-list-screen.tsx` (same screen-swap shape as `ComposeScreen` above, plus `store.status`-driven conditional rendering, lines 41-70, adapted to render `MessageBubble` list instead of `ConversationRow` list)

---

### `src/screens/components/recipient-field.tsx` (new) — customer autocomplete (component, event-driven)

**Analog:** no combobox/autocomplete analog exists in the codebase (partial match). Closest UI building block is `src/components/ui/input.tsx` for the text input itself; the dropdown/list rendering has no existing analog — build using plain `cn()`-styled `<div>`s per UI-SPEC (no Radix Popover, confirmed rejected in RESEARCH.md "Alternatives Considered").

**State wiring to copy** — drive entirely off `ComposeStore` fields (`query`, `searchStatus`, `results`) via `observer()`, same one-way-bind pattern as `ConversationsListScreen` reading `store.status`/`store.rows` (lines 41-69 of `conversations-list-screen.tsx`).

---

### `src/screens/components/confirm-dialog.tsx` (new) — D-02/D-03 confirm prompt (component, event-driven)

**Analog:** no dialog analog exists (partial match). Closest structural/visual analog is `src/screens/components/error-card.tsx` (full file, 36 lines) for the "centered card + message + button(s)" layout convention:
```typescript
<div className="flex flex-col items-center gap-3 rounded-md bg-card px-6 py-6 text-center">
  <p className="text-sm text-muted-foreground">{message}</p>
  <div className="flex gap-2">
    <Button variant="outline" size="sm" onClick={onCancel}>Vazgeç</Button>
    <Button variant="destructive" size="sm" onClick={onConfirm}>Onayla</Button>
  </div>
</div>
```
Single component takes `message`/`onConfirm`/`onCancel` props reused for both D-02 (discard draft) and D-03 (parent ticket changed) call sites — per CONTEXT.md's explicit instruction ("D-02 VE D-03 için TEK bileşen, farklı copy/props").

---

### `src/screens/components/message-bubble.tsx` (new) — chat bubble (component, —)

**Analog:** no bubble analog exists (partial match). Closest pattern-source is `src/components/ui/badge.tsx` for the `cva`-variant convention to model the bubble's `direction`/`status` variants:
```typescript
const bubbleVariants = cva(
  "rounded-lg px-3 py-2 text-sm max-w-[85%]",
  {
    variants: {
      direction: {
        own: "ml-auto bg-primary text-primary-foreground",
        incoming: "mr-auto bg-card", // Phase 3 only
      },
    },
    defaultVariants: { direction: "own" },
  }
)
```
Same `cva` + `VariantProps` + `cn()` export shape as `badge.tsx` (lines 1-32) and `button.tsx` (lines 7-35).

---

### `src/screens/components/empty-state.tsx` — enable "+" CTA (component, modify)

**Analog:** same file (lines 24-33)

**Exact change:** remove `disabled`/`aria-label="Çok yakında"`/`title="Çok yakında"` props, wire `onClick={() => panelNav.openCompose()}` — no layout change (per D-01, "layout zıplaması yok"), same `Button` element/classNames stay.

---

### `src/app.tsx` — screen-swap wiring (provider/root, modify)

**Analog:** same file (full 19 lines) — currently hardcodes `<ConversationsListScreen />`

**Pattern to copy (conditional render on `panelNavigation.screen`):**
```typescript
const App = observer(() => {
  const { screen } = useStore().panelNavigation;
  return (
    <StoreProvider>
      <GrispiProvider>
        {screen === "list" && <ConversationsListScreen />}
        {screen === "compose" && <ComposeScreen />}
        {screen === "chat" && <ChatScreen />}
        <DevTicketSwitcher />
      </GrispiProvider>
    </StoreProvider>
  );
});
```
Note: `useStore()` must be called INSIDE `GrispiProvider`/`StoreProvider`, so this likely needs restructuring into a wrapped inner component — same providers-then-content nesting as today, `observer()` wrap needed since `App` now reads MobX-observable `screen`.

## Shared Patterns

### HTTP error typing (NetworkError / HttpError)
**Source:** `src/grispi/client/http-handler.ts` (full file, lines 1-51)
**Apply to:** `compose-store.ts` (submit + search error handling), any new client method
```typescript
export class NetworkError extends Error {
  constructor(public cause: unknown) { super("network"); }
}
export class HttpError extends Error {
  constructor(public status: number, public body: unknown) { super(`http_${status}`); }
}
```
Never surface `error.body`/`status` to the user or console (V7, Info Disclosure) — same rule `ErrorCard` already follows.

### Generation-guard (stale-response protection)
**Source:** `src/store/side-conversations-store.ts` lines 232-300 (`load()`)
**Apply to:** `compose-store.ts` search (`searchGeneration`) and submit (`submitGeneration`)
```typescript
const gen = ++this.generation;
// ...await...
if (gen !== this.generation) return; // stale — a newer call already superseded this one
```

### MobX store shape (`makeAutoObservable` + `runInAction`)
**Source:** `src/store/side-conversations-store.ts` lines 205-222, all `runInAction` call sites
**Apply to:** `compose-store.ts`, `active-conversation-store.ts`, `panel-navigation-store.ts`
```typescript
export class SomeStore {
  rootStore: RootStore;
  constructor(rootStore: RootStore) {
    makeAutoObservable(this);
    this.rootStore = rootStore;
  }
}
```
All async mutations wrapped in `runInAction(() => { ... })`.

### Screen/ScreenHeader/ScreenContent primitives
**Source:** `src/components/ui/screen.tsx` (full file, 78 lines)
**Apply to:** `compose-screen.tsx`, `chat-screen.tsx`
`ScreenHeader`'s `onBack` prop already renders the back-arrow `Button` — no new header component needed, D-01's "identical to Screen/ScreenHeader primitives" requirement is satisfied by direct reuse.

### `cn()` + `cva()` styling convention
**Source:** `src/lib/utils.ts` (not read in full, but referenced everywhere — `cn` = `clsx` + `tailwind-merge`), `src/components/ui/button.tsx` lines 7-35, `src/components/ui/badge.tsx` lines 10-22
**Apply to:** `textarea.tsx`, `message-bubble.tsx`, any new variant-bearing component

### Bridging React context → MobX store via `useEffect`
**Source:** `src/screens/conversations-list-screen.tsx` lines 23-28
**Apply to:** `app.tsx`'s new `useEffect` for `panelNavigation.handleParentTicketChanged` (D-03), any component needing to react to `useGrispi().ticket?.key` changes
```typescript
useEffect(() => {
  if (ticket?.key) { /* dispatch to store */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [ticket?.key]);
```

### Doc-comment convention (WHY over WHAT, cite decision IDs)
**Source:** pervasive — `side-conversation.ts` lines 1-9, `users.ts` lines 6-14, `empty-state.tsx` lines 6-12, `error-card.tsx` lines 7-16
**Apply to:** every new file
Every non-trivial function/class/const gets a doc-comment explaining WHY (not what), citing the specific `D-XX` decision or probe-finding that drove the choice — this is a strong, consistent codebase convention, not optional style.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/screens/components/recipient-field.tsx` | component | event-driven | No combobox/autocomplete UI exists in Phase 1; build from `Input` primitive + plain styled dropdown per UI-SPEC (Radix Popover explicitly rejected) |
| `src/screens/components/confirm-dialog.tsx` | component | event-driven | No modal/dialog exists in Phase 1 (all navigation was screen-swap only); use `error-card.tsx`'s card-layout convention as closest visual analog |
| `src/screens/components/message-bubble.tsx` | component | — | No chat/message UI exists in Phase 1 (read-only list only); use `badge.tsx`'s `cva`-variant convention as closest structural analog |
| `src/store/panel-navigation-store.ts` | store | event-driven | No screen-swap state machine exists yet (RESEARCH.md confirms: `app.tsx` today hardcodes one screen); RESEARCH.md Pattern 5 supplies the concrete recommended implementation directly |

## Metadata

**Analog search scope:** `src/grispi/client/`, `src/store/`, `src/contexts/`, `src/screens/` (+ `components/`), `src/components/ui/`, `src/lib/`
**Files scanned:** 27 (full `src/` tree)
**Pattern extraction date:** 2026-07-23
