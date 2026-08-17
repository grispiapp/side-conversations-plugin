# Requirements: Yan Görüşmeler — Grispi Side Conversations Plugin

**Defined:** 2026-07-22
**Core Value:** Temsilci, talebi çözmek için gereken harici yazışmaları talepten hiç ayrılmadan yürütebilmeli; talep sahibi bu yazışmaları asla görmemeli.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Altyapı (CORE)

- [x] **CORE-01**: İlişki field'ının key'i sabittir (`tu.side_conversation_parent`) ve field, plugin tenant'a kurulurken otomatik oluşturulur; kod settings'e bağımlı değildir *(rev. 2026-07-22 Faz 1 tartışması — önceki "settings'ten okunur" yaklaşımı kaldırıldı)*
- [x] **CORE-02**: API katmanı yan görüşme operasyonlarını kapsar: advanced-search ile listeleme, ticket oluşturma, yorum/status PATCH'i, müşteri arama, yorum özeti
- [x] **CORE-03**: API hataları kullanıcıya Türkçe, anlaşılır mesajlarla gösterilir ve yeniden deneme imkanı sunulur
- [x] **CORE-04**: Plugin, yüklendiği Grispi ortamının doğru API'siyle konuşur — base URL çalışma zamanında `bundle.settings._grispi_env` (`preprod`/`prod`/`prod_tr`), aksi hâlde token `dev` claim'i üzerinden çözümlenir; varsayılan güvenli tarafa (prod) düşer *(eklendi 2026-08-01 — sabit `.net` prod ve TR'de yanlış backend'e gidiyordu)*

### Görüşme Listesi (LIST)

