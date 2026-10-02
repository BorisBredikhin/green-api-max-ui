# GREEN API MAX messenger

A web client for the [GREEN API](https://green-api.com/en/docs/) MAX instance API: sign in with your instance credentials, keep a contact list, and hold chats that fill in live from the notification queue.

It talks to your GREEN API instance straight from the browser — there is no backend of its own.

Built with React Router 8 in framework mode and Ant Design 6.

## Features

- Sign in with `idInstance` and `apiTokenInstance`
- Contact list, newest first, with unread badges
- Chat history behind a stale-while-revalidate session cache
- Live messages drained from the notification queue by long poll
- Add a contact by phone number, with back-off once the lookup quota is spent
- Credentials and contacts persisted in `localStorage`

## Requirements

- Node.js >= 22.22
- pnpm — only `pnpm-lock.yaml` is committed

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm dev
```

The dev server starts on http://localhost:5173 with HMR. The `.env` file is optional; see [Configuration](#configuration).

## Scripts

| Command          | What it does                                     |
| ---------------- | ------------------------------------------------ |
| `pnpm dev`       | Dev server with HMR on http://localhost:5173     |
| `pnpm build`     | Production build into `build/client`             |
| `pnpm start`     | Serves the built output on http://localhost:4173 |
| `pnpm typecheck` | Generates route types, then runs `tsc`           |

`typecheck` is the only check in this repo: there is no linter, test runner or formatter. Run it before calling a change done. Never run bare `tsc` — the route types live in `.react-router/types/`, which `typegen` produces and `tsc` alone does not.

## Configuration

`VITE_API_URL` — base URL of your GREEN API instance. Optional; it falls back to `https://3100.api.green-api.com`. See `.env.example`.

Vite inlines `VITE_*` variables at build time, so a deployment that needs a different instance URL has to be built with that value set.

## How signing in works

The form takes your instance `idInstance` and `apiTokenInstance` and stores them locally.

On start the app calls `setSettings` with an empty `webhookUrl`, because HTTP API polling is only legal that way. If a webhook gets set on the instance from the cabinet mid-session, the app notices the conflict, re-applies the setting and warns you that notifications resume in about a minute.

Notifications are strictly receive-then-acknowledge: pulling one does not remove it, and an unacknowledged notification blocks everything queued behind it. Every notification is therefore acknowledged, including the kinds the UI does not render.

## Rate limits

The MAX API allows roughly one request per second per instance for `getChatHistory` and `readChat`. History fetches run through a serialising min-gap queue and `readChat` through a throttle — both live in `app/lib/rate-limit.ts`. `checkAccount` answers HTTP 469 once the account-lookup quota is exhausted, and the add-contact dialog blocks further checks for a minute.

## Deployment

The app is built with `ssr: false` (SPA mode), so `pnpm build` emits a static `build/client` for any static host. There is no server process to run.

Serve `build/client` with an SPA fallback to `index.html`, so that `/login` and unknown paths both resolve to the app.

### Docker

The committed `Dockerfile` still comes from the React Router template and will not build: it runs `npm ci` against a `package-lock.json` that this repo does not have. Convert the image to pnpm before relying on it.

## Project layout

```
app/
├── api/          GREEN API client, endpoints, session caches, localStorage
├── components/   Ant Design UI
├── hooks/        notification poller, credentials, instance settings
├── lib/          storage and rate-limit primitives
├── routes.ts     route table — the single source of truth
└── root.tsx      ConfigProvider theme and the error boundary
```

Routes are registered explicitly in `app/routes.ts`; dropping a file into `app/routes/` does nothing on its own.

Styling is Ant Design only — there is no Tailwind. The theme comes from the `ConfigProvider` in `app/root.tsx`, and `app/app.css` holds layout rules that carry no theme-specific values.

`AGENTS.md` documents the conventions in more depth. Read it before adding a route or writing an antd component.
