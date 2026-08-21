---
phase: quick-260821-itv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/screens/chat-screen.tsx
  - src/screens/__tests__/chat-screen.test.tsx
  - src/query/side-conversation-queries.ts
  - src/query/__tests__/side-conversation-queries.test.tsx
  - src/store/side-conversations-store.ts
  - src/store/__tests__/side-conversations-store.test.ts
  - src/contexts/grispi-context.tsx
  - src/contexts/__tests__/grispi-context.test.tsx
autonomous: true
requirements: [UX-05, SYNC-00]
quick: true
closes:
  - "Canlı ölçüm (2026-08-21): 1 yazma → 9 okuma, 4'ü birebir kopya. Sohbet ekranında manuel yenileme yok."

must_haves:
  truths:
    - "Sohbet ekranında `…` menüsünün İLK öğesi `Yenile`'dir; tıklanınca yalnızca `detail.refetch()` çağrılır ve BAŞKA hiçbir sorgu ağa çıkmaz"
    - "Bir fetch uçuştayken menü tetiğinin ikonu dönen `ReloadIcon` olur ve `Yenile` öğesi `disabled` kalır — geri bildirim menü kapandıktan SONRA da görünür"
    - "`sideKey` yokken (henüz oluşturulmamış konuşma) `Yenile` öğesi HİÇ RENDER EDİLMEZ — `canLifecycleAction`'ın varlık-kapısı deseniyle birebir aynı"
    - "Menü tetiği, `Yenile` mümkünken asla `disabled` olmaz; kapalı (closed) bir konuşmada üst talep URL'i olmasa bile menü ölü değildir"
    - "Menü öğesi indeksleri artık elle yazılmaz: sıra türetilmiş bir listeden gelir, ArrowUp/ArrowDown/Home/End üç öğede de doğru döner ve dördüncü bir öğe eklemek indeks aritmetiğini bozamaz"
    - "Bir konuşmayı listeden açmak, detay fetch'inin YAN ETKİSİ olarak liste sorgusunu ağdan YENİDEN ÇEKMEZ — liste yalnızca `stale` işaretlenir"
    - "Okunmamış noktası bir konuşma okunduktan sonra SIFIR ağ isteğiyle temizlenir; okunmamış diğer konuşmaların noktası temizlenmez"
    - "`hasUnseen` artık queryFn içinde hesaplanmaz: `projectConversationRow` `localStorage`'a HİÇ dokunmaz, türetme tek yer olarak render zamanındaki `refreshConversationRowUnseen`'e taşınır"
    - "Bir mutasyondan (çöz/tekrar aç/yanıt) sonra ilgili liste satırı taze detaydan `setQueryData` ile yamanır; satır önbellekteki hiçbir sayfada yoksa önbellek DEĞİŞTİRİLMEZ (uydurma satır üretilmez)"
    - "Mutasyondan sonra listeye dönüldüğünde yeni durum/önizleme GÖRÜNÜR: `setQueryData` `updatedAt`'i korur ve `invalidateQueries` ondan SONRA çalışır, böylece `isInvalidated` bayrağı hayatta kalır ve remount'ta refetch tetiklenir"
    - "Bu oturumda oluşturulan bir konuşma listeye dönüldüğünde görünmeye devam eder"
    - "`currentTicketUpdated` payload'ının gerçek şekli tek bir `console.info` ile raporlanır; handler'ın DAVRANIŞI (yine `switchTicket(ticket.key)`) değişmez"
    - "527 testin tamamı yeşil kalır; `tsc --noEmit` exit 0"
  artifacts:
    - "src/screens/chat-screen.tsx — türetilmiş menü sırası + `Yenile` öğesi + tetikte dönen ikon"
    - "src/query/side-conversation-queries.ts — iki `invalidateQueries` çağrısı ağ-tetiklemez hâle gelir; `refreshCanonicalAfterMutation` sıralaması düzeltilir ve satır yaması eklenir; `tenantId` projeksiyon zincirinden düşer"
    - "src/store/side-conversations-store.ts — `projectConversationRow` `localStorage`'dan arındırılır; `patchConversationRowFromDetail` saf yardımcısı eklenir"
    - "src/contexts/grispi-context.tsx — davranışı değiştirmeyen tek satırlık payload teşhisi"
    - "Dört test dosyası — eski sözleşmeyi doğrulayan testler SİLİNMEZ, yeni sözleşmeye GÜNCELLENİR"
  key_links:
    - "`detail.isFetching` → menü tetiğinin ikonu (`ReloadIcon animate-spin`) + `Yenile` öğesinin `disabled`'ı — menü kapansa bile hayatta kalan tek geri bildirim kanalı"
    - "`menuItems` türetilmiş dizisi → `menuItems.indexOf(id)` → `menuItemRefs.current[index]` → `handleMenuItemKeyDown` — elle indeks aritmetiğinin YERİNE geçen tek kaynak"
    - "`setLastSeenAt` (detay effect'i) → `localStorage` → `refreshConversationRowUnseen` (render zamanı, liste ekranı remount'unda taze okunur) → `row.hasUnseen` → sol kenar çubuğu. Bu zincirde ARTIK AĞ YOK"
    - "`queryClient.setQueryData(listKey, updater, { updatedAt: öncekiDataUpdatedAt })` → `successState` `isInvalidated: false` yazar → BU YÜZDEN `invalidateQueries` ondan SONRA çağrılmalı → `isStaleByTime` `isInvalidated`'ı okur → `shouldFetchOnMount` → liste remount'ta refetch eder"
    - "`app.tsx`'in `{screen === \"list\" && <ConversationsListScreen />}` koşullu render'ı → ekran değişiminde GERÇEK unmount/remount → `refetchOnMount` (varsayılan `true`, hiçbir yerde ezilmemiş) → yalnızca ajan listeye BAKARKEN tek bir fetch"
  prohibitions:
    - statement: "Liste ekranındaki mevcut yenileme ikon düğmesi DEĞİŞTİRİLMEZ — asimetri kasıtlıdır"
      status: must-not
    - statement: "`hydrateSummaries`'in N+1'i (advanced-search + satır başına getTicket) YENİDEN YAPILANDIRILMAZ — sorun sıklık, N+1'in kendisi değil"
      status: must-not
    - statement: "Hiçbir `staleTime` değeri değiştirilmez; polling / arka plan refetch EKLENMEZ (Phase 5 SYNC-01, kapsam dışı)"
      status: must-not
    - statement: "Yazma yolları (D-15 `patchTicket`/`public/v1`, D-01/D-02/D-22/D-23 `assertSideConversationLink`, D-21 sanitizer) HİÇ ELLENMEZ — bu iş yalnızca önbellek/refetch politikası ve UI'dir"
      status: must-not
    - statement: "Task C'de doğrulanmamış bir varsayıma dayanarak `getTicket` KALDIRILMAZ; standalone dev yolu değiştirilmez"
      status: must-not
    - statement: "Dev başlangıcındaki çift `getTicket` React StrictMode'un çift-effect'idir — 'düzeltilmez'"
      status: must-not
