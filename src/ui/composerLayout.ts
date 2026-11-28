import stringWidth from "string-width";

export type ComposerLine = { start: number; end: number; soft: boolean };

export function charWidth(ch: string): number {
  return ch === "\n" ? 0 : Math.max(1, stringWidth(ch));
}

export function composerLines(chars: string[], width: number, measure: (ch: string) => number = charWidth): ComposerLine[] {
  const w = Math.max(2, width);
  const lines: ComposerLine[] = [];
  let start = 0;
  let col = 0;
  for (let i = 0; i <= chars.length; i++) {
    if (i === chars.length) {
      lines.push({ start, end: i, soft: false });
      if (col >= w) {
        lines[lines.length - 1]!.soft = true;
        lines.push({ start: i, end: i, soft: false });
      }
      break;
    }
    if (chars[i] === "\n") {
      lines.push({ start, end: i, soft: false });
      start = i + 1;
      col = 0;
      continue;
    }
    const cw = measure(chars[i]!);
    if (col + cw > w && i > start) {
      lines.push({ start, end: i, soft: true });
      start = i;
      col = 0;
    }
    col += cw;
  }
  return lines;
}

export function cursorLine(lines: ComposerLine[], cursor: number): number {
  let index = 0;
  lines.forEach((l, i) => {
    if (l.start <= cursor) index = i;
  });
  return index;
}

export function composerWindow(lines: ComposerLine[], cursor: number, maxRows: number): { top: number; rows: number } {
  const rows = Math.max(1, Math.min(lines.length, maxRows));
  const line = cursorLine(lines, cursor);
  let top = lines.length - rows;
  if (line < top) top = line;
  return { top, rows };
}

export function verticalMove(
  lines: ComposerLine[],
  chars: string[],
  cursor: number,
  direction: -1 | 1,
  measure: (ch: string) => number = charWidth,
): number | null {
  const line = cursorLine(lines, cursor);
  const target = lines[line + direction];
  if (!target) return null;
  let column = 0;
  for (let i = lines[line]!.start; i < cursor; i++) column += measure(chars[i]!);
  const last = target.soft && target.end > target.start ? target.end - 1 : target.end;
  let pos = target.start;
  let col = 0;
  while (pos < last && col + measure(chars[pos]!) <= column) col += measure(chars[pos++]!);
  return pos;
}

export function wordStart(chars: string[], cursor: number): number {
  let i = cursor;
  while (i > 0 && /\s/.test(chars[i - 1]!)) i--;
  while (i > 0 && !/\s/.test(chars[i - 1]!)) i--;
  return i;
}
