import { connectCommand } from "./connect.js";
import { createApiClient } from "./shared.js";

export async function loginCommand(): Promise<void> {
  await connectCommand(process.cwd(), createApiClient());
}
