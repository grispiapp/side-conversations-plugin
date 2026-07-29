# Quick Task 4c0 — UI, Editor, Sanitizer, and Server-State Research

**Researched:** 2026-07-29 · **Confidence:** HIGH on codebase/UX and sanitizer; MEDIUM on the editor pin because TypeScript 4.9 forces an older major.

## Recommendation

Treat the plugin as one compact **inbox → compose → email thread** workspace, not three unrelated forms. Use Tiptap 2 for composition, DOMPurify for the single HTML trust boundary, and TanStack Query for remote/cache state while MobX keeps navigation, drafts, focus signals, and optimistic presentation state. `[VERIFIED: codebase grep]` `[CITED: https://tiptap.dev/docs/editor/getting-started/overview]` `[CITED: https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation]`

### UX for a ~372px B2B support panel

- **Inbox:** use a flush list with 1px separators, not spaced cards. Target a 64–72px row: recipient + time on line 1, subject on line 2, one-line snippet on line 3; put the status as short text/pill at the trailing edge and keep the 3px unseen rail. This increases scan density while preserving the existing “who / what / when / whose turn” model. `[VERIFIED: codebase grep]`
- **Shared shell:** redesign `Screen`/header/button primitives around a consistent 48px header, 44px minimum interactive targets, left-aligned screen title, back action, and one trailing primary action. The current `ScreenHeader` has a `line-clamp-2` flex workaround and Compose/Chat already bypass it differently; consolidate rather than add another exception. `[VERIFIED: codebase grep]`
- **Compose as the first thread message:** keep Recipient → Subject → Message in that order, but render Message with the same toolbar/editor surface used for replies. “Gönder” should transition directly into the thread and show the first outbound block as pending; failure stays in that block with retry. Preserve the pinned parent-ticket key and dirty-draft confirmation. `[VERIFIED: codebase grep]`
- **Thread:** retain full-width chronological email blocks, immutable recipient summary, collapsed quoted history, sticky composer, and solved-state disablement. The header should use the same recipient/subject hierarchy established in compose so the transition feels continuous. `[VERIFIED: codebase grep]`
- **States:** ticket-key changes must show a skeleton/empty state, never the prior ticket’s rows; keep inline retry for fetch/mutation errors, explicit sending/failed/solved labels, and no color-only meaning. Focus moves to the first invalid compose field, then the thread/composer after send/reopen; returning restores focus to the activating row. Announce async state with scoped `role="status"`/`role="alert"` regions. Toolbar buttons need accessible names, visible focus, and `aria-pressed` for active marks; menus need Escape/outside-click and focus return. `[VERIFIED: codebase grep]` `[ASSUMED]`

## Packages and integration

| Choice | Exact pin | Decision |
|---|---|---|
| Tiptap | `@tiptap/react@2.27.2`, `@tiptap/pm@2.27.2`, `@tiptap/starter-kit@2.27.2`, `@tiptap/extension-link@2.27.2` | **Use.** Headless, ProseMirror-backed, MIT, React 18 peer support; heavier than a contentEditable wrapper but removes selection/command handling from application code. Pin every Tiptap package to the same exact version. `[CITED: https://tiptap.dev/docs/editor/getting-started/install/react]` `[CITED: https://github.com/ueberdosis/tiptap]` |
| DOMPurify | `dompurify@3.4.12` | **Use.** Browser-native sanitizer, dual MPL-2.0/Apache-2.0 license, maintained by Cure53. `[CITED: https://github.com/cure53/DOMPurify]` |
| TanStack Query | `@tanstack/react-query@5.101.4` | **Use.** MIT; v5 requires React 18 and its current package peer is React 18/19. `[CITED: https://tanstack.com/query/v5/docs/framework/react/guides/migrating-to-v5]` `[CITED: https://github.com/TanStack/query]` |

**Why not current majors/“lighter” wrappers:** Lexical `0.48.0` declares TypeScript `>=5.2`; Tiptap `3.29.2` emits `NoInfer` in React declarations, incompatible with this repo’s TS 4.9 without a compiler upgrade. `react-simple-wysiwyg@3.4.1` is small and CRA-tested but its official source still calls `document.execCommand`, preserving the failure-prone mechanism being replaced. `[CITED: https://www.npmjs.com/package/lexical]` `[CITED: https://unpkg.com/@tiptap/react@3.29.2/dist/index.d.ts]` `[CITED: https://github.com/megahertz/react-simple-wysiwyg/blob/v3.4.1/src/toolbar/buttons.tsx]` Tiptap 2.27.2 is therefore a compatibility pin, not a forever choice; budget a TS/CRA modernization before moving to Tiptap 3. `[ASSUMED]`

**Editor pattern:** configure `StarterKit` to disable headings, code/codeBlock, strike, horizontal rule, and other unsupported output; retain paragraph, hard break, bold, italic, bullet/ordered lists, blockquote, undo/redo, then add Link with only `http:`, `https:`, and `mailto:`. Use Tiptap commands for toolbar/emoji and a keyboard shortcut extension for Shift+Enter submit (ignore IME composition); use `editor.isEmpty`, `editor.getHTML()`, and `editor.commands.clearContent()`. Do not `setContent` on every `onUpdate`, which would reset selection; synchronize only genuine external changes such as draft restore/clear. `[CITED: https://tiptap.dev/docs/editor/extensions/functionality/starterkit]` `[CITED: https://tiptap.dev/docs/editor/extensions/marks/link]`

