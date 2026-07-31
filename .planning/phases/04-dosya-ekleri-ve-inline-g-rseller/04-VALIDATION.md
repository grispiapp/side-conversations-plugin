---
phase: 4
slug: dosya-ekleri-ve-inline-g-rseller
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-31
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `04-RESEARCH.md` § Validation Architecture (source-verified against the live repo).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest `27.5.1` (bundled via `react-scripts@5.0.1`, invoked through `craco test`) |
| **Config file** | none dedicated — CRA built-in Jest config via `craco.config.js` |
| **Test library** | **No `@testing-library/react`** — component tests use raw `react-dom/client` `createRoot` + `act()` + manual DOM querying (pattern: `src/screens/components/__tests__/rich-text-composer.test.tsx`). Do NOT introduce RTL in this phase. |
| **Quick run command** | `CI=true npx craco test --watchAll=false --testPathPattern=<pattern>` |
| **Full suite command** | `CI=true npx craco test --watchAll=false` |
| **Estimated runtime** | ~5 seconds (baseline at phase start: 22 suites / 191 tests in ~1.8s) |

**Timer constraint:** `jest.advanceTimersByTimeAsync` does NOT exist under Jest 27.5.1 (added in Jest 29.5). Any debounce test (the ~300ms authored-HTML sanitize debounce, upload retry backoff) MUST use the established `advanceTimersByTime()` + manual microtask-flush helper documented in `src/query/__tests__/side-conversation-queries.test.tsx`.

---

## Sampling Rate

- **After every task commit:** `CI=true npx craco test --watchAll=false --testPathPattern=<touched-area>`
- **After every plan wave:** `CI=true npx craco test --watchAll=false` (full suite) + `CI=true npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite green + `npm run build` clean
- **Max feedback latency:** ~10 seconds (full suite + typecheck)

**Regression guard:** the sanitizer policy split (authored vs incoming HTML) touches `src/lib/__tests__/html-sanitizer.test.ts`, which currently asserts `img` is stripped. Those assertions must be re-pointed at the *incoming* policy, never deleted — a wave that leaves them deleted is a red flag, not a pass.

---

## Per-Task Verification Map

> Populated by the planner. Each task in each PLAN.md must map to a row here with an
> `<automated>` command, or be explicitly listed under **Manual-Only Verifications** below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | COMP-05 / COMP-08 | — | Live contract confirmed before any client code is written | checkpoint | *(human-verify — see Manual-Only)* | n/a | ⬜ pending |
| *(remaining rows added by the planner)* | | | | | | | | | |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers the framework itself (Jest + craco are installed and green). Wave 0 for this phase is limited to **test capability that does not exist yet**:

- [ ] `src/lib/__tests__/test-file-helpers.ts` (or equivalent co-located helpers) — `makeFile(name, size, type)`, `dispatchDrop(target, files)`, `dispatchFilePaste(target, files)` built on jsdom's native `File` / `DataTransfer`
- [ ] **jsdom `DataTransfer.items.add()` smoke test** — one throwaway `it()` proving jsdom in THIS repo actually supports `new DataTransfer()` + `items.add(file)` before the drop-test suite is built on top of it. Research flagged this as ASSUMED, not verified. If it fails, the drop tests need a hand-rolled `dataTransfer` stub instead.
- [ ] Multipart upload client test scaffold — `jest.spyOn(global, "fetch")` asserting **no** `Content-Type` header is set on FormData requests (browser must own the boundary)

*No new test framework or library installation is required.*

---

## Manual-Only Verifications

These cannot be proven in jsdom and become `checkpoint:human-verify` tasks. P-numbers match `04-RESEARCH.md` § Live-Probe Design.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Upload path prefix on the public API (P1) | COMP-05 | Real endpoint shape unknown; `public/v1` prefix vs root is unverified | Run P1 curl against `gsocial-test`; record the working path |
| `comment.attachmentIds` accepted by `public/v1` tickets (P2) | COMP-05, THRD-05 | grispi-ui uses `/v2/tickets`; `public/v1` acceptance unverified | Run P2 curl (create + patch); confirm the attachment binds |
| `?inline=true` support + `inline` echoed back (P3) | COMP-08, THRD-06 | Public-API support and response echo unverified | Run P3 curl; inspect `attachments[].inline` on re-fetch |
| Real request-size ceiling / 413 shape (P4) | COMP-05 | Server/edge limit unknown; drives the client-side cap | Run P4 with an oversized file; record status + error body |
| Bundle token authorized for upload (P5) | COMP-05 | Plugin token scope vs main-app token unverified | Run P5 with the plugin dev token |
| Attachment actually arrives as an email attachment; inline `<img>` renders in the recipient's mail client (P6) | COMP-05, COMP-08 | Requires a real mailbox; remote-image blocking is client-dependent | Send to a real inbox, open the mail, confirm both |
| Drag-drop, paste-inline, chip removal and collapsed-summary behavior in the real 372px panel | COMP-05, COMP-08 | jsdom proves handlers fire, not layout/geometry/native drag | Phase-end UAT in standalone dev mode at 372×812 |
| Package legitimacy sign-off | — | `react-dropzone`, `@tiptap/extension-file-handler`, `@tiptap/extension-image` scored SUS on the legitimacy gate (false-positive "too new": recent patch releases on official-org, multi-million-download packages) | Human confirms the three packages before install |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or appear in Manual-Only Verifications
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers the jsdom `DataTransfer` capability check before drop tests are written
- [ ] Sanitizer regression assertions re-pointed (not deleted) after the policy split
- [ ] No watch-mode flags (`CI=true` + `--watchAll=false` everywhere)
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
