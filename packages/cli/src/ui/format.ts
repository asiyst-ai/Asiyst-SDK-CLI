import { stdout } from "node:process";

const supportsColor = Boolean(stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== "dumb");

const codes = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

function color(code: keyof typeof codes, value: string): string {
  return supportsColor ? `${codes[code]}${value}${codes.reset}` : value;
}

export const symbols = {
  connected: "●",
  disconnected: "○",
  warning: "⚠",
  error: "✕",
  success: "✓",
  pointer: "›",
};

export function title(value: string): string {
  return color("bold", value);
}

export function section(value: string): string {
  return color("cyan", value);
}

export function muted(value: string): string {
  return color("dim", value);
}

export function success(value: string): string {
  return color("green", value);
}

export function warning(value: string): string {
  return color("yellow", value);
}

export function error(value: string): string {
  return color("red", value);
}

export function maskSecret(value: string, visible = 0): string {
  if (visible <= 0) return "••••••••";
  return `${value.slice(0, visible)}••••••••`;
}

export function printHeader(value: string, subtitle?: string): void {
  console.log(`\n${title(value)}`);
  if (subtitle) console.log(muted(subtitle));
  console.log();
}

export function printStatus(connected: boolean): void {
  const marker = connected ? success(symbols.connected) : muted(symbols.disconnected);
  const label = connected ? "Connected" : "Not connected";
  console.log(`Status: ${marker} ${label}`);
}

export function printKeyValue(label: string, value: string): void {
  console.log(`${label}: ${value}`);
}
