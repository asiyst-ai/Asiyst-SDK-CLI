import { stdin, stdout } from "node:process";
import { emitKeypressEvents } from "node:readline";
import { loadConnection, loadOnboardingSession } from "../config/credentials.js";
import { detectProject } from "../detection/project.js";
import { muted, section, symbols, title, success } from "../ui/format.js";
import { readCurrentVersion } from "../config/version.js";
import { setInteractiveInputProvider } from "../ui/secret.js";
import {
  BRACKETED_PASTE_END,
  BRACKETED_PASTE_START,
  consumeSecretInput,
  type SecretInputState,
} from "../ui/secret.js";
import { connectCommand } from "./connect.js";
import { disconnectCommand } from "./disconnect.js";
import { healthCommand } from "./health.js";
import { statusCommand } from "./status.js";
import { verifyCommand } from "./verify.js";
import { avatarCommand } from "./avatar.js";
import { updateCommand } from "./update.js";
import { doctorCommand } from "./doctor.js";
import { projectCommand } from "./project.js";
import { knowledgeCommand } from "./knowledge.js";
import { configCommand } from "./config.js";
import { loginCommand } from "./login.js";
import { logoutCommand } from "./logout.js";
import { testCommand } from "./test.js";
import { validateCommand } from "./validate.js";
import { deployCommand } from "./deploy.js";
import { publishCommand } from "./publish.js";
import { requireAuthenticated } from "./authenticated.js";
import { createApiClient } from "./shared.js";
import { verifyApiKeyRelationship, verifyAvatar } from "../api/verification.js";
import { pushCommand } from "./push.js";
import { clearCommand } from "./clear.js";
import { parseProjectIdArgument } from "../config/ids.js";
import { setInteractiveSelector, type SelectorOption } from "../ui/selector.js";
import { detectEnvironment, displayFramework } from "../detection/project.js";

type SlashHandler = (args: string[]) => Promise<void> | void;
type CommandEntry = { input: string; label: string };
type LandingStatus = {
  authenticated: boolean;
  connected: boolean;
  avatar: boolean;
  provider: boolean;
  projectId?: string;
  projectName?: string;
  framework?: string;
  environment?: string;
  language?: string;
  packageManager?: string;
  sdkVersion?: string;
};

const HELP: Record<string, string> = {
  help: "Show available commands. Example: /help status",
  status: "Verify and display the current Asiyst connection state.",
  project: "Show the current project or open /project list.",
  avatar: "Manage the current avatar. Example: /avatar import or /avatar open",
  knowledge: "Open the real Knowledge dashboard for the connected project.",
  "knowledge sync": "Sync knowledge from connected sources when the backend exposes sync.",
  connect: "Run the existing secure Asiyst connection flow.",
  disconnect: "Remove local connection information after confirmation.",
  update: "Check for and optionally install a newer CLI version.",
  config: "Show safe local configuration. Use /config reset to remove it.",
  version: "Show the CLI version, runtime, and platform.",
  doctor: "Run diagnostics for the CLI, project, credentials, and API.",
  verify: "Verify local SDK integration and backend website state.",
  health: "Check Asiyst API connectivity.",
  api: "Check the Asiyst API health endpoint.",
  "api-key": "Show safe API-key configuration status.",
  sdk: "Verify the local SDK integration.",
  diagnose: "Run diagnostics for the CLI, project, credentials, and API.",
  exit: "Exit interactive mode.",
  login: "Sign in to your Asiyst account. Existing sessions are checked and reused; expired sessions are replaced through browser authorization.",
  logout: "Log out of Asiyst.",
  test: "Test the Asiyst integration.",
  validate: "Validate project and SDK configuration.",
  deploy: "Deploy Asiyst configuration.",
  publish: "Publish avatar and configuration.",
  push: "Push the verified avatar configuration to the connected website.",
  clear: "Clear the terminal without changing project or authentication state.",
};

const COMMANDS: CommandEntry[] = Object.keys(HELP).map((input) => ({
  input,
  label: HELP[input].split(".")[0],
}));

function outputLines(value: string): string[] {
  return value.split(/\r?\n/);
}

