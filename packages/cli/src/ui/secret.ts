import { stdin, stdout } from "node:process";

const BRACKETED_PASTE_START = "\x1b[200~";
const BRACKETED_PASTE_END = "\x1b[201~";
const ENABLE_BRACKETED_PASTE = "\x1b[?2004h";
const DISABLE_BRACKETED_PASTE = "\x1b[?2004l";

export type InteractiveInputProvider = (prompt: string, secret: boolean) => Promise<string | undefined>;
let interactiveInputProvider: InteractiveInputProvider | undefined;

export function setInteractiveInputProvider(provider: InteractiveInputProvider | undefined): void {
  interactiveInputProvider = provider;
}

export function appendSecretInput(current: string, chunk: string): string {
  return `${current}${chunk.replace(/[\r\n]/g, "")}`;
}

export interface SecretInputState {
  value: string;
  inBracketedPaste: boolean;
}

export type SecretInputAction =
  | { type: "continue"; state: SecretInputState }
  | { type: "submit"; value: string }
  | { type: "cancel" };

export function consumeSecretInput(state: SecretInputState, input: string): SecretInputAction {
  let value = state.value;
  let remainder = input;
  let inBracketedPaste = state.inBracketedPaste;

  while (remainder) {
    if (!inBracketedPaste) {
      if (remainder === "\u0003") return { type: "cancel" };
      if (remainder === "\x1b") return { type: "cancel" };

      const pasteStart = remainder.indexOf(BRACKETED_PASTE_START);
      if (pasteStart >= 0) {
        value = appendSecretInput(value, remainder.slice(0, pasteStart));
        remainder = remainder.slice(pasteStart + BRACKETED_PASTE_START.length);
        inBracketedPaste = true;
        continue;
      }

      const newline = remainder.search(/[\r\n]/);
      if (newline >= 0) {
        value = appendSecretInput(value, remainder.slice(0, newline));
        return { type: "submit", value: value.trim() };
      }

      if (remainder === "\x7f" || remainder === "\b") {
        value = value.slice(0, -1);
      } else {
        value = appendSecretInput(value, remainder.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, ""));
      }
      remainder = "";
      continue;
    }

    const pasteEnd = remainder.indexOf(BRACKETED_PASTE_END);
    if (pasteEnd < 0) {
      value = appendSecretInput(value, remainder);
      remainder = "";
      continue;
    }

    value = appendSecretInput(value, remainder.slice(0, pasteEnd));
    remainder = remainder.slice(pasteEnd + BRACKETED_PASTE_END.length);
    inBracketedPaste = false;
  }

  return { type: "continue", state: { value, inBracketedPaste } };
}

export async function readSecret(prompt: string): Promise<string | undefined> {
  if (interactiveInputProvider) return interactiveInputProvider(prompt, true);
  if (!stdin.isTTY) return undefined;
  return new Promise((resolve) => {
    let state: SecretInputState = { value: "", inBracketedPaste: false };
    let settled = false;
    const wasRaw = Boolean(stdin.isRaw);
    stdout.write(prompt);
    stdout.write(ENABLE_BRACKETED_PASTE);

    const finish = (result: string | undefined) => {
      if (settled) return;
      settled = true;
      stdin.off("data", onData);
      if (stdin.isTTY) stdin.setRawMode?.(wasRaw);
      stdin.pause();
      stdout.write(DISABLE_BRACKETED_PASTE);
      stdout.write("\n");
      resolve(result?.trim());
    };

    const onData = (chunk: Buffer | string) => {
      const action = consumeSecretInput(state, String(chunk));
      if (action.type === "cancel") {
        finish(undefined);
        process.exit(130);
      }
      if (action.type === "submit") {
        finish(action.value);
        return;
      }
      state = action.state;
    };

    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

export async function readInput(prompt: string): Promise<string | undefined> {
  if (interactiveInputProvider) return interactiveInputProvider(prompt, false);
  if (!stdin.isTTY) return undefined;
  return new Promise((resolve) => {
    let value = "";
    const onData = (chunk: Buffer | string) => {
      value += String(chunk);
      const newline = value.search(/[\r\n]/);
      if (newline >= 0) {
        stdin.off("data", onData);
        resolve(value.slice(0, newline).trim());
      }
    };
    stdout.write(prompt);
    stdin.resume();
    stdin.on("data", onData);
  });
}
