# Phase 1: Temel ve Salt Okunur Görüşme Listesi - Research

**Researched:** 2026-07-22
**Domain:** React/TS panel plugin — read-only list view over an external helpdesk API (Grispi Public API), MobX state, no backend of its own
**Confidence:** MEDIUM (architecture/patterns HIGH; the live shape of Grispi's `advanced-search` response and a few field locations are unverified this session — see Open Questions)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Field şeması ve tespit**
- **D-01:** TEK custom field: `tu.side_conversation_parent` (TEXT). Değeri parent ticket key'i (örn. `DESTEK-1042`). Side ticket tespiti = bu field'ın dolu olması.
- **D-02:** Key SABİTTİR ve koda gömülür — settings'ten okunmaz. Field, plugin tenant'a kurulurken Grispi tarafından OTOMATİK oluşturulacak (kullanıcı kararı, 22 Tem 2026). Bu, önceki "key'ler settings'ten okunur" kararının revizyonudur; REQUIREMENTS.md CORE-01 ve PROJECT.md Key Decisions buna göre güncellendi.
- **D-03:** Listeleme sorgusu YALNIZCA `{fieldKey: "tu.side_conversation_parent", operator: "EQUAL", value: "<parentKey>"}` koşuluyla çalışır. Channel gibi doğrulanmamış ek koşullar EKLENMEZ.
- **D-04:** Ayrı bir "kurulum uyarısı" ekranı YOK (field varlığı kurulumla garanti). Olağandışı hatalar genel hata deneyimine (D-11) düşer.

**Rozet kuralları ve durum türetme**
- **D-05:** Rozetler: `Yeni yanıt` (son public yorum karşı taraftan VE görülmemiş), `Yanıt bekleniyor` (son public yorum temsilciden), `Kapalı` (ts.status SOLVED **veya** CLOSED). Kapalılar listede kalır — tarihçe panelden erişilebilir.
- **D-06:** Durum türetmede yalnızca `publicVisible: true` yorumlar sayılır; internal notlar rozeti ve sırayı ETKİLEMEZ.
- **D-07:** İlk açılış / görülme kaydı yokken (localStorage boş): son mesajı karşı taraftan olan açık görüşmeler `Yeni yanıt` görünür — güvenli taraf, bekleyen yanıt gizlenmez.
- **D-08:** Sıralama üç grup: Yeni yanıt → açıklar (Yanıt bekleniyor) → Kapalılar; her grup kendi içinde son aktiviteye göre azalan.

**Liste verisi ve satır içeriği**
- **D-09:** Tam satır korunur (alıcı · göreli zaman · konu · son mesaj özeti · rozet — onaylı mockup'taki gibi). advanced-search dönüşü yetersizse ticket başına `GET /tickets/{key}` PARALEL atılır ve cache'lenir (sayfa başına max 10 ek istek kabul edildi).
- **D-10:** Göreli zaman ve son-aktivite sıralamasının kaynağı SON PUBLIC YORUMUN zamanıdır (ticket updatedAt DEĞİL). Zaman formatı mockup'taki gibi: "12 dk", "3 sa", "Dün", "12 Tem".
- **D-11:** Hata deneyimi katmanlı: advanced-search düşerse tam alan hata kartı (Türkçe mesaj + "Yeniden dene" butonu). Satır-detay isteklerinin bir kısmı düşerse liste yine render edilir; etkilenen satırlar özetsiz/soluk gösterilir ve sessizce yeniden denenir. Not: mevcut `http-handler` hataları yutup `null` dönüyor — hata ayrımı için elden geçirilmesi gerekir (planner detaylandırır).
- **D-12:** Sayfalama: liste sonunda "Daha fazla yükle" butonu (size=10, page artar). Sonsuz kaydırma YOK.

**Faz 1 ekran davranışları**
- **D-13:** Compose Faz 2'de geleceği için "+" butonu ve boş durum CTA'sı Faz 1'de GÖRÜNÜR + DEVRE DIŞI, "Çok yakında" tooltip/aria açıklamasıyla. Faz 2'de yalnızca enable edilir — layout zıplaması olmaz.
- **D-14:** İlk yüklemede 3 adet skeleton satır kartı. "Daha fazla yükle" beklerken buton spinner'a döner. Starter'ın roket LoadingScreen'i yalnızca bundle init aşamasında kalır.
- **D-15:** Talep değişiminde (currentTicketUpdated) liste ANINDA boşalır + skeleton görünür; yeni talebin verisi gelince dolar. Eski talebin verisi bir an bile gösterilmez.

**Test ve doğrulama düzeni**
- **D-16:** Test Davut'un kendi tenant'ında; `tu.side_conversation_parent` field'ını geliştirme sürecinde admin panelinden Davut oluşturacak. API token aynı tenant'tan.
- **D-17:** Test side ticket'ları ELLE oluşturulacak (Davut). Sayfalama (LIST-06) doğrulaması için 11+ side ticket ve rozet çeşitliliği (açık/yanıtlı/kapalı) gerekir — plan doğrulama adımında bu ön koşul açıkça listelenmeli.
- **D-18:** Geliştirme akışı ikili: günlük geliştirme localhost'ta mock bundle ile (README'deki GrispiClient comment-out yöntemi) + gerçek API token'ıyla canlı istekler; faz sonu doğrulama gerçek Grispi panelinde.

### Claude's Discretion
- Skeleton kartların birebir tasarımı, hata kartı metinlerinin son hâli, "Daha fazla yükle" buton yerleşimi — mockup'un dilini koruyarak planner/executor karar verir.
- Satır-detay isteklerinin cache stratejisi (süre, invalidation) ve sessiz retry politikası — planner belirler.
- Mock bundle'ın yapısı (fixture dosyası vs inline) — planner belirler.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. (Compose CTA'larının işlevi Faz 2'de, polling Faz 4'te — zaten roadmap'te.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CORE-01 | İlişki field'ının key'i sabittir (`tu.side_conversation_parent`), kod settings'e bağımlı değil | Architecture Patterns → field constant lives in code, no settings lookup; detection = presence-of-field, matches D-01/D-02 exactly |
| CORE-02 | API katmanı yan görüşme operasyonlarını kapsar (advanced-search, create, patch, customer search, digest) | **Open Question #6** — this requirement's text spans Phases 1-4 endpoints; recommend narrowing Phase 1's actual build to `advancedSearch` + hardened `getTicket` only; flag the scope mismatch rather than pre-building Phase 2-4 methods |
| CORE-03 | API hataları Türkçe, anlaşılır, yeniden deneme imkanlı | Architecture Patterns Pattern 5 (typed HTTP errors); Code Examples #1; Security Domain (error handling) |
| LIST-01 | Aktif talebe bağlı tüm yan görüşmeler (alıcı, konu, özet, göreli zaman) | Architecture Patterns (two-tier fetch); Code Examples #2, #4; **Open Question #3** (requester field location unverified) |
| LIST-02 | "Sıra kimde" rozeti (son public yorum yazar rolü + ts.status) | Architecture Patterns (badge derivation); Code Examples #3; Pitfalls #2, #4; Assumptions A2, A5 |
| LIST-03 | Yeni yanıtlı görüşmeler vurgulanır ve üstte listelenir | Architecture Patterns (group+sort); Code Examples #3 |
| LIST-04 | Boş durum: gizlilik açıklaması + tek CTA | code_context reuse (`Screen`/`ScreenContent`); D-13 disabled-CTA pattern |
| LIST-05 | Aktif talep değişince liste otomatik yenilenir | Architecture Patterns (`currentTicketUpdated` reaction); Pitfall #6 (stale-response race guard) |
| LIST-06 | 10'dan fazla görüşmede "daha fazla yükle" ile sayfalama | Architecture Patterns (pagination); Environment Availability (11+ test side ticket precondition, D-17) |
</phase_requirements>

## Summary

Phase 1 is a pure read path: fetch the side tickets attached to the active ticket, derive a status badge per side ticket from its own comments/status, sort them into three groups, and render a list with skeleton/empty/error states. Nothing in this phase writes to Grispi — it only extends the existing `Tickets` API class with an `advancedSearch` method, hardens the existing `HttpHandler` so failures are typed instead of swallowed to `null`, adds a small MobX store, and adds two new small UI primitives (`Badge`, `Skeleton`) that should be hand-written to match the project's *existing* `cva`/`cn` convention (see below) rather than pulled from the current shadcn CLI, which has moved to a different primitive library.

The single biggest open risk is not architectural — it's that the exact response shape of `POST /tickets/advanced-search` has never been called against a live tenant in this project. It does not appear anywhere in Grispi's public OpenAPI spec (confirmed by fetching it directly from `github.com/grispiapp/api-docs` this session); everything known about it comes from a private vendor PDF summarized in prior project research. The same applies to the numeric `ts.status` IDs and to where a side ticket's requester (the external "alıcı") actually lives in the JSON payload — the hand-written `Ticket` TypeScript type in this repo only supports `getTicket` and does not declare a `status` or `requester` field at all. **The plan's first task should be a live probe** (one `advancedSearch` call + one `getTicket` call against Davut's test tenant, per D-16) that pastes the raw JSON and locks down these three unknowns before the badge-derivation and row-rendering code is written against assumptions.

Everything else — the two-tier fetch-then-hydrate pattern, the group/sort logic, the Turkish relative-time formatting, the typed-error HTTP wrapper, and the third-party-iframe localStorage caveat — is grounded either directly in this repo's existing code or in platform behavior verified by executing code in this session (Node's `Intl` API, and a real Jest run confirming `global.fetch` is mockable in this project's test environment with zero extra setup).

**Primary recommendation:** Build a single new `SideConversationsStore` (MobX) that owns fetch/pagination/derivation state, feed it from a two-tier `advancedSearch` → `Promise.allSettled(getTicket)` pipeline, derive badges with a pure function that (because Phase 1 ships with no thread-detail screen yet) reduces D-07's "safe default" to the *entire* rule for this phase, and spend the first plan task locking down the three live-API unknowns above before writing that derivation code for real.

## Architectural Responsibility Map

This plugin has no server tier of its own — "backend" below refers to Grispi's external platform, not code this repo owns.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Side conversation listing (advanced-search + hydration) | Browser/Client (fetch orchestration, MobX store) | External API — Grispi Public API (query execution, data ownership) | Client only orchestrates calls and caches results; Grispi owns the actual ticket data and query semantics |
| Status/badge derivation (Yeni yanıt / Yanıt bekleniyor / Kapalı) | Browser/Client | — | Purely a client-side interpretation of fetched data; Grispi has no concept of this badge |
| Active-ticket tracking | SDK Bridge (`grispi-plugin.js`, relays parent-frame events) | Browser/Client (reacts via `currentTicketUpdated`) | The bridge is the sole source of truth for "which ticket is open now"; the client just reacts |
| Read/unseen tracking (`lastSeenAt`) | Browser Storage (`localStorage`, iframe-partitioned) | Browser/Client | Explicitly per-device, no server-side tracking exists (Out of Scope per REQUIREMENTS.md); Phase 1 only needs the defensive *read* path (see Common Pitfalls) |
| Pagination | Browser/Client (page counter, row append) | External API (enforces `size ≤ 10`, offset semantics) | Grispi caps page size; client just increments `page` and appends |
| Error classification & retry UI | Browser/Client | — | All classification (network vs HTTP vs partial) and the Turkish copy are client-side; Grispi only returns status codes |
| Custom field provisioning (`tu.side_conversation_parent`) | External API / Tenant Admin (Grispi-side, at plugin install) | — | Field is created during plugin installation on Grispi's side per D-02, not by this codebase |

## Standard Stack

### Core

All already installed — `[VERIFIED: package.json]`, read directly from the repo this session. No new core dependency is required for this phase.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | ^18.3.1 | UI runtime | Starter default, unchanged |
| typescript | ^4.9.5 | Types | Starter default, unchanged |
| mobx / mobx-react-lite | ^6.12.3 / ^4.0.7 | `SideConversationsStore` state (list, pagination, derived badges) | Already used for `CurrentUserStore`; same pattern extends naturally |
| tailwindcss | ^3.4.3 | Styling | Starter default |
| class-variance-authority | ^0.7.0 | Variant styling for new `Badge` component | Already used by `button.tsx`; reuse the exact pattern |
| clsx / tailwind-merge | ^2.1.1 / ^2.3.0 | `cn()` helper (`src/lib/utils.ts`) | Already the project's only className-merge utility |
| @radix-ui/react-icons | ^1.3.0 | Icons (spinner on "Daha fazla yükle", etc.) | Already used throughout `components/ui` |

### Supporting

No new supporting packages are needed. Everything this phase requires (relative-time formatting, HTTP error typing, a Badge/Skeleton component) is either a small pure function or a component matching an existing local pattern.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled Turkish relative-time formatter | `dayjs`/`date-fns` with a custom locale | A library adds bundle weight to a ~372px iframe plugin for a handful of threshold branches; neither library's built-in relative-time output matches the mockup's compact style anyway (see Code Examples) — `[VERIFIED: node Intl API, this session]` |
| Hand-written `Badge`/`Skeleton` matching `button.tsx`'s cva pattern | `npx shadcn@latest add badge skeleton` | The current shadcn CLI registry has moved interactive primitives to a **Base UI** base rather than Radix (`[CITED: ui.shadcn.com/docs/components/badge, fetched this session]`); this repo's existing components still use the older Radix+cva pattern, so CLI output today would introduce a second, inconsistent primitive-library family |
| Typed `NetworkError`/`HttpError` classes thrown from `HttpHandler` | A generic HTTP client library (`ky`, `axios`) with built-in retry | The existing `HttpHandler` is a ~15-line wrapper the whole codebase already depends on; swapping it for a library is a bigger change than D-11 asks for (D-11 only asks for the swallow-to-`null` behavior to be fixed) |
| `@testing-library/react` for screen-level render tests | Plain Jest unit tests on pure derivation functions + manual UAT (D-16–D-18) for screen behavior | The project's own established verification method for this phase is a real tenant with manually created side tickets, not component snapshot tests; RTL is a legitimate future addition but not required to get solid automated coverage of the parts that matter most (badge/sort/time logic) |

**Installation:** none — no new packages to install for this phase.

## Package Legitimacy Audit

**Not applicable.** This phase introduces zero new external packages. `Badge` and `Skeleton` are hand-written (matching the existing `button.tsx` `cva`/`cn` convention already in the repo), Turkish relative-time formatting is a small pure function plus the native `Intl` API, and HTTP error typing is a small addition to the existing hand-written `HttpHandler`. If the planner later decides a library is warranted for any of these, run the Package Legitimacy Gate protocol against that specific package before adding it.

## Architecture Patterns

### System Architecture Diagram

```
Grispi Ticket Page (parent frame, tenant origin)
        │  postMessage bootstrap { tenantId, token, ticketKey, agent, settings }
        ▼
grispi-plugin.js SDK bridge (CDN, runs inside OUR iframe)   ← read-only, no write capability
        │  GrispiClient.instance()._init() → Promise<GrispiBundle>
        │  + currentTicketUpdated(ticket) event (fires whenever agent switches tickets)
        ▼
GrispiProvider (React context — EXISTING, src/contexts/grispi-context.tsx)
        │  sets Authentication{tenantId, token} on grispiAPI (in-memory only)
        ▼
┌────────────────────────────────────────────────────────────────────┐
│  SideConversationsStore (MobX — NEW)                                │
│                                                                       │
│   activeTicketKey changes ──► clear rows synchronously (D-15),       │
│                                set status="loading", page=0           │
│                                        │                              │
│                                        ▼                              │
│                     Tickets.advancedSearch({                          │
│                       allConditions: [{ fieldKey:                     │
│                         "tu.side_conversation_parent",                │
│                         operator: "EQUAL", value: activeTicketKey }]}, │
│                       { size: 10, page })                             │
│                                        │                              │
│                     ┌──────────────────┴───────────────────┐          │
│                     ▼ resolves                              ▼ throws  │
│         page.content: SideTicketSummary[]           NetworkError /    │
│           (shape UNVERIFIED — Open Q #1)             HttpError        │
│                     │                                        │        │
│                     ▼                               full-width error  │
│      Promise.allSettled(                              card + "Yeniden │
│        content.map(row => Tickets.getTicket(row.key)))  dene" (D-11)  │
│                     │                                                  │
│         ┌───────────┴─────────────┐                                   │
│         ▼ fulfilled                ▼ rejected                          │
│  hydrate subject / requester /    mark row hydrationFailed:true         │
│  status / comments for that row   (dim row, no summary, silent          │
│         │                          background retry — D-11)            │
│         ▼                                                              │
│  deriveBadge(ticket) per row:                                           │
│   ts.status ∈ {SOLVED, CLOSED} → "Kapalı"                              │
│   else last publicVisible comment authored by agent → "Yanıt bekleniyor"│
│   else (external authored, or none yet) → "Yeni yanıt" (D-07, see      │
│         Common Pitfalls — this is the ONLY branch reachable in Phase 1) │
│         │                                                               │
│         ▼                                                               │
│  group [Yeni yanıt, Yanıt bekleniyor, Kapalı] (D-08),                    │
│  sort desc by last-public-comment time within each group (D-10)          │
└────────────────────────────────────────────────────────────────────┘
                     │
                     ▼
      ConversationsListScreen (React, NEW — observer)
        skeleton×3 (initial, D-14) │ empty-state+CTA (LIST-04) │
        rows[] with badge+rail (LIST-02/03) │ full-width error card (D-11)
        "Daha fazla yükle" (D-12) → page += 1 → advancedSearch again → append
```

### Recommended Project Structure

```
src/
├── components/
│   └── ui/
│       ├── badge.tsx                    # NEW — status pill, matches button.tsx's cva pattern
│       └── skeleton.tsx                 # NEW — loading placeholder (plain div, no primitive lib needed)
├── screens/
│   └── conversations-list-screen.tsx    # NEW — Phase 1's only real screen; replaces WelcomeScreen in app.tsx
├── store/
│   ├── side-conversations-store.ts      # NEW — list state, pagination, derived badges (MobX)
│   └── __tests__/
│       └── side-conversations-store.test.ts
├── grispi/
│   └── client/
│       ├── tickets.ts                   # EXTEND — add advancedSearch(); getTicket() now throws instead of returning null
│       ├── http-handler.ts              # EXTEND — NetworkError / HttpError instead of swallow-to-null (D-11)
│       └── __tests__/
│           └── http-handler.test.ts
├── lib/
│   ├── relative-time.ts                 # NEW — Turkish compact formatter ("12 dk", "3 sa", "Dün", "12 Tem")
│   ├── conversation-status.ts           # NEW — deriveBadge() + sortConversations(), pure functions
│   ├── last-seen-store.ts               # NEW — defensive localStorage wrapper; read-only in Phase 1, written by Phase 3/THRD-04
│   └── __tests__/
│       ├── relative-time.test.ts
│       └── conversation-status.test.ts
└── types/
    └── grispi.type.ts                   # EXTEND — Ticket needs status/requester fields once live shape is confirmed (Open Q #1-3)
```

### Pattern 1: Two-tier fetch with partial-failure tolerance (D-09, D-11)

**What:** `advancedSearch` gets the list of matching side-ticket keys/summaries; if that response doesn't carry everything a row needs (subject, requester, last comment, status), a parallel `getTicket` per row hydrates it. Because it's `Promise.allSettled` rather than `Promise.all`, one failing row never blocks the other nine.
**When to use:** Any time the "search" endpoint response is leaner than the row needs — exactly the situation D-09 anticipated.
**Example:** see Code Examples #2.

### Pattern 2: Screen-switch via component state, no router (established)

**What:** The existing starter has no router; `app.tsx` renders one screen unconditionally. This phase's screen (`ConversationsListScreen`) becomes the new default render target. Internally it branches on store status (`loading` / `empty` / `error` / `ready`) rather than mounting different route components.
**When to use:** Every screen in this project, per the starter's own convention (confirmed in `PROJECT.md`: "Router yok — ekranlar state ile değişir").

### Pattern 3: MobX store as single source of truth; screens stay presentational

**What:** `SideConversationsStore` owns `rows`, `page`, `status` (`'loading' | 'empty' | 'error' | 'ready'`), and `error`. The screen component is `observer`-wrapped and only reads store fields — no fetch logic in the component itself.
**When to use:** Matches the existing `CurrentUserStore` pattern (`makeAutoObservable`, constructed once in `RootStore`).

### Pattern 4: Defensive localStorage wrapper, forward-compatible with Phase 3

**What:** Phase 1 has no thread-detail screen (that's `THRD-01` in Phase 3), so nothing in this phase ever *writes* `lastSeenAt`. But the *read* path should exist now, wrapped in try/catch, so Phase 3 can add the write path without touching Phase 1's derivation code.
**When to use:** Any localStorage access in this plugin — it always runs in a third-party iframe (see Common Pitfalls).

### Pattern 5: Typed HTTP errors instead of null-swallowing

**What:** `HttpHandler.send` currently does `if (response.ok) return json(); return null;` — collapsing "network failure," "4xx," "5xx," and "successful-but-empty" into the same `null`. D-11 explicitly calls this out as needing rework. Replace with two error classes (`NetworkError` for fetch-level throws, `HttpError` for non-`ok` responses) so CORE-03's Turkish-message-plus-retry can distinguish "you're offline" from "the server rejected this."
**When to use:** Every API call this phase makes (`advancedSearch`, `getTicket`).
**Example:** see Code Examples #1.

### Anti-Patterns to Avoid

- **`dangerouslySetInnerHTML` for comment body/summary:** the "son mesaj özeti" is authored by an *external, untrusted* third party via email. Render it as plain text through React's default `{}` interpolation only — never as HTML. See Security Domain.
- **Regenerating `Badge`/`Skeleton` via the current shadcn CLI:** introduces a second, inconsistent primitive-library dependency (Base UI) alongside the existing Radix+cva components.
- **Sorting/rendering the list before per-row hydration settles:** produces a visible reorder flash. Wait for `Promise.allSettled` (or at least the initial skeleton period, D-14) before computing group/sort.
- **Silent auto-retry with backoff for the *primary* list load:** D-11 wants a manual "Yeniden dene" button for the full-list failure case; silent background retry is reserved for the row-level hydration failures only.
- **Building `createTicket`/`patchTicket`/`searchCustomers`/`getDigest` now because CORE-02 mentions them:** see Open Question #6 — those belong to Phases 2-4 per the roadmap and per CONTEXT.md's own phase-boundary fencing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Compact Turkish relative time ("12 dk", "3 sa", "Dün", "12 Tem") | A full custom date-diffing/formatting library | A ~15-line threshold function for the "dk/sa/Dün" buckets, plus native `Intl.DateTimeFormat('tr-TR', {day:'numeric', month:'short'})` for the fallback | `[VERIFIED: node -e, this session]` — `Intl.DateTimeFormat('tr-TR', {day:'numeric', month:'short'})` produces exactly `"12 Tem"` / `"5 Oca"`; no need to hand-roll Turkish month abbreviations |
| Retry/backoff for network calls | A generic retry-with-backoff engine | A manual "Yeniden dene" button (full-list failure) + a simple silent re-fetch on row hydration failure (no backoff needed at this volume — max 10 rows/page) | D-11 explicitly specifies manual retry for the list-level failure; over-engineering backoff here adds complexity the UX doesn't call for |
| HTTP error classification | String-matching on `error.message` | Two typed error classes thrown from `HttpHandler` (`NetworkError`, `HttpError`) | `[CITED: web-platform fetch() semantics — confirmed via WebSearch this session]` fetch() only throws for network-level failures (`TypeError`); HTTP 4xx/5xx must be detected via `response.ok`, not exception message text |
| localStorage safety | Assuming `localStorage.getItem`/`setItem` always succeeds | try/catch wrapper returning `null` on any failure | `[CITED: MDN Storage Access API / WebKit blog, verified via WebSearch]` this plugin always runs in a third-party iframe; some browser privacy configurations can throw on storage access |
| Badge/Skeleton visuals | `npx shadcn add badge skeleton` (pulls current registry, Base UI-based) | Hand-write both against the existing `button.tsx` cva/cn convention | Keeps one consistent primitive-component family in the codebase |

**Key insight:** almost nothing in this phase is genuinely hard enough to need a library — the actual complexity is entirely in *getting the Grispi API's real response shapes right* (see Open Questions), which no library can solve for you.

## Common Pitfalls

### Pitfall 1: `advanced-search` response shape is unverified
**What goes wrong:** Code gets written against an assumed response envelope (`content[]`, `totalPages`, etc.) that turns out to be different — wrong field names, a different pagination convention (0- vs 1-indexed page), or full `Ticket` objects instead of a lean summary (or vice versa).
**Why it happens:** The endpoint is **not present** in Grispi's public OpenAPI spec — `[VERIFIED: fetched github.com/grispiapp/api-docs/public-api-v1.yml directly via `gh api` this session; grepped for "advanced-search"/"allConditions" — zero matches]`. Everything known about it comes from a private 03.06.2026 vendor PDF summarized in `.planning/research/SUMMARY.md`, never called live.
**How to avoid:** Make the plan's first task a live probe: one real `POST /tickets/advanced-search` call (and one `GET /tickets/{key}` call) against Davut's test tenant (per D-16), logging/pasting the raw JSON, before writing the row-mapping/hydration code against assumptions. A plausible template for the paging envelope *does* exist in the public spec's `PagedCommentDigest` schema (`content`, `totalSize`, `totalPages`, `size`, `offset`, `numberOfElements`, `pageNumber`) — a reasonable starting guess, still unverified for this specific endpoint.
**Warning signs:** `TypeError: Cannot read properties of undefined` when mapping `page.content`, or every row silently falling into the "hydrate via getTicket" path because the summary fields never match what the code expects.

### Pitfall 2: `ts.status` numeric IDs and access path are unverified
**What goes wrong:** D-05's "Kapalı" rule (`ts.status` SOLVED or CLOSED) either never triggers or triggers on the wrong tickets.
**Why it happens:** The IDs (NEW 1, OPEN 2, PENDING 3, SOLVED 4, CLOSED 5, ON_HOLD 6) are, like advanced-search, sourced only from the private PDF — `[ASSUMED]`. The repo's hand-written `Ticket` TS type (`src/types/grispi.type.ts`) has no top-level `status` field at all; it only has a generic `fieldMap: { [key]: FieldMap }`, so the access path is presumably `ticket.fieldMap['ts.status'].value` — also unconfirmed.
**How to avoid:** Resolve in the same live probe as Pitfall 1 (a solved/closed test ticket should be among Davut's manually created side tickets per D-17's "rozet çeşitliliği" requirement). Prefer comparing the numeric `value`/`serializedValue`, not `userFriendlyValue` (locale-dependent string).
**Warning signs:** A manually-closed test side ticket still shows "Yanıt bekleniyor"/"Yeni yanıt" instead of "Kapalı".

### Pitfall 3: `HttpHandler.send` swallows every failure into `null`
**What goes wrong:** CORE-03 ("Türkçe, anlaşılır, yeniden deneme") is impossible to satisfy today — the caller can't tell "no network," "401," "500," and "200 with an empty body" apart; all four currently look identical (`null`).
**Why it happens:** Existing code (`src/grispi/client/http-handler.ts`): `if (response.ok) return json(); return null;` with no `try/catch` around `fetch` at all.
**How to avoid:** Pattern 5 above — throw `NetworkError`/`HttpError` instead of returning `null`. D-11's own code_context note confirms this is safe: `getTicket` is the only current caller, so it's not a breaking change project-wide.
**Warning signs:** Any error card that always shows the same generic message regardless of whether the wifi is down or the server returned a 500.

### Pitfall 4: `comment.creator` "is this the agent or the external party" field is unconfirmed against a real payload
**What goes wrong:** Badge derivation (D-05/D-06) needs to know, for the last `publicVisible` comment, whether its author is the temsilci or the external recipient. The hand-written `User` type exposes `role: { authority, impliedAuthorities, teamUser }`, which *looks* like the right signal (`teamUser: true` ⇒ agent), but this type was written to support only `getTicket`'s single existing call site and has not been checked against a full real response.
**Why it happens:** Same root cause as Pitfalls 1-2 — the types in this repo are a minimal hand-written approximation, not generated from a verified schema.
**How to avoid:** Confirm `comment.creator.role.teamUser` (or find the real field) in the same live probe, using a test side ticket that has at least one agent reply and one external reply (D-17 already asks for "rozet çeşitliliği").
**Warning signs:** Every conversation's badge comes out the same regardless of who actually replied last.

### Pitfall 5: third-party iframe localStorage restrictions
**What goes wrong:** `localStorage.getItem`/`setItem` throws (or silently no-ops into an isolated bucket) under some browser privacy configurations, crashing or subtly breaking the "seen" read path.
**Why it happens:** This plugin is *always* embedded as a cross-origin iframe (hosted on its own domain per the starter's README, embedded inside Grispi's ticket page on a different origin). `[CITED: MDN Storage Access API, WebKit "Introducing Storage Access API" blog, verified via WebSearch this session]` — WebKit partitions third-party storage strictly by top-level domain, and stricter configurations (Safari "Block All Cookies", some in-private modes) can throw outright on storage access, not just isolate it.
**How to avoid:** Pattern 4 — wrap every localStorage call in try/catch, degrade to "no record" (which, per D-07, is the intentional safe default anyway).
**Warning signs:** A blank screen or uncaught exception in Safari private browsing or with strict tracking-prevention settings on, that doesn't reproduce in normal Chrome.

### Pitfall 6: stale-response race when the agent switches tickets quickly
**What goes wrong:** D-15 requires that the old ticket's data is *never* shown, even for an instant, after switching. If `currentTicketUpdated` fires again before the previous `advancedSearch`+hydration cycle has resolved, the *older* (slower) response can resolve after the newer one and overwrite the store with the wrong ticket's rows.
**Why it happens:** Two overlapping async fetch cycles racing, with no cancellation/guard.
**How to avoid:** Tag each fetch cycle with a generation counter (or an `AbortController`) captured at the start of `loadPage`; when a cycle resolves, check it's still the current generation before committing to the store — discard it silently otherwise.
**Warning signs:** Rapidly clicking between two tickets in the Grispi list occasionally shows the wrong ticket's side conversations for a moment.

### Pitfall 7: CORE-02's requirement text is broader than this phase's actual boundary
**What goes wrong:** Taken literally, CORE-02 ("API katmanı... ticket oluşturma, yorum/status PATCH'i, müşteri arama, yorum özeti") would have this phase build `createTicket`, `patchTicket`, `searchCustomers`, and `getDigest` — all of which are Phase 2-4 features per ROADMAP.md and per CONTEXT.md's own phase-boundary fencing ("yazma akışları... bu fazın DIŞINDA").
**Why it happens:** REQUIREMENTS.md's traceability table maps the entire CORE-02 line to "Phase 1," even though its sub-clauses functionally belong to later phases.
**How to avoid:** See Open Question #6 — build only `advancedSearch` + a hardened `getTicket` now; treat the rest of CORE-02 as satisfied incrementally by Phases 2-4, and flag the mismatch back rather than silently over-building.
**Warning signs:** Scope creep — a "quick" `createTicket` stub added "since CORE-02 mentions it" that duplicates work Phase 2's own research will redo properly (Phase 2's research flag already calls out the requester-set mechanism as needing its own live API verification).

## Code Examples

### 1. Typed HTTP errors (fixes D-11 / Pitfall 3)
```typescript
// src/grispi/client/http-handler.ts
// Based on the existing file (read this session) + verified fetch() semantics:
// fetch() only rejects for network-level failures; HTTP 4xx/5xx resolve normally
// and must be detected via response.ok.
export class NetworkError extends Error {
  constructor(public cause: unknown) {
    super("network");
  }
}

export class HttpError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`http_${status}`);
  }
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
Call sites (`getTicket`, `advancedSearch`) now `try { ... } catch (e) { if (e instanceof NetworkError) … else if (e instanceof HttpError) … }` to pick the Turkish copy for CORE-03, instead of checking for `null`.

### 2. Two-tier fetch with partial-failure tolerance (D-09)
```typescript
// src/store/side-conversations-store.ts (sketch)
async function loadPage(parentKey: string, page: number) {
  // Request/response shape below is UNVERIFIED — see Open Question #1.
  const result = await grispiAPI.tickets.advancedSearch(
    { allConditions: [{ fieldKey: "tu.side_conversation_parent", operator: "EQUAL", value: parentKey }], anyConditions: [] },
    { size: 10, page }
  );

  const hydrated = await Promise.allSettled(
    result.content.map((row) => grispiAPI.tickets.getTicket(row.key))
  );

  return hydrated.map((outcome, i) =>
    outcome.status === "fulfilled"
      ? toRow(outcome.value, { hydrationFailed: false })
      : toPartialRow(result.content[i], { hydrationFailed: true }) // dim row, no summary, silent retry (D-11)
  );
}
```

### 3. Badge derivation — a pure function (D-05, D-06, D-07, D-08)
```typescript
// src/lib/conversation-status.ts
export type ConversationBadge = "yeni-yanit" | "yanit-bekleniyor" | "kapali";

// UNVERIFIED IDs — see Open Question #2 / Pitfall 2. Confirm against a live
// closed test side ticket before shipping.
const CLOSED_STATUS_IDS = new Set([4, 5]); // SOLVED, CLOSED

export function deriveBadge(ticket: {
  statusId: number | null;
  publicComments: Array<{ createdAt: number; authorIsAgent: boolean }>; // pre-filtered to publicVisible (D-06)
}): { badge: ConversationBadge; lastPublicCommentAt: number | null } {
  const sorted = [...ticket.publicComments].sort((a, b) => b.createdAt - a.createdAt);
  const last = sorted[0] ?? null;

  if (ticket.statusId !== null && CLOSED_STATUS_IDS.has(ticket.statusId)) {
    return { badge: "kapali", lastPublicCommentAt: last?.createdAt ?? null };
  }

  if (!last || !last.authorIsAgent) {
    // No public reply yet, or the external party spoke last.
    // Phase 1 ships with no thread-detail screen (THRD-01/THRD-04 are Phase 3),
    // so there is NO code path yet that ever records a "seen" timestamp.
    // D-07's "no record ⇒ Yeni yanıt" fallback is therefore not a rare edge
    // case here — for the whole of Phase 1, this branch IS the rule.
    return { badge: "yeni-yanit", lastPublicCommentAt: last?.createdAt ?? null };
  }

  return { badge: "yanit-bekleniyor", lastPublicCommentAt: last.createdAt };
}

const GROUP_ORDER: Record<ConversationBadge, number> = {
  "yeni-yanit": 0,
  "yanit-bekleniyor": 1,
  kapali: 2,
};

export function sortConversations<
  T extends { badge: ConversationBadge; lastPublicCommentAt: number | null }
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const groupDiff = GROUP_ORDER[a.badge] - GROUP_ORDER[b.badge];
    if (groupDiff !== 0) return groupDiff;
    return (b.lastPublicCommentAt ?? 0) - (a.lastPublicCommentAt ?? 0); // D-08: desc within group
  });
}
```

### 4. Turkish relative-time formatter (D-10)
```typescript
// src/lib/relative-time.ts
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Verified this session (node -e ...):
// new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(...)
//   → "12 Tem", "5 Oca"  — exact match for the mockup's fallback format.
const shortDate = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" });

