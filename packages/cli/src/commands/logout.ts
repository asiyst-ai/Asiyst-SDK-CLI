import { disconnectCommand } from "./disconnect.js";

export async function logoutCommand(): Promise<void> {
  await disconnectCommand();
}
