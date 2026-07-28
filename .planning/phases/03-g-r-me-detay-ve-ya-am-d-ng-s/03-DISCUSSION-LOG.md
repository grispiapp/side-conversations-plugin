# Phase 3: Görüşme Detayı ve Yaşam Döngüsü - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-28
**Phase:** 3-Görüşme Detayı ve Yaşam Döngüsü
**Areas discussed:** Thread görünümü, yanıt deneyimi, çözüm yaşam döngüsü, görülme/aksiyon durumu, Zendesk uyarlaması

---

## Thread görünümü

| Option | Description | Selected |
|---|---|---|
| Kart/blok | Belirgin kartlarla e-posta mesajları | |
| İnce zaman çizgisi | Solda posta hattı ile akış | |
| Minimal ayrım | Alt alta, sakin başlık/boşluk/ayırıcı | ✓ |

**User's choice:** E-posta karakterini koruyan minimal, alt alta akış.
**Notes:** Önceki e-postalar varsayılan kapalı; internal notlar amber `İç not` etiketiyle akışta görünür. Temel gelen HTML biçimi korunur ama güvenli temizlenir.

---

## Yanıt deneyimi

| Option | Description | Selected |
|---|---|---|
| Sabit textarea | Kısıtlı düz metin alanı | |
| Hafif rich editor | Altta sabit, dinamik büyüyen HTML editörü | ✓ |
| Tam belge editörü | Gelişmiş tablo/görsel araçları | |

**User's choice:** Araç çubuğu her zaman görünür: kalın, italik, bağlantı, liste, emoji, alıntı.
**Notes:** Enter yeni satır, Shift+Enter gönderir. Gönderimde editör temizlenir; hata thread üzerinden yeniden denenir. Alıcı sabit ve görünürdür; taslaktan çıkış onay ister.

---

## Çözüm yaşam döngüsü

| Option | Description | Selected |
|---|---|---|
| Kapat / CLOSED | Geri dönüşü zor kapama dili | |
| Çözüldü / SOLVED | Native çözüldü durumu, tekrar açılabilir | ✓ |

**User's choice:** Başlık menüsünden `Çözüldü olarak işaretle`; onaylı, e-posta üretmeyen status PATCH.
**Notes:** Çözülen thread ekranda kalır, editör pasiftir. `Tekrar aç` editörü odaklar. Dış yanıt otomatik aktifleştirir; istek hatasında görünüm korunur.

---

## Görülme ve aksiyon durumu

| Option | Description | Selected |
|---|---|---|
| Tek rozet | Görülme ve yanıt ihtiyacını aynı sinyalle gösterir | |
| Ayrı sinyaller | Mor vurgu görülmeyi, rozet aksiyon ihtiyacını gösterir | ✓ |

**User's choice:** Thread açılınca mor vurgu kalkar; dış taraf son konuşansa `Yeni yanıt` temsilci yanıtlayana kadar kalır.
**Notes:** Çözülen görüşmeler yalnız `Çözüldü` görünür. Yeni dış yanıt onları aktifleştirir ve yeniden yeni/okunmamış olarak işaretler.

---

## Zendesk uyarlaması

**User's choice:** Zendesk'in e-posta odaklı side-conversation ve hafif rich-text desenleri uyarlanır.
**Notes:** Tablo ve inline görsel eklenmez; alıntılar UI'da kapalı kalır; tek alıcı sabit kalır. Zendesk'in manuel yeniden açma davranışından farklı olarak, yeni dış yanıt otomatik aktifleşir.

## the agent's Discretion

- Güvenli HTML sanitizasyonu ve editör bileşeni seçimi.
- Toolbar ikonları, loading/hata mikro detayları ve e-posta alıntısının API düzeyinde uygulanması.

## Deferred Ideas

- Internal note oluşturma.
- Dosya ekleme, tablo ve inline görsel desteği.
- Cihazlar arası okundu senkronizasyonu.
