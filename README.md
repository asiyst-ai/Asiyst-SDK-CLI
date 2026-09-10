# Asiyst SDK

## Asiyst CLI

Install the CLI from the existing workspace package:

```bash
npm install -g @asiyst/cli
# or run it without a global install
npx @asiyst/cli
```

### Authentication

#### `/login`

Starts browser authorization with a temporary localhost callback. The CLI creates a cryptographically random state, sends its `redirectUri` and state to `POST /cli/auth/challenge`, opens the returned authorization URL, validates the callback (`browser_session_id`, one-time `code`, issuer, and state), and consumes the authorization through `POST /cli/auth/challenge/:challengeId/consume`. Only after the returned CLI session is stored and verified does the CLI report success. Login does not require a User ID, project ID, or API key.

```text
asiyst › /login
```

#### `/logout`

Clears the local CLI authentication session. It does not delete the Asiyst account, projects, API keys, avatars, or knowledge.

```text
asiyst › /logout
```

If no session exists, the CLI reports that the user is not currently logged in. Expired sessions request `/login` rather than restarting registration.

### Commands

| Command | Purpose | Authentication | Expected behavior |
|---|---|---:|---|
| `/connect` | Connect the current website project to Asiyst. | Setup flow | Verifies the user, project, and API key, then stores the connection. |
| `/status` | Show and verify the current project connection. | Existing connection | Displays project, API key, SDK, avatar, and website status. |
| `/verify` | Verify SDK installation, project, avatar, domain, and backend integration. | Existing connection | Runs local inspection and real backend verification. |
| `/project` | Show the current project or open project selection. | Project context | Uses the current project and dashboard. |
| `/avatar` | Manage or import an avatar. | Connected project | Reuses avatar verification, import, and SDK integration. |
| `/sdk` | Verify the local SDK integration. | Existing connection | Runs the same integration verification as `/verify`. |
| `/api` | Check Asiyst API health. | No | Calls the real API health endpoint. |
| `/login` | Authenticate the CLI with an Asiyst account. | No | Opens the browser login flow and persists the verified session. |
| `/logout` | Clear the CLI authentication session. | No | Removes only local authentication state. |
| `/test` | Test account, project, API, SDK, avatar, domain, and backend integration. | Yes | Runs real local and backend checks and reports failures. |
| `/validate` | Validate project, credentials, SDK, files, avatar, domain, and backend configuration. | Yes | Stops with actionable errors when configuration is incomplete. |
| `/deploy` | Deploy the current Asiyst configuration. | Yes | Validates first, then calls the real project deployment endpoint. |
| `/publish` | Publish the configured avatar and configuration. | Yes | Validates first, then calls the real publication endpoint. |
| `/knowledge` | Open the project Knowledge Base. | Yes | Opens the authenticated Knowledge Base with project context. |
| `/knowledge sync` | Synchronize connected knowledge sources. | Yes | Uses a real sync endpoint when exposed; otherwise explains that sync is dashboard-managed and opens Knowledge Base. |
| `/update` | Check for and install a newer CLI version. | No | Uses the existing update flow. |
| `/doctor` | Diagnose CLI, project, credentials, and API state. | No | Runs existing diagnostics without modifying the project. |
| `/help` | Show all available slash commands. | No | Includes command descriptions and interactive shortcuts. |
| `/exit` | Leave interactive mode. | No | Exits the terminal panel. |

All commands are entered through the existing `asiyst ›` interactive input area. Type `/` to see suggestions. `/knowledge` and `/knowledge sync` are both recognized. Deployment and publication never display success unless the backend confirms the operation; if the current backend does not expose the requested operation, its API error is shown instead of a fabricated result.

### Verification and SDK heartbeat

`@asiyst/sdk` sends a backend heartbeat after initialization through the configured API base URL. The request contains only the project ID, public SDK key, SDK package version injected at build time, website origin, environment, and timestamp. It never sends private API keys, passwords, or OAuth secrets. The backend determines whether the project, public key, and origin are authorized.

