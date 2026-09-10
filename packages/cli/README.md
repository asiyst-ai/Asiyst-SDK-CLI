# Asiyst CLI

The `asiyst` CLI connects a website that uses `@asiyst/sdk` to an Asiyst project. It does not render the avatar, chatbot, dashboard, or analytics UI.

## Install

```sh
npx @asiyst/cli
# or
npm install -g @asiyst/cli
```

## Commands

`asiyst` detects the current project and opens an interactive command prompt. Use `asiyst connect --project-id <PROJECT_ID>` or `asiyst connect` to start the authentication and project connection flow. The CLI requires an explicit public Project ID when connecting a project; it will not silently infer or substitute the developer account user ID.

Other commands are `login`, `logout`, `status`, `verify`, `doctor`/`diagnostics`, `dashboard`, `avatar`, `update`, `trust`, and `revoke-trust`.

`asiyst login` starts browser authorization with a randomly assigned localhost callback. The CLI registers the callback and state with `POST /cli/auth/challenge`, opens the returned Asiyst authorization URL, validates the one-time callback code and state, consumes the challenge, and securely stores the verified CLI session. Approval in the browser alone is not treated as a successful login. No User ID, project ID, or API key is requested by login.

```sh
asiyst connect --project-id K8mP2xQ7_vL4N9cR5T1zB6Y3
asiyst status
asiyst avatar import --avatar-id A7K9M2QX4P
asiyst disconnect
```

The connection flow verifies the authenticated account, selected 24-character Project ID, API key, and selected 10-character Avatar ID. The API verifies that the account, key, selected project, and avatar belong together before the connection is saved. Use `asiyst connect --project-id <PROJECT_ID> --avatar-id <AVATAR_ID>` to provide both IDs non-interactively; otherwise the CLI opens the relevant dashboard pages and prompts for them.

Avatar import calls the authenticated CLI project import operation and sends `userId`, `projectId`, and `avatarId` as identifiers; the API key is sent only through authentication headers. The server remains responsible for ownership, project access, avatar existence, active-project checks, and duplicate detection.

After the server accepts the import, the CLI detects the framework, installs `@asiyst/sdk` with the project package manager when needed, and creates or updates the managed `src/components/AsiystAssistant.tsx`/`.jsx` component. It adds that component to a detected Next.js or React/Vite entry point without putting the secret API key in website code. Use `asiyst avatar import --dry-run` to inspect the files and configuration before making changes. If an existing integration uses a different project or avatar, the CLI asks before replacing it; it never creates numbered duplicate components.

GitHub is not part of this CLI flow. GitHub repository authorization and Knowledge Base configuration are managed by Asiyst Web and Supabase. The web dashboard may connect a Knowledge Base to an avatar, but `asiyst avatar import` does not request GitHub credentials, download repository content, or block an import when GitHub is not connected. The website only receives the SDK integration; the avatar retrieves configured knowledge through the Asiyst backend.

The separation is:

```text
GitHub repository
  -> Asiyst Knowledge Base
  -> Avatar knowledge configuration
  -> Asiyst backend
  -> @asiyst/sdk
  -> Website visitor
```

The CLI remains limited to:

```text
User verification
  -> Project verification
  -> API key verification
  -> Avatar verification
  -> Avatar import
  -> SDK integration
```

Interactive startup performs a lightweight npm version check. If a newer release exists, the CLI only displays a notification. It never installs or restarts automatically; run `update` and confirm to install it. Global installations are updated in place. For npx invocations, the latest package is downloaded and verified for that invocation without changing the website project.

The CLI checks `GET /health` and verifies the complete connection relationship through `POST /verify/user`, `POST /verify/project`, `POST /verify/api-key`, and `POST /verify/avatar` on `https://nqhxpgsjofzqudyqkqib.supabase.co/functions/v1/api`. It creates an import session with `POST /import-session` before importing an avatar. Passwords, AI provider keys, Supabase keys, and private API credentials are never placed in URLs or logged.

After User ID verification, the CLI creates a persistent onboarding session with `POST /cli/onboarding/session` and stores its short-lived session reference using the existing OS-protected credential store. Browser pages are opened through `POST /cli/onboarding/handoff`, authenticated with that reference in request headers. The response must contain a short-lived, single-use `handoffToken`; only that token is placed in `https://asiyst.com/cli/onboarding/handoff?token=...`. The web handoff endpoint must validate and consume the token, establish the existing web session for its verified User ID, and redirect directly to the requested page (for example `/project/new`) without routing through `/register`. Invalid or expired sessions must return `SESSION_EXPIRED`, so the CLI can ask the user to reconnect rather than silently restarting registration.

Production API defaults to `https://nqhxpgsjofzqudyqkqib.supabase.co/functions/v1/api`.

## Required web API

The web application must implement the session endpoints above, `GET /api/v1/cli/projects/:projectId`, `POST /api/v1/cli/verification`, and the authenticated `POST /cli/projects/:projectId/avatars/import` operation used by avatar import. The import operation must verify the authenticated API key, account/project access, avatar existence, active project state, and duplicate imports; it must return an explicit imported result or an error. Verification must return authoritative checks for project validity, key validity, API reachability, domain authorization, SDK heartbeat, published configuration, and avatar availability. The CLI does not fabricate these results or connect directly to Supabase.

## Development

```sh
npm run build
npm test
npm pack --dry-run
```
