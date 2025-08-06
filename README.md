# Grispi Right-Panel Plugin Starter Kit

This repository is a **starter kit for building plugins that appear in the right-hand "App" panel on Grispi ticket pages**.  
It ships with **React + Vite**, **Tailwind CSS**, and **shadcn/ui** out of the box, plus a few pre-styled components that match Grispi's look-and-feel.

---

## 1 · Quick Start

```bash
# 1. Clone
git clone https://github.com/grispiapp/right-panel-react-starter-app.git
cd right-panel-react-starter-app

# 2. Install deps (Node ≥ 18 recommended)
yarn install     # or: npm ci

# 3. Develop inside Grispi
yarn start       # runs dev-server on http://localhost:3000
```

---

## 2 · How the Plugin Integrates with Grispi

| Artifact                      | Purpose                                                                                                                     | Best Practice                                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **`manifest.json`**           | Registers the plugin (title, hosted URL, iframe height, etc.). Grispi reads this once when the plugin is added to a tenant. | Keep the defaults for `height`, `singleton`, and `lazy` unless you have a strong reason to change them. |
| **`settings` object**         | Arbitrary key–value data Grispi passes to the plugin on load.                                                               | Perfect place for tenant-specific API keys, feature flags, or theme settings.                           |
| **`GrispiClient.instance()`** | JS bridge that exposes context (`ticket`, `user`, etc.) and events (`activeTicketChanged`).                                 | Only initialise it when the plugin is running **inside** Grispi.                                        |

### Example `manifest.json`

```json
{
  "title": "Showcase",
  "src": "https://my-plugin-url.com/",
  "uiDefinition": {
    "height": 900
  },
  "singleton": false,
  "lazy": true
}
```

### Example `settings`

```json
{
  "bg-color": "orange",
  "text-color": "white"
}
```

---

## 3 · Local Testing Outside of Grispi

The plugin normally fails if Grispi isn't present.  
For quick standalone testing, **comment out** the highlighted block in `src/contexts/grispi-context.tsx`:

```tsx
// ⛔ REMOVE OR COMMENT THIS WHILE TESTING LOCALLY
// GrispiClient.instance()
//   ._init()
//   .then((data: GrispiBundle) => { /* ... */ })
```

Remember to restore the client before committing or deploying.

---

## 4 · Adding the Plugin to Your Tenant

1. Build & host the plugin (Vercel, Netlify, AWS S3, your choice).
   ```bash
   yarn build       # outputs static files to ./build
   ```
2. Fill out the request form **<https://help.grispi.com/requests/user-forms/2>** with:
   - **Tenant ID**
   - **Desired Plugin ID** (unique identifier for your plugin within your tenant, similar to a domain name format like `com.yourcompany.pluginname`)
   - The final **`manifest.json`**
   - Your **`settings`** object
3. Grispi's team will review and email once the plugin is live.

---

## 5 · Project Structure

```
📦 right-panel-react-starter-app
 ┣ 📂public
 ┃ ┣ 📜index.html
 ┃ ┗ 📜manifest.json
 ┣ 📂src
 ┃ ┣ 📂components      # Re-usable UI pieces
 ┃ ┃ ┣ 📂ui           # Grispi-themed base components
 ┃ ┃ ┗ 📜loading-wrapper.tsx
 ┃ ┣ 📂contexts        # React Contexts (incl. GrispiProvider)
 ┃ ┣ 📂grispi         # Grispi client and API
 ┃ ┣ 📂lib            # Utility functions
 ┃ ┣ 📂screens        # Screen components
 ┃ ┣ 📂store          # State management (MobX)
 ┃ ┣ 📂types          # TypeScript type definitions
 ┃ ┣ 📜app.tsx        # Root component
 ┃ ┣ 📜index.tsx      # Entry point
 ┃ ┗ 📜index.css      # Global styles
 ┣ 📜package.json
 ┣ 📜tailwind.config.js
 ┗ 📜README.md
```

---

## 6 · Scripts

| Command      | Description                         |
| ------------ | ----------------------------------- |
| `yarn start` | Run dev-server with hot-reload      |
| `yarn build` | Create production build in `build/` |
| `yarn test`  | Run unit tests                      |
| `yarn eject` | Eject from Create React App         |

---

## 7 · Styling & UI Components

- **Tailwind CSS** is pre-configured; adjust the design token section in `tailwind.config.js` to tweak Grispi branding.
- **shadcn/ui** provides accessible primitives (Button, Input, etc.).  
  You can generate additional components via:

  ```bash
  npx shadcn-ui@latest add <component>
  ```

- **Grispi-themed base components** (`Button`, `Input`, `Screen`, `Breadcrumb`) live in `src/components/ui/` and are safe to extend.

---

## 8 · License

This starter kit is released under the **MIT License**—see `LICENSE` for details.

---

## 9 · Acknowledgements / Sources

- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [React](https://reactjs.org/) + [Create React App](https://create-react-app.dev/)
- [Craco](https://github.com/gsoft-inc/craco) (for CRA compatibility)
- [MobX](https://mobx.js.org/) (for state management)

Happy coding! 🎉
