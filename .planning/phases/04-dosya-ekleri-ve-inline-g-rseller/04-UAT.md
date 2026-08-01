---
status: testing
phase: 04-dosya-ekleri-ve-inline-g-rseller
source: [04-VERIFICATION.md]
started: 2026-08-01
updated: 2026-08-01
---

## Current Test

number: 5
name: Sürükleme bölge geri bildirimi ve durum temizliği (düzeltme sonrası yeniden test)
expected: |
  Dosyayı sürüklerken imlecin üzerinde olduğu bölge vurgulu, diğeri sönük olmalı.
  Bırakınca overlay tamamen kalkmalı, editör takılmamalı. Hem yanıtta hem yeni görüşmede.
awaiting: user response

## Tests

### 1. Ekler alıcıya e-postayla ulaşıyor mu (P6b — Başarı ölçütü 2)
expected: |
  Panelden gönderilen mesajların e-postaları `davutkmbr@gmail.com` kutusuna ulaşmış;
  ekler gerçek e-posta eki olarak listeleniyor, açılıp indirilebiliyor, adlar bozulmamış.
  İlgili test gönderimleri: TICKET-591 (2 ek + 1 ek'li yanıt), TICKET-592 (3 ek), TICKET-593 (inline görsel).
  API tarafı kanıtlandı: yorumlar `publicVisible: true`, doğru alıcıya adresli, ekler bağlı.
  Kanıtlanmayan tek halka teslimat ve istemci gösterimi.
result: pass

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

### 5. Sürükleme bölge geri bildirimi ve durum temizliği (D-13 rev. / UI-SPEC §2)
expected: |
  Dosya sürüklenirken imlecin ÜZERİNDE olduğu bölge vurgulu, diğeri sönük olmalı.
  Bırakma bittiğinde (editöre veya ek bölgesine) overlay tamamen kalkmalı ve editör
  normal çalışmaya devam etmeli. Sürükleme iptal edilirse (Esc / pencere dışı) de temizlenmeli.
result: [pending]
fix_applied: |
  ee29b43 — overlay'ler artık react-dropzone'un iç isDragActive'i yerine kendi sahip olunan
  durumdan çiziliyor; imlece göre bölge vurgusu eklendi (editör kutusu sınır).
  dd42c1f — bırakma yolundaki temizlik document üzerinde CAPTURE fazı drop dinleyicisine taşındı;
  FileHandler'ın stopPropagation'ı artık temizliği engelleyemiyor.
  Orkestratör canlı ölçümü (372x812, taze bundle): boşta 0 → sürüklerken 2 → bırakınca 0 → yükleme sonrası 0.
  Gerçek OS sürüklemesiyle kullanıcı onayı bekleniyor.
prior_report: "editör takılıyor, drag state aktif kalıyor, bölge vurgusu imleci takip etmiyor"
reported: "mesaja gömünce yanıt verirken de yeni talep oluştururken de editör takılıyor. drag-drop state i aktif kalıyor. ayrıca dosya olarak yükle kısmına dosyayı götürüp bırakınca çalışıyor ama dosyayı o bölgede tutunca orası aktif görünmüyor. yani dosyayı hangi bölmede tutuyosam orası aktif diğer taraf sönük olmalı bu tam çalışmıyor."
severity: major

## Summary

total: 5
passed: 1
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

- truth: "Sürükleme sırasında imlecin bulunduğu bölge vurgulanır, diğeri sönükleşir; bırakma/iptal sonrası overlay temizlenir ve editör kullanılabilir kalır"
  status: failed
  reason: "User reported: editör takılıyor, drag state aktif kalıyor, bölge vurgusu imleci takip etmiyor"
  severity: major
  test: 5
  artifacts: ["src/screens/components/rich-text-composer.tsx"]
  missing: ["dropzone-dışı drop'ta drag state reset", "imlece göre bölge takibi"]
