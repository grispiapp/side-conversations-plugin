---
phase: quick-260810-jiw
plan: 01
subsystem: testing
tags: [jest, http-handler, environment-routing, mutation-testing, core-04]

# Dependency graph
requires:
  - phase: 04.1
    provides: HttpHandler.setEnvironment / GrispiAPI.setEnvironment (CORE-04 environment routing), safe-side prod default
provides:
  - "Behavioral proof that HttpHandler.setEnvironment reaches fetch() in both send() and sendMultipart(), for all three environments"
  - "Behavioral proof that GrispiAPI.setEnvironment delegates to its private httpHandler, observed end-to-end through a real tickets.getTicket call"
  - "Empirical mutation-probe evidence (3 probes) proving the new tests are RED against a no-op setEnvironment and a corrupted host constant, not just present"
affects: [04.1-VERIFICATION.md re-verification, future client/ test additions]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Mutation-probe discipline: break source in-place, run tests, record red output, git checkout -- restore, confirm green — never committed"]

key-files:
  created:
    - src/grispi/client/__tests__/api.test.ts
  modified:
    - src/grispi/client/__tests__/http-handler.test.ts

key-decisions:
  - "api.test.ts created as a new file rather than appended to http-handler.test.ts, matching the repo's one-test-file-per-client-module convention — api.ts was the only client module with no dedicated test file"
  - "Expected host strings hardcoded as literals in both test files, never looked up via GRISPI_BASE_URLS[env], to avoid a circular assertion that a swapped constant could sail through"
  - "Preprod (non-default) chosen as the api.test.ts treatment environment, not prod, so the assertion is sensitive to both the GrispiAPI-delegation mutant and the HttpHandler no-op mutant simultaneously"

patterns-established:
  - "Switch-back / last-write-wins test pairs (prod->preprod and preprod->prod) as the standard way to make a setEnvironment-style test mutation-resistant against a no-op implementation, since a fresh instance already defaults to the value a naive single-direction test would check"

requirements-completed: [CORE-04]

coverage:
  - id: D1
    description: "HttpHandler.setEnvironment changes the host fetch() uses in send(), for preprod/prod/prod_tr, including last-write-wins switch-back in both directions"
    requirement: "CORE-04"
    verification:
      - kind: unit
        ref: "src/grispi/client/__tests__/http-handler.test.ts#HttpHandler.setEnvironment -> fetch host (CORE-04 terminal link, WR-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "HttpHandler.setEnvironment changes the host fetch() uses in sendMultipart() — an independent template-literal read site from send()"
    requirement: "CORE-04"
    verification:
      - kind: unit
        ref: "src/grispi/client/__tests__/http-handler.test.ts#HttpHandler.setEnvironment -> fetch host (CORE-04 terminal link, WR-02) > sendMultipart"
        status: pass
    human_judgment: false
  - id: D3
    description: "GrispiAPI.setEnvironment delegates to its private httpHandler, observed end-to-end through a real tickets.getTicket call"
    requirement: "CORE-04"
    verification:
      - kind: unit
        ref: "src/grispi/client/__tests__/api.test.ts#GrispiAPI.setEnvironment -> private httpHandler delegation (CORE-04, WR-02)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Empirical mutation-probe evidence that the new tests are RED against a no-op HttpHandler.setEnvironment, a no-op GrispiAPI.setEnvironment, and a corrupted prod_tr host constant — proving mutation resistance, not just presence"
    verification: []
    human_judgment: true
    rationale: "The probe RED/GREEN transcript is recorded below and is the closure evidence for 04.1-VERIFICATION.md's behavior_unverified_items[0]; re-verification (a separate GSD step, not automated here) is the appropriate place to sign off that this evidence satisfies the finding."

duration: 25min
completed: 2026-08-10
status: complete
---

# Quick Task 260810-jiw: WR-02 behavioral tests proving setEnvironment Summary

