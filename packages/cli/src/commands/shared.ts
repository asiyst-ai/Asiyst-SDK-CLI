import { ApiClient } from "../api/client.js";
import { selectOption } from "../ui/selector.js";

export async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
  const result = await selectOption(question, [
    { label: "Yes", value: true },
    { label: "No", value: false },
  ]);
  return result.type === "selected" && result.value;
}

export function createApiClient(): ApiClient {
  return new ApiClient();
}
