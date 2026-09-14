# @asiyst/sdk

Client-side runtime that connects a website to Asiyst Cloud.

This package does not contain model keys, database credentials, or other server secrets. Identify the project with `projectId` and `publicKey` only. Those values are public project credentials, not secrets.

## Install

```bash
npm install @asiyst/sdk
```

Then connect the project:

```bash
npx @asiyst/cli init
```

`asiyst init` opens [https://asiyst.com](https://asiyst.com) so you can create a project and copy credentials. Avatar appearance and behavior live in Asiyst Cloud so you can change them without redeploying the site.

## Usage

Project ID is required. The value must be the public Project ID for the target Asiyst project, not the developer account user ID and not the internal Supabase UUID.

```ts
import { Asiyst } from "@asiyst/sdk";

await Asiyst.init({
  projectId: "<PUBLIC_PROJECT_ID>",
  publicKey: "<PUBLIC_KEY>",
  avatarId: "<PUBLIC_AVATAR_ID>",
});
Asiyst.open();
```

Do not pass a secret API key as `publicKey` or omit `projectId`.

`avatarId` selects the avatar that the dashboard configured for this project. It is a public identifier, not an authorization credential. The SDK sends it as a selection hint while the Asiyst API still authenticates and authorizes the project with the public project key.

Knowledge sources, including optional GitHub repositories, are configured in Asiyst Web. The SDK does not receive GitHub credentials and does not copy Knowledge Base content into the website. It initializes the verified project/avatar and retrieves authorized knowledge through the Asiyst backend.

```ts
await Asiyst.init({
  publicKey: "<PUBLIC_KEY>",
});
// throws: Asiyst SDK: projectId is required.
```

Mark important controls so the assistant can find them across layouts:

```html
<button data-asiyst="pricing">Pricing</button>
<button
  data-asiyst="checkout"
  data-asiyst-description="Proceed to checkout"
>
  Checkout
</button>
```

The production API base is `https://nqhxpgsjofzqudyqkqib.supabase.co/functions/v1/api`. It is used by default and can only be overridden explicitly through `apiBaseUrl` for a controlled non-production deployment.

If Cloud is unreachable, the SDK keeps a fallback avatar configuration and exposes `getConnectionStatus()` as `offline`. Conversation replies and task plans are not invented locally; those requests fail until Cloud responds.

## Documentation

- Architecture: `docs/ARCHITECTURE.md`
- API and events: `docs/API.md`
- Security: `docs/SECURITY.md`
- Troubleshooting: `docs/TROUBLESHOOTING.md`
