import { describe, expect, it } from "vitest";
import { appendSecretInput, consumeSecretInput } from "../src/ui/secret.js";

describe("secret input", () => {
  it("preserves pasted API key characters while removing clipboard line breaks", () => {
    expect(appendSecretInput("", "abc123\r\n")).toBe("abc123");
  });

  it("supports adding multiple pasted chunks without exposing the value", () => {
    const value = appendSecretInput(appendSecretInput("", "abc"), "123");
    expect(value).toBe("abc123");
  });

  it("submits a value when Enter arrives after a paste", () => {
    const state = consumeSecretInput({ value: "", inBracketedPaste: false }, "asiyst_abc123");
    expect(state.type).toBe("continue");
    if (state.type !== "continue") return;
    expect(consumeSecretInput(state.state, "\r")).toEqual({
      type: "submit",
      value: "asiyst_abc123",
    });
  });

  it("handles bracketed paste markers split across input chunks", () => {
    let state = consumeSecretInput({ value: "", inBracketedPaste: false }, "\x1b[200~asiyst_");
    expect(state.type).toBe("continue");
    if (state.type !== "continue") return;
    const next = consumeSecretInput(state.state, "abc-123\x1b[201~");
    expect(next).toEqual({
      type: "continue",
      state: { value: "asiyst_abc-123", inBracketedPaste: false },
    });
    if (next.type !== "continue") return;
    expect(consumeSecretInput(next.state, "\n")).toEqual({
      type: "submit",
      value: "asiyst_abc-123",
    });
  });

  it("does not treat the bracketed paste start as Escape cancellation", () => {
    const start = consumeSecretInput(
      { value: "", inBracketedPaste: false },
      "\x1b[200~proj_123",
    );

    expect(start).toEqual({
      type: "continue",
      state: { value: "proj_123", inBracketedPaste: true },
    });
    if (start.type !== "continue") return;

    expect(consumeSecretInput(start.state, "\x1b[201~\r")).toEqual({
      type: "submit",
      value: "proj_123",
    });
  });

  it("supports long keys without terminal-width truncation", () => {
    const key = `asiyst_${"A1_b-".repeat(40)}`;
    const state = consumeSecretInput({ value: "", inBracketedPaste: false }, key);
    expect(state).toEqual({
      type: "continue",
      state: { value: key, inBracketedPaste: false },
    });
  });
});
