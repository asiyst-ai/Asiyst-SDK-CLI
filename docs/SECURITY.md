# Security

The SDK runs in the customer's page. Treat the environment as untrusted.

## Credentials

Allowed in the browser: `projectId`, `publicKey`.

Never ship: model keys, Supabase service-role keys, Stripe secrets, or any other private Cloud credential.

Cloud must authenticate the project and authorize every sensitive operation. Client `allowedActions` can hide UI capabilities; it is not an authorization boundary.

## Rendering

Assistant text is assigned with `textContent`. Do not use `innerHTML` for model output. There is no `eval` and no `new Function`.

## Selectors

`querySelector` is only used after `isSafeSelector`. Cloud-supplied selectors are ignored unless the project already configured them.

## Website map

Snapshots send path, title, and visible control metadata. Query strings are stripped. Input values are not collected. The observer does not stream the raw DOM.

## Analytics

A small allowlist of product events, batched, retried, and never allowed to throw into the host page.

## Isolation

UI mounts in `#asiyst-host` with a shadow root. Public methods catch unexpected exceptions so an SDK failure does not take down the site.
