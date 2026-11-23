import { Box, Text } from "ink";
import { formatTime, wrapText } from "../format.ts";
import type { ChatMessage, Thread } from "../store.ts";

type Line = { key: string; time: string; sender: string; isSelf: boolean; text: string; dim: boolean };

type Props = {
  thread: Thread | null;
  messages: ChatMessage[];
  scroll: number;
  width: number;
  height: number;
};

export function buildLines(messages: ChatMessage[], width: number): Line[] {
  const lines: Line[] = [];
  for (const m of messages) {
    const time = formatTime(m.ts);
    const sender = m.isSelf ? "me" : m.senderName;
    const prefixLength = Array.from(`${time} ${sender}: `).length;
    const body = m.recalled ? "[recalled]" : m.text;
    const parts = wrapText(body, Math.max(10, width - prefixLength));
    parts.forEach((text, i) =>
      lines.push({
        key: `${m.id}-${i}`,
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

export function MessagePane({ thread, messages, scroll, width, height }: Props) {
  const inner = width - 4;
  const lines = buildLines(messages, inner);
  const maxScroll = Math.max(0, lines.length - height);
  const offset = Math.min(scroll, maxScroll);
  const visible = lines.slice(Math.max(0, lines.length - height - offset), lines.length - offset);
  const title = thread ? `${thread.kind === "group" ? "#" : ""}${thread.name}` : "No chat open";

  return (
    <Box flexDirection="column" flexGrow={1} height={height + 2} borderStyle="round" borderColor="gray">
      <Box position="absolute" marginTop={-1} marginLeft={1}>
        <Text bold> {title} {offset > 0 ? `(↑${offset})` : ""}</Text>
      </Box>
      <Box flexDirection="column" flexGrow={1} justifyContent="flex-end">
        {!thread ? <Text dimColor>Pick a chat on the left and press Enter.</Text> : null}
        {thread && lines.length === 0 ? <Text dimColor>No messages loaded yet.</Text> : null}
        {visible.map((l) => (
          <Text key={l.key} wrap="truncate-end" dimColor={l.dim}>
            {l.time ? <Text dimColor>{l.time} </Text> : null}
            {l.sender ? <Text color={l.isSelf ? "green" : "cyan"}>{l.sender}: </Text> : null}
            {l.text}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
