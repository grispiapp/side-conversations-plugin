---
phase: quick-260922-stt
plan: 01
subsystem: ui
tags: [react, mobx, tailwind, a11y]

requires:
  - phase: quick-260918-fx7
    provides: "CcField shared CC row component + ComposeStore.ccEntries/ccQuery, reused unchanged as the visibility-gated child"
provides:
  - "RecipientField ccTrigger?: ReactNode slot (K-2) — Alıcı satırının sağ ucuna opsiyonel trailing kontrol yerleştirme deseni"
  - "ComposeScreen ccRevealed/ccVisible progressive-disclosure state (K-1) — Cc satırının görünürlük kararı ekranda, paylaşılan CcField'da değil"
  - "Alıcı satırının hem seçili hem arama durumunda ortak Kime/Cc etiket kolonu (w-12 shrink-0, px-4, gap-2)"
affects: [side-conversation-compose-layout]

actuals:
  tokens: 2961
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Slot-prop trailing control (ccTrigger?: ReactNode) — RecipientField'ın halihazırdaki RichTextComposerProps.ccSlot deseninin aynısı; paylaşılan bileşen, üzerine yerleştirilen kontrolün semantiğinden habersiz kalır"
    - "Disclosure (toggle değil) — bir kez açılan bir satır, düğme kaybolduğu için kapanamaz; kalıcı görünürlük gerektiren UI'larda tercih edilecek desen"

key-files:
  created: []
  modified:
    - src/screens/components/recipient-field.tsx
    - src/screens/compose-screen.tsx
    - src/screens/__tests__/inbox-surfaces.test.tsx
    - src/screens/__tests__/compose-screen.test.tsx

key-decisions:
  - "K-1: Cc görünürlük kararı ComposeScreen'de yaşıyor, CcField'da değil — CcFieldProps değişmedi, chat/reply yüzeyi (rich-text-composer.tsx ccSlot) hiç etkilenmedi"
  - "K-2: RecipientField opsiyonel ccTrigger?: ReactNode prop'u alıyor — CC semantiğinden habersiz, sadece verilen node'u satırın sağ ucuna koyuyor"
  - "K-3: Kolon hizası gap-2 üzerinde birleşti (RecipientField gap-3'ten çekildi), gap-3 üzerinde değil — çünkü diğer yön paylaşılan cc-field.tsx'i (chat yüzeyini) değiştirmeyi gerektirirdi"
  - "K-4: Konu satırına (subject-field.tsx) bilinçli olarak dokunulmadı — [TICKET-563] ön eki değişken genişlikte olduğu için 48px etiket kolonu eklemenin maliyeti (56px daha dar konu input'u) kazancından (kusurun asıl şikayeti K-3 ile zaten kapanıyor) fazla"
  - "K-5: Tetikleyici bir toggle değil, disclosure — açıldıktan sonra kaybolur, aria-expanded/aria-controls kullanılmıyor (kapatma davranışı istenmiyor)"

patterns-established:
  - "Slot-prop trailing control (ccTrigger) — paylaşılan alan bileşenlerine ekran-özgü kontrol enjekte etmenin yolu"

requirements-completed: [COMP-02, COMP-03]

coverage:
  - id: D1
    description: "Cc satırı compose ekranında varsayılan gizli; Alıcı satırındaki gerçek <button> tetikleyicisiyle açılır ve odak Cc input'una geçer"
    requirement: "COMP-02"
    verification:
      - kind: unit
        ref: "src/screens/__tests__/inbox-surfaces.test.tsx#Cc satırını gizler, tetikleyiciyle açar ve Alıcı ile aynı etiket kolonunu paylaşır"
        status: pass
    human_judgment: false
  - id: D2
    description: "compose.ccEntries dolu olduğunda Cc satırı hiç tıklama olmadan açık gelir (dolu CC kümesi asla gizlenmez)"
    requirement: "COMP-02"
    verification:
      - kind: unit
        ref: "src/screens/__tests__/inbox-surfaces.test.tsx#Cc satırını gizler, tetikleyiciyle açar ve Alıcı ile aynı etiket kolonunu paylaşır"
        status: pass
    human_judgment: false
  - id: D3
    description: "Alıcı satırı hem seçili hem arama durumunda solda aynı Kime etiket kolonunu gösterir; Cc satırıyla aynı w-12/px-4/gap-2 kolonunu paylaşır"
    requirement: "COMP-02"
    verification:
      - kind: unit
        ref: "src/screens/__tests__/inbox-surfaces.test.tsx#Cc satırını gizler, tetikleyiciyle açar ve Alıcı ile aynı etiket kolonunu paylaşır"
        status: pass
    human_judgment: false
  - id: D4
    description: "Panel ~280-300px genişlikte gerçek görsel hizalama ve tetikleyici etkileşimi (jsdom layout ölçemez) — Task 3'ün <human-check>'i"
    verification: []
    human_judgment: true
    rationale: "jsdom sınıf paritesini ölçebilir ama gerçek piksel hizalamasını/görsel tıklama akışını ölçemez; standalone dev'de canlı doğrulama gerekiyor (Task 3 human-check)"

duration: 25min
completed: 2026-09-22
status: complete
---

# Quick Task 260922-stt: Compose Alıcı/Cc Hizası ve Cc Disclosure Summary

**Alıcı ve Cc satırları artık aynı sol etiket kolonunu (`w-12 shrink-0` + `px-4 gap-2`) paylaşıyor; Cc satırı varsayılan gizli, Alıcı satırındaki bir `<button>` tetikleyicisiyle açılıyor, mevcut CC varsa zaten açık geliyor.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3/3 completed
- **Files modified:** 4 (3 planned + 1 test-fixture auto-fix)

## Accomplishments

