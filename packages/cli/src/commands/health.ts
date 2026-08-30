import { ApiClient } from "../api/client.js";
import { createApiClient } from "./shared.js";

export async function healthCommand(api: ApiClient = createApiClient()): Promise<void> {
  try {
    await api.health();
    console.log("✓ Asiyst API is reachable.");
  } catch {
    console.log("✗ Unable to reach Asiyst API.");
  }
}