---

<objective>
Sohbet ekranına manuel yenileme kontrolü ekle ve proje genelindeki gereksiz ağ isteklerini temizle.

Purpose: Canlı ölçüm (2026-08-21, dev :3000, `window.fetch` stub'lı, 3 satırlık liste) tek bir "Çözüldü olarak işaretle" eyleminin **1 yazma + 9 okuma** ürettiğini, bunların **4'ünün birebir kopya** olduğunu gösterdi. Gerçek sayfa boyutu 5 ile bu 14 istek; 3 yüklü sayfayla ~40 istek. Kök neden: `useSideConversationDetailQuery`'nin effect'i HER başarılı detay fetch'inde liste sorgusunu `refetchType: "all"` ile invalidate ediyor. Liste bir infinite query olduğu için tek bir invalidate = 1 advanced-search + yüklü her satır için 1 getTicket — üstelik liste ekranı unmount'tayken bile (`"all"`).

O invalidate'in VAR OLMA SEBEBİ: ajan konuşmayı okuduktan sonra satırdaki okunmamış noktasının temizlenmesi. Ama `hasUnseen` tamamen yerel bir türetme (`localStorage`'daki `getLastSeenAt` ile `lastPublicCommentAt` karşılaştırması) ve queryFn'in İÇİNDE hesaplanıyor — yani saf-yerel bir türetmeyi tazelemek şu an tam bir ağ turu gerektiriyor.

Output: Menüde `Yenile`, iki invalidate'in ağ-tetiklemez hâle gelmesi, `hasUnseen`'in render zamanına taşınması, mutasyon sonrası tek satırlık önbellek yaması ve SDK payload'ı için davranış-nötr bir teşhis.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/CLAUDE.md

@src/screens/chat-screen.tsx
@src/query/side-conversation-queries.ts
@src/store/side-conversations-store.ts
@src/contexts/grispi-context.tsx
</context>

<interface_context>

## Doğrulanmış React Query gerçekleri (v5.101.4, `node_modules/@tanstack/query-core` kaynağından okundu — tahmin değil)

Task 2'nin doğruluğu bu üç davranışa dayanıyor. Hiçbiri hafızadan yazılmadı; kurulu sürümün kaynağından teyit edildi:

1. **`query.js:127 isStaleByTime`** → `if (this.state.isInvalidated) return true`. Yani invalidate edilmiş bir sorgu, `staleTime` penceresi içinde OLSA BİLE mount'ta refetch edilir. `refetchType: "none"` ile invalidate etmek bu yüzden "liste bir dahaki sefere kesin tazelenir" garantisini KORUR.
2. **`queryObserver.js:447 shouldFetchOnMount`** → `refetchOnMount` üzerinden `isStale`'e bakar. `refetchOnMount` bu projede hiçbir yerde ezilmemiştir (`query-client.ts`'deki `sharedQueryDefaults` ve `side-conversation-queries.ts`'deki `finiteReadPolicy` yalnızca `refetchInterval`/`refetchOnReconnect`/`refetchOnWindowFocus` ayarlar), dolayısıyla varsayılan `true`'dur.
3. **`query.js:422 successState`** → `isInvalidated: false` yazar ve `dataUpdatedAt`'i `options.updatedAt ?? Date.now()` yapar. `setQueryData` bu yolu kullanır (`queryClient.js:102`, `manual: true`).
   **Sonuç (Task 2'nin en kritik tuzağı):** `setQueryData`, `isInvalidated` bayrağını TEMİZLER. Bu yüzden `invalidateQueries` **`setQueryData`'dan SONRA** çalışmak zorundadır; ters sırada liste 30 saniye boyunca "taze ama yalnızca kısmen yamalı" kalır ve remount refetch etmez.
4. **`queryClient.js:99`** → `setQueryData` updater'ı `undefined` döndürürse fonksiyon hiç dispatch yapmadan çıkar. Satır önbellekte bulunamadığında "önbelleğe dokunma" davranışı böyle elde edilir.

## `app.tsx` remount sözleşmesi

`app.tsx` ekranları `{screen === "list" && <ConversationsListScreen />}` şeklinde koşullu render eder — ekran değişimi GERÇEK bir unmount/remount'tur. Bu, iki şeyi aynı anda sağlar: (a) invalidate edilmiş liste sorgusu remount'ta refetch edilir, (b) `useSideConversationsQuery`'deki `useMemo` sıfırdan çalışır, yani `refreshConversationRowUnseen` `getLastSeenAt`'i TAZE okur.

## `hasUnseen` zaten yarı yolda

`dedupeAndSortConversationRows` HÂLİHAZIRDA her satırı `refreshConversationRowUnseen`'den geçiriyor, yani render zamanı türetmesi zaten var. Eksik olan tek şey, `projectConversationRow`'un fetch zamanında `localStorage` okuyup `hasUnseen`'i önbelleğe GÖMMESİ — ki bu değer birkaç satır sonra zaten üzerine yazılıyor. Task 2 bu ölü okumayı kaldırıp türetmeyi tek kaynağa indiriyor. Bu bir yeniden yapılandırma değil, yarım kalmış bir taşımanın tamamlanması.

## Menü indeks aritmetiği kırılgan

`chat-screen.tsx`'te `menuItemRefs.current[0]` (yaşam döngüsü) ve `menuItemRefs.current[canLifecycleAction ? 1 : 0]` (üst talep) elle yazılmış. 0. konuma öğe eklemek bunları sessizce bozar. Task 1 bu aritmetiği türetilmiş bir sırayla değiştirir.
</interface_context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Sohbet ekranının `…` menüsüne `Yenile` ekle ve indeks aritmetiğini türetilmiş sırayla değiştir</name>
  <files>src/screens/chat-screen.tsx, src/screens/__tests__/chat-screen.test.tsx</files>

  <behavior>
    - `sideKey` varken menü açıldığında ilk `[role="menuitem"]` `Yenile`'dir ve odak ondadır (`…` + Enter = yenile)
    - `Yenile`'ye tıklamak `detail.refetch()`'i tam bir kez çağırır, menüyü kapatır ve odağı tetiğe döndürür
    - `detail.isFetching` true iken: `Yenile` öğesi `disabled`, menü tetiğinin ikonu dönen `ReloadIcon`
    - `detail.isFetching` false iken tetiğin ikonu `DotsHorizontalIcon`
    - `sideKey` null iken `Yenile` öğesi hiç render edilmez
    - Kapalı (closed) konuşmada, üst talep URL'i olmasa bile tetik `disabled` değildir ve menüde `Yenile` bulunur
    - Üç öğeli menüde ArrowDown son öğeden ilk öğeye sarar; ArrowUp ilk öğeden son öğeye sarar; Home ilk, End son öğeye gider
  </behavior>

  <action>
Menünün mevcut iki yeteneğinin (yaşam döngüsü, üst talep) yanına üçüncüsünü ekle ve öğe sırasını elle yazılan indekslerden kurtar.

**1. Yenileme yeteneğinin kapıları.** `canLifecycleAction` ile aynı desende, VARLIK kapısı olarak `canRefresh` türet: yalnızca `Boolean(sideKey)`. Henüz oluşturulmamış bir konuşmanın tazelenecek hiçbir şeyi yoktur, bu yüzden öğe GİZLENİR (disabled değil) — `canLifecycleAction`'ın aynı durumu ele alış biçimiyle tutarlı. Hata durumunda öğe görünür kalmalıdır: gövdedeki hata kartının kendi "Tekrar dene" düğmesi vardır ama menüden de erişilebilmelidir, dolayısıyla kapıya `isError` GİRMEZ.

**2. Uçuş hâli.** `detail.isPending || detail.isFetching` bileşiminden tek bir `refreshBusy` türet. `Yenile` öğesinin `disabled` özniteliği budur — art arda tıklamalar refetch kuyruğa alamaz (liste ekranındaki düğmenin aynı gerekçesi).

**3. Türetilmiş menü sırası.** Elle indeks aritmetiğini kaldır. Yerine, o an render edilecek öğelerin kimliklerini sırasıyla tutan bir dizi kur — sıra: yenile, yaşam döngüsü, üst talep. Her öğenin `ref` callback'i ve `onKeyDown`'u indeksini bu diziden `indexOf` ile okusun; `menuItemRefs.current`'ın uzunluğu da bu diziye göre kırpılsın ki gizlenen bir öğe geride ölü bir `ref` bırakmasın. Menü açılış effect'indeki "ilk mevcut öğeye odaklan" davranışı olduğu gibi kalır — dizi zaten doğru sırayı verdiği için otomatik olarak `Yenile`'ye odaklanır. Bu değişikliğin amacı ileriye dönük: dördüncü bir öğe eklendiğinde klavye sözleşmesinin sessizce bozulması yapısal olarak imkânsız hâle gelir.

**4. Öğenin kendisi.** Menüdeki diğer buton öğesiyle aynı sınıf setini (`min-h-11`, `w-full`, `rounded`, `px-3 py-2`, `text-left`, `text-sm font-semibold`, hover/focus-visible/disabled halleri) kullan. Görünen metin `Yenile`, `aria-label` `Konuşmayı yenile`. `onClick`: önce menüyü kapat (odak tetiğe döner), sonra `void detail.refetch()`.

**5. Tetiğin geri bildirimi.** Menü kapandıktan sonra da görünen tek sinyal tetiktir. `detail.isFetching` iken tetiğin içeriğini `ReloadIcon`'a çevir ve `animate-spin` ver (liste ekranındaki düğmenin birebir aynı deyimi); aksi hâlde `DotsHorizontalIcon` kalır. İkon boyutu her iki durumda da `size-5` — header genişliğine sıfır maliyet.

**6. Tetiğin `disabled` kapısı.** Mevcut kapı, kapalı bir konuşmada üst talep URL'i çözülememişse ajanı ölü bir menüyle baş başa bırakıyor. Yenileme yeteneğini de kapıya kat: tetik yalnızca ÜÇ yeteneğin de kullanılamaz olduğu durumda kapanır.

**7. Yorum.** Öğenin başına kısa bir yorum koy: liste ekranında ikon düğmesi, burada menü öğesi olmasının nedeni header genişliğidir — ~280px panelde başlık alanı 172px ve üçüncü bir 40px ikon düğmesi onu 132px'e düşürür; bu tam olarak 2026-08-17 canlı UAT'ının üst talep chip'ini bu header'dan çıkarmasına yol açan sıkışmadır. Asimetri kasıtlıdır. Yorum bir-iki satır olsun, paragraf değil.

**8. Test harness'ı.** `makeDetail` fabrikasına `isFetching: false` ekle — mevcut çağıranların hepsi etkilenmeden çalışmaya devam eder.

**9. Eski sözleşmeyi doğrulayan testleri GÜNCELLE, silme.** İlk `[role="menuitem"]`'in yaşam döngüsü öğesi olduğunu varsayan testler artık `Yenile`'yi bulacak. Bu testlerin niyeti yaşam döngüsü öğesini bulmaktı, sırayı sabitlemek değil — bu yüzden konum indeksi yerine etikete göre seçim yapacak şekilde güncelle. Menü açılış odağını doğrulayan test ise gerçekten sırayı sabitliyordu: onu yeni sözleşmeye (ilk öğe `Yenile`, odak onda) göre yeniden yaz.

Liste ekranının kendi yenileme ikon düğmesine DOKUNMA.
  </action>

  <verify>
    <automated>cd /Users/davut/Code/grispiapp/side-conversations-plugin && CI=true npx craco test --watchAll=false --testPathPattern="chat-screen" 2>&1 | tail -25 && npx tsc --noEmit && test "$(grep -c 'Konuşmayı yenile' src/screens/chat-screen.tsx)" = "1" && test "$(grep -v '^\s*[/*]' src/screens/chat-screen.tsx | grep -c 'menuItemRefs\.current\[[01]\]')" = "0"</automated>
  </verify>

  <done>
`chat-screen.test.tsx` yeşil; `tsc --noEmit` exit 0. Menü açıldığında ilk öğe `Yenile` ve odak ondadır. `detail.isFetching` iken tetik dönen ikon gösterir ve öğe `disabled`'dır. `sideKey` null iken öğe yoktur. Kapalı konuşmada tetik `disabled` değildir ve menüde `Yenile` vardır. Üç öğede ArrowDown/ArrowUp sarma, Home/End doğru çalışır. Elle yazılmış indeks aritmetiği kodda kalmamıştır. Liste ekranı dosyası değişmemiştir.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Kopya istekleri kaldır — invalidate'leri ağ-tetiklemez yap, `hasUnseen`'i render zamanına taşı, mutasyon sonrası satırı yamala</name>
  <files>src/query/side-conversation-queries.ts, src/store/side-conversations-store.ts, src/query/__tests__/side-conversation-queries.test.tsx, src/store/__tests__/side-conversations-store.test.ts</files>

  <behavior>
    - Detay effect'i liste sorgusunu yalnızca `stale` işaretler; hiçbir liste fetch'i tetiklemez
    - `projectConversationRow` `localStorage` okumaz ve her zaman `hasUnseen: false` üretir; okunmamış hâli `dedupeAndSortConversationRows` render zamanında hesaplar
    - Aynı `sideKey` iki farklı tenant altında bağımsız okunmamış hâline sahiptir (izolasyon korunur, yalnızca hesaplandığı yer değişir)
    - `refreshCanonicalAfterMutation` sırası: detay refetch → satır yaması (`updatedAt` korunarak) → liste invalidate (ağsız)
    - Yamalanan satır: `lifecycle`, `actionBadge`, `lastPublicCommentAt`, `summary` taze detaydan gelir; `statusName` yalnızca kanıtlanabildiğinde yazılır
    - Satır hiçbir önbellek sayfasında yoksa önbellek nesnesi DEĞİŞMEZ (referans kimliği aynı kalır) ve uydurma satır eklenmez
    - Yama sonrası liste sorgusu HÂLÂ `isInvalidated` durumundadır (remount'ta refetch eder)
  </behavior>

  <action>
Üç değişiklik, tek commit. Her biri ölçülen kopyaların farklı bir kaynağını kapatır.

**B1 — İki invalidate'i ağ-tetiklemez yap.**

`useSideConversationDetailQuery`'nin effect'indeki ve `refreshCanonicalAfterMutation`'daki `invalidateQueries` çağrılarının refetch türünü, "tüm eşleşenleri (pasif olanlar dâhil) hemen yeniden çek" yerine "hiçbirini çekme, yalnızca stale işaretle" olacak şekilde değiştir (React Query'nin `refetchType` seçeneğinin `"none"` değeri).

Bu invalidate'lerin niye SİLİNMEDİĞİNİ öğe başına bir yorumla kayda geç — bir sonraki okuyanın "artık işlevsiz" diye temizlemesini engelle: stale işareti bedavadır ve `isInvalidated` bayrağı `staleTime` penceresini EZER, dolayısıyla ajan listeye döndüğünde (gerçek bir unmount/remount) liste tam olarak bir kez, tam da ona bakılırken tazelenir. Elde edilen davranış: ajan bir başlığı okurken liste iki kez çekilmek yerine hiç çekilmez.

**B2 — `hasUnseen` türetmesini queryFn'den çıkar.**

`resolveRowState` şu an `getLastSeenAt`'i fetch zamanında okuyup sonucu önbelleğe gömüyor; oysa `dedupeAndSortConversationRows` bu değeri birkaç satır sonra `refreshConversationRowUnseen` ile zaten yeniden hesaplıyor. Yani mevcut okuma ölü. Kaldır:

- `resolveRowState` artık `tenantId` almasın ve `localStorage`'a hiç dokunmasın; her iki dönüş yolunda da `hasUnseen: false` versin. Türetmenin tek sahibi `refreshConversationRowUnseen`'dir.
- `projectConversationRow`'un `tenantId` parametresini düşür. Bu isteğe bağlı bir sadeleştirme değil: parametreyi bırakmak, ileride birinin fetch zamanında yeniden `localStorage` okumasını davet eder. Parametrenin yokluğu, queryFn'in yerel-depo-bağımsızlığını YAPISAL olarak garanti eder.
- Aynı düşüşü çağrı zincirinde sürdür: `hydrateSummaries` ve `fetchSideConversationPage` da `tenantId`'yi taşımayı bıraksın. `sideConversationListOptions`'ın queryFn'indeki `requireIdentity(tenantId, "tenantId")` kontrolü YERİNDE KALIR — o, "kimlik çözülmeden sorgu çalışmaz" invariant'ıdır ve kendi testi vardır. Tenant izolasyonu zaten queryKey'de ve `dedupeAndSortConversationRows`'un `tenantId` argümanındadır; hiçbir izolasyon kaybı yoktur.
- `ConversationRowVM` şekli DEĞİŞMEZ — `hasUnseen` alanı olarak kalır, yalnızca kim doldurduğu değişir. `conversation-row.tsx` gibi tüketiciler ellenmez.

Bu değişiklikten sonra okunmamış noktası, ajan listeye döndüğünde ekran remount'unun `useMemo`'yu sıfırdan çalıştırması sayesinde SIFIR ağ isteğiyle temizlenir.

**B3 — Mutasyondan sonra tek satırı yamala.**

`refreshCanonicalAfterMutation` elinde zaten taze `SideConversationDetail` tutuyor. Liste invalidate'ini beklemek yerine ilgili satırı doğrudan yaz. Sıra KRİTİKTİR ve `<interface_context>`'te kanıtlanmıştır — `setQueryData` `isInvalidated` bayrağını temizler, bu yüzden invalidate EN SONA gider:

1. Mevcut detay refetch'i ve `isCurrent` kapıları olduğu gibi kalır.
2. Taze detay elde edildikten sonra: liste sorgusunun mevcut `dataUpdatedAt`'ini `getQueryState` ile oku, ardından infinite-query önbelleğine `setQueryData` uygula ve seçenek olarak o `updatedAt`'i geri ver. Zaman damgasını korumak zorunludur; aksi hâlde yama satırı "az önce tazelenmiş" gibi gösterir ve remount refetch'ini `staleTime` boyunca bastırır.
3. Sonra liste invalidate'i (B1'deki ağsız hâliyle).

