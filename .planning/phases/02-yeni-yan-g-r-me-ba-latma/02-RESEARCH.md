# Phase 2: Yeni Yan Görüşme Başlatma - Research

**Researched:** 2026-07-23
**Domain:** Grispi Public API (talep oluşturma + müşteri arama) üzerine React/MobX yazma akışı; hand-rolled combobox/dialog/chat-bubble UI (yeni bağımlılık yok)
**Confidence:** MEDIUM — kod-mimarisi bulguları HIGH (doğrudan mevcut kaynak okundu); API create/search şekli MEDIUM (resmi OpenAPI metni doğrudan okundu, ama canlı `POST /tickets` + `/customers/search` denemesi Faz 1'de YAPILMADI — Plan 02'nin ilk checkpoint'i olmalı)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Compose ekranı sunumu ve navigasyon**
- **D-01:** Compose, ~372px panelde **tam-panel screen swap** olarak açılır (listenin yerini alır); `ScreenHeader`'daki geri oku ile listeye dönülür. Modal/sheet/satır-içi form DEĞİL — mevcut `Screen`/`ScreenHeader` primitifleriyle birebir. Giriş noktaları: liste header'ındaki "+" ve boş-durum CTA'sı (Faz 1'de görünür+devre dışı, "Çok yakında"; Faz 2'de **enable** edilir — D-13/Faz 1, layout zıplaması yok).
- **D-02:** Dolu formda geri/iptal → **onaylı vazgeç** ("Vazgeçilsin mi? Yazılanlar kaybolur"). Boş formda onaysız direkt döner.
- **D-03:** Compose açıkken temsilci **aktif talebi (parent) değiştirirse**: taslakta içerik varsa **uyar + onayla kapat**; onaylanırsa compose kapanır, yeni talebin listesi gelir. Boş taslakta sessizce kapanır.

**Alıcı (recipient) seçimi**
- **D-04:** Müşteri araması (`/customers/search`) autocomplete **3+ karakterde, ~300ms debounce** ile tetiklenir.
- **D-05:** Kayıtlı olmayan serbest e-posta: geçerli bir e-posta yazılınca arama sonuçlarının **en altında "✉ <e-posta> adresini kullan" satırı** belirir; tıklanınca alıcı olur. Ayrı serbest-e-posta alanı/modu YOK — tek akış.
- **D-06:** Sonuç satırında **isim + e-posta** gösterilir (isim yoksa sadece e-posta). Geçersiz formatlı serbest e-postada "kullan" satırı **çıkmaz** + inline uyarı; Gönder devre dışı kalır.
- **D-07:** **Tek alıcı** (CC/BCC yok). Alıcı `ts.requester` alanına canlı-doğrulanmış `:e-posta` formatıyla yazılır.

**Konu (subject) prefill**
- **D-08:** Ön-dolu konu biçimi: **`[<TALEP_ANAHTARI>] <Talep Başlığı>`**. Düzenlenebilir.
- **D-09:** Konu **compose açılışında bir kez** doldurulur; sonra serbest bırakılır — otomatik üzerine yazılmaz.

**Gönderim mekaniği, e-posta ve durum**
- **D-10:** Zorunlu alanlar: **alıcı + mesaj**. Konu boşaltılırsa inline uyarı verir ama gönderimi **engellemez**.
- **D-11:** E-posta gövdesi = **temsilcinin yazdığı düz metin AYNEN**. Otomatik selamlama/imza yok. Zengin metin editörü yok.
- **D-12:** Mesaj alanı çok satırlı textarea. **Enter = yeni satır**, **Shift+Enter = gönder**; ayrıca açık bir "Gönder" butonu da var.
- **D-13:** Mesaj alıcıya **public yorum** olarak gider (`publicVisible: true` → alıcıya e-posta; canlı doğrulandı). Yorumun creator'ı temsilcidir. E-postanın GÖNDEREN kimliği Grispi tenant tarafından yönetilir.
- **D-14 (revizyon):** Gönderim başarılı olunca temsilci **minimal görüşme (chat) görünümüne** düşer: başlık (alıcı · konu) + gönderdiği mesaj balonu, sağ altında optimistic loading → POST onaylanınca çözülür.
- **D-15 (revizyon):** POST başarısız olursa balonda "⚠ Gönderilemedi · Tekrar dene" — mesaj metni korunur, "Tekrar dene" aynı POST'u yeniden atar. Ağ vs sunucu hatası ayrımı Faz 1 `ErrorCard`/hata diliyle tutarlı olmalı.
- **D-16 (SYNC-02):** Gönderim sonrası tazeleme iki katmanlı: (a) chat balonu optimistic → POST cevabıyla çözülür; (b) temsilci listeye döndüğünde **gerçek refetch** (`store.load(aktifTalep)`), optimistic sahte-satır değil.
- **D-17:** Çift gönderim önleme: gönderim sürerken Gönder butonu + Shift+Enter kilitlenir.

### Claude's Discretion
- Compose form alanlarının birebir yerleşimi, chat balonunun görsel dili, "kullan" satırının stili — UI-SPEC zaten kilitlendi (bkz. 02-UI-SPEC.md), bu araştırma onunla çelişmez.
- Müşteri arama sonuç limiti/sayfalama, debounce'un tam ms değeri, arama isteği iptali (stale race) — planner belirler (bu RESEARCH somut bir öneri sunar: generation-guard, Faz 1 ile aynı desen).
- `/customers/search` cevabında isim alanının yokluğunda fallback gösterim — planner (canlı şekil doğrulanınca netleşir).
- Minimal görüşme kabuğunun bileşen adı/dosya yapısı ve Faz 3'e devredilecek genişleme noktaları — planner (bu RESEARCH somut bir dosya/store yapısı önerir, bkz. Architecture Patterns).

### Deferred Ideas (OUT OF SCOPE)
- Tam iki-yönlü görüşme thread'i (gelen yanıtlar, yön ayrımı, yanıtlama, kapat/aç, okundu) → Faz 3.
- Dosya ekleme, talep özeti alıntılama, alıcıyla önceki yan görüşmelerin gösterimi → Faz 4.
- Zengin metin editörü / HTML gövde → v1 dışı.
- Çoklu alıcı / CC-BCC → kalıcı kapsam dışı.
- E-posta GÖNDEREN kimliğini plugin'den özelleştirme → kapsam dışı.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMP-01 | Temsilci listeden "+" ile yeni görüşme ekranını açar | Architecture Patterns → Navigasyon (screen-swap state machine, şu an hiç yok — bu fazda ilk kez kuruluyor); `EmptyState`/liste header CTA'sının `disabled` flip'i |
| COMP-02 | Alıcı alanı müşteri aramasıyla otomatik tamamlanır; kayıtlı olmayan serbest e-posta de girilebilir | `/customers/search` sözleşmesi (Standard Stack/API bölümü), debounce+generation-guard deseni (Code Examples), e-posta format doğrulayıcı tek-kaynak fonksiyonu (Don't Hand-Roll) |
| COMP-03 | Konu alanı talep anahtarı + talep başlığıyla önceden dolu gelir ve düzenlenebilir | `formatPrefillSubject` saf fonksiyonu (Code Examples), `ts.subject` alan-yazma nüansı (Common Pitfalls #1) |
| COMP-04 | Temsilci mesajı gönderdiğinde side ticket oluşur, alıcıya e-posta gider, temsilci görüşme ekranına yönlendirilir | `createTicket` request/response sözleşmesi (Standard Stack/API), `publicVisible` ters-anlam uyarısı (Common Pitfalls #2), agent-identity eksikliği (Common Pitfalls #4), ComposeStore/ActiveConversationStore mimarisi |
| SYNC-02 | Her yazma işleminden sonra ilgili görünüm anında tazelenir | İki katmanlı refresh deseni (Architecture Patterns → State Machine), `store.load(parentKey)` reuse |

</phase_requirements>

## Summary

Bu faz, Faz 1'in **salt-okunur** listesine ilk **yazma** akışını ekliyor: alıcı seç → konu/mesaj yaz → `POST /public/v1/tickets` ile side ticket oluştur → optimistic chat balonuna düş. Kod tarafında hiçbir yeni npm paketi gerekmiyor — proje bilinçli olarak Radix Dialog/Popover, bir combobox kütüphanesi veya lodash.debounce gibi ek bağımlılıklar yerine mevcut `cva`/`cn`/el-yapımı primitiflerle devam ediyor (UI-SPEC bunu zaten kilitledi). Asıl iş: (1) `Tickets`/`Users` istemcilerine `createTicket` + müşteri arama eklemek, (2) Faz 1'in **generation-guard** desenini debounce'lu arama ve optimistic gönderim durumuna uyarlamak, (3) şu ana kadar **hiç var olmayan** bir ekran-geçiş (screen-swap) durum makinesi kurmak — `app.tsx` bugün doğrudan `<ConversationsListScreen />` render ediyor, list/compose/chat arasında geçiş yapan hiçbir mekanizma yok.

En kritik bulgu, resmi OpenAPI metninin `publicVisible` alanını **live davranışın tam tersi** açıkladığıdır (`true` = "dahili not", oysa Faz 1 canlı doğruladı: `true` = herkese açık yorum → alıcıya e-posta). Faz 1'in probe-findings'i bunu zaten düzeltti; bu araştırma resmi metni ayrıca okuyarak bu çelişkiyi teyit etti — planner/executor dokümantasyona bakıp tersine dönmemeli. İkinci kritik bulgu: yorumun `creator` alanı (`us.email`) **zorunlu**, ama bugünkü kod tabanında temsilcinin (agent) e-postasını hiçbir yerde tutmuyoruz — `GrispiContext` yalnızca `tenantId`/`token`/`settings`/aktif talebi taşıyor, `bundle.context.agent` hiç saklanmıyor. Bu, Plan 02'nin en önemli "gap-closure" görevi olmalı.

**Primary recommendation:** Plan 02'yi, Faz 1'deki gibi, tek bir canlı-probe checkpoint task'ı ile aç — gerçek tenant'ta bir `POST /public/v1/tickets` (comment+fields ile) ve bir `GET /customers/search?searchTerm=...` çağrısı yapıp 201/200 cevap şekillerini doğrula (`key` alanı response'ta var mı, `/customers/search` zarfı `{content,...}` mi düz dizi mi, müşteri kaydının alan adları ne) — sonra ComposeStore/createTicket/RecipientField'ı bu doğrulanmış şekil üzerine inşa et.

## Architectural Responsibility Map

> Not: Bu proje bir iframe-içi SPA'dır (CRA build, kendi backend'i/DB'si yok). Standart 5 katmanın 3'ü (Frontend SSR, CDN/Static, Database/Storage) bu projeye uygulanmıyor — tüm "backend" mantığı Grispi'nin sahip olduğu harici Public API'dir. Aşağıdaki harita yalnızca gerçekten var olan iki katmanı kullanır.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ekran geçişi (list↔compose↔chat) | Browser/Client | — | Salt UI durumu; sunucuya hiç gitmez |
| Müşteri arama autocomplete | Browser/Client | API/Backend (Grispi) | Debounce/iptal/render client'ta; veri kaynağı `/customers/search` |
| Serbest e-posta format doğrulama | Browser/Client | — | Anlık geri bildirim gerektirir, sunucuya gitmeden önce engellemeli |
| Side ticket oluşturma (createTicket) | API/Backend (Grispi) | Browser/Client | Gerçek veri/e-posta üretimi sunucuda; client yalnızca orkestre eder |
| Alıcıya e-posta gönderimi | API/Backend (Grispi native mail) | — | Plugin'in kontrolü/görünürlüğü yok — `publicVisible:true` tetikler, gerisi Grispi'nin |
| Optimistic mesaj balonu durumu (pending/sent/failed) | Browser/Client | — | Saf MobX state; sunucu yalnızca "settled" sinyali verir |
| Gönderim sonrası tazeleme (SYNC-02) | Browser/Client | API/Backend (source of truth) | Client refetch tetikler, ama "doğru" veri sunucudan gelir |
| Aktif talep (parent) değişince taslak koruması (D-03) | Browser/Client | — | SDK bridge event'i client'ta tüketilir, hiçbir sunucu etkileşimi yok |

## Standard Stack

### Core

Bu fazda **hiçbir yeni npm paketi eklenmiyor**. Aşağıdaki tablo, mevcut bağımlılıkların bu fazda nasıl genişletildiğini gösterir (Faz 1'de zaten kurulu):

| Library | Version | Purpose | Why Standard (bu projede) |
|---------|---------|---------|--------------|
| `mobx` | ^6.12.3 [VERIFIED: package.json] | ComposeStore, ActiveConversationStore, PanelNavigationStore | Faz 1'in `SideConversationsStore`/`CurrentUserStore` ile aynı desen (`makeAutoObservable`, `runInAction`) |
| `mobx-react-lite` | ^4.0.7 [VERIFIED: package.json] | Yeni ekranların `observer()` sarmalayıcısı | `ConversationsListScreen` zaten bu şekilde |
| `class-variance-authority` + `clsx`/`tailwind-merge` (`cn`) | ^0.7.0 / ^2.1.1 / ^2.3.0 [VERIFIED: package.json] | `Textarea`, `MessageBubble`, `ConfirmDialog` varyantları | `button.tsx`/`input.tsx` ile birebir aynı kalıp |
| `@radix-ui/react-icons` | ^1.3.0 [VERIFIED: package.json] | `EnvelopeClosedIcon`, `ExclamationTriangleIcon` (reuse), `ReloadIcon` (reuse) | UI-SPEC zaten bu ikonları seçti, hepsi kurulu |

### Grispi Public API — bu fazda eklenecek uç noktalar

| Endpoint | Method | Durum | Kaynak |
|---------|--------|-------|--------|
| `/public/v1/tickets` | POST | **Dokümante** — `TicketRequest` şeması var | [CITED: github.com/grispiapp/api-docs public-api-v1.yml, `/tickets` POST, satır 42-74] |
| `/public/v1/customers/search` | GET | **Kısmen dokümante** — query param'lar var, response şeması YOK | [CITED: aynı dosya, `/customers/search` GET, satır 135-164] |
| `/public/v1/customers` | POST | Dokümante (müşteri oluşturma) — **muhtemelen gerekmiyor**, bkz. not aşağıda | [CITED: aynı dosya, `/customers` POST, satır 116-134] |

**Not — `/customers` POST muhtemelen gerekmiyor:** Faz 1'in canlı probe'u (`01-02-probe-findings.md` EK BULGULAR #3), `ts.requester` alanına `:e-posta` (baştan iki nokta) formatında bir değer yazmanın **yeni veya var olan kullanıcıyı otomatik bağladığını** doğruladı ("Yeni/var olan kullanıcıyı e-postayla bağlamak için değer `:alici@ornek.com`"). Yani D-05'in serbest-e-posta akışı için ayrı bir `POST /customers` çağrısına muhtemelen gerek yok — `createTicket`'ın `fields` dizisindeki `ts.requester` girdisi tek başına yeterli. **Bu, Plan 02'nin canlı-probe checkpoint'inde tekrar doğrulanmalı** (Faz 1'in probe'u ticket oluşturma sırasında yapıldı ama `createTicket` istemci kodu hiç yazılmadı — probe elle/manuel curl ile yapılmıştı).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| El-yapımı debounce (`useRef`+`setTimeout`) | `lodash.debounce` / `use-debounce` npm paketi | Yeni bağımlılık; debounce ~10 satırlık kod, projenin "minimal deps" felsefesine (UI-SPEC "Assumption") aykırı — ELE YAPIM önerilir |
| Generation-counter ile stale-request iptali | `AbortController` + `HttpHandler.send`'e `signal` geçirme | `HttpHandler.send(url, options: RequestInit)` zaten `...options` spread ediyor, yani `signal` teknik olarak destekleniyor — ama Faz 1'in TÜM store'ları generation-counter kullanıyor (AbortController hiç kullanılmamış). Tutarlılık için **generation-counter önerilir**; AbortController eklemek iki farklı iptal deseni yaratır |
| El-yapımı `ConfirmDialog`/dropdown paneli (`fixed`/`absolute` + `bg-card`) | `@radix-ui/react-dialog`, `@radix-ui/react-popover` | Bu paketler package.json'da YOK; UI-SPEC zaten "Registry Safety" bölümünde bunları reddetti (Faz 1 hand-written primitifler kararını sürdürüyor) |

**Installation:** Yok — yeni paket kurulumu gerekmiyor.

## Package Legitimacy Audit

**Bu fazda hiçbir yeni harici paket kurulmuyor** — Package Legitimacy Gate protokolü bu nedenle uygulanmaz. Tüm yeni kod (Textarea, ConfirmDialog, RecipientField/Combobox, MessageBubble, debounce, generation-guard) mevcut `mobx`/`mobx-react-lite`/`class-variance-authority`/`clsx`/`tailwind-merge`/`@radix-ui/react-icons` üzerine, el yazımı olarak kurulur.

**Packages removed due to [SLOP] verdict:** yok (kontrol edilecek yeni paket yok)
**Packages flagged as suspicious [SUS]:** yok

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (iframe, ~372px)                                           │
│                                                                       │
│  app.tsx ── PanelNavigationStore.screen ──┬─ "list"  → ConversationsListScreen
│                                             ├─ "compose" → ComposeScreen
│                                             └─ "chat"    → ChatScreen
│                                                                       │
│  "+"/EmptyState CTA (enabled, D-01)                                  │
│        │                                                             │
│        ▼                                                             │
│  ComposeScreen                                                       │
│   ├─ RecipientField ──(debounce 300ms)──► ComposeStore.searchCustomers()
│   │        │  keystroke                          │ generation-guard  │
│   │        │                                      ▼                  │
│   │        │                          GET /customers/search ─────────┼──► Grispi API
│   │        │                                      │                  │
│   │        ◄──────────── sonuçlar / "kullan" satırı /invalid ────────┘
│   ├─ SubjectField (prefill: [KEY] Başlık, D-08/09, bir kez)          │
│   ├─ MessageField (Enter=yeni satır, Shift+Enter=gönder, D-12)       │
│   └─ "Gönder" ──► ComposeStore.submit() ── (D-17 reentrancy guard)   │
│                        │                                             │
│                        ├─(1) optimistic bubble → ActiveConversationStore
│                        │        (PanelNavigationStore.screen = "chat")│
│                        │                                             │
│                        └─(2) POST /public/v1/tickets ─────────────────┼──► Grispi API
│                                 │  {comment:{body,publicVisible:true, │   (side ticket
│                                 │   creator:[{key:"us.email",value}]},│    oluşur, gerçek
│                                 │   fields:[ts.subject, ts.requester, │    e-posta gider)
│                                 │           tu.side_conversation_parent]}│
│                                 ▼                                     │
│                     ┌── başarı ──────────┬── hata ──────────┐        │
│                     ▼                    ▼                            │
│         bubble: "sent"          bubble: "failed" + Tekrar dene        │
│         (D-16a: optimistic çözüldü)  (D-15: aynı POST'u yeniden atar) │
│                     │                                                 │
│                     ▼                                                 │
│         SideConversationsStore.load(parentKey)  ── SYNC-02, D-16b ───┼──► Grispi API
│         (liste GERÇEK veriyle tazelenir, sahte satır değil)          │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── components/ui/
│   └── textarea.tsx              # NEW — input.tsx ile birebir aynı cva kalıbı, multi-line
├── grispi/client/
│   ├── tickets.ts                # createTicket eklenir (advancedSearch/getTicket zaten var)
│   ├── customers.ts              # NEW — Customers.search(), OpenAPI "customers" tag'iyle hizalı
│   └── api.ts                    # GrispiAPI'ye `customers: Customers` eklenir
├── lib/
│   └── side-conversation.ts      # formatPrefillSubject(), isValidEmail() saf fonksiyonları eklenir
├── store/
│   ├── compose-store.ts          # NEW — recipient search + form state + submit lifecycle
│   ├── active-conversation-store.ts  # NEW — minimal chat state (Faz 3'ün genişleteceği yer)
│   ├── panel-navigation-store.ts # NEW — list/compose/chat ekran durum makinesi + dirty-guard
│   └── root-store.ts             # yeni store'lar eklenir
└── screens/
    ├── compose-screen.tsx        # NEW
    ├── chat-screen.tsx           # NEW
    └── components/
        ├── recipient-field.tsx   # NEW
        ├── subject-field.tsx     # NEW
        ├── message-field.tsx     # NEW
        ├── confirm-dialog.tsx    # NEW — D-02 VE D-03 için TEK bileşen, farklı copy/props
        └── message-bubble.tsx    # NEW — `direction: "own" | "incoming"` prop, Faz 2 yalnızca "own" kullanır
```

### Pattern 1: Generation-guard'lı debounce (Faz 1'in store deseninin arama alanına uyarlanması)

**What:** `SideConversationsStore.load()`'daki `const gen = ++this.generation; ... if (gen !== this.generation) return;` deseni, customer search'e birebir uygulanır. Debounce (300ms setTimeout) YALNIZCA istek göndermeyi geciktirir; generation-guard ise "gönderildikten sonra gelen yanıtın hâlâ en güncel istek olup olmadığını" garanti eder. İkisi ayrı problemleri çözer — biri diğerinin yerine geçemez.

**When to use:** Her keystroke'da tetiklenen, sonucu asenkron gelen ve sıralaması garanti olmayan her arama/otomatik-tamamlama.

**Example:**
```typescript
// src/store/compose-store.ts — Faz 1'in side-conversations-store.ts generation deseninin uyarlanması
class ComposeStore {
  query = "";
  searchStatus: "idle" | "loading" | "results" | "no-results" | "invalid" = "idle";
  results: CustomerVM[] = [];
  private searchGeneration = 0;
  private debounceHandle: ReturnType<typeof setTimeout> | null = null;

  setQuery(value: string) {
    this.query = value;
    if (this.debounceHandle) clearTimeout(this.debounceHandle);

    if (value.trim().length < 3) {
      this.searchStatus = "idle";
      this.results = [];
      return;
    }

    this.debounceHandle = setTimeout(() => this.runSearch(value), 300);
  }

  private async runSearch(term: string) {
    const gen = ++this.searchGeneration;
    runInAction(() => { this.searchStatus = "loading"; });

    try {
      const response = await grispiAPI.customers.search({ searchTerm: term, size: 10, page: 0 });
      if (gen !== this.searchGeneration) return; // stale — daha yeni bir arama zaten var

      runInAction(() => {
        this.results = response.content ?? []; // ŞEKİL CANLI DOĞRULANMALI (bkz. Common Pitfalls #7)
        this.searchStatus = this.results.length ? "results" : "no-results";
      });
    } catch {
      if (gen !== this.searchGeneration) return;
      runInAction(() => { this.searchStatus = "no-results"; }); // CORE-03 diliyle tutarlı jenerik hata
    }
  }
}
```

### Pattern 2: Enter/Shift+Enter ters kısayolu (D-12) — sanılandan basit

**What:** Native `<textarea>`, hem düz Enter hem Shift+Enter'da varsayılan olarak yeni satır ekler — ikisi arasında fark YOKTUR native davranışta. D-12'nin "tersine çevrilmiş" kısayolu aslında yalnızca **Shift+Enter'ı yakalayıp `preventDefault()` + gönder** yapmayı gerektirir; düz Enter'a hiç dokunmaya gerek yok (zaten native davranışı istenen davranışla örtüşüyor).

**When to use:** `MessageField`'ın `onKeyDown`'ı.

**Example:**
```typescript
function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
  if (e.key === "Enter" && e.shiftKey) {
    e.preventDefault(); // native yeni-satır davranışını iptal et
    composeStore.submit();
  }
  // düz Enter: hiçbir şey yapma — native newline zaten doğru davranış
}
```

### Pattern 3: Reentrancy-guard'lı submit (D-17)

**What:** Çift-gönderim koruması, YALNIZCA butonun `disabled` prop'una güvenilerek yapılamaz — `disabled` sadece mouse click'i engeller, `MessageField`'ın `onKeyDown`'ı aynı `composeStore.submit()` metodunu doğrudan çağırıyorsa (Pattern 2), klavye yoluyla çift-tetikleme hâlâ mümkündür. Guard, `submit()` metodunun EN BAŞINDA, herhangi bir `await`'ten ÖNCE senkron olarak konmalı.

**Example:**
```typescript
async submit() {
  if (this.submitting) return; // senkron guard — ilk await'ten ÖNCE
  this.submitting = true;      // MobX action içinde senkron flip, race yok

  const gen = ++this.submitGeneration;
  // ... optimistic bubble + POST /public/v1/tickets ...
}
```
Hem "Gönder" butonunun `onClick`'i hem `MessageField`'ın `onKeyDown`'ı AYNI `composeStore.submit()` metodunu çağırmalı — iki farklı giriş noktasının kendi ayrı guard'ı OLMAMALI, guard store metodunun içinde merkezi olmalı.

### Pattern 4: Faz 3'e devredilecek genişleme noktası — `ActiveConversationStore`

**What:** Faz 2, `ChatScreen`'in Faz 3'te tam thread'e genişleyeceğini CONTEXT.md açıkça belirtiyor. Bunun için önerilen seam: `ActiveConversationStore` şu şekle sahip olmalı:

```typescript
interface MessageVM {
  id: string;              // client-side geçici id (optimistic) veya sunucu comment id'si
  direction: "own" | "incoming"; // Faz 2 SADECE "own" üretir
  body: string;
  status: "pending" | "sent" | "failed"; // Faz 3'te "incoming" mesajlar hep "sent"
  createdAt: number;
}

class ActiveConversationStore {
  ticketKey: string | null = null;
  recipientLabel = "";      // isim varsa isim, yoksa e-posta — chat header'da kullanılır
  subject = "";
  messages: MessageVM[] = [];

  // Faz 2: tek optimistic mesaj başlatır + createTicket POST'unu bekler
  startNew(recipientLabel: string, subject: string, body: string) { /* ... */ }
  resolveSent(messageId: string) { /* ... */ }
  markFailed(messageId: string) { /* ... */ }
  retry(messageId: string) { /* ... */ }

  // Faz 3 buraya ekleyecek: open(ticketKey) [getTicket ile geçmişi hidrasyonu],
  // reply(body), close(), reopen(), poll() — Faz 2 bunları YAZMAZ, sadece yer açar.
}
```

`MessageBubble` bileşeni `direction` prop'unu Faz 2'den itibaren alır (her zaman `"own"` geçilir) — böylece Faz 3, bileşeni yeniden yazmadan `"incoming"` varyantını (sol hizalı, `bg-card`, UI-SPEC'te zaten not edilmiş) ekleyebilir.

**Subject/recipient echo kuralı:** `ChatScreen`'in başlığı (`{recipient} · {subject}`), sunucudan tekrar OKUNMAZ — compose formunda zaten bilinen `recipientLabel`/`subject` değerleri doğrudan `ActiveConversationStore`'a taşınır (bkz. Common Pitfalls #6, subject'in `GET /tickets/{key}` üzerinden asla geri okunamaması).

### Pattern 5: Navigasyon — bugün HİÇ yok, bu fazda ilk kez kuruluyor

**What:** `app.tsx` şu an sabit olarak `<ConversationsListScreen />` render ediyor — list/compose/chat arasında geçiş yapan hiçbir state makinesi yok. Faz 1'in "screen-swap" terminolojisi yalnızca loading→list geçişini (bir `boolean`) kapsıyordu.

```typescript
// src/store/panel-navigation-store.ts
type PanelScreen = "list" | "compose" | "chat";

class PanelNavigationStore {
  screen: PanelScreen = "list";

  openCompose() { this.screen = "compose"; }

  /** D-02: dirty ise true döner (çağıran ConfirmDialog açar), boşsa direkt kapatır. */
  requestBack(isDirty: boolean): boolean {
    if (isDirty) return true; // "confirm gerekli" sinyali
    this.screen = "list";
    return false;
  }

  confirmDiscardAndReturnToList() { this.screen = "list"; }

  /** D-03: grispi-context'in aktif talep değişimini tüketir (app.tsx'te bir useEffect ile bağlanır). */
  handleParentTicketChanged(isDirty: boolean): "closed-silently" | "needs-confirm" | "no-op" {
    if (this.screen !== "compose") return "no-op";
    if (!isDirty) { this.screen = "list"; return "closed-silently"; }
    return "needs-confirm"; // çağıran taraf ConfirmDialog'u D-03 copy'siyle açar
  }
}
```

`app.tsx`, `useGrispi().ticket?.key` değişimini bir `useEffect` ile `panelNav.handleParentTicketChanged(composeStore.isDirty)`'e bağlar — MobX store'ları React context'i doğrudan okuyamadığı için bu köprü component seviyesinde kalmalı (Faz 1'in `ConversationsListScreen`'deki `useEffect(() => store.load(ticket.key), [ticket?.key])` ile aynı köprüleme deseni).

### Anti-Patterns to Avoid

- **İki ayrı e-posta format regex'i (biri "kullan" satırı için, biri submit-guard için):** Tek bir `isValidEmail()` saf fonksiyonu kullan (`src/lib/side-conversation.ts`), her iki yerde de İMPORT et — regex'ler zamanla driftler.
- **Debounce'u tek başına yeterli sanmak:** 300ms debounce, art arda tuşlara basmayı engeller ama YAVAŞ bir isteğin geç gelip YENİ bir isteğin sonucunu ezmesini engellemez. Generation-guard şart (Pattern 1).
- **`disabled` prop'una güvenerek reentrancy guard yapmak:** Pattern 3'e bakın — guard store metodunun içinde olmalı.
- **ChatScreen'in subject/recipient'ı sunucudan tekrar okuması:** Pattern 4/Common Pitfalls #6 — gereksiz ve potansiyel olarak YANLIŞ (subject `GET /tickets/{key}`'de hiç yok).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP hata ayrımı (network vs server) | Yeni bir error-type sistemi | `NetworkError`/`HttpError` (`http-handler.ts`) — zaten var | Faz 1 T-01/CORE-03 ile tutarlılık; `ErrorCard`'ın ternary'si zaten bu iki tipi biliyor |
| Agent-vs-harici yazar ayrımı (Faz 3'e hazırlık) | Yeni bir "kimin mesajı" heuristiği | `creator.role.authority !== "ROLE_END_USER"` (Faz 1'de CONFIRMED live) | `teamUser` tek başına güvenilmez (entegrasyon/AI kullanıcılar `teamUser:false` döner) — bu zaten keşfedildi, tekrar keşfetmeye gerek yok |
| E-posta format doğrulama | RFC 5322 tam uyumlu karmaşık regex | Basit, tek-kaynak `isValidEmail()` (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/` benzeri) | Sunucu (`ts.requester`) zaten gerçek doğrulamayı yapıyor; client-side kontrol yalnızca UX için — aşırı sıkı regex geçerli adresleri reddedebilir |
| Yorum gövdesinin render'ı (optimistic balon + Faz 3'ün incoming mesajları) | `dangerouslySetInnerHTML` | React text interpolation (`{message.body}`) | Faz 1'in T-01 güvenlik kararıyla birebir aynı (harici/güvenilmeyen içerik asla HTML olarak render edilmez) |
| Stale-request iptali | `AbortController` + yeni bir iptal deseni | Generation-counter (Pattern 1) | Projede zaten TEK bir iptal deseni var (Faz 1), ikinci bir desen tutarsızlık yaratır |

**Key insight:** Bu fazın çoğu "don't hand-roll" kalemi aslında "Faz 1'de zaten çözülmüş problemi yeniden çözme" riskiyle ilgili — yeni bir kütüphane değil, **mevcut kod tabanındaki established pattern'lerin reuse'u** asıl korunması gereken şey.

## Common Pitfalls

### Pitfall 1: `ts.subject` alanı "zorunlu" ama D-10 subject'in boş gönderilebileceğini söylüyor
**What goes wrong:** Resmi OpenAPI metni, `fields` dizisi için "`ts.subject` alanının girilmesi zorunludur" diyor [CITED: public-api-v1.yml satır 408] — ama D-10, temsilci subject'i boşaltırsa gönderimin ENGELLENMEMESİNİ istiyor.
**Why it happens:** "Alan girilmeli" (field entry mevcut olmalı) ile "alanın değeri boş olamaz" farklı şeyler — dokümantasyon hangisini kastettiğini netleştirmiyor.
**How to avoid:** `fields` dizisine HER ZAMAN bir `{key: "ts.subject", value: <subject ya da "">}` girdisi koy — anahtarı hiç OMIT etme, değeri boş string olabilir. Bu hem "alan zorunlu" kısıtını (girdi var) hem D-10'u (değer boş olabilir) karşılar.
**Warning signs:** `fields` dizisinden `ts.subject` girdisini tamamen çıkarırsan ve API 400 dönerse, bu pitfall'a düşülmüş demektir — canlı-probe checkpoint'te BOŞ subject'li bir deneme de yapılmalı.

### Pitfall 2: `publicVisible` — resmi dokümantasyon TERS anlatıyor (D-13'ün en kritik riski)
**What goes wrong:** OpenAPI metni: "`true` gönderilirse eklenen yorum **dahili not** olur... yalnızca temsilciler görür" [CITED: public-api-v1.yml satır 427-431]. Bu dokümana güvenip `publicVisible: false` gönderirsen, mesaj HİÇBİR ZAMAN alıcıya gitmez — ama görünüşte hata da vermez (200/201 döner), sessiz bir COMP-04 ihlali olur.
**Why it happens:** Grispi'nin resmi API dokümanı bu alanın anlamını tersten yazmış; canlı davranış dokümantasyonun söylediğinin tam tersi.
**How to avoid:** **HER ZAMAN `publicVisible: true` gönder** (alıcıya e-posta gitmesi isteniyorsa — ki bu fazın TEK senaryosu). Bu, Faz 1'in canlı probe'unda (`01-02-probe-findings.md` madde 6) zaten doğrulandı: "canlı davranış `true` = public yorum, `false` = dahili not."
**Warning signs:** UAT'ta alıcının e-postası hiç gelmiyor ama API 2xx dönüyor → bu alanı kontrol et.

### Pitfall 3: Temsilcinin (agent) e-posta kimliği hiçbir yerde tutulmuyor — `creator` alanı zorunlu
**What goes wrong:** `CommentRequest.creator` ZORUNLU bir alan (`[{key:"us.email", value:<agent-email>}]`) [CITED: public-api-v1.yml satır 414-443] — ama bugünkü `GrispiContext` (`src/contexts/grispi-context.tsx`) yalnızca `tenantId`/`token`/`settings`/aktif `ticket` tutuyor. `bundle.context.agent` (tip zaten `grispi.type.ts`'te `Agent {id, fullName, email, phone}` olarak TANIMLI ama hiçbir yerde state'e YAZILMIYOR) hiç kaydedilmiyor.
**Why it happens:** Faz 1 salt-okunur olduğu için agent kimliğine hiç ihtiyaç duymadı; `bootstrapPluginInit` yalnızca `bundle.context.tenantId`/`token`'ı ve `bundle.settings`'i tüketiyor, `bundle.context.agent`'ı görmezden geliyor.
**How to avoid:** `GrispiContext`'e `agentEmail: string | null` ekle; `bootstrapPluginInit`'te `bundle.context.agent.email`'i buna yaz. **Standalone dev modunda** (`standalone-dev.ts`) bu bilgi HİÇ yok — `_init()` hiç çağrılmıyor. Yeni bir `REACT_APP_DEV_AGENT_EMAIL` env değişkeni (fallback: kullanıcının kendi Grispi hesabının e-postası, örn. Faz 1'in test verisinde geçen `davutkmbr@gmail.com`) eklenmeli, `resolveStandaloneDevConfig`'in dönüş tipine eklenmeli.
**Warning signs:** `createTicket` çağrısı `creator` alanı boş/undefined ile 400 dönerse veya standalone dev'de submit test edilemezse.

### Pitfall 4: Stale customer-search race — debounce tek başına yetmez
**What goes wrong:** Kullanıcı hızlıca "acme" yazıp sonra "acme corp" yazarsa, "acme" için giden istek ağda gecikip "acme corp"un sonucundan SONRA dönebilir — debounce bunu engellemez (debounce yalnızca İSTEK GÖNDERMEYİ geciktirir, YANIT SIRASINI garanti etmez).
**Why it happens:** Ağ gecikmesi deterministik değil; "son giden istek" ile "son gelen yanıt" aynı şey değildir.
**How to avoid:** Pattern 1'deki generation-counter — her yanıt işlenmeden önce hâlâ "en güncel arama" olup olmadığı kontrol edilir.
**Warning signs:** Kullanıcı hızla yazarken dropdown'da "yanlış" (daha eski aramaya ait) sonuçların yanıp söndüğü gözlenir.

### Pitfall 5: Retry (D-15) teorik olarak side ticket'ı iki kez oluşturabilir
**What goes wrong:** `createTicket` başarısız görünüp (timeout/network error) "Tekrar dene" AYNI POST'u yeniden atarsa, ama orijinal istek aslında sunucuda BAŞARIYLA işlenmiş ama yanıt client'a hiç ulaşmamışsa (klasik "at-least-once" sorunu), iki side ticket oluşabilir.
**Why it happens:** API'de idempotency-key desteği dokümante edilmiş değil (`public-api-v1.yml`'de böyle bir header/param yok).
**How to avoid:** D-15 zaten kilitli bir karar (aynı POST'u yeniden at) — bu riski TAMAMEN ortadan kaldıracak bir mekanizma yok. Planner bunu **kabul edilmiş bir risk** olarak not düşmeli; istenirse v2 fikri olarak "client-generated idempotency marker" (örn. mesaj gövdesine görünmez bir UUID iliştirme, sonra advanced-search'te aynı parent+UUID kombinasyonunu arama) düşünülebilir ama bu fazın kapsamına girmez.
**Warning signs:** UAT sırasında bilinçli olarak bir "yavaş ağ" simülasyonuyla retry testi yapılırsa ve listede aynı alıcıya 2 side ticket görülürse.

### Pitfall 6: ChatScreen başlığını `GET /tickets/{key}` üzerinden okumaya çalışmak
**What goes wrong:** Yeni oluşturulan side ticket'ın subject'ini/recipient'ini göstermek için sunucudan tekrar okumaya çalışırsan, Faz 1'in zaten kanıtladığı gerçekle karşılaşırsın: `ts.subject` full-ticket `fieldMap`'inde HİÇ YOK (`01-02-SUMMARY.md`: "ts.subject doesn't exist as a fieldMap key at all"), yalnızca `advancedSearch`'ün lean summary'sinde (`summary.subject`) inline geliyor.
**Why it happens:** create-time yazma alanı (`fields[].key === "ts.subject"`) ile read-time görünürlük alanı (`summary.subject`) simetrik değil — Grispi'nin API'si burada asimetrik.
**How to avoid:** Pattern 4 — `ChatScreen`'in başlığı hiç API'ye gitmeden, compose formunda zaten bilinen `recipientLabel`/`subject` değerlerinin client-side echo'sudur.
**Warning signs:** `getTicket(newTicketKey)` çağrısı yapıp `.fieldMap["ts.subject"]` okumaya çalışan kod — bu her zaman `undefined` dönecektir.

### Pitfall 7: `/customers/search` ve `POST /tickets`'in 201 yanıt şekli tamamen doğrulanmamış
**What goes wrong:** OpenAPI, `/customers/search` için YALNIZCA query param'ları dokümante ediyor (`searchTerm`/`orderBy`/`size`/`page`), response şeması YOK ("200: Başarılı yanıt" — başka hiçbir detay yok) [CITED: public-api-v1.yml satır 165-167]. Aynı şekilde `POST /tickets`'in 201 yanıtı da yalnızca "oluşturulan talep döner" diyor, şema vermiyor [CITED: aynı dosya satır 69-72]. `RecipientField`'ın "isim + e-posta" render'ı (D-06) ve `ChatScreen`'in yeni ticket key'e yönlendirmesi, bu iki yanıtın gerçek şekline bağımlı.
**Why it happens:** Bu iki uç nokta (advanced-search/users gibi) OpenAPI'de tam dokümante değil — CONTEXT.md'nin zaten uyardığı "spec bazı endpoint'leri belgelemiyor" durumunun bir uzantısı.
**How to avoid:** Plan 02'yi Faz 1'deki gibi bir **canlı-probe checkpoint task'ı** ile aç: gerçek tenant'ta bir `GET /customers/search?searchTerm=<bilinen-bir-isim>` ve bir `POST /tickets` (test verisi ile) çağrısı yap, ham JSON'ı yakala, `Customer`/`CreateTicketResponse` tiplerini buna göre yaz.
**Warning signs:** `grispi.type.ts`'te bu iki yanıt için `any`/tahmini tipler kullanılıyorsa ve hiç canlı doğrulama yapılmadıysa.

## Code Examples

### `createTicket` istemci metodu (`tickets.ts`'e eklenecek)

```typescript
// Source: canonical_refs (01-02-probe-findings.md) + public-api-v1.yml TicketRequest şeması
export interface CreateTicketRequest {
  comment: {
    body: string;
    publicVisible: true; // D-13 — HER ZAMAN true, bkz. Common Pitfalls #2
    creator: [{ key: "us.email"; value: string }]; // agent e-postası, bkz. Common Pitfalls #3
  };
  fields: Array<{ key: string; value: string }>;
  // fields İÇİNDE olması gereken üç girdi:
  //   { key: "ts.subject", value: subject ?? "" }               (Common Pitfalls #1 — hiç omit etme)
  //   { key: "ts.requester", value: `:${recipientEmail}` }      (colon-prefix — Faz 1 CONFIRMED live)
  //   { key: "tu.side_conversation_parent", value: parentTicketKey }
}

async createTicket(body: CreateTicketRequest) {
  return this.http.send<Ticket /* CANLI DOĞRULANMALI — bkz. Common Pitfalls #7 */>(
    "public/v1/tickets",
    {
      method: "POST",
      cache: "no-cache",
      headers: this.auth.headers,
      body: JSON.stringify(body),
    }
  );
}
```

### `ts.requester` colon-prefix biçimlendirici (tek-kaynak yardımcı fonksiyon)

```typescript
// Source: 01-02-probe-findings.md EK BULGULAR #3 — "ts.requester serileştirme formatı: id:email[:phone]"
// Yeni bir alıcı için yalnızca e-posta biliniyorsa format ":email" (baştan iki nokta).
export function formatRequesterField(email: string): string {
  return `:${email}`;
}
```

### Subject prefill (D-08/D-09) — saf fonksiyon

```typescript
// Source: D-08 — "[<TALEP_ANAHTARI>] <Talep Başlığı>"
export function formatPrefillSubject(ticketKey: string, ticketTitle: string): string {
  return `[${ticketKey}] ${ticketTitle}`.trim();
}
```

## State of the Art

| Old Approach (Faz 1) | Current Approach (Faz 2) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tek ekran (`ConversationsListScreen`), navigasyon yok | 3 ekranlı state machine (`PanelNavigationStore`) | Bu faz | `app.tsx`'in kökten değişmesi gerekiyor — artık koşullu render var |
| Salt-okunur API istemcileri (`advancedSearch`, `getTicket`, `getUser`) | Yazma istemcileri eklenir (`createTicket`, `customers.search`) | Bu faz | `GrispiAPI` fasadına yeni bir `customers` üyesi eklenir |
| Generation-guard yalnızca liste yüklemede kullanılıyordu | Aynı desen arama + submit'e de uygulanıyor | Bu faz | Yeni bir iptal stratejisi İCAT ETMEK yerine mevcut deseni genişletmek |

**Deprecated/outdated:** Yok — bu proje henüz v1 öncesi, "eski yaklaşım" kavramı henüz oluşmadı.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `POST /tickets`'in 201 yanıtı `Ticket`'a benzer bir obje döner ve `.key` alanı içerir | Code Examples, Common Pitfalls #7 | ChatScreen'in hangi ticket'a yönleneceğini bilemez; canlı probe ile netleşmeli |
| A2 | `/customers/search`'ün yanıt zarfı `advancedSearch` ile aynı `{content, totalPages, pageNumber,...}` şeklinde | Pattern 1 code example | `response.content` erişimi kırılır, dropdown boş görünebilir; canlı probe şart |
| A3 | Müşteri kaydı objesi `fullName`/`email` (veya `emails[]`) alanlarını taşır (mevcut `User` tipine benzer) | D-06 fallback, Don't Hand-Roll | "İsim yoksa e-posta" fallback'i yanlış alan adına bakabilir |
| A4 | Ayrı bir `POST /customers` çağrısına gerek yok — `ts.requester:email` yeni kullanıcıyı otomatik oluşturuyor | Standard Stack "Not" | Yanlışsa, kayıtsız e-postalarda `createTicket` sessizce başarısız/eksik requester ile sonuçlanabilir |
| A5 | `bundle.context.agent.email`, `creator`'a yazılacak doğru/beklenen e-posta | Common Pitfalls #3 | Yanlış agent kimliği yorumun creator'ına yazılırsa, Grispi tarafında yanlış kullanıcı adına yorum görünebilir |

**Not:** A1-A5 hepsi, Plan 02'nin önerilen canlı-probe checkpoint task'ı (Primary recommendation) ile TEK oturumda doğrulanabilir/düzeltilebilir — Faz 1'in Plan 02/Task 1'i ile birebir aynı desen.

## Open Questions

1. **`POST /tickets` çok parçalı (`multipart/form-data`) mı yoksa `application/json` mı kullanılmalı?**
   - What we know: Uç nokta ikisini de kabul ediyor; dosya eki YOKSA `application/json` yeterli [CITED: public-api-v1.yml satır 47-49, "ek dosya gönderilecekse multipart/form-data kullanılır"].
   - What's unclear: Hiçbir şey — bu faz dosya eki içermiyor (COMP-05 Faz 4'te).
   - Recommendation: `application/json` kullan, `HttpHandler`'ın mevcut `Content-Type: application/json` header'ı zaten bunun için kurulu.

2. **`channel` alanı ticket oluştururken hiç belirtilmiyor — sorun olur mu?**
   - What we know: `TicketRequest` şemasında `channel` diye bir top-level property YOK; yalnızca `comment`+`fields` var.
   - What's unclear: Grispi backend'i side ticket'ın kanalını nasıl belirliyor (muhtemelen `publicVisible:true` + e-posta requester kombinasyonundan "EMAIL" olarak türetiyor, PROJECT.md'nin "e-posta Grispi native mail kanalından akar" notuyla tutarlı).
   - Recommendation: Canlı probe'da oluşan ticket'ın `channel` alanına bakılıp gerektiğinde not düşülsün; bloklayıcı değil.

3. **`/customers/search`'ün `size`/`page` varsayılanları (100/0) bu panel için uygun mu?**
   - What we know: OpenAPI varsayılanı `size=100` — 372px'lik bir dropdown için aşırı büyük bir sayfa.
   - What's unclear: Performans/UX açısından daha küçük bir `size` (örn. 10) istemekte bir sakınca var mı (API'nin `size` üst sınırı dokümante değil).
   - Recommendation: Planner `size=10` ile başlasın (CONTEXT.md'nin discretion alanı zaten bunu planner'a bırakmış), canlı probe'da doğrulanacak.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/test (craco) | ✓ | v22.12.0 | — |
