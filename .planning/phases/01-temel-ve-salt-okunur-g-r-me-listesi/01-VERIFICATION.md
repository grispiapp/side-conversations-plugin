---
phase: 01-temel-ve-salt-okunur-g-r-me-listesi
verified: 2026-07-23T11:28:36Z
status: gaps_found
score: 4/5 must-haves verified (ROADMAP success criteria)
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Kritik field/ayar eksikse anlaşılır bir kurulum uyarısı; API hatasında Türkçe mesaj ile 'yeniden dene' seçeneği gösterilir (ROADMAP SC5 / CORE-03)"
    status: partial
    reason: "The advanced-search fetch error path IS fully handled (ErrorCard + Yeniden dene, verified). But the real production (plugin/iframe) bootstrap path has two unhandled failure points confirmed by direct code read: (1) `plugin._init().then(...)` in src/contexts/grispi-context.tsx has no `.catch` — if the SDK handshake rejects, `loading` never flips to false and the rocket LoadingScreen hangs forever with an unhandled promise rejection; (2) if `_init()` resolves but the initial `getTicket(bundle.context.ticketKey)` call fails, the catch block only does `console.error(...)` — `setTicket` is never called, so `ticket` stays `null`, the list screen's `ticket?.key` effect never fires `store.load()`, and `store.status` remains at its constructor default `\"loading\"` forever: three skeleton rows, no Turkish error message, no retry affordance. This is the exact, independently-reproduced-in-code scenario documented as CR-01 in 01-REVIEW.md. It was not caught by the Task 3 human UAT because that UAT ran against the standalone dev-mode bootstrap path, which is NOT vulnerable (its `switchTicket`-based init sets a provisional `{ key }` ticket synchronously before the `getTicket` await, so `store.load()` always fires regardless of hydration outcome — the plugin `_init()` path duplicates similar logic but skips that resilience mechanism)."
    artifacts:
      - path: "src/contexts/grispi-context.tsx"
        issue: "Lines ~159-201: `plugin._init().then(...)` has no `.catch`; the initial `getTicket` catch block logs but never calls `setTicket`, `setLoading`, or any error-carrying state the UI can react to."
    missing:
      - "Route the plugin `_init()` initial ticket fetch through the same resilient `switchTicket` path standalone mode already uses (set a provisional `{ key }` ticket synchronously, or otherwise ensure `store.status` reaches `\"error\"` on initial-fetch failure so `ErrorCard` + `Yeniden dene` engage)."
      - "Add a `.catch` to `plugin._init()` itself so an SDK handshake failure falls through to a non-hanging state instead of an infinite rocket screen + unhandled rejection."
deferred: []
human_verification: []
---

# Phase 1: Temel ve Salt Okunur Görüşme Listesi — Verification Report

**Phase Goal:** Temsilci, aktif talebe bağlı tüm yan görüşmeleri panelde rozetleriyle, doğru sırayla ve gerektiğinde sayfalanmış olarak görebilir; ayar/hata durumları anlaşılır şekilde ele alınır.
**Verified:** 2026-07-23T11:28:36Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Note on Phase Goal format / MVP mode