The SDK exposes only safe connection states through `Asiyst.getConnectionStatus()` and `Asiyst.getVerificationStatus()`. A network failure, inactive project, invalid origin, or backend rejection is not reported as verified.

The CLI obtains domain and SDK connection status from authenticated project verification responses. `/status`, `/verify`, `/test`, and `/validate` do not calculate DNS state locally and show `Not available`, `Not detected`, or `Failed` when the backend does not confirm a result.

## Web Integration Required

The CLI repository does not contain the Asiyst Web application. The CLI does not emulate web authentication, create browser sessions locally, or report success without a backend response. The production API configured by `@asiyst/cli` must be backed by these web/backend contracts:

```text
POST /cli/auth/challenge
GET  /cli/auth/challenge/:challengeId
POST /cli/onboarding/session
POST /cli/onboarding/handoff
```

`POST /cli/auth/challenge` receives the CLI's localhost `redirectUri`, random `state`, CLI version, and platform metadata. It returns a short-lived challenge and authorization URL. The browser returns to the temporary localhost callback with a one-time authorization code. The CLI validates the callback locally, then sends the code, state, browser session ID, issuer, and redirect URI to `POST /cli/auth/challenge/:challengeId/consume`. `GET /cli/auth/challenge/:challengeId` is used to observe pending, approved, cancelled, and expired states; approval alone is never treated as authentication.

`POST /cli/onboarding/session` creates a short-lived session from the authenticated CLI session. It accepts an optional `userId`; when omitted, the backend must bind the session to the authenticated account and return the authoritative user ID. `POST /cli/onboarding/handoff` receives the session reference in request headers and an internal destination in the JSON body. It must return a short-lived, single-use handoff token. The CLI places only that handoff token in the browser URL:

```text
https://asiyst.com/cli/onboarding/handoff?token=<short-lived-token>
```

The web handoff endpoint must consume the token, establish the normal Asiyst authenticated session using secure cookies, and redirect directly to the validated internal destination. Supported destinations include `/dashboard`, `/project/new`, `/dashboard/avatar-studio`, `/dashboard/knowledge`, `/dashboard/sdk-installation`, and `/dashboard/api`. It must reject external URLs, protocol-relative paths, expired tokens, replayed tokens, and destinations outside the allowlist. It must never redirect an authenticated user to `/register`.

The web application must use the existing authentication system and secure cookie/session infrastructure. Passwords, service-role keys, private API keys, permanent tokens, and session secrets must never be returned to or embedded in CLI URLs or frontend code. If any required endpoint is missing, the CLI reports the required endpoint contract instead of fabricating a login or handoff.

## Authentication and Onboarding Troubleshooting

- **Web authentication endpoint unavailable:** deploy `POST /cli/auth/challenge` and `GET /cli/auth/challenge/:challengeId` in the web/backend project.
- **CLI onboarding handoff endpoint unavailable:** deploy `POST /cli/onboarding/session` and `POST /cli/onboarding/handoff`.
- **Session expired:** run `/login`; the CLI clears the expired local session and does not restart registration automatically.
- **Project creation:** after authentication, `/connect` opens `/project/new` through the secure handoff, then verifies the returned Project ID with `POST /verify/project`.
- **Avatar, SDK, and Knowledge pages:** use the same authenticated handoff session. Existing API-key and avatar verification still use `POST /verify/api-key` and `POST /verify/avatar`.

Asiyst adds an AI assistant/avatar to your website. The SDK displays the avatar and allows it to understand the current website page and help users navigate and interact with the site.

This package is published as `@asiyst/sdk`. It is the browser-side runtime that connects your website to an Asiyst project and loads the configured avatar.

> Current package versions: `@asiyst/sdk` `0.1.6` and `@asiyst/cli` `1.1.0`
>
> Production API base: `https://nqhxpgsjofzqudyqkqib.supabase.co/functions/v1/api`

