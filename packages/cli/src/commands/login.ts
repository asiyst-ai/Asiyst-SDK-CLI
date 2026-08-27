import { ApiClient } from "../api/client.js";
import { connect } from "./shared.js";
export async function loginCommand(api = new ApiClient()): Promise<void> {
  await connect(api);
  console.log("✓ Already connected to Asiyst.");
}
