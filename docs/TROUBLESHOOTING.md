# Troubleshooting

## `Call Asiyst.init() before using the SDK`

`Asiyst.avatar.*` and `Asiyst.on` require a successful `init`. `init` is async.

## Avatar appears but does not answer

Conversation and task planning require Asiyst Cloud. Check `apiBaseUrl`, project credentials, and the browser network panel for `/api/v1/conversations/messages` and `/api/v1/tasks`. The SDK will not fabricate replies.

## Target not found

Confirm `data-asiyst="..."` is present, the node is visible, and it is not `disabled`. For Cloud-driven selectors, add them under `elementSelectors` in project config.

## Assistant covers a sticky header

Movement uses measured insets from `position: fixed|sticky` elements. If a header is drawn in a canvas or iframe, mark layout with normal DOM or increase Cloud-configured avatar size/position.

## Reduced motion

When `prefers-reduced-motion: reduce` is set, avatar translation is not animated and scrolling uses `behavior: "auto"`.

## Host styles look wrong inside Asiyst

Asiyst chrome lives in shadow DOM. Page CSS should not reach it; if it does, the page is piercing the shadow root.

## Analytics never shows in Cloud

Failures are isolated by design. Confirm `/api/v1/analytics` is implemented and that the tab is not blocking `fetch` on unload.