**Added 11 behavioral tests (9 to http-handler.test.ts, 2 to new api.test.ts) proving `setEnvironment` actually changes the `fetch()` host end-to-end, then empirically confirmed via 3 mutation probes that these tests go RED against a no-op `setEnvironment` and a corrupted host constant — closing WR-02.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-10T10:55:00Z (approx.)
- **Completed:** 2026-08-10T11:12:29Z
- **Tasks:** 3
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments
- `http-handler.test.ts` gained a new `describe` block with 9 tests: a default-host control, 3 `send()` rows (preprod/prod/prod_tr), 3 `sendMultipart()` rows (independent template-literal read site), and 2 switch-back/last-write-wins tests (prod→preprod, preprod→prod) — the actual mutation killers.
- New `api.test.ts` (the only client module previously without a test file) proves `GrispiAPI.setEnvironment` delegates to its private `httpHandler`, observed through a real `tickets.getTicket` call, using a non-default (`preprod`) treatment environment plus a prod-default control.
- All expected host strings are hardcoded literals (`"https://api.grispi.net"`, `"https://api.grispi.com"`, `"https://api.grispi.com.tr"`) — never looked up via `GRISPI_BASE_URLS[env]` — verified by grep returning 0 matches of `GRISPI_BASE_URLS` in `api.test.ts` and ≥1 literal-host matches in `http-handler.test.ts`.
- Ran 3 mutation probes against the real source files (`http-handler.ts`, `api.ts`, `environment.ts`), recorded verbatim red output for each, restored every file with `git checkout --`, and re-confirmed green after each — see Mutation Probe Results below.
- Baseline 388 tests intact; suite grew to 32 suites / 399 tests, all passing; `npx tsc --noEmit` exits 0 throughout.

## Task Commits

Each task was committed atomically:

1. **Task 1: Prove setEnvironment reaches fetch() in both send() and sendMultipart()** - `65fc510` (test)
2. **Task 2: Prove GrispiAPI.setEnvironment actually delegates to its private httpHandler** - `4c92b33` (test)
3. **Task 3: Mutation probes** - no commit (all edits were throwaway probes on `http-handler.ts`/`api.ts`/`environment.ts`, each restored via `git checkout --` before the next probe; nothing new to stage — the deliverable is the recorded red/green evidence below, not a diff)

**Plan metadata:** committed by orchestrator (docs commit, per constraints — this executor does not commit docs artifacts)

## Files Created/Modified
- `src/grispi/client/__tests__/http-handler.test.ts` - Appended `describe("HttpHandler.setEnvironment -> fetch host (CORE-04 terminal link, WR-02)")` with 9 new tests; the 10 pre-existing tests (3 in `HttpHandler.send`, 7 in `HttpHandler.sendMultipart`) untouched, including the `GRISPI_BASE_URLS[DEFAULT_ENVIRONMENT]` assertion at line ~122.
- `src/grispi/client/__tests__/api.test.ts` - NEW. Proves `GrispiAPI.setEnvironment` delegation via a real `tickets.getTicket` call against a mocked `fetch`; 2 tests (treatment on `preprod`, control with no `setEnvironment` call).

## Mutation Probe Results

Each probe: edit made → tests run → red output recorded verbatim below → `git checkout -- <file>` → tests re-run to confirm green. `git status --porcelain` over the three source files was empty both before Task 3 started and after Step 4's gate, and remained empty for the rest of the session (verified again after the final full-suite run).

| Probe | Edit | Tests that went RED | Tests that stayed GREEN | Restored? |
|-------|------|----------------------|---------------------------|-----------|
| A (headline) | Emptied `HttpHandler.setEnvironment`'s body in `http-handler.ts` (left the method as a no-op) | `http-handler.test.ts`: `send()` preprod row, `send()` prod_tr row, `sendMultipart()` preprod row, `sendMultipart()` prod_tr row, prod→preprod switch-back (5 of 9 new). `api.test.ts`: the treatment (`preprod` delegation) test (1 of 2). **Total: 6 of 11 new tests red.** | `http-handler.test.ts`: default-host control, both `prod`-row tests (send + sendMultipart), and the preprod→prod switch-back (this direction alone cannot detect the no-op mutant, as documented in its own comment — confirmed empirically here). `api.test.ts`: the control test. All 10 pre-existing `http-handler.test.ts` tests. | Yes — `git checkout -- src/grispi/client/http-handler.ts`; re-run confirmed 21/21 green. |
| B (headline) | Emptied `GrispiAPI.setEnvironment`'s body in `api.ts` (stopped delegating to `httpHandler`) | `api.test.ts`: the treatment (`preprod` delegation) test only (1 of 2). | `api.test.ts`'s control test. **All 19 tests in `http-handler.test.ts` stayed entirely green** — concrete proof `api.test.ts` had to exist as its own artifact; `http-handler.test.ts` cannot see a `GrispiAPI`-level delegation bug since it never touches `GrispiAPI`. | Yes — `git checkout -- src/grispi/client/api.ts`; re-run confirmed 21/21 green. |
| C (non-circularity) | In `environment.ts`, pointed `prod_tr` at the `.com` host (collided with `prod`) | `http-handler.test.ts`: `send()` prod_tr row, `sendMultipart()` prod_tr row (2 of 9 new). | Everything else, including both switch-back tests (neither direction touches `prod_tr`), both `prod` rows, both `preprod` rows, the default control, all 10 pre-existing tests, and both `api.test.ts` tests (that file never exercises `prod_tr`). | Yes — `git checkout -- src/grispi/client/environment.ts`; re-run confirmed 21/21 green. |

