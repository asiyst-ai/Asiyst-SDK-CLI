import { stdin, stdout } from "node:process";
import { emitKeypressEvents } from "node:readline";

export interface SelectorOption<T> {
  label: string;
  value: T;
  disabled?: boolean;
}

export type SelectorResult<T> = { type: "selected"; value: T; input: string } | { type: "cancelled" | "exit"; input: string };

const escape = "\x1b[";
const width = () => Math.max(40, (stdout.columns || 80) - 2);
const fit = (value: string) => value.length > width() ? `${value.slice(0, width() - 1)}…` : value;

export function selectOption<T>(title: string, options: SelectorOption<T>[], prompt = "> "): Promise<SelectorResult<T>> {
  if (!stdin.isTTY || !stdout.isTTY) return Promise.resolve({ type: "cancelled", input: "" });
  return new Promise((resolve) => {
    let input = "";
    let active = 0;
    let visible = true;
    let renderedLines = 0;
    let settled = false;
    const filtered = () => {
      const query = input.trim().toLowerCase();
      return query ? options.filter((option) => option.label.toLowerCase().includes(query) || String(option.value).toLowerCase().includes(query)) : options;
    };
    const clear = () => {
      if (renderedLines === 0) return;
      stdout.write(`${escape}${renderedLines}A`);
      for (let line = 0; line < renderedLines; line += 1) stdout.write(`${escape}2K${line < renderedLines - 1 ? `${escape}1B` : ""}`);
      stdout.write(`${escape}${renderedLines}A`);
    };
    const render = () => {
      clear();
      const matches = filtered();
      if (active >= matches.length) active = Math.max(0, matches.length - 1);
      const lines = [`${title}`, `${prompt}${fit(input)}`];
      if (visible) {
        if (matches.length === 0) lines.push("  No matching commands.");
        else lines.push(...matches.map((option, index) => `${index === active ? "❯" : " "} ${fit(option.label)}`));
        lines.push("↑↓ Navigate  Enter Select  Esc Cancel");
      }
      stdout.write(`${lines.join("\n")}\n`);
      renderedLines = lines.length;
    };
    const finish = (result: SelectorResult<T>) => {
      if (settled) return;
      settled = true;
      stdin.off("keypress", onKeypress);
      clear();
      stdin.setRawMode?.(false);
      stdin.pause();
      stdout.write("\n");
      resolve(result);
    };
    const onKeypress = (value: string, key: { name?: string; ctrl?: boolean; sequence?: string }) => {
      if (key.ctrl && key.name === "c") return finish({ type: "cancelled", input });
      if (key.ctrl && key.name === "d") return finish({ type: "exit", input });
      if (key.name === "escape") {
        return finish({ type: "cancelled", input });
      }
      if (key.name === "up" || key.name === "down") {
        const matches = filtered();
        if (matches.length > 0) active = key.name === "up" ? (active + matches.length - 1) % matches.length : (active + 1) % matches.length;
        visible = true;
        return render();
      }
      if (key.name === "return" || key.name === "enter") {
        const matches = filtered();
        const selected = matches[active];
        if (selected) return finish({ type: "selected", value: selected.value, input });
        return finish({ type: "cancelled", input });
      }
      if (key.name === "tab") {
        const matches = filtered();
        if (matches.length === 1) input = matches[0].value as unknown as string;
        else if (matches.length > 1) active = (active + 1) % matches.length;
        visible = true;
        return render();
      }
      if (key.name === "backspace") {
        input = input.slice(0, -1);
        visible = true;
        return render();
      }
      const sequence = key.sequence || value;
      if (/^[\x20-\x7e]+$/.test(sequence)) {
        input += sequence;
        active = 0;
        visible = true;
        return render();
      }
    };
    emitKeypressEvents(stdin);
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.on("keypress", onKeypress);
    render();
  });
}
