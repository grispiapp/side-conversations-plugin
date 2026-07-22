# Phase 1: Temel ve Salt Okunur Görüşme Listesi - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 1-Temel ve Salt Okunur Görüşme Listesi
**Areas discussed:** Field şeması ve varsayılanlar, Rozet kuralları ve ilk açılış, Liste verisi ve satır içeriği, Test ve doğrulama düzeni, Faz 1'de işlevsiz CTA'lar, Yükleme görselleri, Hata ve kısmi hata deneyimi, Talep değişimi geçişi

---

## Field şeması ve varsayılanlar

| Option | Description | Selected |
|--------|-------------|----------|
| Tek field: parent-key | tu.side_conversation_parent = parent key; tespit = field dolu (PRESENT) | ✓ |
| İki field: parent-key + tür işareti | + tu.sc_kind; daha açık ayrım, 2 field kurulumu | |
| Sen karar ver | | |

**User's choice:** Tek field: parent-key

| Option | Description | Selected |
|--------|-------------|----------|
| tu.side_conversation_parent | Kendini açıklayan İngilizce isim | ✓ |
| tu.sc_parent_key | Kısa ama kriptik | |
| tu.yan_gorusme_ana_talep | Türkçe isim | |

**User's choice:** tu.side_conversation_parent

| Option | Description | Selected |
|--------|-------------|----------|
| Sadece parent-key EQUAL | Basit, kırılmaz; yanlış pozitif riski pratikte sıfır | ✓ |
| Parent-key + channel koşulu | Doğrulanmamış channel varsayımı riskli | |
| Sen karar ver | | |

**User's choice:** Sadece parent-key EQUAL

| Option | Description | Selected |
|--------|-------------|----------|
| Varsayılan + field doğrulama | Açılışta GET /fields ile kontrol, yoksa kurulum uyarısı | |
| Varsayılanla sessiz çalış | Doğrulama yok | |
| *(freeform)* Kurulumda otomatik field | | ✓ |

**User's choice:** *(freeform)* "plugin kurulduğunda bu alan otomatik açılacak, settingsde olmasına gerek yok"
**Notes:** Kritik revizyon — field key sabitlenir, settings bağımlılığı ve kurulum uyarısı ekranı kalkar. CORE-01 buna göre revize edildi (REQUIREMENTS.md + PROJECT.md güncellendi).

---

## Rozet kuralları ve ilk açılış

| Option | Description | Selected |
|--------|-------------|----------|
| SOLVED + CLOSED listede kalır | İkisi de Kapalı rozetiyle görünür; tarihçe kaybolmaz | ✓ |
| SOLVED kapalı, CLOSED gizlenir | Liste temiz ama tarihçe erişilemez | |
| Sen karar ver | | |

**User's choice:** SOLVED + CLOSED listede kalır

| Option | Description | Selected |
|--------|-------------|----------|
| Yanıtlar "Yeni yanıt" görünsün | Kayıt yoksa görülmemiş sayılır; güvenli taraf | ✓ |
| İlk açılış sessiz başlasın | Baseline okundu; sonrakiler yeni | |
| Sen karar ver | | |

**User's choice:** Yanıtlar "Yeni yanıt" görünsün

| Option | Description | Selected |
|--------|-------------|----------|
| Üç grup: yeni · açık · kapalı | Grup içi son aktivite; mockup düzeni | ✓ |
| İki grup: yeni · diğerleri | Açık/kapalı karışık | |
| Sen karar ver | | |

**User's choice:** Üç grup: yeni · açık · kapalı

---

## Liste verisi ve satır içeriği

| Option | Description | Selected |
|--------|-------------|----------|
| Tam satır — ek istek kabul | Gerekirse ticket başına paralel GET + cache (sayfa başına max 10) | ✓ |
| Hafif satır — eldekiyle yetin | Az istek, zayıf UI | |
| Sen karar ver | | |

**User's choice:** Tam satır — ek istek kabul

| Option | Description | Selected |
|--------|-------------|----------|
| Son public yorumun zamanı | İnternal not/status sırayı oynatmaz | ✓ |
| Ticket updatedAt | Tek alan ama yanıltıcı | |
| Sen karar ver | | |

**User's choice:** Son public yorumun zamanı

| Option | Description | Selected |
|--------|-------------|----------|
| "Daha fazla yükle" butonu | Kontrollü, basit | ✓ |
| Sonsuz kaydırma | Akıcı ama küçük listede değeri düşük | |
| Sen karar ver | | |

**User's choice:** "Daha fazla yükle" butonu

---

## Test ve doğrulama düzeni

| Option | Description | Selected |
|--------|-------------|----------|
| Kendi tenant'ımda, field'ı ben açarım | Admin panelinden elle; API token aynı tenant'tan | ✓ |
| Grispi ekibi dev tenant'a kurar | | |
| Henüz belli değil | | |

**User's choice:** Kendi tenant'ımda, field'ı ben açarım

| Option | Description | Selected |
|--------|-------------|----------|
| Küçük seed script'i | Tekrarlanabilir test verisi | |
| Elle oluştururum | El emeği ama kurulum yok | ✓ |
| Sen karar ver | | |

**User's choice:** Elle oluştururum
**Notes:** LIST-06 sayfalama doğrulaması için 11+ side ticket gerektiği plana not edilecek.

| Option | Description | Selected |
|--------|-------------|----------|
| İkili akış: localhost + Grispi'de doğrulama | Mock bundle + gerçek API token; faz sonu gerçek panel | ✓ |
| Hep Grispi içinde | | |
| Sen karar ver | | |

**User's choice:** İkili akış: localhost + Grispi'de doğrulama

---

## Faz 1'de işlevsiz CTA'lar

| Option | Description | Selected |
|--------|-------------|----------|
| Görünür + devre dışı, "yakında" | Layout zıplamaz; Faz 2'de enable edilir | ✓ |
| Faz 1'de tamamen gizli | Boş durum CTA'sız garip kalır | |
| Sen karar ver | | |

**User's choice:** Görünür + devre dışı, "yakında"

---

## Yükleme görselleri

| Option | Description | Selected |
|--------|-------------|----------|
| Skeleton satırları | 3 iskelet kart; buton spinner'ı | ✓ |
| Starter'ın LoadingScreen'i (roket) | Liste bağlamında aşırı | |
| Sen karar ver | | |

**User's choice:** Skeleton satırları

---

## Hata ve kısmi hata deneyimi

| Option | Description | Selected |
|--------|-------------|----------|
| Katmanlı: tam hata + satır fallback | Kısmi arıza tüm listeyi engellemez | ✓ |
| Hepsi ya da hiç | Basit ama çalışan veri gizlenir | |
| Sen karar ver | | |

**User's choice:** Katmanlı: tam hata + satır fallback

---

## Talep değişimi geçişi

| Option | Description | Selected |
|--------|-------------|----------|
| Anında boşalt + skeleton | Yanlış talebin verisi bir an bile görünmez | ✓ |
| Eski liste soluk + "yenileniyor" | Daha az boşluk hissi ama karışıklık riski | |
| Sen karar ver | | |

**User's choice:** Anında boşalt + skeleton

## Claude's Discretion

- Skeleton kartların birebir tasarımı, hata kartı metinlerinin son hâli, "Daha fazla yükle" yerleşimi (mockup dili korunarak)
- Satır-detay cache stratejisi ve sessiz retry politikası
- Mock bundle yapısı (fixture vs inline)

## Deferred Ideas

None — discussion stayed within phase scope.
