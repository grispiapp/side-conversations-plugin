---
phase: quick-260810-jiw
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/grispi/client/__tests__/http-handler.test.ts
  - src/grispi/client/__tests__/api.test.ts
autonomous: true
requirements: [CORE-04]
quick: true
test_only: true
closes:
  - "04.1-REVIEW.md WR-02"
  - "04.1-VERIFICATION.md behavior_unverified_items[0]: 'GrispiEnvironment key -> HttpHandler.baseUrl mutation -> actual fetch() host'"

must_haves:
  truths:
    - "A test proves that after `handler.setEnvironment(env)`, the URL passed to `fetch` by `send()` uses that environment's host — for all three environments."
    - "A test proves the same for `sendMultipart()`, whose `this.baseUrl` read is a SEPARATE template literal that a regression could break independently."
    - "A test proves last-write-wins: `setEnvironment('prod')` then `setEnvironment('preprod')` ends on the preprod host. This is the assertion that goes RED against a no-op `setEnvironment`; the standalone `prod` row cannot, because prod is already the class default."
    - "A test proves `GrispiAPI.setEnvironment` actually delegates to its PRIVATE `httpHandler`, observed end-to-end through a real `api.tickets.getTicket` call."
    - "Every expected host is a hardcoded literal, never `GRISPI_BASE_URLS[env]` — a typo'd or swapped constant must fail the test rather than travel through it."
    - "Emptying `HttpHandler.setEnvironment`'s body turns tests RED; emptying `GrispiAPI.setEnvironment`'s body turns tests RED. Both proven empirically, both source files restored."
    - "No file under `src/grispi/client/` outside `__tests__/` is modified — the production code is correct; only the evidence was missing."
    - "The pre-existing 388 tests all still pass; no existing test is rewritten."
  artifacts:
    - "src/grispi/client/__tests__/http-handler.test.ts — new `describe` block naming WR-02/CORE-04, covering send + sendMultipart + switch-back"
    - "src/grispi/client/__tests__/api.test.ts — NEW file, GrispiAPI.setEnvironment delegation proven through a real sub-service call"
  key_links:
    - "handler.setEnvironment(env) -> setBaseUrl -> this.baseUrl -> `${this.baseUrl}/${url}` in send() -> fetchSpy.mock.calls[0][0]"
    - "handler.setEnvironment(env) -> this.baseUrl -> `${this.baseUrl}/${url}` in sendMultipart() (independent read site)"
    - "new GrispiAPI().setEnvironment('preprod') -> private httpHandler.setEnvironment -> tickets.getTicket -> http.send -> fetch URL starts with the preprod host"
    - "hardcoded literal host strings in the test <-> GRISPI_BASE_URLS values in environment.ts (deliberately NOT linked by import — the gap is closed by duplication, not by lookup)"
---

<objective>
Close code-review finding **WR-02** (`04.1-REVIEW.md`), which is the single
`behavior_unverified` item in `04.1-VERIFICATION.md`'s frontmatter.

Nothing under `src/` ever calls the real `HttpHandler.setEnvironment` or
`GrispiAPI.setEnvironment`. Grep confirms the only `setEnvironment` occurrences in
test files are `jest.fn()` stubs in `plugin-bootstrap.test.ts` and
`grispi-context.test.tsx` — those prove the method is *called*, never that it
*works*. `http-handler.test.ts` asserts only the CLASS-DEFAULT baseUrl reaches
`fetch` (line 122-124, via `GRISPI_BASE_URLS[DEFAULT_ENVIRONMENT]`), never a
post-`setEnvironment` value. `GrispiAPI.setEnvironment`'s delegation to its private
`httpHandler` has no test at all.

Consequence, stated plainly in the review: if `HttpHandler.setEnvironment` were an
empty method, or if `GrispiAPI.setEnvironment` forgot to delegate, **every test in
phase 04.1 would still be green while 100% of traffic went to the default host** —
which this phase changed from preprod to prod, so a preprod tenant would silently
talk to PRODUCTION. CORE-04's runtime correctness currently rests on inspection of
three short methods, not on behavioral evidence.

