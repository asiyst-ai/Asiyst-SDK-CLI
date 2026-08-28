# Asiyst CLI

The `asiyst` CLI connects a website that uses `@asiyst/sdk` to an Asiyst project. It does not render the avatar, chatbot, dashboard, or analytics UI.

## Install

```sh
npx @asiyst/cli
# or
npm install -g @asiyst/cli
```

## Commands

`asiyst` detects the current project and opens an interactive command prompt. Use `asiyst connect` (or `asiyst init`) to start the browser-only authentication and project connection flow. Other commands are `login`, `logout`, `status`, `verify`, `doctor`/`diagnostics`, `dashboard`, `avatar`, `update`, `trust`, and `revoke-trust`.

Interactive startup performs a lightweight npm version check. If a newer release exists, the CLI only displays a notification. It never installs or restarts automatically; run `update` and confirm to install it. Global installations are updated in place. For npx invocations, the latest package is downloaded and verified for that invocation without changing the website project.

The CLI checks `GET /api/v1/health`, then creates a short-lived, single-use session through `POST /api/v1/cli/sessions`, opens its returned URL, and polls `GET /api/v1/cli/sessions/:sessionId/status`. Passwords, AI provider keys, Supabase keys, and private API credentials are never requested, placed in URLs, or logged.

Set `ASIIYST_API_URL` only for a controlled non-production deployment (production defaults to `https://asiyst.com/api/v1`). The current SDK accepts `projectId` and `publicKey` through its public `Asiyst.init({ ... })` API. For verification, configure `ASIIYST_PROJECT_ID` and `ASIIYST_PUBLIC_KEY` in the project environment.

## Required web API

The web application must implement the session endpoints above, `GET /api/v1/cli/projects/:projectId`, and `POST /api/v1/cli/verification`. Verification must return authoritative checks for project validity, key validity, API reachability, domain authorization, SDK heartbeat, published configuration, and avatar availability. The CLI does not fabricate these results or connect directly to Supabase.

## Development

```sh
npm run build
npm test
npm pack --dry-run
```