- `RecipientField` opsiyonel `ccTrigger?: ReactNode` prop'u alıyor (K-2); Cc tetikleyicisi Alıcı satırının içinde yaşıyor ama `RecipientField` CC semantiğinden tamamen habersiz
- `ComposeScreen`'de `ccRevealed`/`ccVisible` progressive-disclosure state'i (K-1); Cc satırı görünürlük kararı ekranda, paylaşılan `CcField`'da değil — chat/reply yüzeyi (`rich-text-composer.tsx`'in `ccSlot`'u) hiç etkilenmedi
- Alıcı satırının input durumuna, seçili daldakiyle birebir aynı `Kime` etiket span'i eklendi; seçili daldaki `gap-3` → `gap-2` çekilerek her iki Alıcı durumu da `cc-field.tsx`'in `px-4 gap-2 w-12` kolonuyla aynı içerik başlangıcını üretiyor
- Tetikleyici açıldığında `#compose-cc-input`'a odak taşınıyor; gerçek `<button type="button">` + `aria-label="Cc alanını göster"` ile klavye erişilebilir
- Yeni test (`inbox-surfaces.test.tsx`) 4 senaryoyu tek testte kanıtlıyor: varsayılan gizli, tetikleyiciyle açılma, kolon paritesi, mevcut CC ile otomatik açık

## Task Commits

Each task was committed atomically:

1. **Task 1: Cc satırını uçtan uca progressive disclosure yap** - `6332c97` (feat)
2. **Task 2: Alıcı satırının input durumuna Kime etiket kolonunu ekle ve kolonu Cc ile birleştir** - `c7c63e0` (feat)
3. **Task 3: Davranışı ve kolon paritesini teste bağla, tam regresyon kapısını geç** - `20bcbc5` (test)

_Not: Task 1 ayrıca `compose-screen.test.tsx`'teki eksik `ccEntries` test fixture'ını da düzeltti (Rule 3 - aşağıda belgelendi); ayrı bir commit açılmadı, Task 1'in commit'ine dahil edildi._

## Files Created/Modified

- `src/screens/components/recipient-field.tsx` - `ccTrigger?: ReactNode` prop'u; her iki dalda da `Kime` etiket span'i (`w-12 shrink-0`), `gap-2` kolonu; input durumu artık satır `div`'i içinde
- `src/screens/compose-screen.tsx` - `ccRevealed` state, `ccVisible` türetimi, açılışta odak effect'i, `RecipientField`'a geçirilen tetikleyici düğme, `CcField`'ı `{ccVisible && ...}` içine alma
- `src/screens/__tests__/inbox-surfaces.test.tsx` - Cc disclosure + kolon paritesi davranışını kanıtlayan yeni test
- `src/screens/__tests__/compose-screen.test.tsx` - mock store'a `compose.ccEntries: []` eklendi (Rule 3 auto-fix, aşağıda)

## Decisions Made

Planlama anında alınan K-1..K-5 kararları (bkz. frontmatter `key-decisions`) executor tarafından yeniden tartışılmadan uygulandı. Yeni bir mimari karar gerekmedi.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `compose-screen.test.tsx` mock store'una eksik `ccEntries` fixture'ı eklendi**
- **Found during:** Task 1 (tam üç suite'in birlikte çalıştırılması sırasında)
- **Issue:** `ComposeScreen`'in yeni `ccVisible = ccRevealed || compose.ccEntries.length > 0` türetimi, `compose-screen.test.tsx`'in mock store'unda `compose.ccEntries` alanı olmadığı için `TypeError: Cannot read properties of undefined (reading 'length')` ile 7 testi kırdı — o dosyada `RecipientField`/`CcField` tamamen mock'landığı için plan `files_modified` listesine girmemişti, ama plan bu dosyayı da kendi Task 1 `<verify>` komutunda çalıştırıyordu
- **Fix:** Mock store'a `ccEntries: []` eklendi (tek satır)
- **Files modified:** `src/screens/__tests__/compose-screen.test.tsx`
- **Verification:** 3 hedefli suite (52/52) ve ardından tam suite (595/595) yeşil
- **Committed in:** `6332c97` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Test fixture düzeltmesi doğrudan bu planın kendi değişikliğinin (yeni `ccEntries` okuması) neden olduğu bir kırılmaydı; plan dışı kapsam genişlemesi yok.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Pending Human Verification

Task 3'ün `<human-check>`'i standalone dev'de (`:3000`, gsocial-test/preprod, TICKET-563) ~280-300px panel genişliğinde canlı görsel doğrulama istiyor: (a) `Kime`/`Cc` aynı sol kolonda mı, (b) Cc satırı ilk açılışta yok ve düğme Alıcı satırının sağ ucunda mı, (c) tıklayınca satır açılıp imleç Cc input'una gidiyor mu, (d) Tab+Enter ile klavye erişimi çalışıyor mu. Bu executor oturumunda tarayıcı/dev-server otomasyon aracı yoktu, bu adım kullanıcı tarafından yapılmayı bekliyor. Stale bundle şüphesinde dev server'ı yeniden başlat (MEMORY: uat-dev-server-stale-bundle).

## Next Phase Readiness

- Compose ekranı layout kusurları kapandı; wire formatı ve store semantiği hiç değişmedi (grep gate: 0 eşleşme)
- 595/595 test yeşil (594 taban + 1 yeni), `tsc --noEmit` temiz
- Chat/reply yüzeyi (`chat-screen.tsx`, `rich-text-composer.tsx`, `cc-field.tsx`) diff'te hiç yer almadı — davranış garantili değişmedi

---
*Phase: quick-260922-stt*
*Completed: 2026-09-22*

## Self-Check: PASSED

All modified files and task commits verified present on disk / in git log.
