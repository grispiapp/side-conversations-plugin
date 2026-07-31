# Phase 4: Dosya Ekleri ve Inline Görseller - Pattern Map

**Mapped:** 2026-07-31
**Files analyzed:** 13 (5 new, 8 modified)
**Analogs found:** 13 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/grispi/client/attachments.ts` (new) | service (API client) | file-I/O (multipart upload) | `src/grispi/client/customers.ts` | role-match (constructor-injection shape); `tickets.ts` for doc-comment convention |
| `src/grispi/client/http-handler.ts` (modify — add `sendMultipart`) | utility (HTTP boundary) | file-I/O | itself (`send<T>`) | exact — sibling method, same file |
| `src/store/attachment-upload-store.ts` (new) | store (MobX) | event-driven (per-file lifecycle) | `src/store/active-conversation-store.ts` | exact (generation-guard, deepFreeze envelope, immutable array replace) — `compose-store.ts` for simpler dirty/reset shape |
| `src/screens/components/attachment-chip.tsx` (new) | component | request-response (renders upload lifecycle) | `src/screens/components/confirm-dialog.tsx` (focus/aria) + `badge.tsx` (pill styling) | role-match (composite of two analogs) |
| `src/components/ui/sonner.tsx` (new, shadcn) | provider/component | event-driven (toast queue) | `src/components/ui/badge.tsx` (cva+cn shadcn convention) | role-match (shadcn primitive shape, not toast-specific) |
| `src/lib/attachment-test-helpers.ts` (new, test-only) | utility (test helper) | transform | `src/screens/components/__tests__/rich-text-composer.test.tsx` (clipboardData mock pattern) | role-match |
| `src/grispi/client/tickets.ts` (modify) | service | CRUD | itself | exact |
| `src/types/grispi.type.ts` (modify) | model | transform | itself | exact |
| `src/screens/components/rich-text-composer.tsx` (modify) | component | event-driven (editor + paste/drop) | itself | exact |
| `src/lib/html-sanitizer.ts` (modify) | utility | transform | itself | exact |
| `src/store/compose-store.ts` / `src/store/active-conversation-store.ts` (modify) | store | CRUD (request assembly) | each other | exact |
| `src/query/side-conversation-queries.ts` (modify — `normalizeComment`) | transform (React Query projection) | CRUD | itself | exact |
| `src/screens/components/thread-message.tsx` (modify) | component | request-response (render incoming) | itself | exact |
| `src/components/ui/badge.tsx` (modify — add neutral/file variant) | component (shadcn primitive) | transform | itself | exact |

## Pattern Assignments

### `src/grispi/client/attachments.ts` (new)

**Analog:** `src/grispi/client/customers.ts` (constructor shape + doc-comment style), `src/grispi/client/tickets.ts` (multi-method class with per-method doc-comments citing probe findings)

**Imports pattern** (`customers.ts:1-4`):
```typescript
import { Authentication } from "./authentication";
import { HttpHandler } from "./http-handler";

import { CustomerSearchResponse } from "@/types/grispi.type";
```
Copy this exact two-group import shape (relative sibling imports first, `@/types/grispi.type` second) for `attachments.ts`, importing whatever new `UploadFilesResponse`/`Attachment` types land in `grispi.type.ts`.

**Constructor-injection pattern** (`customers.ts:17-21`, identical in `tickets.ts:14-17`):
```typescript
export class Customers {
  constructor(
    private http: HttpHandler,
    private auth: Authentication
  ) {}
  ...
}
```
Copy verbatim for `Attachments`: `constructor(private http: HttpHandler, private auth: Authentication) {}`.

**Doc-comment style citing probe findings** (`customers.ts:6-16`, `tickets.ts:53-59`):
```typescript
/**
 * `GET /public/v1/customers/search` — absent from Grispi's public OpenAPI
 * spec but CONFIRMED live (Phase 02 Plan 01 Task 1 checkpoint probe; see
 * `02-01-SUMMARY.md` "Probe Findings" A2/A3). ...
 * NOTE: the live endpoint 422s when `searchTerm` is under 3 characters...
 */
```
`attachments.ts`'s class/method doc-comment must follow the same shape: cite the RESEARCH.md Live-Probe Design (P1/P3/P4) checkpoint task instead of a Phase-02 probe, and explicitly flag the still-PROBE-PENDING `public/v1` vs root path uncertainty (RESEARCH.md §Live-Probe Design P1) exactly the way `tickets.ts:53-59`'s comment flags "Body construction... is the caller's responsibility."

**Core method pattern — this method does NOT reuse `this.http.send<T>`** (new territory, no existing exact analog): use `http-handler.ts`'s new `sendMultipart<T>` sibling method (see below), passing only `this.auth.headers` (confirmed to carry solely `tenantId`/`Authorization`, never `Content-Type` — `src/grispi/client/authentication.ts:1-19`):
```typescript
export class Attachments {
  constructor(
    private http: HttpHandler,
    private auth: Authentication
  ) {}

