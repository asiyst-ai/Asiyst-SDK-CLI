import { ApiClient } from "../api/client.js";
import { verifyApiKey } from "../api/auth.js";
import { ApiError } from "../api/errors.js";
import { loadConnection } from "../config/credentials.js";
import { readProjectMetadata } from "../config/project.js";
import { createApiClient } from "./shared.js";

export async function statusCommand(cwd = process.cwd(), api: ApiClient = createApiClient()): Promise<void> {
  const stored = await loadConnection(cwd);
  if (!stored?.apiKey) {
    const metadata = readProjectMetadata(cwd);
    if (!metadata?.connected) {
      console.log("✗ This project is not connected to Asiyst.");
      return;
    }
    console.log("✗ Connection invalid.");
    return;
  }

  try {
    const connected = await verifyApiKey(api, stored.apiKey);
    console.log("✓ Connected to Asiyst.");
    console.log(`\nProject:\n${connected.projectName || connected.projectId}`);
    if (connected.website) console.log(`\nWebsite:\n${connected.website}`);
  } catch (error) {
    if (error instanceof ApiError && error.code === "API_KEY_REVOKED") {
      console.log("✗ API key revoked.");
      console.log("Create a new key from:\nhttps://asiyst.com");
      return;
    }
    if (error instanceof ApiError && (error.code === "INVALID_API_KEY" || error.code === "FORBIDDEN")) {
      console.log("✗ Connection invalid.");
      return;
    }
    console.log("✗ Connection invalid.");
  }
}
