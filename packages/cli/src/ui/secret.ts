import { stdin, stdout } from "node:process";
import { emitKeypressEvents } from "node:readline";

export async function readSecret(prompt: string): Promise<string | undefined> {
  if (!stdin.isTTY) return undefined;
  return new Promise((resolve) => {
    let value = "";
    let settled = false;
    const wasRaw = Boolean(stdin.isRaw);
    stdout.write(prompt);

    const finish = (result: string | undefined) => {
      if (settled) return;
      settled = true;
      stdin.off("keypress", onKeypress);
      if (stdin.isTTY) stdin.setRawMode?.(wasRaw);
      stdin.pause();
      stdout.write("\n");
      resolve(result);
    };

    const onKeypress = (chunk: string, key: { name?: string; ctrl?: boolean; sequence?: string } | undefined) => {
      if (!key) return;
      if (key.ctrl && key.name === "c") {
        finish(undefined);
        process.exit(130);
      }
      if (key.name === "escape") return finish(undefined);
      if (key.name === "return" || key.name === "enter") return finish(value.trim());
      if (key.name === "backspace") {
        value = value.slice(0, -1);
        return;
      }
      const sequence = key.sequence || chunk;
      if (sequence && /^[\x20-\x7e]+$/.test(sequence)) value += sequence;
    };

    emitKeypressEvents(stdin);
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.on("keypress", onKeypress);
  });
}
