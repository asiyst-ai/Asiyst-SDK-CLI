import { stdin, stdout } from "node:process";
import { clearLine, cursorTo, emitKeypressEvents, moveCursor } from "node:readline";

export interface SelectorOption<T> {
  label: string;
  value: T;
  disabled?: boolean;
}

export type SelectorResult<T> = { type: "selected"; value: T } | { type: "cancelled" | "exit" };

const HIDE_CURSOR = "\x1B[?25l";
const SHOW_CURSOR = "\x1B[?25h";

export function moveSelection(active: number, optionCount: number, direction: "up" | "down"): number {
  if (optionCount === 0) return 0;
  return direction === "up"
    ? Math.max(0, active - 1)
    : Math.min(optionCount - 1, active + 1);
}

export function clearSelectorFrame(output: NodeJS.WriteStream, previousLineCount: number): void {
  if (previousLineCount <= 0) return;
  cursorTo(output, 0);
  for (let i = 0; i < previousLineCount - 1; i += 1) {
    moveCursor(output, 0, -1);
  }
  for (let line = 0; line < previousLineCount; line += 1) {
    cursorTo(output, 0);
    clearLine(output, 0);
    if (line < previousLineCount - 1) {
      moveCursor(output, 0, 1);
    }
  }
  cursorTo(output, 0);
  for (let i = 0; i < previousLineCount - 1; i += 1) {
    moveCursor(output, 0, -1);
  }
}

export function renderSelectorFrame(output: NodeJS.WriteStream, previousLineCount: number, lines: string[]): number {
  if (lines.length === 0) return 0;
  if (previousLineCount > 0) {
    cursorTo(output, 0);
    for (let i = 0; i < previousLineCount - 1; i += 1) {
      moveCursor(output, 0, -1);
    }
  }
  for (let i = 0; i < lines.length; i += 1) {
    cursorTo(output, 0);
    clearLine(output, 0);
    output.write(lines[i]);
    if (i < lines.length - 1) {
      output.write("\n");
    }
  }
  return lines.length;
}

function restoreTerminal(wasRaw: boolean): void {
  stdout.write(SHOW_CURSOR);
  if (stdin.isTTY) stdin.setRawMode?.(wasRaw);
}

export function selectOption<T>(title: string, options: SelectorOption<T>[]): Promise<SelectorResult<T>> {
  if (!stdin.isTTY || !stdout.isTTY) return Promise.resolve({ type: "cancelled" });
  return new Promise((resolve) => {
    let active = 0;
    let renderedLines = 0;
    let settled = false;
    const wasRaw = Boolean(stdin.isRaw);
    const enabled = options.filter((option) => !option.disabled);

    const finish = (result: SelectorResult<T>, confirmation?: string) => {
      if (settled) return;
      settled = true;
      stdin.off("keypress", onKeypress);
      clearSelectorFrame(stdout, renderedLines);
      restoreTerminal(wasRaw);
      stdin.pause();
      if (confirmation) stdout.write(`${confirmation}\n`);
      resolve(result);
    };

    const render = () => {
      const lines = [title, "", ...enabled.map((option, index) => `${index === active ? "❯" : " "} ${option.label}`)];
      renderedLines = renderSelectorFrame(stdout, renderedLines, lines);
    };

    const onKeypress = (_value: string, key: { name?: string; ctrl?: boolean; sequence?: string } | undefined) => {
      if (!key) return;
      if (key.ctrl && key.name === "c") {
        clearSelectorFrame(stdout, renderedLines);
        restoreTerminal(wasRaw);
        stdin.pause();
        stdout.write("\n");
        process.exit(130);
      }
      if (key.name === "escape") return finish({ type: "cancelled" });
      if (key.name === "up" || key.name === "down") {
        active = moveSelection(active, enabled.length, key.name);
        return render();
      }
      if (key.name === "return" || key.name === "enter") {
        const selected = enabled[active];
        if (!selected) return finish({ type: "cancelled" });
        return finish({ type: "selected", value: selected.value }, `✓ ${selected.label} selected.`);
      }
    };

    emitKeypressEvents(stdin);
    stdin.setRawMode?.(true);
    stdin.resume();
    stdout.write(HIDE_CURSOR);
    stdin.on("keypress", onKeypress);
    render();
  });
}
