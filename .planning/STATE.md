---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 02
current_phase_name: yeni-yan-g-r-me-ba-latma
status: executing
stopped_at: Completed 02-04-PLAN.md
last_updated: "2026-07-23T21:21:27.030Z"
last_activity: 2026-07-23
last_activity_desc: Phase 02 execution started
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 10
  completed_plans: 8
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-22)

**Core value:** Temsilci, talebi çözmek için gereken harici yazışmaları talepten hiç ayrılmadan yürütebilmeli; talep sahibi bu yazışmaları asla görmemeli.
**Current focus:** Phase 02 — yeni-yan-g-r-me-ba-latma

## Current Position

Phase: 02 (yeni-yan-g-r-me-ba-latma) — EXECUTING
Plan: 5 of 6
Status: Ready to execute
Last activity: 2026-07-23 — Phase 02 execution started

Progress: [███████░░░] 67%

## Performance Metrics

**Velocity:**

- Total plans completed: 4
- Average duration: ~33 min
- Total execution time: ~1.08 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | - | - |

**Recent Trend:**

- Last 5 plans: 45min, 20min
- Trend: down

*Updated after each plan completion*
| Phase 01 P01 | 45min | 3 tasks | 18 files |
| Phase 01 P02 | 20min | 3 tasks | 9 files |
| Phase 01 P03 | 40min | 3 tasks | 17 files |
| Phase 01 P04 | 15min | 2 tasks | 5 files |
| Phase 02 P01 | ~15min | 3 tasks | 6 files |
| Phase 02 P02 | 25min | 3 tasks | 12 files |
| Phase 02 P03 | 12min | 3 tasks | 6 files |
| Phase 02 P04 | ~20min | 3 tasks | 8 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Yan görüşme = requester'ı harici alıcı olan ayrı Grispi ticket'ı ("side ticket"); e-posta Grispi native mail kanalından akar
- İlişki side ticket'taki `tu.*` parent-key field'ında; listeleme `advanced-search` ile (size ≤ 10 → sayfalama şart)
- Field key'leri plugin settings'ten okunur (varsayılanlarla); "sıra kimde" rozetleri son public yorumun yazar rolü + ts.status'tan türetilir
- [Phase ?]: Recipient/subject field lookups centralized in SideConversationsStore's toRow() mapper — single point of correction once Plan 02's live probe confirms real field paths
- [Phase ?]: advancedSearch + encoded getTicket are the only two API methods added in Plan 01-01 (CORE-02 Phase-1 narrowing; createTicket/patchTicket/searchCustomers/getDigest deferred to Phases 2-4)
- [Phase 01]: Requester email resolved via comments[].creator.id match against fieldMap['ts.requester'].value (a user id), not a new /users/{id} API call — out of Plan 02's scope (Rule 4)
- [Phase 01]: Agent-vs-external authorship derived from creator.role.authority !== 'ROLE_END_USER', not teamUser alone — CONFIRMED live that integration/AI users also report teamUser:false
- [Phase 01]: Badge statusId sourced from the advanced-search summary's inline status.id, not the hydrated ticket's fieldMap — survives partial hydration failure
- [Phase 01]: Alıcı asla ham ticket key olarak gösterilmez: comment-match → GET /users/{id} primaryEmail → '—' (LIST-01 gap closure, Plan 01-03)
- [Phase 01]: Standalone dev mode (NODE_ENV=development + REACT_APP_DEV_TOKEN) SDK köprüsünü bypass eder; plugin mode değişmedi — lokal UAT bununla yapıldı
- [Phase 01]: Store'un sessiz satır upgrade'leri immutable replacement ile yapılır (in-place mutation non-observer satır bileşenine görünmez); ConversationRow observer'a alındı
- [Phase ?]: [Phase 01, gap-closure 01-04]: Plugin-mode bootstrap now routes the initial ticket fetch through the shared switchTicket path (bootstrapPluginInit) instead of calling getTicket directly — closes CORE-03 gap where a bootstrap-time API failure left the agent on an infinite skeleton with no error/retry
- [Phase ?]: [Phase 01, gap-closure 01-04]: ErrorCard's error prop widened to NetworkError | HttpError | null (WR-05) — store.load() can set status='error' with error=null for a non-typed exception; ErrorCard's existing ternary already degrades null to the generic Turkish copy
- [Phase ?]: Phase 02 Plan 01: createTicket reuses existing Ticket type for its 201 response (probe-confirmed same shape family, A1)
- [Phase ?]: Phase 02 Plan 01: CustomerSearchResponse reuses the AdvancedSearchResponse content-wrapped page-envelope pattern (probe corrected assumption of a plain array, A2)
- [Phase ?]: Phase 02 Plan 01: customers.search searchTerm has a live-enforced 3-character minimum (422 below that) — Plan 03's recipient-field debounce must respect this
- [Phase ?]: Phase 02 Plan 02: DEFAULT_DEV_AGENT_EMAIL hardcoded to davutkmbr@gmail.com (Plan 01's live-verified probe identity) as the standalone-dev agentEmail fallback
- [Phase ?]: Phase 02 Plan 02: header + button wrapped in explicit w-full flex div rather than modifying the shared ScreenHeader primitive, to escape its line-clamp-2 (-webkit-box) fit-content sizing
- [Phase ?]: Phase 02 Plan 02: ComposeScreen.isDirty hardcoded false this plan (no form fields yet) — real dirty-guard wiring deferred to Plan 05
- [Phase ?]: Phase 02 Plan 03: showFreeEmailRow reduces to isValidEmail(trimmedQuery) whenever searchStatus is no-results; implemented both branches per plan text
- [Phase ?]: Phase 02 Plan 03: selected-recipient clear reuses selectFreeEmail("")+setQuery("") instead of a new store method
- [Phase ?]: Phase 02 Plan 03: full Ticket has no subject field live (Pitfall #6) — ComposeScreen subject prefill defensively reads optional untyped field, degrades to [<KEY>] only
- [Phase ?]: Phase 02 Plan 03: jest.advanceTimersByTimeAsync unavailable under CRA's bundled Jest 27.5.1 — debounce tests advance timers + manually flush microtasks
- [Phase ?]: [Phase 02, Plan 04]: ActiveConversationStore.startNew/retry are synchronous/fire-and-forget (not awaited by ComposeStore.submit) — chat navigation happens right after the optimistic pending bubble is created, not after the createTicket POST settles, matching UI-SPEC's chat-screen anatomy
- [Phase ?]: [Phase 02, Plan 04]: ComposeStore.submit yields exactly one Promise.resolve() microtask (not the full network chain) between firing startNew and calling openChat — makes D-17's synchronous reentrancy guard meaningful without delaying the optimistic navigation
- [Phase ?]: [Phase 02, Plan 04]: Retry (D-15) re-fires the identical createTicket POST with no idempotency key — accepted risk (T-02-08) of a duplicate side ticket if a successful response is lost to a client-side network error before retry

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- Faz 1 öncesi: custom field key'leri (örn. `tu.sc_parent_key`) tenant'ta Grispi admin'de tanımlanmalı (dış bağımlılık); kod settings'ten okur
- Faz 2 başında: requester set mekanizması (field değer formatı + kayıtsız alıcıda `POST /customers` ihtiyacı) canlı tenant'ta tek API denemesiyle doğrulanmalı
- Faz 4: "alıcıyla önceki görüşmeler" v2 preview endpoint'ine (`GET /public/v2/tickets`) dayanır — değişebilir, izole/bayraklı kullanılmalı

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-07-23T21:21:27.024Z
Stopped at: Completed 02-04-PLAN.md
Resume file: None
