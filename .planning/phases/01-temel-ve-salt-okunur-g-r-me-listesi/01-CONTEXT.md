# Phase 1: Temel ve Salt Okunur Görüşme Listesi - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Panel, aktif talebe bağlı yan görüşmeleri (side ticket'ları) rozetleriyle, doğru sırayla ve gerektiğinde sayfalanmış olarak gösterir; boş durum, yükleme, hata ve talep-değişimi durumları anlaşılır şekilde ele alınır. Salt okunur: yazma akışları (compose Faz 2, yanıt/kapatma Faz 3, polling/ekler Faz 4) bu fazın DIŞINDA.

</domain>

<decisions>
## Implementation Decisions

### Field şeması ve tespit
- **D-01:** TEK custom field: `tu.side_conversation_parent` (TEXT). Değeri parent ticket key'i (örn. `DESTEK-1042`). Side ticket tespiti = bu field'ın dolu olması.
- **D-02:** Key SABİTTİR ve koda gömülür — settings'ten okunmaz. Field, plugin tenant'a kurulurken Grispi tarafından OTOMATİK oluşturulacak (kullanıcı kararı, 22 Tem 2026). Bu, önceki "key'ler settings'ten okunur" kararının revizyonudur; REQUIREMENTS.md CORE-01 ve PROJECT.md Key Decisions buna göre güncellendi.
- **D-03:** Listeleme sorgusu YALNIZCA `{fieldKey: "tu.side_conversation_parent", operator: "EQUAL", value: "<parentKey>"}` koşuluyla çalışır. Channel gibi doğrulanmamış ek koşullar EKLENMEZ.
- **D-04:** Ayrı bir "kurulum uyarısı" ekranı YOK (field varlığı kurulumla garanti). Olağandışı hatalar genel hata deneyimine (D-11) düşer.

### Rozet kuralları ve durum türetme
- **D-05:** Rozetler: `Yeni yanıt` (son public yorum karşı taraftan VE görülmemiş), `Yanıt bekleniyor` (son public yorum temsilciden), `Kapalı` (ts.status SOLVED **veya** CLOSED). Kapalılar listede kalır — tarihçe panelden erişilebilir.
- **D-06:** Durum türetmede yalnızca `publicVisible: true` yorumlar sayılır; internal notlar rozeti ve sırayı ETKİLEMEZ.
- **D-07:** İlk açılış / görülme kaydı yokken (localStorage boş): son mesajı karşı taraftan olan açık görüşmeler `Yeni yanıt` görünür — güvenli taraf, bekleyen yanıt gizlenmez.
- **D-08:** Sıralama üç grup: Yeni yanıt → açıklar (Yanıt bekleniyor) → Kapalılar; her grup kendi içinde son aktiviteye göre azalan.

### Liste verisi ve satır içeriği
- **D-09:** Tam satır korunur (alıcı · göreli zaman · konu · son mesaj özeti · rozet — onaylı mockup'taki gibi). advanced-search dönüşü yetersizse ticket başına `GET /tickets/{key}` PARALEL atılır ve cache'lenir (sayfa başına max 10 ek istek kabul edildi).
- **D-10:** Göreli zaman ve son-aktivite sıralamasının kaynağı SON PUBLIC YORUMUN zamanıdır (ticket updatedAt DEĞİL). Zaman formatı mockup'taki gibi: "12 dk", "3 sa", "Dün", "12 Tem".
- **D-11:** Hata deneyimi katmanlı: advanced-search düşerse tam alan hata kartı (Türkçe mesaj + "Yeniden dene" butonu). Satır-detay isteklerinin bir kısmı düşerse liste yine render edilir; etkilenen satırlar özetsiz/soluk gösterilir ve sessizce yeniden denenir. Not: mevcut `http-handler` hataları yutup `null` dönüyor — hata ayrımı için elden geçirilmesi gerekir (planner detaylandırır).
- **D-12:** Sayfalama: liste sonunda "Daha fazla yükle" butonu (size=10, page artar). Sonsuz kaydırma YOK.

### Faz 1 ekran davranışları
- **D-13:** Compose Faz 2'de geleceği için "+" butonu ve boş durum CTA'sı Faz 1'de GÖRÜNÜR + DEVRE DIŞI, "Çok yakında" tooltip/aria açıklamasıyla. Faz 2'de yalnızca enable edilir — layout zıplaması olmaz.
- **D-14:** İlk yüklemede 3 adet skeleton satır kartı. "Daha fazla yükle" beklerken buton spinner'a döner. Starter'ın roket LoadingScreen'i yalnızca bundle init aşamasında kalır.
- **D-15:** Talep değişiminde (currentTicketUpdated) liste ANINDA boşalır + skeleton görünür; yeni talebin verisi gelince dolar. Eski talebin verisi bir an bile gösterilmez.

### Test ve doğrulama düzeni
- **D-16:** Test Davut'un kendi tenant'ında; `tu.side_conversation_parent` field'ını geliştirme sürecinde admin panelinden Davut oluşturacak. API token aynı tenant'tan.
- **D-17:** Test side ticket'ları ELLE oluşturulacak (Davut). Sayfalama (LIST-06) doğrulaması için 11+ side ticket ve rozet çeşitliliği (açık/yanıtlı/kapalı) gerekir — plan doğrulama adımında bu ön koşul açıkça listelenmeli.
- **D-18:** Geliştirme akışı ikili: günlük geliştirme localhost'ta mock bundle ile (README'deki GrispiClient comment-out yöntemi) + gerçek API token'ıyla canlı istekler; faz sonu doğrulama gerçek Grispi panelinde.

