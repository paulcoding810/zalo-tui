import { Box, Text } from "ink";
import { reactionIcon } from "../reactions.ts";
import { formatTime, hyperlink, linkSegments, textLinkRanges, wrapWithOffsets, type LinkRange, type Segment } from "../format.ts";
import { reactionKey, reactionSummary, type ChatMessage, type ReactionCount, type ReactionEntry, type Thread } from "../store.ts";

type Line = {
  key: string;
  msgId: string;
  time: string;
  sender: string;
  isSelf: boolean;
  indent: number;
  segments: Segment[];
  reactions?: ReactionCount[];
  dim: boolean;
  divider?: boolean;
  quoted?: boolean;
};

type Props = {
  thread: Thread | null;
  layout: PaneLayout;
  selectedId: string | null;
  focused: boolean;
  height: number;
};

export function buildLines(
  messages: ChatMessage[],
  width: number,
  reactions: Record<string, Record<string, ReactionEntry>> = {},
  selfId = "",
  dividerTs: number | null = null,
): Line[] {
  const lines: Line[] = [];
  let dividerDone = dividerTs === null;
  for (const m of messages) {
    if (!dividerDone && !m.isSelf && m.ts > dividerTs!) {
      dividerDone = true;
      const label = " new messages ";
      const side = Math.max(2, Math.floor((width - label.length) / 2));
      lines.push({ key: "divider", msgId: "", time: "", sender: "", isSelf: false, indent: 0, segments: [{ text: `${"─".repeat(side)}${label}${"─".repeat(side)}` }], dim: false, divider: true });
    }
    const time = formatTime(m.ts);
    const sender = m.isSelf ? "me" : m.senderName;
    const prefixLength = Array.from(`${time} ${sender}: `).length;
    const summary = m.recalled ? [] : reactionSummary(reactions[reactionKey(m.threadKey, m.id)], selfId);
    const labelled = !!m.url && !m.text.includes(m.url);
    const text = m.recalled ? "[recalled]" : labelled ? `${m.text} ↗` : m.text;
    const ranges: LinkRange[] = m.recalled
      ? []
      : labelled
        ? [{ start: 0, end: Array.from(text).length, url: m.url! }]
        : textLinkRanges(text);
    const quoted = !!m.quote && !m.recalled;
    if (quoted) {
      const room = Math.max(10, width - prefixLength);
      const full = Array.from(`↳ ${m.quote!.from}: ${m.quote!.text.replace(/\s+/g, " ")}`);
      lines.push({
        key: `${m.id}-q`,
        msgId: m.id,
        time,
        sender,
        isSelf: m.isSelf,
        indent: 0,
        segments: [{ text: full.length > room ? full.slice(0, room - 1).join("") + "…" : full.join("") }],
        dim: false,
        quoted: true,
      });
    }
    wrapWithOffsets(text, Math.max(10, width - prefixLength)).forEach((line, i) =>
      lines.push({
        key: `${m.id}-${i}`,
        msgId: m.id,
        time: i === 0 && !quoted ? time : "",
        sender: i === 0 && !quoted ? sender : "",
        isSelf: m.isSelf,
        indent: i === 0 && !quoted ? 0 : prefixLength,
        segments: linkSegments(line, ranges),
        dim: !!m.recalled,
      }),
    );
    if (summary.length) {
      lines.push({
        key: `${m.id}-r`,
        msgId: m.id,
        time: "",
        sender: "",
        isSelf: m.isSelf,
        indent: prefixLength,
        segments: [],
        reactions: summary,
        dim: false,
      });
    }
  }
  return lines;
}

export type PaneLayout = { lines: Line[]; visible: Line[]; offset: number; max: number; rows: (string | null)[] };

export function paneLayout(options: {
  messages: ChatMessage[];
  reactions: Record<string, Record<string, ReactionEntry>>;
  selfId: string;
  dividerTs?: number | null;
  scroll: number;
  selectedId: string | null;
  followSelection: boolean;
  width: number;
  height: number;
}): PaneLayout {
  const { messages, reactions, selfId, dividerTs = null, scroll, selectedId, followSelection, width, height } = options;
  const lines = buildLines(messages, width - 4, reactions, selfId, dividerTs);
  const max = Math.max(0, lines.length - height);
  let offset = Math.min(scroll, max);
  const first = selectedId && followSelection ? lines.findIndex((l) => l.msgId === selectedId) : -1;
  if (first !== -1) {
    let last = first;
    while (last + 1 < lines.length && lines[last + 1]!.msgId === selectedId) last++;
    if (last >= lines.length - offset) offset = lines.length - last - 1;
    if (first < lines.length - offset - height) offset = Math.max(0, lines.length - first - height);
  }
  const visible = lines.slice(Math.max(0, lines.length - height - offset), lines.length - offset);
  const rows: (string | null)[] = Array.from({ length: height }, () => null);
  visible.forEach((l, i) => (rows[height - visible.length + i] = l.msgId || null));
  return { lines, visible, offset, max, rows };
}

export function MessagePane({ thread, layout, selectedId, focused, height }: Props) {
  const { lines, visible, offset } = layout;
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
          <Text key={l.key} wrap="truncate-end" dimColor={l.dim} color={l.divider ? "red" : undefined} inverse={!!l.msgId && l.msgId === selectedId}>
            {l.time ? <Text dimColor>{l.time} </Text> : null}
            {l.sender ? <Text color={l.isSelf ? "green" : "cyan"}>{l.sender}: </Text> : null}
            {" ".repeat(l.indent)}
            {l.reactions?.map((r, i) => (
              <Text key={i} color={r.mine ? "cyan" : undefined} bold={r.mine} dimColor={!r.mine}>
                {`${reactionIcon(r.icon)} ${r.count}  `}
              </Text>
            ))}
            {l.quoted ? <Text dimColor>{l.segments[0]?.text}</Text> : null}
            {(l.quoted ? [] : l.segments).map((s, i) =>
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
