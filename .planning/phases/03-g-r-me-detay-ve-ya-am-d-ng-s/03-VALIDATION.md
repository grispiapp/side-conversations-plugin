---
phase: 3
slug: g-r-me-detay-ve-ya-am-d-ng-s
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-28
---

# Phase 3 — Validation Strategy

## Test Infrastructure

| Property | Value |
|---|---|
| Framework | CRA bundled Jest 27 + React Testing Library patterns |
| Quick run | `npm test -- --watchAll=false` (targeted path during task work) |
| Full suite | `npm test -- --watchAll=false` |

## Sampling Rate

- After each task: targeted affected Jest suite.
- After each wave and before phase verification: full non-watch suite.

## Per-Task Verification Map

| Area | Requirements | Automated verification |
|---|---|---|
| PATCH client/types | THRD-02, THRD-03 | URL, method, authenticated reply/status-only payload and response-shape tests |
| Thread lifecycle | THRD-01, THRD-02 | chronological messages, generation guards, retry/refetch, incoming/own/internal classification |
| HTML safety/editor | THRD-01, THRD-02 | sanitizer allowlist, unsafe HTML/link removal, keyboard and editor state tests |
| Resolve/reopen | THRD-03 | no optimistic status flip, SOLVED/reopen state, failure retry, focus signal |
| Seen/badge split | THRD-04 | localStorage write resilience; seen external remains action-required; solved suppression |

## Manual-Only Verifications

| Behavior | Requirement | Test instructions |
|---|---|---|
| Live Grispi PATCH contract | THRD-02, THRD-03 | Probe reply, SOLVED and reopen bodies/response against tenant before hardening types. |
| 372px UI and native email behavior | THRD-01..04 | Verify quote disclosure, rich editor cap, internal note style, no email on status changes. |

## Validation Sign-Off

- [x] Every requirement has automated coverage or explicit tenant UAT.
- [x] Existing Jest infrastructure covers the phase; no Wave 0 install needed.
- [x] `nyquist_compliant: true`