function printHelp(command?: string): void {
  if (command && HELP[command]) {
    console.log(`\n/${command}\n${HELP[command]}`);
    return;
  }
  console.log("\nASIYST CLI COMMANDS\n\nUsage: asiyst [command]\n");
  const commandWidth = Math.max(...COMMANDS.map(({ input }) => input.length), 12) + 2;
  for (const { input, label } of COMMANDS) console.log(`/${input.padEnd(commandWidth)} ${label}`);
}

export function interactiveHelp(): void {
  printHelp();
  console.log("\n↑ ↓ history  Tab complete  Enter run  Ctrl+L clear  Ctrl+C exit");
}

function matches(value: string): CommandEntry[] {
  const query = value.trim().replace(/^\/+/, "").toLowerCase();
  if (!query) return COMMANDS;
  return COMMANDS.filter((command) => command.input.startsWith(query));
}

class TerminalPanel {
  private readonly history: string[] = [];
  private readonly commands: string[] = [];
  private historyIndex = 0;
  private editor = "";
  private prompt = "asiyst › ";
  private secret = false;
  private active = 0;
  private suggestionsOpen = false;
  private selection?: {
    question: string;
    options: SelectorOption<unknown>[];
    active: number;
  };
  private status: LandingStatus = { authenticated: false, connected: false, avatar: false, provider: false };

  setStatus(status: LandingStatus): void {
    this.status = status;
  }

  clearHistory(): void {
    this.history.length = 0;
  }

  async refreshStatus(cwd = process.cwd()): Promise<void> {
    const [connection, session] = await Promise.all([
      loadConnection(cwd),
      loadOnboardingSession(),
    ]);
    let connected = Boolean(connection?.userId && connection.projectId && connection.apiKey);
    let avatar = Boolean(connection?.avatarId);
    if (connected && connection?.userId && connection.projectId && connection.apiKey) {
      try {
        const api = createApiClient();
        await verifyApiKeyRelationship(api, {
          userId: connection.userId,
          projectId: connection.projectId,
          apiKey: connection.apiKey,
        });
        if (connection.avatarId) {
          await verifyAvatar(api, {
            userId: connection.userId,
            projectId: connection.projectId,
            apiKey: connection.apiKey,
            avatarId: connection.avatarId,
          });
        }
      } catch {
        connected = false;
        avatar = false;
      }
    }
    this.setStatus({
      authenticated: Boolean(session),
      connected,
      avatar,
      provider: false,
      projectId: connection?.projectId,
      projectName: connection?.projectName,
    });
  }

  append(value: string): void {
    this.history.push(...outputLines(value));
    this.history.splice(0, Math.max(0, this.history.length - 500));
  }

  clear(): void {
    this.history.length = 0;
  }