  async upload(file: File, options: { inline?: boolean } = {}) {
    const formData = new FormData();
    formData.append("files", file);
    const suffix = options.inline ? "?inline=true" : "";
    return this.http.sendMultipart<UploadFilesResponse[]>(
      `public/v1/attachments/upload${suffix}`,
      formData,
      this.auth.headers
    );
  }
}
```
(This exact snippet is already vetted in RESEARCH.md Pattern 1 — copy it, do not re-derive.)

**Error handling:** none locally — `sendMultipart` throws `NetworkError`/`HttpError` exactly like `send<T>`; callers (the new attachment store) catch there, mirroring how `active-conversation-store.ts` never catches inside envelope-construction methods but the mutation-runner (wherever `Tickets.createTicket`/`patchTicket` calls are awaited) does.

---

### `src/grispi/client/http-handler.ts` (modify)

**Analog:** itself — `send<T>` (lines 32-50) is the sibling method to copy structurally, with ONE deliberate divergence (never spread `this.headers`).

**Exact region that changes** (append after line 50, before closing class brace):
```typescript
// src/grispi/client/http-handler.ts — new sibling method
export class HttpHandler {
  baseUrl: string = "https://api.grispi.net";
  headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  async send<T>(url: string, options: RequestInit): Promise<T> { /* unchanged */ }

