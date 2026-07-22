---
phase: 1
slug: temel-ve-salt-okunur-g-r-me-listesi
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-22
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29 (CRA 5 / react-scripts via craco; Node 22 native fetch mockable — verified in RESEARCH.md) |
| **Config file** | none — CRA defaults through `craco.config.js`, zero setup required |
| **Quick run command** | `CI=true npx craco test --testPathPattern="<module>" --watchAll=false` |
| **Full suite command** | `CI=true npx craco test --watchAll=false` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `CI=true npx craco test --testPathPattern="<touched module>" --watchAll=false` + `npx tsc --noEmit -p tsconfig.json`
- **After every plan wave:** Run `CI=true npx craco test --watchAll=false`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | CORE-01, CORE-02, CORE-03 | T-01-SC / — | Typed NetworkError/HttpError; token yalnızca bellekte | unit (tdd) | `CI=true npx craco test --testPathPattern="http-handler\|side-conversation" --watchAll=false` | ❌ task creates | ⬜ pending |
| 1-01-02 | 01 | 1 | LIST-01 | — | encodeURIComponent ile query kaçışı | unit (tdd) | `CI=true npx craco test --testPathPattern="side-conversations-store\|relative-time" --watchAll=false` | ❌ task creates | ⬜ pending |
| 1-01-03 | 01 | 1 | LIST-01 | — | XSS-güvenli render (JSX text node) | typecheck + full suite | `npx tsc --noEmit -p tsconfig.json` + `CI=true npx craco test --watchAll=false` | ✅ (prior tasks) | ⬜ pending |
| 1-02-01 | 02 | 2 | LIST-02 (ön koşul) | T-02-02 | Rozet türetimi doğrulanmış canlı şekle karşı yazılır | manual checkpoint | — (bkz. Manual-Only Verifications) | — | ⬜ pending |
| 1-02-02 | 02 | 2 | LIST-02 | T-02-02 | Yalnızca publicVisible yorumlar sayılır; localStorage savunmacı parse | unit (tdd) | `CI=true npx craco test --testPathPattern="conversation-status\|last-seen-store" --watchAll=false` | ❌ task creates | ⬜ pending |
| 1-02-03 | 02 | 2 | LIST-03 | — | Grup sıralaması deterministik (pure sort) | unit | `CI=true npx craco test --testPathPattern="side-conversations-store" --watchAll=false` | ✅ (extends) | ⬜ pending |
| 1-03-01 | 03 | 3 | CORE-03, LIST-04 | — | Ağ vs HTTP hatası ayrımı; hata kopyaları Türkçe | unit | `CI=true npx craco test --testPathPattern="side-conversations-store" --watchAll=false` | ✅ (extends) | ⬜ pending |
| 1-03-02 | 03 | 3 | LIST-05, LIST-06 | — | Generation guard: eski taleple yarış durumu sızmaz | unit | `CI=true npx craco test --testPathPattern="side-conversations-store" --watchAll=false` | ✅ (extends) | ⬜ pending |
| 1-03-03 | 03 | 3 | tümü (faz UAT) | — | Gerçek panelde gizlilik/görünürlük doğrulaması | manual checkpoint | — (bkz. Manual-Only Verifications) | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Jest, craco test runner ve `global.fetch` mock'lanabilirliği RESEARCH.md'de bu oturumda gerçek çalıştırmayla doğrulandı; test dosyaları görevlerin kendi içinde (tdd) oluşturulur — ayrı bir Wave 0 iskelesi gerekmez.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Canlı API şekli doğrulama (Plan 01-02 Task 1, blocking-human) | LIST-02 ön koşulu | `advanced-search` zarfı, `ts.status` ID/erişim yolu, requester/"alıcı" konumu ve `comment.creator.role.teamUser` canlı tenant'ta doğrulanmamış (RESEARCH Open Q#1–3) | Davut'un test tenant'ında 1 `advancedSearch` + 1 `getTicket` çağrısı yap; gerçek JSON'u planla karşılaştır; sapma varsa `src/types/grispi.type.ts` + store `toRow` mapper'ını düzelt |
| Faz sonu UAT — gerçek Grispi panelinde (Plan 01-03 Task 3, blocking) | CORE-01..03, LIST-01..06 | Görsel/etkileşimsel kabul (372px iframe, talep değişimi, rozetler, boş/hata durumları) otomatik testle kanıtlanamaz | Gerçek talep sayfasında paneli aç: liste + rozetler + sıralama, boş durum + gizlilik metni, hata + "Yeniden dene", "Daha fazla yükle", talep değişiminde anında yenileme senaryolarını doğrula |

**Ön koşullar (insan):** `tu.side_conversation_parent` custom field'ı tenant'ta tanımlı olmalı (D-16); rozet çeşitliliği içeren 11+ test yan talebi hazırlanmalı (D-17); API token aynı tenant'tan olmalı.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (n/a — inline tdd)
- [x] No watch-mode flags (`--watchAll=false` everywhere, `CI=true`)
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-22