Updater'ın sözleşmesi:
- Önbellek şekli `{ pages: SideConversationListPage[], pageParams }`'tir. Sayfalar arasında `key === sideKey` olan satırı ara.
- **Bulunamazsa `undefined` döndür.** React Query bunu hiç dispatch etmeden yok sayar, yani önbellek nesnesi birebir aynı referans kalır. Bu, listenin hiç görmediği yeni oluşturulmuş bir konuşmanın uydurma bir satıra dönüşmesini engelleyen kapıdır; o satır zaten invalidate + remount refetch'i ile gelecektir.
- Bulunursa yalnızca o satırı değiştir; diğer sayfalar ve diğer satırlar referans kimliğini korusun.

Yama mantığını `side-conversations-store.ts`'e saf bir yardımcı olarak koy (satır projeksiyonu zaten orada yaşıyor). Yardımcı, mevcut satırı ve taze detaydan gelen mesajları alsın. Detay modülünden tip ithal ETME — `side-conversation-queries.ts` zaten store'dan ithal ediyor, ters yön döngü olurdu; bunun yerine ihtiyaç duyulan alanları (`createdAt`, `direction`, `internal`, `body`) tanımlayan dar bir yapısal arayüz tanımla. `MessageVM` bu arayüze yapısal olarak atanabilir, ek dönüşüm gerekmez.

