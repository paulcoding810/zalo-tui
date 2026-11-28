export type ComposerLine = { start: number; end: number };

export function composerLines(chars: string[], width: number): ComposerLine[] {
  const w = Math.max(1, width);
  const lines: ComposerLine[] = [];
  let start = 0;
  for (let i = 0; i <= chars.length; i++) {
    if (i === chars.length) {
      lines.push({ start, end: i });
      if (i - start === w) lines.push({ start: i, end: i });
      break;
    }
    if (chars[i] === "\n") {
      lines.push({ start, end: i });
      start = i + 1;
    } else if (i - start === w) {
      lines.push({ start, end: i });
      start = i;
    }
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

export function verticalMove(lines: ComposerLine[], cursor: number, direction: -1 | 1): number | null {
  const line = cursorLine(lines, cursor);
  const target = lines[line + direction];
  if (!target) return null;
  const column = cursor - lines[line]!.start;
  return Math.min(target.start + column, target.end);
}

export function wordStart(chars: string[], cursor: number): number {
  let i = cursor;
  while (i > 0 && /\s/.test(chars[i - 1]!)) i--;
  while (i > 0 && !/\s/.test(chars[i - 1]!)) i--;
  return i;
}
