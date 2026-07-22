# Walking Skeleton — Yan Görüşmeler (Grispi Side Conversations Plugin)

**Phase:** 1
**Generated:** 2026-07-22

## Capability Proven End-to-End

> The smallest user-visible capability that exercises the full stack through the existing Grispi starter.

A support agent opens a Grispi ticket, the panel boots with the real bundle/token, and a real `POST /public/v1/tickets/advanced-search` read renders that ticket's actual side conversations (recipient · relative time · subject · summary) in the ~372px right panel — replacing the starter welcome screen.

> Note: This is a Walking Skeleton through an EXISTING scaffold (the Grispi right-panel React starter). "Project scaffold" was not re-created — the skeleton is the thinnest real end-to-end slice wired through the starter's existing bundle/context/store/screen plumbing.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | CRA + craco, React 18, TypeScript 4.9 (unchanged starter) | Project constraint: keep the starter's structure for consistency with the Grispi plugin ecosystem (CLAUDE.md) |
| Styling / components | Tailwind 3 + hand-written `cva`/`cn` primitives (Radix-based `button.tsx` convention) | Do NOT use the current shadcn CLI (moved to Base UI — inconsistent family); hand-write `Badge`/`Skeleton` against the existing local pattern (RESEARCH Alternatives Considered) |
| State | MobX `RootStore` + new `SideConversationsStore` (`makeAutoObservable`) | Matches the existing `CurrentUserStore` pattern; store is the single source of truth, screens are presentational `observer`s |
| Data layer | No own backend. Grispi Public API via the existing `grispiAPI` singleton (`Tickets.advancedSearch` + hardened `getTicket`) over HTTPS (`https://api.grispi.net`) | Read-only phase; all writes are Phases 2-4 per REQUIREMENTS/ROADMAP |
| HTTP error model | Typed throws: `NetworkError` (fetch-level) + `HttpError` (non-2xx) replace swallow-to-`null` | CORE-03/D-11 need to distinguish offline vs server error for Turkish copy + retry |
| Auth / token | Token + tenantId from the bundle, held in-memory only on the `Authentication` object; never persisted | Project constraint "Token bundle'dan gelir, saklanmaz"; ASVS V3 |
| Field model | ONE hard-coded constant `SIDE_CONVERSATION_PARENT_FIELD_KEY = "tu.side_conversation_parent"`; detection = field present; query = single EQUAL condition | D-01/D-02/D-03; field is provisioned by Grispi at plugin install, not read from settings |
| Navigation | No router — one screen (`ConversationsListScreen`) with a status state machine (loading/ready/empty/error) | Starter convention "Router yok — ekranlar state ile değişir" |
| Read/unseen tracking | Per-device `localStorage` behind a defensive try/catch reader (`getLastSeenAt`); read-only in Phase 1 | No server-side seen-tracking exists (Out of Scope); third-party iframe storage can throw (Pitfall #5) |
| Deployment / run | Local dual flow (D-18): localhost dev with mock bundle (README comment-out) + real API token; phase-end verification in the real Grispi panel | No new hosting introduced this phase; manifest registration is an external dependency handled by the Grispi team |
| Directory layout | `src/lib/*` pure utils, `src/store/*` MobX, `src/screens/*` + `src/screens/components/*` views, `src/components/ui/*` primitives, `src/grispi/client/*` API, `src/types/grispi.type.ts` | Extends existing folders; co-locates `__tests__/` beside each module |

## Stack Touched in Phase 1

- [x] Project scaffold — reused as-is (existing CRA+craco starter; no re-init)
- [x] Routing — the single real screen `ConversationsListScreen` replaces `WelcomeScreen` in `app.tsx`
- [x] Data — one real API read: `advancedSearch` (list) + `Promise.allSettled(getTicket)` (hydrate). No writes this phase (read-only).
- [x] UI — real rows rendered from live data; loading skeleton; (Plans 02-03) badges, empty/error, pagination
- [x] Run — documented local full-stack run: `npm start` with mock bundle + real token, and real-panel UAT (D-16/D-17/D-18)

## Out of Scope (Deferred to Later Slices)

> Explicit — prevents future phases from re-litigating Phase 1's minimalism.

- Any write/mutation: create side conversation, reply, close/reopen, mark-read (Phases 2-3)
- Compose UI and recipient/customer search — the "+" button is visible-but-disabled only (D-13; Phase 2)
- Thread-detail screen; the `localStorage` WRITE path for seen-tracking (Phase 3 / THRD-04)
- File attachments, request-summary quoting, prior-conversations-with-recipient, silent background polling (Phase 4)
- `createTicket`/`patchTicket`/`searchCustomers`/`getDigest` API methods (CORE-02's later-phase portion; Phases 2-4)
- Additional advanced-search conditions beyond the single parent-key EQUAL (D-03)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without changing its architectural decisions:

- **Phase 2:** Agent starts a new side conversation (recipient/subject/message → side ticket created + real email sent → lands on the thread). Enables the "+" button; adds `createTicket` + customer search.
- **Phase 3:** Thread detail with direction split, reply, close/reopen, and the seen-tracking write path (localStorage) that activates the full D-05 badge rules.
- **Phase 4:** Attachments, request-summary quoting, prior conversations with the recipient, and silent background refresh (polling 30-60s).
