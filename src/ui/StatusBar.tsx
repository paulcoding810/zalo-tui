import { Text } from "ink";
import type { GroupNotify, NotifyMode } from "../notify.ts";
import type { Connection } from "../store.ts";

const COLORS = { idle: "gray", connecting: "yellow", connected: "green", closed: "red" } as const;

type Props = {
  connection: Connection;
  selfName: string;
  focus: "list" | "input" | "messages";
  notify: NotifyMode;
  notifyGroups: GroupNotify;
  toast?: string;
};

const NOTIFY_LABEL: Record<NotifyMode, string> = { full: "notify on", sender: "notify sender", off: "notify off" };

export function StatusBar({ connection, selfName, focus, notify, notifyGroups, toast }: Props) {
  const label = connection.state === "closed" ? `disconnected: ${connection.reason ?? ""} · r reconnect` : connection.state;
  const hints =
    focus === "list"
      ? "j/k move · Enter open · / filter · ? help"
      : focus === "input"
        ? "Enter send · Alt+Enter new line · Esc back"
        : "r reply · e react · w who · d delete · o open · ? help";
  return (
    <Text wrap="truncate-end">
      <Text color={COLORS[connection.state]}>● {label}</Text>
      {toast ? <Text color="yellow"> · {toast}</Text> : null}
      <Text dimColor> · {selfName} · {NOTIFY_LABEL[notify]}{notify !== "off" && notifyGroups === "mentions" ? " (groups: @me)" : ""} · {hints}</Text>
    </Text>
  );
}
