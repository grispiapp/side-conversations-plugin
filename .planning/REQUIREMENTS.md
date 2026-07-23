# Requirements: Yan Görüşmeler — Grispi Side Conversations Plugin

**Defined:** 2026-07-22
**Core Value:** Temsilci, talebi çözmek için gereken harici yazışmaları talepten hiç ayrılmadan yürütebilmeli; talep sahibi bu yazışmaları asla görmemeli.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Altyapı (CORE)

- [x] **CORE-01**: İlişki field'ının key'i sabittir (`tu.side_conversation_parent`) ve field, plugin tenant'a kurulurken otomatik oluşturulur; kod settings'e bağımlı değildir *(rev. 2026-07-22 Faz 1 tartışması — önceki "settings'ten okunur" yaklaşımı kaldırıldı)*
- [x] **CORE-02**: API katmanı yan görüşme operasyonlarını kapsar: advanced-search ile listeleme, ticket oluşturma, yorum/status PATCH'i, müşteri arama, yorum özeti
- [x] **CORE-03**: API hataları kullanıcıya Türkçe, anlaşılır mesajlarla gösterilir ve yeniden deneme imkanı sunulur

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
- [ ] **COMP-05**: Temsilci mesaja dosya ekleyebilir (Base64, boyut sınırı uyarısıyla)
- [ ] **COMP-06**: Temsilci "Talep özetini ekle" ile ana talebin son public yorumlarını mesaj gövdesine alıntılayabilir
- [ ] **COMP-07**: Temsilci alıcıyı seçtiğinde, bu alıcıyla yapılmış önceki yan görüşmeler listelenir ve tek dokunuşla açılabilir (v2 preview `GET /tickets?requesterEmail=` endpoint'ine dayanır; Grispi değişiklikleri önceden bildirir)

### Görüşme Detayı (THRD)

- [ ] **THRD-01**: Temsilci görüşmenin tüm mesajlarını kronolojik ve yön ayrımıyla (siz / karşı taraf) görür
- [ ] **THRD-02**: Temsilci görüşmeye yanıt yazar; yanıt alıcıya e-posta olarak gider ve thread'e eklenir
- [ ] **THRD-03**: Temsilci görüşmeyi kapatabilir ve yeniden açabilir; kapalı görüşmeye gelen yanıt görüşmeyi tekrar aktif gösterir
- [ ] **THRD-04**: Görüşme açıldığında "Yeni yanıt" durumu okundu sayılır (temsilci bazında, localStorage)
- [ ] **THRD-05**: Temsilci yanıta dosya ekleyebilir (Base64)

### Tazelik (SYNC)

- [ ] **SYNC-01**: Panel görünürken liste ve açık görüşme makul aralıklarla (30-60 sn) sessizce tazelenir
- [ ] **SYNC-02**: Her yazma işleminden (gönder, yanıtla, kapat) sonra ilgili görünüm anında tazelenir

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
| SYNC-02 | Phase 2 | Pending |
| THRD-01 | Phase 3 | Pending |
| THRD-02 | Phase 3 | Pending |
| THRD-03 | Phase 3 | Pending |
| THRD-04 | Phase 3 | Pending |
| COMP-05 | Phase 4 | Pending |
| COMP-06 | Phase 4 | Pending |
| COMP-07 | Phase 4 | Pending |
| THRD-05 | Phase 4 | Pending |
| SYNC-01 | Phase 4 | Pending |

**Coverage:**

- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-22*
*Last updated: 2026-07-22 after roadmap creation*
