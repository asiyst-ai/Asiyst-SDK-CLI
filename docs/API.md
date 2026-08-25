# API

## Init

```ts
await Asiyst.init({
  projectId: string;
  publicKey: string;
  apiBaseUrl?: string; // default https://api.asiyst.com
  mode?: "guided" | "assist";
  allowedActions?: ActionKind[];
  observeHistory?: boolean; // default true; wraps pushState/replaceState
});
```

Init does not block first paint of the host page. Configuration is applied from cache/fallback immediately, then refreshed from Cloud.

## Avatar

`moveTo`, `pointAt`, and `highlight` accept an Asiyst id (`data-asiyst="pricing"`), or a `TargetRef`:

```ts
{ id?: string; role?: string; text?: string; selector?: string }
```

`selector` from site code is allowed after safety checks. Selectors arriving from Cloud are ignored unless they already appear in the project's configured `elementSelectors`.

## Tasks

```ts
await Asiyst.task.start("Find mobile phone coupons");
await Asiyst.task.start({
  id: "local_debug",
  steps: [
    { id: "s1", action: "highlight", target: { id: "coupons" }, message: "Click Coupons." },
  ],
});
Asiyst.task.cancel();
```

A string argument is sent to Cloud for planning. A `TaskDefinition` is for local/debug execution and still passes through the same state machine and permission checks.

## Events

| Event | Payload |
| --- | --- |
| `asiyst:initialized` | `{ projectId }` |
| `asiyst:ready` | `{ projectId, configVersion }` |
| `asiyst:destroyed` | `{ projectId }` |
| `asiyst:avatar:shown` / `hidden` | `{ name }` |
| `asiyst:avatar:moved` | `{ x, y }` |
| `asiyst:target:found` | `{ target, elementId }` |
| `asiyst:target:not-found` | `{ target }` |
| `asiyst:target:highlighted` | `{ elementId, style }` |
| `asiyst:user:clicked` | `{ elementId }` |
| `asiyst:task:started` / `completed` / `cancelled` | `{ taskId }` |
| `asiyst:task:step-completed` | `{ taskId, stepId }` |
| `asiyst:task:failed` | `{ taskId, reason }` |
| `asiyst:conversation:started` / `closed` | `{ conversationId }` |
| `asiyst:conversation:message` | `{ role, text }` |
| `asiyst:error` | `{ code, message }` |

```ts
const off = Asiyst.on("asiyst:task:completed", ({ taskId }) => {
  console.info("done", taskId);
});
off();
```

## Cloud HTTP

All network I/O goes through `CloudClient` / `HttpTransport`:

- `GET /v1/projects/:id/config`
- `POST /v1/tasks`
- `POST /v1/tasks/:id/events`
- `GET /v1/workflows/:id`
- `POST /v1/conversations/messages`
- `POST /v1/website-maps`
- `POST /v1/analytics`

Headers: `X-Asiyst-Project-Id`, `X-Asiyst-Public-Key`, `X-Asiyst-SDK-Version`.

## Marking elements

```html
<button data-asiyst="checkout" data-asiyst-description="Proceed to checkout">
  Checkout
</button>
```

Automatic detection still runs for buttons, links, inputs, navigation, headings, dialogs, tabs, and similar landmarks.
