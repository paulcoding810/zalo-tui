import { Box, Text } from "ink";
import type { ReactNode } from "react";

export const TERMINAL_BACKGROUND = "default";

export type PopupFrame = { left: number; top: number; width: number; height: number };

export function placePopup(
  rows: (string | null)[],
  selectedId: string | null,
  sidebarWidth: number,
  paneWidth: number,
  width: number,
  maxHeight: number,
  minHeight = 6,
): PopupFrame {
  const w = Math.max(10, Math.min(width, paneWidth - 2));
  const full = Math.max(3, Math.min(maxHeight, rows.length + 2));
  const left = sidebarWidth + Math.max(1, paneWidth - w - 2);
  const first = selectedId ? rows.indexOf(selectedId) : -1;
  if (first === -1) return { left, top: 0, width: w, height: full };
  const selectedTop = first + 1;
  const selectedBottom = rows.lastIndexOf(selectedId) + 1;
  const above = selectedTop;
  const below = rows.length + 1 - selectedBottom;
  if (Math.max(above, below) < Math.min(minHeight, full)) return { left, top: 0, width: w, height: full };
  if (above >= below) {
    const h = Math.min(full, above);
    return { left, top: selectedTop - h, width: w, height: h };
  }
  return { left, top: selectedBottom + 1, width: w, height: Math.min(full, below) };
}

export function listWindow(cursor: number, total: number, rows: number): number {
  return Math.min(Math.max(0, cursor - rows + 1), Math.max(0, total - rows));
}

export function popupContentAt(frame: PopupFrame, x: number, y: number): { col: number; row: number } | null {
  const screenLeft = frame.left + 1;
  const screenTop = frame.top + 1;
  if (x < screenLeft || x >= screenLeft + frame.width || y < screenTop || y >= screenTop + frame.height) return null;
  return { col: x - screenLeft - 1, row: y - screenTop - 1 };
}

export function Popup({ frame, title, children }: { frame: PopupFrame; title: string; children: ReactNode }) {
  return (
    <Box
      position="absolute"
      marginLeft={frame.left}
      marginTop={frame.top}
      width={frame.width}
      height={frame.height}
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      backgroundColor={TERMINAL_BACKGROUND}
      overflow="hidden"
    >
      <Box position="absolute" marginTop={-1} marginLeft={1}>
        <Text bold> {title} </Text>
      </Box>
      {children}
    </Box>
  );
}