## Quick Start

1. Create an Asiyst account and a project.
2. Get the public `Project ID` for the project.
3. Install the SDK:

```bash
npm install @asiyst/sdk
```

4. Connect the project:

```bash
npx @asiyst/cli connect --project-id <PUBLIC_PROJECT_ID>
```

5. Initialize the SDK once in your app root:

```ts
import { Asiyst } from "@asiyst/sdk";

await Asiyst.init({
  projectId: "<PUBLIC_PROJECT_ID>",
  publicKey: "<PUBLIC_KEY>",
});
```

6. Start the website:

```bash
npm run dev
```

7. Open the website and verify that the avatar appears.

## Identity Model

Asiyst uses three distinct identifiers and they should not be confused:

- Supabase User UUID: internal authentication and ownership ID. This is not a public project ID and should not be used in browser configuration.
- Asiyst User ID: public account identifier for the developer account. It identifies the account, not the project.
- Project ID: public project identifier. This is required to connect a website or initialize the SDK.

Use the project ID when connecting the CLI or initializing the SDK. Do not substitute the public user ID or the Supabase UUID.

## Add Asiyst to Your Website

In simple terms, Asiyst adds an AI assistant/avatar to your website. The SDK displays the avatar and uses the browser page context to understand where the user is and what they are looking at.

Basic architecture:

```text
Developer Website
      ↓
   @asiyst/sdk
      ↓
   Asiyst API
      ↓
Asiyst Project + Avatar Configuration
```

A developer does not need to create a separate API just to get started with the Level 1 SDK integration. You connect your website to an Asiyst project, and the SDK handles the browser-to-Asiyst communication for you.

---

# 1. Create Your Asiyst Project

1. Sign in to the Asiyst dashboard.
2. Create a new project.
3. Enter the website/project name.
4. Add the website URL.
5. Save the project.

Example:

```text
Project:
Caszio

Website:
https://caszio.com
```

Asiyst gives the project the credentials and configuration required by the SDK.

---

# 2. Create or Select Your Avatar

1. Open Avatar Studio.
2. Create an avatar or select an existing avatar.
3. Customize the avatar.
4. Configure its greeting, behavior, and appearance.
5. Assign the avatar to the website project.
6. Make sure the avatar is active.

Example:

```text
Caszio Project
      ↓
Caszio Assistant
      ↓
Active
```

The SDK retrieves the assigned avatar configuration when the website loads.

---

# 3. Install the Asiyst SDK

Install the package:

```bash
npm install @asiyst/sdk
```

Verify the installation:

```bash
npm list @asiyst/sdk
```

This command checks your project dependencies and confirms that the `@asiyst/sdk` package is installed. If the package is present, you are ready to connect it to your Asiyst project.

---

# 4. Connect Your Website Using the Asiyst CLI

The current CLI workflow is straightforward:

```bash
npx @asiyst/cli connect
```

The CLI connects your website/project to your Asiyst project and can help verify the project and SDK configuration.

Example flow:

```text
ASIYST

Connect your website to Asiyst?

Project: Caszio

✓ API key verified
✓ Project found
✓ Website connected
```

The developer should use their Asiyst developer/secret API key only during the CLI setup process.

Important:

Never put a secret API key directly into browser/frontend code.

There are two different credentials to understand:

- Developer API key: used in the CLI or server-side environment to authenticate the developer and verify the project. This key is secret and should never be exposed in browser code.
- Public/client key: used by the browser SDK in `new Asiyst(...)`. This is the safe browser-side credential for the frontend.

---

# 5. What the CLI Should Configure

The CLI can detect basic project information and help verify a website connection. In this repository, the current implementation primarily:

- Detects the project/framework.
- Detects the package manager.
- Detects whether `@asiyst/sdk` is installed.
- Verifies your key and project pairing.
- Stores project connection metadata locally for the current project.

