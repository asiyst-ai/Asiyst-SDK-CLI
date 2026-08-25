# @asiyst/sdk

Client-side runtime that connects a website to Asiyst Cloud.

This package does not contain model keys, database credentials, or other server secrets. Identify the project with `projectId` and `publicKey` only. Those values are public project credentials, not secrets.

## Install

```bash
npm install @asiyst/sdk
```

Then connect the project:

```bash
npx asiyst init
```

`asiyst init` opens [https://asiyst.com](https://asiyst.com) so you can create a project and copy credentials. Avatar appearance and behavior live in Asiyst Cloud so you can change them without redeploying the site.

## Usage

```ts
import { Asiyst } from "@asiyst/sdk";

await Asiyst.init({
  projectId: "asiyst_project_id",
  publicKey: "asiyst_public_key",
});
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

## Local development

Point the SDK at a local Cloud implementation:

```ts
await Asiyst.init({
  projectId: "dev_project",
  publicKey: "dev_public_key",
  apiBaseUrl: "http://localhost:8787",
});
```

If Cloud is unreachable, the SDK keeps a fallback avatar configuration and continues to run local APIs (`avatar.moveTo`, highlighting, events). Conversation replies and task plans are not invented locally; those requests fail until Cloud responds.

## Documentation

- Architecture: `docs/ARCHITECTURE.md`
- API and events: `docs/API.md`
- Security: `docs/SECURITY.md`
- Troubleshooting: `docs/TROUBLESHOOTING.md`
