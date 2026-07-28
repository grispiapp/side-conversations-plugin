---
phase: 03-g-r-me-detay-ve-ya-am-d-ng-s
plan: 01
subsystem: grispi-api-contract
tags: [grispi-rest, patch, lifecycle, email-thread, html-sanitization]

# Dependency graph
requires:
  - phase: 01-temel-ve-salt-okunur-g-r-me-listesi
    provides: "Authenticated standalone/dev tenant workflow, live ticket/comment/status baselines, and requester/creator identity resolution"
  - phase: 02-yeni-yan-g-r-me-ba-latma
    provides: "Disposable side-ticket model and publicVisible:true outbound-mail contract"
provides:
  - "Sanitized live A1-A6 evidence for public reply, SOLVED, OPEN reopen, mutation responses, quote preservation, and external reactivation"
  - "Resolved Phase 3 research addendum covering all four prior open questions"
  - "Dependency-free DOMParser/TreeWalker sanitizer compatibility proof for the repository toolchain"
affects: [03-02, 03-03, 03-04, 03-05, 03-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lifecycle PATCH bodies are status-only and never carry comment"
    - "Mutation response and canonical GET use distinct fieldMap value shapes; refetch after mutation"
    - "Plain blockquote is the stable quote boundary for inbound split and outbound thread preservation"
    - "One dependency-free DOMParser/TreeWalker allowlist policy at inbound render and outbound send boundaries"

key-files:
  created:
    - .planning/phases/03-g-r-me-detay-ve-ya-am-d-ng-s/03-01-probe-findings.md
  modified:
    - .planning/phases/03-g-r-me-detay-ve-ya-am-d-ng-s/03-RESEARCH.md

key-decisions:
  - "Public HTML PATCH requires Content-Type: application/json; omitting it returns HTTP 400 without creating a comment"
  - "SOLVED uses ts.status value \"4\" and reopen uses OPEN value \"2\"; both omit comment and preserve the comment count"
  - "PATCH returns an 11-key mutation-ticket response whose status value is {id,name}, while canonical GET returns a lean ticket with a string status ID"
  - "First plain blockquote is the quote boundary; provider-specific quote classes are not a supported contract"
  - "No sanitizer package is needed; the repository toolchain supports a dependency-free DOMParser/TreeWalker allowlist"

patterns-established:
  - "Pattern: successful reply/status mutation is followed by canonical GET/list refetch instead of assigning the mutation response to GET-shaped state"
  - "Pattern: current outbound HTML precedes one sanitized blockquote containing required chronological public context; internal notes are excluded"

requirements-completed: []

coverage:
  - id: 03-01-A1-A6
    description: "Live reply/lifecycle PATCH bodies, response shapes, quote marker, and SOLVED reactivation contract"
    requirement: "THRD-02, THRD-03"
    verification:
      - kind: live-contract
        ref: ".planning/phases/03-g-r-me-detay-ve-ya-am-d-ng-s/03-01-probe-findings.md"
        status: pass
      - kind: structural
        ref: "PLAN Task 1 automated verification"
        status: pass
    human_judgment: true
    rationale: "The API proves comments/status/response structure, but actual mailbox delivery presentation and absence of lifecycle notification emails require the blocking Task 2 human review."
  - id: 03-01-sanitizer
    description: "Dependency-free sanitizer compiles and runs against the exact TypeScript/Jest/jsdom baseline"
    requirement: "THRD-01, THRD-02"
    verification:
      - kind: compile
        ref: "TypeScript 4.9.5 strict DOM compile of temporary prototype"
        status: pass
      - kind: unit
        ref: "Jest 27.5.1 / jsdom 16.7.0 temporary compatibility suite (2/2)"
        status: pass
    human_judgment: false

# Metrics
duration: ~13min
completed: 2026-07-28
status: awaiting-human-verification
---

# Phase 03 Plan 01: Live Reply and Lifecycle PATCH Contract Summary

**A redacted live Grispi probe established the exact reply/SOLVED/OPEN contracts, mutation-response shape, blockquote thread preservation, automatic external reactivation, and a package-free sanitizer path.**

## Performance

- **Duration:** ~13 min
- **Tasks:** 1/2 complete; Task 2 is the required blocking human-verification checkpoint
- **Files modified:** 2 Task 1 artifacts, plus this checkpoint summary
- **Live mutations:** One disposable side ticket only

## Accomplishments

- Captured A1–A6 with exact sanitized request bodies and before/after comment/status evidence.
- Proved `Content-Type: application/json` is mandatory for reply PATCH.
- Proved SOLVED `"4"` and reopen OPEN `"2"` are comment-free lifecycle PATCH values.
- Identified the PATCH mutation response as full-ish but not type-identical to canonical GET.
- Demonstrated server-side `SOLVED(4) → OPEN(2)` when a ROLE_END_USER public reply arrives.
- Established plain `<blockquote>` as the stable quote split/preservation boundary and recorded mailbox verification as the human gate.
- Compiled and ran a dependency-free DOMParser/TreeWalker sanitizer prototype under the repository's TypeScript 4.9 and Jest/jsdom baseline.
- Appended four explicit RESOLVED answers to Phase 3 research.
- Scanned committed artifacts for tokens, real email addresses, tenant/ticket identifiers, and bearer values; none were present.

## Task Commits

1. **Task 1: Probe the live reply and lifecycle PATCH contract** — `8dfbb36` (`docs`)
2. **Task 2: Approve the tenant contract before implementation** — pending human approval

## Files Created/Modified

- `.planning/phases/03-g-r-me-detay-ve-ya-am-d-ng-s/03-01-probe-findings.md` — sanitized A1–A6 live request/response, lifecycle, quote, notification, redaction, and sanitizer evidence.
- `.planning/phases/03-g-r-me-detay-ve-ya-am-d-ng-s/03-RESEARCH.md` — all four Open Questions marked RESOLVED with evidence links.
- `.planning/phases/03-g-r-me-detay-ve-ya-am-d-ng-s/03-01-SUMMARY.md` — checkpoint close-out and continuation context.

## Decisions Made

- Use public reply body `{comment:{body,publicVisible:true,creator:[{key:"us.email",value}]}}` with JSON Content-Type.
- Use status-only `{fields:[{key:"ts.status",value:"4"}]}` for SOLVED and value `"2"` for OPEN; never attach a comment.
- Do not assign PATCH response directly to GET-shaped `Ticket` state; use a narrow response type and canonical refetch.
- Treat the first plain blockquote as quoted history; preserve unknown sanitized content instead of deleting it.
- Build the sanitizer without a new dependency and share one allowlist policy across inbound and outbound boundaries.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Disabled Watchman for the temporary sanitizer compatibility suite**

- **Found during:** Task 1 sanitizer compatibility verification
- **Issue:** The first direct Jest run tried to access Watchman's user-state directory and failed under the filesystem sandbox.
- **Fix:** Re-ran the identical Jest 27/jsdom suite with `--no-watchman`.
- **Verification:** 1 suite passed, 2/2 tests passed.
- **Files modified:** None; temporary compatibility files stayed under `/private/tmp`.
- **Committed in:** Not applicable; verification-only adjustment.

---

**Total deviations:** 1 auto-fixed blocking verification issue.  
**Impact on plan:** None; the same runtime assertions passed without Watchman.

## Authentication Gates

None. The existing standalone/dev credential was present and valid. Its value and the tenant identity were never printed or committed.

## Issues Encountered

- Grispi Public API exposes no delivery receipt or notification list for these mutations. API-side evidence proves public-comment creation and the absence of lifecycle comments, while actual delivered-email presentation and absence of status emails remain intentionally gated on human mailbox review.

## Known Stubs

None. This plan changes no production code; the temporary sanitizer prototype was verification-only and was not committed as an implementation.

## User Setup Required

None. Review uses the existing authorized development tenant/mailbox.

## Checkpoint Status

Task 1 is complete. Task 2 must approve:

- the intended reply email was delivered;
- existing thread context appears as the recorded quote/collapsed section;
- SOLVED/reopen created no comment and no email;
- A1–A6 counts/statuses and response-shape conclusions are correct;
- sanitizer compatibility and all four RESOLVED research answers are acceptable;
- both committed artifacts contain no credential, tenant identifier, ticket key, address, name, or unredacted message.

Plans 03-02 onward remain blocked until the user types `approved` or provides corrections.

## Next Phase Readiness

- Server/API contract evidence is ready for Plan 03-02 types and client work.
- Downstream implementation is intentionally blocked on Task 2 human verification.
- No STATE.md or ROADMAP.md update was made; shared tracking remains owned by the phase orchestrator.

## Self-Check: PASSED

- Summary, probe findings, and research files exist and are non-empty.
- Task 1 commit `8dfbb36` exists in git history.
- Structural acceptance command passes with A1–A6 and four RESOLVED answers.
- Credential/PII scan finds no bearer value, dev-token assignment, concrete ticket key, or real email address in the three Plan 03-01 artifacts.
- Task 2 remains explicitly pending; no completion claim was made for the blocked human gate.

---
*Phase: 03-g-r-me-detay-ve-ya-am-d-ng-s*
*Checkpoint prepared: 2026-07-28*