  /**
   * Multipart upload path (Phase 4). Deliberately does NOT spread
   * `this.headers` — that object always carries the default
   * `Content-Type: application/json`, and setting Content-Type to any
   * string (including `undefined`, which `Headers` coerces to the literal
   * string `"undefined"`) breaks the browser's automatic multipart boundary
   * generation. `extraHeaders` should be `Authentication.headers` only
   * (tenantId + Authorization, confirmed to carry no Content-Type key).
   */
  async sendMultipart<T>(
    url: string,
    formData: FormData,
    extraHeaders: Record<string, string>
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/${url}`, {
        method: "POST",
        cache: "no-cache",
        body: formData,
        headers: { ...extraHeaders },
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
**Convention to stay consistent with:** same `NetworkError`/`HttpError` taxonomy (lines 5-24, unchanged), same `cache: "no-cache"` convention as every other client call, same `response.json().catch(() => null)` error-body-parse pattern as `send<T>` line 45.

**Test convention** — `src/grispi/client/__tests__/http-handler.test.ts:1-63` is the exact analog for a new `describe("HttpHandler.sendMultipart", ...)` block: `jest.spyOn(global, "fetch").mockResolvedValue({...} as unknown as Response)` in each `it`, `afterEach(() => jest.restoreAllMocks())`, assert `HttpError`/`NetworkError` instance + fields via try/catch (not `.rejects.toThrow`). Additionally add ONE new assertion this file doesn't currently need: inspect the second argument passed to the mocked `fetch` and assert `headers` does NOT contain a `Content-Type` key (the actual bug this method exists to prevent).

---

### `src/store/attachment-upload-store.ts` (new)

**Analog:** `src/store/active-conversation-store.ts` (generation-guard, deepFreeze, immutable replace, ref-exclusion via `makeAutoObservable`'s second argument) — `src/store/compose-store.ts` for the simpler `isDirty`/`reset()` shape.

**MobX shape to copy** (`active-conversation-store.ts:165-174`):
```typescript
constructor(_rootStore: RootStore) {
  makeAutoObservable<this, "envelopes" | "matchedCanonicalIds">(
    this,
    { envelopes: false, matchedCanonicalIds: false },
    { autoBind: true, deep: false }
  );
}
```
Copy this exact pattern for excluding non-observable fields (RESEARCH.md's "MobX `observable.ref`-less large payload" pitfall explicitly calls out that raw `File` objects/blob URLs must be excluded the same way `envelopes`/`matchedCanonicalIds` are excluded here — e.g. `makeAutoObservable<this, "fileRefs">(this, { fileRefs: false }, { autoBind: true })`).

**Immutable array replacement, never in-place mutation** (`active-conversation-store.ts:329-341`, `353-365`, `397-409` — repeated 3x, copy this exact idiom for chip status transitions):
```typescript
this.overlayRecords = this.overlayRecords.map((record) =>
  record.envelope === envelope
    ? { ...record, accepted: false, message: { ...record.message, status: "pending", errorKind: undefined } }
    : record
);
```
Apply identically for attachment chips: `this.chips = this.chips.map((chip) => chip.id === id ? { ...chip, status: "uploading" } : chip)` — never `chip.status = "uploading"` on a found element.

**Generation-guard debounce** — `compose-store.ts:53` (`submitGeneration`) is the minimal analog: a private incrementing counter compared against a captured snapshot to reject stale async completions. For per-file uploads, each chip's own upload promise IS the guard (no shared generation counter needed since each `File` gets its own async call) — but if a "remove chip mid-upload" cancel-without-`AbortController` semantic is needed, mirror `compose-store.ts`'s pattern: capture a per-chip generation number at upload-start, check it still matches before applying the resolved/rejected result.

**`deepFreeze` on mutation envelopes** (`active-conversation-store.ts:19-27`) — NOT directly reused by the attachment store itself (uploads aren't envelopes), but `attachmentIds`/`inlineImageIds` computed here become fields on `ComposeStore.submit`'s / `ActiveConversationStore.sendReply`'s `request.comment`, which IS `deepFreeze`'d exactly like `body`/`creator` today (`active-conversation-store.ts:204`, `272`) — no special-casing needed in the freeze/retry path, per RESEARCH.md Integration Pitfall #4.

**Error handling / retry (D-07)** — model this on `mutationFailed`/`mutationStarted` (`active-conversation-store.ts:325-375`): a chip's status enum should mirror `MessageVM.status: "pending" | "sent" | "failed"` (here: `"uploading" | "done" | "failed"`) plus an `errorKind` field, and a `retryUpload(chipId)` action structurally mirroring `retryLifecycle()` (`active-conversation-store.ts:320-323`).

**Test convention** — `src/store/__tests__/active-conversation-store.test.ts:1-58` is the analog: no RTL, plain `new ActiveConversationStore(new RootStore())` (or equivalent), helper factory functions (`createRequest`, `canonical`, `startCreate`) at file top, `it()` blocks operate directly on store instance + `store.someGetter` assertions.

---

### `src/screens/components/attachment-chip.tsx` (new)

**Analog:** `src/components/ui/badge.tsx` for pill styling convention, `src/screens/components/confirm-dialog.tsx` for focus/aria wiring on the interactive (remove/retry) affordances, `rich-text-composer.tsx`'s `Button size="toolbar"` usage for the remove icon-button.

**Badge/pill styling convention to extend, not replace** (`badge.tsx:10-22`):
```typescript
const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        "new-reply": "bg-amber-100 text-amber-800",
        "awaiting-reply": "bg-emerald-100 text-emerald-800",
        closed: "bg-slate-100 text-slate-600",
      },
    },
    defaultVariants: { variant: "closed" },
  }
);
```
Add a new neutral/file variant (e.g. `"file": "bg-slate-50 text-slate-700 border border-slate-200"`) to this SAME `cva` call rather than forking a parallel chip-specific variant system — `attachment-chip.tsx` should render `<Badge variant="file">` (or similar) as its outer shell, matching how every other status pill in the app is a `Badge`.

**Toolbar-size icon-button convention** (`rich-text-composer.tsx:653-690`, the toolbar `Button` usage) — copy `size="toolbar"` (`h-8 w-8`, `button.tsx:31`) for the chip's remove (×) button, with `aria-label` in Turkish following the same imperative-Turkish-noun-phrase style as existing labels (`"Bağlantıyı kaldır"`, `"Gönderilemedi. Tekrar dene"`) — e.g. `aria-label={`${filename} ekini kaldır`}`.

**Failed-state retry affordance convention** (`thread-message.tsx:138-154`):
```tsx
{message.status === "failed" && (
  <div role="alert">
    <button
      type="button"
      aria-label="Gönderilemedi. Tekrar dene"
      className="mt-2 flex min-h-9 items-center gap-1 rounded-md text-xs text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onClick={() => onRetry(message.id)}
    >
      <ExclamationTriangleIcon className="size-3 shrink-0" />
      <span>Gönderilemedi · Tekrar dene</span>
    </button>
  </div>
)}
```
Copy this exact `role="alert"` + `ExclamationTriangleIcon` + `min-h-9` (44px-ish touch target convention) + Turkish "Tekrar dene" copy for the chip's own failed state (D-07). This is the project's home error-display pattern that D-12's toast EXTENDS, not replaces — per-chip failure stays inline (`role="alert"` on the chip), while a toast additionally surfaces at submit-time/rejection-time (D-11/D-12) for batch rejections.

**Pending/uploading indeterminate spinner convention** (`thread-message.tsx:126-136`):
```tsx
{message.status === "pending" && (
  <div role="status" aria-live="polite" aria-label="Gönderiliyor" className="mt-2 flex min-h-8 items-center gap-1 text-xs text-muted-foreground">
    <ReloadIcon className="size-3 animate-spin" />
    <span>Gönderiliyor</span>
  </div>
)}
```
Copy `ReloadIcon` + `animate-spin` + `role="status"` + `aria-live="polite"` for the chip's uploading state (UI-SPEC's "indeterminate spinner" decision maps directly onto this existing icon).

---

### `src/components/ui/sonner.tsx` (new, via `npx shadcn add sonner`)

**Analog:** `src/components/ui/badge.tsx` for the project's shadcn-primitive convention (cva+cn, `React.FC` with typed props, no "use client" retained, no unnecessary framework-specific deps).

**What to copy from `badge.tsx`:** the plain functional-component export shape (`export const X: React.FC<XProps> = ({ className, ...props }) => ...`), no default export, `cn()` from `@/lib/utils` for className composition.

**What to change from the shadcn CLI output (RESEARCH.md §sonner Toast Under CRA):** strip `next-themes` entirely — this project has exactly one theme (`CLAUDE.md`: "her zaman açık tema"). Final shape:
```tsx
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = (props: ToasterProps) => (
  <Sonner theme="light" className="toaster group" toastOptions={{ /* UI-SPEC classnames */ }} {...props} />
);

