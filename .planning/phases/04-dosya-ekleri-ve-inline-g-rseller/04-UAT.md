---
status: testing
phase: 04-dosya-ekleri-ve-inline-g-rseller
source: [04-VERIFICATION.md]
started: 2026-08-01
updated: 2026-08-01
---

## Current Test

number: 1
name: Alıcının gelen kutusunda ekler gerçekten var mı (P6b)
expected: |
  `davutkmbr@gmail.com` kutusunda `[TICKET-563]` konulu test e-postaları bulunur.
  Ekler gerçek e-posta eki olarak görünür, indirilebilir ve dosya adları bozulmamıştır.
awaiting: user response

## Tests

### 1. Ekler alıcıya e-postayla ulaşıyor mu (P6b — Başarı ölçütü 2)
expected: |
  Panelden gönderilen mesajların e-postaları `davutkmbr@gmail.com` kutusuna ulaşmış;
  ekler gerçek e-posta eki olarak listeleniyor, açılıp indirilebiliyor, adlar bozulmamış.
  İlgili test gönderimleri: TICKET-591 (2 ek + 1 ek'li yanıt), TICKET-592 (3 ek), TICKET-593 (inline görsel).
  API tarafı kanıtlandı: yorumlar `publicVisible: true`, doğru alıcıya adresli, ekler bağlı.
  Kanıtlanmayan tek halka teslimat ve istemci gösterimi.
result: [pending]

### 2. Inline görsel alıcının posta istemcisinde render oluyor mu (P6b — Başarı ölçütü 3)
expected: |
  TICKET-593'ün e-postasında yapıştırılan görsel gövde içinde inline görünür.
  NOT: Gmail/Outlook uzak görselleri varsayılan olarak engelleyebilir — bu bir ürün hatası değil,
  posta istemcisi davranışıdır. Hangi istemcide test edildiği ve sonucu kaydedilmeli.
result: [pending]

### 3. Plugin-mode bundle token yetkisi (P5)
expected: |
  Gerçek Grispi panelinde (plugin manifest kayıtlıysa) bir dosya yüklenir ve 401/403 alınmaz.
  Manifest henüz kayıtlı değilse "DEFERRED — TEST EDİLMEDİ" olarak işaretlenir; bu tek başına fazı bloklamaz
  (dış bağımlılık: Grispi ekibinin manifest onayı).
result: [pending]

### 4. Yazma gecikmesi (Task 2f ölçümü)
expected: |
  Büyük bir ekran görüntüsü yapıştırıldıktan hemen sonra yazmaya devam edildiğinde
  fark edilir bir gecikme olmamalı. Gecikme varsa `onUpdate` sanitize debounce'u (~300ms)
  eklenmesi bu planın kapsamındadır.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