The current CLI does not automatically rewrite application source files or inject initialization code into every page. That type of auto-configuration is a planned enhancement, not a current guarantee.

Example project structure:

```text
src/
├── lib/
│   └── asiyst.ts
├── pages/
│   ├── Home.tsx
│   ├── Products.tsx
│   └── Coupons.tsx
└── main.tsx
```

The Asiyst SDK should be initialized once when the application starts. You do not need to paste Asiyst code into every page.

---

# 6. Manual SDK Setup

If the CLI does not automatically configure your project, you can initialize the SDK manually.

```ts
import { Asiyst } from "@asiyst/sdk";

await Asiyst.init({
  projectId: "<PUBLIC_PROJECT_ID>",
  publicKey: "<PUBLIC_KEY>",
});
```

This is the current browser-side API used by the published SDK.

Explanation of each value:

- `projectId`: Required public identifier for the specific Asiyst project. This is not the developer account user ID.
- `publicKey`: A public/client credential used by the browser SDK.

Important:

- `projectId` is required.
- Never use a secret developer API key as the `publicKey`.
- Never use a Supabase user UUID or Asiyst user ID as the `projectId`.

The exact initialization API must match the currently published `@asiyst/sdk` implementation. The current implementation expects `projectId` and `publicKey` and supports optional values such as `apiBaseUrl`, `mode`, and `observeHistory`.

---

# 7. Where to Put the Code

Place the SDK initialization in the application's main/root entry point so it starts once when the app loads.

For React + Vite, a common pattern is `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Asiyst } from "@asiyst/sdk";

async function start() {
  await Asiyst.init({
    projectId: "<PUBLIC_PROJECT_ID>",
    publicKey: "<PUBLIC_KEY>",
  });

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

start();
```

This is the recommended pattern: initialize once at startup, not separately on every page.

Next.js, Vue, Angular, and other frameworks may use different entry points, but the concept is the same: initialize the app once at the root of the application.

---

# 8. What Happens When the Website Loads

```text
Website opens
      ↓
Asiyst SDK starts
      ↓
SDK connects to Asiyst API
      ↓
Project is verified
      ↓
Avatar configuration is loaded
      ↓
Avatar appears on the website
      ↓
SDK understands the current page
      ↓
Avatar can communicate with the user
```

The developer does not need to manually call the Asiyst API for normal SDK usage. The SDK handles that communication internally.

---

# 9. How Asiyst Understands the Website

The current Level 1 capability uses information that is available to the browser, such as:

- Current URL
- Current route
- Page title
- Headings
- Visible text
- Links
- Buttons
- Forms
- Inputs
- Visible product information
- Basic structured data
- Current page context

Example:

If the user is on:

```text
https://caszio.com/coupons
```

Asiyst can understand that the user is currently on the Caszio coupons page.

Important:

Level 1 does not automatically give Asiyst access to the website's entire backend database or all product records.

For example, if a website has 100,000 products but only 20 are visible in the current browser view, the SDK cannot automatically scan or search all 100,000 products from the browser alone.

Advanced API and data integrations can be added later when needed.

---

## Import the Asiyst Avatar

Developers normally do not manually download or import an avatar file. The SDK retrieves the avatar configuration from Asiyst and renders the avatar automatically.

Typical setup:

```bash
npm install @asiyst/sdk
npx @asiyst/cli connect
npm run dev
```

If your project is correctly connected and the avatar is active, the Asiyst avatar should appear automatically on the website.

Do not tell the developer to copy an avatar image into the app unless the current SDK explicitly requires a file-based asset. The current SDK is designed to load avatar configuration from Asiyst.

---

# 11. Testing the Avatar

Use this checklist:

- [ ] Website starts without errors
- [ ] Asiyst avatar appears
- [ ] Avatar can open/close
- [ ] Greeting works
- [ ] Chat works
- [ ] Current page is understood
- [ ] Navigation works when supported
- [ ] Avatar works on desktop
- [ ] Avatar works on mobile
- [ ] No secret API key appears in browser code
- [ ] No console errors

