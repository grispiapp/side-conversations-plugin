---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 04.2
current_phase_name: uat-geri-bildirimleri-ili-ki-notu-ticket-navigasyonu-kimlik-
status: verifying
stopped_at: Phase 04.2 executed 8/8 — verification gaps_found (SC1/SC9)
last_updated: "2026-08-17T16:59:04.355Z"
last_activity: 2026-08-21
last_activity_desc: "quick 260821-itv: sohbet ekranına manuel Yenile + gereksiz liste refetch temizliği; test 564/564"
progress:
  total_phases: 8
  completed_phases: 7
  total_plans: 41
  completed_plans: 41
  percent: 88
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-22)

**Core value:** Temsilci, talebi çözmek için gereken harici yazışmaları talepten hiç ayrılmadan yürütebilmeli; talep sahibi bu yazışmaları asla görmemeli.
**Current focus:** Phase 04.2 — uat-geri-bildirimleri-ili-ki-notu-ticket-navigasyonu-kimlik-

## Current Position

Phase: 04.2 (uat-geri-bildirimleri-ili-ki-notu-ticket-navigasyonu-kimlik-) — EXECUTED, UAT BEKLİYOR
Plan: 10 of 10 (04.2-09, 04.2-10 gap kapanışı tamamlandı)
Status: Doğrulama `human_needed`, 8/9 must-have (5/9 → 8/9). SC1 KAPANDI — `assertSideConversationLink` artık `isCurrent` kapısının önünde ve her dönüş yolunda await ediliyor. SC9'un "yazma her zaman denenir" yarısı kapandı; "alan gerçekten kalıcı olur" yarısı canlı ölçüm bekliyor. Sıradaki: `/gsd-verify-work 04.2` (7 madde)
Last activity: 2026-09-02 — quick 260902-dhy: yan konuşma ana talebin markasını (`ts.brand`) devralıyor, disabled markada 422 fallback; test 581/581, tsc temiz. Canlı probe (preprod): markalı yan talebin e-postası markanın support address'inden çıkıyor. (Phase 04.2 doğrulaması hâlâ `human_needed` — sıradaki iş değişmedi.)

**SC9 kalan risk (kullanıcı kararı 2026-08-17 — bilinçli olarak canlı UAT'a bırakıldı):** mutlu yolda `tu.side_conversation_parent` yalnızca `/v2` PATCH'inin `fields` dizisiyle yazılıyor ve bu mekanizma hiç probe edilmedi; kanıtlanmış `public/v1` fields-only PATCH'i yalnızca `catch`'te. Aynı `/v2` yüzeyi POST'ta bu alanı 2/2 düşürmüştü. Ayrıntı + düzeltme reçetesi: `04.2-UAT.md` madde 7, `04.2-REVIEW-GAPS.md` CR-01, CONTEXT.md'deki D-22 düzeltme notu.

**Test borcu (WR-03):** `side-conversation-queries.test.tsx:1244`'teki D-01 sıralama testi `invocationCallOrder` kullanıyor — çağrı sırasını ölçüyor, await tamamlanmasını değil. Hoist sonrası totolojik hâle geldi: `await linkAssertion` satırları silinse hiçbir test kırılmaz. D-01 invariant'ı suite tarafından korunmuyor.

**CR-02 KAPANDI** (quick 260817-tn1, 2026-08-17): hardcoded `DEFAULT_DEV_AGENT_EMAIL`/`DEFAULT_DEV_AGENT_NAME` kaldırıldı. Standalone dev'de e-posta artık token'ın kendi `sub` claim'inden türüyor (`typeof` guard'lı — modül yükleme anında çalışıyor); JWT'de ad claim'i olmadığı için görünen ad yalnızca `REACT_APP_DEV_AGENT_NAME`'den, yani gitignore'lu yerel config'ten geliyor. Kimlik çözülemezse `null` → `!agentEmail` gate'leri göndermeyi kapatıyor (fail-closed, kasıtlı). Plugin modu (`bundle.context.agent`) hiç değişmedi.

**CR-02'nin açık kalan yarısı:** [grispi-context.tsx:87](../src/contexts/grispi-context.tsx) — `plugin = standaloneConfig ? null : getPluginInstance()` dev server gerçek Grispi iframe'ine servis edildiğinde SDK köprüsünü kapatıyor, yani standalone yolu gerçek panelin içinde de kazanıyor. Artık token'ın kendi kimliğini yazdığı için yanlış-atıf hatası değil, ama hâlâ bir hata. Ayrı ele alınacak.

Progress: [███████░░░] 75%

