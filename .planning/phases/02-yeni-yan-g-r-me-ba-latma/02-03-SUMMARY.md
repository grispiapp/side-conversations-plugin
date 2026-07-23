---
phase: 02-yeni-yan-g-r-me-ba-latma
plan: 03
subsystem: ui
tags: [react, mobx, mobx-react-lite, typescript, jest-fake-timers, debounce, autocomplete]

# Dependency graph
requires:
  - phase: 02-yeni-yan-g-r-me-ba-latma
    provides: "Plan 01's grispiAPI.customers.search client + probe-confirmed Customer/CustomerSearchResponse types (3-char searchTerm minimum, content-wrapped envelope); Plan 02's ComposeScreen shell + panelNavigation.requestBack wiring"
provides:
  - "ComposeStore — debounced (300ms), generation-guarded customers.search + recipient/subject form state"
  - "RecipientField — 5-state customer-search dropdown (idle/loading/results/no-results/invalid-email) + free-email fallback row"
  - "SubjectField — editable subject input with non-blocking empty-subject warning"
  - "ComposeScreen wired to both fields + one-time subject prefill from the active ticket"
affects: ["02-04 (message/submit flow reads compose.recipientEmail/recipientLabel/subject)", "02-05 (Gönder button disabled-state reads compose.showFreeEmailRow/recipientEmail; MessageField sits below SubjectField)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Generation-guard debounce (RESEARCH.md Pattern 1) adapted from SideConversationsStore.load() to a user-typed search query instead of a ticket-key-triggered fetch"
    - "jest.useFakeTimers() first introduced this plan — CRA/react-scripts' bundled Jest 27.5.1 config does NOT expose jest.advanceTimersByTimeAsync (legacy timers), so debounce tests use jest.advanceTimersByTime() + a manual 3x Promise.resolve() microtask flush instead"
    - "No-combobox-analog component built from the existing Input primitive + a plain cn()-styled absolute dropdown div (Radix Popover explicitly rejected per RESEARCH.md)"

key-files:
  created:
    - src/store/compose-store.ts
    - src/store/__tests__/compose-store.test.ts
    - src/screens/components/recipient-field.tsx
    - src/screens/components/subject-field.tsx
  modified:
    - src/store/root-store.ts
    - src/screens/compose-screen.tsx

key-decisions:
  - "showFreeEmailRow reduces to isValidEmail(trimmedQuery) whenever searchStatus is no-results (results is always empty there) — implemented the plan's literal 'invalid warning vs Sonuç bulunamadı' branch pair anyway for spec completeness even though the Sonuç-bulunamadı branch is currently unreachable given that equivalence"
  - "Selected-recipient 'clear' affordance reuses existing store methods (selectFreeEmail(\"\") + setQuery(\"\")) instead of adding a new ComposeStore method not specified anywhere in this plan or Plan 04/05 — keeps the store's public surface exactly what the plan/downstream plans reference"
  - "ComposeScreen's subject-prefill title source reads an optional, untyped `ticket.subject` defensively (Ticket type has no subject field, confirmed live per Pitfall #6) — today it always resolves to \"\", so the live behavior is exactly `[<TALEP_ANAHTARI>]` with no title, which formatPrefillSubject's trim() handles cleanly (D-09's boş-başlık toleransı)"

patterns-established:
  - "Debounced+generation-guarded MobX search store as the reusable template for any future typeahead in this codebase (only one instance so far, but the shape is now proven end-to-end with fake-timer tests)"

requirements-completed: [COMP-02, COMP-03]

coverage:
  - id: D1
    description: "ComposeStore.setQuery debounces 300ms, gates below the live-enforced 3-char searchTerm minimum, and generation-guards stale search responses"
    requirement: "COMP-02"
    verification:
      - kind: unit
        ref: "src/store/__tests__/compose-store.test.ts#does not search below the live-enforced 3-character minimum (D-04) / fires a single debounced customers.search call / ignores a stale search response via the generation-guard"
        status: pass
    human_judgment: false
  - id: D2
    description: "Search error and zero-match paths both degrade to the generic no-results state without ever capturing error.body/status (T-02-03)"
    requirement: "COMP-02"
    verification:
      - kind: unit
        ref: "src/store/__tests__/compose-store.test.ts#sets no-results on a zero-match search / degrades a search error to the generic no-results state"
        status: pass
    human_judgment: false
  - id: D3
    description: "showFreeEmailRow, selectRecipient (with D-06 name-fallback), and selectFreeEmail behave per spec"
    requirement: "COMP-02"
    verification:
      - kind: unit
        ref: "src/store/__tests__/compose-store.test.ts#showFreeEmailRow is true only for a valid, currently-unmatched email / selectRecipient sets recipientEmail-recipientLabel / selectFreeEmail sets both fields"
        status: pass
    human_judgment: false
  - id: D4
    description: "initSubject sets the subject exactly once (D-09) and setSubject always updates freely afterward"
    requirement: "COMP-03"
    verification:
      - kind: unit
        ref: "src/store/__tests__/compose-store.test.ts#initSubject sets the subject exactly once and never overwrites on a later call"
        status: pass
    human_judgment: false
  - id: D5
    description: "RecipientField renders all 5 dropdown states (idle/loading/results/free-email-row/invalid-email) and SubjectField shows the editable input + empty-subject warning; ComposeScreen wires both fields and fires the one-time subject prefill on [ticket?.key]"
    requirement: "COMP-02"
    verification:
      - kind: unit
        ref: "CI=true npx tsc --noEmit"
        status: pass
    human_judgment: true
    rationale: "No React Testing Library render test exercises RecipientField/SubjectField/ComposeScreen visually or interactively this plan (the plan's <verify> block only specifies the compose-store test + a typecheck) — typecheck proves the components compile and bind to the right store fields/props, not that the dropdown states, keyboard nav, or subject prefill actually render correctly in the browser. Deferred to Plan 05's UAT pass (per the plan's own acceptance criteria: 'observable (Plan 05 UAT): compose açılınca konu ... dolu gelir')."

# Metrics
duration: ~12min
completed: 2026-07-23
status: complete
---

# Phase 02 Plan 03: Alıcı Otomatik-Tamamlama + Konu Ön-Doldurma Summary

**ComposeStore'un debounce'lu (300ms), generation-guard'lı `customers.search` entegrasyonu; RecipientField'ın 5 durumlu (idle/loading/results/no-results/invalid-email) dropdown'u + serbest e-posta satırı; ve konu alanının `[<TALEP_ANAHTARI>] <Başlık>` ile tek seferlik ön-doldurulması.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3
- **Files modified:** 6 (4 new, 2 modified)

## Accomplishments

- `ComposeStore` — Plan 01's live-probe-confirmed `customers.search` (3-char `searchTerm` minimum, content-wrapped envelope) wired behind a 300ms debounce + `SideConversationsStore.load()`-style generation-guard, so a slower/older keystroke's response can never overwrite a faster/newer one's
- Search errors and zero-match results both degrade to the same generic `"no-results"` state — `error.body`/`status` are never captured, rendered, or logged (T-02-03)
- `showFreeEmailRow`, `selectRecipient` (D-06 name-fallback to email), `selectFreeEmail` (D-05), and a once-only `initSubject` guard (D-09) — all covered by 9 passing unit tests, including the codebase's first `jest.useFakeTimers()` usage
- `RecipientField` — no combobox analog existed in this codebase; built from `Input` + a plain `cn()`-styled absolute dropdown panel (Radix Popover explicitly rejected per RESEARCH.md), with keyboard-navigable results (arrow keys + Enter) as baseline a11y
- `SubjectField` — editable subject input with a non-blocking "Konu boş — e-posta konusuz gönderilecek." warning (D-10)
- `ComposeScreen` now renders both fields and fires `compose.initSubject(formatPrefillSubject(ticket.key, ticketTitle))` once per mounted ticket via the same `[ticket?.key]` effect-bridging pattern `ConversationsListScreen` already uses

## Task Commits

Each task was committed atomically:

1. **Task 1: ComposeStore — debounce'lu/generation-guard'lı arama + form durumu** - `34cca95` (feat, TDD)
2. **Task 2: RecipientField (5 durumlu dropdown) + SubjectField (prefill)** - `0f24f26` (feat)
3. **Task 3: ComposeScreen'e alan yerleşimi + konu prefill bağlama** - `0d1d654` (feat)

## Files Created/Modified

- `src/store/compose-store.ts` (NEW) - `ComposeStore` class: debounced/generation-guarded `customers.search`, `showFreeEmailRow`, `selectRecipient`/`selectFreeEmail`, once-only `initSubject`/`setSubject`
- `src/store/__tests__/compose-store.test.ts` (NEW) - 9 tests covering the 3-char gate, debounce firing, stale-response race, zero-match/error degradation, `showFreeEmailRow`, recipient/free-email selection, and `initSubject`'s once-guard
- `src/store/root-store.ts` - wired `compose: ComposeStore` alongside the existing stores
- `src/screens/components/recipient-field.tsx` (NEW) - 5-state dropdown (idle/loading/results/no-results/invalid-email) + free-email row + keyboard nav
- `src/screens/components/subject-field.tsx` (NEW) - editable subject input + empty-subject warning
- `src/screens/compose-screen.tsx` - renders `RecipientField`/`SubjectField`; mount effect fires the one-time subject prefill

## Decisions Made

- `showFreeEmailRow` is provably equivalent to `isValidEmail(trimmedQuery)` whenever `searchStatus === "no-results"` (results is always empty in that state) — implemented both the invalid-email-warning and "Sonuç bulunamadı" branches anyway per the plan's literal action text, for spec completeness and future-proofing even though the latter is currently unreachable
- The selected-recipient "clear"/change affordance reuses `selectFreeEmail("")` + `setQuery("")` rather than adding a new store method — no plan or downstream plan (04/05) references a dedicated clear method, so the store's public surface stays exactly what was specified
- `ComposeScreen`'s subject-prefill title source reads an optional, untyped `ticket.subject` defensively (the `Ticket` type has no subject field — confirmed live per `01-02-probe-findings.md` Pitfall #6); today this always resolves to `""`, so the live prefill is `[<TALEP_ANAHTARI>]` with no title, cleanly handled by `formatPrefillSubject`'s trim (D-09's "boş-başlık toleransı")
- `jest.advanceTimersByTimeAsync` is unavailable under CRA/react-scripts' bundled Jest 27.5.1 — the debounce tests advance timers synchronously (`jest.advanceTimersByTime`) and manually flush the microtask queue (3x `await Promise.resolve()`) instead

## Deviations from Plan

None - plan executed exactly as written. All acceptance-criteria greps (`searchGeneration` ≥ 2, `compose` in root-store.ts ≥ 2, `adresini kullan` ≥ 1, `initSubject`/`formatPrefillSubject` present) pass, and both verification commands (`craco test --testPathPattern=compose-store`, `tsc --noEmit`) are green.

## Issues Encountered

- `jest.advanceTimersByTimeAsync` (used in the plan's read_first note as the intended fake-timer mechanism) does not exist in this project's bundled Jest 27.5.1 — resolved by advancing timers synchronously and manually flushing microtasks (see "Decisions Made"); no behavior change to the store, test-infrastructure-only.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `compose.recipientEmail`/`recipientLabel`/`subject` are ready for Plan 04's `submit(agentEmail, parentKey)` to consume when building the `CreateTicketRequest`
- Plan 05's UAT pass should visually confirm the RecipientField's 5 dropdown states and the subject prefill in the browser — this plan's automated coverage is limited to `tsc --noEmit` for the component layer (see coverage D5's `human_judgment: true` rationale)
- No blockers for subsequent plans in this phase

---
*Phase: 02-yeni-yan-g-r-me-ba-latma*
*Completed: 2026-07-23*

## Self-Check: PASSED

All 6 created/modified source files and all 3 task commit hashes (`34cca95`, `0f24f26`, `0d1d654`) verified present on disk / in git log.
