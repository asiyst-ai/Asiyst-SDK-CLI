import { createRequire } from "node:module";
import { defineConfig } from "tsup";

const pkg = createRequire(import.meta.url)("./package.json") as { version: string };

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  target: "es2020",
  define: {
    __ASIYST_SDK_VERSION__: JSON.stringify(pkg.version),
  },
});
