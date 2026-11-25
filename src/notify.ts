import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";
import type { ChatMessage, State } from "./store.ts";

export type NotifyMode = "full" | "sender" | "off";

export const NOTIFY_MODES: NotifyMode[] = ["full", "sender", "off"];

export type GroupNotify = "all" | "mentions";

export const GROUP_NOTIFY_MODES: GroupNotify[] = ["all", "mentions"];

export function nextNotifyMode(mode: NotifyMode): NotifyMode {
  return NOTIFY_MODES[(NOTIFY_MODES.indexOf(mode) + 1) % NOTIFY_MODES.length]!;
}

export type MuteEntry = { duration: number; startTime: number };

export function mutedUntil(entry: MuteEntry): number {
  return entry.duration === -1 ? Infinity : (entry.startTime + entry.duration) * 1000;
}

export function notifySkipReason(
  m: ChatMessage,
  state: State,
  muted: Map<string, number>,
  now: number = Date.now(),
): string | null {
  if (state.notify === "off") return "notifications off";
  if (m.isSelf) return "own message";
  if (m.threadKey === state.activeKey && state.terminalFocused) return "chat open and terminal focused";
  const isGroup = state.threads[m.threadKey]?.kind === "group";
  if (isGroup && state.notifyGroups === "mentions") return m.mentionsMe ? null : "group message without mention";
  if ((muted.get(m.threadKey) ?? 0) > now) return "chat muted";
  return null;
}

export function shouldNotify(
  m: ChatMessage,
  state: State,
  muted: Map<string, number>,
  now: number = Date.now(),
): boolean {
  return notifySkipReason(m, state, muted, now) === null;
}

export function notificationContent(m: ChatMessage, state: State): { title: string; body: string } {
  const thread = state.threads[m.threadKey];
  const title = thread?.kind === "group" ? `${m.senderName} in ${thread.name}` : m.senderName;
  if (state.notify === "sender") return { title, body: "New message" };
  const chars = Array.from(m.text.replace(/\s+/g, " ").trim());
  return { title, body: chars.length > 120 ? chars.slice(0, 119).join("") + "…" : chars.join("") };
}

export type NotifierEnv = { platform: NodeJS.Platform; terminalNotifier: string | null; terminalApp?: string };

export function notificationCommand(title: string, body: string, group: string, env: NotifierEnv): [string, string[]] | null {
  if (env.platform === "darwin" && env.terminalNotifier) {
    const literal = (value: string) => `\\${value || " "}`;
    const args = ["-title", "Zalo", "-subtitle", literal(title), "-message", literal(body), "-group", `zalo-tui:${group}`];
    if (env.terminalApp) args.push("-activate", env.terminalApp);
    return [env.terminalNotifier, args];
  }
  if (env.platform === "darwin") {
    return [
      "osascript",
      ["-e", "on run argv", "-e", 'display notification (item 2 of argv) with title "Zalo" subtitle (item 1 of argv)', "-e", "end run", title, body],
    ];
  }
  if (env.platform === "linux") return ["notify-send", ["--app-name=Zalo", title, body]];
  return null;
}

let notifierEnv: NotifierEnv | undefined;

function findOnPath(name: string): string | null {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, name);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {}
  }
  return null;
}

function currentEnv(): NotifierEnv {
  notifierEnv ??= {
    platform: process.platform,
    terminalNotifier: process.platform === "darwin" ? findOnPath("terminal-notifier") : null,
    terminalApp: process.env.__CFBundleIdentifier || undefined,
  };
  return notifierEnv;
}

export function showNotification(title: string, body: string, group: string): void {
  process.stdout.write("\x07");
  const command = notificationCommand(title, body, group, currentEnv());
  if (!command) return;
  try {
    const child = spawn(command[0], command[1], { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
  } catch {}
}
