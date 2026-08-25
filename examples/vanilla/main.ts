import { Asiyst } from "../../packages/sdk/src/index.ts";

await Asiyst.init({
  projectId: "example_project",
  publicKey: "example_public_key",
  apiBaseUrl: "http://localhost:8787",
});

Asiyst.on("asiyst:error", (event) => {
  console.warn(event.code, event.message);
});