Purpose: give the terminal link of CORE-04's chain (environment key -> `baseUrl`
mutation -> actual `fetch` host) its first real test, and prove the tests are
mutation-resistant rather than merely present.

Output: an extended `http-handler.test.ts` and a new `api.test.ts`, plus recorded
empirical proof that each headline mutant goes RED.

**Scope: TEST-ONLY.** `http-handler.ts`, `api.ts`, and `environment.ts` are correct
as written and must end this task byte-identical to how they started. The finding
is about missing evidence, not a bug.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./.claude/CLAUDE.md

@src/grispi/client/http-handler.ts
@src/grispi/client/environment.ts
@src/grispi/client/api.ts
@src/grispi/client/tickets.ts
@src/grispi/client/authentication.ts
@src/grispi/client/__tests__/http-handler.test.ts
@src/grispi/client/__tests__/tickets.test.ts
</context>

<interface_context>

**The chain under test (already read, do not re-read):**

- `HttpHandler.baseUrl: string` — public class field, initialized to
  `GRISPI_BASE_URLS[DEFAULT_ENVIRONMENT]`, and `DEFAULT_ENVIRONMENT` is `"prod"`.
  **A fresh `new HttpHandler()` is already on the prod host.** This is the single
  most important fact for designing mutation-resistant assertions.
- `HttpHandler.setEnvironment(environment: GrispiEnvironment)` — calls
  `this.setBaseUrl(GRISPI_BASE_URLS[environment])`.
- `HttpHandler.send<T>(url, options)` — calls `fetch(\`${this.baseUrl}/${url}\`, ...)`.
- `HttpHandler.sendMultipart<T>(url, formData, extraHeaders)` — calls
  `fetch(\`${this.baseUrl}/${url}\`, ...)` via its **own separate** template
  literal. Method is `POST`, `cache: "no-cache"`, headers = `extraHeaders` only.
- `GRISPI_BASE_URLS` = `{ preprod: "https://api.grispi.net", prod:
  "https://api.grispi.com", prod_tr: "https://api.grispi.com.tr" }`.
- `GrispiAPI` — constructor builds one `private httpHandler` and hands the SAME
  instance to `authentication`, `tickets`, `users`, `customers`, `attachments`
  (all `readonly` public). `setEnvironment` delegates to `this.httpHandler`.
- `Authentication` — `setToken(t)` sets `headers.Authorization = \`Bearer ${t}\``,
  `setTenantId(id)` sets `headers.tenantId`.
- `Tickets.getTicket(key)` — `http.send<Ticket>(\`public/v1/tickets/${encodeURIComponent(key)}\`,
  { method: "GET", cache: "no-cache", headers: this.auth.headers })`.
  `"DESTEK-1"` encodes to itself.
- `export const grispiAPI = new GrispiAPI()` — module-level singleton. **Do not use
  it in tests**; a mutated environment would leak across tests in the same file.

**Existing test idioms in this repo (follow them):**

- `jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, status: 200, json: () =>
  Promise.resolve({}) } as unknown as Response)` — the `as unknown as Response` cast
  is required and already used throughout `http-handler.test.ts`.
- `afterEach(() => { jest.restoreAllMocks(); })` in every `describe`.
- Read the fetch args as `const [url, options] = fetchSpy.mock.calls[0];`.
- `it.each([...] as const)("... %s ...", (a, b) => ...)` — see `tickets.test.ts:32`
  and `tickets.test.ts:211`.
- Sub-service tests build their own `new HttpHandler()` + `new Authentication(http)`
  + `auth.setToken("test-token")` / `auth.setTenantId("test-tenant")` — see
  `tickets.test.ts:84-90`.

</interface_context>

<tasks>

<task type="auto">
  <name>Task 1: Prove setEnvironment reaches fetch() in both send() and sendMultipart()</name>
  <files>src/grispi/client/__tests__/http-handler.test.ts</files>
  <action>