export function formatRelativeTime(timestampMs: number, now: number = Date.now()): string {
  const diff = now - timestampMs;

  if (diff < MINUTE) return "az önce";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} dk`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} sa`;

  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  if (timestampMs >= startOfToday - DAY && timestampMs < startOfToday) return "Dün";

  return shortDate.format(new Date(timestampMs));
}
```
Note: `Intl.RelativeTimeFormat('tr-TR', {style:'short'})` was also tried this session and produces `"12 dk. önce"` / `"3 sa. önce"` — close, but with a trailing `" önce"` and a period the mockup's compact style ("12 dk") doesn't want, so it isn't a clean drop-in for the minute/hour buckets. It's a good cross-check that "dk"/"sa" are the correct native abbreviations, but the compact format still needs the small hand-rolled function above.

### 5. Defensive localStorage read (Pattern 4 / Pitfall 5)
```typescript
// src/lib/last-seen-store.ts
// Phase 1 only reads (defensively); Phase 3 / THRD-04 adds the write path.
const KEY_PREFIX = "sc:lastSeenAt:";

export function getLastSeenAt(ticketKey: string): number | null {
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + ticketKey);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    // Third-party iframe storage restrictions can throw here (Pitfall 5).
    // Degrade to "no record" — matches D-07's own safe default.
    return null;
  }
}
```

### 6. Badge / Skeleton — hand-written, matching the existing `button.tsx` convention
```tsx
// src/components/ui/badge.tsx
// Modeled directly on src/components/ui/button.tsx's cva+cn pattern (read this
// session), NOT on the current shadcn CLI output (which now targets Base UI —
// see Alternatives Considered).
import { cva, type VariantProps } from "class-variance-authority";
import { FC, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      // Color-to-state mapping below is a best guess — confirm against the
      // approved mockup (amber/yeşil/slate per CONTEXT.md) — see Open Question #5.
      "new-reply": "bg-amber-100 text-amber-800",
      "awaiting-reply": "bg-emerald-100 text-emerald-800",
      closed: "bg-slate-100 text-slate-600",
    },
  },
  defaultVariants: { variant: "closed" },
});

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge: FC<BadgeProps> = ({ className, variant, ...props }) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);
```
```tsx
// src/components/ui/skeleton.tsx
import { FC, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Skeleton: FC<HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn("animate-pulse rounded-md bg-slate-200", className)} {...props} />
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| No field-based ticket search on Grispi's public API (would require fetching+filtering client-side) | `POST /tickets/advanced-search` with `allConditions`/`fieldKey` | Introduced via Grispi's 03.06.2026 API changes (per prior project research; not yet reflected in the public OpenAPI spec as of this session) | Makes this phase's entire architecture possible; without it, listing side tickets by parent-key would be infeasible client-side |
| shadcn/ui CLI output built on Radix UI primitives | shadcn/ui CLI output now scaffolds interactive components on a **Base UI** base | Current shadcn/ui registry, confirmed via live fetch this session (`ui.shadcn.com/docs/components/badge`) | This repo's existing components (`button.tsx`) still use the older Radix+cva pattern — new components should match that older *local* convention, not the CLI's current output (see Alternatives Considered) |