Open your browser's DevTools and check:

- Console tab for errors
- Network tab for API requests
- Page content to confirm the correct page is being detected

---

# 12. Production Setup

1. Test locally first.
2. Build the website.
3. Deploy the website.
4. Add the production domain to the Asiyst project.
5. Make sure the production domain is authorized.
6. Open the production website and test the avatar.

Example production domain:

```text
https://caszio.com
```

Localhost and production domains may need to be configured or authorized separately depending on the current Asiyst backend implementation.

---

# 13. CLI Command Reference

The following commands are currently implemented in the `@asiyst/cli` package and are safe to document:

| Command | Purpose |
|---|---|
| `npx @asiyst/cli` | Start the interactive CLI menu in the current project |
| `npx @asiyst/cli --version` | Print the CLI version |
| `npx @asiyst/cli connect --project-id <PROJECT_ID>` | Explicitly connect a project by public Project ID |
| `npx @asiyst/cli connect` | Interactive project connection flow that prompts for the Project ID |
| `npx @asiyst/cli init` | Alias for `connect` |
| `npx @asiyst/cli status` | Check local project and connection status |
| `npx @asiyst/cli diagnostics` | Run diagnostics |
| `npx @asiyst/cli doctor` | Alias for diagnostics |
| `npx @asiyst/cli avatar` | Check avatar/project information |
| `npx @asiyst/cli avatar import --avatar-id <AVATAR_ID>` | Import a validated avatar into the connected project |
| `npx @asiyst/cli update` | Update the CLI when a newer version is available |
| `npx @asiyst/cli --help` | Display help text |
| `npx @asiyst/cli help` | Display help text |

## Coming Soon

The following items are not currently implemented in this repo and should not be presented as existing commands:

- automatic code injection into every page
- automatic project `.env` generation
- automatic addition of a config file into the app source without user review
- automatic installation of the SDK into every project framework

---

# 14. Updating the SDK and CLI

SDK update:

```bash
npm install @asiyst/sdk@latest
```

CLI update:

```bash
npx @asiyst/cli update
```

The SDK and CLI are separate packages and can have different versions.

---

# 15. Troubleshooting

### Avatar does not appear

Check:

- SDK is installed
- Project ID is correct
- Public key is correct
- Avatar is active
- Website domain is authorized
- Browser console for errors
- Network requests
- Asiyst API availability

### CLI cannot connect

Check:

- Developer API key
- Internet connection
- Asiyst project exists
- CLI version is current
- API endpoint is available

### Avatar appears but does not understand the page

The current Level 1 implementation only understands information available in the browser. Advanced structured data, deeper page understanding, and custom actions can be added later.

---

# 16. Security

Important warning:

NEVER expose secret credentials in frontend code.

Safe:

- public/client key used by the browser SDK

Not safe:

- secret developer API key in browser code
- Supabase service-role keys
- database passwords
- private API keys
- other server secrets

The secret developer API key should only be used by the CLI or a server-side environment. The browser should receive only the public/client credentials needed for the SDK.

---

# 17. Simple Quick Start

```bash
# 1) Create a project in the Asiyst dashboard
# 2) Create or select an avatar
# 3) Install the SDK
npm install @asiyst/sdk

# 4) Connect the project
npx @asiyst/cli connect

# 5) Start the website
npm run dev

# 6) Open the website and verify the avatar appears
```

This is the shortest beginner-friendly path to a working installation.

## Architecture

```text
Developer
      ↓
 @asiyst/cli
      ↓
Project Configuration
      ↓
 @asiyst/sdk
      ↓
Asiyst API
      ↓
Avatar + Website Context
```

The avatar is loaded by the SDK when the site starts. The developer does not need to manually import the avatar into every page.