APPEND one new `describe` block to the end of the file. Do not modify, reorder, or
rewrite any of the eight existing tests — in particular leave the existing
`GRISPI_BASE_URLS[DEFAULT_ENVIRONMENT]` assertion at lines 122-124 exactly as is.
Leave the existing line-1 import untouched (it is still used by that test). Add no
new imports beyond `HttpHandler` if it is somehow not already imported — it is.

Name the block so its purpose is greppable, e.g.
`describe("HttpHandler.setEnvironment -> fetch host (CORE-04 terminal link, WR-02)", ...)`.
Give it the same `beforeEach` (`handler = new HttpHandler()`) and
`afterEach` (`jest.restoreAllMocks()`) shape as the two existing blocks.

**Hard design constraint — hardcode the host literals.** Expected values are the
string literals `"https://api.grispi.net"`, `"https://api.grispi.com"`,
`"https://api.grispi.com.tr"`. NEVER derive an expectation from
`GRISPI_BASE_URLS[env]` inside this new block: looking the expected value up from
the same constant the implementation reads is circular, and a swapped constant (say
prod_tr pointing at the .com host) would sail straight through. This finding exists
partly because those three hosts are asserted nowhere in the repo. Duplication is
the point here — write a short comment saying so.

Declare the env→host table ONCE at module scope, e.g.
`const ENVIRONMENT_HOSTS = [["preprod", "..."], ["prod", "..."], ["prod_tr", "..."]] as const;`
and feed it to both `it.each` blocks below. If Jest 27's `it.each` typings reject a
`readonly` tuple array pulled from a const binding, fall back to inlining the same
literal table in each `it.each` call — duplicated literals are acceptable and
reinforce the non-circularity requirement. Do not weaken the `as const`.

Write these tests:

1. `it.each(ENVIRONMENT_HOSTS)` over `send()` — call `handler.setEnvironment(env)`,
   then `await handler.send("public/v1/tickets/DESTEK-1", { method: "GET" })`
   against a mocked `global.fetch`, and assert `fetchSpy.mock.calls[0][0]` equals
   `` `${host}/public/v1/tickets/DESTEK-1` ``.

2. `it.each(ENVIRONMENT_HOSTS)` over `sendMultipart()` — same three environments,
   `await handler.sendMultipart("attachments/upload", new FormData(), {})`, assert
   the first fetch arg equals `` `${host}/attachments/upload` ``. Mock the response
   as `{ ok: true, status: 201, json: () => Promise.resolve([]) }`. Comment WHY this
   is not redundant with test 1: `sendMultipart` reads `this.baseUrl` through its
   own separate template literal, so a regression can hit one path and not the other.

3. A control: a fresh `new HttpHandler()` whose `baseUrl` is asserted to be the
   literal prod host BEFORE `setEnvironment` is ever called. This is what makes the
   `prod` rows above interpretable — and it is the only place in the repo that pins
   the default host to a literal.

4. **Switch-back / last-write-wins, both directions.** These are the mutation
   killers; comment them as such:
   - `setEnvironment("prod")` then `setEnvironment("preprod")`, then `send(...)` →
     expect the preprod host. Comment: this is THE test that goes red against an
     emptied `setEnvironment` body. A single `setEnvironment("prod")` assertion
     cannot do that job, because a fresh handler is already on prod — that row
     proves nothing on its own.
   - `setEnvironment("preprod")` then `setEnvironment("prod")`, then `send(...)` →
     expect the prod host. Comment: proves the `prod` branch of the lookup is
     genuinely consumed (the handler had to travel back from a non-default host),
     which the standalone `prod` row cannot show. Note explicitly that this
     direction alone does NOT kill the no-op mutant — that is the previous test's
     job — so neither may be deleted as "redundant".