**HTML boundary:** keep `sanitizeHtml`, `splitQuotedHtml`, and `buildQuotedReplyHtml` as the public API, but replace only the custom walker with DOMPurify. Preserve the existing exact allowlist and configure `ALLOWED_ATTR`, `ALLOW_DATA_ATTR:false`, `ALLOW_ARIA_ATTR:false`, and a strict URI rule; normalize anchor `rel`/`target` inside one reviewed wrapper/hook. Sanitize remote HTML before every `dangerouslySetInnerHTML`, pasted HTML through Tiptap’s paste transform, restored HTML before `setContent`, and final HTML before send. Tiptap’s schema simplifies paste but is not an XSS sanitizer. `[VERIFIED: codebase grep]` `[CITED: https://github.com/cure53/DOMPurify]`

**React Query boundary:** create one stable `QueryClient` above the app providers. Use keys `['side-conversations', tenantId, parentKey]`, `['side-conversation', tenantId, sideKey]`, and `['customers', tenantId, normalizedTerm]`; use `useInfiniteQuery` for the API’s ≤10 pagination. On successful new-ticket/reply/solve/reopen, await exact invalidation of the affected detail key and parent-list key—never invalidate the entire cache, and never invalidate on failure. `[VERIFIED: codebase grep]` `[CITED: https://tanstack.com/query/v5/docs/framework/react/guides/query-keys]` `[CITED: https://tanstack.com/query/v5/docs/framework/react/guides/invalidations-from-mutations]`

Set list/thread `staleTime` to about 30s/15s, `refetchOnWindowFocus:false` (iframe focus churn), `refetchOnReconnect:true`, and `refetchInterval:false`; rely on mutation invalidation and explicit retry/refresh. If polling is later required, make it an explicit visible-screen-only product decision with `refetchIntervalInBackground:false`. Do not carry previous parent-key data as placeholder data, because that reintroduces stale-ticket flash. `[CITED: https://tanstack.com/query/latest/docs/framework/react/reference/useQuery]` `[ASSUMED]`

During migration, Query owns GET cache/fetch/error and mutation lifecycle; MobX owns screen routing, dirty drafts, recipient input, one-shot focus/scroll signals, and temporary optimistic message presentation. Migrate one resource vertically and delete the corresponding MobX fetch/status fields in the same change—do not mirror Query data into observable arrays. `[ASSUMED]`

## Codebase touchpoints, risks, and tests

- Replace internals of `rich-text-composer.tsx`; wire the same component into `MessageField` and `ChatScreen`. Preserve the current ref/focus contract and MobX `draftHtml` boundary. `[VERIFIED: codebase grep]`
- Replace sanitizer internals without changing callers in `active-conversation-store.ts`, `thread-message.tsx`, or quote-building semantics. DOMPurify removes unsafe nodes but its default “keep children” behavior differs from the current drop-with-content set; explicitly regression-test `script/style/svg/math/iframe/img/table/template`. `[VERIFIED: codebase grep]` `[CITED: https://github.com/cure53/DOMPurify]`
- Move list/detail/customer GET state behind hooks/query options gradually; mutation success must preserve current authoritative refetch behavior, pinned ticket keys, failed-message retry payload, solved non-optimism, and ticket-switch isolation. `[VERIFIED: codebase grep]`
- Required tests: sanitizer’s existing obfuscated-URL/attribute/quote cases plus Word/Gmail paste, relative/data/javascript links, images/tables, and recursive quote prevention; editor bold/italic/link/lists/blockquote/emoji, active `aria-pressed`, paste, Shift+Enter vs Enter/IME, disabled/clear/draft restore; Query key isolation, infinite pagination, success-only targeted invalidation, no interval, ticket switching without stale flash; 372px visual/keyboard pass for dense rows, compose→pending thread, errors, empty, solved, and focus return. Use a fresh QueryClient per Jest test with retries disabled. `[VERIFIED: codebase grep]` `[CITED: https://tanstack.com/query/v5/docs/framework/react/guides/testing]`

## Package legitimacy audit

No packages were installed and `slopcheck` is unavailable; per the package gate all recommendations remain `[ASSUMED]` until a human verification checkpoint, despite strong official signals.

| Package family | Official/npm signals (checked 2026-07-29) | Postinstall | Disposition |
|---|---|---|---|
| Tiptap pins above | Official docs + verified GitHub org; MIT; packages date from 2020–2023; 12.3–15.4M weekly downloads across core pins; v2.27.2 published 2026-01-07. `[CITED: https://github.com/ueberdosis/tiptap]` | none reported | Conditional approve `[ASSUMED]` |
| `dompurify@3.4.12` | Official Cure53 repo; created 2014; 53.9M weekly downloads; published 2026-07-11. `[CITED: https://github.com/cure53/DOMPurify]` | none reported | Conditional approve `[ASSUMED]` |
| `@tanstack/react-query@5.101.4` | Official docs/repo; scoped package created 2022; 61.4M weekly downloads; published 2026-07-21. `[CITED: https://github.com/TanStack/query]` | none reported | Conditional approve `[ASSUMED]` |

Registry versions/downloads were read from npm and npm’s downloads API; no exact bundled-byte claim is made because unpacked tarball size is not CRA production bundle cost. Require `npm audit`, exact lockfile review, CRA production build/type-check, and bundle comparison before acceptance. `[ASSUMED]`
