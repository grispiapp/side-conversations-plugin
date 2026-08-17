---
phase: quick-260817-tn1
plan: 01
subsystem: auth
tags: [jwt, standalone-dev, react, jest]

requires: []
provides:
  - "Standalone dev mode agent identity derived from the activating JWT's own `sub` claim instead of a hardcoded personal email/name pair"
  - "Regression proof that a `null` agentName (the real standalone-dev runtime value) degrades to `senderEmail` without any thread-message.tsx production change"
affects: [standalone-dev, grispi-context, thread-message, README-local-dev]

tech-stack:
  added: []
  patterns:
    - "Identity resolution order: explicit operator override → JWT sub claim → null (never a hardcoded default)"
    - "Untrusted JWT payload fields read with an explicit typeof guard before .trim(), even when the TS interface types the field as string"

key-files:
  created: []
  modified:
    - src/lib/grispi-environment.ts
    - src/lib/standalone-dev.ts
    - src/lib/__tests__/standalone-dev.test.ts
    - src/contexts/grispi-context.tsx
    - src/screens/components/__tests__/thread-components.test.tsx
    - README.md

key-decisions:
  - "agentEmail resolution order is override → sub → null; an empty/whitespace override falls through to sub, it does not force null (proven by a dedicated test)"
  - "agentName has no token source — token payloads never carry a name claim; the only source is REACT_APP_DEV_AGENT_NAME, otherwise null"
  - "sub is read behind typeof rawSub === \"string\" before .trim() — a JSON payload is untrusted input and resolveStandaloneDevConfig runs at module load time, so an unguarded .trim() on a non-string sub would crash the whole tree, not just degrade (T-Q-tn1-02)"

requirements-completed: [UX-05]

coverage:
  - id: D1
    description: "agentEmail is derived from the token's sub claim (override > sub > null), proven for every branch including empty-override-falls-to-sub and non-string-sub-does-not-throw"
    requirement: "UX-05"
    verification:
      - kind: unit
        ref: "src/lib/__tests__/standalone-dev.test.ts#derives agentEmail from the token's sub claim when no override is set"
        status: pass
      - kind: unit
        ref: "src/lib/__tests__/standalone-dev.test.ts#REACT_APP_DEV_AGENT_EMAIL override wins over the token's sub claim"
        status: pass
      - kind: unit
        ref: "src/lib/__tests__/standalone-dev.test.ts#an empty/whitespace-only REACT_APP_DEV_AGENT_EMAIL falls through to sub, not null"
        status: pass
      - kind: unit
        ref: "src/lib/__tests__/standalone-dev.test.ts#agentEmail is null (not throwing) when sub is not a string"
        status: pass
    human_judgment: false
  - id: D2
    description: "agentName has a single source (REACT_APP_DEV_AGENT_NAME); token never contributes a name, so agentEmail resolving from sub never leaks into agentName"
    requirement: "UX-05"
    verification:
      - kind: unit
        ref: "src/lib/__tests__/standalone-dev.test.ts#agentName stays null when agentEmail resolves from sub and no name override is set (no cross-contamination)"
        status: pass
    human_judgment: false
  - id: D3
    description: "null agentName (real standalone-dev runtime value, not just an omitted prop) degrades a pending/own message label to senderEmail, with thread-message.tsx production code unchanged"
    verification:
      - kind: unit
        ref: "src/screens/components/__tests__/thread-components.test.tsx#falls back to senderEmail for a pending optimistic own reply when agentName is explicitly null (standalone dev, no name override)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Stale doc comments naming the deleted DEFAULT_DEV_AGENT_EMAIL/DEFAULT_DEV_AGENT_NAME constants are gone repo-wide; README §5 correctly describes sub-derived identity"
    verification:
      - kind: other
        ref: "grep -rn 'DEFAULT_DEV_AGENT' src -> empty"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-08-17
status: complete
---

# Quick Task 260817-tn1: Standalone Dev Agent Identity from JWT `sub` Summary

**Standalone dev mode's agent email now derives from the activating token's own `sub` claim (override > sub > null); the two hardcoded personal identity constants are gone from source and from every doc comment.**

## Performance

- **Duration:** ~25 min (Task 1 + Task 2)
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `DEFAULT_DEV_AGENT_EMAIL`/`DEFAULT_DEV_AGENT_NAME` deleted from `standalone-dev.ts`; `agentEmail`/`agentName` are `string | null` with no hardcoded fallback
- `agentEmail` resolution order — explicit `REACT_APP_DEV_AGENT_EMAIL` override → JWT `sub` claim (via the existing `parseJwt`) → `null` — locked by 8 new/rewritten tests, including the "empty override falls to sub, not null" ordering proof and the "non-string sub does not throw" crash guard (T-Q-tn1-02)
- `agentName` kept single-sourced to the explicit override (no token claim exists for name); cross-contamination test proves `agentEmail` resolving from `sub` never leaks into `agentName`
- `grispi-context.tsx` doc comments (`agentEmail`/`agentName`) rewritten to describe the sub-claim/override sourcing — no longer name a deleted constant; the `plugin` bridge-selection line and all other code untouched
- New test proves the actual standalone-dev runtime value `agentName={null}` (not merely an omitted prop) falls back to `senderEmail` for a pending own message, without touching `thread-message.tsx`
- README §5 rewritten to describe sub-derived email and override-only name, in place of the old "agent email is optional, see the file" line
- Repo-wide `grep -rn 'DEFAULT_DEV_AGENT' src` returns empty — no stale doc-comment or import residue anywhere

