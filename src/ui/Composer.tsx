import { Box, Text, useInput, usePaste } from "ink";
import { useEffect, useRef, useState } from "react";
import { EVERYONE, filterMembers, mentionQuery, type Member } from "../mentions.ts";
import { composerLines, composerWindow, cursorLine, verticalMove, wordStart } from "./composerLayout.ts";

type Draft = { chars: string[]; cursor: number; picks: Member[] };

type Props = {
  draftKey: string | null;
  active: boolean;
  enabled: boolean;
  error?: string;
  width: number;
  maxRows: number;
  maxHeight: number;
  onHeight: (rows: number) => void;
  members?: Member[] | null;
  onMentionStart?: () => void;
  onSuggesting?: (open: boolean) => void;
  onSubmit: (text: string, picks: Member[]) => Promise<boolean>;
};

export function Composer({ draftKey, active, enabled, error, width, maxRows, maxHeight, onHeight, members, onMentionStart, onSuggesting, onSubmit }: Props) {
  const [chars, setChars] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const [picks, setPicks] = useState<Member[]>([]);
  const [suggestion, setSuggestion] = useState(0);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const drafts = useRef(new Map<string, Draft>());
  const currentKey = useRef(draftKey);

  useEffect(() => {
    if (currentKey.current === draftKey) return;
    if (currentKey.current) {
      if (chars.length) drafts.current.set(currentKey.current, { chars, cursor, picks });
      else drafts.current.delete(currentKey.current);
    }
    const next = (draftKey && drafts.current.get(draftKey)) || { chars: [], cursor: 0, picks: [] };
    setChars(next.chars);
    setCursor(next.cursor);
    setPicks(next.picks);
    setDismissed(null);
    currentKey.current = draftKey;
  }, [draftKey]);

  const insert = (text: string) => {
    const add = Array.from(text.replace(/\r\n?/g, "\n"));
    setChars((c) => [...c.slice(0, cursor), ...add, ...c.slice(cursor)]);
    setCursor((p) => p + add.length);
  };

  const lines = composerLines(chars, width - 3);
  const cursorRow = cursorLine(lines, cursor);

  const query = members && active ? mentionQuery(chars, cursor) : null;
  const suggestions = query && dismissed !== query.start ? filterMembers([...members!, EVERYONE], query.query) : [];
  const chosen = Math.min(suggestion, Math.max(0, suggestions.length - 1));
  const status = sending ? " sending…" : error ? ` ${error}` : "";
  const budget = Math.max(1, maxHeight - (status ? 1 : 0));
  const suggestionRows = Math.min(suggestions.length, Math.max(0, budget - 1));
  const suggestionTop = Math.min(Math.max(0, chosen - suggestionRows + 1), Math.max(0, suggestions.length - suggestionRows));
  const suggesting = suggestionRows > 0;
  const view = composerWindow(lines, cursor, Math.max(1, Math.min(maxRows, budget - suggestionRows)));
  useEffect(() => {
    if (!query) setDismissed(null);
  }, [!!query]);
  useEffect(() => {
    if (query) onMentionStart?.();
  }, [query?.start]);
  useEffect(() => {
    setSuggestion(0);
  }, [query?.start, query?.query]);
  useEffect(() => onSuggesting?.(suggesting), [suggesting]);

  const accept = (member: Member) => {
    if (!query) return;
    const add = Array.from(`@${member.name} `);
    setChars((c) => [...c.slice(0, query.start), ...add, ...c.slice(cursor)]);
    setCursor(query.start + add.length);
    setPicks((p) => [...p, member]);
  };

  usePaste(insert, { isActive: active && !sending });

  useInput(
    (input, key) => {
      if (suggesting) {
        if (key.upArrow) return setSuggestion(Math.max(0, chosen - 1));
        if (key.downArrow) return setSuggestion(Math.min(suggestions.length - 1, chosen + 1));
        if ((key.return && !key.shift && !key.meta) || key.tab) return accept(suggestions[chosen]!);
        if (key.escape) return setDismissed(query!.start);
      }
      if (key.return && (key.shift || key.meta)) return insert("\n");
      if (key.return) {
        const text = chars.join("").trim();
        if (!text || !enabled) return;
        const sentFrom = currentKey.current;
        setSending(true);
        void onSubmit(text, picks).then((ok) => {
          setSending(false);
          if (!ok) return;
          if (currentKey.current === sentFrom) {
            setChars([]);
            setCursor(0);
            setPicks([]);
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
        const next = verticalMove(lines, chars, cursor, key.upArrow ? -1 : 1);
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

  const placeholder = chars.length === 0 && !active;
  const visibleRows = placeholder ? 1 : view.rows;
  const height = visibleRows + (status ? 1 : 0) + suggestionRows;
  useEffect(() => onHeight(height), [height]);

  return (
    <Box flexDirection="column">
      {suggestions.slice(suggestionTop, suggestionTop + suggestionRows).map((m, j) => {
        const i = suggestionTop + j;
        return (
          <Text key={m.uid} wrap="truncate-end">
            <Text color="cyan">{i === chosen ? "▶ " : "  "}</Text>
            <Text inverse={i === chosen}>@{m.name}</Text>
            {j === 0 ? <Text dimColor>{"  ↑↓ Enter/Tab pick · Esc"}</Text> : null}
          </Text>
        );
      })}
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
