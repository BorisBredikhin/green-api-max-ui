# AGENTS.md

Single-package React Router 8 app in **framework mode** (SSR on), UI built with **Ant Design v6**. No backend integration exists yet.

## Commands

**pnpm is canonical** — only `pnpm-lock.yaml` is committed. The stock `README.md` says `npm install` and the `Dockerfile` runs `npm ci` against a `package-lock.json` that does not exist, so `docker build` currently fails. Ignore both; use pnpm.

- `pnpm install`
- `pnpm dev` — dev server with HMR on http://localhost:5173
- `pnpm typecheck` — the **only** verification command (no lint, no tests, no formatter, no CI in this repo). Run it before calling any work done.
  NEVER run `pnpm dev` just for checking — use `pnpm build` or `pnpm typecheck` instead.
- `pnpm build` — `react-router build`, emits `build/client` + `build/server`
- `pnpm start` — serves `./build/server/index.js` on :3000; requires a prior `pnpm build`
- `npx react-router routes` — prints the resolved route tree; fastest way to confirm a route is registered
- `npx react-router reveal` — writes the default `app/entry.client.tsx` / `app/entry.server.tsx` if you ever need to override them (they do not exist in the tree; hydration/SSR run on React Router's built-in defaults)

`typecheck` is `react-router typegen && tsc`. Never run bare `tsc` — route types will not resolve.

## Routing

- **`app/routes.ts` is the single source of truth.** Routes are registered explicitly with helpers from `@react-router/dev/routes` (`index`, `route`, `layout`, `prefix`). Dropping a file into `app/routes/` does nothing on its own.
- `app/routes/` is just a folder name, not a file-routing convention. Route filenames are free — pick and register them.
- Route module types come from `./+types/<name>`, generated into `.react-router/types/`. That directory is gitignored and **absent from a fresh clone**; `pnpm dev` / `pnpm build` regenerate it, `tsc` does not.

## Ant Design — query the CLI, never write from memory

The `antd` CLI is installed globally with offline metadata for v4/v5/v6. **v6 renamed a large surface area, so v5 knowledge is a trap.** Before writing any component code, look the API up:

- `antd info <Component> --format json` — props, types, defaults, deprecation flags
- `antd demo <Component> <demoName> --format json` — runnable source (get the demo list from a `DEMO_NOT_FOUND` error)
- `antd doc <Component> --format json` — full docs
- `antd lint ./app --format json` — deprecated APIs, a11y, usage. **Run after every antd change.**
- `antd doctor --format json` — project-level diagnosis
- `antd migrate 5 6 --format json` — the full breaking-change list (40 steps)
- Always pass `--format json`. `antd -V` prints the CLI version; `antd upgrade` updates it.

### v5 → v6 renames most likely to bite

- `dropdownXxx` → `popupXxx`; `dropdownRender` → `popupRender`; `onDropdownVisibleChange` → `onOpenChange`
- `xxxStyle` / `bodyStyle` / `headStyle` → `styles.xxx`; `overlayClassName` → `classNames.root`/`classNames.popup.root`
- `bordered={false}` → `variant="filled"`; `destroyInactivePanel` → `destroyOnHidden`
- `direction` → `orientation`; `destroyOnClose` → `destroyOnHidden`; `Progress` `strokeWidth`/`width` → `size`
- `Menu` / `Breadcrumb` / `Tabs` / `Anchor` / `Timeline` / `AutoComplete`: `children`/`routes`/`dataSource` → `items` / `options`
- `Button`: prefer `color="primary" variant="solid"`. `type="primary"` still works as a back-compat alias but is not the current API.
- `Button.Group`, `Input.Group`, `Dropdown.Button` → `Space.Compact`
- `Alert`: `message` → `title`, `closeText` → `closable.closeIcon`
- v6 CSS variables are on by default; IE unsupported. Many components' internal DOM structure changed, so selectors reaching inside components may break.

### Setup facts

- `antd` and `@ant-design/icons` must be **v6 together** — icons v6 is not compatible with antd v5. Icons is a transitive dep of antd but must be declared directly: pnpm's strict layout does not expose transitive packages to app imports.
- React ≥18 required. The app is on React 19, so `@ant-design/v5-patch-for-react-19` is neither needed nor wanted.
- **Tailwind was removed.** antd owns all component styling. There is no `tailwind.config.*`, no `@tailwindcss/vite`, and no utility-class theming. `app/app.css` is plain CSS and imports `antd/dist/reset.css` (which replaces Tailwind's preflight).
- Theme via the `ConfigProvider` in `app/root.tsx`'s `Layout` — it wraps `children`, so the root `ErrorBoundary` is themed too. Do not move it into `App`, which the error boundary bypasses.

### SSR caveat (measured, not assumed)

`pnpm build` + `pnpm start` returns HTTP 200 with correct antd markup (`ant-btn-color-primary`, `ant-btn-variant-solid`), but the SSR HTML contains **no `<style>` tags and no `--ant-*` variables** — component CSS is injected by `@ant-design/cssinjs` on the client, so expect unstyled first paint. `antd doctor` reports: `No @ant-design/cssinjs found, SSR style extraction will not work`.

Options if FOUC becomes a problem, none of them wired up yet:

- Import `antd/dist/antd.css` instead — static and SSR-correct, but 995 KB raw / ~110 KB gzipped **and it bypasses ConfigProvider theming**.
- Wire `extractStyle()` from `@ant-design/cssinjs` into a revealed `app/entry.server.tsx`. Real work: entry reveal, cache handling, style injection, and a nonce if CSP is added later.

## Conventions

- `react-router.config.ts` sets `ssr: true`, so route modules render on the server. No `window` / `localStorage` at module scope; guard or move into effects. Set `ssr: false` for SPA mode.
- Import alias `~/*` → `app/*` (tsconfig `paths`, picked up by Vite 8's built-in `resolve.tsconfigPaths` — there is no separate plugin to install).
- `verbatimModuleSyntax: true` — type-only imports must use `import type`.
- No backend/API client layer, no env loading wired up. `.env` is gitignored; do not assume a base URL or credentials exist.
- Match the surrounding style. Do not introduce a formatter, linter, or test runner without being asked.

## Reference

- Project skill `.agents/skills/react-router/` covers all React Router modes — read `references/framework-mode.md` before touching loaders, actions, or route config.
- Project skill `.agents/skills/antd/` covers the antd CLI workflow. Full component docs also at `https://ant.design/components/<name>.md`.