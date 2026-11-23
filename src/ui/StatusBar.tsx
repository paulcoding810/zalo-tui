import { Text } from "ink";
import type { NotifyMode } from "../notify.ts";
import type { Connection } from "../store.ts";

const COLORS = { idle: "gray", connecting: "yellow", connected: "green", closed: "red" } as const;

type Props = {
  connection: Connection;
  selfName: string;
  focus: "list" | "input";
  notify: NotifyMode;
  toast?: string;
};

const NOTIFY_LABEL: Record<NotifyMode, string> = { full: "notify on", sender: "notify sender", off: "notify off" };

export function StatusBar({ connection, selfName, focus, notify, toast }: Props) {
  const label = connection.state === "closed" ? `disconnected: ${connection.reason ?? ""} · r reconnect` : connection.state;
  const hints =
    focus === "list"
      ? "↑↓ move · Enter open · / filter · n notify · Tab compose · Ctrl+C quit"
      : "Enter send · Esc/Tab chats · PgUp/PgDn scroll · Ctrl+C quit";
  return (
    <Text wrap="truncate-end">
      <Text color={COLORS[connection.state]}>● {label}</Text>
      {toast ? <Text color="yellow"> · {toast}</Text> : null}
      <Text dimColor> · {selfName} · {NOTIFY_LABEL[notify]} · {hints}</Text>
    </Text>
  );
}