**Deprecated/outdated:** none specific to this narrow phase beyond the above.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `advanced-search` request/response shape (envelope fields, pagination indexing, whether content is full `Ticket` objects or a lean summary) | Architecture Patterns, Code Examples #2 | Core list-fetch logic needs rework; hydration step could be mandatory rather than conditional, or page indexing off-by-one |
| A2 | `ts.status` numeric IDs (SOLVED=4, CLOSED=5, etc.) and access path (`fieldMap['ts.status'].value`) | Common Pitfalls #2, Code Examples #3 | D-05's "Kapalı" rule silently never fires, or fires on the wrong tickets |
| A3 | Requester/"alıcı" field location on `Ticket` (assumed `fieldMap['ts.requester']` or an undeclared top-level `requester` object) | Architecture Patterns, Open Question #3 | LIST-01's "alıcı" column can't be rendered, or silently renders `undefined`, until confirmed |
| A4 | Badge-to-color mapping (which of amber/yeşil/slate maps to which of the three states) | Code Examples #6 | Wrong color semantics ship; contradicts LIST-03's "görsel olarak vurgulanır" intent even if the badge *text* is correct |
| A5 | `comment.creator.role.teamUser` reliably distinguishes agent- vs externally-authored public comments in the real payload | Architecture Patterns, Common Pitfalls #4 | The entire badge/sort derivation (D-05, D-06, D-08) silently breaks if this field is absent or shaped differently live |
| A6 | List rows are non-interactive in Phase 1 (no click target, since the Thread screen is Phase 3/THRD-01) | Open Question #4 | Minor UX inconsistency if the approved mockup actually depicts clickable rows |

