import { Box, Text } from "ink";
import { formatTime, hyperlink, linkSegments, reactionIcon, textLinkRanges, wrapWithOffsets, type LinkRange, type Segment } from "../format.ts";
import { reactionKey, reactionSummary, type ChatMessage, type ReactionEntry, type Thread } from "../store.ts";

type Line = { key: string; msgId: string; time: string; sender: string; isSelf: boolean; indent: number; segments: Segment[]; dim: boolean };

type Props = {
  thread: Thread | null;
  messages: ChatMessage[];
  reactions: Record<string, Record<string, ReactionEntry>>;
  scroll: number;
  selectedId: string | null;
  followSelection: boolean;
  info?: { current: { offset: number; max: number } };
  focused: boolean;
  width: number;
  height: number;
};

export function buildLines(
  messages: ChatMessage[],
  width: number,
  reactions: Record<string, Record<string, ReactionEntry>> = {},
): Line[] {
  const lines: Line[] = [];
  for (const m of messages) {
    const time = formatTime(m.ts);
    const sender = m.isSelf ? "me" : m.senderName;
    const prefixLength = Array.from(`${time} ${sender}: `).length;
    const summary = reactionSummary(reactions[reactionKey(m.threadKey, m.id)])
      .map((r) => `${reactionIcon(r.icon)}${r.count > 1 ? r.count : ""}`)
      .join(" ");
    const labelled = !!m.url && !m.text.includes(m.url);
    const text = m.recalled ? "[recalled]" : labelled ? `${m.text} ↗` : m.text;
    const body = summary ? `${text}  ${summary}` : text;
    const ranges: LinkRange[] = m.recalled
      ? []
      : labelled
        ? [{ start: 0, end: Array.from(text).length, url: m.url! }]
        : textLinkRanges(text);
    wrapWithOffsets(body, Math.max(10, width - prefixLength)).forEach((line, i) =>
      lines.push({
        key: `${m.id}-${i}`,
        msgId: m.id,
        time: i === 0 ? time : "",
        sender: i === 0 ? sender : "",
        isSelf: m.isSelf,
        indent: i === 0 ? 0 : prefixLength,
        segments: linkSegments(line, ranges),
        dim: !!m.recalled,
      }),
    );
  }
  return lines;
}

export function MessagePane({
  thread,
  messages,
  reactions,
  scroll,
  selectedId,
  followSelection,
  info,
  focused,
  width,
  height,
}: Props) {
  const inner = width - 4;
  const lines = buildLines(messages, inner, reactions);
  const maxScroll = Math.max(0, lines.length - height);
  let offset = Math.min(scroll, maxScroll);
  const first = selectedId && followSelection ? lines.findIndex((l) => l.msgId === selectedId) : -1;
  if (first !== -1) {
    let last = first;
    while (last + 1 < lines.length && lines[last + 1]!.msgId === selectedId) last++;
    if (last >= lines.length - offset) offset = lines.length - last - 1;
    if (first < lines.length - offset - height) offset = Math.max(0, lines.length - first - height);
  }
  if (info) info.current = { offset, max: maxScroll };
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
            {" ".repeat(l.indent)}
            {l.segments.map((s, i) =>
              s.url ? (
                <Text key={i} underline>
                  {hyperlink(s.url, s.text)}
                </Text>
              ) : (
                s.text
              ),
            )}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
