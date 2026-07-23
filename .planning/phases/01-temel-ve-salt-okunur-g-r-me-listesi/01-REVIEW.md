---
phase: 01-temel-ve-salt-okunur-g-r-me-listesi
reviewed: 2026-07-23T11:22:12Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - src/app.tsx
  - src/components/dev-ticket-switcher.tsx
  - src/components/ui/badge.tsx
  - src/components/ui/skeleton.tsx
  - src/contexts/grispi-context.tsx
  - src/grispi/client/api.ts
  - src/grispi/client/http-handler.ts
  - src/grispi/client/tickets.ts
  - src/grispi/client/users.ts
  - src/lib/__tests__/conversation-status.test.ts
  - src/lib/__tests__/html-to-text.test.ts
  - src/lib/__tests__/last-seen-store.test.ts
  - src/lib/__tests__/standalone-dev.test.ts
  - src/lib/conversation-status.ts
  - src/lib/html-to-text.ts
  - src/lib/last-seen-store.ts
  - src/lib/relative-time.ts
  - src/lib/side-conversation.ts
  - src/lib/standalone-dev.ts
  - src/screens/components/conversation-row.tsx
  - src/screens/components/empty-state.tsx
  - src/screens/components/error-card.tsx
  - src/screens/components/list-footer.tsx
  - src/screens/conversations-list-screen.tsx
  - src/store/__tests__/side-conversations-store.test.ts
  - src/store/root-store.ts
  - src/store/side-conversations-store.ts
  - src/types/grispi.type.ts
findings:
  critical: 1
  warning: 6
  info: 6
  total: 13
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-07-23T11:22:12Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

Reviewed the Phase 1 read-only side-conversations list: SDK/standalone bootstrap context, the two-tier advancedSearch→getTicket store pipeline, badge derivation, HTML-to-text summary extraction, pagination, and the presentational components plus their tests. Verified independently: `npx tsc --noEmit` is clean and all 45 tests pass under `craco test`.

The security posture is solid for this phase: token is held in memory only and never logged, `encodeURIComponent` is applied to all path parameters, comment HTML is reduced to text and rendered exclusively through React text interpolation, `HttpError.body` is never surfaced to the user, and the standalone dev mode is double-gated (`NODE_ENV === "development"` + uncommitted env token, which is covered by `.gitignore`).

The main defect is in the plugin-mode bootstrap error path: a failed `_init()` or a failed initial `getTicket` leaves the panel permanently stuck on a loading state with no error card and no retry — the CORE-03 layered-error experience only covers the store's search path, not initialization. The store also has several robustness gaps around pagination failure, page-append dedupe, cross-page retry bookkeeping, and permanent negative caching of failed user lookups.

Out-of-scope observation (file not in the changed set, noted for a future pass): `src/contexts/store-context.tsx` constructs `new RootStore()` directly in the render body without `useState`/`useRef`. It is stable today only because `App` never re-renders; under `React.StrictMode` (enabled in `src/index.tsx`) the double render already creates two stores per mount, and any future re-render of `StoreProvider` would silently reset all list state.

## Critical Issues

### CR-01: Plugin-mode init failure leaves the panel permanently stuck in a loading state with no error UI and no retry

**File:** `src/contexts/grispi-context.tsx:159-201` (interacts with `src/screens/conversations-list-screen.tsx:23-47`)
**Issue:** Two unrecoverable hang paths exist in the production (in-iframe) bootstrap:

1. `plugin._init().then(...)` at line 159 has no `.catch`. If `_init()` rejects (SDK handshake failure), `loading` stays `true` forever → the rocket `LoadingScreen` never goes away, plus an unhandled promise rejection.
2. If `_init()` resolves but the initial `grispiAPI.tickets.getTicket(bundle.context.ticketKey)` at line 168 fails (transient network blip, 401 on an expired token), the catch block only logs — `setTicket` is never called. `ticket` stays `null`, so the list screen's `ticket?.key` effect never fires `store.load()`, and `store.status` remains at its constructor default `"loading"` → the user sees three skeleton rows indefinitely, with no `ErrorCard` and no way to retry (the retry handler itself is `ticket?.key && store.load(...)`, a no-op with a null ticket).

The standalone path does not have this problem precisely because `switchTicket` sets a provisional `{ key }` ticket before fetching details, which triggers `store.load()` regardless of hydration outcome. The plugin init path skips that mechanism, so CORE-03's layered error handling never engages for the most likely real-world failure moment (panel open).
**Fix:**
```ts
// 1. Route init through the same shared path standalone uses — the
// provisional ticket makes store.load() run, and store errors surface
// via the CORE-03 ErrorCard:
plugin._init().then(async (bundle: GrispiBundle) => {
  grispiAPI.authentication.setTenantId(bundle.context.tenantId);
  grispiAPI.authentication.setToken(bundle.context.token);
  setSettings(bundle.settings);
  setLoading(false);
  void switchTicket(bundle.context.ticketKey);
}).catch((err: unknown) => {
  console.error("grispi-context", "_init failed", err);
  setLoading(false); // fall through to a non-loading state instead of hanging
});
```