export { Toaster };
```
Mount exactly once at app root (not per-screen) — find the root render tree entry point (likely `src/App.tsx` or equivalent) the same way `<Screen>`/root providers are already mounted once.

---

### `src/lib/attachment-test-helpers.ts` (new, test-only)

**Analog:** the clipboardData mock construction already embedded inline in `rich-text-composer.test.tsx:318-330`:
```typescript
const paste = new Event("paste", { bubbles: true, cancelable: true });
Object.defineProperty(paste, "clipboardData", {
  value: {
    getData: (type: string) =>
      type === "text/html" ? "<div>...</div>" : "Pasted",
  },
});
act(() => editor().dispatchEvent(paste));
```
**What to copy:** the `Object.defineProperty(event, "clipboardData", { value: {...} })` idiom for faking read-only DOM event properties under jsdom (jsdom's real `ClipboardEvent`/`DataTransfer` don't support constructing arbitrary `files`).

**What to add (new territory — extract into a shared helper since Phase 4 needs File/DataTransfer construction in at least 3 test files: rich-text-composer paste tests, attachment-upload-store tests, dropzone/drop tests):**
```typescript
// src/lib/attachment-test-helpers.ts
export function makeTestFile(name: string, size: number, type: string): File {
  return new File([new Uint8Array(size)], name, { type });
}

export function makeClipboardPasteEvent(files: File[], html?: string): Event {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: { files, getData: (t: string) => (t === "text/html" ? (html ?? "") : "") },
  });
  return event;
}

export function makeDropEvent(files: File[]): Event {
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { files } });
  return event;
}
```
Place under `src/lib/` (not `__tests__/`) since it's imported BY multiple `__tests__/` directories, mirroring how `src/lib/html-sanitizer.ts` is a shared non-test utility imported by both component and store tests — but this file is test-only, so name it distinctly (`attachment-test-helpers.ts`, not `attachment-validation.ts` which IS production code per RESEARCH.md §Code Examples) and do not import it from any non-test source file.

---

### `src/grispi/client/tickets.ts` (modify)

**Exact region that changes** — no new methods needed, only the request TYPE gains a field (see `grispi.type.ts` below); `createTicket`/`patchTicket` bodies (`tickets.ts:61-68`, `76-86`) are unchanged since they already do `JSON.stringify(body)` generically. **Convention to stay consistent with:** doc-comments citing probe/checkpoint findings (`tickets.ts:53-59`) — if the phase's checkpoint probe (P2) reveals `public/v1` needs a different field name than `attachmentIds`, update this file's doc-comment the same way `tickets.ts:70-74`'s comment explains the PATCH-vs-GET response-shape divergence.

---

### `src/types/grispi.type.ts` (modify)

**Exact region that changes** — export the currently-unexported `Attachment` interface (line 30, `interface Attachment` → `export interface Attachment`), no shape change needed except optionally adding `inline?: boolean` per RESEARCH.md Integration Pitfall #4:
```typescript
// grispi.type.ts:30-41 — change `interface` to `export interface`, keep shape,
// add optional field per probe P3 outcome:
export interface Attachment {
  id: number;
  filename: string;
  objectKey: string;
  objectThumbKey: string;
  bucket: string;
  mimeType: string;
  size: number;
  userId: number;
  objectThumbUrl: string;
  objectUrl: string;
  inline?: boolean; // NEW — probe-pending, see RESEARCH.md P3
}
```
Add `attachmentIds?: number[]` to `CreateTicketRequest.comment` (lines 219-226) and `ReplyTicketPatchRequest.comment` (lines 234-240), following the EXACT doc-comment convention already on those interfaces (lines 207-218, 228-233) — cite the RESEARCH.md checkpoint probe (P2) the same way the existing comment cites "Phase 02 Plan 01 Task 1 checkpoint probe":
```typescript
/**
 * ...(existing comment)...
 * `attachmentIds` (Phase 4, PROBE-PENDING until Plan 04-01's checkpoint P2
 * confirms `public/v1` accepts it inside `comment` the way grispi-ui's `/v2`
 * family does) — omit the field entirely when empty, never send `[]`
 * (RESEARCH.md "Assuming attachmentIds field must always be present"
 * pitfall).
 */
