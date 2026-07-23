# Phase 1: Temel ve Salt Okunur Görüşme Listesi - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 11 new + 2 extended
**Analogs found:** 11 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/grispi/client/http-handler.ts` (EXTEND) | service | request-response | itself (existing) | exact — modify in place |
| `src/grispi/client/tickets.ts` (EXTEND: add `advancedSearch`) | service | CRUD | `getTicket` method, same file | exact |
| `src/store/side-conversations-store.ts` | store | CRUD (fetch + paginate) | `src/store/current-user-store.ts` | role-match (simpler analog; needs async/status extension) |
| `src/store/root-store.ts` (EXTEND: register new store) | store | — | itself (existing) | exact |
| `src/lib/relative-time.ts` | utility | transform | none (new domain) | no analog |
| `src/lib/conversation-status.ts` | utility | transform | none (new domain) | no analog |
| `src/lib/last-seen-store.ts` | utility | file-I/O (localStorage) | none (new domain) | no analog |
| `src/components/ui/badge.tsx` | component | transform (presentational) | `src/components/ui/button.tsx` | exact (cva/cn pattern) |
| `src/components/ui/skeleton.tsx` | component | transform (presentational) | `src/components/ui/button.tsx` (styling conventions only, simpler) | role-match |
| `src/screens/conversations-list-screen.tsx` | component (screen) | request-response (renders store state) | `src/screens/welcome-screen.tsx` + `src/screens/loading-screen.tsx` | exact |
| `src/app.tsx` (EXTEND: swap `WelcomeScreen` → `ConversationsListScreen`) | config/wiring | — | itself (existing) | exact |
| `src/store/__tests__/side-conversations-store.test.ts` | test | — | none (no existing store test) | no analog |
| `src/grispi/client/__tests__/http-handler.test.ts` | test | — | none (no existing client test) | no analog |

## Pattern Assignments

### `src/grispi/client/http-handler.ts` (service, request-response) — EXTEND

**Analog:** itself, current content below (full file, 19 lines)

**Current pattern (to replace)** — `src/grispi/client/http-handler.ts` lines 1-19:
```typescript
export class HttpHandler {
  baseUrl: string = "https://api.grispi.net";
  headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  async send<T>(url: string, options: RequestInit): Promise<T | null> {
    const response = await fetch(`${this.baseUrl}/${url}`, {
      ...options,
      headers: { ...this.headers, ...options.headers },
    });

    if (response.ok) {
      return await response.json();
    }

    return null;
  }
}
```

**Target pattern** — swallow-to-`null` must become typed throws (D-11, CORE-03). RESEARCH.md Code Examples #1 is the concrete replacement to implement:
```typescript
export class NetworkError extends Error {
  constructor(public cause: unknown) { super("network"); }
}
export class HttpError extends Error {
  constructor(public status: number, public body: unknown) { super(`http_${status}`); }
}
export class HttpHandler {
  baseUrl = "https://api.grispi.net";
  headers: Record<string, string> = { "Content-Type": "application/json" };

