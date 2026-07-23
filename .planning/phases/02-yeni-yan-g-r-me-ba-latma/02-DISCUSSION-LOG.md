# Phase 2: Yeni Yan Görüşme Başlatma - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-23
**Phase:** 2-yeni-yan-g-r-me-ba-latma
**Areas discussed:** Compose sunumu + gönderim sonrası, Alıcı autocomplete, Konu prefill, Gönderim & hata/tazeleme, E-posta gövdesi & klavye & gönderim anı

---

## Compose sunumu + gönderim sonrası (Alan 1)

| Soru | Seçenekler | Seçilen |
|------|-----------|---------|
| Compose sunumu (372px) | Tam-panel screen swap ✓ / Alttan sheet / Satır-içi form | **Tam-panel screen swap** |
| Gönderim sonrası nereye | Listeye dön + vurgulu satır ✓ / Minimal onay / Read-only detay | **Listeye dön + vurgulu satır** (SONRADAN Alan 5'te revize → minimal chat) |
| İptal davranışı | Onaylı vazgeç ✓ / Onaysız / Alt bar İptal+Gönder | **Onaylı vazgeç** |

**Notes:** Post-send landing kararı Alan 5'te (chat balonu tartışması) bilinçli olarak "minimal görüşme görünümü"ne revize edildi (D-14).

---

## Alıcı autocomplete (Alan 2)

| Soru | Seçenekler | Seçilen |
|------|-----------|---------|
| Arama tetikleme | 2+ karakter/300ms / 3+ karakter/300ms ✓ / Enter-buton | **3+ karakter, ~300ms debounce** |
| Serbest e-posta | "Bunu kullan" satırı ✓ / Ayrı alan / Enter | **Sonuç altında "Bunu kullan" satırı** |
| Sonuç + doğrulama | İsim+e-posta, geçersizde engelle ✓ / Sadece e-posta / +organizasyon | **İsim+e-posta; geçersizde engelle** |

**Notes:** Tek alıcı kuralı (CC/BCC yok) Faz 1'den taşındı, yeniden sorulmadı.

---

## Konu prefill (Alan 3)

| Soru | Seçenekler | Seçilen |
|------|-----------|---------|
| Format | `[DESTEK-1042] Başlık` ✓ / `Başlık (DESTEK-1042)` / Sadece başlık | **`[DESTEK-1042] Talep başlığı`** |
| Tazeleme | Açılışta bir kez ✓ / Talep değişince güncelle / Boş+buton | **Compose açılışında bir kez** |

**Notes:** COMP-03 "talep anahtarı + başlık"ı zaten kilitliyordu; format/yerleşim ve tazeleme netleştirildi. Anahtarın dış alıcıya gitmesi kabul edildi (düzenlenebilir olduğu için).

---

## Gönderim & hata/tazeleme (Alan 4)

| Soru | Seçenekler | Seçilen |
|------|-----------|---------|
| Zorunlu alan | Alıcı+mesaj ✓ / Alıcı+konu+mesaj / Sadece alıcı | **Alıcı + mesaj** (konu boşsa uyar, engelleme) |
| Gönderim hatası | Form korunur+inline+tekrar ✓ / Toast / Tam-alan | **Form korunur + inline hata + tekrar dene** (SONRADAN Alan 5'te revize → balon hatası) |
| Liste tazeleme | Gerçek refetch ✓ / Optimistic+refetch / Sadece optimistic | **Gerçek refetch** |
| Talep değişimi | Uyar+onayla kapat ✓ / İlk talebe sabitle / Sessizce at | **Uyar + onayla kapat** (boş taslakta sessiz) |

**Notes:** Gönderim-hatası kararı Alan 5'te chat modeline geçilince "balonda gönderilemedi + tekrar dene"ye revize edildi (D-15).

---

## E-posta gövdesi & klavye & gönderim anı (Alan 5 — ek tur)

| Soru | Seçenekler | Seçilen |
|------|-----------|---------|
| E-posta gövdesi | Metin aynen ✓ / Otomatik selamlama+imza / Metin+tenant imzası | **Temsilcinin yazdığı metin aynen** (otomatik imza yok) |
| Mesaj alanı / Enter | Çok satırlı Enter=yeni satır / Enter=gönder Shift=satır / Tek satır | **Custom: Enter = yeni satır, Shift+Enter = gönder** (+ Gönder butonu) |
| Gönderim anı | POST dönünce kapan (spinner) / Hemen kapan | **Custom: mesaj optimistic chat'e düşer, balonun sağ altında loading döner** |

**Notes:** Gönderim-anı cevabı, post-send deneyimini "listeye dön"den **optimistic chat balonu**na taşıdı — bu, Alan 1 ve Alan 4 kararlarını bilinçli olarak revize etti. Ayrı bir tur ile Faz 2/3 sınırı çizildi.

## Faz 2/3 sınır kararı (Alan 5 devamı)

| Soru | Seçenekler | Seçilen |
|------|-----------|---------|
| Chat ekranını ne kadar kur | Minimal chat (sadece gönderilen mesaj) ✓ / Tam thread şimdi / Listeye dön | **Minimal chat: sadece gönderilen mesaj** (tam thread Faz 3) |
| Balon hatası | Balonda "gönderilemedi + tekrar dene" ✓ / Compose formuna dön / Toast+gri balon | **Balonda "⚠ Gönderilemedi · Tekrar dene"** |

**Notes:** Faz 2 artık minimal tek-mesajlık görüşme kabuğunu da kuruyor; Faz 3 tam iki-yönlü thread'e genişletecek. Kapsam kaydırması CONTEXT.md `<domain>` ve `<deferred>`'de işaretlendi.

---

## Claude's Discretion
- Form/chat balonu görsel dili, optimistic spinner/onay ikonu, "kullan" satırı stili (mockup dili + mor tema/cva korunarak)
- Müşteri arama sonuç limiti, debounce ms, stale-race iptali
- Minimal chat kabuğunun bileşen/dosya yapısı ve Faz 3 genişleme noktaları

## Deferred Ideas
- Tam iki-yönlü görüşme thread'i → Faz 3
- Dosya ekleme, talep özeti, alıcıyla önceki görüşmeler → Faz 4
- Zengin metin editörü → v1 dışı
- Çoklu alıcı / CC-BCC → kalıcı kapsam dışı
- E-posta gönderen (from) kimliği özelleştirme → Grispi tenant yönetir, kapsam dışı