export interface CreateTicketRequest {
  comment: {
    body: string;
    publicVisible: true;
    creator: [{ key: "us.email"; value: string }];
    attachmentIds?: number[];
  };
  fields: Array<{ key: string; value: string }>;
}
```
Also add a new `UploadFilesResponse` interface (no existing analog — model its doc-comment on the `CustomerSearchResponse`/`AdvancedSearchResponse` pattern at lines 288-335, i.e. cite the settled contract doc rather than a fresh probe since this shape is ALREADY confirmed per `.planning/research/attachment-upload-contract.md`):
```typescript
/**
 * `POST /attachments/upload` response element — CONFIRMED against grispi-ui's
 * reference implementation (`.planning/research/attachment-upload-contract.md`
 * §1); `public/v1` prefix/path itself remains PROBE-PENDING (see P1).
 */
export interface UploadFilesResponse {
  id: number;
  objectUrl: string;
  filename?: string;
  mimeType?: string;
  size?: number;
}
```

---

### `src/screens/components/rich-text-composer.tsx` (modify)

**Region 1 — `handlePaste` fix** (lines 277-290), exact change per RESEARCH.md Integration Pitfall #1:
```typescript
// BEFORE (lines 277-290):
handlePaste: (_view, event) => {
  if (disabledRef.current) return true;
  const clipboardHtml = event.clipboardData?.getData("text/html");
  const clipboardText = event.clipboardData?.getData("text/plain") || "";
  const safePaste = sanitizeUntrustedDraftHtml(clipboardHtml || plainTextHtml(clipboardText));
  if (!safePaste) return true;
  editorRef.current?.chain().focus().insertContent(safePaste).run();
  return true;   // ← always true, blocks FileHandler
},

// AFTER:
handlePaste: (_view, event) => {
  if (disabledRef.current) return true;
  if (event.clipboardData?.files.length) return false; // let FileHandler run
  const clipboardHtml = event.clipboardData?.getData("text/html");
  const clipboardText = event.clipboardData?.getData("text/plain") || "";
  const safePaste = sanitizeUntrustedDraftHtml(clipboardHtml || plainTextHtml(clipboardText));
  if (!safePaste) return true;
  editorRef.current?.chain().focus().insertContent(safePaste).run();
  return true;
},
```
Convention to preserve: the `disabledRef.current`-first-check idiom used everywhere else in this file (`handleKeyDown` line 266, `submitCurrentContent` line 462).

**Region 2 — new `handleDrop` guard** (add alongside `handlePaste`, same `editorProps` object, per Integration Pitfall #6):
```typescript
handleDrop: (_view, event) => {
  if (event.dataTransfer?.files.length) return true; // always "handled" — attachments only, never inline
  return false;
},
```

**Region 3 — new extensions** (add to the `extensions: [...]` array, lines 235-254, alongside `StarterKit`/`Link`, same `.configure()` call convention):
```typescript
import FileHandler from "@tiptap/extension-file-handler";
import Image from "@tiptap/extension-image";
// ...
extensions: [
  StarterKit.configure({ /* unchanged */ }),
  Link.configure({ /* unchanged */ }),
  Image.configure({
    HTMLAttributes: { class: "rich-text-content-image" },
    allowBase64: false,
  }),
  FileHandler.configure({
    allowedMimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
    onPaste: (currentEditor, files, htmlContent) => {
      if (htmlContent) return;
      files.forEach((file) => attachmentStoreRef.current.startInlinePaste(currentEditor, file));
    },
  }),
],
```
**Ref-mirror convention (mandatory — Integration Pitfall #5):** `useEditor(..., [])` has an empty deps array, so any store reference used inside `editorProps`/extension callbacks must follow the EXACT ref-mirror pattern already established for `onChangeRef`/`onSubmitRef`/`disabledRef` (lines 208-210, 227-229):
```typescript
const attachmentStoreRef = useRef(attachmentStore);
attachmentStoreRef.current = attachmentStore;
```
Never add `attachmentStore` to the `useEditor` deps array.

**Region 4 — chip-list panel slot (D-01)** — insert into the EXISTING panel container at line 515 (`<div className="border-t border-border bg-card">`), following the exact same conditional-render-block idiom already used for `headingMenuOpen` (lines 516-553) and `linkEditorOpen` (lines 555-629): a new conditionally-rendered block, same container, same `border-b border-border bg-muted/20` framing convention, rendered ABOVE the toolbar row (line 631).

**Region 5 — attach toolbar button (D-04)** — add one more entry to `TOOLBAR_ACTIONS` array (lines 67-118) OR a standalone `Button` adjacent to it inside the `role="toolbar"` div (lines 632-700), using the exact same `size="toolbar"`, `variant="ghost"`, Turkish `aria-label`/`title` convention as every existing toolbar button (lines 653-690).

**Region 6 — debounced sanitize on `onUpdate`** (lines 292-298) — per Integration Pitfall #3, wrap the `sanitizeHtml(currentEditor.getHTML())` call in a ~300ms debounce once inline images can appear (ASSUMED value from RESEARCH.md — confirm empirically before locking). No existing debounce analog in this file; `side-conversation-queries.ts` uses `CUSTOMER_DEBOUNCE_MS = 300` (line ~48) as a project-wide precedent for the debounce constant naming/value convention — reuse `300` unless empirical testing says otherwise.

**Test convention:** `src/screens/components/__tests__/rich-text-composer.test.tsx:1-79` (helper setup: `render()`, `editor()`, `button()`, `dispatchKey()`) is the exact analog for new attach/paste/drop tests — reuse `editor()`/`button()` helpers, add a new `chip(label)` query helper following the same `container.querySelector` + throw-if-null idiom. The existing paste test at line 318 is UNAFFECTED by the `handlePaste` fix (its mocked `clipboardData` has no `.files` property, so `event.clipboardData?.files.length` is `undefined` → falsy → falls through unchanged) — a NEW test must add `files: []`/`files: [file]` to the mock, using the new `attachment-test-helpers.ts`.

---

### `src/lib/html-sanitizer.ts` (modify)

**Exact region that changes** — add a second exported policy alongside the untouched `SANITIZE_CONFIG`/`sanitizeHtml` (lines 44-53, 132-147), per Integration Pitfall #3:
```typescript
// NEW — authored-content policy, permits img+src for https:// only.
// SANITIZE_CONFIG/sanitizeHtml (lines 44-53/132-147) stay UNTOUCHED —
// used for ALL incoming/remote HTML (D-21).
const AUTHORED_ALLOWED_TAGS = [...ALLOWED_TAGS, "img"];
const AUTHORED_SANITIZE_CONFIG: Config = {
  ...SANITIZE_CONFIG,
  ALLOWED_TAGS: AUTHORED_ALLOWED_TAGS,
  ALLOWED_ATTR: ["href", "src", "alt"],
  FORBID_TAGS: DROP_WITH_CONTENT.filter((tag) => tag !== "img"),
  FORBID_CONTENTS: DROP_WITH_CONTENT.filter((tag) => tag !== "img"),
};

