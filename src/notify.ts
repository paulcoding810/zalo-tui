import { spawn } from "node:child_process";
import type { ChatMessage, State } from "./store.ts";

export type NotifyMode = "full" | "sender" | "off";

export const NOTIFY_MODES: NotifyMode[] = ["full", "sender", "off"];

export function nextNotifyMode(mode: NotifyMode): NotifyMode {
  return NOTIFY_MODES[(NOTIFY_MODES.indexOf(mode) + 1) % NOTIFY_MODES.length]!;
}

export type MuteEntry = { duration: number; startTime: number };

export function mutedUntil(entry: MuteEntry): number {
  return entry.duration === -1 ? Infinity : (entry.startTime + entry.duration) * 1000;
}

export function shouldNotify(
  m: ChatMessage,
  state: State,
  muted: Map<string, number>,
  now: number = Date.now(),
): boolean {
  if (state.notify === "off" || m.isSelf) return false;
  if (m.threadKey === state.activeKey) return false;
  if ((muted.get(m.threadKey) ?? 0) > now) return false;
  return state.threads[m.threadKey]?.kind === "group" ? !!m.mentionsMe : true;
}

export function notificationContent(m: ChatMessage, state: State): { title: string; body: string } {
  const thread = state.threads[m.threadKey];
  const title = thread?.kind === "group" ? `${m.senderName} in ${thread.name}` : m.senderName;
  if (state.notify === "sender") return { title, body: "New message" };
  const chars = Array.from(m.text.replace(/\s+/g, " ").trim());
  return { title, body: chars.length > 120 ? chars.slice(0, 119).join("") + "…" : chars.join("") };
}

export function showNotification(title: string, body: string): void {
  process.stdout.write("\x07");
  const command =
    process.platform === "darwin"
      ? [
          "osascript",
          [
            "-e",
            "on run argv",
            "-e",
            "display notification (item 2 of argv) with title \"Zalo\" subtitle (item 1 of argv)",
            "-e",
            "end run",
            title,
            body,
          ],
        ]
      : process.platform === "linux"
        ? ["notify-send", ["--app-name=Zalo", title, body]]
        : null;
  if (!command) return;
  try {
    const child = spawn(command[0] as string, command[1] as string[], { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
  } catch {}
}
