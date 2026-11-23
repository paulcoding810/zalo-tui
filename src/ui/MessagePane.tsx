import { Box, Text } from "ink";
import { formatTime, wrapText } from "../format.ts";
import type { ChatMessage, Thread } from "../store.ts";

type Line = { key: string; msgId: string; time: string; sender: string; isSelf: boolean; text: string; dim: boolean };

type Props = {
  thread: Thread | null;
  messages: ChatMessage[];
  scroll: number;
  selectedId: string | null;
  focused: boolean;
  width: number;
  height: number;
};

export function buildLines(messages: ChatMessage[], width: number): Line[] {
  const lines: Line[] = [];
  for (const m of messages) {
    const time = formatTime(m.ts);
    const sender = m.isSelf ? "me" : m.senderName;
    const prefixLength = Array.from(`${time} ${sender}: `).length;
    const body = m.recalled ? "[recalled]" : m.url ? `${m.text} ↗` : m.text;
    const parts = wrapText(body, Math.max(10, width - prefixLength));
    parts.forEach((text, i) =>
      lines.push({
        key: `${m.id}-${i}`,
        msgId: m.id,
        time: i === 0 ? time : "",
        sender: i === 0 ? sender : "",
        isSelf: m.isSelf,
        text: i === 0 ? text : " ".repeat(prefixLength) + text,
        dim: !!m.recalled,
      }),
    );
  }
  return lines;
}

export function MessagePane({ thread, messages, scroll, selectedId, focused, width, height }: Props) {
  const inner = width - 4;
  const lines = buildLines(messages, inner);
  const maxScroll = Math.max(0, lines.length - height);
  let offset = Math.min(scroll, maxScroll);
  const first = selectedId ? lines.findIndex((l) => l.msgId === selectedId) : -1;
  if (first !== -1) {
    let last = first;
    while (last + 1 < lines.length && lines[last + 1]!.msgId === selectedId) last++;
    if (last >= lines.length - offset) offset = lines.length - last - 1;
    if (first < lines.length - offset - height) offset = Math.max(0, lines.length - first - height);
  }
  const visible = lines.slice(Math.max(0, lines.length - height - offset), lines.length - offset);
  const title = thread ? `${thread.kind === "group" ? "#" : ""}${thread.name}` : "No chat open";

  return (
    <Box flexDirection="column" flexGrow={1} height={height + 2} borderStyle="round" borderColor={focused ? "cyan" : "gray"}>
      <Box position="absolute" marginTop={-1} marginLeft={1}>
        <Text bold> {title} {offset > 0 ? `(↑${offset})` : ""}</Text>
      </Box>
      <Box flexDirection="column" flexGrow={1} justifyContent="flex-end">
        {!thread ? <Text dimColor>Pick a chat on the left and press Enter.</Text> : null}
        {thread && lines.length === 0 ? <Text dimColor>No messages loaded yet.</Text> : null}
        {visible.map((l) => (
          <Text key={l.key} wrap="truncate-end" dimColor={l.dim} inverse={l.msgId === selectedId}>
            {l.time ? <Text dimColor>{l.time} </Text> : null}
            {l.sender ? <Text color={l.isSelf ? "green" : "cyan"}>{l.sender}: </Text> : null}
            {l.text}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