Yardımcının türettikleri:
- `publicComments`: iç not olmayan mesajlar; `authorIsAgent` mesajın yönünün "own" olmasıdır. `deriveBadge`'in dokümante ettiği "çağıran filtreler" sözleşmesine uyar (D-06).
- `lifecycle`: detaydan doğrudan.
- `actionBadge` ve `lastPublicCommentAt`: mevcut `deriveBadge` ile. `deriveBadge` girdi olarak sayısal bir statü kimliği bekliyor; detayda yalnızca daraltılmış yaşam döngüsü var, bu yüzden yaşam döngüsünü `conversation-status.ts`'in probe ile doğrulanmış SOLVED/CLOSED kimliklerine geri eşle ve "open" için kimlik yerine null geç (parser zaten bunu "open" olarak çözer). Bu ters eşlemeyi tek satırlık bir yorumla gerekçelendir.
- `summary`: son public yorumun gövdesi, `projectConversationRow`'un kullandığı AYNI düz-metne çevirme ve kırpma kuralıyla. Kırpma kuralını her iki çağıranın paylaştığı küçük bir yardımcıya çıkar — iki ayrı yerde iki farklı kırpma uzunluğu doğabilmesini engelle.
- `hasUnseen`: her zaman `false` (B2 ile aynı sözleşme; render zamanı sahibidir).
- `statusName`: yalnızca kanıtlanabildiğinde yaz. Yaşam döngüsü "closed" veya "solved" ise karşılık gelen kanonik statü adını yaz. Yaşam döngüsü "open" ve satırın ÖNCEKİ yaşam döngüsü "open" DEĞİLSE (yani tekrar açma), kanonik "open" adını yaz. Her iki hâlde de değilse satırın mevcut `statusName`'ini OLDUĞU GİBİ BIRAK: "open" altı statüden üçünü birden temsil eder (Yeni/Açık/Beklemede) ve detay bunları ayırt edemez. Bu, yamanın iyimser ve KISMİ olduğunun bilinçli kabulüdür; kesin düzeltme, hayatta bıraktığımız invalidate'in remount'ta tetiklediği gerçek fetch'ten gelir. Kanonik adlar `ticket-status.ts`'in eşleme tablosundaki anahtarlarla birebir aynı yazımda olmalıdır, yoksa statü karesi sessizce kaybolur.
- `hydrationFailed`: DEĞİŞTİRME. Elimizde bu satır için taze detay olsa da alıcı e-postası hâlâ çözülmemiş olabilir; bayrağı çevirmek doğrulayamadığımız bir iddia olur.

