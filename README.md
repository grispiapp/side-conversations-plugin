# Yan Görüşmeler — Grispi Side Conversations Plugin

A plugin that runs in the right-hand panel (~372px iframe) of a Grispi ticket page. It lets an agent start, run and track separate email threads with third parties — a supplier, a courier, another team — in the context of a ticket, **without ever involving the ticket requester**.

Each side conversation is created as its own Grispi **side ticket** and linked back to the parent ticket through the `tu.side_conversation_parent` custom field. The requester never sees these threads.

---

## 1. Manifest

The definition Grispi needs in order to register the plugin. This file does **not** live in the repo — you hand it to the Grispi team during installation (see [Installing on a tenant](#4-installing-on-a-tenant)).

```json
{
  "title": "Yan Görüşmeler",
  "src": "https://<your-hosted-plugin-url>/",
  "uiDefinition": {
    "height": 900
  },
  "singleton": false,
  "lazy": true
}
```

> **Careful:** `public/manifest.json` in this repo is *not* that file. It is Create React App's PWA manifest (`short_name`, `icons`, `theme_color`, …) and has nothing to do with Grispi. Do not put the Grispi manifest above into it.

---

## 2. Settings

Grispi passes a `settings` object to the plugin on load. This plugin reads **exactly one key** from it:

```json
{
  "_grispi_env": "prod_tr"
}
```

### `_grispi_env` — which API host to talk to

Resolved **before** the plugin issues its first request. A wrong or missing value means every subsequent request goes to the wrong backend.

| Value     | API host                    |
| --------- | --------------------------- |
| `preprod` | `https://api.grispi.net`    |
| `prod`    | `https://api.grispi.com`    |
| `prod_tr` | `https://api.grispi.com.tr` |

**If it is not set**, the plugin falls back in order: the bundle token's JWT `dev` claim (`dev: true` → `preprod`), and if that is absent too, the safe-side default `prod`. So an unconfigured install never lands on TR prod by accident.

> **`_grispi_env` is MANDATORY for TR installs.**
> The backend computes the JWT `dev` claim as `dev = !(PROD || PROD_TR)` — so it is `false` for regular prod and TR prod alike. The claim **cannot tell them apart**. If a TR tenant does not explicitly set `_grispi_env` to `prod_tr`, the plugin silently talks to the non-TR prod host. There is no code-side fix for this; it is solved only by setting the value correctly in that tenant's settings.

> **Hyphen trap:** the match is strict. Grispi's own backend spells this environment with a hyphen internally (`prod-tr`), but the valid value here is the underscored `prod_tr`. An unrecognized value is **not** auto-corrected — it silently falls through the chain above. When that happens you will see a `grispi-environment`-tagged warning in the browser console.

`GRISPI_BASE_URLS` in `src/grispi/client/environment.ts` is the single source of truth for host mapping; these hosts are not hardcoded anywhere else in the codebase.

---

## 3. Custom field

| Field                         | Purpose                                                    |
| ----------------------------- | ---------------------------------------------------------- |
| `tu.side_conversation_parent` | Marks a ticket as a side conversation and links it to its parent |

This field is **hardcoded, never read from settings**, and is **provisioned automatically by Grispi** when the plugin is installed on a tenant. The code only ever reads and writes its value — it never manages the field's existence. You do not need to create it by hand.

---

## 4. Installing on a tenant

1. Build the plugin and host it somewhere:

   ```bash
   npm run build
   ```

   Output lands in `build/`; any static host works (Vercel, Netlify, S3, …).

2. Fill in the [Grispi request form](https://help.grispi.com/requests/user-forms/2) with:
   - **Tenant ID**
   - **Plugin ID** — unique within the tenant, domain-like: `com.yourcompany.sideconversations`
   - **manifest.json** (see [Manifest](#1-manifest))
   - **settings** — for TR tenants this **must** include `_grispi_env: "prod_tr"`

3. The Grispi team reviews it and emails you once the plugin is live.

---

## 5. Local development

The plugin normally runs inside the Grispi panel iframe and needs the `window.GrispiClient` bridge. To open `http://localhost:3000` directly there is a **standalone dev mode** — you do not need to comment out any code.

Standalone mode activates only when **both** conditions hold:

1. `NODE_ENV === "development"` (never in a production build), **and**
2. `REACT_APP_DEV_TOKEN` is non-empty

Create `.env.development.local` in the project root (it is in `.gitignore` and is never committed):

```bash
REACT_APP_DEV_TOKEN=<a-valid-grispi-token>
REACT_APP_DEV_TENANT_ID=gsocial-test
```

| Variable                    | Required | Default              |
| --------------------------- | -------- | -------------------- |
| `REACT_APP_DEV_TOKEN`       | **Yes**  | —                    |
| `REACT_APP_DEV_TENANT_ID`   | No       | `gsocial-test`       |
| `REACT_APP_DEV_TICKET_KEY`  | No       | `TICKET-563`         |
| `REACT_APP_DEV_AGENT_EMAIL` | No       | defined in code      |
| `REACT_APP_DEV_GRISPI_ENV`  | No       | `preprod`            |

Notes:

- Standalone mode bypasses the bundle, so it cannot read `settings` (and therefore not `_grispi_env`). You set the environment with `REACT_APP_DEV_GRISPI_ENV` instead; it accepts the same three values and defaults to `preprod`.
- You can switch the ticket from the URL: `http://localhost:3000/?ticket=TICKET-123`. Precedence: `?ticket=` → `REACT_APP_DEV_TICKET_KEY` → default.

---

## 6. Commands

| Command                                  | Description                        |
| ---------------------------------------- | ---------------------------------- |
| `npm start`                              | Dev server on http://localhost:3000 |
| `npm run build`                          | Production build into `build/`     |
| `CI=true npm test -- --watchAll=false`   | Run the test suite once            |
| `npx tsc --noEmit`                       | Type check                         |

> A bare `npm test` starts a watch runner and holds the terminal. Use the `CI=true …` form above for a single run.

---

## 7. Stack

Create React App + [craco](https://github.com/dilanx/craco), React 18, TypeScript, Tailwind CSS, [shadcn/ui](https://ui.shadcn.com/), MobX (conversation state) and React Query (tenant-scoped caching).
