<!-- GSD:project-start source:PROJECT.md -->

## Project

**Yan Konuşmalar — Grispi Side Conversations Plugin**

Grispi talep (ticket) sayfasının sağ panelinde (~372px iframe) çalışan bir plugin. Temsilci, talep sahibini hiç dahil etmeden üçüncü taraflarla (tedarikçi, kargo firması, başka ekip) talep bağlamında ayrı e-posta yazışmaları başlatır, yürütür ve takip eder — Zendesk'teki "Side Conversations" özelliğinin Grispi'ye uyarlanmış hâli.

**Core Value:** Temsilci, talebi çözmek için gereken harici yazışmaları talepten hiç ayrılmadan yürütebilmeli; talep sahibi bu yazışmaları asla görmemeli.

### Constraints

- **Tech stack**: Starter'ın yapısı korunur (CRA+craco, React 18, TS 4.9, Tailwind 3, shadcn, MobX, React Query) — mevcut Grispi plugin ekosistemiyle tutarlılık
- **Platform**: Grispi sağ paneli iframe'i, her zaman açık tema, UI dili Türkçe. **Panel genişliği sabit değildir** — kullanıcı sürükleyerek boyutlandırabiliyor; 1366px viewport'ta ~295px ölçüldü. Layout ~280px'ten yukarı akışkan olmalı. *(düz. 2026-08-17 — canlı ölçüm; önceki "sabit 372px" varsayımı yanlıştı)*
- **API**: advanced-search `size` ≤ 10 → sayfalama şart; CC/BCC yok → tek alıcı; webhook yok → polling; SDK köprüsü salt okunur → tüm yazmalar REST
- **Dependencies**: İlişki field'ı prod'da plugin kurulumuyla otomatik oluşur; geliştirme tenant'ında elle oluşturulur. Plugin manifest kaydı Grispi ekibi onayı gerektirir
- **Security**: Token bundle'dan gelir, saklanmaz. Ortam ayarı `_grispi_env` settings'ten okunur (tek settings anahtarı). İlişki field key'i (`tu.side_conversation_parent`) ise D-01/D-02 gereği HARDCODE'dur ve settings'ten ASLA okunmaz — alan Grispi tarafından sağlanır, kod yalnızca değerini okur/yazar

<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->

## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
