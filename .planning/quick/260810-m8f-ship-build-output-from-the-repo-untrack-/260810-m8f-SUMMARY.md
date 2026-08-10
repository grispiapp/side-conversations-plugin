---
phase: quick-260810-m8f
plan: 01
subsystem: build-deploy
tags: [deploy, build-output, gitignore, source-maps, readme]
dependency-graph:
  requires: []
  provides:
    - "build/ tracked in git as the deploy artifact (repo-as-host model)"
    - ".env.production with GENERATE_SOURCEMAP=false"
  affects:
    - "README.md manifest src and install flow"
tech-stack:
  added: []
  patterns:
    - "CRA production source-map toggle via committed .env.production, not inline shell-prefix (Windows-shell-safe)"
key-files:
  created:
    - .env.production
    - build/ (10 files: index.html, static/js/main.*.js, static/css/main.*.css, asset-manifest.json, favicon.ico, logo192.png, logo512.png, manifest.json, robots.txt, main.*.js.LICENSE.txt)
  modified:
    - .gitignore
    - README.md
decisions:
  - "D-01/D-02/D-03 from PLAN.md executed as written — no deviations"
metrics:
  duration: ~15min
  completed: 2026-08-10
status: complete
---

# Quick Task 260810-m8f: Ship build output from the repo (untrack → track, maps off) Summary

Switched the project from a nonexistent hosting model (README pointed at CRA's
raw `public/` template) to a repo-as-host deploy model: `build/` is now a
committed, map-free (896 KB) production artifact, and `grispi.app` serves it
directly at `/build/`.

## What Was Built

**Task 1 — Stop ignoring the build output, turn source maps off**
- Removed the `# production` / `/build` block from `.gitignore` (no dangling
  header left behind — verified by reading the file back).
- Created `.env.production` with `GENERATE_SOURCEMAP=false`, per D-01 chosen
  over an inline `package.json` script prefix because that form silently
  no-ops on Windows shells.
- `package.json` left untouched (asserted via `git diff --quiet -- package.json`).
- Commit: `bca5dca`

**Task 2 — Rewrite README for the repo-as-host deploy model**
- Manifest `src` in section 1 changed from
  `https://grispi.app/side-conversations-plugin/public/` (wrong — CRA's raw
  template, never worked) to `https://grispi.app/side-conversations-plugin/build/`.
- Section 4 step 1 rewritten: build → `git add build` → commit → push, with no
  third-party host language. Kept the existing `homepage: "."` /
  relative-asset-path explanation intact. Added a blockquote for the D-03
  rebuild-on-source-change drift rule, mentioning `.env.production` in the
  same clause.
- Commit: `4f3f32d`

**Task 3 — Regenerate the build, prove it is clean, stage it explicitly**
- `rm -rf build && CI=true npm run build` (clean rebuild — no stale `.map` or
  orphaned hashed asset could ride along).
- All gates green (see Verification Output below).
- Staged explicitly with `git add .gitignore .env.production README.md build`
  — never `git add -A`. Asserted the staged set contained nothing outside
  those four paths.
- Commit: `35b15e7`

## Deviations from Plan

None — plan executed exactly as written. All three tasks' `<done>` criteria
were met on the first attempt; no auto-fixes, no architectural questions, no
checkpoints.

## Verification Output (literal)

### Task 1 gates
```
NOT_IGNORED
1
GITIGNORE_INTACT
PACKAGE_JSON_UNTOUCHED
```

### Task 2 gates
```
Gate1 (build/ mentions): 2
Gate2 (old public/ URL): 0
Gate3 (netlify|vercel): 0
Gate4 (git add build): 1
Gate5 (homepage): 1
Gate6 (_grispi_env): 5   (unchanged from pre-edit baseline of 5)
```

### Task 3 gates
```
NO_MAP_FILES
NO_MAP_COMMENT
RELATIVE_ASSET_PATHS
896K    build          <- SIZE gate ([ du -sk < 1024 ] passed)
NO_DEV_TOKEN_IN_BUNDLE
Test Suites: 32 passed, 32 total
Tests:       399 passed, 399 total
tsc --noEmit EXIT_CODE=0
UNEXPECTED=''
GATE_OK
STAGED_CLEAN (staged set: 10 build/ files only, no src/, no .planning/)
```

### Plan-level `<verification>` re-run post-commit
```
1) tracked: OK
2) maps: (empty — none found)
3) map comments per file: build/static/js/main.6fd20eeb.js.LICENSE.txt:0
                            build/static/js/main.6fd20eeb.js:0
4) relative paths count: 1
5) size: 896K    build/
6) status: (empty — clean tree, everything committed)
9) old public/ url: 0
```

### Out-of-scope confirmation
- `package.json`: `"homepage": "."` unchanged.
- `src/`: no diff across the three commits.
- CI config: no `.github/` directory exists — nothing to touch.
- `.planning/` history: no diff across the three commits (this SUMMARY itself
  is written after, and per orchestrator instruction is not committed by this
  agent).

## du -sh build/ — before vs. after

- **Before:** 4.3 MB (stale build present in working tree at task start,
  containing the 3.4 MB JS map)
- **After:** **896 KB** — under the plan's ~1 MB target and consistent with
  the expected ~896 KB figure.

## sourceMappingURL comment status

**Confirmed gone.** `grep -rc 'sourceMappingURL' build/static/js/` returns `0`
for both `main.6fd20eeb.js` and `main.6fd20eeb.js.LICENSE.txt` — the emitted
JS carries no trailing map-reference comment, so DevTools will not request a
now-absent `.map` file (no 404 noise).

## Dev-token leak gate (T-m8f-01)

`REACT_APP_DEV_TOKEN` was read from the git-ignored `.env.development.local`
(present locally, 359 bytes) and grepped against the entire `build/` output.
No match — `NO_DEV_TOKEN_IN_BUNDLE`. Structurally expected (that file loads
only at `NODE_ENV=development`, this is a production build) but asserted
rather than assumed, per the plan's threat register.

## Regression Baseline

- Tests: 32 suites / 399 tests passing — unchanged from the stated baseline.
- `npx tsc --noEmit`: exit 0.
- `src/` was not touched by any task in this plan.

## Self-Check: PASSED

- Commit `bca5dca` (Task 1): FOUND
- Commit `4f3f32d` (Task 2): FOUND
- Commit `35b15e7` (Task 3): FOUND
- `.env.production`: FOUND
- `build/index.html`: FOUND
- `README.md` references `side-conversations-plugin/build/`: FOUND