Follow the repo's comment convention: dense, explaining WHY, citing the requirement
(CORE-04) and finding (WR-02), and naming the mutant each test kills.
  </action>
  <verify>
    <automated>CI=true npm test -- --watchAll=false src/grispi/client/__tests__/http-handler.test.ts</automated>
    <automated>grep -c 'api\.grispi\.com\.tr' src/grispi/client/__tests__/http-handler.test.ts</automated>
    <automated>grep -c 'api\.grispi\.net' src/grispi/client/__tests__/http-handler.test.ts</automated>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>
`http-handler.test.ts` passes with 8 pre-existing + 9 new tests (3 send rows, 3
multipart rows, 1 default control, 2 switch-back), 0 failures. Both greps return
≥ 1 (the literal hosts are present in the test file rather than looked up).
`npx tsc --noEmit` exits 0. `git diff --stat` shows this test file as the only
changed file.
  </done>
</task>

<task type="auto">
  <name>Task 2: Prove GrispiAPI.setEnvironment actually delegates to its private httpHandler</name>
  <files>src/grispi/client/__tests__/api.test.ts</files>
  <action>
CREATE a new test file. **Placement rationale (decide-and-record):** put this in a
new `api.test.ts` rather than in `http-handler.test.ts`. The subject under test is
`GrispiAPI`, a different module with different fixture needs (auth headers, a real
sub-service), and this directory already follows one-test-file-per-client-module
(`attachments.test.ts`, `tickets.test.ts`, `http-handler.test.ts`) — `api.ts` is the
only client module with no test file at all, which is itself part of what WR-02
reports. Note this choice briefly in the SUMMARY.

`httpHandler` is `private`, so the only honest proof of delegation is end-to-end:
observe the URL that a real sub-service call hands to `fetch`.

Write a single `describe` naming CORE-04 / WR-02, with `afterEach(() =>
jest.restoreAllMocks())`, containing two tests:

1. **Treatment.** Construct `const api = new GrispiAPI()` — a FRESH instance, never
   the exported `grispiAPI` singleton, so a mutated environment cannot leak into any
   other test. Set `api.authentication.setToken("test-token")` and
   `api.authentication.setTenantId("test-tenant")` (mirroring `tickets.test.ts`'s
   fixture). Spy on `global.fetch` returning `{ ok: true, status: 200, json: () =>
   Promise.resolve({}) }`. Call `api.setEnvironment("preprod")`, then
   `await api.tickets.getTicket("DESTEK-1")`. Assert the first fetch arg equals the
   hardcoded literal `"https://api.grispi.net/public/v1/tickets/DESTEK-1"`.
   Comment WHY preprod specifically: it is a NON-default environment, so this single
   assertion goes red both when `GrispiAPI.setEnvironment` stops delegating and when
   `HttpHandler.setEnvironment` becomes a no-op. Had the test used `prod` it would
   pass against both mutants, since a fresh `GrispiAPI` already sits on the prod host.

2. **Control.** A fresh `new GrispiAPI()` with the same auth fixture and fetch spy,
   NO `setEnvironment` call, `await api.tickets.getTicket("DESTEK-1")` → assert the
   prod-host URL literal. This makes test 1's result attributable to
   `setEnvironment` rather than to some ambient default, and pins the safe-side
   default at the composed-API level.

Import only `GrispiAPI` from `../api`. Do not import `GRISPI_BASE_URLS` or
`DEFAULT_ENVIRONMENT` into this file at all — same non-circularity rule as Task 1;
absence of that import is itself the guard. Importing `../api` constructs the
module-level `grispiAPI` singleton as a side effect; that is harmless (the
constructor issues no network calls) and needs no `jest.resetModules`.
  </action>
  <verify>
    <automated>CI=true npm test -- --watchAll=false src/grispi/client/__tests__/api.test.ts</automated>
    <automated>grep -c 'GRISPI_BASE_URLS' src/grispi/client/__tests__/api.test.ts || true</automated>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>
`api.test.ts` exists and passes with 2 tests, 0 failures. The `GRISPI_BASE_URLS`
grep returns 0 matches (no circular lookup). `npx tsc --noEmit` exits 0.
  </done>
