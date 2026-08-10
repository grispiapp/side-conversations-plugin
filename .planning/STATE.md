---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 04.1
current_phase_name: ortam-y-nlendirmesi-ve-prod-haz-rl
status: verifying
stopped_at: Completed 04.1-02-PLAN.md
last_updated: "2026-08-10T10:15:59.337Z"
last_activity: 2026-08-10
last_activity_desc: Phase 04.1 execution started
progress:
  total_phases: 7
  completed_phases: 6
  total_plans: 31
  completed_plans: 31
  percent: 86
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-22)

**Core value:** Temsilci, talebi çözmek için gereken harici yazışmaları talepten hiç ayrılmadan yürütebilmeli; talep sahibi bu yazışmaları asla görmemeli.
**Current focus:** Phase 04.1 — ortam-y-nlendirmesi-ve-prod-haz-rl

## Current Position

Phase: 04.1 (ortam-y-nlendirmesi-ve-prod-haz-rl) — EXECUTING
Plan: 2 of 2
Status: Phase complete — ready for verification
Last activity: 2026-08-10 — Completed quick task 260810-j2w: WR-01: gate SDK ticket-update events on bootstrap completion + add grispi-context render test

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 15
- Average duration: ~33 min
- Total execution time: ~1.08 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | - | - |
| 02 | 6 | - | - |
| 03.1 | 5 | - | - |

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
| Phase 02 P05 | 15min | 3 tasks | 3 files |
| Phase 02 P06 | 55min | 6 tasks | 7 files |
| Phase 04 P01 | 45min | 3 tasks | 7 files |
| Phase 04 P02 | ~20min | 3 tasks | 10 files |
| Phase 04 P03 | 40min | 2 tasks | 6 files |
| Phase 04 P04 | 20min | 2 tasks | 6 files |
| Phase 04 P05 | 35min | 3 tasks | 8 files |
| Phase 04 P06 | 40min | 3 tasks | 14 files |
| Phase 04 P07 | 40min | 2 tasks | 9 files |
| Phase 04 P08 | 48min | 4 tasks | 11 files |
| Phase 04.1 P01 | 20min | 2 tasks | 9 files |
| Phase 04.1 P02 | ~15min | 2 tasks | 4 files |

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
- [Phase ?]: Phase 02 Plan 05: Failed-bubble retry row uses text-red-200 (not text-destructive-foreground, which is near-white on bg-primary) to pass AA contrast while staying visually distinct
- [Phase ?]: Phase 02 Plan 05: compose-screen isDirty stays hardcoded false — wiring compose.isDirty is paired with Plan 06's ConfirmDialog, not this plan
- [Phase 02]: [Phase 02, Plan 06]: Compose session pins its parent ticket key at open (initSubject); submit() prefers the pinned key over the live parentKey argument, and reset() clears the pin — prevents D-03's 'Kalsın' from silently rebinding a dirty draft to a different ticket (closes T-02-01)
- [Phase 02]: [Phase 02, Plan 06]: Fresh-compose reset lives in PanelNavigationStore.openCompose() (the single entry point for '+' and empty-state CTA), not scattered across every back-navigation path — every genuinely fresh compose open is pristine without disturbing an in-progress D-03 session
- [Phase 04]: Upload endpoint has NO public/v1 prefix: POST https://api.grispi.net/attachments/upload
- [Phase 04]: Comment-bearing ticket writes (create+reply) use /v2/tickets; status-only lifecycle PATCH stays on public/v1 to preserve D-15
- [Phase 04]: public/v1 tickets PATCH/POST silently ignores comment.attachmentIds; only /v2/tickets binds attachments correctly
- [Phase 04]: Client attachment size/count limits (D-08) are a UX/deliverability choice, not a server constraint
- [Phase 04]: One attachment id binds to exactly one comment (N1); re-attaching returns HTTP 422
- [Phase ?]: [Phase 04, Plan 02]: HttpHandler.sendMultipart never spreads the class's default JSON headers — extraHeaders (Authentication.headers only) is the sole header source, closing the sendMultipart-drops-Content-Type bug the method exists to prevent
- [Phase ?]: [Phase 04, Plan 02]: Attachments.upload posts to the probe-confirmed root path attachments/upload (no public/v1 prefix) — final path string locked for Plan 06's write-path wiring
- [Phase ?]: [Phase 04, Plan 02]: Attachment.inline?: boolean is real (not a no-op) — Phase 04 Plan 01's live probe confirmed it round-trips as inline:true, so Plan 04/08's inline-image flow can rely on it
- [Phase 04-03]: AttachmentUploader is injectable, defaulting to a grispiAPI.attachments.upload singleton closure (store reads module singleton, not React context)
- [Phase 04-03]: Two-surface (compose/reply) bucket split uses four flat private arrays, not a nested Record, avoiding per-key observable annotation complexity under makeAutoObservable's deep:false
- [Phase 04-03]: AttachmentChip's remove button is hand-built at UI-SPEC's literal 20px (size-5), not Button's size=toolbar (32px) that the pattern map cited
- [Phase 04-03]: collectAttachmentIds always merges inline ids before chip ids (fixed order); downstream Plan 05/06/08 callers must not re-sort
- [Phase 04]: D-22 mirrors 'empty→undefined' idiom: normalizeComment carries comment.attachments through with zero filtering — inline:true attachments are never dropped since this plugin never renders incoming body images (D-21)
- [Phase 04]: ThreadMessage's image/file MIME split (attachmentKind === 'image', SVG excluded per D-10) computed inline per-render, not as a store-level derived field
- [Phase ?]: COMP-05/THRD-05 composer UI'si Plan 05'te iki surface'de de canlı (attach+drag-drop+chip listesi+gönderim kilidi); attachmentIds gönderim bağlaması Plan 06'da
- [Phase ?]: getFilesFromEvent, react-dropzone'un file-selector tabanlı varsayılan okuyucusu yerine dataTransfer.files/input.files'ı doğrudan okuyacak şekilde override edildi
- [Phase 04-06]: Write-path split (public/v1 status-only vs /v2/tickets comment-bearing) implemented as enforced code, not just documented decision — Tickets.patchTicket narrowed to StatusTicketPatchRequest
- [Phase 04-06]: N1 constraint (one attachment id binds to exactly one comment) means retry path replays the frozen envelope's already-bound ids unchanged — no attachment logic added to getRetryEnvelope/reconcileCanonical
- [Phase 04-06]: P6a live delivery proven at API level (real /v2/tickets binding, publicVisible comments to real recipient) but not independently re-verified by mailbox inspection this session — approved to proceed; full mailbox check + P6b deferred to Plan 04-08 phase-end UAT
- [Phase ?]: [Phase 04, Plan 07]: sanitizeAuthoredHtml/sanitizeHtml share one sanitizeWithConfig helper so the incoming policy stays byte-identical while a second permissive policy permits img+src/alt for https?/mailto only (D-14/D-21)
- [Phase ?]: [Phase 04, Plan 07]: Closed a DOMPurify-internal gap (its DATA_URI_TAGS default always includes img and cannot be narrowed via config) with a stripUnsafeImageSrc post-pass — required to satisfy T-04-26/the no-data-URI constraint
- [Phase ?]: [Phase 04, Plan 07]: normalizeComment computes message direction before sanitizing; own-direction messages use sanitizeAuthoredHtml, incoming stays on sanitizeHtml, and reconcileCanonical uses the same policy on both sides (T-04-29)
- [Phase 04]: D-13 revised to positional drop routing: an all-image drop landing inside the editor text area embeds inline; everything else is an attachment
- [Phase 04]: D-16 GC matches on the upload's objectkey query token after HTML-entity decoding, not whole-URL substring, so it survives both client serialization and server N3 re-encoding
- [Phase ?]: [Phase 04.1, Plan 01]: HttpHandler default baseUrl intentionally moved from preprod (.net) to prod (.com) — safe-side default per CORE-04, breaking/updating the one regression test that pinned it
- [Phase ?]: [Phase 04.1, Plan 01]: parseJwt wraps its body in try/catch (deviation from reference impl) so malformed/non-JWT tokens degrade to null instead of throwing — required by existing test fixtures and real-world bad tokens
- [Phase ?]: [Phase 04.1, Plan 01]: _grispi_env is never normalized (prod-tr does NOT auto-correct to prod_tr) — strict allowlist match only, with console.warn diagnostic
- [Phase ?]: [Phase 04.1, Plan 01]: setEnvironment is a required (non-optional) field on BootstrapPluginInitDeps so a missing call site is a compile-time error, not a silent prod bug
- [Phase ?]: [Phase 04.1, Plan 02]: DEFAULT_DEV_ENVIRONMENT is preprod (opposite of the real chain's safe-side prod default) — gsocial-test lives on preprod, so the standalone override must preserve existing local UAT flow — Plan 04.1-02 Task 1
- [Phase ?]: [Phase 04.1, Plan 02]: REACT_APP_DEV_GRISPI_ENV resolved through isGrispiEnvironment allowlist, not the file's other fields' plain trim-or-default pattern — required so an unrecognized/hyphenated value can never leak into StandaloneDevConfig.environment (T-04.1-01) — Plan 04.1-02 Task 1
- [Phase ?]: [Phase 04.1, Plan 02]: README documents the TR-mandatory _grispi_env rule and hyphen trap as explicit prose warnings, since JWT dev claim genuinely cannot distinguish prod from prod_tr — documentation is the only mitigation for T-04.1-06 — Plan 04.1-02 Task 2

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- Faz 1 öncesi: custom field key'leri (örn. `tu.sc_parent_key`) tenant'ta Grispi admin'de tanımlanmalı (dış bağımlılık); kod settings'ten okur
- Faz 2 başında: requester set mekanizması (field değer formatı + kayıtsız alıcıda `POST /customers` ihtiyacı) canlı tenant'ta tek API denemesiyle doğrulanmalı
- Faz 4: "alıcıyla önceki görüşmeler" v2 preview endpoint'ine (`GET /public/v2/tickets`) dayanır — değişebilir, izole/bayraklı kullanılmalı
- Faz 4 kapanışı: P6b (alıcının posta istemcisinde inline görsel render'ı) ve P5 (plugin-mode bundle token) 04-08 UAT'sinde doğrulanamadı — kullanıcı tarafından teyit bekliyor, fazı bloklamıyor
- Faz 04.1 kapanışı: M2 (canlı preprod ağ kontrolü — DevTools Network sekmesinde ilk XHR host'unun preprod olduğunun teyidi, hem plugin-mode hem standalone-mode için) yürütücü tarafından doğrulanamadı — kullanıcı teyidi bekliyor, fazı bloklamıyor

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260810-j2w | WR-01: gate SDK ticket-update events on bootstrap completion + add grispi-context render test | 2026-08-10 | 37cf6fd | [260810-j2w-wr-01-gate-sdk-ticket-update-events-on-b](./quick/260810-j2w-wr-01-gate-sdk-ticket-update-events-on-b/) |

### Roadmap Evolution

- Phase 4 edited: ek/attachment kapsamı genişletildi: COMP-08 + THRD-06 eklendi, COMP-05/THRD-05 revize (Base64 varsayımı düzeltildi)
- Phase 5 added: Faz 4 bölündü: ekler Faz 4'te kaldı, talep özeti + önceki görüşmeler + sessiz tazeleme Faz 5'e taşındı
- Phase 04.1 inserted after Phase 4: Ortam yönlendirmesi: sabit .net yerine _grispi_env + dev claim ile çalışma-zamanı çözümleme (prod blocker) (URGENT)

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-08-10T10:15:59.331Z
Stopped at: Completed 04.1-02-PLAN.md
Resume file: 