**If this table is empty:** not applicable — see rows above. All six trace back to the same root cause: the Grispi API's exact live response shape for this phase's core endpoints has not been called this session (no tenant credentials available to a research agent) and is only partially documented publicly.

## Open Questions

1. **What does a real `POST /tickets/advanced-search` response look like?**
   - What we know: the endpoint isn't in the public OpenAPI spec; its existence/rough shape comes from a private vendor PDF (prior project research only).
   - What's unclear: exact envelope field names, whether `content` holds full `Ticket` objects or a lean summary, 0- vs 1-indexed `page`.
   - Recommendation: make this the plan's first task — one live call against Davut's test tenant (D-16), paste the raw JSON, lock the TypeScript types from it before writing derivation code.

2. **What are the real `ts.status` IDs and where do they live on a `Ticket`?**
   - What we know: a plausible ID set (SOLVED=4, CLOSED=5) from the same private PDF; the hand-written `Ticket` type has no `status` field, only a generic `fieldMap`.
   - What's unclear: exact IDs, and whether access is via `fieldMap['ts.status'].value` or something else.
   - Recommendation: resolve in the same live probe as #1, using one of Davut's manually-closed test side tickets (D-17 already asks for status variety).

3. **Where does a side ticket's requester ("alıcı") live in the API response?**
   - What we know: the bundle `Context.requester` (from the SDK, for the *active* ticket) has `{id, fullName, email, phone}`; the REST `Ticket` type has no equivalent declared field.
   - What's unclear: whether `GET /tickets/{key}` returns an analogous top-level `requester`, or whether it's in `fieldMap` under some `ts.*`/`us.*` key.
   - Recommendation: resolve in the same live probe; this blocks rendering LIST-01's "alıcı" column at all.