  async read(prompt: string, secret: boolean): Promise<string | undefined> {
    this.prompt = prompt || "asiyst › ";
    this.secret = secret;
    this.editor = "";
    this.active = 0;
    this.suggestionsOpen = false;
    this.render();
    return new Promise((resolve) => {
      let pasteState: SecretInputState = { value: this.editor, inBracketedPaste: false };
      const finish = (value: string | undefined) => {
        stdin.off("keypress", onKeypress);
        stdout.off("resize", onResize);
        this.secret = false;
        this.prompt = "asiyst › ";
        this.editor = "";
        this.active = 0;
        if (value !== undefined && value.trim()) {
          this.commands.push(value.trim());
          this.historyIndex = this.commands.length;
        }
        this.render();
        resolve(value?.trim());
      };
      const onResize = () => this.render();
      const onKeypress = (chunk: string, key: { name?: string; ctrl?: boolean; sequence?: string }) => {
        const sequence = key.sequence || chunk;
        if (
          pasteState.inBracketedPaste
          || sequence.includes(BRACKETED_PASTE_START)
          || sequence.includes(BRACKETED_PASTE_END)
        ) {
          const action = consumeSecretInput(pasteState, sequence);
          if (action.type === "cancel") return finish(undefined);
          if (action.type === "submit") return finish(action.value);
          pasteState = action.state;
          this.editor = pasteState.value;
          this.active = 0;
          this.suggestionsOpen = this.editor.startsWith("/");
          return this.render();
        }
        if (key.ctrl && key.name === "c") return finish(undefined);
        if (key.ctrl && key.name === "l") {
          this.clear();
          return this.render();
        }
        if (key.name === "backspace") {
          this.editor = this.editor.slice(0, -1);
          return this.render();
        }
        if (key.name === "up" && (!this.suggestionsOpen || !this.editor.startsWith("/"))) {
          if (this.suggestionsOpen) {
            const options = matches(this.editor);
            this.active = Math.max(0, this.active - 1);
            if (options[this.active]) this.editor = `/${options[this.active].input}`;
            return this.render();
          }
          this.historyIndex = Math.max(0, this.historyIndex - 1);
          this.editor = this.commands[this.historyIndex] ?? "";
          return this.render();
        }
        if (key.name === "down" && (!this.suggestionsOpen || !this.editor.startsWith("/"))) {
          if (this.suggestionsOpen) {
            const options = matches(this.editor);
            this.active = Math.min(Math.max(0, options.length - 1), this.active + 1);
            if (options[this.active]) this.editor = `/${options[this.active].input}`;
            return this.render();
          }
          this.historyIndex = Math.min(this.commands.length, this.historyIndex + 1);
          this.editor = this.commands[this.historyIndex] ?? "";
          return this.render();
        }
        if ((key.name === "up" || key.name === "down") && this.suggestionsOpen) {
          const options = matches(this.editor);
          this.active = key.name === "up"
            ? Math.max(0, this.active - 1)
            : Math.min(Math.max(0, options.length - 1), this.active + 1);
          if (options[this.active]) this.editor = `/${options[this.active].input}`;
          return this.render();
        }
        if (key.name === "tab") {
          const option = matches(this.editor)[this.active];
          if (option) this.editor = `/${option.input}`;
          return this.render();
        }
        if (key.name === "escape") {
          if (this.suggestionsOpen) {
            this.suggestionsOpen = false;
            return this.render();
          }
          return finish(undefined);
        }
        if (key.name === "return" || key.name === "enter") {
          if (this.suggestionsOpen) {
            const option = matches(this.editor)[this.active];
            if (option && this.editor !== `/${option.input}`) this.editor = `/${option.input}`;
          }
          return finish(this.editor);
        }
        if (sequence && /^[\x20-\x7e]+$/.test(sequence)) {
          this.editor += sequence;
          pasteState = { value: this.editor, inBracketedPaste: false };
          this.active = 0;
          this.suggestionsOpen = this.editor.startsWith("/");
          this.render();
        }
      };
      stdin.on("keypress", onKeypress);
      stdout.on("resize", onResize);
      this.render();
    });
  }

  async select(question: string, options: SelectorOption<unknown>[]): Promise<unknown | undefined> {
    if (!options.length) return undefined;
    this.selection = { question, options, active: 0 };
    this.render();
    return new Promise((resolve) => {
      const finish = (value: unknown | undefined) => {
        stdin.off("keypress", onKeypress);
        this.selection = undefined;
        this.render();
        resolve(value);
      };
      const onKeypress = (chunk: string, key: { name?: string; ctrl?: boolean }) => {
        if (key.ctrl && key.name === "c") return finish(undefined);
        if (key.name === "escape") return finish(undefined);
        if (key.name === "up" || chunk === "k") {
          this.selection!.active = Math.max(0, this.selection!.active - 1);
          return this.render();
        }
        if (key.name === "down" || chunk === "j") {
          this.selection!.active = Math.min(this.selection!.options.length - 1, this.selection!.active + 1);
          return this.render();
        }
        if (key.name === "return" || key.name === "enter") {
          return finish(this.selection!.options[this.selection!.active]?.value);
        }
      };
      stdin.on("keypress", onKeypress);
    });
  }