### Claude's Discretion
- Skeleton kartların birebir tasarımı, hata kartı metinlerinin son hâli, "Daha fazla yükle" buton yerleşimi — mockup'un dilini koruyarak planner/executor karar verir.
- Satır-detay isteklerinin cache stratejisi (süre, invalidation) ve sessiz retry politikası — planner belirler.
- Mock bundle'ın yapısı (fixture dosyası vs inline) — planner belirler.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Ürün ve gereksinimler
- `.planning/PROJECT.md` — Proje bağlamı, kilitli mimari kararlar (side-ticket modeli, e-posta davranışı), kısıtlar
- `.planning/REQUIREMENTS.md` — Faz 1 gereksinimleri: CORE-01..03, LIST-01..06 (CORE-01 bu tartışmayla revize edildi: sabit key + kurulumda otomatik field)
- `.planning/ROADMAP.md` — Faz sınırı ve başarı kriterleri

### API ve domain araştırması
- `.planning/research/SUMMARY.md` — Grispi Public API yüzeyi (advanced-search payload/operatörleri, ts.status ID'leri, endpoint listesi), Zendesk modeli, kritik tuzaklar. advanced-search dönüş şemasının DOĞRULANMASI Faz 1 araştırmasının işi — dönen alanlara göre D-09'daki ek-istek ihtiyacı netleşir.

### UI referansı
- https://claude.ai/code/artifact/cb7e4939-3602-4f44-a029-bda1ac772ae1 — Onaylı UI mockup'ı (4 ekran). Faz 1 kapsamı: Liste + Boş durum ekranları. Liste satırı anatomisi, rozet renkleri (amber/yeşil/slate), mor okunmamış rayı, mono adres/anahtar dizgisi buradan birebir alınır.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/screen.tsx` — Screen/ScreenHeader/ScreenTitle/ScreenContent: liste ekranının iskeleti hazır; ScreenHeader back butonunu destekliyor (Faz 1'de gerekmez)
- `src/components/ui/button.tsx`, `input.tsx` — shadcn-style; badge/skeleton benzeri küçük bileşenler aynı desenle eklenir
- `src/contexts/grispi-context.tsx` — bundle init + `currentTicketUpdated` aboneliği hazır; D-15'in tetikleyicisi bu callback
- `src/grispi/client/` — GrispiAPI/Authentication/HttpHandler/Tickets iskeleti; yeni endpoint metodları (advancedSearch vb.) `Tickets` sınıfına eklenir
- `src/store/` — MobX RootStore deseni kurulu; SideConversationsStore aynı desenle eklenir

### Established Patterns
- Router yok — ekranlar state ile değişir (diğer Grispi side plugin'leri de aynı); Faz 1'de tek ekran (liste) + durum varyantları
- Tema: mor primary `hsl(272 53% 37%)`, slate-50 zemin, text-xs/sm yoğunluk — mockup bu tokenlarla tasarlandı
- Import alias `@/`, prettier + tailwind class sıralaması mevcut yapılandırmada

### Integration Points
- `HttpHandler.send` şu an !ok durumunda `null` dönüyor — D-11'in katmanlı hata deneyimi için hata bilgisini taşıyacak şekilde genişletilmeli (breaking değişiklik değil; tek kullanıcı `getTicket`)
- `HttpHandler.baseUrl = api.grispi.net`, OpenAPI spec `api.grispi.com` diyor — starter çalıştığı bilinen .net'te kalınır; researcher isterse doğrular
- Bundle'dan gelen `context.ticketKey` aktif talebin anahtarı; advanced-search sorgusunun value'su bu

</code_context>

<specifics>
## Specific Ideas

- Liste satırı, rozetler, boş durum ve mikrocopy onaylı mockup'tan birebir alınacak — yeniden tasarım YOK. Boş durum metni: "Henüz yan görüşme yok" + "Tedarikçi ya da başka bir ekiple, talep sahibinin görmediği ayrı bir e-posta akışı başlatın."
- Gizlilik cümlesi ("Talep sahibi bu yazışmayı görmez") özelliğin kimliğidir — boş durumda mutlaka yer alır.
- advanced-search isteği: `POST /tickets/advanced-search`, body `{"anyConditions": [], "allConditions": [{"fieldKey": "tu.side_conversation_parent", "operator": "EQUAL", "value": "<aktif talep key>"}]}`, query param `size=10&page=N`.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Compose CTA'larının işlevi Faz 2'de, polling Faz 4'te — zaten roadmap'te.)

</deferred>

---

*Phase: 1-Temel ve Salt Okunur Görüşme Listesi*
*Context gathered: 2026-07-22*