export function sanitizeAuthoredHtml(input: string): string {
  // same DOMParser/DOMPurify/escapeHtml-fallback structure as sanitizeHtml
  // (lines 132-147), but using AUTHORED_SANITIZE_CONFIG. No data: URI
  // allowance needed — ALLOWED_URI_REGEXP already passes https://.
}
```
**Convention to copy exactly:** the `parseBody` → `DOMPurify.sanitize` → re-`parseBody` → per-element normalize → `.innerHTML` structure of `sanitizeHtml` (lines 132-147) — `sanitizeAuthoredHtml` should be a near-identical function body, differing only in which `Config` object it passes to `DOMPurify.sanitize`. `svg` MUST remain in `FORBID_TAGS`/`FORBID_CONTENTS` for BOTH policies (D-10) — do not filter `"svg"` out of `DROP_WITH_CONTENT` the way `"img"` is filtered out.

**No changes needed:** `splitQuotedHtml`, `sanitizeUntrustedDraftHtml`, `splitGeneratedReplyHtml` (lines 153-232) are untouched — they all call the existing `sanitizeHtml`, and per D-21 the incoming/draft-restore policy must stay exactly as strict as it is today.

**Test convention:** `src/lib/__tests__/html-sanitizer.test.ts` — add a parallel `describe("sanitizeAuthoredHtml", ...)` block mirroring whatever `describe("sanitizeHtml", ...)` structure already exists; explicitly assert `svg` stays forbidden in BOTH policies and that `data:`/`javascript:` `src` values are stripped even in the authored policy.

---

### `src/store/compose-store.ts` / `src/store/active-conversation-store.ts` (modify)

**Region — `ComposeStore.isDirty`** (lines 115-120), exact extension point for D-18:
```typescript
// BEFORE:
get isDirty(): boolean {
  if (this.query.trim() !== "") return true;
  if (this.recipientEmail.trim() !== "") return true;
  if (this.subject !== this.initialSubject) return true;
  return htmlToText(sanitizeHtml(this.message)) !== "";
}
// AFTER — one new line, same early-return chain convention:
get isDirty(): boolean {
  if (this.query.trim() !== "") return true;
  if (this.recipientEmail.trim() !== "") return true;
  if (this.subject !== this.initialSubject) return true;
  if (this.rootStore.attachmentUpload.hasAttachmentsForSession(...)) return true; // NEW
  return htmlToText(sanitizeHtml(this.message)) !== "";
}
```
Copy the exact early-return-chain style (not a boolean accumulator).

**Region — `ComposeStore.submit` request construction** (lines 179-193) and `ActiveConversationStore.sendReply` request construction (lines 264-270) — both gain conditional `attachmentIds` spreading, per the RESEARCH.md pitfall "never send `[]`":
```typescript
const request: CreateTicketRequest = {
  comment: {
    body: safeBody,
    publicVisible: true,
    creator: [{ key: "us.email", value: agentEmail ?? "" }],
    ...(attachmentIds.length ? { attachmentIds } : {}),
  },
  fields: [ /* unchanged */ ],
};
```
**Convention to preserve:** `ComposeStore` never reads React context itself — attachment ids must be computed by the CALLER (same as `agentEmail`/`parentKey` today, per the doc-comment at `compose-store.ts:126-141`) and passed as a `submit(...)` parameter, not read from a global. `ActiveConversationStore.startNew`/`sendReply` themselves stay pure envelope-builders — no new async logic inside them; the D-16 garbage-collection pass (scanning final body HTML for surviving `objectUrl`s) happens in the CALLER before `request` is built, mirroring how `sanitizeHtml(this.message)` already happens in `ComposeStore.submit` before `request` is built (line 161).

**`deepFreeze`/retry:** no changes needed to `deepFreeze` (lines 19-27), `mutationStarted`/`mutationFailed`/`mutationAccepted`, or `getRetryEnvelope` — per Integration Pitfall #4, `attachmentIds` becomes "just another frozen field," and retry already replays the identical frozen `request`.

---

### `src/query/side-conversation-queries.ts` (modify — `normalizeComment`)

**Exact region that changes** (lines 411-435):
```typescript
// BEFORE:
function normalizeComment(
  comment: Comment,
  publicContext: readonly QuotedContextPart[]
): MessageVM {
  const sanitized = sanitizeHtml(comment.body ?? "");
  const direction = comment.creator?.role?.authority === "ROLE_END_USER" ? "incoming" : "own";
  const quoted = direction === "own" && comment.publicVisible
    ? splitGeneratedReplyHtml(sanitized, publicContext)
    : splitQuotedHtml(sanitized);

  return {
    id: `comment-${comment.id}`,
    direction,
    body: sanitized,
    authoredBodyHtml: quoted.bodyHtml,
    status: "sent",
    createdAt: comment.createdAt,
    senderName: comment.creator?.fullName || undefined,
    senderEmail: comment.creator?.email || undefined,
    internal: !comment.publicVisible,
    quotedHtml: quoted.quotedHtml,
  };
}

