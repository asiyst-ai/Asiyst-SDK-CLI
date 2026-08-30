import { createRequire } from "node:module";
import { defineConfig } from "tsup";

const pkg = createRequire(import.meta.url)("./package.json") as { version: string };

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  sourcemap: true,
  clean: true,
  target: "node18",
  banner: { js: "#!/usr/bin/env node" },
  define: {
    __ASIYST_CLI_VERSION__: JSON.stringify(pkg.version),
  },
});
