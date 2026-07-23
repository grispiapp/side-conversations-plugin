---
phase: 2
slug: yeni-yan-g-r-me-ba-latma
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-23
---

# Phase 2 — Validation Strategy

> Yürütme sırasında geri-besleme örneklemesi için faz-başı doğrulama sözleşmesi. Aşağıdaki tüm komutlar planlardaki `<verify>` bloklarından birebir kopyalanmıştır.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (react-scripts/craco `test`, CRA-bundled) — [VERIFIED: `package.json` scripts + `craco.config.js` `jest.configure`] |
| **Config file** | `craco.config.js` (`jest.configure` → `moduleNameMapper` `@/*` alias) + CRA'nın gömülü jest config'i |
| **Quick run command** | `CI=true npx craco test --watchAll=false --testPathPattern=<dosya-adı>` (unit) · `CI=true npx tsc --noEmit` (typecheck-only task'lar) |
| **Full suite command** | `CI=true npm test -- --watchAll=false` (+ `CI=true npx tsc --noEmit`) |
| **Estimated runtime** | Quick (tek dosya) ~5–10s · typecheck ~10–15s · Full suite ~20–40s |

---

## Sampling Rate

- **After every task commit:** unit task ise `CI=true npx craco test --watchAll=false --testPathPattern=<dosya-adı>`; typecheck-only task ise `CI=true npx tsc --noEmit`
- **After every plan wave:** `CI=true npm test -- --watchAll=false` + `CI=true npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite yeşil olmalı (`CI=true npm test -- --watchAll=false`)
- **Max feedback latency:** ~30 saniye (full suite tavanı)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | COMP-02 / COMP-04 | — | Yazmadan önce gerçek API şekilleri (A1–A5) canlı doğrulanır; hiçbir kod varsayıma bağlanmaz | checkpoint | `<human-check>` (üç probe ham JSON'ı yapıştırılır) | n/a (manual) | ⬜ pending |
| 02-01-02 | 01 | 1 | COMP-04 (D-06/07/08) | T-02-07 | `isValidEmail` client-side UX kapısı; aşırı-sıkı regex değil (asıl doğrulama sunucuda) | unit | `CI=true npx craco test --watchAll=false --testPathPattern=side-conversation` | ✅ | ⬜ pending |
| 02-01-03 | 01 | 1 | COMP-02 / COMP-04 | T-02-06 | createTicket istemcisi yalnız gövdeyi taşır; `publicVisible:true` literal, `creator` zorunlu tiplenir | tsc | `CI=true npx tsc --noEmit` | n/a (tsc) | ⬜ pending |
| 02-02-01 | 02 | 2 | COMP-04 (D-13) | T-02-05 / T-02-09 | `agentEmail` yalnız trusted `bundle.context.agent.email` ya da `NODE_ENV=development` kapılı env fallback | unit | `CI=true npx craco test --watchAll=false --testPathPattern=plugin-bootstrap` | ✅ | ⬜ pending |
| 02-02-02 | 02 | 2 | COMP-01 | — | Navigasyon durum makinesi + D-02/D-03 dirty-guard deterministik | unit | `CI=true npx craco test --watchAll=false --testPathPattern=panel-navigation-store` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 2 | COMP-01 | — | Ekran-swap seam; kullanıcı-girdisi yok | tsc | `CI=true npx tsc --noEmit` | n/a (tsc) | ⬜ pending |
| 02-03-01 | 03 | 3 | COMP-02 | T-02-03 | Arama hata dalı jenerik `no-results`; `error.body`/`status` asla render/log | unit | `CI=true npx craco test --watchAll=false --testPathPattern=compose-store` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 3 | COMP-02 / COMP-03 | T-02-04 / T-02-07 | Tek-satır `<input type="text">` çok-satır header injection'ı engeller; geçersiz e-postada "kullan" satırı yok | tsc | `CI=true npx tsc --noEmit` | n/a (tsc) | ⬜ pending |
| 02-03-03 | 03 | 3 | COMP-03 | T-02-06 | Konu prefill'i temsilci-düzenlenebilir (kontrolünde); iç talep anahtarı D-08 kabul | tsc | `CI=true npx tsc --noEmit` | n/a (tsc) | ⬜ pending |
| 02-04-01 | 04 | 4 | COMP-04 / SYNC-02 | T-02-03 / T-02-08 | `markFailed` yalnız `errorKind` tutar (body render/log yok); retry aynı POST (kabul edilmiş at-least-once) | unit | `CI=true npx craco test --watchAll=false --testPathPattern=active-conversation-store` | ❌ W0 | ⬜ pending |
| 02-04-02 | 04 | 4 | COMP-04 | T-02-01 / T-02-05 | `parentKey` yalnız trusted `useGrispi().ticket?.key`'den; `creator`=agentEmail; kullanıcı-girdisi linkage'ı etkilemez | unit | `CI=true npx craco test --watchAll=false --testPathPattern=compose-store` | ✅ | ⬜ pending |
| 02-04-03 | 04 | 4 | COMP-04 | — (T-02-02 seam) | Enter=newline / Shift+Enter=submit; guard store içinde merkezi | tsc | `CI=true npx tsc --noEmit` | n/a (tsc) | ⬜ pending |
| 02-05-01 | 05 | 5 | COMP-04 | T-02-02 (high) | Mesaj gövdesi YALNIZ React text interpolation; `dangerouslySetInnerHTML` == 0 (grep gate) | tsc | `CI=true npx tsc --noEmit` | n/a (tsc) | ⬜ pending |
| 02-05-02 | 05 | 5 | COMP-04 | T-02-02 (high) | Chat başlığı client-echo (sunucudan re-fetch yok); balon gövdesi HTML olarak yorumlanmaz | tsc | `CI=true npx tsc --noEmit` | n/a (tsc) | ⬜ pending |
| 02-05-03 | 05 | 5 | COMP-04 | T-02-01 | Gönder → submit yalnız trusted context (`agentEmail`, `ticket?.key`) ile | tsc | `CI=true npx tsc --noEmit` | n/a (tsc) | ⬜ pending |
| 02-06-01 | 06 | 6 | COMP-04 (D-02/D-03) | T-02-01 | Dolu taslak yanlış parent'a bağlanmadan onay ister; onaysız geçiş yok | tsc | `CI=true npx tsc --noEmit` | n/a (tsc) | ⬜ pending |
| 02-06-02 | 06 | 6 | COMP-04 (D-15) | T-02-03 / T-02-02 | Failed copy yalnız `errorKind` kategorisi (network/server); body sızmaz; `dangerouslySetInnerHTML` == 0 regresyon yok | tsc | `CI=true npx tsc --noEmit` | n/a (tsc) | ⬜ pending |
| 02-06-03 | 06 | 6 | COMP-01..04 / SYNC-02 | T-02-02 (high) | Canlı UAT: `publicVisible:true` → gerçek harici e-posta + SYNC-02 gerçek refetch insan gözüyle doğrulanır | checkpoint | `<human-check>` (8-madde faz-sonu UAT) | n/a (manual) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity:** İki manuel/checkpoint task faz uçlarında konumlanmış (02-01-01 fazın ilk task'ı, 02-06-03 fazın son task'ı) ve aralarındaki 16 task'ın tamamı otomatik verify (unit veya tsc) taşıyor. Ardışık üç task'ın hiçbir noktada otomatik verify'ı yok — Nyquist örnekleme sürekliliği korunuyor. (02-01: checkpoint → unit → tsc; 02-06: tsc → tsc → checkpoint — her checkpoint komşusunda otomatik verify var.)

---

## Wave 0 Requirements

Test iskeleleri, ilgili `tdd` task'ların RED aşamasında oluşturulur/genişletilir (oluşturulma sırasına göre):

- [ ] `src/lib/__tests__/side-conversation.test.ts` — **GENİŞLETİLİR** (Wave 1 · 02-01-02 tdd): `formatRequesterField`/`formatPrefillSubject`/`isValidEmail` için yeni `describe` blokları (COMP-04 / D-06/07/08). Dosya mevcut (Faz 1).
- [ ] `src/contexts/__tests__/plugin-bootstrap.test.ts` — **GENİŞLETİLİR** (Wave 2 · 02-02-01): `setAgentEmail` fake enjeksiyonu + assert (COMP-04 / D-13). Dosya mevcut (Faz 1).
- [ ] `src/store/__tests__/panel-navigation-store.test.ts` — **YENİ** (Wave 2 · 02-02-02 tdd): list/compose/chat geçişleri + D-02/D-03 dirty-guard (COMP-01).
- [ ] `src/store/__tests__/compose-store.test.ts` — **YENİ** (Wave 3 · 02-03-01 tdd): fake-timers debounce + generation-guard arama + form durumu (COMP-02); Wave 4'te (02-04-02) `submit`/reentrancy ile genişletilir (COMP-04/SYNC-02).
- [ ] `src/store/__tests__/active-conversation-store.test.ts` — **YENİ** (Wave 4 · 02-04-01 tdd): optimistic mesaj yaşam döngüsü + `createTicket` POST + `sideConversations.load` spy (SYNC-02).

**Yeni teknik:** `jest.useFakeTimers()` bu projede ilk kez 02-03-01'de kullanılır (debounce testi); `afterEach(jest.useRealTimers)` ile temizlik zorunlu.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Canlı API probe: `createTicket` 201 gövdesi + `customers.search` zarfı/alan adları (A1–A5) | COMP-02 / COMP-04 | Otomatik test canlı Grispi tenant'ına gerçek POST/GET atmaz; şekiller yalnız gerçek yanıttan doğrulanabilir (Faz 1 probe deseni) | Executor üç curl komutu üretir (baseUrl `https://api.grispi.net`, `tenantId: gsocial-test`, `Authorization: Bearer $REACT_APP_DEV_TOKEN`); Davut token'la çalıştırıp ham JSON'ı yapıştırır → A1–A5 için CONFIRMED/CORRECTED |
| Faz-sonu UAT: 5 success criteria (COMP-01..04, SYNC-02) + D-02/D-03/D-15 uçtan uca | COMP-01, COMP-02, COMP-03, COMP-04, SYNC-02 | Gerçek harici e-postanın alıcıya gittiği (`publicVisible:true`) ve SYNC-02 refetch'inin gerçek veriyle çalıştığı yalnız insan gözüyle doğrulanır | Standalone dev modu (`npm start`, gerçek gsocial-test token + `REACT_APP_DEV_AGENT_EMAIL`, parent `TICKET-563`); 8-madde UAT senaryosu (02-06-03 `how-to-verify`) madde-madde geçti/sorunlu kaydıyla |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — 16/18 task otomatik verify; 2 checkpoint (probe + UAT) doğası gereği manuel, Manual-Only tabloda gerekçelendirildi
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — iki checkpoint faz uçlarında izole, aralarındaki 16 task otomatik
- [x] Wave 0 covers all MISSING references — üç yeni store test dosyası + iki genişletilen test dosyası ilgili tdd task'larında oluşturulur/genişletilir
- [x] No watch-mode flags — tüm komutlar `CI=true ... --watchAll=false`
- [x] Feedback latency < 30s — full suite tavanı ~20–40s, hedeflenen ~30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-23
