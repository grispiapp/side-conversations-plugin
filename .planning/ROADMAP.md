# Roadmap: Yan Görüşmeler — Grispi Side Conversations Plugin

## Overview

Temsilcinin talepten hiç ayrılmadan üçüncü taraflarla gizli e-posta yazışmaları yürütmesini sağlayan sağ-panel plugin'i, okuma → oluşturma → yanıtlama → zenginleştirme sırasıyla dört dikey MVP dilimi hâlinde inşa edilir. Faz 1 veri modelini (settings/field key'leri), API katmanını ve salt okunur görüşme listesini kurar; Faz 2 ilk yazma akışını (yeni görüşme + gerçek e-posta) ekler; Faz 3 gelen yanıtı görme, yanıtlama ve kapatma/yeniden açma ile döngüyü kapatır; Faz 4 dosya ekleme, talep özeti alıntılama, alıcıyla önceki görüşmeler ve sessiz tazeleme ile deneyimi tamamlar. Her faz, elle test side ticket'larıyla veya gerçek e-posta akışıyla uçtan uca gösterilebilir değer bırakır.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Temel ve Salt Okunur Görüşme Listesi** - Panel, aktif talebe bağlı yan görüşmeleri rozetleriyle, doğru sırayla ve sayfalanmış olarak gösterir (completed 2026-07-23)
- [ ] **Phase 2: Yeni Yan Görüşme Başlatma** - Temsilci alıcı/konu/mesaj ile yeni görüşme açar; side ticket oluşur ve alıcıya gerçek e-posta gider
- [ ] **Phase 3: Görüşme Detayı ve Yaşam Döngüsü** - Temsilci mesajları yön ayrımıyla görür, yanıtlar, kapatır/yeniden açar ve okundu işaretler
- [ ] **Phase 4: Zenginleştirmeler ve Dayanıklılık** - Dosya ekleme, talep özeti, alıcıyla önceki görüşmeler ve arka planda sessiz tazeleme

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

**Plans**: 3/6 plans executed

**Wave 1**

- [x] 02-01-PLAN.md — Canlı API probe (A1–A5) + createTicket/customers.search istemcileri + saf yardımcılar (formatRequesterField/formatPrefillSubject/isValidEmail)

**Wave 2** *(blocked on Wave 1)*

- [x] 02-02-PLAN.md — Agent kimliği (agentEmail + standalone-dev fallback) + navigasyon durum makinesi (PanelNavigationStore) + compose girişi/"+" enable (COMP-01)

**Wave 3** *(blocked on Wave 2)*

- [x] 02-03-PLAN.md — ComposeStore (debounce+generation-guard arama) + RecipientField (5 durumlu dropdown) + SubjectField prefill (COMP-02, COMP-03)

**Wave 4** *(blocked on Wave 3)*

- [ ] 02-04-PLAN.md — ActiveConversationStore (optimistic mesaj) + ComposeStore.submit + Textarea/MessageField (COMP-04, SYNC-02)

**Wave 5** *(blocked on Wave 4)*

- [ ] 02-05-PLAN.md — MessageBubble + ChatScreen + Gönder butonu; happy path uçtan uca (COMP-04, XSS-güvenli render)

**Wave 6** *(blocked on Wave 5 — faz-sonu UAT)*

- [ ] 02-06-PLAN.md — Vazgeç/parent korumaları (ConfirmDialog D-02/D-03) + hata/retry copy cilası (D-15) + faz-sonu UAT

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

### Phase 4: Zenginleştirmeler ve Dayanıklılık

**Goal**: Uçtan uca döngü çalışırken deneyimi tamamlar: dosya ekleme, talep özeti alıntılama, alıcıyla önceki görüşmeler ve arka planda sessiz tazeleme.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: COMP-05, COMP-06, COMP-07, THRD-05, SYNC-01
**Success Criteria** (what must be TRUE):

  1. Temsilci hem yeni görüşme hem de yanıt mesajına dosya ekleyebilir (Base64, boyut sınırı uyarısıyla) ve alıcı eki e-postayla alır
  2. Temsilci "Talep özetini ekle" ile ana talebin son public yorumlarını mesaj gövdesine alıntılayabilir
  3. Temsilci compose'da alıcıyı seçtiğinde, o alıcıyla yapılmış önceki yan görüşmeler listelenir ve tek dokunuşla açılabilir
  4. Panel görünürken liste ve açık görüşme makul aralıklarla (30-60 sn) sessizce tazelenir; yeni yanıtlar kendiliğinden belirir

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Temel ve Salt Okunur Görüşme Listesi | 4/4 | Complete    | 2026-07-23 |
| 2. Yeni Yan Görüşme Başlatma | 3/6 | In Progress|  |
| 3. Görüşme Detayı ve Yaşam Döngüsü | 0/TBD | Not started | - |
| 4. Zenginleştirmeler ve Dayanıklılık | 0/TBD | Not started | - |
