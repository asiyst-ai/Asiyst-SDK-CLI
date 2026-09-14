import { createServer, type Server } from "node:http";
import { randomBytes } from "node:crypto";
import { ApiError } from "./errors.js";

export interface BrowserCallback {
  browserSessionId: string;
  code: string;
  issuer: string;
  state: string;
}

export interface CallbackServer {
  redirectUri: string;
  state: string;
  waitForCallback(): Promise<BrowserCallback>;
  close(): Promise<void>;
}

function safeState(): string {
  return randomBytes(24).toString("base64url");
}

function page(title: string, heading: string, message: string, tone: "success" | "error"): string {
  const accent = tone === "success" ? "#16845b" : "#b42318";
  const icon = tone === "success" ? "✓" : "!";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${title}</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7faf9; color: #17211d; }
    main { width: min(92vw, 460px); padding: 40px 36px; border: 1px solid #e1ebe6; border-radius: 20px; background: #fff; box-shadow: 0 18px 50px rgba(22, 58, 43, .10); text-align: center; }
    .brand { color: #173f30; font-size: 15px; font-weight: 800; letter-spacing: .18em; }
    .mark { width: 64px; height: 64px; margin: 30px auto 22px; display: grid; place-items: center; border-radius: 50%; background: ${accent}; color: #fff; font-size: 34px; font-weight: 700; }
    h1 { margin: 0; color: #173f30; font-size: clamp(25px, 6vw, 32px); letter-spacing: -.02em; }
    p { margin: 16px 0 0; color: #52635b; font-size: 16px; line-height: 1.6; }
    .note { margin-top: 26px; color: #718178; font-size: 14px; }
  </style>
</head>
<body>
  <main>
    <div class="brand">ASIYST CLI</div>
    <div class="mark" aria-hidden="true">${icon}</div>
    <h1>${heading}</h1>
    <p>${message}</p>
    <p class="note">You can return to your terminal. The CLI will continue automatically.</p>
  </main>
</body>
</html>`;
}

function reply(response: import("node:http").ServerResponse, status: number, message: string, html = false): void {
  response.statusCode = status;
  response.setHeader("Content-Type", html ? "text/html; charset=utf-8" : "text/plain; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
  response.end(message);
}

function successPage(response: import("node:http").ServerResponse): void {
  reply(
    response,
    200,
    page(
      "Authorization Successful | Asiyst CLI",
      "Authorization Successful",
      "You have successfully authorized the Asiyst CLI.",
      "success",
    ),
    true,
  );
}

function errorPage(response: import("node:http").ServerResponse, status: number, heading: string, message: string): void {
  reply(response, status, page("Authorization Failed | Asiyst CLI", heading, message, "error"), true);
}

export async function startCallbackServer(): Promise<CallbackServer> {
  const state = safeState();
  let server: Server | undefined;
  let settled = false;
  let resolveCallback: (value: BrowserCallback) => void = () => undefined;
  let rejectCallback: (error: Error) => void = () => undefined;
  const callback = new Promise<BrowserCallback>((resolve, reject) => {
    resolveCallback = resolve;
    rejectCallback = reject;
  });

  const close = async (): Promise<void> => {
    if (!server || !server.listening) return;
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  };

  server = createServer((request, response) => {
    if (request.method !== "GET") {
      reply(response, 405, "Method not allowed.");
      return;
    }
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/callback") {
      reply(response, 404, "Not found.");
      return;
    }
    if (settled) {
      errorPage(response, 400, "Authorization Already Used", "This authorization request has already been processed. Return to your terminal and try /login again.");
      return;
    }
    const browserSessionId = url.searchParams.get("browser_session_id")?.trim();
    const code = url.searchParams.get("code")?.trim();
    const returnedState = url.searchParams.get("state")?.trim();
    const issuerParameter = url.searchParams.get("issuer")?.trim();
    const legacyIssuerParameter = url.searchParams.get("iss")?.trim();
    if (issuerParameter && legacyIssuerParameter && issuerParameter !== legacyIssuerParameter) {
      errorPage(response, 400, "Authorization Failed", "The authorization issuer did not match Asiyst. Return to your terminal and try /login again.");
      if (!settled) {
        settled = true;
        rejectCallback(new ApiError("Authorization issuer mismatch.", 400, "CONFLICT"));
      }
      return;
    }
    const issuer = issuerParameter || legacyIssuerParameter;
    if (!browserSessionId || !code || !returnedState) {
      errorPage(response, 400, "Authorization Failed", "The authorization response was incomplete. Return to your terminal and try /login again.");
      return;
    }
    if (returnedState !== state) {
      errorPage(response, 400, "Authorization Failed", "The authorization response could not be validated. Return to your terminal and try /login again.");
      if (!settled) {
        settled = true;
        rejectCallback(new ApiError("Callback state mismatch.", 400, "CONFLICT"));
      }
      return;
    }
    if (issuer !== "https://asiyst.com") {
      errorPage(response, 400, "Authorization Failed", "The authorization response was not issued by Asiyst. Return to your terminal and try /login again.");
      if (!settled) {
        settled = true;
        rejectCallback(new ApiError("Invalid authorization issuer.", 400, "CONFLICT"));
      }
      return;
    }
    successPage(response);
    if (!settled) {
      settled = true;
      resolveCallback({ browserSessionId, code, issuer, state: returnedState });
      void close();
    }
  });

  await new Promise<void>((resolve, reject) => {
    server?.once("error", reject);
    server?.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    await close();
    throw new ApiError("Could not start the local browser callback server.", undefined, "INTERNAL_ERROR");
  }
  return {
    redirectUri: `http://127.0.0.1:${address.port}/callback`,
    state,
    waitForCallback: () => callback,
    close,
  };
}