## Warnings

### WR-01: `loadMore()` has no error handling — a failed page fetch surfaces as an unhandled promise rejection

**File:** `src/store/side-conversations-store.ts:309-370` (invoked from `src/screens/components/list-footer.tsx:27` via `conversations-list-screen.tsx:57`)
**Issue:** `loadMore()` wraps its body in `try { … } finally { … }` with no `catch`. If `advancedSearch` (or anything before the `allSettled`) rejects, the rejection propagates out of `onLoadMore={() => store.loadMore()}` as an unhandled promise rejection. The spinner stops (finally resets `loadingMore`) but the user gets zero feedback that the page failed to load — the button just silently snaps back.
**Fix:**
```ts
} catch (err) {
  if (gen !== this.generation) return;
  console.error("side-conversations-store", "loadMore failed", err);
  // hasMore stays true → the button remains as an implicit retry affordance
} finally {
  ...
}
```

### WR-02: Page append does not dedupe by key — shifting live data can produce duplicate rows and duplicate React keys

**File:** `src/store/side-conversations-store.ts:356`
**Issue:** `this.rows = sortConversations([...this.rows, ...newRows])` blindly concatenates. If the backend result set shifts between page 0 and page 1 fetches (a new side ticket created/closed in between — entirely plausible with a hard `size ≤ 10` page), a key from page 0 can be re-delivered on page 1. The list then renders the same conversation twice, and `<ConversationRow key={row.key}>` gets duplicate React keys (undefined reconciliation behavior + console error).
**Fix:**
```ts
const byKey = new Map(this.rows.map((r) => [r.key, r]));
for (const row of newRows) byKey.set(row.key, row); // newer data wins
this.rows = sortConversations([...byKey.values()]);
```

### WR-03: After `loadMore`, `retryFailedHydrations` refetches old failed rows but throws their successful results away

**File:** `src/store/side-conversations-store.ts:378-410` (called at 361)
**Issue:** `failedKeys` is built from **all** of `this.rows` (any page), but the `summariesByKey` argument passed from `loadMore` contains only the *current* page's summaries. For a row that failed hydration on an earlier page and stayed dimmed, the method still issues a fresh `getTicket` call (network cost), then hits `if (!summary || …) return;` at line 400 and discards a *successful* hydration result. Net effect: wasted API calls on every subsequent `loadMore`, and a row that could have been healed stays permanently dimmed.
**Fix:** Either restrict the retry to keys the caller owns:
```ts
const failedKeys = this.rows
  .filter((row) => row.hydrationFailed && summariesByKey.has(row.key))
  .map((row) => row.key)
  .slice(0, PAGE_SIZE);
```
or keep a cumulative `Map<string, SideTicketSummary>` on the store so older rows can actually be upgraded.

### WR-04: Transient `getUser` failures are negatively cached forever — the "—" placeholder can never self-heal

**File:** `src/store/side-conversations-store.ts:455-465`
**Issue:** `fetchUserEmail` caches the promise unconditionally, including one that resolved to `null` because the request *failed* (`.catch(() => null)`). `userEmailCache` is never evicted for the store's lifetime and survives ticket switches. One network blip during enrichment means that requester's email renders as "—" on every subsequent load, refresh, and ticket revisit, even though the endpoint works fine — directly undermining the LIST-01 gap closure this code exists for.
**Fix:**
```ts
private fetchUserEmail(userId: number): Promise<string | null> {
  let cached = this.userEmailCache.get(userId);
  if (!cached) {
    cached = grispiAPI.users
      .getUser(userId)
      .then((user) => user?.primaryEmail ?? null)
      .catch(() => {
        this.userEmailCache.delete(userId); // don't cache failures
        return null;
      });
    this.userEmailCache.set(userId, cached);
  }
  return cached;
}
```
(Optionally also drop the cache entry when a success resolves to `primaryEmail: null`, if that state can change server-side.)

### WR-05: `store.error!` can actually be null — the non-null assertion feeds `null` into a prop typed `NetworkError | HttpError`

**File:** `src/store/side-conversations-store.ts:294-298` + `src/screens/conversations-list-screen.tsx:64-69` + `src/screens/components/error-card.tsx:12-15`
**Issue:** In `load()`'s catch, a non-`NetworkError`/`HttpError` exception (e.g. a `TypeError` thrown while mapping malformed data in `toRow`) sets `status = "error"` but `error = null`. The screen then renders `<ErrorCard error={store.error!} …>` — the `!` assertion is factually wrong, and `ErrorCard` receives `null` for a prop whose type promises it cannot be null. It only renders correctly by accident (`null instanceof NetworkError` → `false` → generic copy). The next person who adds `error.status`-based branching in `ErrorCard` gets a runtime crash on this path.
**Fix:** Make the truth match the types — e.g. widen `ErrorCard` to `error: NetworkError | HttpError | null` (message logic already degrades to generic copy), and drop the `!` in the screen; or normalize unknown errors in the store's catch so `error` is never null when `status === "error"`.

