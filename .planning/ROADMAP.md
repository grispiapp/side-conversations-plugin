# Roadmap: Yan Görüşmeler — Grispi Side Conversations Plugin

## Overview

Temsilcinin talepten hiç ayrılmadan üçüncü taraflarla gizli e-posta yazışmaları yürütmesini sağlayan sağ-panel plugin'i, okuma → oluşturma → yanıtlama → zenginleştirme sırasıyla dört dikey MVP dilimi hâlinde inşa edilir. Faz 1 veri modelini (settings/field key'leri), API katmanını ve salt okunur görüşme listesini kurar; Faz 2 ilk yazma akışını (yeni görüşme + gerçek e-posta) ekler; Faz 3 gelen yanıtı görme, yanıtlama ve kapatma/yeniden açma ile döngüyü kapatır; Faz 4 dosya ekleme, talep özeti alıntılama, alıcıyla önceki görüşmeler ve sessiz tazeleme ile deneyimi tamamlar. Her faz, elle test side ticket'larıyla veya gerçek e-posta akışıyla uçtan uca gösterilebilir değer bırakır.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Temel ve Salt Okunur Görüşme Listesi** - Panel, aktif talebe bağlı yan görüşmeleri rozetleriyle, doğru sırayla ve sayfalanmış olarak gösterir (completed 2026-07-23)
- [x] **Phase 2: Yeni Yan Görüşme Başlatma** - Temsilci alıcı/konu/mesaj ile yeni görüşme açar; side ticket oluşur ve alıcıya gerçek e-posta gider (completed 2026-07-23)
- [x] **Phase 3: Görüşme Detayı ve Yaşam Döngüsü** - Temsilci mesajları yön ayrımıyla görür, yanıtlar, kapatır/yeniden açar ve okundu işaretler (completed 2026-08-01)
- [x] **Phase 03.1: Editör, cache ve birleşik inbox deneyimi modernizasyonu** - Tiptap/DOMPurify, tenant-scoped React Query, senkron thread navigasyonu ve ortak 372px inbox kabuğuyla Phase 3 deneyimini güvenli ve tutarlı hâle getirir (completed 2026-07-29)
- [ ] **Phase 4: Dosya Ekleri ve Inline Görseller** - Temsilci çoklu dosya ekler (sürükle-bırak/ataç), editöre yapıştırdığı görsel inline gömülür, gelen ekler thread'de görünür *(8/8 plan yürütüldü; doğrulama `human_needed` — 04-UAT.md'deki 4 madde insan onayı bekliyor)*
- [x] **Phase 04.1: Ortam yönlendirmesi ve prod hazırlığı** - `_grispi_env` + token `dev` claim'i ile çalışma-zamanı base URL çözümlemesi; hiçbir istek yanlış host'a gitmez *(INSERTED)*
- [ ] **Phase 04.2: UAT geri bildirimleri** - İlişki iç notu, yan/üst talep navigasyonu, gönderen ve alıcı kimliğinin netleşmesi, dar/kısa panelde kullanılabilirlik *(INSERTED — canlı UAT geri bildirimi 2026-08-17)*
- [ ] **Phase 5: Zenginleştirmeler ve Dayanıklılık** - Talep özeti alıntılama, alıcıyla önceki görüşmeler ve arka planda sessiz tazeleme

## Phase Details

### Phase 1: Temel ve Salt Okunur Görüşme Listesi

**Goal**: Temsilci, aktif talebe bağlı tüm yan görüşmeleri panelde rozetleriyle, doğru sırayla ve gerektiğinde sayfalanmış olarak görebilir; ayar/hata durumları anlaşılır şekilde ele alınır.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: CORE-01, CORE-02, CORE-03, LIST-01, LIST-02, LIST-03, LIST-04, LIST-05, LIST-06
**Success Criteria** (what must be TRUE):

  1. Temsilci, aktif talebe bağlı tüm yan görüşmeleri (alıcı, konu, son mesaj özeti, göreli zaman) tek listede görür; 10'dan fazla görüşmede "daha fazla yükle" sonraki sayfayı getirir
  2. Her görüşme doğru "sıra kimde" rozetini taşır (Yanıt bekleniyor / Yeni yanıt / Kapalı); yeni yanıtlı görüşmeler görsel olarak vurgulanır ve listenin en üstünde yer alır
  3. Hiç yan görüşme yoksa, gizlilik açıklaması ("talep sahibi bu yazışmayı görmez") ve tek CTA içeren boş durum ekranı görünür
  4. Temsilci aktif talebi değiştirdiğinde liste otomatik olarak yeni talebin görüşmelerini gösterir
  5. Kritik field/ayar eksikse anlaşılır bir kurulum uyarısı; API hatasında Türkçe mesaj ile "yeniden dene" seçeneği gösterilir

