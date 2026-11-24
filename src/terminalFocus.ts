const FOCUS_IN = "\u001b[I";
const FOCUS_OUT = "\u001b[O";

export function trackTerminalFocus(onChange: (focused: boolean) => void): () => void {
  if (!process.stdout.isTTY || !process.stdin.isTTY) return () => {};
  const onData = (data: Buffer | string) => {
    const text = String(data);
    const lastIn = text.lastIndexOf(FOCUS_IN);
    const lastOut = text.lastIndexOf(FOCUS_OUT);
    if (lastIn === -1 && lastOut === -1) return;
    onChange(lastIn > lastOut);
  };
  process.stdin.on("data", onData);
  process.stdout.write("\u001b[?1004h");
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    process.stdin.off("data", onData);
    process.stdout.write("\u001b[?1004l");
  };
}