</task>

<task type="auto">
  <name>Task 3: Mutation probes — empirically prove the new tests fail against broken source, then restore</name>
  <files>src/grispi/client/http-handler.ts (temporary probe, restored), src/grispi/client/api.ts (temporary probe, restored), src/grispi/client/environment.ts (temporary probe, restored)</files>
  <action>
Mutation resistance is the acceptance bar for this task. A test that passes against
a no-op implementation reproduces exactly the gap WR-02 describes, so "the tests are
green" proves nothing on its own. Run these probes and record the results.

**Every probe follows the same discipline:** make the edit, run the tests, observe
RED, then immediately `git checkout -- <file>` and re-run to confirm GREEN again.
Probe edits are throwaway and MUST NEVER be committed. Never leave more than one
probe applied at a time.

Step 0 — Baseline. Run `CI=true npm test -- --watchAll=false` and `npx tsc --noEmit`.
Record suite/test counts. Expect 32 suites (31 baseline + the new `api.test.ts`) and
≥ 399 tests (388 baseline + 9 from Task 1 + 2 from Task 2), 0 failures, tsc exit 0.

Step 1 — **Probe A (headline): empty `HttpHandler.setEnvironment`.** Delete the
single statement in `setEnvironment`'s body in `src/grispi/client/http-handler.ts`,
leaving the method present but doing nothing. Run both new test files. This MUST
fail. Record which test names went red — expect at minimum the preprod and prod_tr
rows of both `it.each` blocks, the prod→preprod switch-back test, and both
`api.test.ts` tests. Confirm the prod-only rows and the default-host control still
pass, and note that as evidence for why the switch-back test is load-bearing.
Restore: `git checkout -- src/grispi/client/http-handler.ts`. Re-run → green.

Step 2 — **Probe B (headline): remove `GrispiAPI` delegation.** Empty the body of
`setEnvironment` in `src/grispi/client/api.ts`. Run the full suite. `api.test.ts`'s
treatment test MUST fail. `http-handler.test.ts` MUST stay entirely green — record
this, because it is the concrete demonstration that `api.test.ts` had to exist as a
separate artifact and is not redundant coverage.
Restore: `git checkout -- src/grispi/client/api.ts`. Re-run → green.

Step 3 — **Probe C (non-circularity): corrupt a host constant.** In
`src/grispi/client/environment.ts`, point the `prod_tr` entry at the plain `.com`
host so it collides with `prod`. Run both new test files. The `prod_tr` rows MUST
fail. This is the proof that hardcoding literals (rather than reading
`GRISPI_BASE_URLS[env]`) actually detects a swapped constant — the exact scenario a
circular assertion would have hidden.
Restore: `git checkout -- src/grispi/client/environment.ts`. Re-run → green.

Step 4 — **Restore gate.** Run
`git status --porcelain -- src/grispi/client/http-handler.ts src/grispi/client/api.ts src/grispi/client/environment.ts`
and confirm it prints NOTHING. If it prints anything, a probe was not restored — fix
before going further. Then run `git status --porcelain -- src/` and confirm the only
entries are the two test files from Tasks 1 and 2.

Step 5 — Full suite + type check once more, then commit with an explicit file
allowlist naming only the two test paths. Never `git add -A` in this task.

Record all three probe outcomes (which tests went red, which stayed green) in the
SUMMARY — that record IS the closure evidence for
`04.1-VERIFICATION.md`'s `behavior_unverified_items[0]`.

Do NOT edit `04.1-VERIFICATION.md`; re-verification owns that file. Do NOT touch the
other deferred findings (WR-03 public `setBaseUrl`, WR-04 `switchTicket` typed void,
WR-05 `invocationCallOrder` strength, IN-02, IN-03, or the stale `REQUIREMENTS.md`
line 83).
  </action>
  <verify>
    <automated>CI=true npm test -- --watchAll=false</automated>
    <automated>npx tsc --noEmit</automated>
    <automated>test -z "$(git status --porcelain -- src/grispi/client/http-handler.ts src/grispi/client/api.ts src/grispi/client/environment.ts)"</automated>
  </verify>
  <done>