| npm | Paket yönetimi | ✓ | 11.7.0 | — |
| Grispi test tenant (`gsocial-test`) canlı erişimi | createTicket/customers.search canlı-probe checkpoint'i | ✓ (Faz 1'de kuruldu, `.env.development.local` mevcut) | — | Standalone dev mode + gerçek token (Faz 1 D-16/17/18 ile aynı) |
| `bundle.context.agent` (plugin/iframe modu) | `creator` alanı | ✓ (SDK bridge'de mevcut, kodda henüz tüketilmiyor — Pitfall #3) | — | Standalone dev'de YOK → yeni `REACT_APP_DEV_AGENT_EMAIL` env değişkeni gerekir |

**Missing dependencies with no fallback:** Yok.
**Missing dependencies with fallback:** `bundle.context.agent` standalone dev modunda yok — `REACT_APP_DEV_AGENT_EMAIL` fallback'i planlanmalı (Pitfall #3).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (react-scripts/craco `test`, CRA-bundled) [VERIFIED: package.json scripts + craco.config.js `jest.configure`] |
| Config file | `craco.config.js` (`jest.configure` → `moduleNameMapper` için `@/*` alias) + CRA'nın gömülü jest config'i |
| Quick run command | `CI=true npx craco test --watchAll=false --testPathPattern=<dosya-adı>` |
| Full suite command | `CI=true npm test -- --watchAll=false` |

**Not:** `@testing-library/react`/`jest-dom`/`user-event` `package-lock.json`'da mevcut (react-scripts'in transitive bağımlılığı) ama HİÇBİR mevcut test dosyası bunları import etmiyor — proje şimdiye kadar yalnızca store/lib seviyesinde saf-fonksiyon/mock-API testleri yazdı (component render testi hiç yok). Bu fazın önerilen testleri de bu konvansiyonu sürdürüyor: yeni UI bileşenlerinin (RecipientField dropdown durumları, ConfirmDialog, MessageBubble) render/etkileşim testleri yerine, altındaki **store mantığını** (ComposeStore, ActiveConversationStore, PanelNavigationStore) test etmek — Faz 1'in `side-conversations-store.test.ts`'i ile aynı mock-API deseniyle (`jest.mock("@/grispi/client/api", ...)`).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMP-01 | "+" ile compose açılır, boş formda geri onaysız döner | unit (PanelNavigationStore state transitions) | `craco test --testPathPattern=panel-navigation-store` | ❌ Wave 0 |
| COMP-02 | Debounce+generation-guard ile arama; geçersiz e-postada "kullan" satırı yok | unit (fake timers + mocked `grispiAPI.customers.search`) | `craco test --testPathPattern=compose-store` | ❌ Wave 0 |
| COMP-03 | `[<KEY>] <Başlık>` prefill, düzenlenebilir, üzerine yazılmıyor | unit (`formatPrefillSubject` saf fonksiyon) | `craco test --testPathPattern=side-conversation` | ❌ Wave 0 (mevcut `side-conversation.test.ts`'e eklenir) |
| COMP-04 | `createTicket` başarı/hata; retry aynı POST'u yeniden atar; double-submit guard | unit (mocked `grispiAPI.tickets.createTicket`) | `craco test --testPathPattern=compose-store` | ❌ Wave 0 |
| SYNC-02 | Submit sonrası `sideConversationsStore.load(parentKey)` çağrılır (spy assertion) | unit (spy on `SideConversationsStore.load`) | `craco test --testPathPattern=compose-store` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** İlgili test dosyasının `--testPathPattern`'i (yukarıdaki komutlar)
- **Per wave merge:** `CI=true npm test -- --watchAll=false` (tüm suite)
- **Phase gate:** `/gsd-verify-work` öncesi tüm suite yeşil

### Wave 0 Gaps
- [ ] `src/store/__tests__/compose-store.test.ts` — arama debounce/generation-guard, submit başarı/hata/retry, double-submit guard
- [ ] `src/store/__tests__/panel-navigation-store.test.ts` — ekran geçişleri, D-02/D-03 dirty-guard dönüşleri
- [ ] `src/store/__tests__/active-conversation-store.test.ts` — optimistic mesaj yaşam döngüsü (pending→sent/failed→retry)
- [ ] `src/lib/__tests__/side-conversation.test.ts` (mevcut dosyaya ekleme) — `formatPrefillSubject`, `formatRequesterField`, `isValidEmail`
- [ ] **Yeni teknik:** `jest.useFakeTimers()` — bu proje şimdiye kadar hiç fake timer kullanmadı (debounce testi için gerekli); ilk kullanımda `jest.useRealTimers()` ile temizlik (afterEach) eklenmeli

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Hayır | Token, bundle'dan gelir; bu faz yeni bir auth yüzeyi eklemiyor (Faz 1'in `Authentication`/`HttpHandler` değişmiyor) |
| V3 Session Management | Hayır | Değişiklik yok |
| V4 Access Control | Kısmen | `tu.side_conversation_parent` her zaman `useGrispi().ticket.key` (trusted context) üzerinden set edilir — HİÇBİR kullanıcı-girdisi (recipient/subject/message) parent linkage'ı etkileyemez (IDOR benzeri riski önler) |
| V5 Input Validation | Evet | Tek-kaynak `isValidEmail()` (client-side UX katmanı); mesaj/subject render'ı SADECE React text interpolation (asla `dangerouslySetInnerHTML`, Faz 1 T-01 ile tutarlı) |
| V6 Cryptography | Hayır | Yeni kripto işlemi yok |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Optimistic/gelen mesaj gövdesinin HTML olarak render edilmesi (XSS) | Tampering / Information Disclosure | React text interpolation ONLY — `MessageBubble` asla `dangerouslySetInnerHTML` kullanmamalı (Faz 1 T-01 kararının Faz 2/3'e taşınması) |
| Client-taraflı `tu.side_conversation_parent` manipülasyonu (yanlış talebe side ticket bağlama) | Spoofing / Tampering | Parent key HER ZAMAN `useGrispi().ticket.key`'den (SDK bridge/trusted context) okunur, hiçbir form alanından türetilmez |
| API hata gövdesinin (`HttpError.body`) kullanıcıya/console'a sızması | Information Disclosure | Faz 1'in V7 kararı: `error.body`/`status` asla end-user'a render edilmez ya da loglanmaz; `MessageBubble`'ın "Gönderilemedi" copy'si jenerik kalır (D-15) |
| Subject alanına (tek satırlı `<Input>`) newline/header-injection karakterleri | Tampering (e-posta header injection, sunucu tarafı sorumluluğu) | `<input type="text">` doğası gereği çok satırlı girişi engeller (defense-in-depth); asıl sanitizasyon Grispi backend'inin sorumluluğu |

## Sources

### Primary (HIGH confidence — doğrudan mevcut kaynak/repo okuması)
- `.planning/phases/01-temel-ve-salt-okunur-g-r-me-listesi/01-02-probe-findings.md` — `POST /tickets` gövde şekli, `ts.requester` colon-prefix formatı, `publicVisible` ters-anlam düzeltmesi (canlı doğrulandı)
- `src/grispi/client/{tickets,users,api,http-handler,authentication}.ts` — mevcut istemci deseni
- `src/store/side-conversations-store.ts` — generation-guard deseni (Pattern 1'in kaynağı)
- `src/contexts/{grispi-context,plugin-bootstrap}.tsx` — agent kimliği eksikliğinin (Pitfall #3) doğrudan kanıtı
- `src/lib/standalone-dev.ts` — standalone dev modunun agent kimliği taşımadığının kanıtı
- `src/types/grispi.type.ts` — `Agent`/`Context`/`Ticket` tiplerinin mevcut (ama kullanılmayan) şekli
- `src/App.tsx` (`app.tsx`) — navigasyon state machine'inin bugün HİÇ var olmadığının doğrudan kanıtı

### Secondary (MEDIUM confidence — resmi dokümantasyon, doğrudan okundu ama canlı doğrulanmadı)
- `github.com/grispiapp/api-docs` `master/public-api-v1.yml` (`curl` ile ham metin okundu, LLM özetleyici kullanılmadı) — `TicketRequest`/`CommentRequest`/`Creator`/`UserIdentifierField`/`TicketField` şemaları, `/customers/search` query param'ları, `publicVisible` ve `ts.subject` üzerine yazılı (ve bir kısmı YANLIŞ/TERS) açıklamalar

### Tertiary (LOW confidence — bu oturumda araç-tabanlı `classify-confidence` çıktısı `webfetch`/`websearch` sağlayıcılarını LOW olarak sınıflandırdı)
- İlk `WebFetch` çağrısı (LLM-özetleyici üzerinden) — bulguları doğrulamak için ayrıca ham YAML `curl` ile indirilip elle okundu; nihai claim'ler ham metne dayanıyor, LLM özetine değil

## Metadata

**Confidence breakdown:**
- Standard stack (yeni paket yok): HIGH — package.json doğrudan okundu, hiçbir yeni bağımlılık önerilmiyor
- API sözleşmesi (createTicket/customers.search): MEDIUM — resmi OpenAPI metni ham okundu ama canlı `POST /tickets`/`GET /customers/search` denemesi bu oturumda YAPILMADI (Faz 1'in probe'u yalnızca advanced-search/getTicket/users içindi)
- Mimari (store/component yapısı, navigasyon eksikliği, agent-kimlik eksikliği): HIGH — doğrudan mevcut kaynak kodu okunarak tespit edildi
- Pitfalls: HIGH (agent-kimlik eksikliği, navigasyon eksikliği, publicVisible ters-anlamı) / MEDIUM (ts.subject zorunluluk nüansı, retry çift-oluşturma riski — ikisi de canlı probe ile netleşecek)

**Research date:** 2026-07-23
**Valid until:** Plan 02'nin canlı-probe checkpoint'i tamamlanana kadar geçerli — o checkpoint A1-A5 (Assumptions Log) claim'lerini CONFIRMED/CORRECTED'e çevirmeli, tıpkı Faz 1'in Plan 02/Task 1'inin yaptığı gibi.
