# Asiyst SDK + CLI

Developer tools for connecting a website to Asiyst:

- **`@asiyst/sdk`** is the browser runtime that renders and controls an Asiyst avatar, inspects safe page metadata, resolves website targets, runs guided tasks, and communicates with the Asiyst API.
- **`@asiyst/cli`** is the Node.js command-line tool published with the `asiyst` executable. It detects a local project, manages folder trust, opens browser authentication (`https://asiyst.com`), verifies API keys, checks status, and manages connection information.

The packages live in this single monorepo. The CLI does not bundle the SDK, and the SDK does not contain the CLI.

> **Current package versions:** `@asiyst/sdk` `0.1.6` and `@asiyst/cli` `1.1.0`.
>
> **Production API:** `https://nqhxpgsjofzqudyqkqib.supabase.co/functions/v1/api` is the active production API base URL for both CLI and SDK.

## Quick facts

- Monorepo: `packages/sdk` + `packages/cli`
- Local project detection: project type, framework, package manager, and SDK presence
- Guided onboarding: folder trust + browser-based connection flow
- Secure-by-default pattern: public project identifiers are used for browser-side initialization; private credentials are not printed or uploaded from the terminal

## Contents

- [Architecture](#architecture)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick start](#quick-start)
- [CLI reference](#cli-reference)
- [Connect workflow](#connect-workflow)
- [Project detection and trust](#project-detection-and-trust)
- [SDK integration](#sdk-integration)
- [SDK API](#sdk-api)
- [Configuration and environment](#configuration-and-environment)
- [API architecture](#api-architecture)
- [Avatar and website interaction](#avatar-and-website-interaction)
- [Examples](#examples)
- [Development](#development)
- [Publishing and updates](#publishing-and-updates)
- [Uninstallation](#uninstallation)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [Repository structure](#repository-structure)
- [FAQ](#faq)

## Architecture

```text
Developer website
      │
      ├── @asiyst/sdk ── HTTPS ── https://nqhxpgsjofzqudyqkqib.supabase.co/functions/v1/api
      │                         └── project configuration, heartbeat,
      │                             tasks, conversations, analytics
      │
      └── Asiyst CLI ──── HTTP ─── https://nqhxpgsjofzqudyqkqib.supabase.co/functions/v1/api
                           │       └── /v1/auth/verify-key, /v1/health
                           │
                           └── browser ── https://asiyst.com (API Key creation)
```

The intended flow is:

1. A developer installs `@asiyst/sdk` in a website.
2. The developer runs `@asiyst/cli` from that project.
3. The CLI detects the project and asks for folder trust.
4. The CLI opens a short-lived browser authorization session.
5. Asiyst returns project information after the server confirms the connection.
6. The website initializes the SDK with its public project identity.
7. The SDK loads project avatar configuration and sends safe runtime data to Asiyst.

The current CLI implementation does not automatically install the SDK, edit application source files, or create a project `.env` file. If the SDK is missing, it prints the installation command and stops.

## Requirements

### Runtime

- Node.js **18.18 or newer** for the CLI and repository tooling.
- npm is used for the documented workspace and publishing commands.
- A browser is required for the CLI's browser-based authentication and for dashboard/avatar links.
- A browser environment with `fetch`, DOM APIs, `localStorage`, `window`, and `document` is required by the SDK.
- WebGL, a 3D model, and a separate avatar asset are **not required by the current SDK**. The shipped avatar renderer is CSS/DOM based.

### Project detection

The CLI reads the current directory's `package.json` and recognizes these dependency/configuration signals:

| Project signal | Detection result |
|---|---|
| `next` dependency or `next.config.js`/`.mjs` | Next.js |
| `react` dependency | React |
| `vite` dependency or `vite.config.js`/`.ts` | Vite |
| `vue` dependency | Vue |
| None of the above | Vanilla JavaScript/TypeScript |

It also reports JavaScript or TypeScript, based on the presence of `tsconfig.json`, `src`, or `app`, and identifies npm, pnpm, yarn, or bun from lockfiles. Detection is heuristic; it does not install a framework or validate that a development server runs.

## Installation

### SDK

```bash
npm install @asiyst/sdk
```

The package currently declares version `0.1.6`, ESM and CommonJS entrypoints, and TypeScript declarations.

### CLI

Use the scoped package name:

```bash
# Run without a permanent global install
npx @asiyst/cli --help

# Install globally; provides the `asiyst` executable
npm install -g @asiyst/cli
asiyst --help
```

The CLI package currently declares version `1.1.0` and provides:

```json
{
  "bin": {
    "asiyst": "dist/index.js"
  }
}
```

The unscoped npm package/alias `asiyst` is not currently published. Do not rely on `npx asiyst`; use `npx @asiyst/cli`.

## Quick start

From an existing website project:

```bash
npm install @asiyst/sdk
npx @asiyst/cli connect
```

Then initialize the SDK in browser code:

```ts
import { Asiyst } from "@asiyst/sdk";

await Asiyst.init({
  projectId: "YOUR_PROJECT_ID",
  publicKey: "YOUR_PUBLIC_PROJECT_KEY",
});
```

`projectId` and `publicKey` identify the project. They are sent as public project headers by the SDK; they are not substitutes for server credentials.

## CLI reference

The CLI entrypoint is `packages/cli/src/index.ts`. With no command, an interactive menu is shown in a TTY. With a command, the command runs directly.

| Command | Purpose | Network/filesystem behavior |
|---|---|---|
| `asiyst` | Show project information and interactive menu | Detects the current project; menu itself does not require folder trust |
| `asiyst connect` | Trust the folder, check the project, and start browser connection | Reads `package.json` and project metadata; contacts the API; opens a browser |
| `asiyst init` | Alias for `connect` | Same as `connect` |
| `asiyst status` | Show local SDK/config state and remote project information when configured | Reads `package.json` and environment; calls the project endpoint when project values exist |
| `asiyst diagnostics` | Run installation and API diagnostics | Checks Node, npm availability, project files, SDK detection, public configuration, health, and project connection |
| `asiyst doctor` | Alias for `diagnostics` | Same as `diagnostics` |
| `asiyst verify` | Verify SDK/project configuration through the server | Requires `ASIIYST_PROJECT_ID` and `ASIIYST_PUBLIC_KEY`; calls the verification endpoint |
| `asiyst dashboard` | Open the dashboard in a browser | Opens `https://asiyst.com/dashboard` by default |
| `asiyst avatar` | Show remote avatar status or open the dashboard when no project is configured | Calls project information when configured; otherwise opens the dashboard |
| `asiyst update` | Check npm for a newer CLI and update an npx/global installation after confirmation | Never updates silently; a fresh process is required after an update |
| `asiyst login` | Start the same browser connection flow as `connect` | Does not ask for a password |
| `asiyst logout` | Print that local CLI session information was removed | The current implementation does not persist an authentication token |
| `asiyst trust` | Trust the current folder | Writes the user-level trust list |
| `asiyst revoke-trust` | Remove the current folder from the trust list | Writes the user-level trust list |
| `asiyst help` | Print command help | No network required |
| `asiyst --help`, `-h` | Print command help | No network required |
| `asiyst --version`, `-v`, `version` | Print the CLI package version | No network required |

### Interactive keyboard controls

The shared selector in `packages/cli/src/ui/selector.ts` supports:

- **Up/Down:** move the selection
- **Enter:** select the highlighted item
- **Escape:** cancel the current prompt
- **Tab:** autocomplete a unique match or cycle suggestions
- **Backspace:** edit typed input
- **Ctrl+C:** cancel cleanly
- **Ctrl+D:** exit the selector

The selector uses Node's keypress events and restores stdin raw mode when it finishes. The implementation is intended for PowerShell, Windows Terminal, VS Code terminals, macOS terminals, and Linux terminals. Automated tests cover command behavior, but this repository does not include a physical keystroke integration test for every terminal host.

## Connect workflow

`asiyst connect` currently performs this sequence:

1. Detect the current directory and read `package.json`.
2. Ask whether the folder is trusted.
3. Detect the framework, language, package manager, and installed SDK dependency.
4. Stop with an install instruction if `@asiyst/sdk` is not listed in `package.json`.
5. Ask whether to connect the project.
6. Call `GET /api/v1/health`.
7. Create a short-lived connection session with `POST /api/v1/cli/sessions`.
8. Open the server-provided HTTPS `connectUrl` in the browser.
9. Poll `GET /api/v1/cli/sessions/:sessionId/status`.
10. Stop on `completed`, `expired`, or `cancelled`.
11. Display the project information returned by the server.

The CLI does not accept an Asiyst password in the terminal. It does not print tokens, upload the entire project, install the SDK automatically, write SDK source code, or create application configuration files. The web application must provide the session endpoints and return the authoritative project result.

## Project detection and trust

### Detection

The CLI reads only the current project's `package.json`, selected framework config filenames, lockfile names, and process environment variables. It does not read `.env`, `.env.local`, private keys, `node_modules`, or the project source tree for upload.

If `package.json` is missing, `connect` stops with a clear project error. A directory with a package file but no recognized framework is reported as Vanilla JavaScript/TypeScript; this is a fallback label, not proof that the project is a particular framework.

### Trusted folders

The first connection prompt is:

```text
Trust this project folder?

D:\path\to\project

Asiyst may read project files and modify Asiyst configuration during setup.
```

`Yes`/`y` records the resolved folder path in the user-level file:

```text
~/.config/asiyst/trusted-folders.json
```

On Windows, `~` is the user's home directory. The implementation attempts to create the directory with mode `0700` and the file with mode `0600` where the platform supports those permissions.

`No` cancels the command before the connection request and does not modify the project. Trust is a local allowlist for this CLI; it is not a sandbox and does not grant the server access to the project.

## SDK integration

### Initialization

```ts
import { Asiyst } from "@asiyst/sdk";

await Asiyst.init({
  projectId: "YOUR_PROJECT_ID",
  publicKey: "YOUR_PUBLIC_PROJECT_KEY",
  mode: "guided",
  observeHistory: true,
});
```

Required fields:

- `projectId: string`
- `publicKey: string`

Optional fields:

- `apiBaseUrl`: explicit override for a controlled non-production API
- `mode`: `"guided"` or `"assist"`
- `allowedActions`: action kinds permitted by the local runtime
- `observeHistory`: whether SPA history changes are observed; defaults to enabled

Calling `init` more than once without `Asiyst.destroy()` throws an initialization error. Initialization mounts an isolated `#asiyst-host` shadow-DOM root, starts observers and analytics, renders the fallback avatar immediately, refreshes project configuration, and sends a heartbeat.

### Cleanup

```ts
await Asiyst.destroy();
```

Destroying the runtime stops observers, movement/highlight handlers, timers, the history observer, and analytics flushing, then removes the SDK host.

### Browser-safe public configuration

The SDK may contain only public project identifiers:

- `projectId`
- `publicKey`

Never put provider keys, database passwords, Supabase service-role keys, signing keys, or server authentication secrets in browser code.

## SDK API

The package exports `Asiyst`, `SDK_VERSION`, configuration/schema helpers, security helpers, geometry helpers, errors, task states, and TypeScript types. The main runtime API is:

```ts
Asiyst.init(options)
Asiyst.destroy()
Asiyst.open()
Asiyst.close()
Asiyst.getConfig()
Asiyst.getConnectionStatus()

Asiyst.avatar.show()
Asiyst.avatar.hide()
Asiyst.avatar.moveTo(target)
Asiyst.avatar.pointAt(target)
Asiyst.avatar.highlight(target, style?)
Asiyst.avatar.speak(message)
Asiyst.avatar.think()
Asiyst.avatar.celebrate()
Asiyst.avatar.setPosition(x, y)

Asiyst.task.start("request text")
Asiyst.task.start(taskDefinition)
Asiyst.task.cancel()
Asiyst.workflow.start(workflowId)

const unsubscribe = Asiyst.on(eventName, handler)
Asiyst.off(eventName, handler)
```

Targets can be an Asiyst identifier or a target reference:

```ts
Asiyst.avatar.highlight("checkout");
await Asiyst.avatar.moveTo({
  id: "checkout",
  role: "button",
  text: "Checkout",
});
```

Mark stable controls in site markup when useful:

```html
<button data-asiyst="checkout"
        data-asiyst-description="Proceed to checkout">
  Checkout
</button>
```

Cloud-provided selectors are accepted only when they match a configured project selector and pass the SDK safety checks. Guided interactions wait for the user rather than silently clicking or typing on their behalf.

## Configuration and environment

### SDK configuration

SDK initialization is the only application configuration file/API documented by this repository. Remote avatar/project configuration is fetched from the server and cached in namespaced browser `localStorage`; the SDK does not create a project config file.

The normalized remote configuration includes avatar identity, size, position, theme, personality, behavior, mode, allowed actions, and configured element selectors. If refresh fails, the last cached or fallback configuration remains available and the connection status reports the runtime condition.

### CLI files

| File | Location | Purpose | Commit? |
|---|---|---|---|
| `package.json` | Developer project | Read for framework and `@asiyst/sdk` detection | Already part of the project; preserve it |
| `~/.config/asiyst/trusted-folders.json` | User home | Local trusted-folder list | Not part of the project; do not commit |
| `.env` / `.env.*` | Developer project | Not read by project detection | Do not create for CLI credentials |

The current `connect` command prints project credentials returned by the server for the developer to configure; it does not write them into source files or `.env`.

### Environment variables

| Variable | Required | Used by | Purpose | Secret? |
|---|---:|---|---|---|
| `ASIIYST_API_URL` | No | CLI API client | Explicit API base override for controlled non-production deployments; default is `https://asiyst.com/api/v1` | Treat deployment URLs as configuration, not credentials |
| `ASIIYST_DASHBOARD_URL` | No | `dashboard` | Override the dashboard browser URL; default is `https://asiyst.com/dashboard` | No, but must use HTTPS |
| `ASIIYST_PROJECT_ID` | For `verify` and remote status/diagnostics | Project detection | Public project identifier | No |
| `ASIIYST_PUBLIC_KEY` | For `verify` and remote status/diagnostics | Project detection | Public project key | No |
| `ASIIYST_DOMAIN` | No | `verify` | Optional domain sent to server verification | No |

The SDK's `apiBaseUrl` is an initialization option rather than an environment variable. `NODE_ENV` is not read by the current CLI; SDK heartbeat environment is derived from whether `apiBaseUrl` was explicitly overridden.

## API architecture

Production URLs are centralized as:

- Web: `https://asiyst.com`
- API: `https://asiyst.com/api/v1`

### CLI API

The CLI uses these paths relative to the production API base:

| Method | Path | Use |
|---|---|---|
| `GET` | `/health` | API reachability |
| `POST` | `/cli/sessions` | Start short-lived browser authorization |
| `GET` | `/cli/sessions/:sessionId/status` | Poll session state |
| `GET` | `/cli/projects/:projectId` | Retrieve project status |
| `POST` | `/cli/verification` | Verify project, key, domain, heartbeat, configuration, and avatar checks |

### SDK API

The SDK sends public project headers, including `X-Asiyst-Project-Id`, `X-Asiyst-Public-Key`, and `X-Asiyst-SDK-Version`. Its current request paths are:

| Method | Path | Use |
|---|---|---|
| `GET` | `/projects/:projectId/avatar` | Load project/avatar configuration |
| `POST` | `/sdk/heartbeat` | Send safe SDK runtime metadata |
| `POST` | `/tasks` | Request a task plan |
| `POST` | `/tasks/:taskId/events` | Report task progress |
| `GET` | `/workflows/:workflowId` | Load a workflow |
| `POST` | `/conversations/messages` | Request a conversation response |
| `POST` | `/website-maps` | Send safe visible-element metadata |
| `POST` | `/analytics` | Send allowlisted batched product events |

The SDK strips query strings and hashes from website-map page URLs, excludes input values, and does not upload the entire project.

## Avatar and website interaction

### Avatar

The current SDK avatar is a CSS/DOM renderer mounted inside a shadow root. It supports:

- show/hide
- idle, pointing, thinking, speaking, walking, and celebration poses
- speech text
- configurable name, size, position, theme, and behavior
- movement beside a resolved page element
- reduced-motion handling

Avatar configuration is owned by the Asiyst project and loaded through the project avatar endpoint. The CLI's `avatar` command displays the server-reported avatar status when a project is configured; without project configuration it opens the dashboard. A separate 3D model-selection workflow is **not currently implemented**.

### Target resolution and guidance

The SDK can inspect buttons, links, inputs, forms, navigation, headings, dialogs, tabs, and other supported landmarks. It creates a safe website map containing visible metadata and can resolve:

- `data-asiyst` identifiers
- configured selectors
- developer-provided safe selectors
- semantic role/text references

The task engine validates action transitions and permissions. Cloud task plans are revalidated by the SDK before execution, and guided actions wait for user interaction where required.

### Events

The typed event bus includes initialization/ready/destroyed, avatar shown/hidden/moved, target found/not-found/highlighted, user clicked, task started/step-completed/completed/failed/cancelled, conversation started/message/closed, and SDK errors.

Analytics allowlists product events such as assistant opened/closed, questions, tasks, guidance, highlights, instructed clicks, and missing targets. Events are batched and retried; ingestion failures do not crash the host page.

## Examples

The existing example is `examples/vanilla`:

- `index.html` contains a small page with Asiyst-marked controls.
- `main.ts` imports the SDK source and initializes it with placeholder public project values.

It has no package-local start script. Run it through a browser/toolchain that can load TypeScript, or adapt the source into your own website. Replace the placeholder project values with values from your Asiyst project. The example is not a complete production website or a mocked Cloud server.

## Development

The repository is an npm workspace:

```text
packages/sdk
packages/cli
```

From the repository root:

```bash
npm install
npm run typecheck
npm test
npm run build
```

Available root scripts are exactly:

- `npm run typecheck`
- `npm test`
- `npm run build`

There is no root `lint`, `clean`, or development-server script.

### SDK development

```bash
npm run typecheck -w @asiyst/sdk
npm run test -w @asiyst/sdk
npm run build -w @asiyst/sdk
npm pack --workspace @asiyst/sdk --dry-run
```

SDK output is written to `packages/sdk/dist` and includes ESM, CommonJS, and declaration files. The package publishes only `dist` and `README.md` in addition to its manifest.

### CLI development

```bash
npm run typecheck -w @asiyst/cli
npm run test -w @asiyst/cli
npm run build -w @asiyst/cli
node packages/cli/dist/index.js --help
npm pack --workspace @asiyst/cli --dry-run
```

The CLI output is `packages/cli/dist/index.js`. Its package `bin` field creates the `asiyst` executable on installation.

## Publishing and updates

### Release checklist

1. Change the version in the package being released:

   ```bash
   npm version patch --workspace @asiyst/sdk --no-git-tag-version
   npm version patch --workspace @asiyst/cli --no-git-tag-version
   ```

2. Synchronize the lockfile:

   ```bash
   npm install --package-lock-only
   ```

3. Run typechecks, tests, and builds.
4. Inspect package contents:

   ```bash
   npm pack --workspace @asiyst/sdk --dry-run
   npm pack --workspace @asiyst/cli --dry-run
   ```

5. Authenticate to npm with `npm login`; never commit npm tokens.
6. Publish each scoped package separately:

   ```bash
   npm publish --workspace @asiyst/sdk --access public
   npm publish --workspace @asiyst/cli --access public
   ```

7. Verify:

   ```bash
   npm view @asiyst/sdk version
   npm view @asiyst/cli version
   npm install @asiyst/sdk@latest
   npx @asiyst/cli@latest --version
   ```

This repository does not define an automated release workflow or a required Git tag process.

### Updating

```bash
npm install @asiyst/sdk@latest
npm install -g @asiyst/cli@latest
npx @asiyst/cli@latest --version
```

`asiyst update` checks the npm registry, asks for confirmation, updates supported npx/global installations, verifies the installed version, and tells the user to restart the CLI. It does not silently update and cannot change the JavaScript already loaded by the current process. Local project installations are reported as requiring their package manager.

## Uninstallation

Remove the SDK from a website project:

```bash
npm uninstall @asiyst/sdk
```

Remove the global CLI:

```bash
npm uninstall -g @asiyst/cli
```

Remove a trusted folder entry from the current directory:

```bash
asiyst revoke-trust
```

Uninstallation does not remove manually added SDK imports, markup attributes, browser `localStorage` namespaces, or dashboard-side project data. Review those separately before deleting them.

## Troubleshooting

### `Asiyst API returned HTTP 404`

**Cause:** The requested route is not deployed at the configured API base, or the path does not match the web application's contract.

**Check:**

```bash
node -e "fetch('https://asiyst.com/api/v1/health').then(async r => console.log(r.status, r.headers.get('content-type'), await r.text()))"
```

The current production health endpoint returns JSON, while the connection session route has returned 404. This must be fixed in the web application before `connect` can complete.

### Invalid JSON or HTML from the API

The CLI rejects a successful HTML/empty response as an invalid API response. Check that the request reaches `/api/v1`, that the web deployment is not serving a parked-domain or application HTML page, and rerun `asiyst diagnostics`.

### HTTP 401, 403, 409, 422, or 429

The CLI maps these to human-readable messages:

- **401:** authentication required
- **403:** request is not authorized
- **404:** resource/endpoint not found
- **409:** request conflicts with current project state
- **422:** request data is invalid
- **429:** too many requests
- **5xx:** Asiyst is temporarily unavailable

Confirm the project identity, browser authorization state, server contract, and API rate limits. Do not paste credentials into terminal output.

### SDK is not detected

Run:

```bash
npm install @asiyst/sdk
```

Then confirm `@asiyst/sdk` appears in `dependencies`, `devDependencies`, `peerDependencies`, or `optionalDependencies` in the current project's `package.json`.

### Project is not connected

Set the public values in the invoking environment for commands that require them:

```powershell
$env:ASIIYST_PROJECT_ID = "YOUR_PROJECT_ID"
$env:ASIIYST_PUBLIC_KEY = "YOUR_PUBLIC_PROJECT_KEY"
asiyst status
asiyst diagnostics
asiyst verify
```

The current `connect` flow still requires the production session API to be deployed.

### Old CLI version or stale npx behavior

Inspect the executable:

```powershell
Get-Command asiyst
where.exe asiyst
asiyst --version
npx @asiyst/cli@latest --version
```

Use the scoped package explicitly. Remove stale global installations with `npm uninstall -g @asiyst/cli`, then reinstall the desired version. The unscoped `asiyst` npm alias is not published.

### Arrow keys print escape sequences

Use a real TTY such as Windows Terminal, PowerShell, CMD, or VS Code's terminal. Do not pipe interactive commands. Ensure only one CLI installation is being invoked and that the installed package is the current `@asiyst/cli`; the shared selector is responsible for raw key handling.

### Node or build failures

Check Node:

```bash
node --version
npm --version
npm install
npm run typecheck
npm run build
```

The repository requires Node 18.18+. TypeScript, tsup, Vitest, and jsdom are development dependencies of the packages.

## Windows support

The CLI package uses Node's cross-platform process, filesystem, URL, child-process, and readline APIs. On Windows:

- `npm install -g @asiyst/cli` creates a PowerShell/CMD-resolvable `asiyst` shim.
- `rundll32.exe` opens dashboard and authorization URLs.
- Trusted-folder paths are resolved as Windows absolute paths.
- Ctrl+C should cancel the active selector and restore the terminal.
- `Get-Command asiyst` and `where.exe asiyst` show which installation is being used.

## Security

- Folder trust is stored locally and is required before `connect` reads project metadata.
- Authentication is browser-based; the CLI never asks for an Asiyst password.
- The CLI keeps connection session data in memory during the polling flow; it does not implement an OS credential-store integration or persistent auth token storage.
- The SDK uses public project identifiers and sends only safe heartbeat, map, task, conversation, and allowlisted analytics data.
- Website maps omit query strings and input values. The SDK does not upload the entire project.
- Cloud selectors are safety-checked and restricted to configured selectors.

Never commit:

```text
.env
.env.local
*.pem
*.key
access tokens
API keys
service-role keys
database passwords
private signing keys
npm tokens
```

The repository `.gitignore` excludes dotenv files, `node_modules`, build output, coverage, logs, caches, and TypeScript build metadata. Public project IDs/keys may appear in local examples as placeholders, but use placeholders in committed documentation.

## Version compatibility

The repository has no explicit SDK/CLI peer dependency or compatibility matrix. The CLI detects whether `@asiyst/sdk` appears in the project and reports the declared version, but it does not enforce a supported range. Keep both packages current and verify the resulting website against the API contract.

## Repository structure

```text
Asiyst-SDK-CLI/
├── packages/
│   ├── sdk/
│   │   ├── src/              Browser runtime, avatar, DOM, tasks, API, events
│   │   ├── tests/            SDK Vitest tests
│   │   ├── package.json      @asiyst/sdk package metadata and exports
│   │   ├── tsup.config.ts    SDK bundling
│   │   └── vitest.config.ts  SDK test configuration
│   └── cli/
│       ├── src/              CLI entrypoint, commands, API, trust, UI, detection
│       ├── tests/            CLI Vitest tests
│       ├── package.json      @asiyst/cli metadata and asiyst bin
│       ├── tsup.config.ts    CLI bundling
│       └── vitest.config.ts  CLI test configuration
├── examples/
│   └── vanilla/              Existing vanilla HTML/TypeScript example
├── docs/
│   ├── API.md                SDK API and endpoint notes
│   ├── ARCHITECTURE.md       Runtime architecture
│   ├── SECURITY.md           SDK security model
│   └── TROUBLESHOOTING.md    Additional troubleshooting
├── package.json              Private npm workspace root
├── package-lock.json         Locked workspace dependencies
├── tsconfig.base.json        Shared TypeScript settings
├── LICENSE
└── README.md
```

## FAQ

### What is Asiyst?

Asiyst is the web application and API that own project authentication, project configuration, avatar configuration, task planning, conversations, and analytics ingestion. This repository supplies the browser SDK and CLI clients.

### Do I need both packages?

You need `@asiyst/sdk` to run Asiyst in a website. The CLI is useful for project detection, browser connection, verification, diagnostics, and dashboard workflows, but the SDK can be initialized directly without the CLI when you already have valid public project values.

### Can I use the CLI without the SDK?

Yes, commands such as `help`, `dashboard`, `diagnostics`, and project detection can run without the SDK. `connect` stops and prints the SDK installation command when the SDK is not listed in the project.

### Does the CLI modify my application code?

The current implementation does not install dependencies or rewrite source files. It reads project metadata, stores a user-level trusted-folder entry when approved, opens browser URLs, and prints configuration guidance.

### Where does authentication happen?

In the browser at a server-provided HTTPS connection URL. The CLI does not collect an Asiyst password.

### Where is avatar configuration stored?

Avatar configuration belongs to the Asiyst project. The SDK fetches it from the project avatar endpoint and caches the last valid configuration in namespaced browser `localStorage`.

### Can I use React, Next.js, Vite, Vue, or vanilla JavaScript?

The CLI detects React, Next.js, Vite, and Vue dependency/configuration signals, and falls back to Vanilla JavaScript/TypeScript. The SDK itself is a browser runtime and does not require a framework adapter.

### What should I do if `connect` returns 404?

Run `asiyst diagnostics` and check the exact API base. A 404 from `/api/v1/cli/sessions` means the web application's connection route is missing or does not match the client contract; changing the displayed error does not solve that deployment issue.

### How do I update?

Use `npm install @asiyst/sdk@latest`, `npm install -g @asiyst/cli@latest`, or `asiyst update` for the CLI's confirmed update flow. Use `npx @asiyst/cli@latest` to run a specific current CLI version without installing it globally.

## License

This project is licensed under the [MIT License](LICENSE).
