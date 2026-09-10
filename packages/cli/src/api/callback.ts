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

function reply(response: import("node:http").ServerResponse, status: number, message: string): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "text/plain; charset=utf-8");
  response.end(message);
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
      reply(response, 400, "Authorization callback already consumed.");
      return;
    }
    const browserSessionId = url.searchParams.get("browser_session_id")?.trim();
    const code = url.searchParams.get("code")?.trim();
    const returnedState = url.searchParams.get("state")?.trim();
    const issuerParameter = url.searchParams.get("issuer")?.trim();
    const legacyIssuerParameter = url.searchParams.get("iss")?.trim();
    if (issuerParameter && legacyIssuerParameter && issuerParameter !== legacyIssuerParameter) {
      reply(response, 400, "Authorization issuer mismatch.");
      if (!settled) {
        settled = true;
        rejectCallback(new ApiError("Authorization issuer mismatch.", 400, "CONFLICT"));
      }
      return;
    }
    const issuer = issuerParameter || legacyIssuerParameter;
    if (!browserSessionId || !code || !returnedState) {
      reply(response, 400, "Missing authorization callback parameters.");
      return;
    }
    if (returnedState !== state) {
      reply(response, 400, "Authorization state mismatch.");
      if (!settled) {
        settled = true;
        rejectCallback(new ApiError("Callback state mismatch.", 400, "CONFLICT"));
      }
      return;
    }
    if (issuer !== "https://asiyst.com") {
      reply(response, 400, "Invalid authorization issuer.");
      if (!settled) {
        settled = true;
        rejectCallback(new ApiError("Invalid authorization issuer.", 400, "CONFLICT"));
      }
      return;
    }
    reply(response, 200, "Authorization received. You may return to the Asiyst CLI.");
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
