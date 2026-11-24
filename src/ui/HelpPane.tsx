import { Box, Text } from "ink";

const SECTIONS: [string, [string, string][]][] = [
  [
    "Commands (type in the message box)",
    [
      ["/photo <path> [caption]", "send a photo (jpg, png, webp)"],
      ["/file <path> [caption]", "send a file"],
      ["drag a file in, Enter", "send it, after asking"],
      ["//text", "send text that starts with /"],
      ["/help or ?", "this help"],
    ],
  ],
  [
    "Chat list",
    [
      ["j/k ↑↓  g/G  Ctrl+d/u", "move, top/bottom, half page"],
      ["/  n  r", "filter, notifications, reconnect"],
      ["l or Tab · Enter or i", "messages · type"],
    ],
  ],
  [
    "Messages",
    [
      ["j/k  g/G", "select message"],
      ["e  (m for more)", "react"],
      ["d", "recall or delete"],
      ["o", "open photo, file or link"],
      ["h or Tab · i", "chats · type"],
    ],
  ],
  [
    "Message box",
    [
      ["Enter · Esc", "send · back"],
      ["←→  Ctrl+a/e  Ctrl+u", "move, start/end, clear"],
    ],
  ],
  [
    "Anywhere",
    [
      ["PgUp/PgDn · wheel", "scroll messages"],
      ["click", "open chat, select message, type"],
      ["Shift-drag", "select text"],
      ["Ctrl+C", "quit"],
    ],
  ],
];

export function HelpPane({ width, height }: { width: number; height: number }) {
  const keyWidth = Math.max(...SECTIONS.flatMap(([, rows]) => rows.map(([k]) => Array.from(k).length))) + 2;
  return (
    <Box flexDirection="column" flexGrow={1} width={width} height={height + 2} borderStyle="round" borderColor="cyan" overflow="hidden">
      <Box position="absolute" marginTop={-1} marginLeft={1}>
        <Text bold> Help · any key to close </Text>
      </Box>
      {SECTIONS.map(([title, rows]) => (
        <Box key={title} flexDirection="column">
          <Text color="cyan" bold>
            {title}
          </Text>
          {rows.map(([k, v]) => (
            <Text key={k} wrap="truncate-end">
              {"  "}
              <Text color="yellow">{k.padEnd(keyWidth)}</Text>
              {v}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}