### WR-06: `htmlToText` deletes user content between a bare `<` and the next `>`

**File:** `src/lib/html-to-text.ts:15`
**Issue:** The tag-stripping regex `/<[^>]*>/g` treats *any* `<…>` span as a tag. A comment whose body contains unencoded comparison text — e.g. an email ingested as `"Adet 5 < 10 ve 12 > 7 olmalı"` — becomes `"Adet 5 7 olmalı"`: everything between the bare `<` and the next `>` is silently deleted from the row summary. Grispi normally delivers encoded HTML, but external-party email bodies are not guaranteed to be strictly encoded, and the same regex also mangles legal HTML with `>` inside attribute values (`<a title="a>b">` leaves `b">` behind).
**Fix:** Constrain the pattern to things that look like actual tags, e.g.:
```ts
const withoutTags = input.replace(/<\/?[a-zA-Z][^>]*>|<!--[\s\S]*?-->/g, " ");
```
so a `<` not followed by a letter/slash survives as literal text (it is safe — output goes through React text interpolation only).

## Info

### IN-01: Dangling "·" separator when a row has no public comment timestamp

**File:** `src/screens/components/conversation-row.tsx:44-49`
**Issue:** The `·` separator span renders unconditionally, but the time span renders `""` when `row.lastPublicCommentAt === null` (fresh agent-only threads, hydration-failed rows). The row header then reads `alici@example.com ·` with a trailing floating dot.
**Fix:** Render the separator and the time span together, conditionally on `row.lastPublicCommentAt !== null`.

### IN-02: Empty-string `ts.requester` value parses to requester id 0

**File:** `src/store/side-conversations-store.ts:72-74`
**Issue:** `Number("")` and `Number("   ")` evaluate to `0`, which passes `Number.isFinite`, so a present-but-empty field value yields `requesterId = 0` instead of `null` — triggering a doomed background `GET /public/v1/users/0` per load.
**Fix:** `const trimmed = typeof requesterValue === "string" ? requesterValue.trim() : requesterValue; const numericId = trimmed !== "" && trimmed != null ? Number(trimmed) : NaN;`

### IN-03: Relative timestamps never refresh while the panel stays open

**File:** `src/screens/components/conversation-row.tsx:47`
**Issue:** `formatRelativeTime(row.lastPublicCommentAt)` is computed once per render with an implicit `Date.now()`; nothing schedules re-renders, so "az önce" can stay on screen for hours in a long-lived panel session. Acceptable for Phase 1 (polling arrives later) — noting so it is not forgotten when the poller lands.
**Fix:** When polling is introduced, derive the label from an observable "now" tick (e.g. a minute-interval store value) instead of `Date.now()` at render time.

### IN-04: A 2xx response with an empty/non-JSON body escapes the NetworkError/HttpError taxonomy

**File:** `src/grispi/client/http-handler.ts:49`
**Issue:** `return response.json()` on a 204/empty 2xx throws a raw `SyntaxError`, which callers classifying only `NetworkError | HttpError` will fall through to "unexpected" branches (and the store's catch will set `error = null` — see WR-05). All Phase 1 endpoints return JSON today, but Phase 2's write calls (`PATCH`/`POST`) commonly return 204.
**Fix:** `const text = await response.text(); return text ? JSON.parse(text) : (undefined as T);` (or wrap parse failure in `HttpError`/a dedicated error).

### IN-05: Hard-coded custom-field key conflicts with CLAUDE.md's stated security constraint

**File:** `src/lib/side-conversation.ts:10`
**Issue:** `.claude/CLAUDE.md` constraints state "field key'leri settings'ten okunur, hardcode edilmez", while this file hard-codes `tu.side_conversation_parent` and documents locked decision D-01/D-02 (22 Tem 2026) mandating exactly that. The code appears to follow the newer locked decision, but the two authoritative documents now contradict each other — a future contributor following CLAUDE.md would "fix" this in the wrong direction.
**Fix:** Update the CLAUDE.md constraint wording to carve out the D-01 provisioned field key (or re-confirm D-01 if CLAUDE.md is the newer truth).

### IN-06: A throw inside the silent self-heal helpers would flip an already-"ready" list to "error"

**File:** `src/store/side-conversations-store.ts:289-299`
**Issue:** `retryFailedHydrations` and `enrichUnresolvedRecipients` are awaited inside `load()`'s `try` after `status` has been set to `"ready"`. Their network failures are contained (`allSettled` / `.catch`), but any unexpected synchronous throw (e.g. `toRow` on malformed data inside the `runInAction`) propagates to `load()`'s catch and flips a fully rendered list into the error card — contradicting the documented "never flips status" contract, with `error = null` (see WR-05).
**Fix:** Move the two self-heal awaits outside the main `try` (or wrap each call site in its own swallow-and-log `try/catch`).

---

_Reviewed: 2026-07-23T11:22:12Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