**Devralınan açık iş:** Phase 4 doğrulaması `human_needed` — `04-UAT.md`'deki 4 madde hâlâ insan onayı bekliyor; Phase 04.1 planları tamam ama fazın doğrulaması kapanmadı.

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
| Phase quick-260810-jiw P01 | 25min | 3 tasks | 2 files |
| Phase quick-260810-m8f P01 | 15min | 3 tasks | 5 files |
| Phase 04.2 P01 | 20min | 3 tasks | 7 files |
| Phase 04.2 P02 | 20min | 3 tasks | 11 files |
| Phase 04.2 P03 | ~8min | 2 tasks | 2 files |
| Phase 04.2 P04 | 12min | 2 tasks | 5 files |
| Phase 04.2 P05 | 40min | 2 tasks | 5 files |
| Phase 04.2 P06 | 35min | 3 tasks | 2 files |
| Phase 04.2 P07 | 25min | 2 tasks | 5 files |
| Phase 04.2 P08 | 3min | 2 tasks | 1 files |
| Phase 04.2 P09 | 4min | 3 tasks | 5 files |
| Phase 04.2 P10 | 2min | 1 tasks | 1 files |

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
- [Phase quick-260810-jiw]: WR-02 closed: HttpHandler.setEnvironment and GrispiAPI.setEnvironment proven end-to-end via 11 new behavioral tests; mutation-resistance empirically confirmed via 3 probes (headline no-op mutants + host-constant collision), all restored
- [Phase quick-260810-m8f]: Repo-as-host deploy model: build/ tracked in git as the deploy artifact; grispi.app serves it directly from /build/, no separate hosting/CI pipeline — Source maps disabled via committed .env.production (not inline shell prefix) so the setting is Windows-shell-safe and always applied regardless of caller
- [Phase 04.2]: [Phase 04.2, Plan 01]: assertSideConversationLink is awaited unwrapped (no second try/catch) right after mutationAccepted since the helper itself never throws — D-04's silent-failure contract stays in one place
- [Phase 04.2]: [Phase 04.2, Plan 01]: resolveDetailRecipientFallback ports hydrateSummaries's exact list-path shape to the detail path rather than inventing a new resolution path (D-12 scope limit)
- [Phase ?]: [Phase 04.2, Plan 02]: buildAgentTicketUrl built via string concatenation (never a template literal) to preserve environment.ts's zero-${ regression gate (T-04.1-01)
- [Phase ?]: [Phase 04.2, Plan 02]: setEnvironmentState/setAgentName are required (non-optional) BootstrapPluginInitDeps fields, resolved once and fed to both HttpHandler and React state sinks
- [Phase ?]: [Phase 04.2, Plan 02]: TicketKeyLink/ParentKeyChip take tenantId/environment/ticketKey/parentKey as props rather than reading useGrispi() internally, deferring screen-level wiring to Plan 06/07
- [Phase ?]: [Phase 04.2, Plan 03]: senderLabel takes agentName as a genuine 4th parameter (not UI-SPEC's 3-param sketch) — required for D-13's pending-optimistic-message fallback; agentName only applies when direction === own AND senderName is absent
- [Phase ?]: [Phase 04.2, Plan 03]: added data-testid=sender-name/sender-badge as test hooks (not new component/prop) to prove badge-vs-name DOM separation per the plan's own AYRI-sorgu requirement
- [Phase ?]: [Phase 04.2, Plan 04]: InfoBox never manages its own visibility or focus-on-dismiss — caller (compose screen here, chat screen in Plan 06) owns both
- [Phase ?]: [Phase 04.2, Plan 05]: closeLinkEditor/closeHeadingMenu return focus to the Aa FormatMenu trigger (formatTriggerRef), not the old linkTriggerRef/headingTriggerRef, since those buttons only exist while the popover is open
- [Phase ?]: [Phase 04.2, Plan 05]: FormatMenu onBlur close-guard exempts focus moving into the composer's own editor (not just into the panel) so toggling bold/italic/list/quote doesn't silently close the panel
- [Phase ?]: Header title falls back to sideKey plain text when environment/tenantId aren't yet resolved but sideKey is known — extends D-06/D-07's never-broken-link rule
- [Phase ?]: Post-dismiss InfoBox focus transfer uses a display:contents wrapper ref around Screen instead of a new ScreenHeader prop
- [Phase ?]: Chat-screen InfoBox 'created this session' latch is local component state, not a PanelNavigationStore addition
- [Phase 04.2]: [Phase 04.2, Plan 07]: isHydratedTicket guards on the real object shape ("fieldMap" in ticket), never ticket !== null — switchTicket's provisional ticket is real and reading fieldMap off it must never throw
- [Phase 04.2]: [Phase 04.2, Plan 07]: isSideConversationTicket(ticket) is the single predicate consumed once per render, feeding both ParentBanner's visibility and the Yeni konuşma button's disabled state — never two independent calls
- [Phase 04.2]: [Phase 04.2, Plan 08]: 04.2-UAT.md's seven items follow the plan's own numbered action list (folding list-header-truncation into item 6, adding a dedicated parent-banner-block item 4) rather than VALIDATION.md's table grouping verbatim
- [Phase ?]: [Phase 04.2, Plan 09]: linkAssertion promise created once right after sideKey is known, awaited explicitly at each of the three return points in executeCreateMutation — no dangling promise on either isCurrent early-return
- [Phase ?]: [Phase 04.2, Plan 09]: patchTicketFields throws synchronously before http.send when the body carries ts.status, enforcing D-15 structurally for this generic field-writer rather than by caller convention
- [Phase ?]: [Phase 04.2, Plan 09]: D-23 retry body built fresh as its own TicketFieldsPatchRequest literal (never derived from InternalNotePatchRequest) so the type system guarantees the retry cannot carry a comment
- [Phase ?]: [Phase 04.2, Plan 10]: Comment-stripping in environment-static.test.ts is two-stage and order-dependent — block comments stripped first, then only leading-// lines dropped, never mid-line // (would truncate GRISPI_BASE_URLS's https:// URL values)
- [Phase ?]: [Phase 04.2, Plan 10]: Static gate reads environment.ts via path.join(__dirname, '..', 'environment.ts') + readFileSync, never require.resolve, to guarantee it reads the literal TS source on disk

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
| 260810-jiw | WR-02: behavioral tests proving setEnvironment reaches fetch() host (CORE-04 terminal link) | 2026-08-10 | 4c92b33 | [260810-jiw-wr-02-behavioral-tests-proving-setenviro](./quick/260810-jiw-wr-02-behavioral-tests-proving-setenviro/) |
| 260810-fst | Rewrite README for this plugin (manifest + settings sections); drop starter-kit leftovers | 2026-08-10 | 8bf0a6b | — (gsd-fast, inline) |
| 260810-l0t | Rename UI vocabulary görüşme → konuşma (product name "Yan Görüşmeler" → "Yan Konuşmalar"; yazışma was an intermediate step, superseded) | 2026-08-10 | cf3b68d | [260810-l0t-rename-ui-vocabulary-gorusme-yazisma-yan](./quick/260810-l0t-rename-ui-vocabulary-gorusme-yazisma-yan/) |
| 260810-m8f | Repo-as-host deploy: track build/, disable source maps (.env.production), manifest URL → /build/ | 2026-08-10 | 35b15e7 | [260810-m8f-ship-build-output-from-the-repo-untrack-](./quick/260810-m8f-ship-build-output-from-the-repo-untrack-/) |
| 260817-tn1 | CR-02: standalone dev agent kimliği JWT `sub` claim'inden türetiliyor; hardcoded `DEFAULT_DEV_AGENT_EMAIL`/`NAME` sabitleri kaldırıldı | 2026-08-17 | c6ea10a | [260817-tn1-standalone-dev-de-agent-kimligini-jwt-su](./quick/260817-tn1-standalone-dev-de-agent-kimligini-jwt-su/) |
| 260821-p3c | İlişki field key'i `tu.side_conversation_parent` → `tp.side_conversation_parent`; dahili notlar `comment.channel` "WEB" yerine "INTEGRATION" gönderiyor | 2026-08-21 | 263bbf8 | — (gsd-fast, inline) |
| 260821-itv | Sohbet ekranına manuel `Yenile` (menüde ilk sıra) + gereksiz liste refetch'lerinin temizliği; canlı ölçüm: konuşma açmak 5→1, çöz 10→2 istek | 2026-08-21 | fd8f948 | [260821-itv-chat-ekranina-manuel-yenileme-gereksiz-i](./quick/260821-itv-chat-ekranina-manuel-yenileme-gereksiz-i/) |
| 260902-dhy | Yan konuşma açarken ana talebin markasını (`ts.brand`) devral; disabled markada 422 fallback. Markalı yan talebin e-postası artık markanın support address'inden çıkıyor | 2026-09-02 | b51f66c | [260902-dhy-yan-konusma-acarken-ana-talebin-markasin](./quick/260902-dhy-yan-konusma-acarken-ana-talebin-markasin/) |

### Roadmap Evolution

- Phase 4 edited: ek/attachment kapsamı genişletildi: COMP-08 + THRD-06 eklendi, COMP-05/THRD-05 revize (Base64 varsayımı düzeltildi)
- Phase 5 added: Faz 4 bölündü: ekler Faz 4'te kaldı, talep özeti + önceki görüşmeler + sessiz tazeleme Faz 5'e taşındı
- Phase 04.1 inserted after Phase 4: Ortam yönlendirmesi: sabit .net yerine _grispi_env + dev claim ile çalışma-zamanı çözümleme (prod blocker) (URGENT)
- Phase 04.2 inserted after Phase 4: UAT geri bildirimleri: ilişki notu, ticket navigasyonu, kimlik netliği ve dar/kısa panel dayanıklılığı (URGENT)

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-08-17T16:58:25.438Z
Stopped at: Completed 04.2-04-PLAN.md
Resume file: 
None