  async send<T>(path: string, options: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/${path}`, {
        ...options,
        headers: { ...this.headers, ...options.headers },
      });
    } catch (cause) {
      throw new NetworkError(cause);
    }
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new HttpError(response.status, body);
    }
    return response.json();
  }
}
```
**Note:** signature changes from `Promise<T | null>` to `Promise<T>` (throws instead). Only current caller is `Tickets.getTicket` (called from `grispi-context.tsx` and the new store) — update both call sites to `try/catch` on `NetworkError`/`HttpError` per CORE-03's Turkish-message-plus-retry requirement. `grispi-context.tsx` lines 48-58 already has a `try/catch` around `getTicket` — extend that block's catch to branch on error type rather than adding new structure.

---

### `src/grispi/client/tickets.ts` (service, CRUD) — EXTEND

**Analog:** existing `getTicket` method in the same file (lines 1-24)

**Imports pattern** (lines 1-4):
```typescript
import { Authentication } from "./authentication";
import { HttpHandler } from "./http-handler";

import { Ticket } from "@/types/grispi.type";
```

**Core CRUD pattern to replicate for `advancedSearch`** (lines 6-24):
```typescript
export class Tickets {
  constructor(
    private http: HttpHandler,
    private auth: Authentication
  ) {}

  async getTicket(ticketKey: string) {
    const response = await this.http.send<Ticket>(
      `public/v1/tickets/${ticketKey}`,
      {
        method: "GET",
        cache: "no-cache",
        headers: this.auth.headers,
      }
    );

    return response;
  }
}
```
**New method should follow this exact shape** — constructor DI already provides `this.http` and `this.auth.headers`; add:
```typescript
async advancedSearch(body: AdvancedSearchRequest, params: { size: number; page: number }) {
  return this.http.send<AdvancedSearchResponse>(
    `public/v1/tickets/advanced-search?size=${params.size}&page=${params.page}`,
    { method: "POST", cache: "no-cache", headers: this.auth.headers, body: JSON.stringify(body) }
  );
}
```
**Security note (V5):** `ticketKey` is interpolated unencoded into the URL in the existing `getTicket` — RESEARCH.md flags this (Known Threat Patterns table). When extending, wrap with `encodeURIComponent(ticketKey)` for both the existing and any new path-based calls.

**Live-shape caveat:** `AdvancedSearchRequest`/`AdvancedSearchResponse` types are UNVERIFIED (RESEARCH.md Open Question #1) — first task should probe live and lock these types in `src/types/grispi.type.ts` before writing derivation code against assumptions.

---

### `src/store/side-conversations-store.ts` (store, CRUD/fetch+paginate)

**Analog:** `src/store/current-user-store.ts` (full file, 22 lines) — establishes the MobX class shape; this new store is materially more complex (async fetch, pagination, derived state) so treat this as the *skeleton* pattern only, not a literal copy.

**Class + constructor pattern** (lines 1-21):
```typescript
import { RootStore } from "./root-store";
import { makeAutoObservable } from "mobx";

export class CurrentUserStore {
  rootStore: RootStore;
  credentials?: UserCredentials;

  constructor(rootStore: RootStore) {
    makeAutoObservable(this);
    this.rootStore = rootStore;
  }

  updateCredentials(credentials: UserCredentials) {
    this.credentials = credentials;
  }
}
```
**Registration pattern** — `src/store/root-store.ts` (full file, 10 lines):
```typescript
import { CurrentUserStore } from "./current-user-store";

export class RootStore {
  currentUser: CurrentUserStore;

  constructor() {
    this.currentUser = new CurrentUserStore(this);
  }
}
```
New store adds `sideConversations: SideConversationsStore` the same way. Access via existing `useStore()` hook (`src/contexts/store-context.tsx` lines 17-25, no changes needed there).

**API access from store:** import `grispiAPI` singleton directly (see `src/grispi/client/api.ts` lines 1-17 — exported singleton `export const grispiAPI = new GrispiAPI()`), same as `grispi-context.tsx` does (`import { grispiAPI } from "@/grispi/client/api";`).

**Pipeline to implement (from RESEARCH.md Code Examples #2, adapted to MobX):**
```typescript
async function loadPage(parentKey: string, page: number) {
  const result = await grispiAPI.tickets.advancedSearch(
    { allConditions: [{ fieldKey: "tu.side_conversation_parent", operator: "EQUAL", value: parentKey }], anyConditions: [] },
    { size: 10, page }
  );
  const hydrated = await Promise.allSettled(
    result.content.map((row) => grispiAPI.tickets.getTicket(row.key))
  );
  // map outcome.status === "fulfilled" | "rejected" into rows, dim+silent-retry on reject (D-11)
}
```
**Generation-guard for D-15/Pitfall 6:** tag each `loadPage` invocation with an incrementing counter captured at call time; discard results if a newer generation has started before this one resolves (no direct existing analog in repo — new pattern, document inline).

---

### `src/components/ui/badge.tsx` (component, presentational)

**Analog:** `src/components/ui/button.tsx` (full file, 58 lines) — cva + cn + forwardRef convention is the established local pattern; do NOT use `npx shadcn add badge` (targets Base UI, inconsistent family per RESEARCH.md).

**Imports pattern** (lines 1-5):
```typescript
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
```

**cva variant pattern** (lines 7-35):
```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors ...",
  {
    variants: {
      variant: { default: "...", destructive: "...", outline: "...", secondary: "...", ghost: "...", link: "..." },
      size: { default: "...", sm: "...", lg: "...", icon: "..." },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)
```

**Component + export pattern** (lines 37-57):
```typescript
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```
Adapt directly for `Badge`: `<span>` instead of `<button>`, no `asChild`/`Slot`, variants = `new-reply` | `awaiting-reply` | `closed`. RESEARCH.md Code Examples #6 already contains a ready-to-use draft matching this exact convention — confirm the amber/emerald/slate → state mapping against the mockup before finalizing (Open Question #5, unverified).

---

### `src/components/ui/skeleton.tsx` (component, presentational)

**Analog:** same `button.tsx` styling conventions (cn utility), but structurally trivial — a plain styled `div`, no cva needed (see RESEARCH.md Code Examples #6, second snippet). No forwardRef/variants required.

---

### `src/screens/conversations-list-screen.tsx` (screen component, request-response)

**Analog:** `src/screens/welcome-screen.tsx` (full file, 46 lines) for screen shape/observer wrapping, and `src/screens/loading-screen.tsx` (full file, 35 lines) for the skeleton/loading visual convention.

**Screen shape pattern** — `welcome-screen.tsx` lines 1-46:
```typescript
import { observer } from "mobx-react-lite";

import { LoadingWrapper } from "@/components/loading-wrapper";
import {
  Screen,
  ScreenContent,
  ScreenHeader,
  ScreenTitle,
} from "@/components/ui/screen";
import { useGrispi } from "@/contexts/grispi-context";
import { LoadingScreen } from "./loading-screen";

export const WelcomeScreen = observer(() => {
  const { ticket, loading } = useGrispi();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Screen>
      <ScreenHeader>
        <ScreenTitle>Grispi</ScreenTitle>
      </ScreenHeader>
      <ScreenContent>
        {/* content */}
      </ScreenContent>
    </Screen>
  );
});
```
New screen follows this exact shape: `observer` wrapper, `useStore()` (not `useGrispi()` for data — pull `sideConversations` store), branch on `store.status` (`loading` / `empty` / `error` / `ready`) inside `ScreenContent` rather than a top-level `if (loading)` — per Pattern 3 in RESEARCH.md ("screens stay presentational, branch on store status").

**Screen registration** — `src/app.tsx` (full file, 16 lines):
```typescript
import { GrispiProvider } from "./contexts/grispi-context";
import { StoreProvider } from "./contexts/store-context";
import { WelcomeScreen } from "./screens/welcome-screen";

const App = () => {
  return (
    <StoreProvider>
      <GrispiProvider>
        <WelcomeScreen />
      </GrispiProvider>
    </StoreProvider>
  );
};
```
Swap `WelcomeScreen` for `ConversationsListScreen` — one-line import + JSX swap, no other structural change (no router exists — confirmed, matches RESEARCH.md Pattern 2).

**Reusable primitives already available, no changes needed:**
- `Screen`, `ScreenHeader`, `ScreenTitle`, `ScreenContent` from `src/components/ui/screen.tsx` (full file, 78 lines) — `ScreenHeader`'s `onBack` prop is optional and unused here (no back navigation in Phase 1).
- `Button` from `src/components/ui/button.tsx` for the disabled "+" CTA (D-13) — use `disabled` prop + `title`/`aria-label` for the "Çok yakında" tooltip text.

---

### `src/lib/relative-time.ts`, `src/lib/conversation-status.ts`, `src/lib/last-seen-store.ts`

**No codebase analog** — these are new pure-function utility modules with no prior equivalent in `src/lib/` (currently only `utils.ts` with the `cn()` helper). Follow RESEARCH.md Code Examples #3, #4, #5 verbatim as the starting implementation (already verified this session per RESEARCH.md: `Intl.DateTimeFormat('tr-TR', ...)` output, and the badge-derivation logic tested against D-05/D-06/D-07/D-08). Style convention to match: small named exports, no default export, e.g. `src/lib/utils.ts` lines 1-6:
```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## Shared Patterns

### MobX store shape
**Source:** `src/store/current-user-store.ts` + `src/store/root-store.ts`
**Apply to:** `SideConversationsStore`
```typescript
export class XStore {
  rootStore: RootStore;
  constructor(rootStore: RootStore) {
    makeAutoObservable(this);
    this.rootStore = rootStore;
  }
}
```
Register in `RootStore` constructor the same way `currentUser` is registered.

### cva/cn presentational component convention
**Source:** `src/components/ui/button.tsx`
**Apply to:** `Badge`, `Skeleton`
Never regenerate via current `shadcn` CLI (Base UI-based, inconsistent with existing Radix+cva family per RESEARCH.md Anti-Patterns).

### Screen/observer/branch-on-store-status
**Source:** `src/screens/welcome-screen.tsx`, `src/screens/loading-screen.tsx`, `src/components/ui/screen.tsx`
**Apply to:** `ConversationsListScreen`
`observer(() => { const store = useStore().sideConversations; ... branch on store.status ... })` inside `<Screen><ScreenHeader>...<ScreenContent>...</ScreenContent></Screen>`.

### Typed HTTP errors instead of null-swallowing
**Source:** RESEARCH.md Code Examples #1 (no existing analog — this is a breaking-but-safe rework of `http-handler.ts`)
**Apply to:** `HttpHandler.send`, `Tickets.getTicket`, `Tickets.advancedSearch`, and the two call sites in `grispi-context.tsx` (lines 36-43 and 45-61) that currently assume `getTicket` never throws.

### grispiAPI singleton access
**Source:** `src/grispi/client/api.ts` (`export const grispiAPI = new GrispiAPI();`), consumed in `src/contexts/grispi-context.tsx` line 9 (`import { grispiAPI } from "@/grispi/client/api";`)
**Apply to:** `SideConversationsStore` — import the singleton directly rather than injecting via constructor (matches existing convention, no DI container in this codebase).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/relative-time.ts` | utility | transform | No existing time-formatting utility in repo; net-new domain — use RESEARCH.md Code Examples #4 verbatim as starting point |
| `src/lib/conversation-status.ts` | utility | transform | No existing status/badge-derivation logic; net-new domain — use RESEARCH.md Code Examples #3 verbatim as starting point |
| `src/lib/last-seen-store.ts` | utility | file-I/O | No existing localStorage wrapper in repo; net-new — use RESEARCH.md Code Examples #5 verbatim as starting point |
| `src/store/__tests__/*.test.ts`, `src/grispi/client/__tests__/*.test.ts` | test | — | No existing test files anywhere in `src/` to pattern-match against; RESEARCH.md confirms Jest/`craco test` works out of the box with mockable `global.fetch`, but no local test convention exists yet — first test files in the repo |

## Metadata

**Analog search scope:** `src/` (entire project — 20 source files, no `node_modules` or build output scanned)
**Files scanned:** 20 (all files under `src/`)
**Pattern extraction date:** 2026-07-22
