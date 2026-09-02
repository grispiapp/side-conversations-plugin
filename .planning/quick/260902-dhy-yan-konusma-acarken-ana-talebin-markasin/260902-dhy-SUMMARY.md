---
phase: quick-260902-dhy
plan: 01
status: complete
subsystem: api, ui
tags: [multibranding, ts.brand, side-conversations, compose, create-mutation]

requires:
  - phase: 04
    provides: create-mutation write path (POST /v2/tickets), ComposeStore submit seam, MutationEnvelope replay
provides:
  - Parent ticket's brand (`ts.brand`) is copied onto the side ticket at create time, so the outgoing mail leaves from that brand's default support address instead of the tenant default
  - `TICKET_BRAND_FIELD_KEY` + `brandIdOfTicket()` reader that degrades to null on the provisional (field-map-less) ticket
  - Single-shot 422 fallback that re-creates without `ts.brand` when the parent's brand was disabled after the fact
affects: [any-future-work-on-the-create-payload, phase-05-request-summary]

tech-stack:
  added: []
  patterns:
    - "Omit-when-empty on the create `fields` array (same rule as `comment.attachmentIds`): never send an empty value, send no key at all"
    - "Caller-supplied context value into a MobX store method (`agentEmail`/`parentKey`/`attachmentIds` precedent) rather than the store reading React context"
    - "Bounded single-retry on a COPY of the frozen envelope request, so manual replay still sends the original payload"

key-files:
  created: []
  modified:
    - src/lib/side-conversation.ts
    - src/lib/__tests__/side-conversation.test.ts
    - src/store/compose-store.ts
    - src/store/__tests__/compose-store.test.ts
    - src/screens/compose-screen.tsx
    - src/screens/__tests__/compose-screen.test.tsx
    - src/query/side-conversation-queries.ts
    - src/query/__tests__/side-conversation-queries.test.tsx

key-decisions:
  - "`ts.brand` is a Grispi SYSTEM field, not a plugin custom field — no plugin-install provisioning is involved and no settings key is read; the key is hard-coded exactly like `tp.side_conversation_parent` (D-01/D-02)"
  - "Brand id is read off the ALREADY-hydrated parent ticket (`useGrispi().ticket.fieldMap`), so propagation costs zero extra requests; `/field-values/ts.brand/options` is never called"
  - "Reply/patch write paths deliberately untouched — the brand persists on the ticket and grispi-api derives the reply sender address from it (TicketService:399)"
  - "422 is the only retried status, and only when the request actually carried `ts.brand`; the error body has no machine-readable code field, so the HTTP status is the only available signal"
  - "The RETRY's error propagates, not the original brand 422 — once the brand has been removed, the second failure is what is actually blocking the create (deviation from the 'raise the original' phrasing used while scoping; the plan's must_haves record the reasoning)"
  - "`submit()`'s new `brandId` parameter is defaulted to `null` so every pre-existing call site and test keeps compiling — the same widening rule `attachmentIds` established"

requirements-completed: [CORE-02]

