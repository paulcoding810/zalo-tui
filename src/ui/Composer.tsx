import { Box, Text, useInput, usePaste } from "ink";
import { useEffect, useRef, useState } from "react";
import { composerLines, composerWindow, cursorLine, verticalMove, wordStart } from "./composerLayout.ts";

type Draft = { chars: string[]; cursor: number };

type Props = {
  draftKey: string | null;
  active: boolean;
  enabled: boolean;
  error?: string;
  width: number;
  maxRows: number;
  onHeight: (rows: number) => void;
  onSubmit: (text: string) => Promise<boolean>;
};

export function Composer({ draftKey, active, enabled, error, width, maxRows, onHeight, onSubmit }: Props) {
  const [chars, setChars] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const [sending, setSending] = useState(false);
  const drafts = useRef(new Map<string, Draft>());
  const currentKey = useRef(draftKey);

  useEffect(() => {
    if (currentKey.current === draftKey) return;
    if (currentKey.current) {
      if (chars.length) drafts.current.set(currentKey.current, { chars, cursor });
      else drafts.current.delete(currentKey.current);
    }
    const next = (draftKey && drafts.current.get(draftKey)) || { chars: [], cursor: 0 };
    setChars(next.chars);
    setCursor(next.cursor);
    currentKey.current = draftKey;
  }, [draftKey]);

  const insert = (text: string) => {
    const add = Array.from(text.replace(/\r\n?/g, "\n"));
    setChars((c) => [...c.slice(0, cursor), ...add, ...c.slice(cursor)]);
    setCursor((p) => p + add.length);
  };

  const lines = composerLines(chars, width - 3);
  const view = composerWindow(lines, cursor, maxRows);
  const cursorRow = cursorLine(lines, cursor);

  usePaste(insert, { isActive: active && !sending });

  useInput(
    (input, key) => {
      if (key.return && (key.shift || key.meta)) return insert("\n");
      if (key.return) {
        const text = chars.join("").trim();
        if (!text || !enabled) return;
        const sentFrom = currentKey.current;
        setSending(true);
        void onSubmit(text).then((ok) => {
          setSending(false);
          if (!ok) return;
          if (currentKey.current === sentFrom) {
            setChars([]);
            setCursor(0);
          } else if (sentFrom) {
            drafts.current.delete(sentFrom);
          }
        });
        return;
      }
      if (key.leftArrow) return setCursor((p) => Math.max(0, p - 1));
      if (key.rightArrow) return setCursor((p) => Math.min(chars.length, p + 1));
      if (key.home || (key.ctrl && input === "a")) return setCursor(0);
      if (key.end || (key.ctrl && input === "e")) return setCursor(chars.length);
      if (key.ctrl && input === "u") {
        setChars((c) => c.slice(cursor));
        return setCursor(0);
      }
      if ((key.ctrl && input === "w") || (key.meta && (key.backspace || key.delete))) {
        const start = wordStart(chars, cursor);
        setChars((c) => [...c.slice(0, start), ...c.slice(cursor)]);
        return setCursor(start);
      }
      if (key.upArrow || key.downArrow) {
        const next = verticalMove(lines, cursor, key.upArrow ? -1 : 1);
        if (next !== null) setCursor(next);
        return;
      }
      if (key.backspace || key.delete) {
        if (cursor === 0) return;
        setChars((c) => [...c.slice(0, cursor - 1), ...c.slice(cursor)]);
        return setCursor((p) => p - 1);
      }
      if (key.ctrl || key.meta || key.tab || key.escape || key.upArrow || key.downArrow) return;
      if (key.pageUp || key.pageDown) return;
      if (input) insert(input);
    },
    { isActive: active && !sending },
  );

  const status = sending ? " sending…" : error ? ` ${error}` : "";
  const placeholder = chars.length === 0 && !active;
  const visibleRows = placeholder ? 1 : view.rows;
  const height = visibleRows + (status ? 1 : 0);
  useEffect(() => onHeight(height), [height]);

  return (
    <Box flexDirection="column">
      {placeholder ? (
        <Text wrap="truncate-end">
          <Text color="gray">{"> "}</Text>
          <Text dimColor>{enabled ? "i or Enter to type a message" : "Open a chat to type"}</Text>
        </Text>
      ) : (
        lines.slice(view.top, view.top + view.rows).map((line, i) => {
          const row = view.top + i;
          const hasCursor = active && row === cursorRow;
          const text = chars.slice(line.start, line.end).join("");
          const offset = cursor - line.start;
          const at = hasCursor ? (chars[cursor] === undefined || chars[cursor] === "\n" ? " " : chars[cursor]!) : "";
          return (
            <Text key={row} wrap="truncate-end">
              <Text color={active ? "cyan" : "gray"}>{row === 0 ? "> " : view.top > 0 && i === 0 ? "↑ " : "  "}</Text>
              {hasCursor ? (
                <>
                  {Array.from(text).slice(0, offset).join("")}
                  <Text inverse>{at}</Text>
                  {Array.from(text).slice(offset + 1).join("")}
                </>
              ) : (
                text
              )}
            </Text>
          );
        })
      )}
      {status ? (
        <Text color={sending ? undefined : "red"} dimColor={sending} wrap="truncate-end">
          {status}
        </Text>
      ) : null}
    </Box>
  );
}
