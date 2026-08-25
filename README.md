# Asiyst SDK

Public JavaScript/TypeScript client for [Asiyst](https://asiyst.com).

The SDK runs on third-party websites. Asiyst Cloud owns authentication, planning, avatar configuration, conversations, and analytics ingestion. This repository does not implement Cloud.

## Packages

| Package | Role |
| --- | --- |
| `@asiyst/sdk` | Browser runtime |
| `asiyst` | CLI (`npx asiyst init`) |

## Install

```bash
npm install @asiyst/sdk
npx asiyst init
```

```ts
import { Asiyst } from "@asiyst/sdk";

await Asiyst.init({
  projectId: "YOUR_PROJECT_ID",
  publicKey: "YOUR_PUBLIC_KEY",
});
```

`publicKey` identifies the project. It is not a secret. Never put service-role keys, model keys, or Stripe secrets in the browser SDK.

## What this foundation includes

- Isolated shadow-DOM host so Asiyst CSS cannot collide with the site
- Remote configuration with cache, validation, versioning, and fallback
- Replaceable avatar renderer plus movement math derived from live element geometry
- Local website map and `data-asiyst` targets
- Guided task state machine with permission checks
- Typed events and batched analytics
- HTTP Cloud client with a replaceable transport

Conversation replies and multi-step plans are requested from Cloud. If Cloud is down, local avatar and targeting APIs still work; the SDK does not invent plans or messages.

## Development

```bash
npm install
npm test
npm run build
```

Node 18.18+ is required.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [Security](docs/SECURITY.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
