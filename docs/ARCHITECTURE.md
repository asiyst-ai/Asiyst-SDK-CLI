# Architecture

## 1. Shape

Monorepo:

- `packages/sdk` — browser runtime published as `@asiyst/sdk`
- `packages/cli` — Node CLI published as `asiyst` (`npx asiyst init`)

The CLI is not bundled into the browser SDK. The production API is served by the web application at `https://asiyst.com/api/v1`.

## 2. Module responsibilities

| Module | Responsibility |
| --- | --- |
| `core` | Lifecycle, error isolation, shadow host |
| `config` | Schema, cache, remote refresh, fallback |
| `client` | Public `Asiyst` facade and conversation panel |
| `avatar` | Avatar API and replaceable renderer |
| `animation` | Timing helpers for motion |
| `movement` | Scroll + destination planning from live rectangles |
| `dom` | Inspection, visibility, target resolver |
| `website-map` | Session map and Cloud-safe snapshots |
| `navigation` | History/SPA hooks and scrolling |
| `highlighting` | Overlay layer (does not mutate target styles) |
| `interaction` | Intent → validated action execution |
| `task` | Single state machine for guided work |
| `workflow` | Loads Cloud workflow definitions into the task engine |
| `events` | Typed pub/sub |
| `analytics` | Small, batched product events |
| `communication` | `CloudClient` + `HttpTransport` |
| `accessibility` | Reduced motion, live region |
| `security` | Text sanitization, selector allowlisting |
| `storage` | Namespaced `localStorage` |
| `voice` | Adapter interface (disabled until Cloud enables it) |
| `types` / `errors` / `utils` | Shared contracts |

## 3. SDK vs Cloud

**SDK:** inspect the current page, resolve targets, move/highlight, wait for the user, emit events, send snapshots and analytics, render the avatar.

**Cloud:** auth, projects, model inference, task planning, stored avatar config, workflows, conversations, knowledge, server-side analytics, permissions as source of truth.

The browser never executes model-generated JavaScript. Cloud must re-validate anything security-sensitive; client `allowedActions` is a UX gate only.

## 4. Dependencies

Runtime: none. The SDK uses `fetch`, DOM APIs, and `localStorage`.

Dev: TypeScript, tsup, Vitest, jsdom.

## 5. Security risks

- XSS via assistant text → render with `textContent` only
- Unsafe selectors from Cloud → only configured/developer selectors run
- Public key treated as secret by developers → document that it is an identifier
- Leaking field values / query strings → website map strips query and never sends control values
- Host page crashes → public API wrapped in isolation; UI lives in a shadow root

## 6. Performance risks

- Full-document scans on every mutation → debounced `MutationObserver`
- Scroll/resize layout thrash → throttled handlers
- Analytics blocking UX → async batch + failure isolation
- Large bundle → no UI framework, renderer kept CSS-only and swappable

## 7. Public API

```ts
Asiyst.init(options)
Asiyst.destroy()
Asiyst.open()
Asiyst.close()
Asiyst.getConfig()
Asiyst.avatar.show() | hide() | moveTo() | pointAt() | highlight() | speak() | think() | celebrate() | setPosition()
Asiyst.task.start() | cancel()
Asiyst.workflow.start()
Asiyst.on() | off()
```

## 8. Event model

Events are listed in `docs/API.md`. Subscribers cannot throw into the host page; the bus swallows listener errors.

## 9. Task state machine

`USER_REQUEST → INTENT_DETECTED → TASK_CREATED → TARGET_RESOLVED → ACTION_STARTED → WAITING_FOR_USER → USER_ACTION_DETECTED → STEP_COMPLETED → NEXT_STEP → TASK_COMPLETED`

Terminal branches: `FAILED`, `CANCELLED`, `TIMEOUT`, `TARGET_NOT_FOUND`. Transitions are explicit; status is not a pile of booleans.

Guided mode never auto-clicks. Click/type/select from Cloud wait for the user unless a future permission model allows it.

## 10. Configuration schema

`ProjectConfig` (`packages/sdk/src/types/index.ts` and `config/schema.ts`):

- identity: `avatarName`, `avatar`, `size`, `position`, `voice`, `animation`
- `theme`, `personality`, `behavior`
- `mode`: `guided` | `assist`
- `allowedActions`
- `elementSelectors` (developer-configured, still safety-checked)
- `schemaVersion` + `version` for cache compatibility

Refresh path: validate init → apply cache or fallback → fetch Cloud → validate → write cache. Fetch failure keeps the last good config.

## 11. Testing strategy

Vitest + jsdom. Tests assert observable behavior: schema clamping, selector refusal, geometry without hardcoded page coordinates, overlay vs target styles, legal/illegal task transitions, guided click waits, analytics retry, init with a down Cloud, reduced motion detection.

## 12. Multi-tenancy

One runtime per page, bound to a single `projectId`. Storage keys are namespaced. Cloud requests always send that project id. Cross-project access is a Cloud concern and is not implementable through this client.