### Verbatim red output

**Probe A:**
```
● HttpHandler.setEnvironment -> fetch host (CORE-04 terminal link, WR-02) › send() fetches against the preprod host after setEnvironment(https://api.grispi.net)
    Expected: "https://api.grispi.net/public/v1/tickets/DESTEK-1"
    Received: "https://api.grispi.com/public/v1/tickets/DESTEK-1"

● HttpHandler.setEnvironment -> fetch host (CORE-04 terminal link, WR-02) › send() fetches against the prod_tr host after setEnvironment(https://api.grispi.com.tr)
    Expected: "https://api.grispi.com.tr/public/v1/tickets/DESTEK-1"
    Received: "https://api.grispi.com/public/v1/tickets/DESTEK-1"

● HttpHandler.setEnvironment -> fetch host (CORE-04 terminal link, WR-02) › sendMultipart() fetches against the preprod host after setEnvironment(https://api.grispi.net) — independent read site from send()
    Expected: "https://api.grispi.net/attachments/upload"
    Received: "https://api.grispi.com/attachments/upload"

● HttpHandler.setEnvironment -> fetch host (CORE-04 terminal link, WR-02) › sendMultipart() fetches against the prod_tr host after setEnvironment(https://api.grispi.com.tr) — independent read site from send()
    Expected: "https://api.grispi.com.tr/attachments/upload"
    Received: "https://api.grispi.com/attachments/upload"

● HttpHandler.setEnvironment -> fetch host (CORE-04 terminal link, WR-02) › switch-back: setEnvironment(prod) then setEnvironment(preprod) ends on the preprod host — the mutation killer
    Expected: "https://api.grispi.net/public/v1/tickets/DESTEK-1"
    Received: "https://api.grispi.com/public/v1/tickets/DESTEK-1"

● GrispiAPI.setEnvironment -> private httpHandler delegation (CORE-04, WR-02) › delegates setEnvironment('preprod') to the private httpHandler, observed through a real tickets.getTicket call
    Expected: "https://api.grispi.net/public/v1/tickets/DESTEK-1"
    Received: "https://api.grispi.com/public/v1/tickets/DESTEK-1"

Test Suites: 2 failed, 2 total
Tests:       6 failed, 15 passed, 21 total
```

**Probe B:**
```
● GrispiAPI.setEnvironment -> private httpHandler delegation (CORE-04, WR-02) › delegates setEnvironment('preprod') to the private httpHandler, observed through a real tickets.getTicket call
    Expected: "https://api.grispi.net/public/v1/tickets/DESTEK-1"
    Received: "https://api.grispi.com/public/v1/tickets/DESTEK-1"

Test Suites: 1 failed, 1 passed, 2 total  (http-handler.test.ts: 1 passed 19/19 green; api.test.ts: 1 failed)
Tests:       1 failed, 20 passed, 21 total
```

**Probe C:**
```
● HttpHandler.setEnvironment -> fetch host (CORE-04 terminal link, WR-02) › send() fetches against the prod_tr host after setEnvironment(https://api.grispi.com.tr)
    Expected: "https://api.grispi.com.tr/public/v1/tickets/DESTEK-1"
    Received: "https://api.grispi.com/public/v1/tickets/DESTEK-1"

● HttpHandler.setEnvironment -> fetch host (CORE-04 terminal link, WR-02) › sendMultipart() fetches against the prod_tr host after setEnvironment(https://api.grispi.com.tr) — independent read site from send()
    Expected: "https://api.grispi.com.tr/attachments/upload"
    Received: "https://api.grispi.com/attachments/upload"

Test Suites: 1 failed, 1 passed, 2 total  (api.test.ts: 1 passed 2/2 green; http-handler.test.ts: 2 failed, 17 passed)
Tests:       2 failed, 19 passed, 21 total
```