ROADMAP.md marks this phase `**Mode:** mvp`. The ROADMAP `**Goal:**` line (used as this report's headline, and as given in the verification dispatch) is descriptive prose, not strict "As a / I want to / so that" form — confirmed via `gsd-tools query user-story.validate`, which returns `valid: false` against that exact string. However, each of the three PLAN.md files for this phase carries a well-formed `## Phase Goal (MVP user story)` section in the required "As a … I want to … so that …" shape (e.g. Plan 01: "As a destek temsilcisi, I want to … aktif talebe bağlı yan görüşmeleri panelde gerçek verilerle … görebilmek, so that harici yazışmaların durumunu talepten hiç ayrılmadan takip edebileyim."), and the ROADMAP also carries five concrete, testable Success Criteria. Per the goal-backward methodology's Option-C fallback and Step 2a (ROADMAP Success Criteria are always the non-negotiable contract), this report verifies against those five ROADMAP Success Criteria rather than refusing outright — refusing would discard real, verifiable evidence (three completed plans, 45 passing tests, an approved 7-step live-tenant human UAT, and an independent standard-depth code review) for a phase that is otherwise fully executed. This is flagged here as an informational process note, not a gap; recommend running `/gsd mvp-phase` retroactively only if the project wants ROADMAP's headline goal line itself reformatted for future phases' consistency.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria — the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Temsilci, aktif talebe bağlı tüm yan görüşmeleri (alıcı, konu, son mesaj özeti, göreli zaman) tek listede görür; 10'dan fazla görüşmede "daha fazla yükle" sonraki sayfayı getirir | ✓ VERIFIED | `src/store/side-conversations-store.ts` `load()`/`loadMore()` (two-tier advancedSearch→allSettled(getTicket), PAGE_SIZE=10, `hasMore` from envelope); `src/screens/components/conversation-row.tsx` renders recipient(mono)/time/subject/summary; `src/screens/components/list-footer.tsx` "Daha fazla yükle". 45/45 unit tests pass incl. `appends the next page and toggles hasMore off at the last page`. UAT steps 1 & 5 approved live (10→13 rows, correct group insertion) |
| 2 | Her görüşme doğru "sıra kimde" rozetini taşır (Yanıt bekleniyor / Yeni yanıt / Kapalı); yeni yanıtlı görüşmeler görsel olarak vurgulanır ve listenin en üstünde yer alır | ✓ VERIFIED | `src/lib/conversation-status.ts` `deriveBadge`/`sortConversations` (statusId from live-confirmed summary field, `authority !== "ROLE_END_USER"` signal); `src/screens/components/conversation-row.tsx` renders `<Badge>` + `border-l-[3px] border-l-primary` only on `yeni-yanit`. Unit tests cover all badge branches + group/sort order. UAT step 2 approved live against 13 real test tickets |
| 3 | Hiç yan görüşme yoksa, gizlilik açıklaması ("talep sahibi bu yazışmayı görmez") ve tek CTA içeren boş durum ekranı görünür | ✓ VERIFIED | `src/screens/components/empty-state.tsx` contains the exact string "Talep sahibi bu yazışmayı görmez." plus a single `disabled` Button with `aria-label="Çok yakında"`. Wired at `store.status === "empty"` in `conversations-list-screen.tsx`. UAT step 3 approved live |
| 4 | Temsilci aktif talebi değiştirdiğinde liste otomatik olarak yeni talebin görüşmelerini gösterir | ✓ VERIFIED | `conversations-list-screen.tsx` `useEffect` keyed on `ticket?.key` → `store.load`; `load()` synchronously resets `rows/page/hasMore` and bumps a generation counter before the first `await` (D-15); `grispi-context.tsx`'s shared `switchTicket` sets a provisional `{key}` ticket instantly on both the SDK `currentTicketUpdated` event and the dev switcher. Named tests `discards a stale page append…` and `resets rows/page/hasMore synchronously at load() entry…` pass. UAT step 6 approved live (instant skeleton, zero stale flash) |
| 5 | Kritik field/ayar eksikse anlaşılır bir kurulum uyarısı; API hatasında Türkçe mesaj ile "yeniden dene" seçeneği gösterilir | ✗ FAILED (partial) | The "kurulum uyarısı" clause is intentionally and explicitly satisfied by design (D-04: field existence is guaranteed by tenant provisioning, so no separate setup-warning screen exists — this is a documented decision, not a gap). The "API hatasında" clause, however, is NOT universally true: `src/screens/conversations-list-screen.tsx`'s `ErrorCard` branch only engages when `store.status === "error"`, which only the store's `advancedSearch` catch sets. The plugin-mode bootstrap path (`src/contexts/grispi-context.tsx`, real Grispi iframe) has no equivalent — see Gaps Summary below |

**Score:** 4/5 ROADMAP success criteria fully verified; 1 partially verified with a confirmed code-level gap (0 behavior-unverified — the failing item is a definite code defect, not an unexercised-but-present behavior).

### Plan-Level Must-Haves (supplementary detail)

All plan-level `must_haves.truths` across 01-01/01-02/01-03 PLAN.md frontmatter were independently checked against the codebase and are VERIFIED (not merely claimed in SUMMARY.md):

| Plan | Truth | Status | Evidence |
|------|-------|--------|----------|
| 01-01 | Real advanced-search read renders real rows | ✓ VERIFIED | `tickets.ts` `advancedSearch`; store `load()` calls it with the single `allConditions` condition (fieldKey=`SIDE_CONVERSATION_PARENT_FIELD_KEY`, no extra conditions — D-03 confirmed, no other condition anywhere in `load`/`loadMore`) |
| 01-01 | HttpHandler throws typed errors, never swallows to null | ✓ VERIFIED | `http-handler.ts`: `send<T>(): Promise<T>` (no `\| null`), `NetworkError`/`HttpError` classes present, `http-handler.test.ts` passes (ok→json, non-ok→HttpError, fetch-throw→NetworkError) |
| 01-01 | Ticket key URL-encoded | ✓ VERIFIED | `tickets.ts` `getTicket`: `` `public/v1/tickets/${encodeURIComponent(ticketKey)}` `` |
| 01-01 | Relative time sourced from last public comment, not `ticket.updatedAt` | ✓ VERIFIED | `toRow()` computes `lastPublicCommentAt` from `comments.filter(publicVisible).sort(...)[0]`, never reads `ticket.updatedAt` |
| 01-02 | Badge derivation ignores internal (non-public) comments | ✓ VERIFIED | `resolveBadge()` filters `ticket.comments` to `publicVisible` before mapping; `conversation-status.test.ts` covers "internal-comment exclusion" |
| 01-02 | Safe default: no seen record ⇒ "yeni-yanit" | ✓ VERIFIED | `deriveBadge()`: `if (!last \|\| !last.authorIsAgent) return {badge:"yeni-yanit",...}` — the D-07 safe-default branch; `getLastSeenAt` always returns `null` today (no writer exists until Phase 3), consistent with plan intent |
| 01-02 | Closed tickets keep "Kapalı" badge but remain in the list | ✓ VERIFIED | `deriveBadge()` returns `"kapali"` for `CLOSED_STATUS_IDS` (4/5, live-confirmed) without removing the row; `sortConversations` places `kapali` last, not absent |
| 01-02 | Live API shape confirmed before badge derivation finalized | ✓ VERIFIED | `01-02-probe-findings.md` documents real curl-captured JSON (envelope, `ts.requester` id, `ts.status` path/IDs 4/5, `creator.role.authority` signal) against `gsocial-test` tenant; findings are reflected verbatim in `conversation-status.ts` code comments and `grispi.type.ts` |
| 01-03 | Partial-hydration rows dim + silently self-heal | ✓ VERIFIED | `retryFailedHydrations()` — generation-guarded, never flips `status`; named test `silently retries a partially failed hydration and upgrades the row in place (D-11)` passes |
| 01-03 | No separate "kurulum uyarısı" screen; field-related errors fall to ErrorCard | ✓ VERIFIED (by design) | No such screen exists in `screens/`; confirmed intentional per D-04 |
| 01-03 | "Daha fazla yükle" preserves accessible name while spinning | ✓ VERIFIED | `list-footer.tsx`: `aria-label="Daha fazla yükle"` is a static prop on the `Button`, unconditionally set; only the child content swaps to `<ReloadIcon className="animate-spin" />` |
| 01-03 | Disabled "+" CTA with "Çok yakında" | ✓ VERIFIED | `empty-state.tsx`: `disabled aria-label="Çok yakında" title="Çok yakında"` |
| 01-03 | Ticket switch clears instantly, zero stale flash | ✓ VERIFIED | Confirmed above (SC4) + named test `resets rows/page/hasMore synchronously at load() entry, before the returned promise resolves (D-15)` |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/grispi/client/http-handler.ts` | `NetworkError`/`HttpError`, throwing `send<T>` | ✓ VERIFIED | Present, matches contract, 51 lines, tested |
| `src/grispi/client/tickets.ts` | `advancedSearch` + encoded `getTicket` | ✓ VERIFIED | Present, both methods confirmed |
| `src/grispi/client/users.ts` | `getUser` → `GET /public/v1/users/{id}` | ✓ VERIFIED | Present (01-03 gap-closure addition), used by store's `fetchUserEmail` |
| `src/lib/side-conversation.ts` | `SIDE_CONVERSATION_PARENT_FIELD_KEY` constant | ✓ VERIFIED | Exact string `tu.side_conversation_parent`, guarded by test |
| `src/lib/relative-time.ts` | `formatRelativeTime` | ✓ VERIFIED | Exports function, 5 threshold buckets tested |
| `src/lib/conversation-status.ts` | `deriveBadge`/`sortConversations` | ✓ VERIFIED | Both exported, pure, fully tested |
| `src/lib/last-seen-store.ts` | `getLastSeenAt` (crash-safe) | ✓ VERIFIED | try/catch → null, tested incl. throwing-localStorage case |
| `src/lib/html-to-text.ts` | Plain-text extraction from HTML comment bodies | ✓ VERIFIED | Present, tested incl. `<script>` case; output still only rendered via `{}` interpolation (no `dangerouslySetInnerHTML` anywhere in `src/`) |
| `src/components/ui/badge.tsx` | `Badge`/`badgeVariants` | ✓ VERIFIED | cva-based, amber/emerald/slate variants per UI-SPEC |
| `src/store/side-conversations-store.ts` | Two-tier fetch + generation guard + badges + pagination | ✓ VERIFIED | 466 lines, all claimed behaviors independently traced in source (see truths above) |
| `src/screens/conversations-list-screen.tsx` | Status-machine screen | ✓ VERIFIED | Branches on all 4 `ConversationsListStatus` values + wires EmptyState/ErrorCard/ListFooter |
| `src/screens/components/conversation-row.tsx` | Row + badge + rail + skeleton | ✓ VERIFIED | `observer`-wrapped, renders badge/rail/summary correctly |
| `src/screens/components/empty-state.tsx` | Privacy CTA screen | ✓ VERIFIED | Exact copy present |
| `src/screens/components/error-card.tsx` | Layered Turkish error + retry | ✓ VERIFIED | NetworkError/HttpError copy branch, never renders `.body`/status/headers |
| `src/screens/components/list-footer.tsx` | Pagination button | ✓ VERIFIED | Constant aria-label, spinner swap |
| `src/app.tsx` | Mounts `ConversationsListScreen` | ✓ VERIFIED | `WelcomeScreen` fully removed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `side-conversations-store.ts` | `tickets.ts` | `advancedSearch` + `allSettled(getTicket)` | ✓ WIRED | Confirmed in `load()`/`loadMore()` |
| `conversations-list-screen.tsx` | `side-conversations-store.ts` | `useStore().sideConversations`, effect on `ticket?.key` | ✓ WIRED | Confirmed |
| `store` | `conversation-status.ts` | `resolveBadge` → `deriveBadge`, `sortConversations` applied before `status="ready"` | ✓ WIRED | Confirmed at lines 279-284 |
| `conversation-status.ts` | `last-seen-store.ts` | `getLastSeenAt` used in `resolveBadge` | ✓ WIRED | Confirmed |
| `conversation-row.tsx` | `badge.tsx` | `<Badge variant=...>` | ✓ WIRED | Confirmed |
| `conversations-list-screen.tsx` | `error-card.tsx` / `empty-state.tsx` / `list-footer.tsx` | status branches | ✓ WIRED | Confirmed |
| `error-card.tsx` | `store.load` | `onRetry` | ✓ WIRED | Confirmed, `store.load(ticket.key)` |
| `app.tsx` | `conversations-list-screen.tsx` | JSX mount | ✓ WIRED | Confirmed |
| `grispi-context.tsx` (plugin bootstrap) | `side-conversations-store.ts` error surfacing | initial `getTicket` failure → UI error state | ✗ NOT WIRED | See gap above — no path from a bootstrap-time `getTicket` failure to any error-carrying UI state |

### Behavioral Spot-Checks / Tests

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite | `CI=true npx craco test --watchAll=false` | 8 suites / 45 tests, all pass | ✓ PASS |
| TypeScript compile | `npx tsc --noEmit -p tsconfig.json` | Exit 0 | ✓ PASS |
| Stale-generation discard (behavior-dependent) | named test `discards a stale generation when a newer load starts first` | pass | ✓ PASS |
| Synchronous reset on ticket switch (behavior-dependent) | named test `resets rows/page/hasMore synchronously at load() entry, before the returned promise resolves (D-15)` | pass | ✓ PASS |
| Silent hydration self-heal (behavior-dependent) | named test `silently retries a partially failed hydration and upgrades the row in place (D-11)` | pass | ✓ PASS |
| Pagination append + hasMore-off at last page | named test `appends the next page and toggles hasMore off at the last page` | pass | ✓ PASS |
| No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in changed files | grep scan across 20 key files | 0 matches | ✓ PASS |
| No `dangerouslySetInnerHTML` usage | grep scan across `src/` | 0 usages (1 comment mentioning it as a non-pattern) | ✓ PASS |
| Git commit hashes referenced in SUMMARYs | `git cat-file -t <hash>` for all 11 hashes across 3 SUMMARYs | all resolve to `commit` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| CORE-01 | 01-01 | Hard-coded field key, not settings-driven | ✓ SATISFIED | `side-conversation.ts` |
| CORE-02 | 01-01 | API layer covers advancedSearch/getTicket (Phase-1 narrowed) | ✓ SATISFIED | `tickets.ts`; createTicket/patchTicket/searchCustomers/getDigest correctly deferred to later phases |
| CORE-03 | 01-01, 01-03 | Turkish error messages + retry | ⚠️ PARTIALLY SATISFIED | Search-fetch path fully satisfied; plugin bootstrap path is not — see gap |
| LIST-01 | 01-01 | Full list w/ recipient, subject, summary, relative time | ✓ SATISFIED | Confirmed above; recipient-resolution gap from Wave 2 QA closed in 01-03 |
| LIST-02 | 01-02 | Correct "sıra kimde" badge | ✓ SATISFIED | `deriveBadge` tested + wired |
| LIST-03 | 01-02 | New-reply highlighted + top-sorted | ✓ SATISFIED | `sortConversations` + rail render |
| LIST-04 | 01-03 | Empty state w/ privacy CTA | ✓ SATISFIED | `empty-state.tsx` |
| LIST-05 | 01-03 | Auto-refresh on ticket switch | ✓ SATISFIED | generation guard + synchronous reset |
| LIST-06 | 01-03 | "Daha fazla yükle" pagination | ✓ SATISFIED | `loadMore`/`hasMore`/`ListFooter` |

No orphaned requirements: REQUIREMENTS.md's Phase 1 traceability table lists exactly these 9 IDs, and all 9 appear in at least one plan's `requirements:` frontmatter field.

### Anti-Patterns Found

None of severity Blocker/Warning were newly identified beyond what 01-REVIEW.md already documents (which this report independently re-confirmed by reading the same source lines — see CR-01 gap above, and WR-01 through WR-06/IN-01 through IN-06 in `01-REVIEW.md` for the full advisory list). No debt markers (TBD/FIXME/XXX), no `dangerouslySetInnerHTML`, no "coming soon"/"not implemented" strings in shipped UI copy.

### Human Verification Required

None. All ROADMAP success criteria were exercised either by automated tests (with specifically named behavioral tests for state-transition/invariant truths, not just presence) or by the already-completed, human-APPROVED 7-step live-tenant UAT (Task 3 of 01-03-PLAN.md, run against `gsocial-test` tenant, TICKET-563, 13 real side tickets). The one FAILED item (CORE-03 bootstrap path) is a definite, code-confirmed defect — not an ambiguous or visual judgment call — so it is reported as a gap rather than routed to human verification.

### Gaps Summary

One gap blocks a clean pass: **the plugin-mode (real Grispi iframe) bootstrap path has no error UI or retry when the very first ticket fetch fails**, contradicting part of ROADMAP Success Criterion 5 and the CORE-03 requirement ("API hatasında Türkçe mesaj ile 'yeniden dene' seçeneği gösterilir"). This was flagged as Critical (CR-01) by the standalone code-review pass (`01-REVIEW.md`) and is independently re-confirmed here by reading `src/contexts/grispi-context.tsx` directly:

1. `plugin._init().then(...)` has no `.catch` — an SDK handshake rejection leaves the rocket `LoadingScreen` showing forever plus an unhandled promise rejection.
2. If `_init()` resolves but the initial `grispiAPI.tickets.getTicket(...)` call fails, the catch block only logs to the console. `ticket` stays `null`, so the list screen's `useEffect` never calls `store.load()`, and `store.status` never leaves its constructor default of `"loading"` — the user is stuck on three skeleton rows forever with no Turkish error message and no way to retry.

This was not caught by the completed human UAT because that UAT necessarily ran against the standalone dev-mode bootstrap path (added specifically because "SDK unavailable outside Grispi iframe" per the 01-03-SUMMARY.md deviation log), and that path is NOT vulnerable to this bug — its `switchTicket`-based initialization sets a provisional `{ key }` ticket synchronously before awaiting `getTicket`, so `store.load()` fires regardless of hydration outcome, and any subsequent fetch failure correctly surfaces through the store's own `ErrorCard` path. The plugin `_init()` path duplicates similar bootstrap logic but was never routed through that same resilience mechanism, so this specific gap exists only in the code path that was not exercised by testing — the actual production (iframe) entry point.

This does not require re-planning the whole phase; it is a scoped, well-understood fix (route the plugin-mode initial fetch through the same `switchTicket` path already used by `currentTicketUpdated` and standalone mode, or otherwise ensure the store reaches `"error"` status on initial-fetch failure). Recommend either fixing this now via a small gap-closure plan, or explicitly overriding it with a documented reason/acceptance if the team judges the production risk acceptable for now (e.g., if cold-boot `getTicket` failures are judged rare enough, or if Phase 2 will touch this file anyway).

---

_Verified: 2026-07-23T11:28:36Z_
_Verifier: Claude (gsd-verifier)_
