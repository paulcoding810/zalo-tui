import { Text } from "ink";
import type { Connection } from "../store.ts";

const COLORS = { idle: "gray", connecting: "yellow", connected: "green", closed: "red" } as const;

export function StatusBar({ connection, selfName, focus }: { connection: Connection; selfName: string; focus: "list" | "input" }) {
  const label = connection.state === "closed" ? `disconnected: ${connection.reason ?? ""} · r reconnect` : connection.state;
  const hints =
    focus === "list"
      ? "↑↓ move · Enter open · / filter · Tab compose · PgUp/PgDn scroll · Ctrl+C quit"
      : "Enter send · Esc/Tab chats · PgUp/PgDn scroll · Ctrl+C quit";
  return (
    <Text wrap="truncate-end">
      <Text color={COLORS[connection.state]}>● {label}</Text>
      <Text dimColor> · {selfName} · {hints}</Text>
    </Text>
  );
}