## Decisions Made
- `api.test.ts` created as a new file, matching the repo's one-test-file-per-client-module convention (`attachments.test.ts`, `tickets.test.ts`, `http-handler.test.ts`) — `api.ts` was the only client module with no dedicated test file, itself part of what WR-02 reported.
- Expected host values hardcoded as literals in both test files (never `GRISPI_BASE_URLS[env]`) to keep the assertions non-circular; `api.test.ts` additionally imports nothing from `../environment` at all.
- Comments referencing the "shared host-map constant" instead of the literal string `GRISPI_BASE_URLS` inside `api.test.ts`'s doc-comment, once the `grep -c 'GRISPI_BASE_URLS'` verification check (done criteria: must return 0) surfaced that the comment prose itself was matching the grep. This is a wording-only fix to satisfy the plan's stated verification command; no code or assertion changed.
- Treatment environment for `api.test.ts` chosen as `preprod` (non-default) rather than `prod`, per the plan's explicit design rationale — a `prod` treatment would pass against both the delegation-mutant and the no-op mutant, proving nothing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `api.test.ts` doc-comment wording tripped its own non-circularity grep check**
- **Found during:** Task 2 verification (`grep -c 'GRISPI_BASE_URLS' src/grispi/client/__tests__/api.test.ts` returned 2, not the required 0)
- **Issue:** The doc-comment explaining the non-circularity rule used the literal string `GRISPI_BASE_URLS` twice in prose ("never GRISPI_BASE_URLS[env] lookups", "no GRISPI_BASE_URLS import"), which the plan's own grep-based done-criterion treats as a hard failure since it's a literal string match, not a code-usage check.
- **Fix:** Reworded the comment to describe "the shared host-map constant in environment.ts" instead of writing the identifier out, and confirmed the file still imports nothing from `../environment`.
- **Files modified:** `src/grispi/client/__tests__/api.test.ts`
- **Verification:** `grep -c 'GRISPI_BASE_URLS' src/grispi/client/__tests__/api.test.ts` now returns 0; re-ran the 2 tests (still pass) and `npx tsc --noEmit` (still exits 0).
- **Committed in:** `4c92b33` (Task 2 commit — caught before commit, so the fix is baked into the single Task 2 commit, not a separate one)

---

**Total deviations:** 1 auto-fixed (1 bug — wording only, no behavioral or assertion change)
**Impact on plan:** No scope creep; purely satisfies the plan's own stated verification command.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- WR-02's stated gap is closed: both headline mutants (`HttpHandler.setEnvironment` no-op, `GrispiAPI.setEnvironment` no-op) are empirically proven to turn the new tests RED, and the non-circularity of the host-literal assertions is empirically proven via Probe C.
- This SUMMARY's Mutation Probe Results table is the closure evidence for `04.1-VERIFICATION.md`'s `behavior_unverified_items[0]` — re-verification (a separate, later GSD step) should read this table directly rather than re-deriving it.
- No production source file changed in the committed diff: `git status --porcelain -- src/grispi/client/http-handler.ts src/grispi/client/api.ts src/grispi/client/environment.ts` is empty as of this SUMMARY.
- Other deferred findings (WR-03, WR-04, WR-05, IN-02, IN-03, and the stale `REQUIREMENTS.md` line 83) remain untouched, as scoped.

---
*Phase: quick-260810-jiw*
*Completed: 2026-08-10*

## Self-Check: PASSED

- FOUND: `src/grispi/client/__tests__/api.test.ts`
- FOUND: `src/grispi/client/__tests__/http-handler.test.ts`
- FOUND: `.planning/quick/260810-jiw-wr-02-behavioral-tests-proving-setenviro/260810-jiw-SUMMARY.md`
- FOUND commit `65fc510` (Task 1)
- FOUND commit `4c92b33` (Task 2)
- Confirmed `git status --porcelain -- src/grispi/client/http-handler.ts src/grispi/client/api.ts src/grispi/client/environment.ts` empty (all mutation probes restored)
