---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 01
current_phase_name: temel-ve-salt-okunur-g-r-me-listesi
status: executing
stopped_at: Phase 01 Plan 02 complete (Badge derivation + grouped/sorted list)
last_updated: "2026-07-23T16:36:23.467Z"
last_activity: 2026-07-23
last_activity_desc: Completed 01-02-PLAN.md (Badge derivation + grouped/sorted list)
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-22)

**Core value:** Temsilci, talebi çözmek için gereken harici yazışmaları talepten hiç ayrılmadan yürütebilmeli; talep sahibi bu yazışmaları asla görmemeli.
**Current focus:** Phase 01 — temel-ve-salt-okunur-g-r-me-listesi

## Current Position

Phase: 01 (temel-ve-salt-okunur-g-r-me-listesi) — EXECUTING
Plan: 3 of 3
Status: Ready to execute
Last activity: 2026-07-23 — Completed 01-02-PLAN.md (Badge derivation + grouped/sorted list)

Progress: [███████░░░] 67%

## Performance Metrics

**Velocity:**

- Total plans completed: 2
- Average duration: ~33 min
- Total execution time: ~1.08 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 2 | 65min | ~33min |

**Recent Trend:**

- Last 5 plans: 45min, 20min
- Trend: down

*Updated after each plan completion*
| Phase 01 P01 | 45min | 3 tasks | 18 files |
| Phase 01 P02 | 20min | 3 tasks | 9 files |
| Phase 01 P03 | 40min | 3 tasks | 17 files |

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

Last session: 2026-07-23T11:12:34.077Z
Stopped at: Phase 01 Plan 02 complete (Badge derivation + grouped/sorted list)
Resume file: .planning/phases/01-temel-ve-salt-okunur-g-r-me-listesi/01-03-PLAN.md
