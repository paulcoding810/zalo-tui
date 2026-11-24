import { Box, Text, useInput, usePaste } from "ink";
import { useEffect, useRef, useState } from "react";

type Draft = { chars: string[]; cursor: number };

type Props = {
  draftKey: string | null;
  active: boolean;
  enabled: boolean;
  error?: string;
  onSubmit: (text: string) => Promise<boolean>;
};

export function Composer({ draftKey, active, enabled, error, onSubmit }: Props) {
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

  usePaste(insert, { isActive: active && !sending });

  useInput(
    (input, key) => {
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

  const before = chars.slice(0, cursor).join("");
  const at = chars[cursor] ?? " ";
  const after = chars.slice(cursor + 1).join("");

  return (
    <Box>
      <Text color={active ? "cyan" : "gray"}>{"> "}</Text>
      {chars.length === 0 && !active ? (
        <Text dimColor>{enabled ? "Tab to type a message" : "Open a chat to type"}</Text>
      ) : (
        <Text wrap="truncate-start">
          {before}
          {active ? <Text inverse>{at}</Text> : at}
          {after}
        </Text>
      )}
      {sending ? <Text dimColor> sending…</Text> : null}
      {error ? <Text color="red"> {error}</Text> : null}
    </Box>
  );
}
