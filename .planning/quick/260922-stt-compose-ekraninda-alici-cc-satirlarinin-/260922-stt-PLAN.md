---
phase: quick-260922-stt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/screens/components/recipient-field.tsx
  - src/screens/compose-screen.tsx
  - src/screens/__tests__/inbox-surfaces.test.tsx
autonomous: true
requirements: [COMP-02, COMP-03]
quick: true
closes:
  - "Compose ekranında Alıcı ve Cc satırları tek bir etiket kolonunu paylaşmalı (bugün üç satırın içerik başlangıcı da farklı)."
  - "Cc satırı dar panelde sürekli yer kaplamamalı: Alıcı satırının sağ ucundaki bir tetikleyiciyle açılmalı, mevcut CC varsa zaten açık gelmeli."

estimate:
  tokens: 35000
  raw_tokens: 35000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Compose ekranında Alıcı satırı HER İKİ durumda da (seçili alıcı / arama input'u) solda `Kime` etiket kolonunu gösterir — bugün yalnızca seçili durumda var"
    - "Alıcı satırının ve Cc satırının etiket span'i aynı genişliktedir (`w-12 shrink-0`), aynı yatay padding (`px-4`) ve aynı boşluk (`gap-2`) ile hizalanır — iki satırın içerik başlangıcı aynı kolondadır"
    - "Cc satırı compose ekranında varsayılan olarak RENDER EDİLMEZ; DOM'da `#compose-cc-input` yoktur"
    - "Alıcı satırının sağ ucunda gerçek bir `<button type=\"button\">` (`Cc`) vardır; tıklanınca Cc satırı görünür olur ve odak `#compose-cc-input`'a geçer"
    - "`compose.ccEntries.length > 0` olduğunda Cc satırı hiç tıklama olmadan açık gelir — mevcut konuşmanın CC'leri asla gizlenmez"
    - "Cc bir kez açıldıktan sonra o compose oturumu boyunca açık kalır (query temizlense, chip'ler silinse bile kapanmaz)"
    - "Cc tetikleyicisi klavyeyle erişilebilir ve etiketlidir (`aria-label`); ekran okuyucuya çıplak `Cc` metniyle bırakılmaz"
    - "Chat/reply yüzeyi davranış olarak hiç değişmez: `CcField` orada koşulsuz render edilmeye devam eder, prop imzası aynı kalır"
    - "Wire üzerinde hiçbir değişiklik yok: `ts.email_ccs` serialize/parse, `ccDraft` semantiği ve `ComposeStore.submit` gövdesi bu planda hiç düzenlenmez"
    - "`npx tsc --noEmit` exit 0 ve tüm test suite'i yeşil kalır (taban: 594/594)"
  artifacts:
    - "src/screens/components/recipient-field.tsx — opsiyonel `ccTrigger?: ReactNode` prop'u + input durumuna eklenen `Kime` etiket kolonu"
    - "src/screens/compose-screen.tsx — `ccRevealed` local state, `ccVisible` türetimi, koşullu `CcField`, tetikleyici düğme"
    - "src/screens/__tests__/inbox-surfaces.test.tsx — kolon hizası + Cc açığa çıkarma davranışını kanıtlayan yeni test"
  key_links:
    - "ComposeScreen `ccVisible` → `RecipientField ccTrigger` prop'u (tetikleyicinin Alıcı satırının içinde yaşamasının tek yolu — RecipientField CC semantiğini bilmez)"
    - "ComposeScreen `ccVisible` → `{ccVisible && <CcField .../>}` (görünürlük kararı ekranda, paylaşılan bileşende değil)"
    - "Tetikleyici onClick → `setCcRevealed(true)` → effect → `document.getElementById(\"compose-cc-input\")?.focus()` (CcField'ın kendi `${idPrefix}-input` id sözleşmesi)"
    - "`compose.ccEntries.length > 0` (MobX observable) → `ccVisible` → Cc satırı otomatik açık"
  prohibitions:
    - "src/lib/email-ccs.ts dosyasına DOKUNULMAZ (parse/serialize/dedupe/REPLACE semantiği)"
    - "src/store/active-conversation-store.ts dosyasına DOKUNULMAZ (`ccDraft`: null = dokunulmadı, \"\" = hepsini temizle)"
    - "src/store/compose-store.ts dosyasına DOKUNULMAZ (ccEntries/ccQuery/isDirty/reset/submit)"
    - "src/screens/chat-screen.tsx ve src/screens/components/rich-text-composer.tsx dosyalarına DOKUNULMAZ (`ccSlot` sözleşmesi aynı kalır)"
    - "src/screens/components/cc-field.tsx'in prop imzası DEĞİŞMEZ; bu planda dosyanın hiç düzenlenmesi gerekmiyor"
    - "Production bundle yeniden üretilmez (`npm run build` + build/ commit'i bu planın kapsamı dışıdır)"
---

<objective>
Compose ekranındaki iki görsel kusuru kapat: (1) Alıcı ve Cc satırları tek bir sol etiket kolonunu paylaşsın, (2) Cc satırı dar panelde sürekli yer kaplamak yerine Alıcı satırındaki bir tetikleyiciyle açılsın — mevcut CC varsa zaten açık gelsin.

Purpose: 1366px viewport'ta ~295px ölçülen Grispi sağ panelinde her satır kıymetli; bugün üç satırın içerik başlangıcı da farklı (Alıcı tam kenar, Cc chip sayısına göre kayan, Konu ayrı) ve boş bir Cc satırı kalıcı olarak bir satır yiyor.
Output: Hizalanmış Alıcı/Cc kolonları + progressive-disclosure Cc satırı; wire formatında ve store semantiğinde sıfır değişiklik.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/CLAUDE.md

@src/screens/components/recipient-field.tsx
@src/screens/components/cc-field.tsx
@src/screens/compose-screen.tsx
@src/screens/__tests__/inbox-surfaces.test.tsx
</context>

<design_decisions>

Planlama anında canlı kaynak okumasıyla alınan kararlar (executor bunları yeniden tartışmaz):

**K-1 — Tetikleyici ComposeScreen'de yaşar, CcField'da DEĞİL.** `CcField` prop-driven ve iki yüzey tarafından paylaşılıyor (compose + `rich-text-composer.tsx`'in `ccSlot`'u üzerinden chat). Chat yüzeyinde Cc satırı zaten composer'ın içinde, mevcut konuşmanın canonical CC'leriyle birlikte duruyor; orada aynı gizle/aç davranışı istenmiyor. Görünürlük kararını ekrana koymak `CcFieldProps`'u byte-byte aynı bırakır → chat yüzeyi hiç etkilenmez. `cc-field.tsx` bu planda hiç düzenlenmiyor.

**K-2 — Tetikleyici Alıcı satırının içinde durmalı, bu yüzden `RecipientField` opsiyonel `ccTrigger?: ReactNode` prop'u alır.** Bu, repo'da zaten var olan `RichTextComposerProps.ccSlot` slot-prop deseninin aynısı (D-CC-8). `RecipientField` böylece CC semantiğinden habersiz kalır; sadece verilen node'u satırın sağ ucuna koyar. `RecipientField` yalnızca `compose-screen.tsx` tarafından kullanılıyor (grep ile doğrulandı), prop opsiyonel olduğu için başka çağrı yeri kırılmaz.

**K-3 — Kolon hizası `gap-2` üzerinde birleşir, `gap-3` üzerinde değil.** `CcField`'ın satırı bugün `px-4 py-2 gap-2` + `w-12` etiket kullanıyor; `RecipientField`'ın seçili satırı `px-4 gap-3` + `w-12` kullanıyor. Hizayı `RecipientField`'ı `gap-2`'ye çekerek kuruyoruz — çünkü diğer yön paylaşılan `CcField`'ı (yani chat yüzeyini de) düzenlemeyi gerektirirdi. Sonuç: her iki satırda da içerik başlangıcı 16px padding + 48px etiket + 8px boşluk.

**K-4 — Konu satırına DOKUNULMUYOR (bilinçli karar).** `SubjectField`'daki `[TICKET-563]` ön eki tam yükseklikte, kenarlıklı, DEĞİŞKEN genişlikte bir blok (`h-12 border-r px-4`). Ona bir `Kime`/`Cc` gibi 48px etiket kolonu eklemek (a) ~280px panelde düzenlenebilir konu input'undan 56px daha çalar ve (b) ön ek değişken genişlikte olduğu için Konu metnini yine de 72px kolonuna oturtmaz — yani maliyeti var, kazancı yok. Kusurun asıl şikâyeti olan "Alıcı ile Cc aynı kolonu paylaşsın" K-3 ile zaten kapanıyor. Konu satırı olduğu gibi kalır; bu, görevin "if it turns out to be intrusive, leave Konu alone and say so" izninin kullanılmasıdır.

**K-5 — Tetikleyici açıldıktan sonra kaybolur.** Kapatma davranışı istenmiyor ("once opened it stays open"), dolayısıyla düğme bir disclosure tetikleyicisidir, bir toggle değil: `ccVisible` true olunca hiç render edilmez. Bu yüzden `aria-expanded`/`aria-controls` kullanılmaz (açıldığında düğme yok; `aria-controls` de henüz var olmayan bir id'yi işaret ederdi). Erişilebilirlik, gerçek `<button>` + açıklayıcı `aria-label` + açılışta odağın Cc input'una taşınmasıyla sağlanır.

</design_decisions>

<tasks>

<task type="tracer">
  <name>Task 1: Cc satırını uçtan uca progressive disclosure yap</name>
  <files>src/screens/components/recipient-field.tsx, src/screens/compose-screen.tsx</files>
  <action>
İnce dikey dilim: ComposeScreen state'i → RecipientField slot'u → CcField'ın render edilip edilmemesi. Tek yol, gerçek uçtan uca davranış.

`src/screens/components/recipient-field.tsx`:
- `react` importuna `ReactNode` ekle.
- `export interface RecipientFieldProps { ccTrigger?: ReactNode }` tanımla; kısa bir doc yorumu: satırın sağ ucuna konan opsiyonel trailing kontrol, K-2.
- `observer(() => {` imzasını `observer(({ ccTrigger }: RecipientFieldProps) => {` yap. Bileşenin geri kalan mantığı (arama, popup, klavye, blur) HİÇ değişmez.
- Seçili-alıcı dalında (`compose.recipientLabel ?` dalı): değer span'i ile `aria-label="Alıcıyı değiştir"` temizleme düğmesi ARASINA `{ccTrigger}` koy. Satır `div`'inin kendisi ve `span.min-w-0.flex-1` değer span'i yapısal olarak aynı kalmalı — mevcut test temizleme düğmesinin `parentElement`'ini satır olarak okuyor ve o satırda `min-h-12` bekliyor.
- Input dalında (`: (` dalı): `<Input>`'u tek başına bırakmak yerine Task 2'nin kuracağı satır `div`'ine hazırlık olarak ŞİMDİLİK sadece `{ccTrigger}`'ı input'tan sonra gelecek şekilde bir `<div className="flex min-h-12 min-w-0 items-center gap-2 px-4 text-sm">` sarmalayıcısına al; `Kime` etiketi Task 2'de eklenecek. Input'un tüm a11y prop'ları (`role`, `aria-*`, `id`, `autoComplete`) aynen korunur; className'i bu adımda `h-12 w-auto min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring` olur (satır artık `px-4` taşıdığı için input'un kendi yatay padding'i sıfırlanır).
- Tetikleyici düğmenin kendisi BURADA tanımlanmaz — node dışarıdan gelir.

`src/screens/compose-screen.tsx`:
- `useState` zaten import edili; `useEffect` de öyle. `const [ccRevealed, setCcRevealed] = useState(false);` ekle.
- `const ccVisible = ccRevealed || compose.ccEntries.length > 0;` türet. Ekran `observer` olduğu için `ccEntries` değişimi reaktif.
- Açılışta odak transferi: `useEffect(() => { if (!ccRevealed) return; document.getElementById("compose-cc-input")?.focus(); }, [ccRevealed]);` — id sözleşmesi CcField'ın kendi `${idPrefix}-input` kalıbından geliyor ve compose `idPrefix="compose-cc"` geçiyor. Optional chaining zorunlu: bazı test suite'lerinde CcField mock'lanmış durumda ve element yok.
- `<RecipientField />` çağrısını şu hâle getir: `ccVisible` true iken `ccTrigger` verilmez (`undefined`), false iken şu düğme verilir:
  `type="button"`, `onClick={() => setCcRevealed(true)}`, `aria-label="Cc alanını göster"`, görünen metin `Cc`, className `flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`.
- `<CcField ... />` bloğunu `{ccVisible && ( ... )}` içine al. Prop listesi (entries/query/onQueryChange/onAdd/onRemove/idPrefix) HİÇ değişmez.
- Kısa bir doc yorumu: görünürlük kararının neden ekranda olduğu (K-1), CcField'ın paylaşıldığı.
  </action>
  <verify>
    <automated>CI=true npx craco test --watchAll=false --passWithNoTests src/screens/__tests__/inbox-surfaces.test.tsx src/screens/__tests__/compose-screen.test.tsx src/screens/__tests__/chat-screen.test.tsx</automated>
  </verify>
  <done>Compose ilk açıldığında DOM'da `#compose-cc-input` yok; Alıcı satırında `aria-label="Cc alanını göster"` düğmesi var; düğmeye tıklayınca Cc satırı render oluyor ve düğme kayboluyor; `compose.ccEntries` dolu olduğunda satır tıklamasız açık geliyor; üç mevcut suite de yeşil.</done>
</task>

<task type="auto">
  <name>Task 2: Alıcı satırının input durumuna `Kime` etiket kolonunu ekle ve kolonu Cc ile birleştir</name>
  <files>src/screens/components/recipient-field.tsx</files>
  <action>
Task 1'de kurulan input-durumu satır `div`'ini tamamla ve iki satırı tek kolona oturt (K-3).

- Input dalındaki satır `div`'inin İLK çocuğu olarak, seçili daldakiyle BİREBİR aynı etiket span'ini ekle: `aria-hidden="true"`, className `w-12 shrink-0 text-muted-foreground`, metin `Kime`. (`aria-hidden` doğru: gerçek erişilebilir ad zaten `htmlFor="compose-recipient"` olan `sr-only` `Alıcı` label'ından geliyor, ikinci bir metin kaynağı ekran okuyucuya gürültü olurdu.)
- Seçili-alıcı dalındaki satır `div`'inin `gap-3` sınıfını `gap-2` yap. Artık her iki Alıcı satırı da `flex min-h-12 min-w-0 items-center gap-2 px-4 text-sm` taşıyor ve `cc-field.tsx`'teki `px-4 py-2 ... gap-2` + `w-12` etiketiyle aynı içerik başlangıcını üretiyor. `cc-field.tsx` DÜZENLENMEZ.
- Input'un `placeholder` değerini `Alıcı ara veya e-posta yaz…` yerine `Ara veya e-posta yaz…` yap: satır artık görünür bir `Kime` etiketi taşıyor (kelime tekrarı) ve input ~280px panelde 56px daha dar. Hiçbir test bu placeholder'ı sorgulamıyor (grep ile doğrulandı).
- `SubjectField`/`subject-field.tsx` DÜZENLENMEZ — gerekçe K-4'te; SUMMARY'de bu bilinçli değişmezliği açıkça yaz.
- Hiçbir a11y attribute'u, hiçbir arama/klavye mantığı, hiçbir store çağrısı değişmez.
  </action>
  <verify>
    <automated>CI=true npx craco test --watchAll=false --passWithNoTests src/screens/__tests__/inbox-surfaces.test.tsx</automated>
  </verify>
  <done>Alıcı satırı hem seçili hem arama durumunda solda `Kime` etiketini gösteriyor; her iki durumun satır `div`'i de `gap-2 px-4 min-h-12` taşıyor; etiket span'i `w-12 shrink-0`; `cc-field.tsx` ve `subject-field.tsx` diff'te yer almıyor.</done>
</task>

<task type="auto">
  <name>Task 3: Davranışı ve kolon paritesini teste bağla, tam regresyon kapısını geç</name>
  <files>src/screens/__tests__/inbox-surfaces.test.tsx</files>
  <action>
`describe("unified compose surface")` bloğuna TEK yeni test ekle (bu suite gerçek `RecipientField` + gerçek `CcField` render ediyor, yalnızca `useCustomersQuery` mock'lu — davranışı kanıtlamak için doğru yer).

Test adı: `"Cc satırını gizler, tetikleyiciyle açar ve Alıcı ile aynı etiket kolonunu paylaşır"`.

Kapsam (aynı test içinde, dosyadaki mevcut `act`/`container.querySelector` stiliyle; yeni kütüphane eklenmez):
1. Varsayılan: `mockStore.compose.ccEntries = []` iken render → `container.querySelector("#compose-cc-input")` null; `aria-label="Cc alanını göster"` düğmesi var ve `tagName` `BUTTON`.
2. Açığa çıkarma: düğmeye `act(() => trigger.click())` → `#compose-cc-input` artık var; tetikleyici düğme artık yok.
3. Kolon paritesi (jsdom'da layout yok, bu yüzden sınıf paritesi ölçülür): Cc satırı açıkken, `Kime` metinli span ile `Cc` metinli span'in ikisi de `w-12` ve `shrink-0` taşır; bu span'lerin `parentElement`'lerinin ikisi de `px-4` ve `gap-2` taşır.
4. Mevcut CC'de otomatik açık: dosyanın kendi remount kalıbıyla (`root.render(<></>)` → `root.render(<ComposeScreen />)`) `mockStore.compose.ccEntries = [{ id: null, email: "cc@example.test" }]` ile yeniden mount → hiç tıklama olmadan `#compose-cc-input` var ve `aria-label="Cc alanını göster"` düğmesi yok.

`beforeEach` içindeki mock store'a dokunma (ccEntries zaten `[]` olarak tanımlı); testin sonunda mutasyonu geri almaya gerek yok, `beforeEach` her testte yeniden kuruyor.

Sonra tam kapıyı geç: bütün suite + tsc. Sayı tabanı 594; yeni testle birlikte 595 beklenir, 594'ün ALTINA düşerse regresyon var demektir.
  </action>
  <verify>
    <automated>CI=true npx craco test --watchAll=false --passWithNoTests && npx tsc --noEmit</automated>
    <human-check>Standalone dev'de (`:3000`, gsocial-test/preprod, TICKET-563) compose ekranını ~280-300px genişlikte aç: (a) `Kime` ve `Cc` etiketleri aynı sol kolonda mı, (b) Cc satırı ilk açılışta yok ve `Cc` düğmesi Alıcı satırının sağ ucunda mı, (c) düğmeye tıklayınca satır açılıp imleç Cc input'una gidiyor mu, (d) Tab ile düğmeye ulaşılıp Enter ile açılıyor mu. Stale bundle şüphesinde dev server'ı yeniden başlat (MEMORY: uat-dev-server-stale-bundle).</human-check>
  </verify>
  <done>Yeni test yeşil; tüm suite yeşil ve toplam test sayısı 594'ün altına düşmemiş; `npx tsc --noEmit` exit 0; `git diff --name-only` yalnızca recipient-field.tsx, compose-screen.tsx ve inbox-surfaces.test.tsx listeliyor.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Temsilci (tarayıcı/iframe) → compose formu | Temsilcinin gördüğü alıcı kümesi ile gerçekten gönderilecek küme aynı olmalı |
| Plugin → Grispi REST (`POST /v2/tickets`) | `ts.email_ccs` REPLACE semantiği: gönderilen küme mevcudun yerine geçer |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260922-01 | Information Disclosure | compose-screen.tsx Cc görünürlüğü | medium | mitigate | `ccVisible = ccRevealed \|\| compose.ccEntries.length > 0` — dolu bir CC kümesi asla gizlenemez; Task 3 madde 4 bunu testle kilitler |
| T-260922-02 | Tampering | recipient-field.tsx / compose-screen.tsx layout refactor'ü | medium | mitigate | Store/serializer dosyaları prohibitions ile kapsam dışı; `files_modified` üç dosyayla sınırlı; tam suite + `tsc --noEmit` kapısı Task 3'te |
| T-260922-03 | Denial of Service (kullanılabilirlik) | Cc disclosure tetikleyicisi | low | mitigate | Gerçek `<button type="button">` + `aria-label` + açılışta `#compose-cc-input`'a odak; Task 3 madde 1-2 düğmenin varlığını ve etkisini doğrular |
| T-260922-04 | Repudiation | — | low | accept | Bu değişiklik hiçbir yazma/denetim yolunu etkilemiyor; wire gövdesi aynı |
| T-260922-SC | Tampering | npm/pip/cargo kurulumları | low | accept | Bu planda hiç paket kurulumu yok; yeni bağımlılık eklenmiyor, legitimacy gate tetiklenmiyor |
</threat_model>

<verification>
- `CI=true npx craco test --watchAll=false --passWithNoTests` → tüm suite yeşil, toplam ≥ 594
- `npx tsc --noEmit` → exit 0
- `git diff --name-only` → yalnızca `src/screens/components/recipient-field.tsx`, `src/screens/compose-screen.tsx`, `src/screens/__tests__/inbox-surfaces.test.tsx`
- `git diff --name-only | grep -Ec 'email-ccs|compose-store|active-conversation-store|chat-screen|rich-text-composer|cc-field|subject-field' || true` → `0` yazdırmalı (yasaklı dosyalara dokunulmadığının kanıtı; `|| true` eşleşme yokken `grep`'in 1 ile çıkmasını yutar)
</verification>

<success_criteria>
- Compose ekranında `Kime` ve `Cc` etiketleri aynı sol kolonda başlar (aynı `px-4` + `w-12` + `gap-2`)
- Alıcı satırı arama durumunda da etiket kolonunu gösterir
- Cc satırı varsayılan olarak gizli, tetikleyiciyle açılıyor, mevcut CC varsa zaten açık
- Chat/reply yüzeyinde hiçbir davranış değişmedi (`CcFieldProps` aynı, `chat-screen.tsx` diff'te yok)
- Gönderilen istek gövdesi değişmedi (store ve serializer dosyaları diff'te yok)
- 594+ test yeşil, `tsc --noEmit` temiz
</success_criteria>

<output>
Create `.planning/quick/260922-stt-compose-ekraninda-alici-cc-satirlarinin-/260922-stt-SUMMARY.md` when done — K-4 (Konu satırına neden dokunulmadığı) SUMMARY'de açıkça yer almalı.
</output>
