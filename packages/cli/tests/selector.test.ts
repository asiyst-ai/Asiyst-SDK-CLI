import { describe, expect, it } from "vitest";
import { moveSelection, renderSelectorFrame } from "../src/ui/selector.js";

describe("selector rendering", () => {
  it("moves one item at a time and clamps at both boundaries", () => {
    expect(moveSelection(0, 3, "up")).toBe(0);
    expect(moveSelection(0, 3, "down")).toBe(1);
    expect(moveSelection(1, 3, "down")).toBe(2);
    expect(moveSelection(2, 3, "down")).toBe(2);
    expect(moveSelection(0, 0, "down")).toBe(0);
  });

  it("rewrites only the existing frame without clearing the terminal", () => {
    let output = "";
    const stream = {
      isTTY: true,
      write(chunk: string) {
        output += chunk;
        return true;
      },
    } as unknown as NodeJS.WriteStream;

    const firstFrame = renderSelectorFrame(stream, 0, ["Question", "> first", "  second"]);
    const secondFrame = renderSelectorFrame(stream, firstFrame, ["Question", "  first", "> second"]);

    expect(secondFrame).toBe(firstFrame);
    expect(output).not.toContain("\x1b[2J");
    expect((output.match(/\x1b\[1A/g) ?? []).length).toBe(2);
    expect(output).toContain("\x1b[2K");
    expect(output).toContain("> second");
  });
});