**Testler — eski sözleşmeyi doğrulayanları GÜNCELLE, silme.**

`side-conversation-queries.test.tsx`:
- Yanıt mutasyonunun önbellek yakınsamasını doğrulayan test, invalidate'in refetch'ten ÖNCE geldiğini ve refetch türünü ertelenmiş promise'lerle sabitliyor. Yeni sıraya göre yeniden yaz: önce detay refetch'i, sonra satır yaması, en son invalidate — ve invalidate'in artık ağ tetiklemeyen türü kullandığını argüman düzeyinde doğrula.
- İç not sıralama testi (WR-03'te tautolojik olduğu kayıtlı olan test) sıralama çıpası olarak invalidate'i kullanıyor. İnvalidate artık en sona taşındığı için bu test kırılacaktır. Çıpayı, mutasyon sonrası ilk önbellek işlemi olan detay refetch'ine taşı. **Bu testi "düzeltmek" bu görevin kapsamı değildir** — WR-03 borcu açık kalır; yalnızca yeni sıralamayı ölçecek şekilde uyarlanır ve durumu SUMMARY'de tekrarlanır.
- İç not başarısızlığında yakınsama adımlarının yine çalıştığını doğrulayan test ve solve/reopen testi: argüman beklentilerini yeni türe ve yeni sıraya göre güncelle.
- Detay effect'inin yan etkileri tekrarlamadığını doğrulayan test çağrı SAYISINI ölçüyor, argümanları değil — geçerliliğini korur, dokunma.
- YENİ test ekle: satır önbellekte yokken `setQueryData` sonrası liste önbelleğinin referans kimliği değişmez.
- YENİ test ekle: yamadan sonra liste sorgusu hâlâ `isInvalidated`'dır ve `dataUpdatedAt` yama öncesiyle aynıdır (sıralama tuzağının regresyon kilidi).

`side-conversations-store.test.ts`:
- `projectConversationRow`'un okunmamış hâli ürettiğini varsayan testler artık `false` görecek. Niyet "okunmamış türetmesi doğru çalışıyor"du; iddiayı türetmenin yeni sahibine (`dedupeAndSortConversationRows` / `refreshConversationRowUnseen`) taşıyarak koru.
- Tenant izolasyonu testini aynı şekilde yeni sahibe taşı — invariant korunur, ölçüldüğü yer değişir.
- YENİ test ekle: yama yardımcısı için çöz, tekrar aç, yanıt ve "statü adı kanıtlanamıyor" senaryoları.

**Regresyon güvenceleri — bunlar bu görevin gerçek riskleridir, her biri testle kapanmalıdır:**
1. Çöz/tekrar aç sonrası listeye dönünce YENİ durum görünür (yama + hayatta kalan `isInvalidated`).
2. Yanıt gönderdikten sonra listeye dönünce önizleme metni GÜNCELDİR.
3. Okunmamış noktası okunan başlıkta temizlenir, okunmayanlarda TEMİZLENMEZ.
4. Bu oturumda oluşturulan konuşma listeye dönüldüğünde GÖRÜNÜR (satır bulunamadığında yama atlanır, invalidate iş görür).
  </action>

  <verify>
    <automated>cd /Users/davut/Code/grispiapp/side-conversations-plugin && CI=true npx craco test --watchAll=false 2>&1 | tail -25 && npx tsc --noEmit && test "$(grep -v '^\s*[/*]' src/store/side-conversations-store.ts | grep -c 'getLastSeenAt')" = "2" && test "$(grep -v '^\s*[/*]' src/query/side-conversation-queries.ts | grep -cE 'refetchType:\s*.none.')" = "2" && test "$(grep -v '^\s*[/*]' src/query/side-conversation-queries.ts | grep -cE 'refetchType:\s*.all.')" = "0"</automated>
  </verify>

  <done>
Tüm test paketi (527+) yeşil; `tsc --noEmit` exit 0. `side-conversations-store.ts`'te `getLastSeenAt` yalnızca import satırında ve `refreshConversationRowUnseen` içinde geçer (toplam 2). Her iki invalidate de ağ tetiklemez. `refreshCanonicalAfterMutation` sırası detay-refetch → satır-yaması → invalidate'tir ve yama `updatedAt`'i korur. Satır bulunamadığında liste önbelleği referans olarak değişmez. Dört regresyon güvencesinin her biri en az bir testle kapatılmıştır.
  </done>
</task>

<task type="auto">
  <name>Task 3: SDK `currentTicketUpdated` payload'ı için davranış-nötr teşhis</name>
  <files>src/contexts/grispi-context.tsx, src/contexts/__tests__/grispi-context.test.tsx</files>

  <action>
`plugin.currentTicketUpdated` handler'ı SDK'dan tam bir ticket nesnesi alıp `.key` dışındaki her şeyi atıyor ve o anahtar için taze bir `getTicket` isteği çıkarıyor. Payload zaten `fieldMap` taşıyorsa bu istek her ticket değişiminde saf israftır.

**Bu DOĞRULANMAMIŞ bir hipotezdir. Bu görev onu doğrulamaz, doğrulanabilir hâle getirir.**

Handler gövdesinin EN BAŞINA — mevcut environment kapısından da önce, ki kapı tarafından düşürülen erken olaylar da raporlansın — tek bir `console.info` ekle. Raporlaması gerekenler: payload'ın üst düzey anahtarları, `fieldMap`'in var olup olmadığı, varsa kaç anahtar taşıdığı ve `tp.side_conversation_parent` alanının bulunup bulunmadığı. Alan anahtarını elle yazma; `side-conversation.ts`'in dışa açtığı sabiti ithal et (D-01/D-02: anahtar tek kaynaktan gelir). Teşhis, `ticket` null/eksik gelse bile ASLA fırlatmamalıdır — her erişim savunmacı olsun.

Bunun dışında handler'ın davranışı BİRE BİR AYNI kalır: environment kapısı, düşürülen olayların gerekçe yorumu ve `switchTicket(ticket.key)` çağrısı ellenmez. Standalone dev yolu hiç değiştirilmez. Bu commit ölçülebilir hiçbir ağ davranışını değiştirmez.

**Kaldırma kararı bu çalışmada VERİLMEZ.** Burada canlı bir Grispi iframe'i yok, dolayısıyla `getTicket`'ı kaldırmak için gereken kanıt üretilemez. Tüketiciler `side-conversation.ts`'teki `isHydratedTicket` / `isSideConversationTicket` / `parentKeyOfTicket`'tir ve üçü de `fieldMap` içinde `tp.side_conversation_parent` anahtarını arar; payload bunu kanıtlanabilir biçimde taşımıyorsa istek kalmak zorundadır.

SUMMARY.md'ye şunları yaz:
- Panelde tam olarak neye bakılacağı: gerçek Grispi iframe'inde ticket değiştirip bu `console.info` satırının `fieldMap` için ne raporladığı.
- İki sonuç dalı: `fieldMap` mevcut ve parent alanını taşıyorsa takip değişikliği "payload'ı doğrudan `setTicket`'a ver, yalnızca eksikse `getTicket`'a düş" olur; taşımıyorsa mevcut davranış doğrudur ve teşhis kaldırılabilir.
- Dev başlangıcında görülen çift `getTicket`'ın React StrictMode'un çift çağrılan effect'i olduğu — yalnızca dev, hata DEĞİL, "düzeltilmemeli". Tekrar rapor edilmemesi için açıkça yaz.

Test: mevcut `grispi-context.test.tsx`'in WR-01 kapı testleri handler davranışını zaten kilitliyor; hepsi değişmeden geçmelidir. Buna ek olarak, `console.info`'yu izleyen ve environment hazır olduğunda handler'ın (a) teşhisi bir kez yazdığını, (b) `getTicket`'ı hâlâ tam bir kez olayın anahtarıyla çağırdığını doğrulayan tek bir test ekle. `fieldMap`'siz bir ticket ile de fırlatmadığını aynı testte kanıtla.
  </action>

  <verify>
    <automated>cd /Users/davut/Code/grispiapp/side-conversations-plugin && CI=true npx craco test --watchAll=false --testPathPattern="grispi-context" 2>&1 | tail -20 && npx tsc --noEmit && test "$(grep -c 'SIDE_CONVERSATION_PARENT_FIELD_KEY' src/contexts/grispi-context.tsx)" = "2"</automated>
  </verify>

  <done>
`grispi-context.test.tsx` yeşil (mevcut WR-01 testleri dâhil, değiştirilmeden); `tsc --noEmit` exit 0. Handler tek bir `console.info` yazar, `switchTicket(ticket.key)` çağrısını korur ve `fieldMap`'siz payload'da fırlatmaz. Alan anahtarı `side-conversation.ts`'ten ithal edilmiştir, elle yazılmamıştır. `getTicket` KALDIRILMAMIŞTIR. SUMMARY.md doğrulama reçetesini, iki sonuç dalını ve StrictMode notunu içerir.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Grispi SDK → plugin | `currentTicketUpdated` payload'ı iframe host'undan gelir; Task 3 onu yalnızca LOG'lar, hiçbir güven kararına sokmaz |
| React Query önbelleği → UI | Task 2 önbelleğe doğrudan yazma (`setQueryData`) ekliyor — sunucu doğrulamasından geçmemiş tek veri yolu |
| `localStorage` → UI | `getLastSeenAt` okuması fetch zamanından render zamanına taşınıyor |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-itv-01 | Tampering | `setQueryData` satır yaması | medium | mitigate | Updater yalnızca MEVCUT bir satırı değiştirir; bulunamazsa `undefined` döner ve önbellek hiç dispatch almaz. Uydurma satır üretilemez. Testle kilitlenir |
| T-itv-02 | Information disclosure | Task 3 `console.info` | low | mitigate | Yalnızca anahtar ADLARI, alan SAYISI ve varlık bayrakları loglanır; hiçbir alan DEĞERİ, e-posta veya yorum gövdesi loglanmaz |
| T-itv-03 | Denial of service | Yenile öğesinin tekrar tıklanması | low | mitigate | Öğe `isPending || isFetching` iken `disabled`; liste ekranındaki düğmenin aynı kapısı |
| T-itv-04 | Repudiation | Stale liste görünümü | medium | mitigate | `setQueryData` `updatedAt`'i korur ve `invalidateQueries` ondan sonra çalışır, böylece `isInvalidated` hayatta kalır; ajana asla "taze" diye yamalı-kısmi bir liste sunulmaz |
| T-itv-SC | Tampering | paket kurulumu | n/a | accept | Bu iş hiçbir paket kurmaz — `package.json` değişmez |
</threat_model>

<verification>
1. `CI=true npx craco test --watchAll=false` — 527+ test yeşil, sıfır atlanan
2. `npx tsc --noEmit` — exit 0
3. Eski sözleşmeyi doğrulayan hiçbir test SİLİNMEMİŞ, hepsi yeni sözleşmeye güncellenmiş (git diff'te silinen `it(` bloğu olmamalı; taşınanlar yeni sahibinde görünmeli)
4. `package.json` ve `package-lock.json` değişmemiş
5. `src/screens/conversations-list-screen.tsx` değişmemiş
6. Yazma yolları değişmemiş: `assertSideConversationLink`, `patchTicket`, `replyTicket`, `createTicket` ve sanitizer çağrıları diff'te yok
7. Hiçbir `staleTime` sabiti değişmemiş
</verification>

<success_criteria>
- Sohbet ekranının `…` menüsü ilk sırada `Yenile` sunar; `…` + Enter tek bir detay refetch'i tetikler ve başka hiçbir sorgu ağa çıkmaz
- Uçuş hâli menü kapandıktan sonra da tetikteki dönen ikonla görünür
- Menü öğesi klavye sıralaması türetilmiş bir listeden gelir; elle indeks aritmetiği kalmamıştır
- Bir konuşmayı açmak artık tam liste yeniden çekmesi tetiklemez
- Okunmamış noktası sıfır ağ isteğiyle temizlenir
- Bir yaşam döngüsü mutasyonu artık kopya advanced-search + getTicket turları üretmez; ilgili satır taze detaydan yamalanır
- Listeye dönüş yeni durumu, güncel önizlemeyi ve bu oturumda oluşturulan konuşmayı gösterir
- `currentTicketUpdated` payload'ının şekli bir sonraki canlı oturumda kanıta dönüştürülebilir; kod davranışı değişmemiştir
- Tüm test paketi yeşil, `tsc --noEmit` exit 0
</success_criteria>

<output>
Create `.planning/quick/260821-itv-chat-ekranina-manuel-yenileme-gereksiz-i/260821-itv-SUMMARY.md` when done.

SUMMARY MUTLAKA şunları içermeli:
- Task 3'ün canlı doğrulama reçetesi ve iki sonuç dalı
- Dev başlangıcındaki çift `getTicket`'ın StrictMode kaynaklı olduğu ve hata olmadığı notu (tekrar raporlanmasın)
- WR-03 test borcunun HÂLÂ AÇIK olduğu — sıralama testi yalnızca yeni çıpaya uyarlandı, tautolojisi giderilmedi
- Ölçülebiliyorsa mutasyon başına istek sayısının öncesi/sonrası karşılaştırması
</output>