coverage:
  - id: D1
    description: "`brandIdOfTicket` returns the trimmed brand id for a branded ticket and null for absent/null/blank values, the provisional field-map-less ticket, and null"
    requirement: CORE-02
    verification:
      - kind: unit
        ref: "src/lib/__tests__/side-conversation.test.ts#brandIdOfTicket"
        status: pass
    human_judgment: false
  - id: D2
    description: "The create payload carries `{key:'ts.brand', value:'<id>'}` for a branded parent and omits the key entirely for an unbranded one"
    requirement: CORE-02
    verification:
      - kind: unit
        ref: "src/store/__tests__/compose-store.test.ts#sends ts.brand when the parent ticket carries a brand (quick-260902-dhy)"
      - kind: unit
        ref: "src/store/__tests__/compose-store.test.ts#omits the ts.brand key entirely for an unbranded parent"
        status: pass
    human_judgment: false
  - id: D3
    description: "ComposeScreen forwards `brandIdOfTicket(ticket)` into `compose.submit`, passing null while the parent is still the provisional object"
    requirement: CORE-02
    verification:
      - kind: unit
        ref: "src/screens/__tests__/compose-screen.test.tsx#forwards the hydrated parent's brand id to submit (quick-260902-dhy)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A 422 on a brand-carrying create triggers exactly one retry with `ts.brand` filtered out; non-422 statuses, NetworkError, and brand-free requests are never retried; the envelope's own request keeps its brand"
    requirement: CORE-02
    verification:
      - kind: unit
        ref: "src/query/__tests__/side-conversation-queries.test.tsx#executeCreateMutation → disabled-brand fallback (quick-260902-dhy)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The create-time mail of a branded ticket leaves from that brand's default support address rather than the tenant default"
    requirement: CORE-02
    verification:
      - kind: other
        ref: "Live probe, preprod/gsocial-test 2026-09-02: POST /v2/tickets with fields ts.brand=1 → TICKET-651; GET public/v1/tickets/TICKET-651 → fieldMap['ts.brand'].value='1' and comments[0].attributes.fromAddress='adres1@gsocial-test.grispi.net' (Marka 1's default), not the tenant default 'support@gsocial-test.grispi.dev'"
        status: pass
    human_judgment: false
  - id: D6
    description: "A disabled brand is rejected before the ticket exists — no orphan ticket, no mail — which is what makes the retry safe"
    requirement: CORE-02
    verification:
      - kind: other
        ref: "Live probe, preprod/gsocial-test 2026-09-02: POST /v2/tickets with ts.brand=2 (disabled) → HTTP 422 \"Brand 'Adres 2' is disabled and cannot be set on a ticket.\"; TICKET-652/653 both 404"
        status: pass
    human_judgment: false
---

# Quick 260902-dhy — Summary

## Ne yapıldı

Yan konuşma açılırken ana talebin `ts.brand` değeri okunup yeni talebin create payload'una ekleniyor. Tek gerçek etkisi: markalı bir talepten açılan yan konuşmanın e-postası artık o markanın default support address'inden ve marka kimliğiyle (ad + logo) çıkıyor; öncesinde hepsi tenant default adresinden çıkıyordu.

Üç atomik commit:

| Commit | İçerik |
|---|---|
| `359c4e1` | `TICKET_BRAND_FIELD_KEY` + `brandIdOfTicket()` okuyucusu |
| `1900dc5` | `ComposeStore.submit` `brandId` parametresi, payload'a omit-when-empty ekleme, ComposeScreen çağrı noktası |
| `b51f66c` | 422 disabled-brand fallback (`createTicketWithBrandFallback`) |

## Doğrulama

- `CI=true npx tsc --noEmit` → exit 0
- `CI=true npm test -- --watchAll=false` → 35 suite / 581 test, tamamı yeşil (13 yeni test)
- Canlı probe (preprod / `gsocial-test`): API sözleşmesi ve gönderen-adres etkisi ölçüldü — D5/D6

## Açık kalanlar (kapsam dışı, bilerek)

- **Prod sürüm doğrulaması:** Multibranding `grispi-api` 1.63.0+ ile geldi ve `master`'da. Plugin varsayılan olarak prod'a bağlanıyor; prod'un ≥1.63.0 olduğu Grispi ekibinden teyit edilmeli. Değilse davranış bugünküyle aynı kalır (alan okunmaz → key gönderilmez), regresyon riski yok.
- **`build/` yeniden üretilmedi.** Bu repo kendi deploy'u (repo-as-host, `grispi.app` `build/`'i doğrudan servis ediyor); bundle rebuild + commit ayrı ve dışa dönük bir adım, istenmediği için yapılmadı.
- Reply/patch yollarına marka eklenmedi, UI'da marka gösterimi eklenmedi — planın `prohibitions` bölümünde kayıtlı.
