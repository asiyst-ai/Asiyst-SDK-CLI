import { describe, expect, it } from "vitest";
import { isSafeSelector, querySafeSelector } from "../src/security/selectors";
import { sanitizeText } from "../src/security/sanitize";

describe("security", () => {
  it("rejects unsafe selectors", () => {
    expect(isSafeSelector("#ok")).toBe(true);
    expect(isSafeSelector("javascript:alert(1)")).toBe(false);
    expect(isSafeSelector("div;body")).toBe(false);
    expect(isSafeSelector("a".repeat(300))).toBe(false);
  });

  it("never throws on invalid selector execution", () => {
    expect(querySafeSelector(document, "??")).toBeNull();
    expect(querySafeSelector(document, "javascript:alert(1)")).toBeNull();
  });

  it("sanitizes rendered text", () => {
    expect(sanitizeText("  hello\u0000 <b>world</b>  ")).toBe("hello <b>world</b>");
    expect(sanitizeText("x".repeat(50), 8)).toBe("xxxxxxxx");
  });
});
