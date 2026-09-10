import { describe, expect, it } from "vitest";
import { startCallbackServer } from "../src/api/callback.js";

describe("browser callback server", () => {
  it("accepts a valid localhost callback and validates state", async () => {
    const callback = await startCallbackServer();
    try {
      const result = callback.waitForCallback();
      const url = new URL(callback.redirectUri);
      url.searchParams.set("browser_session_id", "browser-session");
      url.searchParams.set("code", "one-time-code");
      url.searchParams.set("iss", "https://asiyst.com");
      url.searchParams.set("state", callback.state);
      const response = await fetch(url);
      expect(response.status).toBe(200);
      await expect(result).resolves.toMatchObject({
        browserSessionId: "browser-session",
        code: "one-time-code",
        issuer: "https://asiyst.com",
        state: callback.state,
      });
    } finally {
      await callback.close();
    }
  });

  it("rejects a mismatched state", async () => {
    const callback = await startCallbackServer();
    try {
      const result = callback.waitForCallback().then(
        () => ({ rejected: false }),
        (error) => ({ rejected: true, error }),
      );
      const url = new URL(callback.redirectUri);
      url.searchParams.set("browser_session_id", "browser-session");
      url.searchParams.set("code", "one-time-code");
      url.searchParams.set("state", "wrong-state");
      const response = await fetch(url);
      expect(response.status).toBe(400);
      await expect(result).resolves.toMatchObject({ rejected: true, error: { message: "Callback state mismatch." } });
    } finally {
      await callback.close();
    }
  });

  it("rejects callbacks missing required parameters", async () => {
    const callback = await startCallbackServer();
    try {
      const response = await fetch(`${callback.redirectUri}?state=${encodeURIComponent(callback.state)}`);
      expect(response.status).toBe(400);
    } finally {
      await callback.close();
    }
  });

  it("accepts issuer as the callback parameter", async () => {
    const callback = await startCallbackServer();
    try {
      const result = callback.waitForCallback();
      const url = new URL(callback.redirectUri);
      url.searchParams.set("browser_session_id", "browser-session");
      url.searchParams.set("code", "one-time-code");
      url.searchParams.set("issuer", "https://asiyst.com");
      url.searchParams.set("state", callback.state);
      await expect(fetch(url)).resolves.toMatchObject({ status: 200 });
      await expect(result).resolves.toMatchObject({ issuer: "https://asiyst.com" });
    } finally {
      await callback.close();
    }
  });

  it("rejects a missing issuer", async () => {
    const callback = await startCallbackServer();
    try {
      const result = callback.waitForCallback().then(
        () => ({ rejected: false }),
        (error) => ({ rejected: true, error }),
      );
      const url = new URL(callback.redirectUri);
      url.searchParams.set("browser_session_id", "browser-session");
      url.searchParams.set("code", "one-time-code");
      url.searchParams.set("state", callback.state);
      const response = await fetch(url);
      expect(response.status).toBe(400);
      await expect(result).resolves.toMatchObject({ rejected: true, error: { message: "Invalid authorization issuer." } });
    } finally {
      await callback.close();
    }
  });
});
