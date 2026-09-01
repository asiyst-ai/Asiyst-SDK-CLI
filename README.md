# Asiyst SDK

Asiyst adds an AI assistant/avatar to your website. The SDK displays the avatar and allows it to understand the current website page and help users navigate and interact with the site.

This package is published as `@asiyst/sdk`. It is the browser-side runtime that connects your website to an Asiyst project and loads the configured avatar.

> Current package versions: `@asiyst/sdk` `0.1.6` and `@asiyst/cli` `1.1.0`
>
> Production API base: `https://nqhxpgsjofzqudyqkqib.supabase.co/functions/v1/api`

## Quick Start

1. Create an Asiyst project.
2. Create or select an avatar.
3. Install the SDK:

```bash
npm install @asiyst/sdk
```

4. Connect the project:

```bash
npx @asiyst/cli connect
```

5. Start the website:

```bash
npm run dev
```

6. Open the website and verify that the avatar appears.

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

const asiyst = new Asiyst({
  projectId: "YOUR_PROJECT_ID",
  publicKey: "YOUR_PUBLIC_CLIENT_KEY",
});

await asiyst.init();
```

This is the current browser-side API used by the published SDK.

Explanation of each value:

- `projectId`: Identifies the website/project in Asiyst.
- `publicKey`: A public/client credential used by the browser SDK.

Important:

Never use a secret developer API key as the `publicKey`.

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

const asiyst = new Asiyst({
  projectId: "YOUR_PROJECT_ID",
  publicKey: "YOUR_PUBLIC_CLIENT_KEY",
});

async function start() {
  await asiyst.init();

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
| `npx @asiyst/cli connect` | Start project connection and API-key verification |
| `npx @asiyst/cli init` | Alias for `connect` |
| `npx @asiyst/cli status` | Check local project and connection status |
| `npx @asiyst/cli diagnostics` | Run diagnostics |
| `npx @asiyst/cli doctor` | Alias for diagnostics |
| `npx @asiyst/cli avatar` | Check avatar/project information |
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
