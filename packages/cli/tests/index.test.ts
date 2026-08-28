import { describe, expect, it, vi } from "vitest";
import { main } from "../src/index.js";
import { readCurrentVersion } from "../src/update/check.js";

describe("CLI entrypoint", () => {
  it("prints help and version without network access", async () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await main(["--help"]);
    await main(["--version"]);
    expect(output).toHaveBeenCalledWith(expect.stringContaining("Usage: asiyst"));
    expect(output).toHaveBeenCalledWith(readCurrentVersion());
    output.mockRestore();
  });
});
