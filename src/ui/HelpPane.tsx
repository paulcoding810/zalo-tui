import { Box, Text } from "ink";

const SECTIONS: [string, [string, string][]][] = [
  [
    "Commands (type in the message box)",
    [
      ["/photo <path> [text]", "send a photo"],
      ["/file <path> [text]", "send a file"],
      ["", "paths may use ~/, quotes, \\ "],
      ["drag file in, Enter", "send it, after asking"],
      ["//text", "text starting with /"],
      ["/help or ?", "this help"],
    ],
  ],
  [
    "Chat list",
    [
      ["j/k g/G Ctrl+d/u", "move, ends, half page"],
      ["", "highlighting only previews"],
      ["Enter/i · l/Tab", "open and type · messages"],
      ["/ · Esc", "filter by name or text · clear"],
      ["n · m · r", "notify · groups · reconnect"],
    ],
  ],
  [
    "Messages",
    [
      ["j/k g/G Ctrl+d/u", "select, ends, half page"],
      ["/ · n · N", "search chat · older · newer"],
      ["r", "reply (Esc in the box cancels)"],
      ["e", "react: 1-6, 0 off, search"],
      ["w", "who reacted"],
      ["d · o", "recall or delete · open"],
      ["Enter/i · h/Esc/Tab", "type · back to chats"],
    ],
  ],
  [
    "Message box",
    [
      ["Enter · Alt+Enter", "send · new line"],
      ["←→↑↓ Ctrl+a/e", "move, start/end"],
      ["Ctrl+w · Ctrl+u", "delete word · to start"],
      ["@ in a group", "mention: ↑↓, Enter or Tab picks"],
      ["Esc", "back (drafts are kept)"],
    ],
  ],
  [
    "Anywhere",
    [
      ["PgUp/PgDn · wheel", "scroll"],
      ["click", "open chat, select, type"],
      ["Shift-drag", "select text"],
      ["Ctrl+C", "quit"],
    ],
  ],
];

type HelpLine = { title: string } | { key: string; text: string };

const LINES: HelpLine[] = SECTIONS.flatMap(([title, rows]) => [{ title }, ...rows.map(([key, text]) => ({ key, text }))]);

export const HELP_LINES = LINES.length;

export function HelpPane({ width, height, offset }: { width: number; height: number; offset: number }) {
  const keyWidth = Math.max(...SECTIONS.flatMap(([, rows]) => rows.map(([k]) => Array.from(k).length))) + 2;
  const start = Math.max(0, Math.min(offset, LINES.length - height));
  const more = start + height < LINES.length;
  return (
    <Box flexDirection="column" flexGrow={1} width={width} height={height + 2} borderStyle="round" borderColor="cyan">
      <Box position="absolute" marginTop={-1} marginLeft={1}>
        <Text bold> Help · {start > 0 || more ? "j/k scroll · " : ""}any other key closes </Text>
      </Box>
      {LINES.slice(start, start + height).map((line, i) =>
        "title" in line ? (
          <Text key={i} color="cyan" bold wrap="truncate-end">
            {line.title}
          </Text>
        ) : (
          <Text key={i} wrap="truncate-end">
            {"  "}
            <Text color="yellow">{line.key.padEnd(keyWidth)}</Text>
            {line.text}
          </Text>
        ),
      )}
    </Box>
  );
}