  render(): void {
    if (!stdout.isTTY) return;
    const width = Math.max(40, stdout.columns || 80);
    const height = Math.max(8, stdout.rows || 24);
    const suggestions = this.suggestionsOpen && this.editor.startsWith("/") ? matches(this.editor) : [];
    const wrap = (line: string): string[] => {
      if (!line) return [""];
      const result: string[] = [];
      for (let index = 0; index < line.length; index += width - 2) result.push(line.slice(index, index + width - 2));
      return result;
    };
    const input = this.secret ? "•".repeat(this.editor.length) : this.editor;
    const statusLine = (marker: string, label: string, value: string): string =>
      `${label.padEnd(17)} ${marker} ${value}`;
    const logo = width >= 58
      ?
      [
        " █████    ██████   ████████  ██     ██   ██████   ████████ ",
        "██   ██  ██           ██      ██   ██   ██           ██   ",
        "██   ██   ██████      ██        ███      ██████      ██   ",
        "███████        ██     ██        ███           ██     ██   ",
        "██   ██   ██████   ████████     ███      ██████      ██   "
      ]
      : ["ASIYST"];
    const header = [
      "",
      ...logo.map((line) => line.length > width ? line.slice(0, width) : line),
      "AI ASSISTANT PLATFORM",
      `version ${readCurrentVersion()}`,
      "",
      section("ASIYST STATUS"),
      statusLine(this.status.connected ? success(symbols.connected) : muted(symbols.disconnected), "Connection", this.status.connected ? "Connected" : "Not connected"),
      statusLine(this.status.avatar ? success(symbols.connected) : muted(symbols.disconnected), "Avatar", this.status.avatar ? "Active" : "Not configured"),
      statusLine(this.status.provider ? success(symbols.connected) : muted(symbols.disconnected), "AI Provider", this.status.provider ? "Configured" : "Not configured"),
      statusLine(this.status.projectId ? success(symbols.connected) : muted(symbols.disconnected), "Project ID", this.status.projectId ?? "—"),
      statusLine(this.status.projectName ? success(symbols.connected) : muted(symbols.disconnected), "Project", this.status.projectName ?? "—"),
      "",
    ];
    const suggestionRows = suggestions.slice(0, 5).map((item, index) =>
      `${index === this.active ? `${section("❯")} /${title(item.input.padEnd(18))}` : `  /${item.input.padEnd(18)}`} ${muted(item.label)}`);
    const selectionRows = this.selection
      ? [
        this.selection.question,
        "",
        ...this.selection.options.map((option, index) =>
          index === this.selection!.active
            ? `${section("❯")} ${title(option.label)}`
            : `  ${option.label}`),
      ]
      : [];
    const inputWidth = Math.max(20, width - 4);
    const inputText = `${this.prompt}${input || "Type a command..."}`;
    const inputLine = inputText.length > inputWidth ? inputText.slice(-inputWidth) : inputText;
    const border = "─".repeat(inputWidth + 2);
    const inputBox = [
      `┌${border}┐`,
      `│ ${inputLine.padEnd(inputWidth)} │`,
      `└${border}┘`,
    ];
    const headerRowsNeeded = header.length;
    const suggestionSpace = Math.max(0, height - inputBox.length - headerRowsNeeded - 1);
    const visibleSuggestions = suggestionSpace > 0
      ? suggestionRows.slice(0, Math.min(5, suggestionSpace))
      : [];
    const footer = selectionRows.length
      ? [...selectionRows, "", ...inputBox]
      : visibleSuggestions.length
        ? [...visibleSuggestions, "", ...inputBox]
        : inputBox;
    const maxHeaderRows = Math.max(0, height - footer.length);
    const visibleHeader = header.slice(0, maxHeaderRows);
    const contentHeight = Math.max(0, height - visibleHeader.length - footer.length);
    const content = this.history.flatMap(wrap).slice(-contentHeight);
    const top = [
      ...visibleHeader,
      ...content,
      ...Array(Math.max(0, contentHeight - content.length)).fill(""),
    ];
    const editorLength = this.editor.length;
    const cursorOffset = input ? this.prompt.length + editorLength : this.prompt.length;
    const cursorColumn = Math.min(inputWidth + 3, Math.max(3, cursorOffset + 3));
    const topOutput = top.join("\n");
    const footerOutput = footer.join("\n");
    stdout.write(
      `\x1b[?25l\x1b[2J\x1b[3J\x1b[H${topOutput}`
      + `\x1b[999B\x1b[${Math.max(0, footer.length - 1)}A\r${footerOutput}`
      + `\x1b[1A\x1b[${cursorColumn}G\x1b[?25h\x1b[0m`,
    );
  }
}

function versionCommand(): void {
  console.log(`\nAsiyst CLI\nVersion: ${readCurrentVersion()}\nNode.js: ${process.version}\nPlatform: ${process.platform}`);
  console.log(`SDK: ${detectProject().sdkVersion ?? "Not installed"}`);
}

