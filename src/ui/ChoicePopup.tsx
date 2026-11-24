import { Box, Text } from "ink";
import { listWindow, Popup, type PopupFrame } from "./Popup.tsx";

export type Choice = { label: string; hint?: string; color?: string };

export function ChoicePopup({
  frame,
  title,
  choices,
  cursor,
  footer,
}: {
  frame: PopupFrame;
  title: string;
  choices: Choice[];
  cursor: number;
  footer: string;
}) {
  return (
    <Popup frame={frame} title={title}>
      {visibleChoices(frame, choices.length, cursor).map((i) => {
        const c = choices[i]!;
        return (
          <Text key={i} wrap="truncate-end" inverse={i === cursor} color={c.color}>
            {`${i === cursor ? "▶" : " "} ${c.hint ? `${c.hint}  ` : ""}${c.label}`}
          </Text>
        );
      })}
      <Box flexGrow={1} />
      <Text dimColor wrap="truncate-end">
        {footer}
      </Text>
    </Popup>
  );
}

export function choicePopupHeight(count: number): number {
  return count + 3;
}

export function visibleChoices(frame: PopupFrame, total: number, cursor: number): number[] {
  const rows = Math.max(1, frame.height - 3);
  const start = listWindow(Math.min(cursor, total - 1), total, rows);
  return Array.from({ length: Math.min(rows, total) }, (_, i) => start + i);
}
