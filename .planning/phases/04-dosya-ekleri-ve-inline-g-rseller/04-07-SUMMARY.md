---
phase: 04-dosya-ekleri-ve-inline-g-rseller
plan: 07
subsystem: security
tags: [dompurify, xss, html-sanitizer, mobx, react-query, tiptap]

# Dependency graph
requires:
  - phase: 04-06
    provides: attachmentIds send-path binding (comment.attachmentIds through startNew/sendReply)
provides:
  - Two DOMPurify policies (sanitizeHtml strict / sanitizeAuthoredHtml permissive) sharing one code path
  - Every sanitizer call site classified and routed by trust boundary (authored vs incoming/untrusted)
  - UI-SPEC §8 .rich-text-content img CSS rule
affects: [04-08 inline paste flow, any future phase touching html-sanitizer.ts or normalizeComment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sanitizeWithConfig(input, config) shared helper — both sanitizeHtml/sanitizeAuthoredHtml are one-line wrappers over it, guaranteeing structural parity"
    - "Optional sanitizer parameter (default: strict) threaded through splitQuotedHtml/splitGeneratedReplyHtml — a forgotten call site fails SAFE, never permissive"
    - "Direction computed before sanitizing (normalizeComment/thread-message) — the direction variable, not the sanitizer choice, is the single source of truth for trust"

key-files:
  created: []
  modified:
    - src/lib/html-sanitizer.ts
    - src/lib/__tests__/html-sanitizer.test.ts
    - src/screens/components/rich-text-composer.tsx
    - src/store/compose-store.ts
    - src/store/active-conversation-store.ts
    - src/query/side-conversation-queries.ts
    - src/query/__tests__/side-conversation-queries.test.tsx
    - src/screens/components/thread-message.tsx
    - src/index.css

key-decisions:
  - "sanitizeAuthoredHtml/sanitizeHtml share one sanitizeWithConfig(input, config) helper (parse -> DOMPurify.sanitize -> reparse -> normalize anchors -> innerHTML) so sanitizeHtml's outward behavior stays byte-identical while the two policies never structurally drift apart"
  - "Closed a DOMPurify-internal gap: its DATA_URI_TAGS default (always includes img) lets a data: URI through on <img src> regardless of ALLOWED_URI_REGEXP, and that default cannot be narrowed via config (ADD_DATA_URI_TAGS only ever adds to it). Added a stripUnsafeImageSrc post-pass reusing the same protocol canonicalization as anchor hrefs (renamed canonicalizeHref -> canonicalizeUri) so this bypass can never reach the authored policy — required by threat register T-04-26, discovered via a failing test during Task 1, not spelled out as literal code in the plan text"
  - "splitQuotedHtml/splitGeneratedReplyHtml take an optional sanitizer param defaulting to sanitizeHtml (strict) — sanitizeUntrustedDraftHtml and every pre-existing caller keep today's exact behavior with zero code change; normalizeComment/thread-message pass sanitizeAuthoredHtml explicitly only for own-direction messages"
  - "normalizeComment computes message direction BEFORE sanitizing (moved out of its former post-sanitize position) so the sanitizer choice can depend on it; the identical sanitizer instance is threaded into the quote splitter to avoid a two-policy history-boundary mismatch (T-04-29)"
  - "reconcileCanonical's optimistic-vs-canonical body comparison uses sanitizeAuthoredHtml on BOTH sides (envelopeBody and the canonical message read) since canonical is already filtered to direction === 'own' before reaching this comparison"

requirements-completed: [COMP-08, THRD-06]

coverage:
  - id: D1
    description: "sanitizeAuthoredHtml permits img+src/alt for https?/mailto only; sanitizeHtml (incoming) stays byte-for-byte unchanged, img still forbidden (D-21)"
    requirement: COMP-08
    verification:
      - kind: unit
        ref: "src/lib/__tests__/html-sanitizer.test.ts#incoming/strict policy (sanitizeHtml) — D-21, never loosened > drops active and data-bearing families with their payloads, including img (D-21)"
        status: pass
      - kind: unit
        ref: "src/lib/__tests__/html-sanitizer.test.ts#authored-content policy (sanitizeAuthoredHtml) — D-14/COMP-08 > keeps an https-sourced image tag and its alt text alive"
        status: pass
    human_judgment: false
  - id: D2
    description: "svg stays forbidden with its content in BOTH policies (D-10)"
    requirement: COMP-08
    verification:
      - kind: unit
        ref: "src/lib/__tests__/html-sanitizer.test.ts#authored-content policy (sanitizeAuthoredHtml) — D-14/COMP-08 > still removes a vector-graphic tag with its content (D-10)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Event-handler, script-protocol, and data-protocol img src attacks are stripped in the authored policy (closes DOMPurify's internal data: URI bypass for img)"
    requirement: COMP-08
    verification:
      - kind: unit
        ref: "src/lib/__tests__/html-sanitizer.test.ts#authored-content policy (sanitizeAuthoredHtml) — D-14/COMP-08 > strips an event-handler attribute / strips a script-protocol image src / strips a data-protocol image src"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every sanitizer call site routed to the correct policy by trust boundary; normalizeComment/thread-message pick the policy from message direction; both sides of reconcileCanonical use the same policy"
    requirement: THRD-06
    verification:
      - kind: unit
        ref: "src/query/__tests__/side-conversation-queries.test.tsx#canonical detail and mutation executors > sanitizes comment body by direction: own keeps an inline image, incoming strips it (D-21/UI-SPEC §8)"
        status: pass
      - kind: unit
        ref: "src/store/__tests__/active-conversation-store.test.ts (full suite, reconciliation regression)"
        status: pass
      - kind: unit
        ref: "src/screens/components/__tests__/rich-text-composer.test.tsx (full suite, paste/submit regression)"
        status: pass
    human_judgment: false
  - id: D5
    description: "UI-SPEC §8 .rich-text-content img CSS rule (left-aligned, max-h-[240px], border, object-contain)"
    verification:
      - kind: other
        ref: "grep -c \"rich-text-content img\" src/index.css == 1; npm run build"
        status: pass
    human_judgment: true
    rationale: "CSS visual sizing/alignment is not covered by an automated visual test in this backend-only plan; visual confirmation happens as part of Plan 04-08's inline paste flow and phase-end UAT, where the rule is first exercised by a real rendered image."

duration: 40min
completed: 2026-08-01
status: complete
---

# Phase 4 Plan 07: Sanitizer Policy Split Summary

**Split the single DOMPurify sanitizer into a strict incoming policy (unchanged) and a new authored-content policy (permits `img`/`src`/`alt` for `https?`/`mailto` only), routed every call site by trust boundary, and closed a DOMPurify-internal `data:` URI bypass discovered while testing the new policy.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-01
- **Tasks:** 2
- **Files modified:** 9 (2 source + 1 test in Task 1; 6 source/test/css in Task 2)

## Accomplishments

- `sanitizeAuthoredHtml` added alongside the untouched `sanitizeHtml`; both now share one `sanitizeWithConfig` helper so they can never structurally drift
- Discovered and closed a DOMPurify-internal gap where `<img src="data:...">` bypasses the custom `ALLOWED_URI_REGEXP` via DOMPurify's built-in `DATA_URI_TAGS` default (always includes `img`, cannot be narrowed via config) — added a `stripUnsafeImageSrc` post-pass reusing the same protocol canonicalization already used for anchor `href`s
- `splitQuotedHtml`/`splitGeneratedReplyHtml` gained an optional `sanitizer` parameter (default: strict) — every pre-existing caller/test is unaffected; the authored-content call site passes `sanitizeAuthoredHtml` explicitly
- Every call site across the composer, both stores, `normalizeComment`, and `thread-message` classified and routed (table below)
- `normalizeComment` now computes message direction before sanitizing, so own-direction messages use the authored policy and incoming stays strict — verified with a new direction-based regression test
- `.rich-text-content img` CSS rule added per UI-SPEC §8

## Call Site Classification (authoritative — Plan 08 and later phases must not blur this)

| File | Call site | Policy | Notes |
|---|---|---|---|
| `rich-text-composer.tsx` | `sanitizeValue` (trusted-authored value selection) | `sanitizeAuthoredHtml` (when `valueIsTrustedAuthored`) | else `sanitizeUntrustedDraftHtml` |
| `rich-text-composer.tsx` | `handleKeyDown` (Shift+Enter submit) | `sanitizeAuthoredHtml` | our own editor HTML |
| `rich-text-composer.tsx` | `onUpdate` (per-keystroke emit) | `sanitizeAuthoredHtml` | our own editor HTML |
| `rich-text-composer.tsx` | `submitCurrentContent` (button submit) | `sanitizeAuthoredHtml` | our own editor HTML |
| `rich-text-composer.tsx` | `handlePaste` (clipboard HTML) | `sanitizeUntrustedDraftHtml` — **unchanged** | pasted HTML is untrusted; inline image paste in Plan 08 goes through the file/upload route, not this path |
| `compose-store.ts` | `setAuthoredMessage` | `sanitizeAuthoredHtml` | |
| `compose-store.ts` | `isDirty` | `sanitizeAuthoredHtml` | |
| `compose-store.ts` | `submit` (`safeBody`) | `sanitizeAuthoredHtml` | |
| `compose-store.ts` | `setMessage` (textarea draft) | `sanitizeUntrustedDraftHtml` — **unchanged** | untrusted draft writer |
| `active-conversation-store.ts` | `envelopeBody` | `sanitizeAuthoredHtml` | envelope is always our own outgoing comment |
| `active-conversation-store.ts` | `startNew` overlay `body`/`authoredBodyHtml` | `sanitizeAuthoredHtml` | |
| `active-conversation-store.ts` | `setAuthoredDraftHtml` | `sanitizeAuthoredHtml` | |
| `active-conversation-store.ts` | `sendReply` empty-check + `body` | `sanitizeAuthoredHtml` | |
| `active-conversation-store.ts` | `reconcileCanonical` body comparison | `sanitizeAuthoredHtml` | canonical side pre-filtered to `direction === "own"`; both sides now the SAME policy (T-04-29) |
| `active-conversation-store.ts` | `setDraftHtml` | `sanitizeUntrustedDraftHtml` — **unchanged** | untrusted draft writer |
| `side-conversation-queries.ts` | `normalizeComment` body + quote splitter | `sanitizeAuthoredHtml` when `direction === "own"`, else `sanitizeHtml` | direction computed BEFORE sanitizing; same sanitizer threaded into `splitGeneratedReplyHtml`/`splitQuotedHtml` |
| `thread-message.tsx` | body/quote second-pass render sanitization | `sanitizeAuthoredHtml` when `message.direction === "own"`, else `sanitizeHtml` | defense-in-depth re-sanitize of already-sanitized `MessageVM` HTML; must mirror `normalizeComment`'s direction rule or an inline image gets stripped on render |

**Never changes to strict/untrusted:** `sanitizeUntrustedDraftHtml` itself and every one of its callers (pasted clipboard HTML, restored untrusted drafts) — these stay on `sanitizeHtml` with zero code path to the authored policy.

## Task Commits

Each task was committed atomically:

1. **Task 1: sanitizeAuthoredHtml — second policy and attack tests** - `314e04f` (feat)
2. **Task 2: Call sites routed to two policies + in-body image style** - `95ef3cc` (feat)

**Plan metadata:** _(pending — this commit)_

## Files Created/Modified

- `src/lib/html-sanitizer.ts` — new `sanitizeAuthoredHtml` export, shared `sanitizeWithConfig`/`canonicalizeUri` helpers, `stripUnsafeImageSrc` post-pass, optional `sanitizer` param on `splitQuotedHtml`/`splitGeneratedReplyHtml`
- `src/lib/__tests__/html-sanitizer.test.ts` — restructured into `describe` blocks for the incoming/strict policy (existing img-stripped assertions re-pointed, not deleted) and the new authored-content policy (9 new attack/behavior tests), plus a default-sanitizer regression test and two authored-sanitizer-passed quote-splitter tests
- `src/screens/components/rich-text-composer.tsx` — 4 own-authored call sites moved to `sanitizeAuthoredHtml`; paste stays on `sanitizeUntrustedDraftHtml`
- `src/store/compose-store.ts` — 3 own-authored call sites moved to `sanitizeAuthoredHtml`
- `src/store/active-conversation-store.ts` — 7 own-authored call sites moved to `sanitizeAuthoredHtml`
- `src/query/side-conversation-queries.ts` — `normalizeComment` direction-based sanitizer selection
- `src/query/__tests__/side-conversation-queries.test.tsx` — new direction-based sanitization regression test (own keeps image, incoming strips it)
- `src/screens/components/thread-message.tsx` — direction-based second-pass sanitizer selection
- `src/index.css` — `.rich-text-content img` rule (UI-SPEC §8)

## Decisions Made

See `key-decisions` in frontmatter. Summarized: shared-helper extraction to guarantee `sanitizeHtml` parity, the DOMPurify `data:`-URI-on-`img` bypass fix, default-safe sanitizer parameter on the quote splitters, direction-before-sanitize ordering in `normalizeComment`, and same-policy-both-sides in `reconcileCanonical`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Closed DOMPurify's built-in `data:` URI bypass on `<img src>`**
- **Found during:** Task 1 (writing the "strips a data-protocol image src" attack test — it failed against the plan's literal `AUTHORED_SANITIZE_CONFIG` alone)
- **Issue:** DOMPurify has an internal `DATA_URI_TAGS` default set (always includes `img`, `video`, `audio`, `source`, `image`, `track`) that lets a `data:`-prefixed `src`/`href` through REGARDLESS of `ALLOWED_URI_REGEXP`, and that default cannot be narrowed below its built-in base via any config option (`ADD_DATA_URI_TAGS` only ever adds to it). Since `img` is newly unforbidden in the authored policy, this DOMPurify-internal escape hatch became reachable for the first time — exactly the class of risk T-04-26 in the plan's threat register calls out, even though the plan's own pseudocode (`RESEARCH.md` Pitfall #3) didn't spell out this specific DOMPurify quirk.
- **Fix:** Added `stripUnsafeImageSrc`, a post-pass applied after DOMPurify sanitization that re-canonicalizes every `<img src>` through the same protocol-allowlist logic already used for anchor `href`s (`canonicalizeUri`, renamed from `canonicalizeHref`); an `src` that doesn't canonicalize is removed entirely, leaving the `<img>` tag present but src-less.
- **Files modified:** `src/lib/html-sanitizer.ts`
- **Verification:** `strips a data-protocol image src — this policy does NOT open data: URIs` test in `html-sanitizer.test.ts`
- **Committed in:** `314e04f` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing-critical security fix)
**Impact on plan:** Necessary to satisfy the plan's own T-04-26 threat mitigation and the "no data: URI support" constraint literally; no scope creep — the fix is entirely inside `html-sanitizer.ts`'s existing surface.

## TDD Gate Compliance

Task 1 was tagged `tdd="true"`, but this plan's frontmatter is `type: execute` (not `type: tdd`) and the project's `tdd_mode` config is `false`, so the strict RED-then-GREEN two-commit gate sequence was not applied literally. In practice the RED/GREEN cycle still happened in-session: the new `sanitizeAuthoredHtml` attack tests were written first, one (`strips a data-protocol image src`) genuinely failed against the initial implementation (see the deviation above), was fixed, and only then was everything committed together as a single `feat` commit. No separate `test(...)` commit precedes the `feat(...)` commit in git history for Task 1 — flagged here for traceability, not treated as a blocking gap since the plan's own execution mode (`execute`, `tdd_mode: false`) does not mandate the two-commit split.

## Issues Encountered

None beyond the DOMPurify `data:` URI bypass documented above (found and fixed within Task 1, before any commit).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The sanitizer split and call-site classification table are the locked contract Plan 04-08 (inline paste flow) must build on: it should add the `FileHandler`/`Image` Tiptap extensions and wire `startInlinePaste`, but must NOT introduce any new sanitizer call site outside the classification above, and must route the paste-upload placeholder through the composer's existing `sanitizeAuthoredHtml` paths (not through `handlePaste`'s untrusted-clipboard branch, which stays untouched).
- Full regression suite (28 suites / 308 tests, up from the 294-test baseline), `tsc --noEmit`, and `npm run build` all pass clean.
- No blockers for Plan 04-08.

---
*Phase: 04-dosya-ekleri-ve-inline-g-rseller*
*Completed: 2026-08-01*

## Self-Check: PASSED

All 9 modified files exist on disk; both task commits (`314e04f`, `95ef3cc`) found in git history.