- [x] **LIST-01**: Temsilci, aktif talebe bağlı tüm yan görüşmeleri panelde görür (alıcı, konu, son mesaj özeti, göreli zaman)
- [x] **LIST-02**: Her görüşme "sıra kimde" rozeti taşır: Yanıt bekleniyor / Yeni yanıt / Kapalı (son public yorumun yazar rolü + ts.status'tan türetilir)
- [x] **LIST-03**: Yeni yanıt içeren görüşmeler görsel olarak vurgulanır ve listenin en üstünde yer alır
- [x] **LIST-04**: Hiç yan görüşme yoksa, gizlilik açıklaması ve tek CTA içeren boş durum ekranı gösterilir
- [x] **LIST-05**: Temsilci aktif talebi değiştirdiğinde liste otomatik yenilenir
- [x] **LIST-06**: 10'dan fazla görüşmede "daha fazla yükle" ile sonraki sayfalar çekilir

### Yeni Görüşme (COMP)

- [x] **COMP-01**: Temsilci listeden "+" ile yeni görüşme ekranını açar
- [x] **COMP-02**: Alıcı alanı müşteri aramasıyla otomatik tamamlanır; kayıtlı olmayan serbest e-posta adresi de girilebilir
- [x] **COMP-03**: Konu alanı talep anahtarı + talep başlığıyla önceden dolu gelir ve düzenlenebilir
- [x] **COMP-04**: Temsilci mesajı gönderdiğinde side ticket oluşur, alıcıya e-posta gider ve temsilci doğrudan görüşme ekranına yönlendirilir
- [x] **COMP-05**: Temsilci yeni görüşme mesajına sürükle-bırak veya ataç ikonuyla birden fazla dosya ekler; ekler gönderim öncesi listede (ad, boyut, önizleme) görünür ve tek tek kaldırılabilir; `POST /attachments/upload` ile yüklenip mesaja `comment.attachmentIds` ile bağlanır *(rev. 2026-07-31 — önceki "Base64" varsayımı grispi-ui referans implementasyonuyla çürütüldü; rev. 2026-08-01 — Plan 04-01 canlı probu doğru yolun `public/v1` ön eksiz `attachments/upload` olduğunu ve bağlamanın `/v2/tickets` gerektirdiğini kanıtladı)* — Tamamlandı: Plan 04-01 (canlı sözleşme + paket/altyapı hazırlığı), upload client + pure kurallar Plan 04-02, `AttachmentUploadStore`/`AttachmentChip` Plan 04-03, composer'a bağlama (ataç düğmesi, sürükle-bırak, chip listesi/katlama, gönderim kilidi) Plan 04-05, `comment.attachmentIds` gönderim bağlaması + canlı e-posta teslimi (P6a) Plan 04-06, Plan 04-08'in faz-sonu panel UAT'si dört ROADMAP başarı ölçütünün hepsini KARŞILANDI olarak doğruladı — **alıcının posta kutusunun gözle kontrolü (P6b) kullanıcı tarafından doğrulanmayı bekliyor, kod tarafı tamam**
- [ ] **COMP-06**: Temsilci "Talep özetini ekle" ile ana talebin son public yorumlarını mesaj gövdesine alıntılayabilir
- [ ] **COMP-07**: Temsilci alıcıyı seçtiğinde, bu alıcıyla yapılmış önceki yan görüşmeler listelenir ve tek dokunuşla açılabilir (v2 preview `GET /tickets?requesterEmail=` endpoint'ine dayanır; Grispi değişiklikleri önceden bildirir)
- [x] **COMP-08**: Editöre yapıştırılan görsel Grispi'ye yüklenir ve dönen `objectUrl` ile editörde inline gösterilir; gönderilen mesajda da inline kalır (ortak composer — compose ve yanıt) *(eklendi 2026-07-31)* — Tamamlandı: Plan 04-01 hazırlık, Plan 04-02 upload client, Plan 04-07 temizleyici politikası (`sanitizeAuthoredHtml` görsel etiketine izin verir), Plan 04-08 `AttachmentUploadStore.uploadInlineImage` + `InlineImage`/`FileHandler` yapıştırma-bırakma akışı + D-16 çöp toplama (faz-sonu UAT sırasında bulunan encoding hatası aynı planda düzeltildi) — canlı 372px panelde doğrulandı; P6b (alıcının posta istemcisinde render) kullanıcı tarafından doğrulanmayı bekliyor

### Görüşme Detayı (THRD)

- [x] **THRD-01**: Temsilci görüşmenin tüm mesajlarını kronolojik ve yön ayrımıyla (siz / karşı taraf) görür
- [x] **THRD-02**: Temsilci görüşmeye yanıt yazar; yanıt alıcıya e-posta olarak gider ve thread'e eklenir
- [x] **THRD-03**: Temsilci görüşmeyi kapatabilir ve yeniden açabilir; kapalı görüşmeye gelen yanıt görüşmeyi tekrar aktif gösterir
- [x] **THRD-04**: Görüşme açıldığında "Yeni yanıt" durumu okundu sayılır (temsilci bazında, localStorage)
- [x] **THRD-05**: Temsilci yanıta da aynı şekilde çoklu dosya ekleyebilir (ortak composer; upload + `comment.attachmentIds`) *(rev. 2026-07-31 — "Base64" varsayımı düzeltildi)* — Tamamlandı: Plan 04-03'te `AttachmentUploadStore`'un `reply` kovası `compose` kovasından bağımsız olarak testlerle doğrulandı; Plan 04-05'te composer'a takıldı (`chat-screen.tsx`, yanıt kovası); Plan 04-06'da `comment.attachmentIds` gönderim bağlaması tamamlandı ve canlı bir yanıt gönderimiyle (`gsocial-test`) doğrulandı; Plan 04-08'in faz-sonu UAT'si aynı akışı 372px panelde tekrar kanıtladı — **alıcının posta kutusunun tam gözle kontrolü (P6b) kullanıcı tarafından doğrulanmayı bekliyor, kod tarafı tamam**
- [x] **THRD-06**: Görüşmede karşı tarafın gönderdiği ekler mesajla birlikte görünür (görsel önizleme / dosya chip'i) ve açılıp indirilebilir; `inline: true` ekler listeden FİLTRELENMEZ (D-22, rev. 2026-08-01 — bu plugin gelen gövde görsellerini hiç göstermediği için (D-21) filtreleme karşı tarafın ekran görüntüsünü tamamen görünmez kılardı) *(eklendi 2026-07-31)* — Tamamlandı: gelen ek projeksiyonu ve thread render'ı Plan 04-04'te test edilerek yapıldı; Plan 04-08'in faz-sonu UAT'si gözle doğrulamayı canlı 372px panelde kapattı (thumbnail/chip ayrımı, `target="_blank"`/`rel="noopener noreferrer"`, D-20)

### Tazelik (SYNC)

- [ ] **SYNC-01**: Panel görünürken liste ve açık görüşme makul aralıklarla (30-60 sn) sessizce tazelenir
- [x] **SYNC-02**: Her yazma işleminden (gönder, yanıtla, kapat) sonra ilgili görünüm anında tazelenir

### Panel Deneyimi (UX)

*Canlı UAT geri bildiriminden türetildi (2026-08-17); Phase 04.2'nin sekiz başarı ölçütüyle bire bir eşleşir.*

- [ ] **UX-01**: Yeni yan konuşma oluşturulduğunda yan ticket'a ilişkiyi bildiren bir iç not (`publicVisible: false`) düşer — kimseye e-posta gitmez, not panelde de görünür, notun atılamaması konuşmanın kendisini bozmaz
- [ ] **UX-02**: Sohbet ekranının başlığı yan ticket key'idir ve tıklandığında o talep yeni sekmede açılır; üst talep key'i ayrı bir görsel dille (nötr chip, link değil) gösterilir
- [ ] **UX-03**: Aktif talep bir yan konuşmaysa panel bunu bildirir, "Üst talebe git" sunar ve yeni yan konuşma açılmasını engeller (iç içe yan konuşma yok)
- [ ] **UX-04**: Alıcı, üçüncü taraf henüz hiç yanıt yazmamışken bile doğru görünür — yanıt alanında ve çözüldü/kapalı durum bloğunda hiçbir koşulda `—` kalmaz
- [ ] **UX-05**: Mesajlarda gönderen adı görünür ("Siz" yerine agent adı), temsilcinin kendi mesajında adının yanında "Siz" rozeti bulunur ve iç notlarda "Salt okunur" ifadesi yer almaz
- [ ] **UX-06**: Temsilci, yeni konuşma açarken ve açtıktan sonra, oluşan talebin alan/atanan/durum bilgilerinin otomatik dolmadığını söyleyen bir bilgi kutusu görür (ikincisi kalıcı olarak kapatılabilir)
- [ ] **UX-07**: Biçimlendirme araçları tek bir popover'da toplanır; geri al/yinele dışarıda kalır ve toolbar ~280px panel genişliğinde yatay kaydırma üretmez
- [ ] **UX-08**: Panel ~280px genişlik ve ~590px viewport yüksekliğinde kullanılabilir: liste başlığı kırpılmaz ve sohbet ekranında mesaj alanı bugünkünden en az %20 daha yüksektir
- [ ] **UX-09**: Yeni yan konuşma oluşturulduktan sonra `tu.side_conversation_parent` alanının değeri doğrulanabilir şekilde kaydedilmiştir — UX-01'in PATCH'i alanı yeniden tesis eder, böylece konuşma listede her koşulda görünür *(eklendi 2026-08-17; canlı probe `POST /v2/tickets`'ın `fields` dizisinin bu alanı taze create'te kaydetmeyebildiğini gösterdi)*

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Zenginleştirmeler

- **V2-01**: CC/BCC ve çoklu alıcı (public API kazanınca)
- **V2-02**: Talep özetinde tek tek yorum seçebilme (Zendesk comment picker muadili)
- **V2-03**: Mesaj şablonları / makrolar
- **V2-04**: Cihazlar arası okunmuşluk senkronizasyonu (server-side görülme takibi gerektirir)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Slack/Teams/child-ticket kanalları | Kapsam yalnızca e-posta; Grispi'de karşılığı yok |
| Ana talebin durumunu otomatik değiştirme | Client-side güvenilir değil; Grispi tarafında otomasyon gerektirir |
| Zengin metin editörü | v1 düz metin; e-posta gövdesi için yeterli, kapsamı daraltır |
| Gerçek zamanlı bildirim (webhook/websocket) | Public API'de yok; polling yeterli |
| Side ticket'ları ana görünümlerden gizleme | Plugin kodu değil tenant konfigürasyonu (view filtresi); kurulum dokümanına not düşülür |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 1 | Complete |
| CORE-02 | Phase 1 | Complete |
| CORE-03 | Phase 1 | Complete |
| CORE-04 | Phase 04.1 | Not started |
| LIST-01 | Phase 1 | Complete |
| LIST-02 | Phase 1 | Complete |
| LIST-03 | Phase 1 | Complete |
| LIST-04 | Phase 1 | Complete |
| LIST-05 | Phase 1 | Complete |
| LIST-06 | Phase 1 | Complete |
| COMP-01 | Phase 2 | Complete |
| COMP-02 | Phase 2 | Complete |
| COMP-03 | Phase 2 | Complete |
| COMP-04 | Phase 2 | Complete |
| SYNC-02 | Phase 2 | Complete |
| THRD-01 | Phase 3 | Complete |
| THRD-02 | Phase 3 | Complete |
| THRD-03 | Phase 3 | Complete |
| THRD-04 | Phase 3 | Complete |
| COMP-05 | Phase 4 | Complete (contract/infra Plan 01; upload client + pure validation/format rules Plan 02; upload-lifecycle store + chip component Plan 03; composer UI Plan 05; attachmentIds send binding + live delivery (P6a) Plan 06; phase-end panel UAT Plan 08 — all 4 ROADMAP success criteria KARŞILANDI. Recipient-mailbox visual confirmation (P6b) remains user-verified-pending, does not block) |
| COMP-06 | Phase 4 | Pending |
| COMP-07 | Phase 4 | Pending |
| COMP-08 | Phase 4 | Complete (live probe Plan 01; upload client Plan 02; sanitizer policy split (img tag permitted in authored HTML) Plan 07; AttachmentUploadStore.uploadInlineImage + InlineImage/FileHandler paste-drop wiring + D-16 GC Plan 08 — encoding-insensitivity bug found in phase-end UAT fixed same session. Recipient-mailbox rendering (P6b) remains user-verified-pending, does not block) |
| THRD-05 | Phase 4 | Complete (shared upload client + attachmentIds request-type support Plan 02; independent reply-surface bucket Plan 03; composer UI Plan 05; attachmentIds send binding + live delivery Plan 06; phase-end panel UAT Plan 08. Recipient-mailbox visual confirmation (P6b) remains user-verified-pending, does not block) |
| THRD-06 | Phase 4 | Complete (incoming-attachment projection + thread render Plan 04; phase-end panel UAT Plan 08 closed the deferred visual check — thumbnail/chip rendering, target="_blank"/rel="noopener noreferrer" confirmed live) |
| SYNC-01 | Phase 4 | Pending |
| UX-01 | Phase 04.2 | Not started |
| UX-02 | Phase 04.2 | Not started |
| UX-03 | Phase 04.2 | Not started |
| UX-04 | Phase 04.2 | Not started |
| UX-05 | Phase 04.2 | Not started |
| UX-06 | Phase 04.2 | Not started |
| UX-07 | Phase 04.2 | Not started |
| UX-08 | Phase 04.2 | Not started |
| UX-09 | Phase 04.2 | Not started |

**Coverage:**

- v1 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-22*
*Last updated: 2026-07-22 after roadmap creation*
