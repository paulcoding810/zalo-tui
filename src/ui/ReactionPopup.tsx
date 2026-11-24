import { Box, Text } from "ink";
import { reactionIcon, type ReactionOption } from "../reactions.ts";
import { listWindow, Popup, type PopupFrame } from "./Popup.tsx";

export const QUICK_REACTIONS = ["/-heart", "/-strong", ":>", ":o", ":-((", ":-h"];
export const QUICK_CELL_WIDTH = 6;
export const REACTION_LIST_TOP = 2;

export function ReactionPopup({
  frame,
  query,
  cursor,
  results,
}: {
  frame: PopupFrame;
  query: string;
  cursor: number;
  results: ReactionOption[];
}) {
  const listRows = Math.max(1, frame.height - 2 - REACTION_LIST_TOP - 1);
  const start = listWindow(cursor, results.length, listRows);
  const visible = results.slice(start, start + listRows);
  return (
    <Popup frame={frame} title="React">
      <Text wrap="truncate-end">{QUICK_REACTIONS.map((code, i) => `${i + 1} ${reactionIcon(code)}`.padEnd(QUICK_CELL_WIDTH - 1)).join(" ")}</Text>
      <Text wrap="truncate-end">
        <Text color="yellow">/ {query}▏</Text>
        {query ? "" : <Text dimColor> type to search</Text>}
      </Text>
      {visible.length === 0 ? <Text dimColor>no match</Text> : null}
      {visible.map((r, i) => (
        <Text key={r.code} wrap="truncate-end" inverse={start + i === cursor}>
          {`${start + i === cursor ? "▶" : " "} ${r.emoji} ${r.name}`}
        </Text>
      ))}
      <Box flexGrow={1} />
      <Text dimColor wrap="truncate-end">
        1-6 quick · ↑↓ Enter · 0 remove · Esc
      </Text>
    </Popup>
  );
}
