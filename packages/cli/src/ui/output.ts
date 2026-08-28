import type { ProjectDetection, VerificationResult } from "../types.js";
import { readCurrentVersion } from "../update/check.js";

// ─── ANSI colour helpers ──────────────────────────────────────────────────────
const E = "\x1b[";
const reset    = `${E}0m`;
const bold     = `${E}1m`;
const dim      = `${E}2m`;
const cyan     = `${E}96m`;
const magenta  = `${E}95m`;
const blue     = `${E}94m`;
const yellow   = `${E}93m`;
const green    = `${E}92m`;
const white    = `${E}97m`;
const gray     = `${E}90m`;
const bgBlue   = `${E}44m`;

function c(color: string, text: string): string {
  return `${color}${text}${reset}`;
}

// ─── Visible-length helper (strips ANSI) ─────────────────────────────────────
function vlen(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

function rpad(s: string, w: number): string {
  return s + " ".repeat(Math.max(0, w - vlen(s)));
}

// ─── Box-drawing helpers ─────────────────────────────────────────────────────
const TL = "╭", TR = "╮", BL = "╰", BR = "╯", H = "─", V = "│";

function boxTop(w: number, col: string)    { return `${col}${TL}${H.repeat(w - 2)}${TR}${reset}`; }
function boxBottom(w: number, col: string) { return `${col}${BL}${H.repeat(w - 2)}${BR}${reset}`; }
function boxRow(inner: string, w: number, col: string): string {
  const padded = rpad(inner, w - 4);
  return `${col}${V}${reset} ${padded} ${col}${V}${reset}`;
}

// ─── Status dot ───────────────────────────────────────────────────────────────
const DOT_OK  = c(green,  "●");
const DOT_WARN = c(yellow, "●");

// ─── ASCII art ASIYST logo ────────────────────────────────────────────────────
function asciiBanner(): string {
  const rows = [
    " █████╗ ███████╗██╗██╗   ██╗███████╗████████╗",
    "██╔══██╗██╔════╝██║╚██╗ ██╔╝██╔════╝╚══██╔══╝",
    "███████║███████╗██║ ╚████╔╝ ███████╗   ██║   ",
    "██╔══██║╚════██║██║  ╚██╔╝  ╚════██║   ██║   ",
    "██║  ██║███████║██║   ██║   ███████║   ██║   ",
    "╚═╝  ╚═╝╚══════╝╚═╝   ╚═╝   ╚══════╝   ╚═╝   ",
  ];
  const cols = [cyan, cyan, `${E}96m`, `${E}35m`, magenta, magenta];
  return rows.map((r, i) => `${bold}${cols[i]}${r}${reset}`).join("\n");
}

// ─── Tips panel ───────────────────────────────────────────────────────────────
function tipsPanel(): string[] {
  const w = 42;
  const bc = blue;
  return [
    boxTop(w, bc),
    boxRow(`${c(yellow, "💡 Tips")}`, w, bc),
    boxRow("", w, bc),
    boxRow("Type natural language or a command.", w, bc),
    boxRow("Examples:", w, bc),
    boxRow(`  ${c(gray, ">")} connect my website`, w, bc),
    boxRow(`  ${c(gray, ">")} check installation`, w, bc),
    boxRow(`  ${c(gray, ">")} open dashboard`, w, bc),
    boxRow(`  ${c(gray, ">")} run diagnostics`, w, bc),
    boxRow("", w, bc),
    boxRow(`Type ${c(cyan, "'help'")} to see all commands.`, w, bc),
    boxRow("", w, bc),
    boxBottom(w, bc),
  ];
}

// ─── Header section (logo + tips side by side) ───────────────────────────────
function headerSection(version: string): string {
  const banner = asciiBanner().split("\n");
  const logoLines: string[] = [
    `  ${bold}${cyan}🤖${reset}`,
    "",
    ...banner,
    "",
    `     ${c(dim + white, "AI  ASSISTANT  PLATFORM")}`,
    `     ${c(dim, "v" + version)}`,
  ];
  const tips = tipsPanel();
  const maxLines = Math.max(logoLines.length, tips.length);
  const rows: string[] = [];
  for (let i = 0; i < maxLines; i++) {
    const left  = logoLines[i] ?? "";
    const right = tips[i]      ?? "";
    // Pad left to 62 visible chars
    const leftPad = left + " ".repeat(Math.max(0, 62 - vlen(left)));
    rows.push(`${leftPad}  ${right}`);
  }
  return rows.join("\n");
}

// ─── PROJECT STATUS panel ─────────────────────────────────────────────────────
function projectStatusPanel(project: ProjectDetection): string[] {
  const w  = 52;
  const bc = blue;

  const projName = typeof project.packageJson?.name === "string"
    ? project.packageJson.name : "Not detected";

  const deps: Record<string, unknown> = Object.assign(
    {},
    (project.packageJson as Record<string, unknown> | null)?.["dependencies"],
    (project.packageJson as Record<string, unknown> | null)?.["devDependencies"],
  );
  const fwVer =
    (typeof deps["next"]  === "string" ? `Next.js ${deps["next"].toString().replace(/^[^0-9]/, "")}`  : null) ||
    (typeof deps["react"] === "string" ? `React ${deps["react"].toString().replace(/^[^0-9]/, "")}`   : null) ||
    (typeof deps["vite"]  === "string" ? `Vite ${deps["vite"].toString().replace(/^[^0-9]/, "")}`     : null) ||
    (typeof deps["vue"]   === "string" ? `Vue ${deps["vue"].toString().replace(/^[^0-9]/, "")}`       : null) ||
    project.framework;

  const sdkOk = Boolean(project.sdkVersion);

  function row(icon: string, label: string, value: string, ok = true): string {
    const inner = `${icon} ${c(cyan, label.padEnd(16))} ${c(white, value)}  ${ok ? DOT_OK : DOT_WARN}`;
    return boxRow(inner, w, bc);
  }

  return [
    boxTop(w, bc),
    boxRow(`${bold}${blue}📁 PROJECT STATUS${reset}`, w, bc),
    boxRow("", w, bc),
    row("📂", "Project",         projName),
    row("Ⓝ",  "Framework",       fwVer),
    row("TS", "Language",        project.language),
    row("🟢", "Node.js",         process.version),
    row("📦", "Package Manager", project.packageManager),
    row("🤖", "@asiyst/sdk",     project.sdkVersion ?? "Not installed", sdkOk),
    boxRow("", w, bc),
    boxBottom(w, bc),
  ];
}

// ─── ASIYST STATUS panel ──────────────────────────────────────────────────────
function asiystStatusPanel(project: ProjectDetection, connection = "Not connected"): string[] {
  const w  = 48;
  const bc = blue;
  const connected = connection !== "Not connected";
  const connVal   = connected ? c(green,  connection)          : c(yellow, "Not connected");
  const projId    = project.config.projectId ?? c(gray, "—");

  function row(icon: string, label: string, value: string, warn = false): string {
    const inner = `${icon} ${c(cyan, label.padEnd(13))} ${value}  ${warn ? DOT_WARN : ""}`;
    return boxRow(inner, w, bc);
  }

  return [
    boxTop(w, bc),
    boxRow(`${bold}${blue}🤖 ASIYST STATUS${reset}`, w, bc),
    boxRow("", w, bc),
    row("🔗", "Connection",  connVal,            !connected),
    row("👤", "Avatar",      c(yellow, "Not configured"), true),
    row("🌐", "AI Provider", c(yellow, "Not configured"), true),
    row("🪪", "Project ID",  projId,             false),
    row("💻", "Environment", c(blue, "development"), false),
    boxRow("", w, bc),
    boxBottom(w, bc),
  ];
}

// ─── Two-column layout ────────────────────────────────────────────────────────
function twoColumns(left: string[], right: string[]): string {
  const maxLen = Math.max(left.length, right.length);
  const rows: string[] = [];
  for (let i = 0; i < maxLen; i++) {
    const l = left[i]  ?? " ".repeat(52);
    const r = right[i] ?? "";
    rows.push(`${l}  ${r}`);
  }
  return rows.join("\n");
}

// ─── Welcome message box ──────────────────────────────────────────────────────
function welcomeBox(): string {
  const w  = 104;
  const bc = blue;
  return [
    boxTop(w, bc),
    boxRow(`${bold}${white}Welcome to Asiyst CLI! 👋${reset}`, w, bc),
    boxRow(`I can help you connect, configure, and manage your Asiyst assistant.`, w, bc),
    boxRow(`What would you like to do?`, w, bc),
    boxRow("", w, bc),
    boxBottom(w, bc),
  ].join("\n");
}

// ─── Suggestions bar ──────────────────────────────────────────────────────────
function suggestionsBar(): string {
  const chips = ["connect", "status", "diagnostics", "dashboard", "avatar", "help"]
    .map((s) => `${bgBlue}${white}  ${s}  ${reset}`);
  return `${c(gray, "Suggestions:")}  ${chips.join("  ")}`;
}

// ─── Bottom status bar ────────────────────────────────────────────────────────
function statusBar(): string {
  const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const leftParts = [
    `${c(gray, "↑↓")} Navigate`,
    `${c(gray, "Enter")} Select`,
    `${c(gray, "Ctrl+C")} Cancel`,
    `${c(gray, "Tab")} Autocomplete`,
    `${c(gray, "?")} Help`,
    `${c(gray, "Ctrl+L")} Clear`,
    `${c(gray, "Ctrl+D")} Exit`,
  ];
  const left  = leftParts.join("  ");
  const right = `${DOT_OK} Online  ${c(white, time)}`;
  const totalW = 104;
  const gap = Math.max(2, totalW - vlen(left) - vlen(right));
  return `${E}40m${left}${" ".repeat(gap)}${right}${reset}`;
}

// ─── Full home screen (called by interactiveHome) ─────────────────────────────
export function homeScreen(project: ProjectDetection, connection = "Not connected"): void {
  const version = readCurrentVersion();
  const divider = c(gray, "─".repeat(104));
  console.log("");
  console.log(headerSection(version));
  console.log("");
  console.log(divider);
  console.log("");
  console.log(twoColumns(projectStatusPanel(project), asiystStatusPanel(project, connection)));
  console.log("");
  console.log(welcomeBox());
  console.log("");
  console.log(suggestionsBar());
  console.log("");
  console.log(statusBar());
  console.log("");
}

// ─── Kept exports (used by other commands) ────────────────────────────────────
export const ok = (label: string, detail = "") =>
  console.log(`${c(green, "✓")} ${label}${detail ? c(gray, ` (${detail})`) : ""}`);
export const fail = (label: string, detail = "") =>
  console.log(`${c(yellow, "✗")} ${label}${detail ? c(gray, `: ${detail}`) : ""}`);

export function banner(version = readCurrentVersion()): void {
  console.log(
    `\n${bold}${cyan}╭──────────────────────────────────────────────╮${reset}\n` +
    `${cyan}│${reset}                                              ${cyan}│${reset}\n` +
    `${cyan}│${reset}       ${bold}ASIYST${reset}                                 ${cyan}│${reset}\n` +
    `${cyan}│${reset}       AI ASSISTANT PLATFORM                  ${cyan}│${reset}\n` +
    `${cyan}│${reset}       v${version.padEnd(38)}${cyan}│${reset}\n` +
    `${cyan}│${reset}                                              ${cyan}│${reset}\n` +
    `${cyan}╰──────────────────────────────────────────────╯${reset}\n`,
  );
}

export function projectChecks(project: ProjectDetection): void {
  project.packageJson
    ? ok("Project detected", typeof project.packageJson.name === "string" ? project.packageJson.name : project.cwd)
    : fail("Project not detected", "package.json is missing");
  ok("Framework detected", project.framework);
  ok("Language detected", project.language);
  ok("Node.js detected", process.version);
  ok("Package manager detected", project.packageManager);
  project.sdkVersion
    ? ok("@asiyst/sdk detected", project.sdkVersion)
    : fail("@asiyst/sdk is not installed", "npm install @asiyst/sdk");
}

export function homeStatus(project: ProjectDetection, connection = "Not connected"): void {
  homeScreen(project, connection);
}

export function printVerification(results: VerificationResult[]): boolean {
  console.log(`\n${bold}Asiyst Installation Verification${reset}\n`);
  for (const result of results)
    result.ok ? ok(result.name, result.detail) : fail(result.name, result.detail ?? "");
  const success = results.length > 0 && results.every((r) => r.ok);
  if (success) console.log(`\n${c(cyan, "────────────────────────────")}\n\n${c(green, bold + "ASIYST IS READY ✓" + reset)}`);
  return success;
}
