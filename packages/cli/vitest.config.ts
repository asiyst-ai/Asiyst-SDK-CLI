import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 15_000,
    // Credential-backed CLI tests share the user's encrypted store; run test
    // files serially so one test cannot clear another test's session.
    fileParallelism: false,
  },
});