## Task Commits

1. **Task 1: Derive identity from the token's `sub` claim, remove identity constants** - `7471535` (feat, TDD: tests written first)
2. **Task 2: Consumer documentation, null-identity degradation proof, repo-wide residue gate** - `c6ea10a` (docs)

**Plan metadata:** pending (orchestrator commit)

## Files Created/Modified

- `src/lib/grispi-environment.ts` - `DecodedJwt` gains `sub?: string` (one-line type widening; `parseJwt` body untouched)
- `src/lib/standalone-dev.ts` - identity constants removed; `agentEmail`/`agentName` resolved via override → `sub` (typeof-guarded) → `null`; module doc comment updated with the identity-source contract
- `src/lib/__tests__/standalone-dev.test.ts` - identity assertions rewritten in place with a locally copied `makeToken` fixture (test files don't import each other, per repo idiom); environment/tenant/ticket-key tests untouched
- `src/contexts/grispi-context.tsx` - `agentEmail`/`agentName` doc comments updated to describe sub-claim/override sourcing; no code line changed
- `src/screens/components/__tests__/thread-components.test.tsx` - added one test proving `agentName={null}` degrades to `senderEmail`
- `README.md` - §5 local-development paragraph corrected to describe sub-derived email and override-only display name

## Decisions Made

- Identity resolution order fixed as override → `sub` → `null`; verified with a dedicated "empty override falls through to sub" test so the ordering can't silently regress to "empty override → null"
- `sub` is read behind an explicit `typeof rawSub === "string"` guard rather than trusting the `sub?: string` type annotation — the JWT payload is untrusted runtime input and `resolveStandaloneDevConfig` runs at module load time (`grispi-context.tsx:67`), so an unguarded `.trim()` on a non-string `sub` (e.g. a numeric id) would crash the whole React tree, not just fail closed (T-Q-tn1-02)
- `agentName` deliberately has zero token source — the two real payloads inspected during planning carry no name claim, so inventing one would be guessing; the only source is `REACT_APP_DEV_AGENT_NAME`
- New doc comments/README text avoid naming the deleted constants or repeating the removed personal email/name, satisfying the repo-wide `grep -rn 'DEFAULT_DEV_AGENT' src` residue gate

## Deviations from Plan

None - plan executed exactly as written for both tasks. All must-have truths, artifacts, key-links, and prohibitions from the plan frontmatter verified; all threat-register gates (T-Q-tn1-01 through 05, T-Q-tn1-SC) pass.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Out of Scope (documented, per plan)

- **Live probe/verification.** User explicitly declined a live probe for this task; the `sub` = email assumption rests on two previously-inspected real token payloads (documented in the plan's objective, not re-verified this session).
- **Bridge-selection half of CR-02** (`grispi-context.tsx:87`, `standaloneConfig ? null : getPluginInstance()`). Deliberately untouched — separate, riskier concern; after this fix a standalone path winning inside the real iframe writes the operator's own correct identity, not a stranger's, so it's no longer a misattribution bug.
- **Email-format validation on `sub`.** A resolved `sub` that isn't email-shaped (e.g. a bare user id) still passes through as-is; both real tokens inspected during planning had email-shaped `sub` values, and going further was left as a policy call for the user rather than assumed.

## Self-Check

- `src/lib/grispi-environment.ts` FOUND, contains `sub?: string` - verified
- `src/lib/standalone-dev.ts` FOUND, no `DEFAULT_DEV_AGENT*` - verified
- `src/lib/__tests__/standalone-dev.test.ts` FOUND, rewritten in place - verified
- `src/contexts/grispi-context.tsx` FOUND, comments updated - verified
- `src/screens/components/__tests__/thread-components.test.tsx` FOUND, new test present - verified
- `README.md` FOUND, §5 corrected - verified
- Commit `7471535` FOUND in `git log`
- Commit `c6ea10a` FOUND in `git log`
- `CI=true npm test -- --watchAll=false` -> 35 suites, 536 tests, all passed
- `npx tsc --noEmit -p tsconfig.json` -> exit 0
- `grep -rn 'DEFAULT_DEV_AGENT' src` -> empty

## Self-Check: PASSED

## Next Phase Readiness

- CR-02's identity-source half is closed; the bridge-selection half remains a separate, tracked follow-up (see Out of Scope)
- No blockers for other in-flight work; Phase 04.2 (`.planning/phases/04.2-*/`) was not touched, per invariant

---
*Phase: quick-260817-tn1*
*Completed: 2026-08-17*
