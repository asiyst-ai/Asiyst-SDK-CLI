const DANGEROUS_SELECTOR =
  /javascript:|expression\(|@import|url\s*\(|behavior:|binding:|<script/i;
const FORBIDDEN_SELECTOR_TOKENS = /[;{}]|\)\s*\[/;

export function isSafeSelector(selector: string): boolean {
  const trimmed = selector.trim();
  if (!trimmed || trimmed.length > 240) {
    return false;
  }
  if (DANGEROUS_SELECTOR.test(trimmed) || FORBIDDEN_SELECTOR_TOKENS.test(trimmed)) {
    return false;
  }
  return true;
}

export function querySafeSelector(
  root: ParentNode,
  selector: string,
): Element | null {
  if (!isSafeSelector(selector)) {
    return null;
  }
  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}
