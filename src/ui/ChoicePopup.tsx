import { Box, Text } from "ink";
import { Popup, type PopupFrame } from "./Popup.tsx";

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
      {choices.map((c, i) => (
        <Text key={i} wrap="truncate-end" inverse={i === cursor} color={c.color}>
          {`${i === cursor ? "▶" : " "} ${c.hint ? `${c.hint}  ` : ""}${c.label}`}
        </Text>
      ))}
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
