const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeText(input: string, maxLength = 2000): string {
  return input.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function renderSafeText(node: HTMLElement, text: string): void {
  node.textContent = sanitizeText(text);
}
