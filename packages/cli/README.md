# Asiyst CLI

The `asiyst` CLI connects a website that uses `@asiyst/sdk` to an Asiyst project. It does not render the avatar, chatbot, dashboard, or analytics UI.

## Install

```sh
npx asiyst
# or
npm install -g @asiyst/cli
```

## Commands

`asiyst` detects the current project and opens an interactive command prompt. Use `asiyst connect` (or `asiyst init`) to start the browser-only authentication and project connection flow. Other commands are `login`, `logout`, `status`, `verify`, `doctor`/`diagnostics`, `dashboard`, `avatar`, `trust`, and `revoke-trust`.

The CLI creates a short-lived, single-use session through `POST /api/cli/sessions`, opens its returned URL, and polls `GET /api/cli/sessions/:sessionId/status`. Passwords, AI provider keys, Supabase keys, and private API credentials are never requested, placed in URLs, or logged.

Set `ASIIYST_API_URL` for development (production defaults to `https://asiyst.com`). The current SDK accepts `projectId` and `publicKey` through its public `Asiyst.init({ ... })` API. For verification, configure `ASIIYST_PROJECT_ID` and `ASIIYST_PUBLIC_KEY` in the project environment.

On interactive startup, the CLI checks the npm registry for a newer `@asiyst/cli` version before rendering the interface. Updates are launched once through `npx`; registry failures, offline mode, CI, and non-interactive sessions are ignored so startup is never blocked. Set `ASIIYST_UPDATE_ATTEMPTED=1` to suppress the one-shot restart guard.

## Required web API

The web application must implement the session endpoints above, `GET /api/cli/projects/:projectId`, and `POST /api/cli/verification`. Verification must return authoritative checks for project validity, key validity, API reachability, domain authorization, SDK heartbeat, published configuration, and avatar availability. The CLI does not fabricate these results or connect directly to Supabase.

## Development

```sh
npm run build
npm test
npm pack --dry-run
```