All three probes executed and their red/green outcomes recorded in the SUMMARY.
Probe A turned `http-handler.test.ts` AND `api.test.ts` red; Probe B turned only
`api.test.ts` red; Probe C turned the prod_tr rows red. All three source files
restored — the `git status --porcelain` check produces empty output. Full suite:
32 suites, ≥ 399 tests, 0 failures (all 388 pre-existing tests still pass, none
rewritten). `npx tsc --noEmit` exits 0. Commit touches only the two test files.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| working tree → git history | Task 3 deliberately breaks production source in-place; the commit boundary is where a probe could escape |
| test fixtures → committed repo | credentials/tokens embedded in test files become permanent history |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-Q-jiw-01 | Tampering | `http-handler.ts` / `api.ts` / `environment.ts` probe edits (Task 3) | high | mitigate | Each probe is restored with `git checkout -- <file>` immediately after observing RED, then re-run to confirm GREEN. Task 3 Step 4 gates on `git status --porcelain` over all three files printing nothing, and the commit uses an explicit two-path allowlist — never `git add -A`. An escaped Probe A would ship a no-op `setEnvironment`, i.e. the exact CORE-04 failure this plan exists to detect. |
| T-Q-jiw-02 | Information Disclosure | auth fixtures in `api.test.ts` | low | accept | Uses the literal placeholders `"test-token"` / `"test-tenant"`, identical to the existing `tickets.test.ts` fixture. No real tenant id, JWT, or bearer token enters the repo. |
| T-Q-jiw-03 | Tampering | cross-test state leakage via the `grispiAPI` module singleton | medium | mitigate | Every test constructs `new GrispiAPI()` / `new HttpHandler()`; the exported singleton is never mutated, so no test can leave another on the wrong host. `jest.restoreAllMocks()` in `afterEach` prevents a leaked `global.fetch` spy within the file. |
| T-Q-jiw-SC | Tampering | supply chain | low | accept | Zero package-manager installs — no npm/pip/cargo dependency is added, removed, or upgraded by this task, so no legitimacy gate applies. |
</threat_model>

<verification>
1. `CI=true npm test -- --watchAll=false` → 32 suites, ≥ 399 tests, 0 failures.
2. `npx tsc --noEmit` → exit 0.
3. `git status --porcelain -- src/` → exactly two entries:
   `src/grispi/client/__tests__/http-handler.test.ts` (modified) and
   `src/grispi/client/__tests__/api.test.ts` (new).
4. `grep -c 'GRISPI_BASE_URLS' src/grispi/client/__tests__/api.test.ts` → 0.
5. SUMMARY records all three probe outcomes with the specific test names that
   turned red.
</verification>

<success_criteria>
- WR-02's stated gap is closed: `HttpHandler.setEnvironment` and
  `GrispiAPI.setEnvironment` are each exercised for real, and the resulting `fetch`
  host is asserted.
- Both headline mutants (emptied `HttpHandler.setEnvironment`, emptied
  `GrispiAPI.setEnvironment`) were empirically confirmed to turn the new tests RED,
  and both source files were restored.
- All three Grispi host literals are asserted somewhere in the repo for the first
  time, without circular lookup through `GRISPI_BASE_URLS`.
- No production source file changed in the committed diff.
- The 388-test baseline is intact; no existing test was rewritten.
</success_criteria>

<output>
Create `.planning/quick/260810-jiw-wr-02-behavioral-tests-proving-setenviro/260810-jiw-SUMMARY.md` when done.

The SUMMARY must include a **Mutation Probe Results** section with one row per probe
(A / B / C): the edit made, the tests that went red, the tests that stayed green,
and confirmation of restore. That table is the closure evidence for
`04.1-VERIFICATION.md`'s `behavior_unverified_items[0]` and will be read by
re-verification.
</output>