const ROUTES: Record<string, SlashHandler> = {
  help: (args) => printHelp(args.join(" ")),
  status: async () => { if (await requireAuthenticated()) await statusCommand(); },
  project: async (args) => { if (await requireAuthenticated()) await projectCommand(process.cwd(), args); },
  avatar: async (args) => { if (await requireAuthenticated()) await avatarCommand(process.cwd(), args); },
  knowledge: (args) => knowledgeCommand(process.cwd(), args),
  connect: (args) => connectCommand(process.cwd(), undefined, parseProjectIdArgument(args)),
  disconnect: () => disconnectCommand(),
  update: () => updateCommand(),
  config: (args) => configCommand(process.cwd(), args),
  version: versionCommand,
  doctor: () => doctorCommand(),
  verify: async () => { if (await requireAuthenticated()) await verifyCommand(); },
  health: () => healthCommand(),
  api: async () => { if (await requireAuthenticated()) await healthCommand(); },
  "api-key": (args) => configCommand(process.cwd(), args),
  sdk: async () => { if (await requireAuthenticated()) await verifyCommand(); },
  diagnose: () => doctorCommand(),
  login: () => loginCommand(),
  logout: () => logoutCommand(),
  test: async () => { if (await requireAuthenticated()) await testCommand(); },
  validate: async () => { if (await requireAuthenticated()) await validateCommand(); },
  deploy: async () => { if (await requireAuthenticated()) await deployCommand(); },
  publish: async () => { if (await requireAuthenticated()) await publishCommand(); },
  push: async () => { if (await requireAuthenticated()) await pushCommand(); },
  clear: () => clearCommand(),
};

function closest(value: string): string | undefined {
  return COMMANDS.find((command) => command.input.startsWith(value.toLowerCase().slice(0, 3)))?.input;
}

async function runCommand(input: string, panel: TerminalPanel): Promise<boolean> {
  const natural: Record<string, string> = {
    "connect my project": "/connect",
    "verify this project": "/verify",
    "show my api keys": "/config",
    "connect sdk": "/verify",
    "update cli": "/update",
    "run diagnostics": "/doctor",
    "show avatar": "/avatar",
    "check connection": "/status",
  };
  const normalized = (natural[input.trim().toLowerCase()] ?? input).trim().replace(/^\/+/, "");
  if (!normalized) return true;
  const parts = normalized.split(/\s+/);
  const root = parts[0].toLowerCase();
  if (root === "clear") panel.clearHistory();
  if (root === "exit" || root === "quit") return false;
  const route = ROUTES[root];
  if (!route) {
    panel.append(`✕ Unknown command: /${root}\nType /help to see available commands.${closest(root) ? `\nDid you mean: /${closest(root)}` : ""}`);
    panel.render();
    return true;
  }
  panel.append(`asiyst › ${input}`);
  panel.append(`⠋ Running ${root}...`);
  panel.render();
  try {
    await route(parts.slice(1));
    await panel.refreshStatus();
  } catch (error) {
    panel.append(`✕ ${error instanceof Error ? error.message : "Operation failed."}`);
  }
  panel.render();
  return true;
}

export async function interactiveHome(): Promise<void> {
  if (!stdin.isTTY || !stdout.isTTY) return;
  emitKeypressEvents(stdin);
  const panel = new TerminalPanel();
  const project = detectProject();
  const connection = await loadConnection(process.cwd());
  panel.append(`Project: ${connection?.projectName ?? "—"}`);
  panel.append(`Framework: ${displayFramework(project.framework)}`);
  panel.append(`Environment: ${detectEnvironment()} · ${project.language} · ${project.packageManager}`);
  panel.append(`SDK: ${project.sdkVersion ?? "Not installed"}`);
  panel.append("Type / to see available commands.");
  await panel.refreshStatus();
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    panel.append(args.map((arg) => typeof arg === "string" ? arg : String(arg)).join(" "));
    panel.render();
  };
  setInteractiveInputProvider((prompt, secret) => panel.read(prompt, secret));
  setInteractiveSelector((question, options) => panel.select(question, options));
  stdin.setRawMode?.(true);
  stdin.resume();
  panel.render();
  try {
    for (;;) {
      const command = await panel.read("asiyst › ", false);
      if (command === undefined || !(await runCommand(command, panel))) break;
    }
  } finally {
    setInteractiveInputProvider(undefined);
    setInteractiveSelector(undefined);
    console.log = originalLog;
    stdin.setRawMode?.(false);
    stdout.write("\x1b[0m\n");
  }
}