4. **Are list rows clickable in Phase 1?**
   - What we know: D-13 explicitly addresses the "+" button and empty-state CTA (visible+disabled); CONTEXT.md says nothing about row click behavior, and Phase 3 (not Phase 1) owns the thread-detail screen (THRD-01).
   - What's unclear: whether the approved mockup depicts rows as clickable (with the destination screen simply not existing until Phase 3) or as static list items in Phase 1.
   - Recommendation: default to non-interactive rows (no `onClick`, no hover/press affordance) in Phase 1 to avoid a dead-end tap target; confirm against the mockup directly (the research agent could not render `claude.ai/code/artifact/...` — it's an authenticated, client-rendered page inaccessible to `WebFetch` in this session).

5. **Which color maps to which badge state?**
   - What we know: CONTEXT.md names three colors (amber/yeşil/slate) for the badge system plus a separate purple ("mor") unread rail.
   - What's unclear: the exact color↔state pairing (my draft in Code Examples #6 is a plausible guess: amber=Yeni yanıt, emerald=Yanıt bekleniyor, slate=Kapalı, but unverified).
   - Recommendation: confirm directly against the mockup during implementation (same access limitation as #4).

6. **Does CORE-02 really belong entirely to Phase 1?**
   - What we know: CORE-02's text spans `advancedSearch`, `createTicket`, comment/status `PATCH`, `searchCustomers`, and `getDigest` — the latter four are Phase 2-4 features per ROADMAP.md and per CONTEXT.md's explicit phase-boundary fencing ("yazma akışları... bu fazın DIŞINDA").
   - What's unclear: whether REQUIREMENTS.md's traceability table mapping "CORE-02 → Phase 1" is intentional (an umbrella "start the API layer" marker fulfilled incrementally) or a scoping oversight from roadmap creation.
   - Recommendation: build only `advancedSearch` + hardened `getTicket` in this phase; treat CORE-02 as satisfied incrementally across Phases 1-4; flag the apparent mismatch back to the user/roadmap rather than silently building unrelated CRUD methods now (this would also duplicate Phase 2's own planned live-API verification of the requester-set mechanism).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Dev server / build / tests | ✓ | v22.12.0 | — |
| npm | Package management, test runner invocation | ✓ | 11.7.0 | — |
| yarn | README's documented flow | ✓ | 1.22.22 | `npm` works equally; both present |
| `node_modules` installed | Local dev | ✓ | — | — |
| `global.fetch` in the Jest/craco test env | Unit-testing `HttpHandler` by mocking fetch | ✓ `[VERIFIED: ran an actual Jest test this session confirming `typeof global.fetch === "function"`]` | Node 22's built-in fetch | — |
| Grispi test tenant with `tu.side_conversation_parent` field created | Live API verification (D-16), Open Questions #1-3 | Not verifiable by this research agent (no tenant credentials available in this session) | — | Must be created by Davut in the admin panel per D-16 before/at the start of plan execution |
| 11+ manually-created side tickets with badge variety (open/replied/closed) | LIST-06 pagination verification, Pitfalls #2/#4 verification (D-17) | Not verifiable by this research agent | — | Must be created by Davut per D-17; the plan should list this explicitly as a pre-verification checklist item, not assume it exists |

**Missing dependencies with no fallback:**
- The live tenant field + manually created test side tickets (D-16/D-17) are human/data preconditions, not something an automated environment probe can satisfy. The plan must surface these as an explicit checklist before the phase-end verification step, and ideally before the very first live-API-probe task (Open Questions #1-3) can even run.

**Missing dependencies with fallback:**
- None — everything software-side needed for local development is already present.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest, via `react-scripts test` wrapped by `craco test` (`npm test`) — CRA's built-in preset, zero extra config |
| Config file | none dedicated; `craco.config.js` only adds the `@/` webpack alias, does not touch Jest config |
| Quick run command | `CI=true npx craco test --testPathPattern=<file> --watchAll=false` |
| Full suite command | `CI=true npx craco test --watchAll=false` |

`[VERIFIED: this session]` — ran a throwaway probe test file through `npx craco test`; it passed cleanly and confirmed `global.fetch` is a real function in this environment (Node's native fetch, no `jsdom` override), so `jest.spyOn(global, "fetch")` can mock `HttpHandler`'s calls directly with no polyfill.

No `@testing-library/react` is installed. Given this project's established verification method (D-16-D-18: real tenant, manually created data, end-of-phase check in the actual Grispi panel), automated coverage in this phase should focus on the deterministic pure logic below; screen-level and live-API behavior is covered by the manual UAT flow already decided in CONTEXT.md, not by new component-render tests.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CORE-01 | Field key constant is exactly `tu.side_conversation_parent` | unit (sanity guard) | `npx craco test --testPathPattern=conversation-status --watchAll=false` | ❌ Wave 0 |
| CORE-02 | (narrowed to Phase 1: `advancedSearch` request shape) | unit | `npx craco test --testPathPattern=tickets --watchAll=false` | ❌ Wave 0 |
| CORE-03 | Network vs HTTP error distinguished, Turkish message + retry | unit | `npx craco test --testPathPattern=http-handler --watchAll=false` | ❌ Wave 0 |
| LIST-01 | Row fields (alıcı/konu/özet/zaman) map/format correctly | unit | `npx craco test --testPathPattern=relative-time --watchAll=false` | ❌ Wave 0 |
| LIST-02 | Badge derivation for all status/authorship combinations | unit | `npx craco test --testPathPattern=conversation-status --watchAll=false` | ❌ Wave 0 |
| LIST-03 | Group+sort places "Yeni yanıt" first, desc by activity within group | unit | `npx craco test --testPathPattern=conversation-status --watchAll=false` | ❌ Wave 0 |
| LIST-04 | Empty state shows privacy copy + single disabled CTA | manual-only | — (visual/microcopy; D-16-D-18 manual UAT) | — |
| LIST-05 | Store resets synchronously on `currentTicketUpdated`, no stale flash | unit (reset sequencing) + manual (visual timing, D-15) | `npx craco test --testPathPattern=side-conversations-store --watchAll=false` | ❌ Wave 0 |
| LIST-06 | "Daha fazla yükle" appends page 2+ | unit (store pagination logic) + manual (needs D-17's 11+ real side tickets) | `npx craco test --testPathPattern=side-conversations-store --watchAll=false` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx craco test --testPathPattern=<touched-file> --watchAll=false`
- **Per wave merge:** `CI=true npx craco test --watchAll=false`
- **Phase gate:** full suite green, plus the D-16-D-18 manual verification pass in the real Grispi panel with Davut's 11+ manually-created test side tickets (D-17) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/lib/__tests__/relative-time.test.ts` — covers LIST-01 (time formatting)
- [ ] `src/lib/__tests__/conversation-status.test.ts` — covers CORE-01, LIST-02, LIST-03
- [ ] `src/grispi/client/__tests__/http-handler.test.ts` — covers CORE-03 (mock `global.fetch`, confirmed mockable this session)
- [ ] `src/store/__tests__/side-conversations-store.test.ts` — covers LIST-05, LIST-06 (mock the `Tickets` API class)
- [ ] No shared Jest setup file needed beyond CRA's default — confirmed via this session's probe run

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Token issuance/verification is entirely Grispi's responsibility; this plugin only carries a bearer token handed to it at bootstrap |
| V3 Session Management | Yes | Keep the token in-memory only (existing `Authentication` class pattern — a plain object, never written to `localStorage`/`sessionStorage`/cookies); this matches the project constraint "Token bundle'dan gelir, saklanmaz" |
| V4 Access Control | No | Enforced entirely server-side by Grispi (tenant + token); the client makes no authorization decisions |
| V5 Input Validation | Yes | (a) `encodeURIComponent` any dynamic path segment (ticket key) before interpolating into a fetch URL — `HttpHandler.send` currently does raw template-literal concatenation; (b) never use `dangerouslySetInnerHTML` for comment body/summary — see Known Threat Patterns below |
| V6 Cryptography | No | No hand-rolled crypto; bearer token travels over HTTPS only (`https://api.grispi.net`, already the case); the client never parses/constructs the JWT itself |
| V7 Error Handling & Logging | Yes | CORE-03's Turkish error messages must never leak raw API response bodies, stack traces, or the Authorization header into the UI or client-side logs sent anywhere external |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Stored/reflected script content via an externally-authored email body rendered as "son mesaj özeti" | Tampering / Elevation of Privilege | Render via React's default `{}` text interpolation only; never `dangerouslySetInnerHTML`; truncate as a plain-text substring, not via an HTML parser |
| Cross-ticket data flash when switching active tickets | Information Disclosure | D-15 + Pitfall #6's generation-guard: clear state synchronously before the new fetch starts, and discard any late-resolving response from a stale ticket generation |
| Token or raw error-body leakage via displayed/logged errors | Information Disclosure | The `HttpError`/`NetworkError` classes (Code Examples #1) should carry a `status`/`cause` for developer-facing `console.error`, but the user-facing Turkish string must be a fixed, generic message per error class — never `JSON.stringify(error.body)` |
| Unencoded ticket key/path segment interpolated into request URLs | Tampering | `encodeURIComponent(ticketKey)` before building `` `public/v1/tickets/${key}` `` — currently unencoded in `Tickets.getTicket` |
| Overlapping fetch cycles from rapid ticket-switching exhausting client resources / producing wrong-tenant renders | Denial of Service (self-inflicted) / Information Disclosure | Generation-counter or `AbortController` guard per fetch cycle (Pitfall #6) |

## Sources

### Primary (HIGH confidence — direct execution or direct read of authoritative source this session)
- `src/grispi/client/http-handler.ts`, `tickets.ts`, `api.ts`, `authentication.ts`, `src/types/grispi.type.ts`, `src/contexts/grispi-context.tsx`, `src/components/ui/button.tsx`, `screen.tsx`, `input.tsx`, `src/lib/utils.ts`, `package.json`, `craco.config.js`, `tailwind.config.js`, `README.md` — read directly this session, ground truth for "what exists today"
- `node -e "new Intl.DateTimeFormat('tr-TR', ...)"` / `Intl.RelativeTimeFormat` — executed this session, exact output confirmed
- Throwaway Jest probe run via `npx craco test` — executed this session, confirmed `global.fetch` availability in the project's actual test environment

### Secondary (MEDIUM confidence — official documentation fetched this session)
- `github.com/grispiapp/api-docs/public-api-v1.yml` (fetched via `gh api`, official Grispi API docs repo) — confirms `TicketRequest`/`CommentRequest`/`PagedCommentDigest` schemas and the tenant/auth header contract; confirms `advanced-search` is **absent** from this spec
- `ui.shadcn.com/docs/components/badge`, `/skeleton` (fetched via WebFetch) — current registry conventions
- WebSearch: fetch() network-vs-HTTP-error semantics; MDN Storage Access API / WebKit storage-partitioning blog

### Tertiary (LOW confidence — carried forward from prior project research, unverified live this session)
- `.planning/research/SUMMARY.md` — `advanced-search` request/response shape, `ts.status` numeric IDs, all sourced there from a private vendor PDF, not independently re-verified against a live tenant this session (no credentials available to a research agent)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; every existing library version read directly from `package.json`
- Architecture: MEDIUM — the fetch/derive/sort/render pipeline design is solid and grounded in existing code + verified platform behavior, but its most load-bearing inputs (advanced-search response shape, `ts.status` path, requester field location) are unverified against a live tenant
- Pitfalls: HIGH — each pitfall is grounded either in the actual repo code or in platform behavior verified by direct execution this session

**Research date:** 2026-07-22
**Valid until:** live-API unknowns (Open Questions #1-3) should be resolved at the start of plan execution, not held for 30 days; the rest of this document (stack/patterns/pitfalls not tied to live API shape) is stable for the standard ~30-day window