// AFTER — ONE new field, no filtering (D-22):
return {
  id: `comment-${comment.id}`,
  direction,
  body: sanitized,
  authoredBodyHtml: quoted.bodyHtml,
  status: "sent",
  createdAt: comment.createdAt,
  senderName: comment.creator?.fullName || undefined,
  senderEmail: comment.creator?.email || undefined,
  internal: !comment.publicVisible,
  quotedHtml: quoted.quotedHtml,
  attachments: comment.attachments?.length ? comment.attachments : undefined,
};
```
**Convention to preserve exactly:** the `field?.length ? field : undefined` idiom already used elsewhere in this function (`senderName: comment.creator?.fullName || undefined`) — do NOT add `.filter((a) => !a.inline)` anywhere (D-22's entire point).

**Companion change** — `MessageVM` interface in `active-conversation-store.ts` (lines 29-41) gains `attachments?: Attachment[];`, following the exact optional-field style already used for `errorKind?`/`senderName?`/`authoredBodyHtml?` on that same interface. Import `Attachment` from `@/types/grispi.type` once it's exported.

---

### `src/screens/components/thread-message.tsx` (modify)

**Region — new render block** (insert after the `bodyHtml` `dangerouslySetInnerHTML` block, lines 101-104, and before the `quotedHtml` block, line 106) — no existing exact analog for MIME-branching render inside this file, but the STRUCTURAL convention to copy is the `message.status === "pending"`/`"failed"` conditional-block pattern (lines 126-154): a guarded `{message.attachments?.length ? (...) : null}` block using the same `cn()` + Tailwind utility class conventions, same `role`/`aria-label` discipline.

```tsx
{message.attachments && message.attachments.length > 0 && (
  <div className="mt-2 flex flex-col gap-1.5">
    {message.attachments.map((attachment) => (
      <a
        key={attachment.id}
        href={attachment.objectUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-9 items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs text-foreground hover:bg-accent"
        aria-label={`${attachment.filename} — yeni sekmede aç`}
      >
        {/* MIME-branch: image thumbnail / file icon per D-19 (grispi-ui reference) */}
        <span className="truncate">{attachment.filename}</span>
      </a>
    ))}
  </div>
)}
```
**Convention to copy exactly:** `target="_blank"` + `rel="noopener noreferrer"` — the SAME anchor-hardening pattern already applied to sanitized authored links (`html-sanitizer.ts:118-121`, `normalizeAnchor`) and to the composer's own `Link.configure({ HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } })` (`rich-text-composer.tsx:248-250`) — D-20's "new tab, no auth header" requirement is just a plain anchor, no `window.open()` wrapper needed unless click-tracking is required.

**No change to `sanitizeHtml`/`bodyHtml` rendering** (lines 61-63, 101-104) — confirms D-21 requires zero changes to the existing `dangerouslySetInnerHTML` path; attachments render in an entirely separate block, never inside `bodyHtml`.

**Test convention** — `src/screens/components/__tests__/thread-components.test.tsx` is the analog file (already covers `ThreadMessage`); add cases asserting an attachment with `inline: true` STILL renders (regression guard for D-22).

---

### `src/components/ui/badge.tsx` (modify)

**Exact region that changes** (lines 10-22) — add one variant key to the existing `cva` variants map, per the `attachment-chip.tsx` section above. No structural change to the component body (lines 29-33) or `BadgeProps` (lines 24-27).

---

## Shared Patterns

### MobX store shape (applies to `attachment-upload-store.ts`)
**Source:** `src/store/active-conversation-store.ts:19-27` (`deepFreeze`), `:165-174` (`makeAutoObservable` exclusion), `:329-341` (immutable array replace)
**Apply to:** the new attachment upload store — same generation-guard/immutability/ref-exclusion discipline, no exceptions.

### API client shape (applies to `attachments.ts`)
**Source:** `src/grispi/client/customers.ts:17-21`, `src/grispi/client/tickets.ts:53-59`
**Apply to:** `Attachments` class — constructor injection of `HttpHandler`+`Authentication`, doc-comments citing probe/checkpoint findings, `this.http.send<T>(...)`/`this.http.sendMultipart<T>(...)` call convention (never construct `fetch` directly outside `HttpHandler`).

### Error handling (applies to all new async code)
**Source:** `src/grispi/client/http-handler.ts:5-24` (`NetworkError`/`HttpError`), `src/screens/components/thread-message.tsx:138-154` (inline `role="alert"` + retry), plus NEW `sonner` toast (D-12) for batch-level rejection summaries
**Apply to:** attachment upload failures use `HttpError`/`NetworkError` from `http-handler.ts` unchanged; per-chip UI failure uses the `role="alert"` + retry-button pattern (inline, not toast); toast is reserved for D-11 batch-rejection summaries and non-retryable inline-paste failures — the two mechanisms are complementary, not competing.

### Turkish aria-label / copy convention (applies to all new UI)
**Source:** throughout `rich-text-composer.tsx` (`"Bağlantıyı kaldır"`, `"Başlık düzeyi"`, `"Metin biçimlendirme"`), `thread-message.tsx` (`"Gönderilemedi. Tekrar dene"`, `"Önceki e-postayı göster"`)
**Apply to:** all new labels — imperative or noun-phrase Turkish, no English fallback text, action-describing (`"X ekini kaldır"`, `"X — yeni sekmede aç"`), matches UI-SPEC's Turkish copy for rejection messages (e.g. `"rapor.zip — 12MB, sınır 10MB"`).

### Test conventions (applies to all new tests)
**Source:** `src/screens/components/__tests__/rich-text-composer.test.tsx:1-79` (component: raw `react-dom/client` `createRoot`+`act()`, no RTL), `src/grispi/client/__tests__/http-handler.test.ts:1-63` (client: `jest.spyOn(global, "fetch")`), `src/store/__tests__/active-conversation-store.test.ts:1-58` (store: plain instantiation + helper factories)
**Apply to:** every new test file in this phase. NO `@testing-library/react` anywhere. File placement: co-located `__tests__/` sibling directory, `*.test.ts`/`*.test.tsx` naming matching the source file name (`attachments.test.ts`, `attachment-upload-store.test.ts`, `attachment-chip.test.tsx`). New shared test-only DOM-event-faking helpers go in `src/lib/attachment-test-helpers.ts` (see above), imported by multiple `__tests__/` directories.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/attachment-validation.ts` (new, pure function per RESEARCH.md §Code Examples) | utility | transform | No prior pure-validation-function file exists in `src/lib/`; closest sibling (`src/lib/side-conversation.ts` for `isValidEmail`) is a good STYLE analog (small named exports, no class) but not a role/data-flow match — RESEARCH.md's own code example (already fully written, `validateAttachmentBatch`) should be used directly rather than re-deriving. |
| `attachment-chip.tsx`'s MIME-branching visual logic (image thumb / PDF / video / generic file icon, D-19) | component (sub-concern) | transform | No existing codebase file distinguishes MIME types for rendering — RESEARCH.md explicitly directs the planner to the EXTERNAL `grispi-ui` reference (`~/Code/grispiapp/grispi-ui/.../DefaultContent.tsx`) as the pattern source for this one sub-concern, not an in-repo analog. |

## Metadata

**Analog search scope:** `src/grispi/client/`, `src/store/`, `src/screens/components/`, `src/components/ui/`, `src/lib/`, `src/query/`, `src/types/`, plus all `__tests__/` directories under those.
**Files scanned:** 21 source files read in full or via targeted grep/sed excerpts; 4 test files inspected for convention (`http-handler.test.ts`, `active-conversation-store.test.ts`, `rich-text-composer.test.tsx`).
**Pattern extraction date:** 2026-07-31
