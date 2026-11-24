import { Box, Text } from "ink";
import type { Thread } from "../store.ts";

type Props = {
  threads: Thread[];
  selected: number;
  activeKey: string | null;
  unread: Record<string, number>;
  filter: string;
  filtering: boolean;
  focused: boolean;
  width: number;
  height: number;
  info?: { current: { start: number; filterRow: boolean } };
};

export function ChatList({ threads, selected, activeKey, unread, filter, filtering, focused, width, height, info }: Props) {
  const showFilter = filtering || filter.length > 0;
  const rows = Math.max(1, height - (showFilter ? 1 : 0));
  const start = Math.min(Math.max(0, selected - Math.floor(rows / 2)), Math.max(0, threads.length - rows));
  const visible = threads.slice(start, start + rows);
  if (info) info.current = { start, filterRow: showFilter };
  const inner = width - 4;

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height + 2}
      borderStyle="round"
      borderColor={focused ? "cyan" : "gray"}
    >
      {showFilter ? (
        <Text color="yellow" wrap="truncate-end">
          / {filter}
          {filtering ? "▏" : ""}
        </Text>
      ) : null}
      {visible.length === 0 ? <Text dimColor>No chats</Text> : null}
      {visible.map((t, i) => {
        const index = start + i;
        const count = unread[t.key] ?? 0;
        const badge = count > 0 ? ` ${count > 99 ? "99+" : count}` : "";
        const label = `${t.kind === "group" ? "#" : " "}${t.name}`;
        const room = Math.max(1, inner - 1 - badge.length);
        const name = Array.from(label).length > room ? Array.from(label).slice(0, room - 1).join("") + "…" : label;
        const isSelected = index === selected;
        return (
          <Box key={t.key}>
            <Text color={isSelected ? "cyan" : undefined}>{isSelected ? "▶" : " "}</Text>
            <Text
              bold={count > 0 || t.key === activeKey}
              inverse={isSelected && focused}
              wrap="truncate-end"
            >
              {name}
            </Text>
            <Box flexGrow={1} />
            {badge ? <Text color="red">{badge}</Text> : null}
          </Box>
        );
      })}
    </Box>
  );
}