**Plans**: 4/4 plans complete
**Wave 1**

- [x] 01-01-PLAN.md — Walking Skeleton: gerçek advanced-search okumasıyla yan görüşme listesi uçtan uca render (alıcı·zaman·konu·özet), typed HTTP hataları, skeleton yükleme

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Rozet türetme (Yeni yanıt/Yanıt bekleniyor/Kapalı) + gruplama/sıralama + mor okunmamış ray; canlı API şekli doğrulama checkpoint'i

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Boş durum (gizlilik CTA'sı), katmanlı Türkçe hata + yeniden dene, sayfalama, talep-değişimi tazeleme; faz sonu UAT

**Wave 4** *(gap closure — verification CR-01/CORE-03)*

- [x] 01-04-PLAN.md — Plugin/iframe bootstrap hata yolunu `switchTicket` üzerinden geçir + `_init()` `.catch` (CORE-03 Türkçe hata + yeniden dene canlı yolda çalışır); WR-05 ErrorCard null sağlamlaştırması

**UI hint**: yes

### Phase 2: Yeni Yan Görüşme Başlatma

**Goal**: Temsilci, alıcı seçip konu ve mesaj yazarak yeni bir yan görüşme başlatır; side ticket oluşur, alıcıya gerçek e-posta gider ve temsilci anında görüşme ekranına düşer.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, SYNC-02
**Success Criteria** (what must be TRUE):

  1. Temsilci listeden "+" ile yeni görüşme ekranını açar
  2. Alıcı alanı müşteri aramasıyla otomatik tamamlanır; kayıtlı olmayan serbest e-posta adresi de girilebilir
  3. Konu alanı talep anahtarı + talep başlığıyla önceden dolu gelir ve düzenlenebilir
  4. Temsilci mesajı gönderince side ticket oluşur, alıcıya e-posta gider ve temsilci doğrudan yeni görüşmenin ekranına yönlendirilir
  5. Gönderim sonrası liste ve ilgili görünüm anında yeni görüşmeyi yansıtır

**Plans**: 6/6 plans complete

**Wave 1**

- [x] 02-01-PLAN.md — Canlı API probe (A1–A5) + createTicket/customers.search istemcileri + saf yardımcılar (formatRequesterField/formatPrefillSubject/isValidEmail)

**Wave 2** *(blocked on Wave 1)*

- [x] 02-02-PLAN.md — Agent kimliği (agentEmail + standalone-dev fallback) + navigasyon durum makinesi (PanelNavigationStore) + compose girişi/"+" enable (COMP-01)

**Wave 3** *(blocked on Wave 2)*

- [x] 02-03-PLAN.md — ComposeStore (debounce+generation-guard arama) + RecipientField (5 durumlu dropdown) + SubjectField prefill (COMP-02, COMP-03)

**Wave 4** *(blocked on Wave 3)*

- [x] 02-04-PLAN.md — ActiveConversationStore (optimistic mesaj) + ComposeStore.submit + Textarea/MessageField (COMP-04, SYNC-02)

**Wave 5** *(blocked on Wave 4)*

- [x] 02-05-PLAN.md — MessageBubble + ChatScreen + Gönder butonu; happy path uçtan uca (COMP-04, XSS-güvenli render)

**Wave 6** *(blocked on Wave 5 — faz-sonu UAT)*

- [x] 02-06-PLAN.md — Vazgeç/parent korumaları (ConfirmDialog D-02/D-03) + hata/retry copy cilası (D-15) + faz-sonu UAT

**UI hint**: yes

### Phase 3: Görüşme Detayı ve Yaşam Döngüsü

**Goal**: Temsilci bir görüşmenin tüm mesajlarını yön ayrımıyla görür, yanıtlar, kapatır/yeniden açar ve yeni yanıtları okundu işaretler — harici yazışma döngüsü uçtan uca kapanır.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: THRD-01, THRD-02, THRD-03, THRD-04
**Success Criteria** (what must be TRUE):

  1. Temsilci görüşmenin tüm mesajlarını kronolojik ve yön ayrımıyla (siz / karşı taraf) görür
  2. Temsilci görüşmeye yanıt yazıp gönderir; yanıt alıcıya e-posta olarak gider ve anında thread'e eklenir
  3. Temsilci görüşmeyi kapatır ve yeniden açar; kapalı görüşmeye gelen yeni yanıt onu tekrar aktif gösterir
  4. Görüşme açıldığında "Yeni yanıt" durumu o temsilci için okundu sayılır (localStorage) ve rozet güncellenir

**Plans**: TBD
**UI hint**: yes

### Phase 03.1: Editör, cache ve birleşik inbox deneyimi modernizasyonu (INSERTED)

**Goal:** Temsilci, bozuk özel editör ve dağınık uzak-state akışları yerine güvenli Tiptap/DOMPurify bileşimi, tenant-scoped React Query cache'i, senkron thread seçimi ve liste/compose/detay boyunca tek erişilebilir 372px inbox deneyimi kullanır; Phase 3 davranışlarının tamamı korunur.
**Requirements**: CORE-03, LIST-01, LIST-02, LIST-03, LIST-04, LIST-05, LIST-06, COMP-01, COMP-02, COMP-03, COMP-04, THRD-01, THRD-02, THRD-03, THRD-04, SYNC-02
**Depends on:** Phase 3
**Success Criteria** (what must be TRUE):

  1. Tiptap 2.27.2 editörü kalın/italik/link/liste/alıntı/emoji, Enter/Shift+Enter/IME, paste/restore/clear ve focus davranışlarını güvenilir biçimde sunar; DOMPurify uzak, yapıştırılmış, restore edilmiş ve gönderilecek HTML için tek güven sınırıdır
  2. Liste, thread ve müşteri arama cache'leri tenant/parent/side/term anahtarlarıyla birbirinden ayrılır; MobX yalnız navigasyon, taslak, focus/scroll sinyalleri ve optimistic overlay tutar; polling ve önceki ticket verisini yeni key altında taşıma yoktur
  3. Satır aktivasyonu side-ticket + parent-ticket + sessionKey tuple'ını fetch başlamadan senkron seçer; hızlı A→B seçiminde stale veri/callback görünmez ve geri dönüş odağı etkinleştiren satıra gelir
  4. Create/reply/solve/reopen retry aynı dondurulmuş request identity'sini kullanır; başarı inactive parent-list dahil exact cache'leri await eder, hata cache yenilemez ve canonical/optimistic mesajlar duplicate olmadan reconcile edilir
  5. Liste, compose ve detay tek 48px header/44px target sisteminde, 64–72px yoğun liste ve ortak rich composer ile ~372px'te yatay taşmadan, klavye/screen-reader erişilebilir çalışır
  6. Odaklı ve tam test suite'i, TypeScript, güvenlik gate'leri ve production build geçer; Phase 3'ün on maddelik canlı tenant/mailbox UAT'ı son test geçişine kadar açıkça `DEFERRED — NOT TESTED` kalır

**Plans:** 5/5 plans complete

**Wave 1**

- [x] 03.1-01-PLAN.md — Tiptap 2.27.2 editör ve DOMPurify tek HTML güven sınırı
- [x] 03.1-02-PLAN.md — Plugin/standalone tenant kaynağı, QueryClient, exact query key/options sözleşmeleri

**Wave 2** *(blocked on 03.1-02)*

- [x] 03.1-03-PLAN.md — Senkron selected-thread session, listeye focus dönüşü ve Query-owned liste/müşteri GET state'i

**Wave 3** *(blocked on 03.1-01, 03.1-02, 03.1-03)*

- [x] 03.1-04-PLAN.md — Query-owned detail/mutation lifecycle, immutable retry envelope ve canonical overlay reconciliation

**Wave 4** *(blocked on 03.1-01, 03.1-03, 03.1-04)*

- [x] 03.1-05-PLAN.md — Ortak erişilebilir 372px inbox/list/compose/detail kabuğu, tam test/build/UI doğrulaması

### Phase 4: Dosya Ekleri ve Inline Görseller

**Goal**: Temsilci yan görüşmelere dosya ekleyebilir ve alabilir: yeni görüşmede ve yanıtta çoklu sürükle-bırak/ataç ile ek yükler, editöre yapıştırdığı görsel inline gömülür, karşı tarafın gönderdiği ekleri thread'de görüp açabilir.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: COMP-05, COMP-08, THRD-05, THRD-06
**Success Criteria** (what must be TRUE):

  1. Temsilci hem yeni görüşmede hem yanıtta sürükle-bırak veya ataç ikonuyla birden fazla dosya ekler; ekler gönderim öncesi listede (ad, boyut, önizleme) görünür ve tek tek kaldırılabilir
  2. Ekler `POST /attachments/upload` ile yüklenir ve mesaja `comment.attachmentIds` ile bağlanır; alıcı ekleri e-postayla alır
  3. Editöre yapıştırılan görsel Grispi'ye yüklenip dönen `objectUrl` ile editörde inline görünür ve gönderilen mesajda inline kalır
  4. Görüşmede karşı tarafın gönderdiği ekler mesajla birlikte görünür (görsel önizleme / dosya chip'i) ve açılıp indirilebilir

**Plans**: 8/8 plans complete

- [x] 04-01-PLAN.md — Canlı API probe (P1-P5), paket meşruiyet onayı + kurulum, toast yüzeyi ve test yetenekleri (Wave 0)
- [x] 04-02-PLAN.md — Multipart upload hattı: `sendMultipart`, `Attachments` istemcisi, tipler ve saf kural fonksiyonları
- [x] 04-03-PLAN.md — `AttachmentUploadStore` yükleme yaşam döngüsü + `AttachmentChip` bileşeni
- [x] 04-04-PLAN.md — THRD-06: gelen eklerin projeksiyonu ve thread'de render'ı
- [x] 04-05-PLAN.md — Composer yüzeyi: ataç, sürükle-bırak, chip listesi paneli, gönderim kilidi, ret toast'ı
- [x] 04-06-PLAN.md — `attachmentIds` gönderim bağlaması, D-18 kirli taslak ve canlı e-posta teslimi (P6a)
- [x] 04-07-PLAN.md — Temizleyici politika ayrımı: `sanitizeAuthoredHtml` ve çağrı yerlerinin yön bazlı bağlanması
- [x] 04-08-PLAN.md — COMP-08 inline yapıştırma akışı, D-16 çöp toplama devresi ve faz-sonu panel UAT'si

**UI hint**: yes

### Phase 04.1: Ortam yönlendirmesi ve prod hazırlığı (INSERTED)

**Goal:** Plugin, yüklendiği Grispi ortamının doğru API'siyle konuşur — preprod (`.net`), prod (`.com`) ve TR prod (`.com.tr`) — ve varsayılanı yanlış ortama düşmeyecek şekilde güvenli tarafta durur.
**Mode:** mvp
**Depends on:** Phase 4
**Requirements**: CORE-04
**Success Criteria** (what must be TRUE):

  1. Base URL çalışma zamanında çözümlenir: `bundle.settings["_grispi_env"]` (`preprod` | `prod` | `prod_tr`) birincil kaynaktır; geçersiz/eksikse token'ın `dev` claim'i ikincil kaynaktır (`dev: true` → preprod, aksi hâlde prod)
  2. Çözümleme, plugin ilk API isteğini atmadan önce tamamlanır (`plugin-bootstrap` içinde `switchTicket`'tan ÖNCE) — hiçbir istek yanlış host'a gitmez
  3. Standalone dev modu bundle'ı bypass ettiği için kendi ortam override'ına sahiptir ve mevcut `gsocial-test` (preprod) akışı bozulmaz
  4. Hiçbir yerde ortam-bağımlı host hardcode edilmez (`usercontent` dâhil — `objectUrl` API'den tam nitelikli gelir)
  5. `_grispi_env`'in ne zaman zorunlu olduğu README'de belgelenir: TR kurulumlarında **elle set edilmek zorundadır**, çünkü `dev` claim'i `.com` ile `.com.tr`'yi ayırt edemez (backend: `dev = !(PROD || PROD_TR)`)

**Canonical refs:**

- `vivollo-chat-side-plugin` feature branch'i (`.claude/worktrees/grispi-api-domain-param-ca0ee0/src/grispi/client/environment.ts` + `contexts/grispi-context.tsx`) — çalışan referans implementasyon; birebir kopyalanabilir
- `grispi-api` `GrispiUrlGenerator.java` + `Environment.java` — beş ortamın (local/dev/net/com/com.tr) otoriter eşlemesi
- **Tuzak:** backend kendi içinde `prod-tr` (tire) kullanır; ayar anahtarı `prod_tr` (alt çizgi). Strict eşleşme olduğu için tire sessizce `prod`'a düşer.

**Plans:** 2/2 plans complete

Plans:
**Wave 1**

- [x] 04.1-01-PLAN.md — Ortam çözümleyicisi (`environment.ts` + `grispi-environment.ts`) ve plugin modunun uçtan uca bağlanması: `switchTicket`'tan önce base URL, varsayılan güvenli tarafta (SC1, SC2, SC4)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04.1-02-PLAN.md — Standalone dev ortam override'ı (`REACT_APP_DEV_GRISPI_ENV`, varsayılan preprod) ve `_grispi_env` kurulum dokümantasyonu + faz kapanış gate'leri (SC3, SC5)

### Phase 04.2: UAT geri bildirimleri: ilişki notu, ticket navigasyonu, kimlik netliği ve dar/kısa panel dayanıklılığı (INSERTED)

**Goal:** Temsilci, panelde kiminle konuştuğunu ve hangi talebin üzerinde olduğunu tereddütsüz görür; yan ve üst talep arasında tek tıkla geçebilir; yan konuşma ticket'ı Grispi tarafında ilişkisini taşıyan bir iç notla doğar; ve panel, dar (~280px) ve kısa (~590px) agent ekranlarında kullanılabilir kalır.
**Mode:** mvp
**Depends on:** Phase 4
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08
**Success Criteria** (what must be TRUE):

  1. Yeni yan konuşma oluşturulduğunda yan ticket'a ilişkiyi bildiren bir iç not (`publicVisible: false`) düşer — hiç kimseye e-posta gitmez, not panelde de görünür, notun atılamaması konuşmanın kendisini bozmaz
  2. Sohbet ekranının başlığı yan ticket key'idir ve tıklandığında o talep yeni sekmede açılır; üst talep key'i ayrı bir görsel dille (nötr chip, link değil) gösterilir, ikisi karıştırılamaz
  3. Aktif talep bir yan konuşmaysa (`tu.side_conversation_parent` dolu) panel bunu açıkça bildirir, "Üst talebe git" sunar ve yeni yan konuşma açılmasını engeller (iç içe yan konuşma yok)
  4. Alıcı, üçüncü taraf henüz hiç yanıt yazmamışken bile doğru görünür — yanıt alanında ve çözüldü/kapalı durum bloğunda hiçbir koşulda `—` kalmaz
  5. Mesajlarda gönderen adı görünür ("Siz" yerine agent adı), temsilcinin kendi mesajında adının yanında "Siz" rozeti bulunur ve iç notlarda "Salt okunur" ifadesi yer almaz
  6. Temsilci, yeni konuşma açarken ve açtıktan sonra, oluşan talebin alan/atanan/durum bilgilerinin otomatik dolmadığını söyleyen bir bilgi kutusu görür (ikincisi kalıcı olarak kapatılabilir)
  7. Biçimlendirme araçları tek bir popover'da toplanır; geri al/yinele dışarıda kalır ve toolbar ~280px panel genişliğinde yatay kaydırma üretmez
  8. Panel ~280px genişlik ve ~590px viewport yüksekliğinde kullanılabilir: liste başlığı kırpılmaz ve sohbet ekranında mesaj alanı bugünkünden en az %20 daha yüksektir

**Canonical refs:**

- **`—` bug'ının kök nedeni:** `src/query/side-conversation-queries.ts` `resolveRecipientLabel` alıcıyı yalnızca ticket'ta `ROLE_END_USER` yorumu varsa çözebiliyor. Liste tarafında zaten `users.getUser(requesterId)` fallback'i var (aynı dosya, `hydrateSummaries`) — detay yolu bu precedent'i tekrar kullanmalı, yeni bir çözüm icat edilmemeli
- **SDK'da navigasyon API'si YOK** (v0.3.1 doğrulandı: yalnız `_init`, `currentTicket`, `freeze/release/isFrozen`). Talep linki `https://{tenantId}.grispi.{tld}/tickets/{TICKET-KEY}` olarak kurulur; `tld` ortamdan türetilir (preprod `.net`, prod `.com`, prod_tr `.com.tr` — `GRISPI_BASE_URLS` eşlemesinin aynısı) ve yeni sekmede açılır. Hash'teki `origin` parametresi kullanılmaz (doğrulanmamış girdi)
- **Panel 372px sabit DEĞİL:** canlı ekran görüntüsünde ~295px ölçüldü ve sürüklenebilir bir tutamağı var. PROJECT.md'deki "372px" kısıtı yanlış; layout ~280px'ten yukarı akışkan olmalı
- **Zoom sahte alarm:** local'de büyük, preprod'da normal render ediliyor; host uygulama iki durumda da piksel piksel aynı → tarayıcı/OS zoom'u değil, local'e özgü bir artefakt. Bu fazda global tipografi küçültmesi YAPILMAZ, yalnızca yükseklik/genişlik dayanıklılığı ele alınır
- **Açık probe:** `PATCH /v2/tickets/{key}` gövdesinde `comment.publicVisible: false` ile (a) e-posta göndermiyor ve (b) status'ü beklenmedik şekilde değiştirmiyor mu — plan öncesi `gsocial-test` üzerinde doğrulanmalı. Olumsuzsa iç not akışı create'i iç notla başlatıp e-postayı PATCH'leyecek şekilde ters çevrilir

**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 04.2 to break down)

### Phase 5: Zenginleştirmeler ve Dayanıklılık

**Goal**: Uçtan uca döngü çalışırken deneyimi tamamlar: talep özeti alıntılama, alıcıyla önceki görüşmeler ve arka planda sessiz tazeleme.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: COMP-06, COMP-07, SYNC-01
**Success Criteria** (what must be TRUE):

  1. Temsilci "Talep özetini ekle" ile ana talebin son public yorumlarını mesaj gövdesine alıntılayabilir
  2. Temsilci compose'da alıcıyı seçtiğinde, o alıcıyla yapılmış önceki yan görüşmeler listelenir ve tek dokunuşla açılabilir
  3. Panel görünürken liste ve açık görüşme makul aralıklarla (30-60 sn) sessizce tazelenir; yeni yanıtlar kendiliğinden belirir

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 03.1 → 4 → 04.1 → 04.2 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Temel ve Salt Okunur Görüşme Listesi | 4/4 | Complete    | 2026-07-23 |
| 2. Yeni Yan Görüşme Başlatma | 6/6 | Complete    | 2026-07-23 |
| 3. Görüşme Detayı ve Yaşam Döngüsü | 6/6 | Complete    | 2026-08-01 |
| 03.1. Editör, cache ve birleşik inbox deneyimi modernizasyonu | 5/5 | Complete    | 2026-07-29 |
| 4. Dosya Ekleri ve Inline Görseller | 8/8 | Executed (UAT bekliyor) | - |
| 04.1. Ortam yönlendirmesi ve prod hazırlığı | 2/2 | Complete   | 2026-08-10 |
| 5. Zenginleştirmeler ve Dayanıklılık | 0/TBD | Not started | - |
